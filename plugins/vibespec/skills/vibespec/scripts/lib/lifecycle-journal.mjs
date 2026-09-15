// Optional planning-history contract. Never adds fields to a SOT or grants approval.
import { sotDigest } from "./c14n.mjs";
import { validateSot } from "../validate-sot.mjs";
import { validateTree } from "./tree.mjs";
import { diffReport } from "./diff.mjs";
import { reviewSot } from "./content-review.mjs";
import { reviewSemantic } from "./semantic-engine.mjs";
import { applyChangePlan } from "./change-plan.mjs";
import { planRebase, applyRebase } from "./rebase.mjs";
import { planMerge } from "./merge.mjs";

const version="vibespec-lifecycle-v1";
const kinds=["init","capture","apply","rebase","merge"];
const clone=x=>structuredClone(x);
export const scopeOf=doc=>doc.sot.initiative?.id || "root";
const equal=(a,b)=>sotDigest(a)===sotDigest(b);
const fail=message=>{throw new Error(message);};

export function normalizeDocuments(docs) {
  if(!Array.isArray(docs)||!docs.length) fail("workspace requires documents");
  const names=new Set(),scopes=new Set();
  const result=docs.map(({name,sot})=>{
    if(typeof name!=="string"||!(name==="main.sot.json"||/^initiatives\/(?:[A-Za-z0-9_-][A-Za-z0-9._-]*\/)*[A-Za-z0-9_-][A-Za-z0-9._-]*\.sot\.json$/.test(name))) fail("unsafe document path");
    const validation=validateSot(sot);
    if(!validation.valid) fail("invalid SOT: "+JSON.stringify(validation.errors));
    const scope=scopeOf({sot});
    if(names.has(name.toLowerCase())||scopes.has(scope)) fail("duplicate document path or scope");
    if((scope==="root")!==(name==="main.sot.json")) fail("main path and scope disagree");
    names.add(name.toLowerCase());scopes.add(scope);
    return {name,sot:clone(sot)};
  });
  if(!scopes.has("root")) fail("workspace requires main scope");
  inventory(result); // Legacy SOT validation can permit duplicate untyped KPI IDs.
  return result.sort((a,b)=>scopeOf(a)==="root"?-1:scopeOf(b)==="root"?1:a.name<b.name?-1:a.name>b.name?1:0);
}

export function inventory(docs) {
  const result=new Map();
  for(const doc of docs) {
    const scope=scopeOf(doc),sot=doc.sot;
    const add=(id,value)=>{
      const key=`${scope}/${id}`;
      if(result.has(key)) fail("duplicate definition ID: "+key);
      result.set(key,value);
    };
    for(const r of sot.requirements||[]) {
      add(r.id,r);
      for(const f of r.features||[]) {add(f.id,f);(f.specs||[]).forEach((s,i)=>add(`${f.id}:${i}`,s));}
    }
    const pages=items=>(items||[]).forEach(p=>{add(p.id,p);pages(p.children);});
    for(const s of sot.ia?.sections||[]) {add(s.id,s);pages(s.pages);}
    for(const k of sot.prd?.kpis||[]) if(k.id) add(k.id,k);
    for(const e of sot.semantic?.events||[]) add(e.id,e);
    for(const d of sot.semantic?.decisions||[]) add(d.id,d);
  }
  return result;
}

export function verifyJournal(records) {
  if(!Array.isArray(records)) fail("journal must be an array");
  let previous=null;
  for(let i=0;i<records.length;i++) {
    const record=records[i];
    if(record.version!==version||!kinds.includes(record.kind)) fail("unsupported journal version or kind");
    const {digest,...payload}=record;
    if(sotDigest(payload)!==digest) fail("journal digest mismatch");
    if(record.sequence!==i+1||record.previous!==(previous?.digest||null)) fail("journal chain mismatch");
    if(!equal(normalizeDocuments(record.after),record.after)) fail("noncanonical journal snapshot");
    if(i===0) {if(record.kind!=="init"||record.before.length) fail("journal must begin with enrollment");}
    else if(record.kind==="init"||!equal(record.before,previous.after)) fail("journal baseline mismatch");
    previous=record;
  }
  return true;
}

function retiredIds(records) {
  const retired=new Map();
  for(const r of records) {
    const after=inventory(r.after);
    for(const id of inventory(r.before).keys()) if(!after.has(id)&&!retired.has(id)) retired.set(id,{
      id,sequence:r.sequence,reason:r.reason,replacement:r.replacements[id]||null,recordDigest:r.digest
    });
  }
  return [...retired.values()];
}

export function inspectLifecycle(records,documents,{id}={}) {
  verifyJournal(records);
  const docs=normalizeDocuments(documents),head=records.at(-1);
  if(!head) return {status:"not-enrolled",productApproval:"not-assessed",pendingReviews:[],retired:[],historicalChecks:[]};
  const current=new Map(docs.map(d=>[d.name,sotDigest(d.sot)]));
  const before=new Map(head.before.map(d=>[d.name,sotDigest(d.sot)]));
  const exact=equal(docs,head.after);
  const recoverable=!exact&&!["init","capture"].includes(head.kind)&&docs.length===head.after.length&&head.after.every(d=>{
    const digest=current.get(d.name);return digest&&(digest===before.get(d.name)||digest===sotDigest(d.sot));
  });
  const currentScopes=new Map(docs.map(d=>[scopeOf(d),sotDigest(d.sot)]));
  const historicalChecks=records.flatMap(r=>r.checks.map(c=>({...c,sequence:r.sequence,stale:currentScopes.get(c.scope)!==c.digest})));
  const pendingReviews=records.flatMap(r=>r.reviewTasks.map(t=>({...t,sequence:r.sequence,recordDigest:r.digest,status:"pending",
    stale:currentScopes.get(t.scope)!==t.digest||Boolean(t.parentScope&&currentScopes.get(t.parentScope)!==t.parentDigest)})));
  const report={status:exact?"current":recoverable?"pending-write":"external-drift",head:head.digest,sequence:head.sequence,
    productApproval:"not-assessed",reviewScope:"captured-history-and-explicit-references-only",pendingReviews,
    retired:retiredIds(records),historicalChecks,tree:validateTree(docs),
    history:records.map(r=>({sequence:r.sequence,kind:r.kind,reason:r.reason,digest:r.digest,changes:r.changes}))};
  if(id) {
    const matches=records.filter(r=>{
      const a=inventory(r.before),b=inventory(r.after);return (a.has(id)||b.has(id))&&!equal(a.get(id)??null,b.get(id)??null);
    });
    report.lookup={id,active:inventory(docs).has(id),retirement:report.retired.find(r=>r.id===id)||null,
      history:matches.map(r=>({sequence:r.sequence,kind:r.kind,reason:r.reason,digest:r.digest}))};
  }
  return report;
}

export function planLifecycle(records,documents,intent,{headComplete=false}={}) {
  verifyJournal(records);
  if(!kinds.includes(intent.kind)) fail("unsupported lifecycle operation");
  if(typeof intent.reason!=="string"||!intent.reason.trim()) fail("a change reason is required");
  const docs=normalizeDocuments(documents),head=records.at(-1);
  if(intent.kind==="init"&&head) fail("already enrolled");
  if(intent.kind!=="init"&&!head) fail("workspace is not enrolled");
  const status=inspectLifecycle(records,docs).status;
  if(status==="pending-write"&&!(headComplete&&intent.kind==="capture")) fail("pending write requires recovery");
  if(head&&status!=="current"&&intent.kind!=="capture") fail("external drift requires explicit capture");
  const before=head?clone(head.after):[],after=clone(docs);
  let engineReport=null;
  if(intent.kind==="apply") {
    const target=after.find(d=>scopeOf(d)===intent.scope);
    if(!target) fail("unknown target scope");
    const applied=applyChangePlan(target.sot,intent.plan);target.sot=applied.after;engineReport=applied.report;
  } else if(intent.kind==="rebase") {
    const plan=planRebase(after);
    if(plan.unrebasable.length) fail("unrebasable tree: "+JSON.stringify(plan.unrebasable));
    for(const write of applyRebase(after,plan.plan,plan.plan.map(p=>p.id))) after.find(d=>d.name===write.file).sot=JSON.parse(write.content);
    const tree=validateTree(after);if(!tree.valid) fail("invalid rebased tree: "+JSON.stringify(tree.errors));
    engineReport=plan;
  } else if(intent.kind==="merge") {
    const reservedIds=new Set(records.flatMap(r=>[...inventory(r.after).keys(),...inventory(r.before).keys()])
      .filter(id=>id.startsWith("root/")).map(id=>id.slice(5).split(":")[0]));
    // Pending semantic merge material also owns its allocated IDs: later merges
    // cannot reuse them before a reviewer integrates the earlier material.
    for(const r of records) if(r.kind==="merge") for(const pair of r.engineReport.addedSemanticIds||[]) reservedIds.add(pair.split("→")[1]);
    const merge=planMerge(after,intent.initiative,{reservedIds:[...reservedIds]});
    if(!merge.ok) fail(merge.error);
    after.find(d=>d.name===merge.mainName).sot=merge.main;
    after.find(d=>d.name===merge.landedName).sot=merge.landed;engineReport=merge.report;
  }
  const next=normalizeDocuments(after),oldIds=inventory(before),newIds=inventory(next);
  const retired=retiredIds(records);
  const reused=retired.filter(r=>newIds.has(r.id)&&!oldIds.has(r.id));
  if(reused.length) fail("retired ID reuse refused: "+reused.map(r=>r.id).join(", "));
  const replacements=clone(intent.replacements===undefined?{}:intent.replacements);
  if(!replacements||typeof replacements!=="object"||Array.isArray(replacements)) fail("replacements must be an object");
  for(const [from,to] of Object.entries(replacements)) if(!oldIds.has(from)||newIds.has(from)||typeof to!=="string"||!newIds.has(to)) fail("replacement requires a removed ID and an existing target");
  if(head&&equal(before,next)) return {noop:true,record:null};
  const changes=next.map(d=>{
    const old=before.find(b=>scopeOf(b)===scopeOf(d));
    return {scope:scopeOf(d),file:d.name,...(old&&old.name!==d.name?{previousFile:old.name}:{}),
      report:old?diffReport(old.sot,d.sot):null,added:!old};
  }).filter(c=>c.added||c.previousFile||c.report.digest.before!==c.report.digest.after);
  for(const old of before) if(!next.some(d=>scopeOf(d)===scopeOf(old))) changes.push({scope:scopeOf(old),file:old.name,removed:true,report:null});
  // File relocation belongs in history but does not invalidate content evidence.
  const changed=new Set(changes.filter(c=>c.added||c.removed||c.report.digest.before!==c.report.digest.after).map(c=>c.scope)),reviewTasks=[];
  const task=(type,doc,extras={})=>reviewTasks.push({type,scope:scopeOf(doc),digest:sotDigest(doc.sot),...extras});
  for(const d of next) if(changed.has(scopeOf(d))) task("content-review",d);
  for(const d of next) {
    let parent=d.sot.initiative?.parent?.scopeId;const seen=new Set([scopeOf(d)]);
    while(parent&&!seen.has(parent)) {
      const parentDoc=next.find(p=>scopeOf(p)===parent);
      if(!parentDoc) fail("missing parent scope "+parent+" for "+scopeOf(d)+"; restore or repair parent references before recording");
      if(changed.has(parent)) {task("parent-change",d,{parentScope:parent,parentDigest:sotDigest(parentDoc.sot)});break;}
      seen.add(parent);parent=parentDoc.sot.initiative?.parent?.scopeId;
    }
  }
  if(intent.kind==="merge") {
    const main=next.find(d=>scopeOf(d)==="root");
    for(const [field,value] of Object.entries(engineReport.manualPrdReview||{})) task("merge-prd",main,{field,value});
    if(engineReport.manualSemanticReview) task("merge-semantic",main,{value:engineReport.manualSemanticReview});
  }
  const checks=next.map(d=>({scope:scopeOf(d),digest:sotDigest(d.sot),kind:"automated",content:reviewSot(d.sot,{purpose:"current-state"}),measurement:reviewSemantic(d.sot)}));
  const payload={version,sequence:records.length+1,previous:head?.digest||null,kind:intent.kind,reason:intent.reason.trim(),
    before,after:next,replacements,input:clone(intent),engineReport,changes,reviewTasks,checks};
  return {noop:false,record:{...payload,digest:sotDigest(payload)}};
}
