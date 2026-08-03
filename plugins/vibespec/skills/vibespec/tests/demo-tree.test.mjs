import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateSot } from "../scripts/validate-sot.mjs";
import { reviewSot } from "../scripts/lib/content-review.mjs";
import { validateTree } from "../scripts/lib/tree.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../../../..");
const demoRoot = join(repoRoot, "demo");
const load = name => JSON.parse(readFileSync(join(demoRoot, name), "utf8"));
const profileForDemo = name => name.startsWith("job-board-platform.")
  ? "marketplace"
  : /^(personal-finance-tracker|habit-tracker-app|meal-planning-grocery-app|workout-progress-tracker)\./.test(name)
    ? "consumer"
    : "operations";

const products = [
  {
    name: "meeting-room-booking",
    files: lang => [
      `meeting-room-booking.${lang}.sot.json`,
      `meeting-room-booking.${lang}.1-2.notif.sot.json`
    ]
  },
  {
    name: "flea-market",
    files: lang => [
      `flea-market.${lang}.sot.json`,
      `flea-market.${lang}.1-1.escrow.sot.json`,
      `flea-market.${lang}.1-2.offer.sot.json`
    ]
  }
];

for (const product of products) {
  for (const lang of ["ko", "en"]) {
    const files = product.files(lang);
    const docs = files.map(name => ({ name, sot: load(name) }));
    for (const doc of docs) {
      const result = validateSot(doc.sot);
      assert.equal(result.valid, true, `${doc.name} must validate: ${JSON.stringify(result.errors)}`);
    }
    const tree = validateTree(docs);
    assert.equal(tree.valid, true, `${product.name}/${lang} tree must validate: ${JSON.stringify(tree.errors)}`);
  }
}

for (const lang of ["ko", "en"]) {
  const name = `crm.${lang}.sot.json`;
  const result = validateSot(load(name));
  assert.equal(result.valid, true, `${name} must validate: ${JSON.stringify(result.errors)}`);
}

for (const name of readdirSync(demoRoot).filter(name => name.endsWith(".sot.json"))) {
  const findings = reviewSot(load(name), { profile: profileForDemo(name) }).findings;
  // The catalog predates the semantic IA gate. Keep every established content
  // warning at zero while the flat legacy demos are migrated incrementally.
  const nonIaFindings = findings.filter(finding => ![
    "flat-ia-for-complex-product", "shallow-ia-for-complex-product", "ceremonial-ia-hierarchy",
    "catch-all-ia-page", "nested-top-ia-page", "requirement-shaped-ia"
  ].includes(finding.code));
  assert.equal(nonIaFindings.length, 0, `${name} must not retain advisory content-review warnings: ${JSON.stringify(nonIaFindings)}`);
}

console.log("[demo] PASS demo SOTs, content quality, and parent/Add-on trees validate in ko and en");
