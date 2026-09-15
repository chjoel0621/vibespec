#!/usr/bin/env node
// Purpose is review context, never a new SOT field.
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { reviewSot } from "./lib/content-review.mjs";

async function main(argv) {
  let json = false;
  let profile = "operations";
  let purpose = "current-state";
  const files = [];
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--json") json = true;
    else if (argv[index] === "--profile" || argv[index] === "--purpose") {
      const option = argv[index];
      if (!argv[index + 1] || argv[index + 1].startsWith("--")) {
        console.error("[review] missing value for " + option);
        process.exitCode = 2;
        return;
      }
      if (option === "--profile") profile = argv[index + 1];
      else purpose = argv[index + 1];
      index += 1;
    } else if (argv[index].startsWith("--")) {
      console.error("[review] unknown option " + argv[index]);
      process.exitCode = 2;
      return;
    } else files.push(argv[index]);
  }
  if (files.length !== 1) {
    console.error("Usage: node scripts/review-sot.mjs <sot.json> [--profile operations|consumer|marketplace] [--purpose overview|current-state|change] [--json]");
    process.exitCode = 2;
    return;
  }
  try {
    const result = reviewSot(JSON.parse(readFileSync(files[0], "utf8")), { profile, purpose });
    if (json) console.log(JSON.stringify(result, null, 2));
    else {
      console.log("[review] " + result.summary.warnings + " advisory warning(s)");
      console.log("[review] purpose=" + purpose + " · " + result.summary.information + " informational item(s) · content review only; not product approval");
      result.findings.forEach(finding => console.log("  " + finding.severity + " " + finding.code + " " + finding.path + ": " + finding.message));
    }
  } catch (cause) {
    console.error("[review] FAIL: " + cause.message);
    process.exitCode = 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
