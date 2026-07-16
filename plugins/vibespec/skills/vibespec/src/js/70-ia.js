/* ------------------------------ IA (정보구조) ------------------------------ */
function iaFillMissing(){
  SOT.requirements.forEach(r=>{
    r.features.forEach(f=>{
      let fpage=findPageByRef(f.id);
      if(!fpage){
        let sec=SOT.ia.sections.find(s=>s.title===r.title);
        if(!sec){ sec={id:nid("S"),title:r.title,pages:[]}; SOT.ia.sections.push(sec); }
        fpage={id:nid("P"),title:f.title,type: sec.pages.length?"page":"top",refs:[f.id],children:[]};
        sec.pages.push(fpage);
      }
      f.specs.forEach((sp,si)=>{ const sid=f.id+":"+si; if(!findPageByRef(sid)) fpage.children.push({id:nid("P"),title:specTitle(sp),type:"action",refs:[sid],children:[]}); });
    });
  });
}
function buildIAFromSpec(){
  SOT.ia.sections = SOT.requirements.map(r=>({
    id:nid("S"), title:r.title,
    pages: r.features.map((f,fi)=>({
      id:nid("P"), title:f.title, type: fi===0?"top":"page", refs:[f.id],
      children: f.specs.map((sp,si)=>({ id:nid("P"), title:specTitle(sp), type:"action", refs:[f.id+":"+si], children:[] }))
    }))
  }));
}
function iaPageLi(p){
  const kids = (p.children&&p.children.length)?`<ul>${p.children.map(iaPageLi).join("")}</ul>`:"";
  const cls = p.type==="top"?"top":(p.type==="action"?"action":"page");
  const bnd = p.boundary ? " boundary" : "";
  // A boundary stub references a parent page — keep ＋add child (the initiative
  // hangs its own screens here), keep ×delete (re-attach is the user's call).
  return `<li><div class="snode ${cls}${bnd} ${p.id===selPage?'sel':''}" data-selpage="${p.id}">
      <span class="stype">${p.boundary?t('제품 기획 접점','Main boundary'):ptype(p.type)}</span>
      <span class="stitle">${esc(p.title)}</span>
      <span class="srowbtns"><button class="mini" data-add-page="${p.id}" title="${t('하위 추가','Add child')}">＋</button><button class="mini" data-del-page="${p.id}" title="${t('삭제','Delete')}">×</button></span>
    </div>${kids}</li>`;
}
function renderIA(){
  if(selSec && !SOT.ia.sections.find(s=>s.id===selSec)) selSec=null;
  if(selPage && !iaFindPage(selPage)) selPage=null;
  const secLis = SOT.ia.sections.map(s=>{
    const pages = s.pages.length?`<ul>${s.pages.map(iaPageLi).join("")}</ul>`:"";
    // A section boundary mirrors a main section (like a page stub mirrors a main
    // page): badge it 제품 기획 접점, keep ＋add page (the initiative adds screens to it).
    const bnd = s.boundary ? " boundary" : "";
    return `<li><div class="snode sec${bnd} ${s.id===selSec&&!selPage?'sel':''}" data-selsec="${s.id}">
        <span class="stype">${s.boundary?t('제품 기획 접점 · 섹션','Main boundary · section'):'Depth 1'}</span>
        <span class="stitle">${esc(s.title)}</span>
        <span class="srowbtns"><button class="mini" data-add-toppage="${s.id}" title="${t('페이지 추가','Add page')}">＋</button><button class="mini" data-del-sec="${s.id}" title="${t('섹션 삭제','Delete section')}">×</button></span>
      </div>${pages}</li>`;
  }).join("");
  const tree = `<div class="sitemap"><ul><li>
      <div class="snode root">
        <span class="stitle">${esc(SOT.title||"IA")}</span>
        <span class="stype">Information Architecture</span>
        <span class="srowbtns"><button class="mini" data-add-sec title="${t('섹션 추가','Add section')}">＋</button></span>
      </div>
      ${SOT.ia.sections.length?`<ul>${secLis}</ul>`:""}
    </li></ul></div>`;
  const cov=coverage();
  const warn = cov.unmapped.length
    ? `<div class="ia-warn">
        <div class="iw-head">⚠ ${t('아직 화면에 매핑되지 않은 기능·상세기능','Features/sub-features not yet mapped to a screen')} <b>${cov.unmapped.length}${t('개','')}</b>
          <span class="iw-btns"><button class="addbtn sm" data-ia-fillmissing>${t('누락 자동 채우기','Auto-fill missing')}</button><button class="addbtn sm ghost" data-ia-rebuild>${t('기능명세서로 재생성','Rebuild from spec')}</button></span>
        </div>
        <div class="iw-list">${cov.unmapped.slice(0,14).map(c=>`<span class="warn-chip">${esc(c.label)}</span>`).join("")}${cov.unmapped.length>14?`<span class="warn-chip more">＋${cov.unmapped.length-14}</span>`:""}</div>
      </div>`
    : `<div class="ia-ok">✓ ${t('기능명세서의 모든 기능·상세기능이 화면에 매핑되어 있습니다.','Every feature/sub-feature is mapped to a screen.')}</div>`;
  return `<div class="ia2">
    <div class="ia-canvas">
      ${warn}
      <div class="ia-hint">${t('위에서 아래로 내려가는 정보구조도입니다. 노드에 마우스를 올리면 ＋추가·×삭제, 노드를 클릭하면 오른쪽에서 편집할 수 있어요.','Top-down information architecture. Hover a node to ＋add/×delete; click a node to edit on the right.')}</div>
      ${tree}
    </div>
    <div class="ia-side">${renderIADetail()}</div>
  </div>`;
}
function renderIADetail(){
  if(!selPage){
    const sec=SOT.ia.sections.find(s=>s.id===selSec);
    if(!sec) return `<div class="detail"><p class="empty">${t('노드를 선택하세요.','Select a node.')}</p></div>`;
    // A section boundary is a reference to a main section — read-only title, shows
    // the target, and adds the initiative's screens beneath it (like a page stub).
    if(sec.boundary){
      return `<div class="detail">
        <div class="dt-title" style="color:var(--sub)">${esc(sec.title)} <span class="boundary-tag">${t('제품 기획 섹션','Main section')}</span></div>
        <div class="dt-row"><span class="dt-k">${t('제품 기획 접점 · 섹션','Main boundary · section')}</span><span class="dt-v">${esc(sec.boundary.scopeId)}/${esc(sec.boundary.sectionId)}</span></div>
        <div class="dt-row"><span class="dt-k">${t('페이지','Pages')}</span><span class="dt-v">${countPages(sec.pages)}${t('개','')}</span></div>
        <div class="ia-boundary-note">${t('제품 기획 섹션을 가리키는 참조입니다. 제목은 제품 기획이 정하므로 여기서 편집할 수 없습니다. 이 아래에 추가 기획이 이 섹션에 더하는 화면을 추가하세요.','A reference to a section in the main document. Its title is owned there and cannot be edited here. Add the screens this initiative contributes to that section beneath it.')}</div>
        <div class="dt-goto"><button class="topbtn" data-add-toppage="${sec.id}">${t('＋ 최상위 페이지 추가','＋ Add top page')}</button>
          <button class="topbtn danger" data-del-sec="${sec.id}" style="margin-left:6px">${t('접점 삭제','Delete boundary')}</button></div>
      </div>`;
    }
    return `<div class="detail">
      <div class="dt-title field" contenteditable data-sec-title="${sec.id}">${esc(sec.title)}</div>
      <div class="dt-row"><span class="dt-k">${t('유형','Type')}</span><span class="dt-v">${t('섹션 (Depth 1)','Section (Depth 1)')}</span></div>
      <div class="dt-row"><span class="dt-k">${t('페이지','Pages')}</span><span class="dt-v">${countPages(sec.pages)}${t('개','')}</span></div>
      <div class="dt-goto"><button class="topbtn" data-add-toppage="${sec.id}">${t('＋ 최상위 페이지 추가','＋ Add top page')}</button>
        <button class="topbtn danger" data-del-sec="${sec.id}" style="margin-left:6px">${t('섹션 삭제','Delete section')}</button></div>
    </div>`;
  }
  const r = iaFindPage(selPage);
  if(!r) return `<div class="detail"><p class="empty">${t('노드를 선택하세요.','Select a node.')}</p></div>`;
  const p=r.page;
  // Boundary stub: a reference to a parent page. Title/type/feature-refs are the
  // parent's to define (editing them here = drift), so they render read-only.
  // Adding child screens and deleting the stub stay allowed (the initiative's
  // own structure hangs off this attach point).
  if(p.boundary){
    // A stub referencing a parent page must not carry its own feature refs
    // (validate-sot warns). If it does, the linking UI is hidden — so surface a
    // notice with an explicit clear action rather than trapping the value.
    const strayRefs = (p.refs||[]).length
      ? `<div class="prd-idnotice">⚠ ${t('이 제품 기획 접점에 추가 기획 자체 기능 참조가 들어 있습니다','This boundary stub carries the initiative’s own feature refs')}: <b>${(p.refs||[]).map(rid=>esc(refLabel(rid))).join(", ")}</b>. ${t('접점은 제품 기획 화면의 참조라 자체 참조를 두지 않습니다.','A boundary is a reference to a main-document screen and should not hold its own refs.')} <button class="addbtn" data-clear-boundary-refs="${p.id}">${t('기능 참조 비우기','Clear feature refs')}</button></div>`
      : "";
    return `<div class="detail">
      <div class="dt-title" style="color:var(--sub)">${esc(p.title)} <span class="boundary-tag">${t('제품 기획','Main')}</span></div>
      <div class="dt-goto"><button class="topbtn" data-add-page="${p.id}">${t('＋ 하위 화면','＋ Child screen')}</button>
        <button class="topbtn danger" data-del-page="${p.id}" style="margin-left:6px">${t('접점 삭제','Delete boundary')}</button></div>
      <div class="dt-row"><span class="dt-k">ID</span><span class="dt-v">${p.id}</span></div>
      <div class="dt-row"><span class="dt-k">${t('유형','Type')}</span><span class="dt-v">${ptype(p.type)}</span></div>
      <div class="dt-row"><span class="dt-k">${t('제품 기획 접점','Main boundary')}</span><span class="dt-v">${esc(p.boundary.scopeId)}/${esc(p.boundary.pageId)}</span></div>
      ${strayRefs}
      <div class="ia-boundary-note">${t('제품 기획 화면을 가리키는 참조입니다. 제목·타입·기능 연결은 제품 기획이 정하므로 여기서 편집할 수 없습니다. 이 아래에 추가 기획의 하위 화면을 추가하세요.','A reference to a screen in the main document. Its title, type, and feature links are owned there and cannot be edited here. Add the child screens for this initiative beneath it.')}</div>
    </div>`;
  }
  const typeOpt = Object.keys(PTYPE).map(k=>`<option value="${k}" ${p.type===k?'selected':''}>${ptype(k)}</option>`).join("");
  const cat = specCatalog();
  const linked = (p.refs||[]).map((rid,i)=>`<div class="ia-link"><span class="ill">${esc(refLabel(rid))}</span><button class="ac-del" data-ia-unlink="${p.id}#${i}" style="opacity:1">×</button></div>`).join("") || `<div class="empty">${t('연결된 기능이 없습니다.','No linked features.')}</div>`;
  const opts = cat.filter(c=>!(p.refs||[]).includes(c.id)).map(c=>`<option value="${c.id}">${esc(c.label)}</option>`).join("");
  return `<div class="detail">
    <div class="dt-title field" contenteditable data-ia-title="${p.id}">${esc(p.title)}</div>
    <div class="dt-goto"><button class="topbtn" data-gotoflow>${t('↗ 유저플로우에서 보기','↗ View in user flow')}</button>
      <button class="topbtn" data-add-page="${p.id}" style="margin-left:6px">${t('＋ 하위 화면','＋ Child screen')}</button>
      <button class="topbtn danger" data-del-page="${p.id}" style="margin-left:6px">${t('화면 삭제','Delete screen')}</button></div>
    <div class="dt-row"><span class="dt-k">ID</span><span class="dt-v">${p.id}</span></div>
    <div class="dt-row"><span class="dt-k">${t('타입','Type')}</span><select data-ia-type="${p.id}">${typeOpt}</select></div>
    <div class="dt-sec">${t('연결된 기능','Linked features')} <span class="di-meta" style="font-weight:400">${t('· 기능명세서에서 연결','· link in Feature Spec')}</span></div>
    <div class="ac-list">${linked}</div>
    <div class="ia-linkadd"><select data-ia-link="${p.id}"><option value="">${t('＋ 기능 연결…','＋ Link feature…')}</option>${opts}</select></div>
  </div>`;
}
