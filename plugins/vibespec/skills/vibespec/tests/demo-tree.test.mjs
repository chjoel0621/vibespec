import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { validateSot } from "../scripts/validate-sot.mjs";
import { reviewSot } from "../scripts/lib/content-review.mjs";
import { validateTree } from "../scripts/lib/tree.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../../../..");
const demoRoot = join(repoRoot, "demo");
const { deepenSot } = await import(pathToFileURL(join(repoRoot, "tools", "deepen-sot.mjs")).href);
const load = name => JSON.parse(readFileSync(join(demoRoot, name), "utf8"));
const demoFiles = readdirSync(demoRoot).filter(name => name.endsWith(".sot.json"));
const flattenPages = (pages, depth = 1) => (pages || []).flatMap(page => [
  { page, depth },
  ...flattenPages(page.children, depth + 1)
]);
const profileForDemo = name => name.startsWith("job-board-platform.") || name.startsWith("flea-market.")
  ? "marketplace"
  : /^(personal-finance-tracker|habit-tracker-app|meal-planning-grocery-app|workout-progress-tracker)\./.test(name)
    ? "consumer"
    : "operations";
const isGeneratedTemplate = name => !["crm.", "flea-market.", "meeting-room-booking."]
  .some(prefix => name.startsWith(prefix));
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

for (const name of demoFiles) {
  const sot = load(name);
  const validation = validateSot(sot);
  assert.equal(validation.valid, true, `${name} must validate: ${JSON.stringify(validation.errors)}`);
  const findings = reviewSot(sot, { profile: profileForDemo(name) }).findings;
  assert.equal(findings.length, 0, `${name} must pass content review without warnings: ${JSON.stringify(findings)}`);
  const features = (sot.requirements || []).flatMap(requirement => requirement.features || []);
  const specs = features.flatMap(feature => feature.specs || []);
  if (isGeneratedTemplate(name) && !sot.initiative && features.length === 12 && specs.length === 24) {
    const pages = (sot.ia?.sections || []).flatMap(section => flattenPages(section.pages));
    const pageIds = new Set(pages.map(({ page }) => page.id));
    assert.ok(pages.length > features.length, `${name} template IA must expose task surfaces beyond its feature count`);
    assert.ok(Math.max(0, ...pages.map(({ depth }) => depth)) >= 3, `${name} template IA must reach navigation depth 3`);
    assert.ok(pages.every(({ page }) => page.surface), `${name} template IA must declare every page surface`);
    assert.ok(Array.from({ length: 10 }, (_, index) => `P${index + 1}`).every(id => pageIds.has(id)), `${name} must retain the original P1-P10 stable ids`);
    assert.deepEqual(deepenSot(sot, { profile: profileForDemo(name), iaOnly: true }), sot, `${name} task-derived IA refresh must be idempotent`);
  }
}

const graphShape = sot => ({
  requirements: (sot.requirements || []).map(requirement => ({
    id: requirement.id,
    features: (requirement.features || []).map(feature => ({ id: feature.id, specs: (feature.specs || []).length }))
  })),
  ia: (sot.ia?.sections || []).map(section => ({
    id: section.id,
    pages: flattenPages(section.pages).map(({ page, depth }) => ({ id: page.id, depth, type: page.type, surface: page.surface, refs: page.refs || [] }))
  })),
  flow: {
    start: sot.flow?.start,
    transitions: (sot.flow?.transitions || []).map(transition => ({
      from: transition.from,
      to: transition.to,
      trigger: transition.ref || (Object.hasOwn(transition, "label") ? "<label>" : "<none>")
    }))
  }
});
const demoFileSet = new Set(demoFiles);
for (const koName of demoFiles.filter(name => name.includes(".ko."))) {
  const enName = koName.replace(".ko.", ".en.");
  assert.ok(demoFileSet.has(enName), `${koName} must have an English counterpart`);
  assert.deepEqual(graphShape(load(koName)), graphShape(load(enName)), `${koName} and ${enName} must share one graph structure`);
}

console.log("[demo] PASS demo SOTs, content quality, and parent/Add-on trees validate in ko and en");
