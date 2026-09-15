import assert from "node:assert/strict";
const module = await import("../../../../../evaluation/semantic-assurance/coverage.mjs").catch(() => ({}));
assert.equal(typeof module.distinctCoverage, "function", "distinct coverage must exist");
const { distinctCoverage } = module;
const sample = (conceptId, lane, kpis) => ({
  manifest: { id: conceptId + "-run", conceptId, lane },
  artifacts: { [lane === "controlled-mutation" ? "resolved" : "observed"]: { prd: { kpis } } }
});
const kpi = (id, mode) => ({ id, measurement: { mode } });
const first = sample("cooking", "natural", [kpi("K1", "external"), kpi("K2", "event-ratio")]);
const cases = [first, structuredClone(first), sample("booking", "controlled-mutation", [kpi("K1", "event-ratio")]),
  sample("legacy", "legacy-comparison", [kpi("K1", "manual")]),
  sample("candidate", "reviewer-baseline-candidate", [kpi("K1", "survey")])];
const result = distinctCoverage(cases);
assert.equal(result.uniqueConcepts, 2);
assert.equal(result.uniqueAssessedKpis, 3);
assert.deepEqual(result.measurementModes, ["event-ratio", "external"]);
assert.deepEqual(result.remaining, { concepts: 6, kpis: 27, measurementModes: ["event-count", "survey", "manual"] });
assert.equal(result.coverageThresholdsMet, false);
assert.equal(result.calibrationApproval, "not-assessed");
assert.throws(() => distinctCoverage([first, sample("cooking", "natural", [kpi("K1", "manual")])]), /conflicting measurement mode/);
assert.throws(() => distinctCoverage([sample(undefined, "natural", [kpi("K1", "manual")])]), /conceptId/);
assert.throws(() => distinctCoverage([sample("x", "natural", [kpi("K1", "invented")])]), /unsupported measurement mode/);
assert.throws(() => distinctCoverage([sample("x", "natural", [kpi("K1", "manual"), kpi("K1", "manual")])]), /duplicate KPI/);
assert.throws(() => distinctCoverage([sample("x", "reviewer-baseline", [])]), /unsupported lane/);
const covered = Array.from({ length: 8 }, (_, i) => sample("concept-" + i, "natural", [
  kpi("K1", "event-count"), kpi("K2", "event-ratio"), kpi("K3", "survey"), kpi("K4", i ? "external" : "manual")
]));
assert.equal(distinctCoverage(covered).coverageThresholdsMet, true);
assert.equal(distinctCoverage(covered).calibrationApproval, "not-assessed", "quantity never implies human approval");
console.log("[coverage] PASS locale/repeat deduplication, lane exclusion, conflicting IDs, coverage/approval separation");
