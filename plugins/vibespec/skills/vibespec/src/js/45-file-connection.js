/* ---- connected SOT file I/O (File System Access API with download fallback) ---- */
// Only a FileSystemFileHandle is persisted. SOT text, history, and drafts stay
// in memory so a browser profile never becomes a second source of truth.
const FILE_DB_NAME="vibespec-file-connections-v1";
const FILE_DB_STORE="connections";
let CONNECTED_FILE_HANDLE=null;
let CONNECTED_FILE_SIGNATURE="";
// A recovered handle is not safe to write until its file content has been read
// into this viewer. This prevents a reopened viewer from overwriting the SOT
// with its embedded/default document before the user reloads it.
let CONNECTED_FILE_RESTORE_PENDING=false;
let LAST_SAVED_CANONICAL="";

function supportsFileConnection(){
  return !RO && typeof window!=="undefined" && window.isSecureContext===true && typeof window.showSaveFilePicker==="function";
}
function fileConnectionKey(){
  try{return "viewer:"+window.location.href.split("#")[0];}catch(_){return "viewer:default";}
}
function fileTextSignature(text){
  // A lightweight change detector, not a security hash. The full SOT text is
  // never stored; only this in-memory signature is used before overwriting.
  let hash=2166136261;
  for(let i=0;i<text.length;i++){ hash^=text.charCodeAt(i); hash=Math.imul(hash,16777619); }
  return text.length+":"+(hash>>>0).toString(16);
}
function connectedFileName(){ return CONNECTED_FILE_HANDLE&&CONNECTED_FILE_HANDLE.name ? CONNECTED_FILE_HANDLE.name : ""; }
function setFileStatus(kind,message){
  const el=document.getElementById("fileStatus"); if(!el) return;
  el.className="file-status"+(kind?" "+kind:""); el.textContent=message||"";
}
function refreshFileConnectionStatus(){
  if(RO) return;
  if(!supportsFileConnection()) return setFileStatus("warning",t("다운로드로 저장됩니다","Downloads in this browser"));
  if(CONNECTED_FILE_HANDLE){
    if(CONNECTED_FILE_RESTORE_PENDING) return setFileStatus("warning",t("연결됨 · ","Connected · ")+connectedFileName()+t(" · 다시 불러오기 필요"," · reload required"));
    return setFileStatus("connected",t("연결됨 · ","Connected · ")+connectedFileName());
  }
  setFileStatus("",t("저장 위치 미연결","No file connected"));
}
function downloadText(text,name){
  const blob=new Blob([text],{type:"application/json"});
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=name; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
function downloadCurrentSot(){ downloadText(canonicalSOT(),(SOT.title||"sot").replace(/\s+/g,"_")+".sot.json"); }
function suggestedSotFileName(saveAs){
  const fallback=(SOT.title||"sot").replace(/\s+/g,"_")+".sot.json";
  if(!saveAs) return fallback;
  const current=connectedFileName()||fallback;
  const match=current.match(/^(.*?)(?:[-_. ]v(\d+))?(\.sot\.json)$/i);
  if(!match) return fallback.replace(/\.sot\.json$/i,"-v2.sot.json");
  return match[1]+"-v"+(Number(match[2]||1)+1)+match[3];
}
function hasUnsavedViewerChanges(){ return !!LAST_SAVED_CANONICAL && canonicalSOT()!==LAST_SAVED_CANONICAL; }
function markViewerSaved(){ LAST_SAVED_CANONICAL=canonicalSOT(); }

function openFileDatabase(){
  return new Promise((resolve,reject)=>{
    if(typeof indexedDB==="undefined") return reject(new Error("IndexedDB unavailable"));
    const request=indexedDB.open(FILE_DB_NAME,1);
    request.onupgradeneeded=()=>request.result.createObjectStore(FILE_DB_STORE,{keyPath:"key"});
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error||new Error("IndexedDB unavailable"));
  });
}
async function persistConnectedHandle(){
  if(!CONNECTED_FILE_HANDLE) return false;
  try{
    const db=await openFileDatabase();
    await new Promise((resolve,reject)=>{
      const tx=db.transaction(FILE_DB_STORE,"readwrite");
      tx.objectStore(FILE_DB_STORE).put({key:fileConnectionKey(),handle:CONNECTED_FILE_HANDLE});
      tx.oncomplete=resolve; tx.onerror=()=>reject(tx.error); tx.onabort=()=>reject(tx.error);
    });
    db.close(); return true;
  }catch(_){ return false; }
}
async function restoreConnectedHandle(){
  if(!supportsFileConnection()) return false;
  try{
    const db=await openFileDatabase();
    const row=await new Promise((resolve,reject)=>{
      const tx=db.transaction(FILE_DB_STORE,"readonly"), request=tx.objectStore(FILE_DB_STORE).get(fileConnectionKey());
      request.onsuccess=()=>resolve(request.result); request.onerror=()=>reject(request.error);
    });
    db.close();
    if(row&&row.handle){
      CONNECTED_FILE_HANDLE=row.handle;
      CONNECTED_FILE_RESTORE_PENDING=true;
      // Read automatically only when the browser has already granted access.
      // A prompt is deliberately deferred to the next user click.
      if(await ensureConnectedPermission("read",false)){
        try{
          const remote=await readConnectedFile();
          if(applyLoadedSot(remote.text,t("연결된 파일 복원","Connected file restored"),true)){
            CONNECTED_FILE_SIGNATURE=remote.signature;
            CONNECTED_FILE_RESTORE_PENDING=false;
          }
        }catch(_){ /* Keep the handle, but require an explicit reload. */ }
      }
      refreshFileConnectionStatus(); return true;
    }
  }catch(_){ /* Persistence is optional; same-tab connection still works. */ }
  return false;
}
async function ensureConnectedPermission(mode,requestIfNeeded){
  if(!CONNECTED_FILE_HANDLE) return false;
  if(typeof CONNECTED_FILE_HANDLE.queryPermission!=="function") return true;
  try{
    let state=await CONNECTED_FILE_HANDLE.queryPermission({mode});
    if(state!=="granted" && requestIfNeeded && typeof CONNECTED_FILE_HANDLE.requestPermission==="function"){
      state=await CONNECTED_FILE_HANDLE.requestPermission({mode});
    }
    return state==="granted";
  }catch(_){ return false; }
}
async function readConnectedFile(){
  const file=await CONNECTED_FILE_HANDLE.getFile();
  const text=await file.text();
  return {text,signature:fileTextSignature(text),name:file.name||connectedFileName()};
}
function applyLoadedSot(text,label,replaceHistory){
  try{
    SOT=normalize(JSON.parse(text)); resetSelections();
    if(replaceHistory){ HISTORY=[]; HPTR=-1; }
    pushHistory(label||t("파일 다시 불러오기","File reload")); markViewerSaved(); render(); return true;
  }catch(_){
    setFileStatus("error",t("불러오기 실패: 올바른 SOT JSON이 아닙니다","Load failed: invalid SOT JSON"));
    alert(t("불러오기 실패: 올바른 JSON 파일이 아닙니다.","Load failed: not a valid JSON file.")); return false;
  }
}
async function writeConnectedSot(forceOverwrite){
  const next=canonicalSOT();
  try{
    // A newly selected save location may not exist until createWritable() closes.
    // Only inspect a file when this viewer has a prior connected-file baseline.
    if(CONNECTED_FILE_SIGNATURE && !forceOverwrite){
      const remote=await readConnectedFile();
      if(remote.signature!==CONNECTED_FILE_SIGNATURE){
        const overwrite=window.confirm(t("연결된 파일이 AI 또는 다른 도구로 변경되었습니다. 현재 뷰어의 내용으로 덮어쓸까요? 취소하면 다시 불러올 수 있습니다.","The connected file changed outside this viewer. Overwrite it with the current viewer content? Cancel to reload it instead."));
        if(!overwrite){ setFileStatus("warning",t("외부 변경 감지 · 다시 불러오기 필요","External change detected · reload needed")); return false; }
      }
    }
    let writable;
    try{ writable=await CONNECTED_FILE_HANDLE.createWritable(); await writable.write(next); await writable.close(); }
    catch(error){ try{ if(writable) await writable.abort(); }catch(_){} throw error; }
    CONNECTED_FILE_SIGNATURE=fileTextSignature(next); CONNECTED_FILE_RESTORE_PENDING=false; markViewerSaved(); refreshFileConnectionStatus(); flash(); return true;
  }catch(_){
    setFileStatus("error",t("파일에 저장하지 못했습니다 · 권한 또는 파일 상태를 확인하세요","Could not save · check file permission or availability")); return false;
  }
}
async function chooseSaveLocation(saveAs){
  try{
    CONNECTED_FILE_HANDLE=await window.showSaveFilePicker({
      id:"vibespec-sot",
      suggestedName:suggestedSotFileName(!!saveAs),
      types:[{description:"VibeSpec SOT JSON",accept:{"application/json":[".json"]}}]
    });
    CONNECTED_FILE_SIGNATURE=""; CONNECTED_FILE_RESTORE_PENDING=false; await persistConnectedHandle(); refreshFileConnectionStatus();
    const saved=await saveCurrentSot();
    if(saved&&saveAs) setFileStatus("connected",t("새 버전 · ","New version · ")+connectedFileName());
    return saved;
  }catch(error){
    if(error&&error.name==="AbortError") return false;
    setFileStatus("error",t("저장 위치를 선택하지 못했습니다","Could not choose a save location")); return false;
  }
}
async function saveCurrentSot(){
  if(RO) return false;
  if(!supportsFileConnection()){ downloadCurrentSot(); refreshFileConnectionStatus(); return true; }
  if(!CONNECTED_FILE_HANDLE) return chooseSaveLocation(false);
  if(CONNECTED_FILE_RESTORE_PENDING){
    const reloaded=await reloadConnectedSot(false,true);
    if(reloaded) setFileStatus("warning",t("연결된 파일을 불러왔습니다 · 저장하려면 다시 누르세요","Connected file loaded · save again to write"));
    return false;
  }
  if(!await ensureConnectedPermission("readwrite",true)){
    setFileStatus("warning",t("파일 권한이 필요합니다 · 위치 변경 또는 다운로드를 사용하세요","File permission is required · change location or download a copy")); return false;
  }
  return writeConnectedSot(false);
}
async function reloadConnectedSot(skipUnsavedConfirm,replaceHistory){
  if(RO) return false;
  if(!CONNECTED_FILE_HANDLE) return connectExistingSot();
  if(!skipUnsavedConfirm && hasUnsavedViewerChanges() && !window.confirm(t("저장하지 않은 뷰어 수정이 사라집니다. 연결된 파일을 다시 불러올까요?","Unsaved viewer edits will be lost. Reload the connected file?"))) return false;
  if(!await ensureConnectedPermission("read",true)){
    setFileStatus("warning",t("파일 읽기 권한이 필요합니다","File read permission is required")); return false;
  }
  try{
    const remote=await readConnectedFile();
    if(!applyLoadedSot(remote.text,t("파일 다시 불러오기","File reload"),replaceHistory)) return false;
    CONNECTED_FILE_SIGNATURE=remote.signature; CONNECTED_FILE_RESTORE_PENDING=false; refreshFileConnectionStatus(); return true;
  }catch(_){
    setFileStatus("error",t("연결된 파일을 읽지 못했습니다","Could not read the connected file")); return false;
  }
}
async function connectExistingSot(){
  if(!supportsFileConnection() || typeof window.showOpenFilePicker!=="function"){
    document.getElementById("fileInput").click(); return false;
  }
  if(hasUnsavedViewerChanges() && !window.confirm(t("저장하지 않은 뷰어 수정이 사라집니다. 다른 파일을 연결할까요?","Unsaved viewer edits will be lost. Connect another file?"))) return false;
  try{
    const handles=await window.showOpenFilePicker({multiple:false,types:[{description:"VibeSpec SOT JSON",accept:{"application/json":[".json"]}}]});
    CONNECTED_FILE_HANDLE=handles[0]||null; if(!CONNECTED_FILE_HANDLE) return false;
    CONNECTED_FILE_SIGNATURE=""; CONNECTED_FILE_RESTORE_PENDING=false;
    await persistConnectedHandle(); refreshFileConnectionStatus(); return reloadConnectedSot(true,true);
  }catch(error){
    if(error&&error.name==="AbortError") return false;
    setFileStatus("error",t("파일을 연결하지 못했습니다","Could not connect the file")); return false;
  }
}
function changeSaveLocation(){ return supportsFileConnection() ? chooseSaveLocation(true) : (downloadCurrentSot(),refreshFileConnectionStatus(),Promise.resolve(true)); }
function loadFallbackFile(file){
  if(!file) return; const rd=new FileReader();
  rd.onload=()=>{ if(applyLoadedSot(rd.result,t("파일 불러오기","File load"),true)) setFileStatus("warning",t("다운로드 모드 · 파일이 연결되지는 않았습니다","Download mode · file is not connected")); };
  rd.readAsText(file);
}
function migrateLegacySotDraft(){
  try{
    const legacy=localStorage.getItem(LEGACY_SOT_KEY); if(!legacy) return;
    localStorage.removeItem(LEGACY_SOT_KEY);
    if(window.confirm(t("이전 버전의 브라우저 임시 SOT가 있습니다. 사본을 다운로드할까요?", "A legacy browser SOT draft was found. Download a copy?"))){
      downloadText(legacy,"vibespec-legacy-draft.sot.json");
    }
  }catch(_){ /* Storage can be unavailable in privacy-restricted contexts. */ }
}
async function initializeFileConnection(){
  if(RO) return;
  markViewerSaved(); migrateLegacySotDraft(); refreshFileConnectionStatus(); await restoreConnectedHandle();
}
