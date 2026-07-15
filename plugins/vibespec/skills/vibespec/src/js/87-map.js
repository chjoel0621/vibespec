/* ---- read-only product map (v2): renders a composed main + active initiatives
   payload (kind: "vibespec-product-map"). Dormant for normal SOT documents. ---- */
let MAP = null;      // the composed map payload
let MAPDOC = null;   // scope id of the source document currently open from the map
function mapStatusLabel(s){ const m=INIT_STATUS[s]; return m?t(m.t,m.e):s; }
function mapScope(id){ return ((MAP&&MAP.scopes)||[]).find(x=>x.id===id) || null; }
// A map that only shows an increment is a dead end. Every node offers a way into
// the document that defines it: an embedded copy of that scope's SOT (the normal
// case — the map is one self-contained file), or an href when the map was built
// for a site where each scope is its own page (--link).
function mapScopeHref(id){ const s=mapScope(id); return s&&s.href ? s.href : null; }
function mapScopeDoc(id){ const s=mapScope(id); return s&&s.sot ? s.sot : null; }
function renderMapNode(p){
  const kids = (p.children&&p.children.length)?`<ul>${p.children.map(renderMapNode).join("")}</ul>`:"";
  const cls = p.scope==="root" ? (p.type==="top"?"top":(p.type==="action"?"action":"page")) : "map-init";
  const tag = p.scope!=="root" ? ` <span class="map-scopetag">+${esc(p.scope)}</span>` : "";
  const href = mapScopeHref(p.scope);
  const open = t("이 화면을 정의한 문서 열기","Open the document that defines this screen");
  const body = `<span class="stype">${esc(p.compositeId)}</span>
      <span class="stitle">${esc(p.title)}${tag}</span>`;
  const node = href
    ? `<a class="snode ${cls} map-linked" href="${esc(href)}" title="${open}">${body}</a>`
    : mapScopeDoc(p.scope)
      ? `<div class="snode ${cls} map-linked" role="button" tabindex="0" data-open="${esc(p.scope)}" title="${open}">${body}</div>`
      : `<div class="snode ${cls}">${body}</div>`;
  return `<li>${node}${kids}</li>`;
}
function renderMap(){
  const M=MAP; if(!M) return;
  MAPDOC=null;
  // Hide the editing chrome — a map is a read-only overview, not an editor.
  ["undoBtn","redoBtn","histBtn","saveBtn","loadBtn","sotBtn","resetBtn"].forEach(id=>{ const el=document.getElementById(id); if(el) el.style.display="none"; });
  document.querySelectorAll(".topbar .tabs").forEach(el=>el.style.display="none");
  const band=document.getElementById("initBand"); if(band) band.hidden=true;
  // A map is read-only — the title must not be editable (no history/SOT writes).
  const pt=document.getElementById("prodTitle"); if(pt){ pt.setAttribute("contenteditable","false"); if(pt.firstChild) pt.firstChild.textContent=M.productId||"Product"; }
  const legend = (M.scopes||[]).map(s=>{
    const meta = s.status==="main" ? t("본편","Main") : `${mapStatusLabel(s.status)}${(M.stale||[]).includes(s.id)?` · ${t("기준 낡음","stale")}`:""}`;
    const name = s.href
      ? `<a class="map-scope-link" href="${esc(s.href)}">${esc(s.title||s.id)}</a>`
      : s.sot
        ? `<span class="map-scope-link" role="button" tabindex="0" data-open="${esc(s.id)}">${esc(s.title||s.id)}</span>`
        : `<b>${esc(s.title||s.id)}</b>`;
    return `<span class="map-scope"><span class="ib-dot ${s.status==="main"?"main":s.status}"></span>${name} <span class="map-scope-id">${esc(s.id)} · ${meta}</span></span>`;
  }).join("");
  const excluded = (M.excluded&&M.excluded.length) ? `<div class="map-excluded">${t("제외","Excluded")}: ${M.excluded.map(e=>`${esc(e.id)} (${esc(e.reason)})`).join(", ")}</div>` : "";
  // A composite tree can be far wider than the viewport, so name where each
  // initiative attaches (in human titles) and give a jump button.
  const titleOf = cid => { let hit=null; const walk=pgs=>(pgs||[]).forEach(p=>{ if(p.compositeId===cid) hit=p.title; walk(p.children); }); (M.ia||[]).forEach(s=>walk(s.pages)); return hit||cid; };
  const scopeTitle = id => { const s=(M.scopes||[]).find(x=>x.id===id); return (s&&s.title)||id; };
  const attach = (M.attachments&&M.attachments.length)
    ? `<div class="map-attach">${t("접점","Attaches at")}: ${M.attachments.map(a=>`<button class="map-jump" data-jump="${esc(a.initiative)}"><b>${esc(scopeTitle(a.initiative))}</b> → ${esc(titleOf(a.at))}</button>`).join(" ")}</div>`
    : "";
  const tree = `<div class="sitemap"><ul>${(M.ia||[]).map(sec=>`<li>
      <div class="snode sec${sec.scope&&sec.scope!=="root"?" map-init":""}"><span class="stype">${t("섹션","Section")}</span><span class="stitle">${esc(sec.title)}${sec.scope&&sec.scope!=="root"?` <span class="map-scopetag">+${esc(sec.scope)}</span>`:""}</span></div>
      ${sec.pages.length?`<ul>${sec.pages.map(renderMapNode).join("")}</ul>`:""}
    </li>`).join("")}</ul></div>`;
  const el=document.getElementById("stage");
  el.className="wrap ia";
  el.innerHTML = `<div class="ia-canvas">
    <div class="map-head">${t("제품 지도 (읽기 전용)","Product map (read-only)")} · ${t("본편 + 활성 이니셔티브","main + active initiatives")} ${M.active?M.active.length:0}${(M.stale&&M.stale.length)?` · ${t("기준 낡음","stale")} ${M.stale.length}`:""}</div>
    <div class="map-legend">${legend}</div>
    ${excluded}
    ${attach}
    <div class="map-hint">${t("복합 id(scope/로컬id)로 출처를 표시합니다. +표시 노드는 이니셔티브가 본편 화면 아래에 더한 화면입니다.","Composite ids (scope/local-id) show provenance. +marked nodes are screens an initiative adds under a main screen.")}</div>
    ${tree}
  </div>`;
  // The map exists to show what initiatives add — it must not open scrolled away
  // from them (a wide composite pushes the increment off-screen).
  el.querySelectorAll("[data-jump]").forEach(b=>b.addEventListener("click",()=>mapJumpTo(b.dataset.jump)));
  el.querySelectorAll("[data-open]").forEach(n=>{
    n.addEventListener("click",()=>openMapDoc(n.dataset.open));
    n.addEventListener("keydown",e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); openMapDoc(n.dataset.open); } });
  });
  const first=el.querySelector(".snode.map-init");
  if(first&&first.scrollIntoView) try{ first.scrollIntoView({block:"center",inline:"center"}); }catch(e){}
}
/* ---- opening a source document from the map (read-only) ---- */
function openMapDoc(scopeId){
  const s=mapScope(scopeId); if(!s||!s.sot) return;
  MAPDOC=scopeId;
  SOT=normalize(JSON.parse(JSON.stringify(s.sot)));
  VIEW="prd";
  document.querySelectorAll(".topbar .tabs").forEach(el=>el.style.display="");
  const pt=document.getElementById("prodTitle"); if(pt&&pt.firstChild) pt.firstChild.textContent=SOT.title||scopeId;
  render();
  window.scrollTo(0,0);
}
// Deny-by-default read-only pass. Runs after every render in RO mode (and on any
// later DOM change, e.g. the detail panel), so an editing control that nobody
// remembered to disable is disabled anyway.
function roHarden(){
  const back=document.getElementById("stage");
  if(!back) return;
  if(MAPDOC && !back.querySelector(".map-back")){
    const s=mapScope(MAPDOC)||{};
    const bar=document.createElement("div");
    bar.className="map-back";
    bar.innerHTML=`<button class="topbtn" data-ro-ok data-back-to-map>← ${t("제품 지도","Product map")}</button>
      <span>${esc(s.title||MAPDOC)} · ${t("읽기 전용 스냅샷 — 편집은 원본 파일에서","read-only snapshot — edit the source file")}</span>`;
    back.insertBefore(bar, back.firstChild);
    bar.querySelector("[data-back-to-map]").addEventListener("click",renderMap);
  }
  document.querySelectorAll('#stage [contenteditable="true"], #stage [contenteditable=""]')
    .forEach(e=>e.setAttribute("contenteditable","false"));
  document.querySelectorAll("#stage button, #stage input, #stage select, #stage textarea")
    .forEach(e=>{ if(!e.matches(RO_ALLOW) && !e.closest("[data-ro-ok]")) e.disabled=true; });
}
// The stage is re-rendered by many paths (detail panel, flow editor), so watch it
// rather than trusting every call site to re-harden.
function roWatch(){
  const stage=document.getElementById("stage");
  if(!stage || !window.MutationObserver) return;
  new MutationObserver(()=>{ if(RO) roHarden(); }).observe(stage,{childList:true,subtree:true});
}
// Language toggle and other re-renders must keep you where you are.
function rerender(){ if(MAP && !MAPDOC) renderMap(); else render(); }
function mapJumpTo(scopeId){
  const nodes=[...document.querySelectorAll(".snode.map-init")];
  const target=nodes.find(n=>((n.querySelector(".map-scopetag")||{}).textContent||"")===`+${scopeId}`)||nodes[0];
  if(!target) return;
  try{ target.scrollIntoView({block:"center",inline:"center",behavior:"smooth"}); }catch(e){ target.scrollIntoView(); }
  target.classList.add("map-flash");
  setTimeout(()=>target.classList.remove("map-flash"),1400);
}
