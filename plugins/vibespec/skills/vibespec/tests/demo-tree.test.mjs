import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateSot } from "../scripts/validate-sot.mjs";
import { validateTree } from "../scripts/lib/tree.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../../../..");
const demoRoot = join(repoRoot, "demo");
const load = name => JSON.parse(readFileSync(join(demoRoot, name), "utf8"));

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

console.log("[demo] PASS demo SOTs and parent/Add-on trees validate in ko and en");
