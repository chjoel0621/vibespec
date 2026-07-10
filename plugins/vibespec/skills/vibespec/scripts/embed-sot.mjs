#!/usr/bin/env node
// Embed a SOT JSON into the viewer's <script id="embedded-sot"> tag so the
// resulting HTML opens with that product instead of the demo SEED.
// Usage: node scripts/embed-sot.mjs <viewer.html> <data.sot.json> <out.html>
import { readFileSync, writeFileSync } from "node:fs";

const [viewerPath, sotPath, outPath] = process.argv.slice(2);
if (!viewerPath || !sotPath || !outPath) {
  console.error("Usage: node scripts/embed-sot.mjs <viewer.html> <data.sot.json> <out.html>");
  process.exit(2);
}
const viewer = readFileSync(viewerPath, "utf8");
const sot = JSON.parse(readFileSync(sotPath, "utf8"));
// Escape "<" so a "</script>" inside string values cannot end the tag early.
const payload = JSON.stringify(sot).replace(/</g, "\\u003c");
const tag = '<script type="application/json" id="embedded-sot"></script>';
if (!viewer.includes(tag)) {
  console.error(`[embed] FAIL: empty embedded-sot tag not found in ${viewerPath}`);
  process.exit(1);
}
writeFileSync(outPath, viewer.replace(tag, tag.replace("></script>", `>${payload}</script>`)));
console.log(`[embed] wrote ${outPath} (${sot.title ?? "untitled"}, lang=${sot.lang ?? "ko"})`);
