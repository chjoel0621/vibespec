#!/usr/bin/env node
// Usage: node scripts/query-sot.mjs <sot.json> [--ids R1,F5,F5:0,S2,P8] [--prd problem,kpis] [--json]
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { querySot } from "./lib/sot-query.mjs";

async function main(argv) {
  const json = argv.includes("--json");
  const idsIndex = argv.indexOf("--ids");
  const prdIndex = argv.indexOf("--prd");
  const source = argv.find((arg, index) => !arg.startsWith("--") && index !== idsIndex + 1 && index !== prdIndex + 1);
  const ids = idsIndex >= 0 && argv[idsIndex + 1] ? argv[idsIndex + 1].split(",").map(id => id.trim()).filter(Boolean) : [];
  const prdFields = prdIndex >= 0 && argv[prdIndex + 1] ? argv[prdIndex + 1].split(",").map(field => field.trim()).filter(Boolean) : [];
  if (!source || (!ids.length && !prdFields.length)) {
    console.error("Usage: node scripts/query-sot.mjs <sot.json> [--ids R1,F5,F5:0,S2,P8] [--prd problem,kpis] [--json]");
    process.exitCode = 2;
    return;
  }
  try {
    const result = querySot(JSON.parse(readFileSync(source, "utf8")), ids, prdFields);
    if (json) console.log(JSON.stringify(result, null, 2));
    else console.log("[query] " + result.requested.join(", ") + " · prd " + result.requestedPrdFields.join(", ") + " · features " + result.features.length + " · pages " + result.pages.length + " · digest " + result.baseDigest);
  } catch (cause) {
    console.error("[query] FAIL: " + cause.message);
    process.exitCode = 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
