import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { validateSot } from "../scripts/validate-sot.mjs";
import { SOT_C14N_V1, stableStringify, sotDigest } from "../scripts/lib/c14n.mjs";
import { createDenseSot } from "./dense-fixture.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const schema = JSON.parse(readFileSync(join(here, "..", "references", "sot.schema.json"), "utf8"));
const valid = JSON.parse(readFileSync(join(here, "fixtures", "valid-minimal.sot.json"), "utf8"));
const clone = value => JSON.parse(JSON.stringify(value));

assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
assert.equal(schema.title, "VibeSpec SOT");
console.log("[test] PASS machine-readable schema loads");

const cases = [
  { name: "valid fixture", mutate: value => value, valid: true },
  { name: "triggerless transition", mutate: value => { value.flow.transitions[0] = { from: "P1", to: "P2" }; return value; }, valid: true },
  { name: "transition with ref and label", mutate: value => { value.flow.transitions[0].label = "Open"; return value; }, message: "must not contain both ref and label" },
  { name: "legacy transition fields", mutate: value => { value.flow.transitions[0] = { source: "P1", target: "P2", action: "Open" }; return value; }, message: "field is not allowed" },
  { name: "unknown flow page", mutate: value => { value.flow.transitions[0].to = "P99"; return value; }, message: "unknown page id P99" },
  { name: "missing IA coverage", mutate: value => { value.ia.sections[0].pages[0].children[0].refs = []; return value; }, message: "missing IA coverage for F1:0" },
  { name: "duplicate feature id", mutate: value => { value.requirements[0].features.push(clone(value.requirements[0].features[0])); return value; }, message: "duplicate feature id F1" },
  { name: "unknown KPI ref", mutate: value => { value.prd.kpis[0].refs = ["F99"]; return value; }, message: "unknown feature ref F99" },
  { name: "unknown top-level field", mutate: value => { value.rogue = true; return value; }, message: "field is not allowed" },
  { name: "malformed persona", mutate: value => { value.prd.targets = [42]; return value; }, message: "must be object" },
  { name: "malformed acceptance", mutate: value => { value.requirements[0].acceptance = [{ text: 123, done: "yes" }]; return value; }, message: "must be string" }
];

for (const testCase of cases) {
  const result = validateSot(testCase.mutate(clone(valid)));
  if (testCase.valid) assert.equal(result.valid, true, `${testCase.name}: ${JSON.stringify(result.errors)}`);
  else {
    assert.equal(result.valid, false, `${testCase.name}: expected validation failure`);
    assert.ok(result.errors.some(item => item.message.includes(testCase.message)), `${testCase.name}: missing ${testCase.message}`);
  }
  console.log(`[test] PASS ${testCase.name}`);
}

/* ==== sot-c14n-v1 freeze guard (known-answer test) ====
   The pinned digest below IS the definition of sot-c14n-v1. If this test
   fails, canonicalization output changed — that is a breaking change
   requiring a new algorithm id and a digest migration, NOT a pin update.
   Update the pin ONLY when deliberately shipping sot-c14n-v2. */
const C14N_VECTOR_DIGEST = "sha256:3f1a99b8c255ab38f14d65ae327fe8f4a74fc876da8081dece73caa5826c2cec";
const vectorInput = JSON.parse(readFileSync(join(here, "fixtures", "c14n-vector.json"), "utf8"));
const vectorExpected = readFileSync(join(here, "fixtures", "c14n-vector.expected.txt"), "utf8");
assert.equal(SOT_C14N_V1, "sot-c14n-v1");
assert.equal(stableStringify(vectorInput), vectorExpected, "c14n canonical output drifted from the frozen vector");
assert.equal(sotDigest(vectorInput), C14N_VECTOR_DIGEST, "c14n digest drifted from the frozen vector");
assert.ok(!vectorExpected.endsWith("\n"), "canonical form must not carry a trailing newline");
const vectorSnapshot = JSON.stringify(vectorInput);
stableStringify(vectorInput);
assert.equal(JSON.stringify(vectorInput), vectorSnapshot, "stableStringify must not mutate its input");
console.log("[test] PASS sot-c14n-v1 frozen vector (canonical bytes + digest)");

/* Frozen 1.0 sample: canonical digest measured with the PRE-refactor viewer
   stableStringify (commit 31059d3 baseline). Proves plain-1.0 documents
   canonicalize byte-identically under sot-c14n-v1. The sample file is frozen —
   never edit it; evolving test data belongs in valid-minimal.sot.json. */
const sample10 = JSON.parse(readFileSync(join(here, "fixtures", "c14n-sample-1.0.sot.json"), "utf8"));
assert.equal(sotDigest(sample10), "sha256:376e087cc26cb25088c25429a8863ac8ed066308c49c8c08ab5b8e047329d29f",
  "1.0 sample canonical bytes drifted from the pre-refactor viewer baseline");
console.log("[test] PASS frozen 1.0 sample matches pre-refactor canonical baseline");

const sourceRoot = join(here, "..", "src", "js");
const viewerContractSource = ["00-config.js", "05-c14n.js", "20-state.js", "40-io.js"]
  .map(file => readFileSync(join(sourceRoot, file), "utf8"))
  .join("\n") + "\nthis.canonical = canonicalSOT(); this.promote = input => { SOT=normalize(structuredClone(input)); return canonicalSOT(); }; this.makeTransition = flowTransition;";
const viewerContext = { structuredClone };
vm.runInNewContext(viewerContractSource, viewerContext);
const viewerExport = JSON.parse(viewerContext.canonical);
const viewerResult = validateSot(viewerExport);
assert.equal(viewerResult.valid, true, `viewer export: ${JSON.stringify(viewerResult.errors)}`);
console.log("[test] PASS viewer default export matches SOT 1.0");

assert.equal(viewerContext.stableStringify(vectorInput), vectorExpected, "viewer bundle c14n diverged from Node loader");
console.log("[test] PASS viewer bundle and Node loader share one c14n source");

const legacy = clone(valid);
delete legacy.schemaVersion;
legacy.overview = legacy.prd.oneLiner;
delete legacy.prd.oneLiner;
legacy.goals = [legacy.prd.goal];
delete legacy.prd.goal;
legacy.personas = ["Legacy planner"];
delete legacy.prd.targets;
legacy.prd.background = legacy.prd.whyNow;
delete legacy.prd.whyNow;
legacy.prd.roles = ["Legacy planner"];
delete legacy.prd.targets;
legacy.prd.scenarios = [legacy.prd.scenarios[0].text];
legacy.prd.kpis = [legacy.prd.kpis[0].name];
const promoted = JSON.parse(viewerContext.promote(legacy));
const promotedResult = validateSot(promoted);
assert.equal(promoted.schemaVersion, "1.0");
assert.equal(promoted.prd.oneLiner, legacy.overview);
assert.equal(promoted.prd.goal, legacy.goals[0]);
assert.equal(promoted.prd.targets[0].name, legacy.personas[0]);
assert.equal(promotedResult.valid, true, `legacy promotion: ${JSON.stringify(promotedResult.errors)}`);
console.log("[test] PASS legacy SOT promotes to valid 1.0 on viewer save");

const flowless = clone(valid);
flowless.flow = { start: null, transitions: [] };
const derived = JSON.parse(viewerContext.promote(flowless));
const derivedResult = validateSot(derived);
assert.deepEqual(derived.flow.transitions[0], { from: "P1", to: "P2" });
assert.equal(derivedResult.valid, true, `flowless derivation: ${JSON.stringify(derivedResult.errors)}`);
console.log("[test] PASS flowless SOT derives triggerless transitions that validate after save");

for (const path of ["connect to start", "manual transition"]) {
  const edited = clone(valid);
  edited.flow.transitions.push(viewerContext.makeTransition("P1", "P2"));
  const saved = JSON.parse(viewerContext.promote(edited));
  const result = validateSot(saved);
  assert.deepEqual(saved.flow.transitions.at(-1), { from: "P1", to: "P2" });
  assert.equal(result.valid, true, `${path}: ${JSON.stringify(result.errors)}`);
  console.log(`[test] PASS viewer ${path} triggerless transition validates after save`);
}

/* ==== diff + impact library (v0.5 contract, reused by v1 rebase) ==== */
const { diffReport } = await import("../scripts/lib/diff.mjs");

const identical = diffReport(clone(valid), clone(valid));
assert.equal(identical.changes.length, 0);
assert.equal(identical.digest.before, identical.digest.after);
console.log("[test] PASS diff of identical SOTs is empty with equal digests");

const edited = clone(valid);
edited.requirements[0].features[0].title = "Renamed feature";
edited.requirements[0].features[0].specs.push({ title: "New spec", desc: "", acceptance: [] });
edited.prd.kpis[0].target = "changed-target";
const report = diffReport(clone(valid), edited);
const paths = report.changes.map(c => `${c.type} ${c.path}`);
assert.ok(paths.includes("modified F1.title"), `missing F1.title: ${paths}`);
assert.ok(paths.some(p => p.startsWith("added F1:")), `missing added spec: ${paths}`);
assert.ok(paths.some(p => p.startsWith("modified prd.kpis[") && p.endsWith(".target")), `missing kpi field diff: ${paths}`);
assert.ok(report.unchanged.includes("ia") && report.unchanged.includes("flow"), `ia/flow must be byte-identical: ${report.unchanged}`);
assert.ok(report.impact.F1, "F1 impact missing");
assert.ok(report.impact.F1.pages.length > 0, "F1 impact must list referencing pages");
assert.notEqual(report.digest.before, report.digest.after);
assert.equal(report.removedIds.length, 0);
console.log("[test] PASS diff reports id-addressed changes, impact radius, and unchanged proof");

const withRemoval = clone(valid);
withRemoval.requirements[0].features = [];
const removalReport = diffReport(clone(valid), withRemoval);
assert.ok(removalReport.removedIds.includes("F1"), `removed ids must flag F1: ${removalReport.removedIds}`);
console.log("[test] PASS diff flags removed ids for no-reissue enforcement");

const cleanedRemoval = clone(valid);
cleanedRemoval.requirements[0].features = [];
const stripRefs = page => { page.refs = (page.refs ?? []).filter(ref => !ref.startsWith("F1")); (page.children ?? []).forEach(stripRefs); };
cleanedRemoval.ia.sections.forEach(section => section.pages.forEach(stripRefs));
cleanedRemoval.flow.transitions = cleanedRemoval.flow.transitions.filter(t => !(t.ref ?? "").startsWith("F1"));
if (!cleanedRemoval.flow.transitions.length) cleanedRemoval.flow.transitions.push({ from: "P1", to: "P2" });
cleanedRemoval.prd.kpis.forEach(kpi => { kpi.refs = (kpi.refs ?? []).filter(ref => !ref.startsWith("F1")); });
const cleanedReport = diffReport(clone(valid), cleanedRemoval);
assert.ok(cleanedReport.impact.F1, "deleting F1 and cleaning its refs must still report F1 impact (from before)");
assert.ok(cleanedReport.impact.F1.pages.length > 0, `deleted F1 impact must list formerly-linked pages: ${JSON.stringify(cleanedReport.impact.F1)}`);
console.log("[test] PASS deletion impact survives reference cleanup (before-side radius)");

const parallelAfter = clone(valid);
parallelAfter.flow.transitions.push({ from: "P1", to: "P2", ref: "F1" });
const parallelReport = diffReport(clone(valid), parallelAfter);
const parallelChanges = parallelReport.changes.filter(c => c.path.startsWith("flow."));
assert.deepEqual(parallelChanges.map(c => c.type), ["added"], `parallel transition must diff as added, got: ${JSON.stringify(parallelChanges)}`);
assert.ok(parallelChanges[0].path.includes("ref:F1"), `parallel path must carry the trigger: ${parallelChanges[0].path}`);
console.log("[test] PASS parallel transitions (same from→to) diff as add/remove, not modified");

// Parallel group shrinking 2 → 1: the REMOVED transition must be reported,
// never the surviving one (the old Map-collapse bug reported the survivor).
const shrinkReport = diffReport(clone(parallelAfter), clone(valid));
const shrinkChanges = shrinkReport.changes.filter(c => c.path.startsWith("flow."));
assert.deepEqual(shrinkChanges.map(c => c.type), ["removed"], `parallel 2→1 must diff as one removal: ${JSON.stringify(shrinkChanges)}`);
assert.ok(shrinkChanges[0].path.includes("ref:F1") && !shrinkChanges[0].path.includes("ref:F1:0"),
  `the removed transition (ref:F1), not the survivor (ref:F1:0), must be reported: ${shrinkChanges[0].path}`);
console.log("[test] PASS parallel 2→1 reports the removed transition, not the survivor");

// Single group 1 → 1: a trigger change stays a friendly "modified".
const retriggered = clone(valid);
retriggered.flow.transitions[0] = { from: "P1", to: "P2", label: "달라진 라벨" };
const retriggerReport = diffReport(clone(valid), retriggered);
const retriggerChanges = retriggerReport.changes.filter(c => c.path.startsWith("flow."));
assert.deepEqual(retriggerChanges.map(c => c.type), ["modified"], `single-group trigger change must stay modified: ${JSON.stringify(retriggerChanges)}`);
assert.equal(retriggerChanges[0].path, "flow.P1→P2");
console.log("[test] PASS single transition trigger change stays a modified record");

/* ==== SOT 1.1 initiative schema (inactive contract — nothing generates 1.1 yet) ==== */
const initiative = JSON.parse(readFileSync(join(here, "fixtures", "valid-initiative-1.1.sot.json"), "utf8"));
const cloneInit = () => JSON.parse(JSON.stringify(initiative));

assert.equal(validateSot(cloneInit()).valid, true, `valid 1.1 initiative: ${JSON.stringify(validateSot(cloneInit()).errors)}`);
console.log("[test] PASS valid 1.1 initiative passes validation");

const initiativeCases = [
  { name: "id reserved root", mutate: v => { v.initiative.id = "root"; }, message: '"root" is reserved' },
  { name: "self parent", mutate: v => { v.initiative.parent.scopeId = v.initiative.id; }, message: "cannot be its own parent" },
  { name: "wrong canonicalization", mutate: v => { v.initiative.parent.canonicalization = "sot-c14n-v2"; }, message: 'must equal "sot-c14n-v1"' },
  { name: "malformed digest", mutate: v => { v.initiative.parent.digest = "notahash"; }, message: "must match" },
  { name: "bad status", mutate: v => { v.initiative.status = "merged"; }, message: "must be one of proposed" },
  { name: "missing initiative meta", mutate: v => { delete v.initiative; }, message: "must be an object" },
  { name: "unknown initiative field", mutate: v => { v.initiative.kind = "feature"; }, message: "field is not allowed" }
];
for (const testCase of initiativeCases) {
  const doc = cloneInit(); testCase.mutate(doc);
  const r = validateSot(doc);
  assert.equal(r.valid, false, `${testCase.name}: expected failure`);
  assert.ok(r.errors.some(e => e.message.includes(testCase.message)), `${testCase.name}: missing "${testCase.message}" in ${JSON.stringify(r.errors)}`);
  console.log(`[test] PASS 1.1 rejects: ${testCase.name}`);
}

// Version gating: 1.1-only fields must be rejected under 1.0.
const oneOhPlusInitiative = clone(valid); oneOhPlusInitiative.initiative = cloneInit().initiative;
assert.ok(validateSot(oneOhPlusInitiative).errors.some(e => e.message.includes("requires schemaVersion 1.1")),
  "1.0 with initiative must be rejected");
const oneOhPlusBoundary = clone(valid); oneOhPlusBoundary.ia.sections[0].pages[0].boundary = { scopeId: "root", pageId: "P1" };
assert.ok(validateSot(oneOhPlusBoundary).errors.some(e => e.message.includes("requires schemaVersion 1.1")),
  "1.0 with page boundary must be rejected");
console.log("[test] PASS 1.0 forbids initiative meta and page boundary");

// Boundary stub carrying its own refs is a warning, not an error.
const stubWithRefs = cloneInit();
stubWithRefs.ia.sections[0].pages[0].refs = ["F1"];
const stubResult = validateSot(stubWithRefs);
assert.equal(stubResult.valid, true, `boundary stub with refs should still be valid: ${JSON.stringify(stubResult.errors)}`);
assert.ok(stubResult.warnings.some(w => w.message.includes("boundary stub")), "boundary stub with refs should warn");
console.log("[test] PASS boundary stub with own refs warns but stays valid");

const dense = createDenseSot();
const denseResult = validateSot(dense);
assert.equal(dense.flow.transitions.length, 53);
assert.equal(dense.ia.sections[0].pages.length, 45);
assert.equal(denseResult.valid, true, `dense fixture: ${JSON.stringify(denseResult.errors)}`);
console.log("[test] PASS dense 45-node/53-edge fixture matches SOT 1.0");
