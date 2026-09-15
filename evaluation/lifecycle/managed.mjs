import assert from "node:assert/strict";
import {existsSync,mkdirSync,writeFileSync} from "node:fs";
import {join,resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {cases,inputsFor} from "./cases.mjs";
import {replayCase} from "./replay.mjs";
import {runLifecycle,readLifecycle} from "../../plugins/vibespec/skills/vibespec/scripts/lib/lifecycle-store.mjs";
import {sotDigest} from "../../plugins/vibespec/skills/vibespec/scripts/lib/c14n.mjs";

export function exerciseManagedCase(c,root) {
  assert.equal(existsSync(root),false,"managed evaluation requires a new directory");
  const source=inputsFor(c),replay=replayCase(c);
  mkdirSync(join(root,"initiatives"),{recursive:true});
  writeFileSync(join(root,"main.sot.json"),JSON.stringify(source.source,null,2)+"\n",{flag:"wx"});
  writeFileSync(join(root,"initiatives","batch.sot.json"),JSON.stringify(source.initiative,null,2)+"\n",{flag:"wx"});
  runLifecycle(root,{kind:"init",reason:"Enroll synthetic evaluation baseline"},{apply:true});
  const stages=[];
  for(const intent of [
    {kind:"apply",scope:"root",plan:replay.stages[0].input,reason:"Add status list"},
    {kind:"apply",scope:"root",plan:replay.stages[1].input,reason:c.afterPolicy},
    {kind:"rebase",reason:"Refresh parent reference without claiming policy review"},
    {kind:"merge",initiative:"batch",reason:"Land synthetic batch implementation"},
    {kind:"apply",scope:"root",plan:replay.stages[4].input.plan,reason:c.retiredReason}
  ]) {
    const report=runLifecycle(root,intent,{apply:true});
    const current=readLifecycle(root);
    assert.equal(sotDigest(current.docs[0].sot.requirements[1]),sotDigest(source.source.requirements[1]),"unrelated requirement must remain unchanged");
    stages.push({kind:intent.kind,status:report.status,head:report.head,pendingReviews:report.pendingReviews.length});
  }
  assert.throws(()=>runLifecycle(root,{kind:"apply",scope:"root",plan:replay.stages[5].input,reason:"Attempt to reuse retired IDs"},{apply:true}),/retired ID/);
  const state=readLifecycle(root);
  return {conceptId:c.conceptId,appliedChanges:5,reuseRejected:true,recordCount:state.records.length,stages,
    pendingMergeReviews:state.report.pendingReviews.filter(r=>r.type.startsWith("merge-")).length,
    parentPolicyReviewPending:state.report.pendingReviews.some(r=>r.type==="parent-change"),
    productApproval:state.report.productApproval,humanReview:"pending",finalReport:state.report};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    if(process.argv.length!==4||process.argv[2]!=="--write") throw new Error("Usage: node evaluation/lifecycle/managed.mjs --write <new-output-directory>");
    const output=resolve(process.argv[3]);
    if(existsSync(output)) throw new Error("output already exists; choose a new directory");
    mkdirSync(output,{recursive:true});
    const results=cases.map(c=>exerciseManagedCase(c,join(output,c.conceptId)));
    writeFileSync(join(output,"managed-report.json"),JSON.stringify({scope:"synthetic-guarded-replay",cases:results,productApproval:"not-assessed"},null,2)+"\n",{flag:"wx"});
    console.log("[managed] PASS 3 synthetic concepts: 15 applied changes, 3 retired-ID reuses refused; human review pending; product approval not-assessed");
  } catch(error) {console.error("[managed] FAIL: "+error.message);process.exitCode=1;}
}
