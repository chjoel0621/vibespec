#!/usr/bin/env node
// Print the sot-c14n-v1 digest of a SOT file — the value an initiative records
// as initiative.parent.digest. Same hash validate-tree recomputes to detect a
// stale parent, so recording this makes the initiative fresh against that parent.
// Usage: node scripts/sot-digest.mjs <parent.sot.json>
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { sotDigest } from "./lib/c14n.mjs";

function main(args) {
  if (args.length !== 1) {
    console.error("Usage: node scripts/sot-digest.mjs <file.sot.json>");
    process.exitCode = 2;
    return;
  }
  try {
    process.stdout.write(sotDigest(JSON.parse(readFileSync(args[0], "utf8"))) + "\n");
  } catch (cause) {
    console.error(`[FAIL] ${args[0]}: ${cause.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
