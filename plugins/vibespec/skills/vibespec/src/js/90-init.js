/* ============================ EVENT WIRING ============================ */
document.querySelectorAll(".tab").forEach(t=>t.addEventListener("click",()=>{VIEW=t.dataset.view;syncViewInUrl();render();}));
document.getElementById("resetBtn").addEventListener("click",()=>{ if(!HISTORY.length) return; restoreTo(0); const pt=document.getElementById("prodTitle"); if(pt&&pt.firstChild) pt.firstChild.textContent=SOT.title||"제품"; });
document.getElementById("sotBtn").addEventListener("click",()=>{
  const w=window.open("","_blank","width=520,height=640");
  w.document.write("<title>SOT (Single Source of Truth)</title><pre style='font:12px/1.5 ui-monospace,Menlo,monospace;padding:16px;white-space:pre-wrap'>"+esc(JSON.stringify(SOT,null,2))+"</pre>");
});
document.getElementById("prodTitle").addEventListener("input",e=>{ if(MAP) return; SOT.title=e.currentTarget.firstChild.textContent.trim(); });

/* delegated edits (contenteditable) */
document.getElementById("stage").addEventListener("input",e=>{
  const t=e.target; if(!t.dataset) return; const v=t.textContent;
  if("prod" in t.dataset) SOT.title=v;
  else if(t.dataset.prdField) SOT.prd[t.dataset.prdField]=v;
  else if(t.dataset.prdList){ const[k,i]=t.dataset.prdList.split("#"); SOT.prd[k][+i]=v; }
  else if(t.dataset.reqDesc) find(t.dataset.reqDesc).desc=v;
  else if(t.dataset.reqTitle) find(t.dataset.reqTitle).title=v;
  else if(t.dataset.featTitle) findF(t.dataset.featTitle).f.title=v;
  else if(t.dataset.featDesc) findF(t.dataset.featDesc).f.desc=v;
  else if(t.dataset.acText){ const[id,i]=t.dataset.acText.split("#"); ownerOf(id).acceptance[+i].text=v; }
  else if(t.dataset.iaTitle){ const r=iaFindPage(t.dataset.iaTitle); if(r) r.page.title=v; }
  else if(t.dataset.secTitle){ const s=SOT.ia.sections.find(x=>x.id===t.dataset.secTitle); if(s) s.title=v; }
  else if(t.dataset.spec){ const[fid,si]=t.dataset.spec.split(":"); findF(fid).f.specs[+si].title=v; }
  else if(t.dataset.specDesc){ const[fid,si]=t.dataset.specDesc.split(":"); findF(fid).f.specs[+si].desc=v; }
  else if(t.dataset.persona){ const[i,f]=t.dataset.persona.split("#"); SOT.prd.targets[+i][f]=v; }
  else if(t.dataset.scnText!==undefined){ SOT.prd.scenarios[+t.dataset.scnText].text=v; }
  else if(t.dataset.kpi){ const[i,f]=t.dataset.kpi.split("#"); SOT.prd.kpis[+i][f]=v; }
  if(VIEW==="tree") layoutTree();
  else if(VIEW==="flow") layoutFlow();
});
/* clicks: selection (rows) + add/delete (buttons) */
document.getElementById("stage").addEventListener("click",e=>{
  const b=e.target.closest("button");
  if(!b){ // row selection / column expand in the directory view
    const ex=e.target.closest("[data-expand]");
    if(ex){ if(ex.dataset.expand==="req") colReqCol=false; else colFeatCol=false; render(); return; }
    const sr=e.target.closest("[data-selreq]");
    if(sr){ selReq=sr.dataset.selreq; const r=find(selReq); selFeat=r.features[0]?r.features[0].id:null; selNode=selReq; render(); return; }
    const sf=e.target.closest("[data-selfeat]");
    if(sf){ selFeat=sf.dataset.selfeat; selNode=selFeat; render(); return; }
    const sn=e.target.closest("[data-selnode]");
    if(sn){ selNode=sn.dataset.selnode; render(); return; }
    const ss=e.target.closest("[data-selsec]");
    if(ss){ selSec=ss.dataset.selsec; selPage=null; render(); return; }
    const sp=e.target.closest("[data-selpage]");
    if(sp){ selPage=sp.dataset.selpage; render(); return; }
    const tn=e.target.closest("[data-node]");
    if(tn){ goToSpec(tn.dataset.node); return; }
    if(VIEW==="flow"){ if(!flowEdit){ const nd=e.target.closest("[data-fn]"); flowSel=(nd&&nd.dataset.fn===flowSel)?null:(nd?nd.dataset.fn:null); applyFlowFocus(); } return; }
    return;
  }
  const d=b.dataset;
  if("clearIdentity" in d){ ["category","northStar","differentiator","alternatives"].forEach(k=>SOT.prd[k]=""); SOT.prd.platforms=[]; commit(); }
  else if(d.prdAdd){ (SOT.prd[d.prdAdd]=SOT.prd[d.prdAdd]||[]).push("새 항목"); commit(); }
  else if(d.prdDel){ const[k,i]=d.prdDel.split("#"); SOT.prd[k].splice(+i,1); commit(); }
  else if("personaAdd" in d){ SOT.prd.targets.push({name:"새 페르소나",role:"",needs:"",pain:""}); commit(); }
  else if(d.personaDel!==undefined){ SOT.prd.targets.splice(+d.personaDel,1); commit(); }
  else if("scnAdd" in d){ SOT.prd.scenarios.push({text:"새 시나리오",start:""}); commit(); }
  else if(d.scnDel!==undefined){ SOT.prd.scenarios.splice(+d.scnDel,1); commit(); }
  else if(d.scnGo){ VIEW="flow"; flowSel=d.scnGo; render(); }
  else if("kpiAdd" in d){ SOT.prd.kpis.push({name:"새 KPI",target:"",baseline:"",method:"",refs:[]}); commit(); }
  else if(d.kpiDel!==undefined){ SOT.prd.kpis.splice(+d.kpiDel,1); commit(); }
  else if(d.kpiRefdel!==undefined){ const[i,j]=d.kpiRefdel.split("#"); SOT.prd.kpis[+i].refs.splice(+j,1); commit(); }
  else if("addReq" in d){ SOT.requirements.push({id:nid("R"),title:"새 요구사항",desc:"설명을 입력하세요.",status:"todo",priority:"mid",acceptance:[],features:[]}); commit(); }
  else if(d.collapse){ if(d.collapse==="req") colReqCol=true; else colFeatCol=true; render(); }
  else if(d.addFeat){ const f={id:nid("F"),title:"새 기능",priority:"mid",status:"todo",desc:"",acceptance:[],specs:[{title:"새 상세기능",desc:"",acceptance:[]}]}; find(d.addFeat).features.push(f); selFeat=f.id; selNode=f.id; commit(); }
  else if(d.delFeat){ const r=findF(d.delFeat).r; r.features=r.features.filter(f=>f.id!==d.delFeat); commit(); }
  else if(d.addSpec){ const ff=findF(d.addSpec).f; ff.specs.push({title:"새 상세기능",desc:"",acceptance:[]}); selNode=d.addSpec+":"+(ff.specs.length-1); commit(); }
  else if(d.delSpec){ const[fid,si]=d.delSpec.split(":"); findF(fid).f.specs.splice(+si,1); if(selNode===d.delSpec) selNode=fid; commit(); }
  else if(d.addchild){ addChild(d.addchild); }
  else if(d.delnode){ delNode(d.delnode); }
  else if(d.star){ toggleStar(d.star); }
  else if("gototree" in d){ VIEW="tree"; render(); }
  else if("gotoflow" in d){ VIEW="flow"; render(); }
  else if(d.goia){ const r=iaFindPage(d.goia); if(r){ selSec=r.sec.id; selPage=d.goia; } VIEW="ia"; render(); }
  else if(d.goflow){ VIEW="flow"; flowSel=d.goflow; render(); }
  else if("gokpi" in d){ VIEW="prd"; render(); }
  else if(d.zoom){ if(d.zoom==="in") flowZ=Math.min(2.2,flowZ*1.15); else if(d.zoom==="out") flowZ=Math.max(0.2,flowZ/1.15); else { flowFit(); return; } applyFlowTransform(); }
  else if(d.ftool){ if(d.ftool==="labels"){ flowLabels=!flowLabels; document.getElementById("flowVP").classList.toggle("labels",flowLabels); b.classList.toggle("on",flowLabels); } else if(d.ftool==="edit"){ flowEdit=!flowEdit; render(); } else if(d.ftool==="clear"){ flowSel=null; applyFlowFocus(); } }
  else if("addtrans" in d){ const stg=document.getElementById("stage"); const from=stg.querySelector("[data-addfrom]").value, to=stg.querySelector("[data-addto]").value, refv=stg.querySelector("[data-addref]").value, custom=stg.querySelector("[data-addlabel]").value; if(from&&to){ SOT.flow.transitions=SOT.flow.transitions||[]; if(!SOT.flow.transitions.some(t=>t.from===from&&t.to===to)){ SOT.flow.transitions.push(flowTransition(from,to,refv&&refv!=="__custom"?refv:"",custom)); } commit(); } }
  else if(d.tdel!==undefined){ SOT.flow.transitions.splice(+d.tdel,1); commit(); }
  else if(d.fcov){ if(d.fcov==="orphans"){ const cov=flowCoverage(); const stt=(SOT.flow&&SOT.flow.start)||(SOT.ia.sections[0]&&SOT.ia.sections[0].pages[0]&&SOT.ia.sections[0].pages[0].id); SOT.flow.transitions=SOT.flow.transitions||[]; cov.orphans.forEach(o=>{ if(o.id!==stt) SOT.flow.transitions.push(flowTransition(stt,o.id)); }); } else if(d.fcov==="clean"){ const known=new Set(allPages().map(p=>p.id)); SOT.flow.transitions=(SOT.flow.transitions||[]).filter(t=>known.has(t.from)&&known.has(t.to)); } commit(); }
  else if(d.addAc){ ownerOf(d.addAc).acceptance.push({text:"새 수용 기준",done:false}); commit(); }
  else if(d.acDel){ const[id,i]=d.acDel.split("#"); ownerOf(id).acceptance.splice(+i,1); commit(); }
  else if("addSec" in d){ const s={id:nid("S"),title:"새 섹션",pages:[]}; SOT.ia.sections.push(s); selSec=s.id; selPage=null; commit(); }
  else if(d.delSec){ SOT.ia.sections=SOT.ia.sections.filter(s=>s.id!==d.delSec); if(selSec===d.delSec){selSec=null;selPage=null;} commit(); }
  else if(d.addToppage){ const s=SOT.ia.sections.find(x=>x.id===d.addToppage); const p={id:nid("P"),title:"새 페이지",type:"top",refs:[],children:[]}; s.pages.push(p); selPage=p.id; commit(); }
  else if(d.addPage){ const r=iaFindPage(d.addPage); const p={id:nid("P"),title:"새 페이지",type:"page",refs:[],children:[]}; r.page.children.push(p); selPage=p.id; commit(); }
  else if(d.delPage){ const r=iaFindPage(d.delPage); if(r){ const i=r.arr.indexOf(r.page); r.arr.splice(i,1); if(selPage===d.delPage) selPage=null; } commit(); }
  else if(d.clearBoundaryRefs){ const r=iaFindPage(d.clearBoundaryRefs); if(r) r.page.refs=[]; commit(); }
  else if(d.iaUnlink){ const[pid,i]=d.iaUnlink.split("#"); const r=iaFindPage(pid); if(r) r.page.refs.splice(+i,1); commit(); }
  else if(d.mapUnlink){ const[pid,fid]=d.mapUnlink.split("~"); const r=iaFindPage(pid); if(r) r.page.refs=r.page.refs.filter(x=>x!==fid); commit(); }
  else if("iaFillmissing" in d){ iaFillMissing(); commit(); }
  else if("iaRebuild" in d){ if(window.confirm(t("기능명세서 기준으로 IA를 다시 생성합니다. 지금 IA 구조는 대체됩니다. 계속할까요?","This rebuilds the IA from the Feature Spec and replaces the current IA. Continue?"))){ buildIAFromSpec(); selSec=SOT.ia.sections[0]?SOT.ia.sections[0].id:null; selPage=null; commit(); } }
});
/* change: status / priority selects + acceptance checkboxes */
document.getElementById("stage").addEventListener("change",e=>{
  const d=e.target.dataset;
  if(d.status){ ownerOf(d.status).status=e.target.value; commit(); }
  else if(d.priority){ ownerOf(d.priority).priority=e.target.value; commit(); }
  else if(d.acDone){ const[id,i]=d.acDone.split("#"); ownerOf(id).acceptance[+i].done=e.target.checked; commit(); }
  else if(d.iaType){ const r=iaFindPage(d.iaType); if(r) r.page.type=e.target.value; commit(); }
  else if(d.iaLink){ if(e.target.value){ const r=iaFindPage(d.iaLink); if(r) r.page.refs.push(e.target.value); commit(); } }
  else if(d.mapExisting){ if(e.target.value){ const r=iaFindPage(e.target.value); if(r) r.page.refs.push(d.mapExisting); commit(); } }
  else if(d.mapNewin){ if(e.target.value){ const fid=d.mapNewin; let sec; if(e.target.value==="__new"){ sec={id:nid("S"),title:"새 섹션",pages:[]}; SOT.ia.sections.push(sec); } else sec=SOT.ia.sections.find(s=>s.id===e.target.value); if(sec){ const c=specCatalog().find(x=>x.id===fid); const title=c?c.label.split("›").pop().trim():"새 화면"; sec.pages.push({id:nid("P"),title,type:"page",refs:[fid],children:[]}); commit(); } } }
  else if(d.scnStart!==undefined){ SOT.prd.scenarios[+d.scnStart].start=e.target.value; commit(); }
  else if(d.kpiRefadd!==undefined){ if(e.target.value){ SOT.prd.kpis[+d.kpiRefadd].refs.push(e.target.value); commit(); } }
  else if(d.flowstart!==undefined){ SOT.flow.start=e.target.value; commit(); }
  else if(d.tref!==undefined){ const t=SOT.flow.transitions[+d.tref]; const v=e.target.value; if(v==="__custom"){ t.ref=""; if(!t.label) t.label="새 라벨"; } else if(v){ t.ref=v; t.label=""; } else { t.ref=""; t.label=""; } commit(); }
  else if(d.tlabel!==undefined){ SOT.flow.transitions[+d.tlabel].label=e.target.value; commit(); }
});
/* history + save/load wiring */
function resetSelections(){ selReq=SOT.requirements[0]?SOT.requirements[0].id:null; selFeat=SOT.requirements[0]&&SOT.requirements[0].features[0]?SOT.requirements[0].features[0].id:null; selNode=selReq; selSec=SOT.ia.sections[0]?SOT.ia.sections[0].id:null; selPage=null; }
document.getElementById("stage").addEventListener("focusout",e=>{ if(e.target&&e.target.isContentEditable) snapshotIfChanged(t("텍스트 편집","Text edit")); });
document.getElementById("prodTitle").addEventListener("focusout",()=>snapshotIfChanged(t("제목 편집","Title edit")));
document.getElementById("undoBtn").addEventListener("click",undo);
document.getElementById("redoBtn").addEventListener("click",redo);
document.getElementById("histBtn").addEventListener("click",()=>{document.getElementById("histDrawer").classList.toggle("open");renderHistory();});
document.getElementById("histClose").addEventListener("click",()=>document.getElementById("histDrawer").classList.remove("open"));
document.getElementById("histList").addEventListener("click",e=>{const it=e.target.closest("[data-hist]"); if(it) restoreTo(+it.dataset.hist);});
document.getElementById("saveBtn").addEventListener("click",saveCurrentSot);
document.getElementById("reloadBtn").addEventListener("click",reloadConnectedSot);
document.getElementById("loadBtn").addEventListener("click",connectExistingSot);
document.getElementById("locationBtn").addEventListener("click",changeSaveLocation);
document.getElementById("fileInput").addEventListener("change",e=>{
  loadFallbackFile(e.target.files[0]); e.target.value="";
});
document.addEventListener("keydown",e=>{ const t=e.target; if(t&&(t.isContentEditable||t.tagName==="INPUT"||t.tagName==="SELECT")) return; if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="z"){ e.preventDefault(); e.shiftKey?redo():undo(); } });
let _loaded=false;
try{ const emb=document.getElementById("embedded-sot"); if(emb&&emb.textContent.trim()){ const payload=JSON.parse(emb.textContent); if(payload&&payload.kind==="vibespec-product-map"){ MAP=payload; RO=true; } else { SOT=normalize(payload); _loaded=true; } } }catch(e){}
if(!MAP){
  if(!SOT.title) SOT.title="제품";
  (function(){ const pt=document.getElementById("prodTitle"); if(pt&&pt.firstChild) pt.firstChild.textContent=SOT.title; })();
  resetSelections();
  selPage=SOT.ia.sections[0]&&SOT.ia.sections[0].pages[0]?SOT.ia.sections[0].pages[0].id:null;
  pushHistory(t("현재 상태","Current state"));
  updateUndoButtons();
  initializeFileConnection();
}
// An embedded document is authoritative for its own language: the skill baked
// in a product with an intended language, so honor SOT.lang over a leftover
// localStorage preference (which is shared per-origin and would otherwise leak
// between, e.g., the /ko and /en demos). Only the empty skeleton viewer (no
// embedded SOT) falls back to the remembered preference.
try{ LANG = MAP ? ((MAP.lang) || "ko") : (_loaded ? ((SOT&&SOT.lang) || "ko") : (localStorage.getItem(LANG_KEY) || "ko")); }catch(e){}
document.getElementById("langBtn").addEventListener("click",()=>{ LANG = LANG==="en"?"ko":"en"; try{ localStorage.setItem(LANG_KEY,LANG); }catch(e){} applyStaticI18n(); refreshFileConnectionStatus(); rerender(); });
applyStaticI18n();
MAP?renderMap():render();
roWatch();
