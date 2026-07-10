function renderSpec(){
  if(!find(selReq)) selReq = SOT.requirements[0] ? SOT.requirements[0].id : null;
  const req = find(selReq);
  if(req && !req.features.find(f=>f.id===selFeat)) selFeat = req.features[0] ? req.features[0].id : null;
  if(!nodeInfo(selNode)) selNode = selReq;
  const feat = selFeat ? findF(selFeat).f : null;

  // 1) 요구사항
  let colReqHtml;
  if(colReqCol){ colReqHtml = `<div class="dir-col collapsed" data-expand="req" title="${t('펼치기','Expand')}"><div class="cc-label">${t('요구사항','Requirements')} ▸</div></div>`; }
  else{
    const items = SOT.requirements.map(r=>`<div class="dir-item ${r.id===selReq?'sel':''}" data-selreq="${r.id}">
      <span class="di-title">${esc(r.title)}</span><span class="di-meta">${r.features.length}</span></div>`).join("") || `<div class="empty">${t('없음','None')}</div>`;
    colReqHtml = `<div class="dir-col cReq">
      <div class="dir-head">${t('요구사항','Requirements')} <span class="hd-btns"><button class="mini" data-collapse="req" title="${t('접기','Collapse')}">‹</button><button class="addbtn sm" data-add-req>＋</button></span></div>
      <div class="dir-body">${items}</div></div>`;
  }
  // 2) 기능
  let colFeatHtml;
  if(colFeatCol){ colFeatHtml = `<div class="dir-col collapsed" data-expand="feat" title="${t('펼치기','Expand')}"><div class="cc-label">${t('기능','Features')} ▸</div></div>`; }
  else{
    const items = req ? (req.features.map(f=>{
      const s=STAT[f.status];
      return `<div class="dir-item ${f.id===selFeat?'sel':''}" data-selfeat="${f.id}">
        <span class="status-dot ${s.c}"></span><span class="di-title">${esc(f.title)}</span>
        <span class="di-meta">${f.starred?'★ ':''}${f.specs.length}</span></div>`;
    }).join("") || `<div class="empty">${t('기능 없음','No features')}</div>`) : `<div class="empty">${t('요구사항 선택','Select a requirement')}</div>`;
    colFeatHtml = `<div class="dir-col cFeat">
      <div class="dir-head">${t('기능','Features')} <span class="hd-btns"><button class="mini" data-collapse="feat" title="${t('접기','Collapse')}">‹</button><button class="addbtn sm" data-add-feat="${selReq}">＋</button></span></div>
      <div class="dir-body">${items}</div></div>`;
  }
  // 3) 상세 기능
  const specItems = feat ? (feat.specs.map((sp,si)=>{
    const sid = selFeat+":"+si;
    return `<div class="dir-item ${sid===selNode?'sel':''}" data-selnode="${sid}">
      <span class="ds-idx">${si+1}</span><span class="di-title">${esc(specTitle(sp))}</span></div>`;
  }).join("") || `<div class="empty">${t('상세기능 없음','No sub-features')}</div>`) : `<div class="empty">${t('기능 선택','Select a feature')}</div>`;
  const colSpecHtml = `<div class="dir-col cSpec">
    <div class="dir-head">${t('상세 기능','Sub-features')} ${feat?`<button class="addbtn sm" data-add-spec="${selFeat}">＋</button>`:''}</div>
    <div class="dir-body">${specItems}</div></div>`;

  // 4) 상세 패널
  const colDetailHtml = `<div class="dir-col cDetail">${renderDetail()}</div>`;

  return `<div class="dir">${colReqHtml}${colFeatHtml}${colSpecHtml}${colDetailHtml}</div>`;
}
