/* ---- initiative band: shown only for SOT 1.1 initiative documents ---- */
function renderInitiativeBand(){
  const band=document.getElementById("initBand"); if(!band) return;
  const meta=SOT&&SOT.initiative;
  if(!meta){ band.hidden=true; return; }
  band.hidden=false;
  document.getElementById("ibBadge").textContent=t("이니셔티브","Initiative");
  document.getElementById("ibName").textContent=meta.id||"";
  const parent=meta.parent&&meta.parent.scopeId==="root" ? t("본편","the main document") : (meta.parent&&meta.parent.scopeId)||"";
  document.getElementById("ibParent").textContent=t(`${parent} 기준 · ${meta.productId||""}`,`over ${parent} · ${meta.productId||""}`);
  const st=INIT_STATUS[meta.status]||{t:meta.status,e:meta.status};
  const dot=document.getElementById("ibDot"); dot.className="ib-dot "+(meta.status||"");
  document.getElementById("ibStatusLabel").textContent=t(st.t,st.e);
}

/* ============================ RENDER DISPATCH ============================ */
function render(){
  renderInitiativeBand();
  document.querySelectorAll(".tab").forEach(t=>t.setAttribute("aria-selected", t.dataset.view===VIEW));
  const el = document.getElementById("stage");
  el.className = "wrap " + VIEW;
  if(VIEW==="prd") el.innerHTML = renderPRD();
  else if(VIEW==="spec") el.innerHTML = renderSpec();
  else if(VIEW==="tree"){ el.innerHTML = renderTree(); layoutTree(); }
  else if(VIEW==="ia") el.innerHTML = renderIA();
  else { try{ el.innerHTML = renderFlow(); layoutFlow(); }catch(err){ el.innerHTML='<div style="padding:40px;color:#c0392b;font-weight:600">유저플로우 렌더 오류: '+esc(String(err&&err.stack||err))+'</div>'; } }
}
/* --------------------- 기능명세서 (3분할 디렉터리 + 상세) --------------------- */
function nodeInfo(id){
  if(!id) return null;
  if(id.indexOf(":")>-1){ const[fid,si]=id.split(":"); const ff=findF(fid); if(!ff.f||!ff.f.specs[+si]) return null; return {kind:"spec",id,ref:id,obj:ff.f.specs[+si]}; }
  const r=find(id); if(r) return {kind:"req",id,obj:r};
  const ff=findF(id); if(ff.f) return {kind:"feat",id,obj:ff.f};
  return null;
}
function ownerOf(id){ if(id.indexOf(":")>-1){ const[fid,si]=id.split(":"); return findF(fid).f.specs[+si]; } return id[0]==="R"?find(id):findF(id).f; }
function specTitle(sp){ return typeof sp==="string"?sp:(sp&&sp.title||""); }
function iaWalk(arr,sec,parent,id){ for(const p of arr){ if(p.id===id) return {page:p,arr,sec,parent}; const r=iaWalk(p.children||[],sec,p,id); if(r) return r; } return null; }
function iaFindPage(id){ if(!id) return null; for(const sec of SOT.ia.sections){ const r=iaWalk(sec.pages,sec,null,id); if(r) return r; } return null; }
function countPages(arr){ let n=arr.length; arr.forEach(p=>n+=countPages(p.children||[])); return n; }
function specCatalog(){ const out=[]; SOT.requirements.forEach(r=>r.features.forEach(f=>{ out.push({id:f.id,label:r.title+" › "+f.title}); f.specs.forEach((sp,si)=>out.push({id:f.id+":"+si,label:f.title+" › "+specTitle(sp)})); })); return out; }
function refLabel(id){ const c=specCatalog().find(x=>x.id===id); return c?c.label:id; }
function pagesRefTo(fid){ const out=[]; const walk=arr=>arr.forEach(p=>{ if((p.refs||[]).includes(fid)) out.push(p); walk(p.children||[]); }); SOT.ia.sections.forEach(s=>walk(s.pages)); return out; }
function allPages(){ const out=[]; const walk=(arr,st)=>arr.forEach(p=>{ out.push({id:p.id,label:st+" › "+p.title}); walk(p.children||[],st); }); SOT.ia.sections.forEach(s=>walk(s.pages,s.title)); return out; }
function pageLabel(id){ const a=allPages().find(x=>x.id===id); return a?a.label:id; }
function findPageByRef(id){ let res=null; const walk=arr=>arr.forEach(p=>{ if(!res&&(p.refs||[]).includes(id)) res=p; walk(p.children||[]); }); SOT.ia.sections.forEach(s=>walk(s.pages)); return res; }
function coverage(){ const mapped=new Set(); const walk=arr=>arr.forEach(p=>{ (p.refs||[]).forEach(x=>mapped.add(x)); walk(p.children||[]); }); SOT.ia.sections.forEach(s=>walk(s.pages)); const unmapped=specCatalog().filter(c=>!mapped.has(c.id)); return {mapped,unmapped}; }
function flowMeta(id){ const r=iaFindPage(id); return r?{title:r.page.title,type:r.page.type}:{title:id,type:"page"}; }
function refTitle(id){ const c=specCatalog().find(x=>x.id===id); return c?c.label.split("›").pop().trim():id; }
function transLabel(t){ return t.ref? refTitle(t.ref) : (t.label||""); }
