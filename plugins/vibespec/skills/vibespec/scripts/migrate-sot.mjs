#!/usr/bin/env node
// Promote a legacy or current SOT through the exact viewer normalization path.
// Dry-run is default. Usage:
// node scripts/migrate-sot.mjs <input.sot.json> --out <output.sot.json> [--apply] [--json]
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { stableStringify } from "./lib/c14n.mjs";
import { diffReport } from "./lib/diff.mjs";
import { normalizeForMigration } from "./lib/viewer-normalize.mjs";
import { validateSot } from "./validate-sot.mjs";

export function previewMigration(input) {
  const after = normalizeForMigration(input);
  const validation = validateSot(after);
  if (!validation.valid) throw new Error("migration result is invalid: " + validation.errors.map(e => e.path + " " + e.message).join("; "));
  return { after, validation, report: diffReport(input, after) };
}
async function main(argv) {
  const json = argv.includes("--json");
  const apply = argv.includes("--apply");
  const outIndex = argv.indexOf("--out");
  const output = outIndex >= 0 ? argv[outIndex + 1] : null;
  const input = argv.find((arg, index) => !arg.startsWith("--") && !(outIndex >= 0 && index === outIndex + 1));
  if (!input || !output) {
    console.error("Usage: node scripts/migrate-sot.mjs <input.sot.json> --out <output.sot.json> [--apply] [--json]");
    process.exitCode = 2;
    return;
  }
  if (apply && resolve(input) === resolve(output)) {
    console.error("[migrate] FAIL: --out must be a new path; migration never overwrites its input");
    process.exitCode = 2;
    return;
  }
  let result;
  try { result = previewMigration(JSON.parse(readFileSync(input, "utf8"))); }
  catch (cause) { console.error("[migrate] FAIL: " + cause.message); process.exitCode = 1; return; }
  if (json) console.log(JSON.stringify({ validation: result.validation, report: result.report }, null, 2));
  else {
    console.log("[migrate] " + result.report.changes.length + " change(s) · target schema " + result.after.schemaVersion);
    result.report.changes.forEach(change => console.log("  " + change.type + " " + change.path));
  }
  if (apply) {
    writeFileSync(output, stableStringify(result.after) + "\n");
    if (!json) console.log("[migrate] WROTE " + output);
  } else if (!json) console.log("[migrate] dry-run only; pass --apply to write");
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
