import assert from "node:assert/strict";
import {mkdtempSync,rmSync,readFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {cases} from "../../../../../evaluation/lifecycle/cases.mjs";
const api=await import("../../../../../evaluation/lifecycle/managed.mjs").catch(()=>({}));
assert.equal(typeof api.exerciseManagedCase,"function","managed longitudinal evaluation must run real durable writes");
const root=mkdtempSync(join(tmpdir(),"vibespec-managed-"));
try {
  for(const c of cases) {
    const result=api.exerciseManagedCase(c,join(root,c.conceptId));
    assert.equal(result.appliedChanges,5);
    assert.equal(result.reuseRejected,true);
    assert.equal(result.recordCount,6);
    assert.equal(result.productApproval,"not-assessed");
    assert.ok(result.pendingMergeReviews>0);
    assert.equal(result.parentPolicyReviewPending,true);
    assert.ok(result.stages.every(s=>s.status==="current"));
    assert.equal(JSON.parse(readFileSync(join(root,c.conceptId,"main.sot.json"),"utf8")).requirements[1].features[0].id,"F2");
  }
  console.log("[managed] PASS three persisted five-change journeys retain review debt and reject the sixth retired-ID reuse attempt");
} finally {rmSync(root,{recursive:true,force:true});}
