function stableStringify(obj){
  const PRI=["schemaVersion","title","lang","id","name","type","status","priority","desc","acceptance","refs","from","to","ref","label","start"];
  const rank=k=>{ const i=PRI.indexOf(k); return i<0?999:i; };
  const ser=v=>{ if(Array.isArray(v)) return v.map(ser); if(v&&typeof v==="object"){ const o={}; Object.keys(v).sort((a,b)=>(rank(a)-rank(b))||(a<b?-1:a>b?1:0)).forEach(k=>{o[k]=ser(v[k]);}); return o; } return v; };
  return JSON.stringify(ser(obj),null,2);
}
function canonicalSOT(){ const c=JSON.parse(JSON.stringify(SOT)); c.schemaVersion=SCHEMA_VERSION; return stableStringify(c); }
