import assert from "node:assert/strict";
import { cases, inputsFor } from "../../../../../evaluation/lifecycle/cases.mjs";
import { replayCase } from "../../../../../evaluation/lifecycle/replay.mjs";
import { planMerge } from "../scripts/lib/merge.mjs";
import { validateSot } from "../scripts/validate-sot.mjs";
import { sotDigest } from "../scripts/lib/c14n.mjs";
const api = await import("../scripts/lib/lifecycle-journal.mjs").catch(() => ({}));
assert.equal(typeof api.planLifecycle, "function", "a guarded lifecycle planner must exist");
const { planLifecycle, inspectLifecycle, verifyJournal } = api;
export const docsFor = state => [{name:"main.sot.json",sot:state.source},{name:"initiatives/batch.sot.json",sot:state.initiative}];
const input=inputsFor(cases[1]), initial=docsFor(input), original=structuredClone(initial);
assert.equal(inspectLifecycle([],initial).status,"not-enrolled");
const init=planLifecycle([],initial,{kind:"init",reason:"Capture initial planning baseline"});
const records=[init.record];
assert.equal(inspectLifecycle(records,initial).productApproval,"not-assessed");
assert.ok(inspectLifecycle(records,initial).pendingReviews.length>=2);
assert.deepEqual(initial,original);
assert.throws(()=>planLifecycle(records,initial,{kind:"init",reason:"again"}),/already enrolled/);
assert.throws(()=>planLifecycle([],initial,{kind:"init",reason:""}),/reason/);
const corrupted=structuredClone(records);corrupted[0].reason="altered";
assert.throws(()=>verifyJournal(corrupted),/digest/);
const unsupported=structuredClone(records);unsupported[0].version="future-journal-v2";
assert.throws(()=>verifyJournal(unsupported),/unsupported/);
assert.throws(()=>planLifecycle([], [{...initial[0],name:"../main.sot.json"}],{kind:"init",reason:"bad path"}),/path/);
assert.throws(()=>planLifecycle([], [initial[0],initial[0]],{kind:"init",reason:"duplicate"}),/duplicate/);
assert.throws(()=>planLifecycle(records,initial,{kind:"approve",reason:"pretend"}),/unsupported/);
// Catch falsy non-object replacements being silently treated as an omitted map,
// including on no-op capture (where invalid input must still be rejected).
for(const replacements of [false,0,"",null,[],"bad"]) {
  assert.throws(()=>planLifecycle([],initial,{kind:"init",reason:"Invalid replacement type",replacements}),/replacements must be an object/);
  assert.throws(()=>planLifecycle(records,initial,{kind:"capture",reason:"Invalid no-op input",replacements}),/replacements must be an object/);
}
for(const options of [{},{replacements:undefined},{replacements:{}}]) {
  assert.deepEqual(planLifecycle([],initial,{kind:"init",reason:"No replacements",...options}).record.replacements,{});
  assert.equal(planLifecycle(records,initial,{kind:"capture",reason:"Valid no-op",...options}).noop,true);
}
console.log("[journal] PASS explicit enrollment, immutable input, integrity, scope/path validation and no approval");

const replay=replayCase(cases[1]);
let docs=initial;
const run=intent=>{const result=planLifecycle(records,docs,intent);records.push(result.record);docs=result.record.after;return result;};
run({kind:"apply",scope:"root",plan:replay.stages[0].input,reason:"Add status surface"});
run({kind:"apply",scope:"root",plan:replay.stages[1].input,reason:"Change cutoff policy"});
let status=inspectLifecycle(records,docs);
assert.ok(status.pendingReviews.some(r=>r.type==="parent-change"&&r.scope==="batch"));
assert.ok(status.pendingReviews.some(r=>r.type==="parent-change"&&r.scope==="batch"&&r.sequence===2&&r.stale),"parent changes must invalidate earlier parent-impact review even when the child is unchanged");
assert.ok(status.historicalChecks.some(c=>c.scope==="root"&&c.stale));
run({kind:"rebase",reason:"Refresh only parent reference"});
assert.equal(docs[1].sot.requirements[0].features[0].desc,cases[1].beforePolicy);
assert.ok(inspectLifecycle(records,docs).pendingReviews.some(r=>r.type==="parent-change"));
run({kind:"merge",initiative:"batch",reason:"Land batch implementation"});
assert.ok(inspectLifecycle(records,docs).pendingReviews.some(r=>r.type==="merge-prd"&&r.field==="constraints"));
assert.ok(inspectLifecycle(records,docs).pendingReviews.some(r=>r.type==="merge-semantic"));
run({kind:"apply",scope:"root",plan:replay.stages[4].input.plan,reason:cases[1].retiredReason,replacements:{"root/F3":"root/F1"}});
assert.throws(()=>planLifecycle(records,docs,{kind:"apply",scope:"root",plan:replay.stages[5].input,reason:"Reintroduce old IDs"}),/retired ID/);
status=inspectLifecycle(records,docs);
assert.equal(status.retired.find(x=>x.id==="root/F3").replacement,"root/F1");
assert.equal(status.retired.find(x=>x.id==="root/P4").reason,cases[1].retiredReason);
assert.equal(status.productApproval,"not-assessed");
assert.ok(status.pendingReviews.every(r=>r.status==="pending"));
const changed=structuredClone(docs);changed[0].sot.requirements[1].desc="A direct editor changed the profile guidance.";
assert.equal(inspectLifecycle(records,changed).status,"external-drift");
assert.throws(()=>planLifecycle(records,changed,{kind:"rebase",reason:"ignore drift"}),/drift/);
const capture=planLifecycle(records,changed,{kind:"capture",reason:"Capture explicit external edit"});
assert.equal(inspectLifecycle([...records,capture.record],changed).status,"current");
const pending=planLifecycle(records,docs,{kind:"rebase",reason:"Refresh remaining references"});
if(pending.record) {
  assert.equal(inspectLifecycle([...records,pending.record],docs).status,"pending-write");
  assert.throws(()=>planLifecycle([...records,pending.record],docs,{kind:"capture",reason:"hide pending"}),/pending/);
}
assert.equal(planLifecycle(records,docs,{kind:"capture",reason:"No change"}).noop,true);
assert.throws(()=>planLifecycle(records,docs,{kind:"apply",scope:"root",plan:replay.stages[0].input,reason:"Do not replay a stale plan"}),/digest/);
console.log("[journal] PASS real edits/rebase/merge preserve pending review, stale evidence, retirement and external drift");

const specRemoved=structuredClone(initial);
specRemoved[0].sot.requirements[0].features[0].specs=[];
specRemoved[0].sot.ia.sections[0].pages[0].children[0].refs=["F1"];
specRemoved[0].sot.flow.transitions=specRemoved[0].sot.flow.transitions.map(t=>({...t,ref:t.ref==="F1:0"?"F1":t.ref}));
const removed=planLifecycle([init.record],specRemoved,{kind:"capture",reason:"Retire eligibility detail"});
assert.throws(()=>planLifecycle([init.record,removed.record],initial,{kind:"capture",reason:"Reinsert old detail"}),/root\/F1:0/);
const anotherScope=structuredClone(docs);
const localFeature=structuredClone(anotherScope[1].sot.requirements[0].features[0]);localFeature.id="F3";
anotherScope[1].sot.requirements[0].features.push(localFeature);
anotherScope[1].sot.ia.sections[0].pages[0].children[0].refs.push("F3");
assert.doesNotThrow(()=>planLifecycle(records,anotherScope,{kind:"capture",reason:"Add separate batch-local feature"}));
const reservedMerge=planMerge(initial,"batch",{reservedIds:["F3","K7","P12"]});
assert.equal(reservedMerge.main.requirements.at(-1).features[0].id,"F4","merge must allocate above historical IDs");
assert.deepEqual(reservedMerge.report.addedSemanticIds,["K1→K8"]);
assert.ok(reservedMerge.report.addedPages.every(s=>Number(s.split("→P")[1])>12));
assert.equal(planMerge(initial,"batch",{reservedIds:["bad"]}).ok,false);
const duplicateLegacy=structuredClone(initial);
delete duplicateLegacy[0].sot.semantic;
duplicateLegacy[0].sot.prd.kpis=["First","Second"].map(name=>({id:"K1",name,target:"",baseline:"Unknown",method:"Report",refs:["F1"]}));
assert.equal(validateSot(duplicateLegacy[0].sot).valid,true,"legacy validator compatibility remains unchanged");
assert.throws(()=>planLifecycle([],duplicateLegacy,{kind:"init",reason:"Ambiguous KPI identities"}),/duplicate definition/);
console.log("[journal] PASS retired detail IDs, independent scopes and collision-free merge allocation");

// Moving a file is observable history, not a content edit or a new identity.
const moved=structuredClone(initial);moved[1].name="initiatives/archive/batch.sot.json";
const movePlan=planLifecycle([init.record],moved,{kind:"capture",reason:"Organize files"});
assert.deepEqual(movePlan.record.changes.map(({scope,file,previousFile})=>({scope,file,previousFile})),[
  {scope:"batch",file:"initiatives/archive/batch.sot.json",previousFile:"initiatives/batch.sot.json"}
]);
assert.deepEqual(movePlan.record.reviewTasks,[],"path-only moves do not create content or parent-policy reviews");
const moveStatus=inspectLifecycle([init.record,movePlan.record],moved);
assert.equal(moveStatus.retired.length,0);
assert.ok(moveStatus.historicalChecks.every(c=>!c.stale),"content digests remain fresh after a path-only move");
console.log("[journal] PASS file moves remain visible without retiring IDs or inventing content changes");

const nested=structuredClone(initial[1]);nested.name="initiatives/nested.sot.json";
nested.sot.initiative.id="nested";nested.sot.initiative.path+="-1";
nested.sot.initiative.parent={scopeId:"batch",canonicalization:"sot-c14n-v1",digest:sotDigest(initial[1].sot)};
const nestedInit=planLifecycle([], [...initial,nested], {kind:"init",reason:"Nested baseline"});
const missingParent=[initial[0],nested];
assert.throws(()=>planLifecycle([nestedInit.record],missingParent,{kind:"capture",reason:"Parent removed"}),
  error=>error.name==="Error"&&/missing parent scope batch.*nested/.test(error.message),
  "a removed parent must be diagnosed before publishing, not dereferenced");
console.log("[journal] PASS removed-parent capture fails with explicit affected-scope diagnostics");
