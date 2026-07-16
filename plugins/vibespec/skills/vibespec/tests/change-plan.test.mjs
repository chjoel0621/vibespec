import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { applyChangePlan } from "../scripts/lib/change-plan.mjs";
import { sotDigest } from "../scripts/lib/c14n.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const valid = JSON.parse(readFileSync(join(here, "fixtures", "valid-minimal.sot.json"), "utf8"));
const initiative = JSON.parse(readFileSync(join(here, "fixtures", "valid-initiative-1.1.sot.json"), "utf8"));
const clone = value => JSON.parse(JSON.stringify(value));
const planFor = (sot, operations, expected) => ({ kind: "vibespec-change-plan-v1", baseDigest: sotDigest(sot), operations, expected });
const planForV2 = (sot, operations, expected) => ({ kind: "vibespec-change-plan-v2", baseDigest: sotDigest(sot), operations, expected });

const rename = planFor(valid, [{ op: "updateFeature", id: "F1", changes: { title: "Validate generated plans" } }], {
  touchedIds: ["F1"], addedIds: [], removedIds: []
});
const renamed = applyChangePlan(valid, rename);
assert.equal(renamed.after.requirements[0].features[0].title, "Validate generated plans");
assert.equal(valid.requirements[0].features[0].title, "Run validation", "planning must never mutate the source object");
console.log("[plan] PASS narrow feature edit preserves the rest of the SOT");

const stale = clone(rename); stale.baseDigest = "sha256:" + "0".repeat(64);
assert.throws(() => applyChangePlan(valid, stale), /base digest mismatch/);
console.log("[plan] PASS stale base digest is refused before any edit");

// This is the clean-omission shape: F2 and its only page both disappear, so
// the resulting multi-feature SOT is still valid. It must still be declared.
const multi = clone(valid);
multi.requirements[0].features.push({ id: "F2", title: "Second feature", desc: "", status: "todo", priority: "mid", acceptance: [], specs: [] });
multi.ia.sections[0].pages.push({ id: "P3", title: "Second screen", type: "page", refs: ["F2"], children: [] });
const concealed = planFor(multi, [{ op: "removeFeature", id: "F2" }, { op: "removePage", id: "P3" }], {
  touchedIds: ["F2", "P3"], addedIds: [], removedIds: []
});
assert.throws(() => applyChangePlan(multi, concealed), /unexpected removed ids/);
const declared = clone(concealed); declared.expected.removedIds = ["F2", "P3"];
assert.equal(applyChangePlan(multi, declared).after.requirements[0].features.length, 1);
console.log("[plan] PASS clean deletion is blocked until every removed id is declared");

// V2 names every actual diff path. This closes the remaining clean-omission
// hole for data that has no R/F/S/P id of its own, such as PRD content rows.
const prdPlan = planForV2(valid, [
  { op: "updatePrdText", field: "problem", expectedValue: valid.prd.problem, value: "Generated plans need bounded, verified edits" },
  { op: "appendPrdItem", field: "inScope", item: "Deterministic change plans" },
  { op: "removePrdItem", field: "nonGoals", match: "Runtime collaboration" },
  { op: "updatePrdItem", field: "targets", match: { name: "Planner" }, changes: { role: "Reviewer" } },
  { op: "updatePrdItem", field: "scenarios", match: { text: valid.prd.scenarios[0].text }, changes: { text: "The reviewer opens the start page and checks the result" } },
  { op: "updatePrdItem", field: "kpis", match: { name: "Validation pass rate" }, changes: { target: "99.9%" } }
], {
  touchedIds: [], addedIds: [], removedIds: [],
  touchedPaths: ["prd.problem", "prd.inScope", "prd.nonGoals", "prd.targets[Planner].role", "prd.scenarios[0]", "prd.kpis[Validation pass rate].target"]
});
const prdEdited = applyChangePlan(valid, prdPlan);
assert.equal(prdEdited.after.prd.problem, "Generated plans need bounded, verified edits");
assert.equal(prdEdited.after.prd.inScope.at(-1), "Deterministic change plans");
assert.deepEqual(prdEdited.after.prd.nonGoals, []);
assert.equal(prdEdited.after.prd.targets[0].role, "Reviewer");
assert.match(prdEdited.after.prd.scenarios[0].text, /reviewer/);
assert.equal(prdEdited.after.prd.kpis[0].target, "99.9%");
const concealedAcceptance = planForV2(valid, [{ op: "updateFeature", id: "F1", changes: { acceptance: [] } }], {
  touchedIds: ["F1"], addedIds: [], removedIds: [], touchedPaths: ["F1.acceptance[1]"]
});
assert.throws(() => applyChangePlan(valid, concealedAcceptance), /unexpected touched paths/);
console.log("[plan] PASS v2 requires exact PRD and acceptance change paths");

// Specs are still index-addressed in SOT 1.x. Updates need an exact prior
// record; additions append only; removal is restricted to the final index so
// F#:index references never silently retarget later specs.
const specBefore = clone(valid.requirements[0].features[0].specs[0]);
const specPlan = planForV2(valid, [{ op: "updateSpec", featureId: "F1", index: 0, before: specBefore, changes: { title: "Check every reference" } }], {
  touchedIds: ["F1"], addedIds: [], removedIds: [], touchedPaths: ["F1:0.title"]
});
assert.equal(applyChangePlan(valid, specPlan).after.requirements[0].features[0].specs[0].title, "Check every reference");
const invalidSpecBefore = clone(specPlan); invalidSpecBefore.operations[0].before.title = "Stale title";
assert.throws(() => applyChangePlan(valid, invalidSpecBefore), /before must exactly match/);
const appendSpec = planForV2(valid, [
  { op: "appendSpec", featureId: "F1", spec: { title: "Report the mismatch", desc: "Show the changed paths", acceptance: [] } },
  { op: "updatePage", id: "P1", changes: { refs: ["F1", "F1:1"] } }
], { touchedIds: ["F1", "P1"], addedIds: [], removedIds: [], touchedPaths: ["F1:1", "P1.refs"] });
assert.equal(applyChangePlan(valid, appendSpec).after.requirements[0].features[0].specs.length, 2);
const multiSpec = clone(valid);
multiSpec.requirements[0].features[0].specs.push({ title: "Second spec", desc: "Would shift indexes", acceptance: [] });
assert.throws(() => applyChangePlan(multiSpec, planForV2(multiSpec, [{ op: "removeSpec", featureId: "F1", index: 0, before: specBefore }], {
  touchedIds: ["F1"], addedIds: [], removedIds: ["F1"], touchedPaths: ["F1:0"]
})), /only the final spec may be removed/);
console.log("[plan] PASS spec edits preserve F#:index reference stability");

const structurePlan = planForV2(valid, [
  { op: "updateRequirement", id: "R1", changes: { title: "Validate every SOT" } },
  { op: "updateSection", id: "S1", changes: { title: "Validation workspace" } },
  { op: "addSection", section: { id: "S2", title: "Reports", pages: [{ id: "P3", title: "Report", type: "page", refs: [], children: [] }] } }
], {
  touchedIds: ["R1", "S1", "S2", "P3"], addedIds: ["S2", "P3"], removedIds: [],
  touchedPaths: ["R1.title", "S1.title", "S2", "P3"]
});
const restructured = applyChangePlan(valid, structurePlan).after;
assert.equal(restructured.ia.sections[1].id, "S2");
assert.throws(() => applyChangePlan(valid, planForV2(valid, [{ op: "removeRequirement", id: "R1" }], {
  touchedIds: ["R1"], addedIds: [], removedIds: ["R1"], touchedPaths: ["R1"]
})), /remove or move its features explicitly first/);
assert.throws(() => applyChangePlan(valid, planForV2(valid, [{ op: "removeSection", id: "S1" }], {
  touchedIds: ["S1"], addedIds: [], removedIds: ["S1"], touchedPaths: ["S1"]
})), /move or remove every page explicitly first/);
console.log("[plan] PASS requirement and section changes require explicit structural work");

const flowPlan = planForV2(valid, [
  { op: "updateDocument", changes: { title: "Verified VibeSpec" } },
  { op: "setFlowStart", expectedPageId: "P1", pageId: "P2" },
  { op: "updateTransition", before: valid.flow.transitions[0], after: { from: "P1", to: "P2", label: "Review result" } }
], {
  touchedIds: ["P1", "P2"], addedIds: [], removedIds: [], touchedPaths: ["title", "flow.start", "flow.P1→P2"]
});
const flowEdited = applyChangePlan(valid, flowPlan).after;
assert.equal(flowEdited.title, "Verified VibeSpec");
assert.equal(flowEdited.flow.start, "P2");
assert.equal(flowEdited.flow.transitions[0].label, "Review result");
console.log("[plan] PASS document and flow changes are preconditioned and path-checked");

// Moving work between stable owners is a real restructuring path. Both source
// and destination stay non-empty; no id is reissued and the diff names F2 as
// moved rather than deleted/recreated.
const rich = clone(valid);
rich.requirements[0].features.push({ id: "F2", title: "Second check", desc: "Extra validation", status: "todo", priority: "mid", acceptance: [], specs: [] });
rich.requirements.push({ id: "R2", title: "Reporting", desc: "Explain validation", status: "todo", priority: "mid", acceptance: [], features: [{ id: "F3", title: "Report result", desc: "Show a report", status: "todo", priority: "mid", acceptance: [], specs: [] }] });
rich.ia.sections[0].pages[0].children.push(
  { id: "P3", title: "Second check", type: "action", refs: ["F2"], children: [] },
  { id: "P4", title: "Report", type: "action", refs: ["F3"], children: [] }
);
rich.flow.transitions.push({ from: "P1", to: "P3", ref: "F2" }, { from: "P1", to: "P4", ref: "F3" });
const moveFeature = planForV2(rich, [{ op: "moveFeature", id: "F2", requirementId: "R2" }], {
  touchedIds: ["F2"], addedIds: [], removedIds: [], touchedPaths: ["F2"]
});
const moved = applyChangePlan(rich, moveFeature).after;
assert.equal(moved.requirements[1].features.some(feature => feature.id === "F2"), true);
console.log("[plan] PASS feature moves preserve stable ids and references");

const addRequirement = planForV2(valid, [
  { op: "addRequirement", requirement: { id: "R2", title: "Report validation", desc: "Explain results", status: "todo", priority: "mid", acceptance: [], features: [{ id: "F2", title: "Show report", desc: "Render a report", status: "todo", priority: "mid", acceptance: [], specs: [] }] } },
  { op: "addPage", sectionId: "S1", page: { id: "P3", title: "Report", type: "action", refs: ["F2"], children: [] } },
  { op: "addTransition", transition: { from: "P1", to: "P3", ref: "F2" } }
], {
  touchedIds: ["R2", "F2", "P1", "P3"], addedIds: ["R2", "F2", "P3"], removedIds: [],
  touchedPaths: ["R2", "F2", "P3", "flow.P1→P3[ref:F2]"]
});
const withRequirement = applyChangePlan(valid, addRequirement).after;
assert.equal(withRequirement.requirements.at(-1).features[0].id, "F2");
const removeRequirement = planForV2(rich, [
  { op: "moveFeature", id: "F3", requirementId: "R1" },
  { op: "removeRequirement", id: "R2" }
], { touchedIds: ["F3", "R2"], addedIds: [], removedIds: ["R2"], touchedPaths: ["F3", "R2"] });
assert.deepEqual(applyChangePlan(rich, removeRequirement).after.requirements.map(requirement => requirement.id), ["R1"]);
console.log("[plan] PASS requirement addition and deletion retain explicit feature ownership");

const rearrange = planForV2(valid, [
  { op: "addSection", section: { id: "S2", title: "Review", pages: [{ id: "P3", title: "Summary", type: "page", refs: [], children: [] }] } },
  { op: "movePage", id: "P2", sectionId: "S2" },
  { op: "movePage", id: "P1", sectionId: "S2" },
  { op: "removeSection", id: "S1" }
], {
  touchedIds: ["S1", "S2", "P1", "P2", "P3"], addedIds: ["S2", "P3"], removedIds: ["S1"],
  touchedPaths: ["S1", "S2", "P1", "P2", "P3"]
});
const rearranged = applyChangePlan(valid, rearrange).after;
assert.deepEqual(rearranged.ia.sections.map(section => section.id), ["S2"]);
assert.equal(rearranged.ia.sections[0].pages.length, 3);
console.log("[plan] PASS page moves make section removal explicit and safe");

const boundaryPage = initiative.ia.sections[0].pages[0];
assert.throws(() => applyChangePlan(initiative, planForV2(initiative, [{ op: "removePage", id: boundaryPage.id }], {
  touchedIds: [boundaryPage.id], addedIds: [], removedIds: [boundaryPage.id], touchedPaths: [boundaryPage.id]
})), /boundary stubs are parent-owned/);
assert.throws(() => applyChangePlan(initiative, planForV2(initiative, [{ op: "addPage", sectionId: initiative.ia.sections[0].id, page: { id: "P99", title: "Bad boundary", type: "page", refs: [], boundary: { scopeId: "root", pageId: "P1" }, children: [] } }], {
  touchedIds: ["P99"], addedIds: ["P99"], removedIds: [], touchedPaths: ["P99"]
})), /boundaries are parent-owned/);
console.log("[plan] PASS boundaries are excluded from single-file plans");

const workspace = mkdtempSync(join(tmpdir(), "vibespec-plan-"));
try {
  const sotPath = join(workspace, "main.sot.json");
  const planPath = join(workspace, "rename.plan.json");
  writeFileSync(sotPath, JSON.stringify(valid));
  writeFileSync(planPath, JSON.stringify(rename));
  const cli = join(here, "..", "scripts", "apply-change-plan.mjs");
  const run = args => spawnSync(process.execPath, [cli, sotPath, planPath, ...args], { encoding: "utf8" });
  assert.equal(run([]).status, 0, "dry run must pass: " + run([]).stderr);
  assert.equal(JSON.parse(readFileSync(sotPath, "utf8")).requirements[0].features[0].title, "Run validation", "dry run must not write");
  assert.equal(run(["--apply"]).status, 0, "apply must pass: " + run(["--apply"]).stderr);
  assert.equal(JSON.parse(readFileSync(sotPath, "utf8")).requirements[0].features[0].title, "Validate generated plans");
  console.log("[plan] PASS CLI dry-run preserves disk and --apply writes only a verified plan");
} finally {
  try { rmSync(workspace, { recursive: true, force: true }); } catch {}
}
