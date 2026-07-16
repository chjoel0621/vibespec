#!/usr/bin/env node
// Usage: node scripts/review-sot.mjs <sot.json> [--json]
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { reviewSot } from "./lib/content-review.mjs";

async function main(argv) {
  const json = argv.includes("--json");
  const files = argv.filter(arg => arg !== "--json");
  if (files.length !== 1) {
    console.error("Usage: node scripts/review-sot.mjs <sot.json> [--json]");
    process.exitCode = 2;
    return;
  }
  try {
    const result = reviewSot(JSON.parse(readFileSync(files[0], "utf8")));
    if (json) console.log(JSON.stringify(result, null, 2));
    else {
      console.log("[review] " + result.summary.warnings + " advisory warning(s)");
      result.findings.forEach(finding => console.log("  " + finding.code + " " + finding.path + ": " + finding.message));
    }
  } catch (cause) {
    console.error("[review] FAIL: " + cause.message);
    process.exitCode = 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
