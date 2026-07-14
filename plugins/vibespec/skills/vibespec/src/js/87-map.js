/* ---- read-only product map (v2): renders a composed main + active initiatives
   payload (kind: "vibespec-product-map"). Dormant for normal SOT documents. ---- */
let MAP = null;
function mapStatusLabel(s){ const m=INIT_STATUS[s]; return m?t(m.t,m.e):s; }
function renderMapNode(p){
  const kids = (p.children&&p.children.length)?`<ul>${p.children.map(renderMapNode).join("")}</ul>`:"";
  const cls = p.scope==="root" ? (p.type==="top"?"top":(p.type==="action"?"action":"page")) : "map-init";
  const tag = p.scope!=="root" ? ` <span class="map-scopetag">+${esc(p.scope)}</span>` : "";
  return `<li><div class="snode ${cls}">
      <span class="stype">${esc(p.compositeId)}</span>
      <span class="stitle">${esc(p.title)}${tag}</span>
    </div>${kids}</li>`;
}
function renderMap(){
  const M=MAP; if(!M) return;
  // Hide the editing chrome — a map is a read-only overview, not an editor.
  ["undoBtn","redoBtn","histBtn","saveBtn","loadBtn","sotBtn","resetBtn"].forEach(id=>{ const el=document.getElementById(id); if(el) el.style.display="none"; });
  document.querySelectorAll(".topbar .tabs").forEach(el=>el.style.display="none");
  const band=document.getElementById("initBand"); if(band) band.hidden=true;
  const pt=document.getElementById("prodTitle"); if(pt&&pt.firstChild) pt.firstChild.textContent=M.productId||"Product";
  const legend = (M.scopes||[]).map(s=>{
    const meta = s.status==="main" ? t("본편","Main") : `${mapStatusLabel(s.status)}${(M.stale||[]).includes(s.id)?` · ${t("기준 낡음","stale")}`:""}`;
    return `<span class="map-scope"><span class="ib-dot ${s.status==="main"?"main":s.status}"></span><b>${esc(s.title||s.id)}</b> <span class="map-scope-id">${esc(s.id)} · ${meta}</span></span>`;
  }).join("");
  const excluded = (M.excluded&&M.excluded.length) ? `<div class="map-excluded">${t("제외","Excluded")}: ${M.excluded.map(e=>`${esc(e.id)} (${esc(e.reason)})`).join(", ")}</div>` : "";
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
    <div class="map-hint">${t("복합 id(scope/로컬id)로 출처를 표시합니다. +표시 노드는 이니셔티브가 본편 화면 아래에 더한 화면입니다.","Composite ids (scope/local-id) show provenance. +marked nodes are screens an initiative adds under a main screen.")}</div>
    ${tree}
  </div>`;
}
