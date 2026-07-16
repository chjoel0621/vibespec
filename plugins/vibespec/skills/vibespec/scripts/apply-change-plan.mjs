#!/usr/bin/env node
// Apply a reviewed ID-addressed change plan. Dry-run is the default; only
// --apply writes the target SOT after validation and change-contract checks.
// Usage: node scripts/apply-change-plan.mjs <sot.json> <plan.json> [--apply] [--json]
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { stableStringify } from "./lib/c14n.mjs";
import { applyChangePlan } from "./lib/change-plan.mjs";

function print(result) {
  console.log("[plan] " + result.report.changes.length + " change(s) · " + result.digest.before.slice(0, 19) + "… → " + result.digest.after.slice(0, 19) + "…");
  result.report.changes.forEach(change => console.log("  " + change.type + " " + change.path));
  if (Object.keys(result.report.impact || {}).length) console.log("  impact: " + Object.keys(result.report.impact).join(", "));
}
async function main(argv) {
  const json = argv.includes("--json");
  const apply = argv.includes("--apply");
  const paths = argv.filter(arg => arg !== "--json" && arg !== "--apply");
  if (paths.length !== 2) {
    console.error("Usage: node scripts/apply-change-plan.mjs <sot.json> <plan.json> [--apply] [--json]");
    process.exitCode = 2;
    return;
  }
  let result;
  try {
    result = applyChangePlan(JSON.parse(readFileSync(paths[0], "utf8")), JSON.parse(readFileSync(paths[1], "utf8")));
  } catch (cause) {
    console.error("[plan] FAIL: " + cause.message);
    process.exitCode = 1;
    return;
  }
  if (json) console.log(JSON.stringify({ report: result.report, validation: result.validation, digest: result.digest }, null, 2));
  else print(result);
  if (apply) {
    writeFileSync(paths[0], stableStringify(result.after) + "\n");
    if (!json) console.log("[plan] APPLIED " + paths[0]);
  } else if (!json) console.log("[plan] dry-run only; pass --apply to write");
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
