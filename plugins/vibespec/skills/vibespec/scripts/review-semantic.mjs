#!/usr/bin/env node
// Usage: node scripts/review-semantic.mjs <sot.json> [--json]
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { reviewSemantic } from "./lib/semantic-engine.mjs";

async function main(argv) {
  const json = argv.includes("--json");
  const files = argv.filter(arg => arg !== "--json");
  if (files.length !== 1) {
    console.error("Usage: node scripts/review-semantic.mjs <sot.json> [--json]");
    process.exitCode = 2;
    return;
  }
  try {
    const result = reviewSemantic(JSON.parse(readFileSync(files[0], "utf8")));
    if (json) console.log(JSON.stringify(result, null, 2));
    else {
      const readiness = result.readiness.measurement || "not-assessed";
      console.log(`[semantic] assessment=${result.assessment.status} measurement=${readiness} findings=${result.findings.length}`);
      result.findings.forEach(item => console.log(`  ${item.severity} ${item.ruleId} ${item.subjectRefs.join(", ")}: ${item.summary}`));
    }
    if (result.readiness.measurement === "blocked") process.exitCode = 1;
  } catch (cause) {
    console.error("[semantic] FAIL: " + cause.message);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));

