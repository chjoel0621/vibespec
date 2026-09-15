import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cases, inputsFor } from "../../../../../evaluation/lifecycle/cases.mjs";

const replayModule = await import("../../../../../evaluation/lifecycle/replay.mjs").catch(() => ({}));
assert.equal(typeof replayModule.replayCase, "function", "lifecycle replay must exist before claiming longitudinal coverage");
const { replayCase, summarize } = replayModule;
const results = cases.map(replayCase);
for (let i = 0; i < results.length; i++) {
  const result = results[i];
  assert.equal(result.stages.length, 6);
  assert.deepEqual(result.stages.map(s => s.id), ["add", "policy-change", "rebase", "merge", "retire", "reintroduce"]);
  assert.equal(result.reproducibility, "passed");
  assert.equal(result.humanReview.status, "pending");
  assert.equal(result.lifecycleReadiness, "needs-human-review");
  const rebase = result.stages[2];
  assert.equal(rebase.observations.parentReferenceFresh, true);
  assert.equal(rebase.observations.oldPolicyRetained, true);
  assert.equal(rebase.observations.policyConflictDetectedByRuntime, false);
  assert.ok(result.stages[3].observations.manualPrdReview.includes("constraints"));
  assert.ok(result.stages[3].observations.manualPrdReview.includes("kpis"));
  assert.equal(result.stages[5].observations.retiredIdAccepted, true);
  assert.equal(result.stages[5].observations.retirementHistoryAvailableInSot, false);
  assert.ok(result.stages.every(s => s.observations.unrelatedRequirementPreserved));
  assert.ok(result.stages.every(s => s.beforeDigest && s.afterDigest));
  assert.deepEqual(result.initial, inputsFor(cases[i]), "input remains unchanged");
}
assert.throws(() => replayCase({ ...cases[0], afterPolicy: "An unreviewed policy edit" }), /case definition drift/);
assert.throws(() => replayCase({ ...cases[0], sourceDigest: "sha256:" + "0".repeat(64) }), /source drift/);
const report = summarize([...results, structuredClone(results[0])]);
assert.equal(report.uniqueConcepts, 3);
assert.equal(report.runs, 4);
assert.equal(report.uniqueTransitions, 18);
assert.equal(report.humanReviewedConcepts, 0);
assert.equal(report.generationQuality.status, "not-assessed");
assert.equal(report.humanQuality.falsePositives, null);
const changedVariant = structuredClone(results[0]);
changedVariant.stages[0].afterDigest = "sha256:" + "0".repeat(64);
assert.throws(() => summarize([results[0], changedVariant]), /conflicting repeated run/);
console.log("[lifecycle] PASS real six-stage replay preserves unrelated data and reports present gaps as candidates");

const cliPath = fileURLToPath(new URL("../../../../../evaluation/lifecycle/evaluate.mjs", import.meta.url));
const cli = spawnSync(process.execPath, [cliPath, "--json"], { encoding: "utf8" });
assert.equal(cli.status, 0, cli.stderr);
assert.equal(JSON.parse(cli.stdout).summary.uniqueTransitions, 18);
for (const args of [["--unknown"], ["--case", "missing"], ["--write"]]) {
  assert.notEqual(spawnSync(process.execPath, [cliPath, ...args], { encoding: "utf8" }).status, 0);
}
console.log("[lifecycle] PASS CLI distinguishes replay success from product readiness and rejects invalid requests");
const temporary = mkdtempSync(join(tmpdir(), "vibespec-lifecycle-test-"));
try {
  const output = join(temporary, "evidence");
  const written = spawnSync(process.execPath, [cliPath, "--case", "room-booking", "--write", output], { encoding: "utf8" });
  assert.equal(written.status, 0, written.stderr);
  const evidence = readFileSync(join(output, "report.json"), "utf8");
  assert.equal(JSON.parse(evidence).summary.uniqueTransitions, 6);
  assert.equal(readdirSync(join(output, "room-booking")).length, 8);
  const second = spawnSync(process.execPath, [cliPath, "--write", output], { encoding: "utf8" });
  assert.notEqual(second.status, 0);
  assert.match(second.stderr, /output already exists/);
  assert.equal(readFileSync(join(output, "report.json"), "utf8"), evidence, "existing evidence must not be overwritten");
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
console.log("[lifecycle] PASS explicit materialization preserves existing evidence");
