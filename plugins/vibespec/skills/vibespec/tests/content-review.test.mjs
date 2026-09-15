import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { reviewSot } from "../scripts/lib/content-review.mjs";
import { validateSot } from "../scripts/validate-sot.mjs";
import { spawnSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const valid = JSON.parse(readFileSync(join(here, "fixtures", "valid-minimal.sot.json"), "utf8"));
const flatComplex = JSON.parse(readFileSync(join(here, "fixtures", "flat-complex-saas.sot.json"), "utf8"));
const clone = value => JSON.parse(JSON.stringify(value));
assert.equal(reviewSot(valid).valid, true);
console.log("[review] PASS review is advisory and accepts a valid SOT");

const thin = clone(valid);
thin.prd.problem = "TBD";
thin.prd.nonGoals = [];
thin.requirements[0].features[0].desc = "";
thin.requirements[0].features[0].acceptance = [{ text: "works", done: false }];
thin.flow.transitions[0] = { from: "P1", to: "P2", label: "Next" };
const result = reviewSot(thin);
const codes = result.findings.map(item => item.code);
for (const code of ["thin-prd", "empty-non-goals", "thin-feature-description", "vague-acceptance", "feature-without-flow-trigger"]) {
  assert.ok(codes.includes(code), "missing advisory finding " + code);
}
console.log("[review] PASS review catches thin scope, vague acceptance, and missing flow semantics");

const consumerWithOperationsLanguage = clone(valid);
consumerWithOperationsLanguage.requirements[0].features[0].specs[0].title = "Exception and audit handling";
const consumerResult = reviewSot(consumerWithOperationsLanguage, { profile: "consumer" });
assert.ok(consumerResult.findings.some(item => item.code === "consumer-operations-language"), "consumer profile must flag operations-default language");

const marketplace = clone(valid);
marketplace.prd.targets = [{ name: "Buyer", role: "Buyer", needs: "Find an item", pain: "Too much choice" }];
const marketplaceResult = reviewSot(marketplace, { profile: "marketplace" });
assert.ok(marketplaceResult.findings.some(item => item.code === "marketplace-needs-multiple-user-groups"), "marketplace profile must require multiple participant groups");
marketplace.initiative = {
  id: "buyer-offer",
  path: "1-1",
  status: "proposed",
  canonicalization: "sot-c14n-v1",
  parent: { scopeId: "root", digest: `sha256:${"0".repeat(64)}` }
};
const marketplaceInitiativeResult = reviewSot(marketplace, { profile: "marketplace" });
assert.equal(marketplaceInitiativeResult.findings.some(item => item.code === "marketplace-needs-multiple-user-groups"), false, "a focused marketplace Add-on may target one participant group");
assert.throws(() => reviewSot(valid, { profile: "unknown" }), /unsupported generation profile/);
console.log("[review] PASS profile review distinguishes consumer language and marketplace participation");

const flatResult = reviewSot(flatComplex);
const flatCodes = flatResult.findings.map(item => item.code);
assert.ok(flatCodes.includes("flat-ia-for-complex-product"), "complex products with no IA hierarchy must be flagged");
assert.ok(flatCodes.includes("shallow-ia-for-complex-product"), "complex products compressed into too few shallow pages must be flagged");
assert.ok(flatCodes.includes("requirement-shaped-ia"), "requirement-shaped IA must be flagged");
const nestedComplex = clone(flatComplex);
const child = nestedComplex.ia.sections[0].pages.pop();
nestedComplex.ia.sections[0].pages[0].children.push(child);
assert.equal(reviewSot(nestedComplex).findings.some(item => item.code === "flat-ia-for-complex-product"), false);
assert.equal(reviewSot(valid).findings.some(item => item.code === "flat-ia-for-complex-product"), false);
console.log("[review] PASS complex flat and requirement-shaped IA are advisory findings");

const ceremonial = clone(flatComplex);
for (const section of ceremonial.ia.sections) section.pages[0].children.push(section.pages.pop());
const ceremonialCodes = reviewSot(ceremonial).findings.map(item => item.code);
assert.ok(ceremonialCodes.includes("ceremonial-ia-hierarchy"), "repeating a root-to-one-child branch must not satisfy hierarchy quality");
const overloaded = clone(flatComplex);
overloaded.ia.sections[0].pages[0].refs.push("F3", "F5");
assert.ok(reviewSot(overloaded).findings.some(item => item.code === "catch-all-ia-page" && item.path.includes("P1")));
const nestedTop = clone(ceremonial);
nestedTop.ia.sections[0].pages[0].children[0].type = "top";
assert.ok(reviewSot(nestedTop).findings.some(item => item.code === "nested-top-ia-page" && item.path.includes("P2")));
const taskDerived = clone(ceremonial);
taskDerived.ia.sections[0].pages[0].children[0].children.push({ id: "P9", title: "Task detail", type: "action", surface: "panel", refs: [], children: [] });
taskDerived.ia.sections[1].pages[0].children[0].children.push({ id: "P10", title: "Decision detail", type: "action", surface: "panel", refs: [], children: [] });
assert.equal(reviewSot(taskDerived).findings.some(item => item.code === "shallow-ia-for-complex-product"), false);
assert.equal(reviewSot(taskDerived).findings.some(item => item.code === "ceremonial-ia-hierarchy"), false);
console.log("[review] PASS ceremonial hierarchy, catch-all pages, nested top nodes, and task-derived depth are distinguished");

// Regression: reference-complete data can still have no detailed behavior at all.
const emptyDetails = clone(valid);
emptyDetails.requirements[0].features[0].specs = Array.from({ length: 31 }, (_, i) => ({
  title: `Action ${i + 1}`, desc: "   ", acceptance: []
}));
emptyDetails.ia.sections[0].pages[0].children[0].refs = Array.from({ length: 31 }, (_, i) => `F1:${i}`);
assert.equal(validateSot(emptyDetails).valid, true);
const beforeReview = JSON.stringify(emptyDetails);
for (const purpose of ["current-state", "change"]) {
  const reviewed = reviewSot(emptyDetails, { purpose });
  for (const code of ["missing-spec-description", "missing-spec-acceptance"]) {
    assert.equal(reviewed.findings.filter(f => f.code === code && f.severity === "warning").length, 31, code);
  }
  assert.ok(reviewed.findings.some(f => f.path === "$.requirements[R1].features[F1].specs[F1:30].desc"));
  assert.equal(reviewed.context.purpose, purpose);
  assert.equal(reviewed.assessmentScope, "advisory-content-only");
}
const overview = reviewSot(emptyDetails, { purpose: "overview" });
assert.equal(overview.summary.warnings, 0);
assert.equal(overview.summary.information, 62);
assert.equal(JSON.stringify(emptyDetails), beforeReview, "review must not write context into the SOT");
assert.throws(() => reviewSot(valid, { purpose: "full" }), /unsupported planning purpose/);
console.log("[review] PASS 31 empty specs are visible; overview is informational; SOT is unchanged");

const generic = clone(valid);
const feature = generic.requirements[0].features[0];
for (const sentence of ["사용자가 이 기능을 정상적으로 사용할 수 있다.", "The feature works as expected.", "  "]) {
  feature.acceptance = [{ text: sentence, done: true }];
  feature.specs[0].acceptance = [{ text: sentence, done: true }];
  const findings = reviewSot(generic).findings;
  assert.ok(findings.some(f => f.code === "vague-acceptance"));
  assert.ok(findings.some(f => f.code === "vague-spec-acceptance"));
}
feature.desc = "사용자가 이 기능을 편리하게 이용할 수 있도록 지원한다.";
assert.ok(reviewSot(generic).findings.some(f => f.code === "generic-feature-description"));
feature.desc = "Enables the user to easily use this feature.";
assert.ok(reviewSot(generic).findings.some(f => f.code === "generic-feature-description"));
feature.desc = "Reject expired links and show the reason to the recipient.";
feature.acceptance = [{ text: "An expired token shows the expiry notice without submitting consent.", done: false }];
feature.specs[0] = { title: "Expiry", desc: "Reject expired links.", acceptance: [{ text: "Expired links cannot be submitted.", done: false }] };
assert.equal(reviewSot(generic, { purpose: "change" }).summary.warnings, 0, "concrete short behavior should pass");
console.log("[review] PASS generic KO/EN claims are advisory without penalizing concrete short criteria");

const cli = (...args) => spawnSync(process.execPath, [join(here, "../scripts/review-sot.mjs"), join(here, "fixtures/valid-minimal.sot.json"), ...args], { encoding: "utf8" });
const overviewCli = cli("--purpose", "overview", "--json");
assert.equal(overviewCli.status, 0, overviewCli.stderr);
assert.equal(JSON.parse(overviewCli.stdout).summary.information, 1);
assert.equal(JSON.parse(overviewCli.stdout).context.purpose, "overview");
for (const args of [["--purpose"], ["--purpose", "full"], ["--surprise"], ["--profile"]]) {
  assert.notEqual(cli(...args).status, 0, `must reject ${args.join(" ")}`);
}
console.log("[review] PASS CLI forwards purpose and rejects malformed options");
