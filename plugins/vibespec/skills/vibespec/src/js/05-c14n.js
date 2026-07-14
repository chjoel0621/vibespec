/* ==== SOT canonicalization — sot-c14n-v1 (FROZEN) ====
   Single shared source: concatenated into the viewer bundle AND vm-loaded by
   Node tools (scripts/lib/c14n.mjs). parent.digest values are SHA-256 over
   this exact serialization, so ANY change to key priority, normalization,
   whitespace, or newline rules here is a breaking change that requires a new
   algorithm id (sot-c14n-v2) and a digest migration. Guarded by pinned test
   vectors in tests/run-tests.mjs — if those fail, you are breaking the freeze.
   `var`/function declarations (not const) so vm sandbox exposes them. */
var SOT_C14N_V1 = "sot-c14n-v1";
var C14N_PRI = ["schemaVersion","title","lang","initiative","productId","id","path","name","type","status","priority","desc","acceptance","refs","boundary","pageId","parent","scopeId","canonicalization","digest","from","to","ref","label","start"];
function stableStringify(obj){
  const rank=k=>{ const i=C14N_PRI.indexOf(k); return i<0?999:i; };
  const ser=v=>{ if(Array.isArray(v)) return v.map(ser); if(v&&typeof v==="object"){ const o={}; Object.keys(v).sort((a,b)=>(rank(a)-rank(b))||(a<b?-1:a>b?1:0)).forEach(k=>{o[k]=ser(v[k]);}); return o; } return v; };
  return JSON.stringify(ser(obj),null,2);
}
