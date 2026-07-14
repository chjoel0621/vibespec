/* stableStringify lives in 05-c14n.js (sot-c14n-v1, frozen — do not redefine here). */
function canonicalSOT(){ const c=normalize(JSON.parse(JSON.stringify(SOT))); c.schemaVersion=schemaVersionFor(c); return stableStringify(c); }
