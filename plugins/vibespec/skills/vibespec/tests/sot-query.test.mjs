import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { querySot } from "../scripts/lib/sot-query.mjs";
import { sotDigest } from "../scripts/lib/c14n.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const sot = JSON.parse(readFileSync(join(here, "fixtures", "valid-minimal.sot.json"), "utf8"));
const byFeature = querySot(sot, ["F1"]);
assert.equal(byFeature.kind, "vibespec-edit-context-v2");
assert.equal(byFeature.baseDigest, sotDigest(sot));
assert.deepEqual(byFeature.features.map(item => item.feature.id), ["F1"]);
assert.deepEqual(byFeature.pages.map(item => item.page.id).sort(), ["P1", "P2"]);
assert.equal(byFeature.transitions.length, 1);
assert.equal(byFeature.kpis.length, 1);
assert.ok(!("prd" in byFeature), "bounded context must not quietly include the whole PRD");
console.log("[query] PASS feature context includes only its graph closure, not the full SOT");

const byPage = querySot(sot, ["P2"]);
assert.deepEqual(byPage.pages.map(item => item.page.id), ["P2"]);
assert.deepEqual(byPage.features.map(item => item.feature.id), ["F1"]);
assert.equal(byPage.transitions.length, 1);
assert.throws(() => querySot(sot, ["F99"]), /unknown feature/);
console.log("[query] PASS page context resolves referenced features and rejects unknown ids");

// Non-page/non-feature edits still receive a bounded context: exactly the
// requested requirement, section, spec owner, and PRD fields — never a PRD
// dump or unrelated requirement/section.
const extended = querySot(sot, ["R1", "S1", "F1:0"], ["problem", "kpis"]);
assert.deepEqual(extended.requirements.map(item => item.id), ["R1"]);
assert.deepEqual(extended.sections.map(item => item.id), ["S1"]);
assert.deepEqual(extended.features.map(item => item.feature.id), ["F1"]);
assert.deepEqual(Object.keys(extended.prd).sort(), ["kpis", "problem"]);
assert.equal(extended.features[0].feature.specs[0].title, "Check references");
assert.throws(() => querySot(sot, [], []), /at least one id or PRD field/);
assert.throws(() => querySot(sot, ["F1:9"]), /unknown feature spec/);
console.log("[query] PASS requirement, section, spec, and selected PRD contexts stay bounded");
