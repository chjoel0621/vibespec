/* ---- persistence + history ---- */
let HISTORY=[], HPTR=-1, restoring=false;
function snapshot(){ return JSON.stringify(SOT); }
// RO guards live here, at the persistence boundary: whatever slips past the UI,
// a read-only document can neither be stored nor become an undo step — and it
// can never overwrite the user's own working SOT in localStorage.
function saveLocal(){ if(RO) return; try{ localStorage.setItem(LS_KEY, snapshot()); }catch(e){} }
function pushHistory(label){
  if(RO) return;
  const snap=snapshot();
  if(HPTR>=0 && HISTORY[HPTR] && HISTORY[HPTR].sot===snap) return; // no change
  HISTORY = HISTORY.slice(0, HPTR+1);
  HISTORY.push({t:Date.now(), label: label || (t(VIEWNAME[VIEW],VIEWNAME_EN[VIEW])+t(" 편집"," edit")), sot:snap});
  if(HISTORY.length>120){ HISTORY.shift(); }
  HPTR = HISTORY.length-1;
  saveLocal(); renderHistory(); updateUndoButtons();
}
function restoreTo(i){
  if(i<0 || i>=HISTORY.length) return;
  HPTR=i; SOT=normalize(JSON.parse(HISTORY[i].sot));
  saveLocal(); render(); renderHistory(); updateUndoButtons();
}
function undo(){ if(HPTR>0) restoreTo(HPTR-1); }
function redo(){ if(HPTR<HISTORY.length-1) restoreTo(HPTR+1); }
function updateUndoButtons(){
  const u=document.getElementById("undoBtn"), r=document.getElementById("redoBtn");
  if(u) u.disabled = HPTR<=0;
  if(r) r.disabled = HPTR>=HISTORY.length-1;
}
function renderHistory(){
  const el=document.getElementById("histList"); if(!el) return;
  el.innerHTML = HISTORY.map((h,i)=>{
    const d=new Date(h.t); const tt=d.toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
    return `<div class="hist-item ${i===HPTR?'cur':''}" data-hist="${i}">
      <span class="hi-dot"></span><span class="hi-label">${esc(h.label)}</span><span class="hi-time">${tt}</span></div>`;
  }).reverse().join("") || `<div class="empty" style="padding:10px">${t('기록 없음','No history')}</div>`;
}
function snapshotIfChanged(label){ const s=snapshot(); if(!(HPTR>=0 && HISTORY[HPTR] && HISTORY[HPTR].sot===s)) pushHistory(label); }
