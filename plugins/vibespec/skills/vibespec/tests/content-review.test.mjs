import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { reviewSot } from "../scripts/lib/content-review.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const valid = JSON.parse(readFileSync(join(here, "fixtures", "valid-minimal.sot.json"), "utf8"));
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
