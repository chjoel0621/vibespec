/* ----------------------------- 트리 / 노드 캔버스 ----------------------------- */
let EDGES = [];
function renderTree(){
  EDGES = [];
  const specNode = (fid,sp,si)=>{
    const id = fid+":"+si; EDGES.push([fid,id]);
    return `<div class="branch"><div class="tnode spec" data-node="${id}" data-kind="spec">
      <span class="ic"></span>
      <span class="tn-title">${esc(specTitle(sp))}</span>
      <button class="tdel" data-delnode="${id}" title="${t('삭제','Delete')}">×</button>
    </div></div>`;
  };
  const featNode = f=>{
    f.specs.forEach((sp,si)=>{}); // edges added inside specNode
    const kids = f.specs.map((sp,si)=>specNode(f.id,sp,si)).join("");
    const children = kids?`<div class="children">${kids}</div>`:"";
    return `<div class="branch"><div class="tnode feat" data-node="${f.id}" data-kind="feat">
      <span class="ic"></span>
      <span class="tn-title">${esc(f.title)}</span>
      <span class="tn-id">${f.id}</span>
      <button class="star ${f.starred?'on':''}" data-star="${f.id}" title="${t('즐겨찾기','Favorite')}">★</button>
      <button class="tadd" data-addchild="${f.id}" title="${t('상세기능 추가','Add sub-feature')}">＋</button>
      <button class="tdel" data-delnode="${f.id}" title="${t('삭제','Delete')}">×</button>
    </div>${children}</div>`;
  };
  const reqNode = r=>{
    r.features.forEach(f=>EDGES.push([r.id,f.id]));
    const kids = r.features.map(featNode).join("");
    const children = kids?`<div class="children">${kids}</div>`:"";
    return `<div class="branch"><div class="tnode req" data-node="${r.id}" data-kind="req">
      <span class="ic"></span>
      <span class="tn-title">${esc(r.title)}</span>
      <span class="tn-id">${r.id}</span>
      <button class="star ${r.starred?'on':''}" data-star="${r.id}" title="${t('즐겨찾기','Favorite')}">★</button>
      <button class="tadd" data-addchild="${r.id}" title="${t('기능 추가','Add feature')}">＋</button>
      <button class="tdel" data-delnode="${r.id}" title="${t('삭제','Delete')}">×</button>
    </div>${children}</div>`;
  };
  SOT.requirements.forEach(r=>EDGES.push(["PRD",r.id]));
  const kids = SOT.requirements.map(reqNode).join("");
  return `<div class="tree" id="tree">
    <svg class="wires" id="wires"></svg>
    <div id="treeHdr"></div>
    <div class="tree-hint">${t('노드를 클릭하면 기능명세서로 이동 · 마우스오버 시 ＋추가 · ×삭제 · ★즐겨찾기','Click a node to open the Feature Spec · hover for ＋add · ×delete · ★favorite')}</div>
    <div class="branch"><div class="tnode prd" data-node="PRD" data-kind="prd">
      <span class="ic"></span>
      <span class="tn-title">${esc(SOT.title||"제품")}</span>
      <span class="tn-id">PRD</span>
      <button class="tadd" data-addchild="PRD" title="${t('요구사항 추가','Add requirement')}">＋</button>
    </div><div class="children">${kids}</div></div>
  </div>`;
}
function layoutTree(){
  const cont = document.getElementById("tree"); if(!cont) return;
  requestAnimationFrame(()=>{
    const svg = document.getElementById("wires");
    const cr = cont.getBoundingClientRect();
    const W = cont.scrollWidth, H = cont.scrollHeight;
    svg.setAttribute("width",W); svg.setAttribute("height",H);
    let d="";
    EDGES.forEach(([p,c])=>{
      const pe=cont.querySelector('[data-node="'+p+'"]'), ce=cont.querySelector('[data-node="'+c+'"]');
      if(!pe||!ce) return;
      const a=pe.getBoundingClientRect(), b=ce.getBoundingClientRect();
      const x1=a.right-cr.left, y1=a.top+a.height/2-cr.top;
      const x2=b.left-cr.left,  y2=b.top+b.height/2-cr.top;
      const mx=(x1+x2)/2;
      d+=`<path d="M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}"/>`;
    });
    svg.innerHTML=d;
    const hdr=document.getElementById("treeHdr");
    if(hdr){ hdr.innerHTML=[["prd","PRD","PRD"],["req","요구사항","Requirements"],["feat","기능","Features"],["spec","상세 기능","Sub-features"]].map(([k,ko,en])=>{
      const el=cont.querySelector('[data-kind="'+k+'"]'); if(!el) return "";
      const x=el.getBoundingClientRect().left-cr.left;
      return `<div class="tcol-label" style="left:${x}px">${t(ko,en)}</div>`;
    }).join(""); }
  });
}
function addChild(pid){
  if(pid==="PRD") SOT.requirements.push({id:nid("R"),title:"새 요구사항",desc:"설명을 입력하세요.",features:[]});
  else if(pid[0]==="R") find(pid).features.push({id:nid("F"),title:"새 기능",priority:"mid",status:"todo",specs:[]});
  else if(pid[0]==="F") findF(pid).f.specs.push({title:"새 상세기능",desc:"",acceptance:[]});
  commit();
}
function delNode(id){
  if(id.indexOf(":")>-1){ const[fid,si]=id.split(":"); findF(fid).f.specs.splice(+si,1); }
  else if(id[0]==="R") SOT.requirements=SOT.requirements.filter(r=>r.id!==id);
  else if(id[0]==="F"){ const r=findF(id).r; r.features=r.features.filter(f=>f.id!==id); }
  commit();
}
function toggleStar(id){
  const o = id[0]==="R"?find(id):(id[0]==="F"?findF(id).f:null);
  if(o){ o.starred=!o.starred; commit(); }
}
function goToSpec(id){
  if(id==="PRD"){ VIEW="prd"; render(); return; }
  if(id.indexOf(":")>-1){ const fid=id.split(":")[0]; const ff=findF(fid); if(ff.f){ selReq=ff.r.id; selFeat=fid; selNode=id; } }
  else if(id[0]==="R"){ const r=find(id); if(r){ selReq=id; selFeat=r.features[0]?r.features[0].id:null; selNode=id; } }
  else if(id[0]==="F"){ const ff=findF(id); if(ff.f){ selReq=ff.r.id; selFeat=id; selNode=id; } }
  VIEW="spec"; render();
}
