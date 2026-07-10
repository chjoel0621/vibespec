function flowCoverage(){
  const pages=allPages(); const known=new Set(pages.map(p=>p.id));
  const trans=(SOT.flow&&SOT.flow.transitions)||[];
  const used=new Set(); trans.forEach(t=>{used.add(t.from);used.add(t.to);}); if(SOT.flow&&SOT.flow.start) used.add(SOT.flow.start);
  const orphans=pages.filter(p=>!used.has(p.id));
  const dangling=trans.filter(t=>!known.has(t.from)||!known.has(t.to));
  let banner;
  if(orphans.length||dangling.length){
    const chips=orphans.slice(0,12).map(o=>`<span class="warn-chip">${esc(o.label.split("›").pop().trim())}</span>`).join("");
    banner=`<div class="flow-warn">⚠ ${t('흐름에 연결 안 된 화면','Screens not connected in the flow')} <b>${orphans.length}</b>${t('개','')}${dangling.length?` · ${t('없는 화면 참조','dangling refs')} <b>${dangling.length}</b>${t('개','')}`:''}<span class="iw-btns">${orphans.length?`<button class="addbtn sm" data-fcov="orphans">${t('시작에 연결','Connect to start')}</button>`:''}${dangling.length?`<button class="addbtn sm ghost" data-fcov="clean">${t('참조 정리','Clean refs')}</button>`:''}</span> ${chips}</div>`;
  } else banner=`<div class="flow-warn ok">✓ ${t('모든 화면이 흐름에 연결되어 있습니다.','All screens are connected in the flow.')}</div>`;
  return {orphans,dangling,banner};
}
function triggerSelect(tr,i){
  const cat=specCatalog();
  const isCustom=(!tr.ref&&tr.label);
  const opts=cat.map(c=>`<option value="${c.id}" ${tr.ref===c.id?'selected':''}>${esc(c.label)}</option>`).join("");
  return `<select data-tref="${i}"><option value="" ${(!tr.ref&&!tr.label)?'selected':''}>${t('— 자동/없음 —','— Auto/None —')}</option>${opts}<option value="__custom" ${isCustom?'selected':''}>${t('직접 입력…','Custom…')}</option></select>${isCustom?`<input data-tlabel="${i}" value="${esc(tr.label)}" placeholder="${t('라벨 직접 입력','Enter label')}" style="margin-top:5px">`:''}`;
}
function renderFlowEditPanel(){
  const pages=allPages();
  const opts=pages.map(p=>`<option value="${p.id}">${esc(p.label)}</option>`).join("");
  const startOpts=pages.map(p=>`<option value="${p.id}" ${(SOT.flow&&SOT.flow.start)===p.id?'selected':''}>${esc(p.label)}</option>`).join("");
  const cat=specCatalog();
  const trans=(SOT.flow&&SOT.flow.transitions)||[];
  const rows=trans.map((tr,i)=>`<div class="tr-row"><div class="tr-head"><span class="tr-fromto">${esc(flowMeta(tr.from).title)} → ${esc(flowMeta(tr.to).title)}</span><button class="mini" data-tdel="${i}" title="${t('삭제','Delete')}">×</button></div>${triggerSelect(tr,i)}</div>`).join("") || `<div class="fep-empty">${t('전환이 없습니다.','No transitions.')}</div>`;
  return `<div class="flow-editpanel"><div class="fep-sec">${t('시작 화면','Start screen')}</div><select data-flowstart>${startOpts}</select><div class="fep-sec">${t('전환 추가','Add transition')}</div><div class="fep-add"><select data-addfrom><option value="">${t('출발 화면…','From screen…')}</option>${opts}</select><select data-addto><option value="">${t('도착 화면…','To screen…')}</option>${opts}</select><select data-addref><option value="">${t('트리거 기능 (선택)','Trigger feature (optional)')}</option>${cat.map(c=>`<option value="${c.id}">${esc(c.label)}</option>`).join("")}<option value="__custom">${t('직접 입력…','Custom…')}</option></select><input data-addlabel placeholder="${t('직접 입력 라벨(트리거 미선택 시)','Custom label (if no trigger)')}"><button class="addbtn" data-addtrans>${t('＋ 전환 추가','＋ Add transition')}</button></div><div class="fep-sec">${t('전환 목록','Transitions')} (${trans.length}) · ${t('트리거=기능이면 라벨 자동','feature trigger = auto label')}</div><div class="fep-list">${rows}</div></div>`;
}
