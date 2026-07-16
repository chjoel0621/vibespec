#!/usr/bin/env node
// Apply a reviewed ID-addressed change plan. Dry-run is the default; only
// --apply writes the target SOT after validation and change-contract checks.
// Usage: node scripts/apply-change-plan.mjs <sot.json> <plan.json> [--apply] [--receipt <receipt.json>] [--json]
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, basename } from "node:path";
import { pathToFileURL } from "node:url";
import { stableStringify } from "./lib/c14n.mjs";
import { applyChangePlan } from "./lib/change-plan.mjs";

function print(result) {
  console.log("[plan] " + result.report.changes.length + " change(s) · " + result.digest.before.slice(0, 19) + "… → " + result.digest.after.slice(0, 19) + "…");
  result.report.changes.forEach(change => console.log("  " + change.type + " " + change.path));
  if (Object.keys(result.report.impact || {}).length) console.log("  impact: " + Object.keys(result.report.impact).join(", "));
}
async function main(argv) {
  let json = false;
  let apply = false;
  let receiptPath = null;
  const paths = [];
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "--json") json = true;
    else if (arg === "--apply") apply = true;
    else if (arg === "--receipt") {
      receiptPath = argv[++index];
      if (!receiptPath || receiptPath.startsWith("--")) {
        console.error("Usage: --receipt requires a receipt JSON path");
        process.exitCode = 2;
        return;
      }
    } else paths.push(arg);
  }
  if (paths.length !== 2) {
    console.error("Usage: node scripts/apply-change-plan.mjs <sot.json> <plan.json> [--apply] [--receipt <receipt.json>] [--json]");
    process.exitCode = 2;
    return;
  }
  if (receiptPath && !apply) {
    console.error("[plan] FAIL: --receipt is only valid with --apply");
    process.exitCode = 2;
    return;
  }
  let result;
  try {
    const planText = readFileSync(paths[1], "utf8");
    const plan = JSON.parse(planText);
    result = applyChangePlan(JSON.parse(readFileSync(paths[0], "utf8")), plan);
    result.planReceipt = receiptPath ? {
      kind: "vibespec-change-receipt-v1",
      status: "applied",
      plan: {
        file: basename(paths[1]),
        sha256: "sha256:" + createHash("sha256").update(planText).digest("hex"),
        baseDigest: plan.baseDigest
      },
      target: { file: basename(paths[0]), digest: result.digest.after },
      changes: result.report.changes.map(change => ({ type: change.type, path: change.path })),
      note: "Applied plans are audit records. Create a new plan for later edits; do not reapply this plan."
    } : null;
  } catch (cause) {
    console.error("[plan] FAIL: " + cause.message);
    process.exitCode = 1;
    return;
  }
  if (json) console.log(JSON.stringify({ report: result.report, validation: result.validation, digest: result.digest }, null, 2));
  else print(result);
  if (apply) {
    writeFileSync(paths[0], stableStringify(result.after) + "\n");
    if (receiptPath) {
      mkdirSync(dirname(receiptPath), { recursive: true });
      writeFileSync(receiptPath, JSON.stringify(result.planReceipt, null, 2) + "\n");
    }
    if (!json) console.log("[plan] APPLIED " + paths[0]);
    if (receiptPath && !json) console.log("[plan] RECEIPT " + receiptPath);
  } else if (!json) console.log("[plan] dry-run only; pass --apply to write");
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
