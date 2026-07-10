/* --------------------- 유저플로우 (전환 그래프) --------------------- */
function computeFlow(){
  const f=SOT.flow||{}; const trans=(f.transitions||[]).filter(t=>t&&t.from&&t.to);
  const ids=new Set(); trans.forEach(t=>{ids.add(t.from);ids.add(t.to);}); if(f.start) ids.add(f.start);
  const nodes=[...ids]; if(!nodes.length) return null;
  const incoming={}; nodes.forEach(n=>incoming[n]=0); trans.forEach(t=>{ if(t.from!==t.to) incoming[t.to]++; });
  const start=(f.start&&ids.has(f.start))?f.start:(nodes.find(n=>incoming[n]===0)||nodes[0]);
  const adj={}; nodes.forEach(n=>adj[n]=[]); trans.forEach(t=>{ if(adj[t.from]) adj[t.from].push(t.to); });
  const layer={}; layer[start]=0; const q=[start];
  while(q.length){ const n=q.shift(); adj[n].forEach(m=>{ if(layer[m]===undefined){ layer[m]=layer[n]+1; q.push(m); } }); }
  let mx=0; nodes.forEach(n=>{ if(layer[n]!==undefined&&layer[n]>mx) mx=layer[n]; });
  nodes.forEach(n=>{ if(layer[n]===undefined) layer[n]=mx+1; });
  const byL={}; nodes.forEach(n=>{ (byL[layer[n]]=byL[layer[n]]||[]).push(n); });
  const order={};
  Object.keys(byL).map(Number).sort((a,b)=>a-b).forEach(L=>{
    if(L===0){ byL[L].forEach((n,i)=>order[n]=i); return; }
    byL[L].sort((a,b)=>{
      const pa=trans.filter(t=>t.to===a&&layer[t.from]!==undefined).map(t=>order[t.from]).filter(x=>x!==undefined);
      const pb=trans.filter(t=>t.to===b&&layer[t.from]!==undefined).map(t=>order[t.from]).filter(x=>x!==undefined);
      const ma=pa.length?pa.reduce((s,x)=>s+x,0)/pa.length:999;
      const mb=pb.length?pb.reduce((s,x)=>s+x,0)/pb.length:999;
      return ma-mb || a.localeCompare(b,undefined,{numeric:true});
    });
    byL[L].forEach((n,i)=>order[n]=i);
  });
  return {trans,nodes,layer,byL,start};
}
let flowZ=1, flowX=0, flowY=0, flowW=0, flowH=0, flowSel=null, flowLabels=false, flowEdit=false;
function applyFlowFocus(){
  const vp=document.getElementById("flowVP"); if(!vp) return;
  const groups=vp.querySelectorAll(".fedgeg"), nodes=vp.querySelectorAll("[data-fn]");
  if(flowSel && ![...nodes].some(n=>n.dataset.fn===flowSel)) flowSel=null;
  if(!flowSel){ groups.forEach(g=>g.classList.remove("hot","dim")); nodes.forEach(n=>n.classList.remove("dim","sel")); return; }
  const conn=new Set([flowSel]);
  groups.forEach(g=>{ const on=(g.dataset.from===flowSel||g.dataset.to===flowSel); g.classList.toggle("hot",on); g.classList.toggle("dim",!on); if(on){conn.add(g.dataset.from);conn.add(g.dataset.to);} });
  nodes.forEach(n=>{ const id=n.dataset.fn; n.classList.toggle("sel",id===flowSel); n.classList.toggle("dim",!conn.has(id)); });
}
function renderFlow(){
  const g=computeFlow();
  const legend=`<div class="flow-legend">
      <span class="lg"><span class="sw start"></span>${t('시작','Start')}</span>
      <span class="lg"><span class="sw top"></span>${t('섹션 최상위','Section top')}</span>
      <span class="lg"><span class="sw page"></span>${t('페이지','Page')}</span>
      <span class="lg"><span class="sw action"></span>${t('행동','Action')}</span>
      <span class="lg">${t('→ 화면 이동(전환)','→ Navigation (transition)')}</span>
    </div>`;
  const zoom=`<div class="flow-zoom"><button class="zbtn" data-zoom="out">−</button><button class="zbtn" data-zoom="fit">${t('맞춤','Fit')}</button><button class="zbtn" data-zoom="in">＋</button></div>`;
  if(!g) return `<div class="flowg" id="flowVP">${legend}<div class="empty" style="padding:48px">${t('전환(유저플로우) 데이터가 없습니다.','No user-flow transition data.')}</div></div>`;
  const COLW=390, ROWH=124, padX=46, padY=58, NW=206, NH=52;
  const pos={};
  Object.keys(g.byL).map(Number).sort((a,b)=>a-b).forEach(L=>{ g.byL[L].forEach((n,i)=>{ pos[n]={x:padX+L*COLW, y:padY+i*ROWH}; }); });
  const maxL=Math.max(...Object.keys(g.byL).map(Number));
  const maxRows=Math.max(...Object.values(g.byL).map(a=>a.length));
  flowW=padX+(maxL+1)*COLW+140; flowH=padY+maxRows*ROWH+120;
  let paths="";
  const outRank={}, inRank={}, outCount={}, inCount={};
  g.trans.forEach(t=>{ outCount[t.from]=(outCount[t.from]||0)+1; inCount[t.to]=(inCount[t.to]||0)+1; });
  const nextOut={}, nextIn={};
  g.trans.forEach(t=>{ outRank[t.from+"~"+t.to+"~"+(t.label||"")]=nextOut[t.from]||0; nextOut[t.from]=(nextOut[t.from]||0)+1; inRank[t.from+"~"+t.to+"~"+(t.label||"")]=nextIn[t.to]||0; nextIn[t.to]=(nextIn[t.to]||0)+1; });
  g.trans.forEach((t,ei)=>{
    const a=pos[t.from], b=pos[t.to]; if(!a||!b) return;
    const key=t.from+"~"+t.to+"~"+(t.label||"");
    const so=(outRank[key]-(outCount[t.from]-1)/2)*7;
    const ti=(inRank[key]-(inCount[t.to]-1)/2)*7;
    let d, lx, ly;
    if(b.x>a.x){
      const x1=a.x+NW, y1=a.y+NH/2+so, x2=b.x, y2=b.y+NH/2+ti;
      const gap=x2-x1, lane=((ei%5)-2)*18;
      const mx=x1+Math.max(90,gap*.46);
      d=`M${x1},${y1} C${mx},${y1+lane} ${x2-Math.max(90,gap*.32)},${y2-lane} ${x2},${y2}`;
      lx=x1+Math.min(150,Math.max(92,gap*.34));
      ly=y1+lane-10;
    } else {
      const sx=a.x+NW/2+so, sy=a.y+NH, tx=b.x+NW/2+ti, ty=b.y+NH;
      const dip=Math.max(sy,ty)+ROWH*(.82+(ei%4)*.18);
      d=`M${sx},${sy} C${sx},${dip} ${tx},${dip} ${tx},${ty}`;
      lx=(sx+tx)/2; ly=dip-16;
    }
    paths+=`<g class="fedgeg" data-from="${t.from}" data-to="${t.to}"><path class="fedge-hit" d="${d}"/><path class="fedge" d="${d}" marker-end="url(#fa)"/>`;
    const lab=transLabel(t);
    if(lab) paths+=`<foreignObject x="${lx-78}" y="${ly}" width="156" height="22"><div class="elabel ${t.ref?'reff':''}" xmlns="http://www.w3.org/1999/xhtml" title="${esc(lab)}">${esc(lab)}</div></foreignObject>`;
    paths+=`</g>`;
  });
  let nds="";
  g.nodes.forEach(n=>{ const m=flowMeta(n); const cls=m.type==="top"?"top":(m.type==="action"?"action":"page");
    nds+=`<div class="fnode ${cls} ${n===g.start?'is-start':''}" style="left:${pos[n].x}px;top:${pos[n].y}px;width:${NW}px;height:${NH}px" data-fn="${n}" title="${esc(m.title)}"><span class="ftitle">${esc(m.title)}</span></div>`;
  });
  const cov=flowCoverage();
  return `<div class="flowwrap">
    ${cov.banner}
    <div class="flow-stage">
      <div class="flow-main">
        <div class="flowg ${flowLabels?'labels':''}" id="flowVP">
          <div class="flowg-inner" id="flowInner" style="width:${flowW}px;height:${flowH}px">
            <svg width="${flowW}" height="${flowH}" style="position:absolute;left:0;top:0;overflow:visible">
              <defs><marker id="fa" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#b3a8e0"/></marker></defs>
              ${paths}
            </svg>
            ${nds}
          </div>
        </div>
        <div class="flow-tools">
          <button class="ztg ${flowLabels?'on':''}" data-ftool="labels">${t('라벨','Labels')}</button>
          <button class="ztg ${flowEdit?'on':''}" data-ftool="edit">${t('편집','Edit')}</button>
          <button class="ztg" data-ftool="clear">${t('선택 해제','Clear')}</button>
          <span class="ft-hint">${flowEdit?t('오른쪽 패널에서 전환 추가·삭제 · 트리거=기능이면 라벨 자동','Add/remove transitions in the right panel · feature trigger = auto label'):t('노드 클릭 = 연결된 흐름만 강조','Click a node to highlight its flow')}</span>
        </div>
        ${legend}
        ${zoom}
      </div>
      ${flowEdit?renderFlowEditPanel():''}
    </div>
  </div>`;
}
function applyFlowTransform(){ const el=document.getElementById("flowInner"); if(el) el.style.transform="scale("+flowZ+")"; }
function flowFit(){ const vp=document.getElementById("flowVP"); if(!vp||!flowW) return; const z=Math.min((vp.clientWidth||900)/flowW,(vp.clientHeight||600)/flowH,1); flowZ=Math.max(0.2,z||1); applyFlowTransform(); vp.scrollTo(0,0); }
function layoutFlow(){
  const vp=document.getElementById("flowVP"); if(!vp) return;
  if(!flowZ) flowZ=1; applyFlowTransform();
  vp.classList.toggle("labels", flowLabels); applyFlowFocus();
  let dg=false,sx,sy,sl,st;
  vp.onpointerdown=(e)=>{ if(e.target.closest("[data-fn]")||e.target.closest(".flow-tools")||e.target.closest(".flow-zoom")) return; dg=true; sx=e.clientX; sy=e.clientY; sl=vp.scrollLeft; st=vp.scrollTop; vp.style.cursor="grabbing"; };
  vp.onpointermove=(e)=>{ if(!dg) return; vp.scrollLeft=sl-(e.clientX-sx); vp.scrollTop=st-(e.clientY-sy); };
  vp.onpointerup=vp.onpointercancel=()=>{ dg=false; vp.style.cursor="grab"; };
}
