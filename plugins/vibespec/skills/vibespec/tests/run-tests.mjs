import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { validateSot } from "../scripts/validate-sot.mjs";
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

const sourceRoot = join(here, "..", "src", "js");
const viewerContractSource = ["00-config.js", "20-state.js", "40-io.js"]
  .map(file => readFileSync(join(sourceRoot, file), "utf8"))
  .join("\n") + "\nthis.canonical = canonicalSOT(); this.promote = input => { SOT=normalize(structuredClone(input)); return canonicalSOT(); }; this.makeTransition = flowTransition;";
const viewerContext = { structuredClone };
vm.runInNewContext(viewerContractSource, viewerContext);
const viewerExport = JSON.parse(viewerContext.canonical);
const viewerResult = validateSot(viewerExport);
assert.equal(viewerResult.valid, true, `viewer export: ${JSON.stringify(viewerResult.errors)}`);
console.log("[test] PASS viewer default export matches SOT 1.0");

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

const dense = createDenseSot();
const denseResult = validateSot(dense);
assert.equal(dense.flow.transitions.length, 53);
assert.equal(dense.ia.sections[0].pages.length, 45);
assert.equal(denseResult.valid, true, `dense fixture: ${JSON.stringify(denseResult.errors)}`);
console.log("[test] PASS dense 45-node/53-edge fixture matches SOT 1.0");
