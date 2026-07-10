function childIds(node){ if(node.kind==="req"){ const ids=[]; node.obj.features.forEach(f=>{ ids.push(f.id); f.specs.forEach((sp,i)=>ids.push(f.id+":"+i)); }); return ids; } if(node.kind==="feat"){ const ids=[node.id]; node.obj.specs.forEach((sp,i)=>ids.push(node.id+":"+i)); return ids; } return [node.id]; }
function traceFor(node){ const ids=new Set(childIds(node)); const pgMap={}; ids.forEach(id=>pagesRefTo(id).forEach(p=>pgMap[p.id]=p)); const trans=((SOT.flow&&SOT.flow.transitions)||[]).filter(t=>t.ref&&ids.has(t.ref)); const kpis=((SOT.prd&&SOT.prd.kpis)||[]).filter(k=>(k.refs||[]).some(r=>ids.has(r))); return {pages:Object.values(pgMap),trans,kpis}; }
function renderTrace(node,includeIA){
  const tc=traceFor(node); let rows="";
  if(includeIA){ const pg=tc.pages.map(p=>`<button class="trace-chip" data-goia="${p.id}">${esc(p.title)}</button>`).join("")||`<span class="empty-inline">${t('없음','None')}</span>`; rows+=`<div class="trace-row"><span class="trace-k">${t('화면(IA)','Screens (IA)')}</span><span class="trace-v">${pg}</span></div>`; }
  const fl=tc.trans.map(tr=>`<button class="trace-chip" data-goflow="${tr.from}">${esc(flowMeta(tr.from).title)} → ${esc(flowMeta(tr.to).title)}</button>`).join("")||`<span class="empty-inline">${t('없음','None')}</span>`;
  const kp=tc.kpis.map(k=>`<button class="trace-chip kpi" data-gokpi="1">${esc(k.name)}</button>`).join("")||`<span class="empty-inline">${t('없음','None')}</span>`;
  rows+=`<div class="trace-row"><span class="trace-k">${t('플로우','Flow')}</span><span class="trace-v">${fl}</span></div>`;
  rows+=`<div class="trace-row"><span class="trace-k">KPI</span><span class="trace-v">${kp}</span></div>`;
  return `<div class="dt-sec">${t('연결 (추적성)','Connections (traceability)')}</div>${rows}`;
}
function renderProgress(node){
  const ac=node.obj.acceptance||[]; const acDone=ac.filter(a=>a.done).length; let bar="";
  if(node.kind==="req"){ const fs=node.obj.features; const c={todo:0,doing:0,done:0}; fs.forEach(f=>{ c[f.status]=(c[f.status]||0)+1; }); const tot=fs.length||1; const seg=k=>c[k]?`<span class="pb ${k}" style="width:${(c[k]/tot*100).toFixed(1)}%"></span>`:''; bar=`<div class="prog-bar">${seg('done')}${seg('doing')}${seg('todo')}</div><div class="prog-legend">${t('완료','Done')} ${c.done} · ${t('진행','In progress')} ${c.doing} · ${t('할일','To do')} ${c.todo} <span class="pl-dim">(${t('기능','features')} ${fs.length})</span></div>`; }
  else if(node.kind==="feat"){ bar=`<div class="prog-legend">${t('상세기능','Sub-features')} ${node.obj.specs.length}${t('개','')}</div>`; }
  const acLine=ac.length?`<div class="prog-legend">${t('수용 기준','Acceptance')} ${acDone}/${ac.length} ${t('완료','done')}</div>`:'';
  if(!bar && !acLine) return "";
  return `<div class="dt-sec">${t('진행 요약','Progress summary')}</div>${bar}${acLine}`;
}
function renderDetail(){
  const n = nodeInfo(selNode);
  if(!n) return `<div class="detail"><p class="empty">${t('왼쪽에서 항목을 선택하세요.','Select an item on the left.')}</p></div>`;
  if(n.kind==="spec"){
    const s=n.obj;
    const sac = (s.acceptance||[]).map((a,i)=>`<div class="ac-item ${a.done?'done':''}">
        <input type="checkbox" data-ac-done="${n.ref}#${i}" ${a.done?'checked':''}>
        <span class="ac-text" contenteditable data-ac-text="${n.ref}#${i}">${esc(a.text)}</span>
        <button class="ac-del" data-ac-del="${n.ref}#${i}" title="${t('삭제','Delete')}">×</button></div>`).join("")
        || `<div class="empty">${t('수용 기준이 없습니다. ＋로 추가하세요.','No acceptance criteria. Add with ＋.')}</div>`;
    return `<div class="detail">
      <div class="dt-title field" contenteditable data-spec="${n.ref}">${esc(s.title)}</div>
      <div class="dt-goto"><button class="topbtn" data-gototree>${t('↗ 트리 뷰로 이동','↗ Go to tree view')}</button>
        <button class="topbtn" data-del-spec="${n.ref}" style="margin-left:6px">${t('상세기능 삭제','Delete sub-feature')}</button></div>
      <div class="dt-row"><span class="dt-k">ID</span><span class="dt-v">${n.ref}</span></div>
      <div class="dt-row"><span class="dt-k">${t('유형','Type')}</span><span class="dt-v">${t('상세 기능 (Specification)','Sub-feature (Specification)')}</span></div>
      <div class="dt-sec">${t('설명','Description')}</div>
      <div class="dt-desc field" contenteditable data-spec-desc="${n.ref}">${esc(s.desc||'')}</div>
      <div class="dt-sec">${t('수용 기준','Acceptance criteria')} <button class="addbtn sm" data-add-ac="${n.ref}">＋</button></div>
      <div class="ac-list">${sac}</div>
      ${renderProgress(n)}
      ${renderTrace(n,true)}
    </div>`;
  }
  const o=n.obj, id=n.id;
  const titleAttr = n.kind==="req"?`data-req-title="${id}"`:`data-feat-title="${id}"`;
  const descAttr  = n.kind==="req"?`data-req-desc="${id}"`:`data-feat-desc="${id}"`;
  const typeLabel = n.kind==="req"?t("요구사항 (Requirement)","Requirement"):t("기능 (Feature)","Feature");
  const statusOpt = Object.keys(STAT).map(k=>`<option value="${k}" ${o.status===k?'selected':''}>${t(STAT[k].t,STAT[k].e)}</option>`).join("");
  const prioOpt   = Object.keys(PRIO).map(k=>`<option value="${k}" ${o.priority===k?'selected':''}>${t(PRIO[k].t,PRIO[k].e)}</option>`).join("");
  const ac = (o.acceptance||[]).map((a,i)=>`<div class="ac-item ${a.done?'done':''}">
      <input type="checkbox" data-ac-done="${id}#${i}" ${a.done?'checked':''}>
      <span class="ac-text" contenteditable data-ac-text="${id}#${i}">${esc(a.text)}</span>
      <button class="ac-del" data-ac-del="${id}#${i}" title="${t('삭제','Delete')}">×</button></div>`).join("")
      || `<div class="empty">${t('수용 기준이 없습니다. ＋로 추가하세요.','No acceptance criteria. Add with ＋.')}</div>`;
  let screenBlock="";
  if(n.kind==="feat"){
    const linked=pagesRefTo(id);
    const rows=linked.map(pg=>`<div class="ia-link"><span class="ill">${esc(pageLabel(pg.id))}</span><button class="ac-del" data-map-unlink="${pg.id}~${id}" style="opacity:1">×</button></div>`).join("") || `<div class="empty">${t('연결된 화면이 없습니다.','No linked screens.')}</div>`;
    const opts=allPages().filter(pg=>!linked.some(x=>x.id===pg.id)).map(pg=>`<option value="${pg.id}">${esc(pg.label)}</option>`).join("");
    const secOpts=SOT.ia.sections.map(s=>`<option value="${s.id}">${esc(s.title)} ${t('하위','›')}</option>`).join("");
    screenBlock=`<div class="dt-sec">${t('연결된 화면 (IA)','Linked screens (IA)')}</div>
      <div class="ac-list">${rows}</div>
      <div class="ia-linkadd"><select data-map-existing="${id}"><option value="">${t('기존 화면에 연결…','Link to existing screen…')}</option>${opts}</select></div>
      <div class="ia-linkadd"><select data-map-newin="${id}"><option value="">${t('＋ 새 화면 만들기 (섹션 선택)…','＋ Create new screen (pick section)…')}</option>${secOpts}<option value="__new">${t('＋ 새 섹션 만들어 추가','＋ Create new section')}</option></select></div>`;
  }
  return `<div class="detail">
    <div class="dt-title field" contenteditable ${titleAttr}>${esc(o.title)}</div>
    <div class="dt-goto"><button class="topbtn" data-gototree>${t('↗ 트리 뷰로 이동','↗ Go to tree view')}</button></div>
    <div class="dt-row"><span class="dt-k">ID</span><span class="dt-v">${id}</span></div>
    <div class="dt-row"><span class="dt-k">${t('유형','Type')}</span><span class="dt-v">${typeLabel}</span></div>
    <div class="dt-row"><span class="dt-k">${t('상태','Status')}</span><select data-status="${id}">${statusOpt}</select></div>
    <div class="dt-row"><span class="dt-k">${t('중요도','Priority')}</span><select data-priority="${id}">${prioOpt}</select></div>
    <div class="dt-sec">${t('설명','Description')}</div>
    <div class="dt-desc field" contenteditable ${descAttr}>${esc(o.desc||'')}</div>
    <div class="dt-sec">${t('수용 기준','Acceptance criteria')} <button class="addbtn sm" data-add-ac="${id}">＋</button></div>
    <div class="ac-list">${ac}</div>
    ${screenBlock}
    ${renderProgress(n)}
    ${renderTrace(n, n.kind!=='feat')}
  </div>`;
}
