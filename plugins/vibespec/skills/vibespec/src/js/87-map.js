/* ---- read-only product map (v2): renders a composed main + active initiatives
   payload (kind: "vibespec-product-map"). Dormant for normal SOT documents. ---- */
let MAP = null;
function mapStatusLabel(s){ const m=INIT_STATUS[s]; return m?t(m.t,m.e):s; }
// A scope may carry an href to its own document; when it does, the map lets you
// open it (otherwise the map is a dead end — you can see the increment but not
// reach the document that defines it).
function mapScopeHref(id){ const s=((MAP&&MAP.scopes)||[]).find(x=>x.id===id); return s&&s.href ? s.href : null; }
function renderMapNode(p){
  const kids = (p.children&&p.children.length)?`<ul>${p.children.map(renderMapNode).join("")}</ul>`:"";
  const cls = p.scope==="root" ? (p.type==="top"?"top":(p.type==="action"?"action":"page")) : "map-init";
  const tag = p.scope!=="root" ? ` <span class="map-scopetag">+${esc(p.scope)}</span>` : "";
  const href = mapScopeHref(p.scope);
  const body = `<span class="stype">${esc(p.compositeId)}</span>
      <span class="stitle">${esc(p.title)}${tag}</span>`;
  const node = href
    ? `<a class="snode ${cls} map-linked" href="${esc(href)}" title="${t("이 문서 열기","Open this document")}">${body}</a>`
    : `<div class="snode ${cls}">${body}</div>`;
  return `<li>${node}${kids}</li>`;
}
function renderMap(){
  const M=MAP; if(!M) return;
  // Hide the editing chrome — a map is a read-only overview, not an editor.
  ["undoBtn","redoBtn","histBtn","saveBtn","loadBtn","sotBtn","resetBtn"].forEach(id=>{ const el=document.getElementById(id); if(el) el.style.display="none"; });
  document.querySelectorAll(".topbar .tabs").forEach(el=>el.style.display="none");
  const band=document.getElementById("initBand"); if(band) band.hidden=true;
  // A map is read-only — the title must not be editable (no history/SOT writes).
  const pt=document.getElementById("prodTitle"); if(pt){ pt.setAttribute("contenteditable","false"); if(pt.firstChild) pt.firstChild.textContent=M.productId||"Product"; }
  const legend = (M.scopes||[]).map(s=>{
    const meta = s.status==="main" ? t("본편","Main") : `${mapStatusLabel(s.status)}${(M.stale||[]).includes(s.id)?` · ${t("기준 낡음","stale")}`:""}`;
    const name = s.href ? `<a class="map-scope-link" href="${esc(s.href)}">${esc(s.title||s.id)}</a>` : `<b>${esc(s.title||s.id)}</b>`;
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
      <div class="snode sec"><span class="stype">${t("섹션","Section")}</span><span class="stitle">${esc(sec.title)}</span></div>
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
  const first=el.querySelector(".snode.map-init");
  if(first&&first.scrollIntoView) try{ first.scrollIntoView({block:"center",inline:"center"}); }catch(e){}
}
function mapJumpTo(scopeId){
  const nodes=[...document.querySelectorAll(".snode.map-init")];
  const target=nodes.find(n=>((n.querySelector(".map-scopetag")||{}).textContent||"")===`+${scopeId}`)||nodes[0];
  if(!target) return;
  try{ target.scrollIntoView({block:"center",inline:"center",behavior:"smooth"}); }catch(e){ target.scrollIntoView(); }
  target.classList.add("map-flash");
  setTimeout(()=>target.classList.remove("map-flash"),1400);
}
