#!/usr/bin/env node
// Validate a product tree: a folder (or explicit file list) holding one 1.0
// main SOT plus its 1.1 initiatives. Checks cross-file invariants that
// validate-sot.mjs cannot (scope existence, cycles, path prefixes, parent
// digest freshness by status, boundary targets + drift, dropped-parent rules).
// Usage:
//   node scripts/validate-tree.mjs <folder>
//   node scripts/validate-tree.mjs <a.sot.json> <b.sot.json> ... [--json]
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { validateTree } from "./lib/tree.mjs";

function collectFiles(args) {
  const files = [];
  for (const arg of args) {
    const st = statSync(arg);
    if (st.isDirectory()) {
      for (const name of readdirSync(arg)) if (name.endsWith(".sot.json")) files.push(join(arg, name));
    } else {
      files.push(arg);
    }
  }
  return files;
}

export function printTreeResult(result, fileCount) {
  const { valid, errors, warnings, info, product } = result;
  console.log(`[${valid ? "PASS" : "FAIL"}] tree: product ${product.productId ?? "?"} · ${fileCount} file(s) · ${product.scopeCount} scope(s)`);
  if (product.activeSet.length) console.log(`활성 이니셔티브: ${product.activeSet.join(", ")}${product.staleSet.length ? ` (기준 낡음: ${product.staleSet.join(", ")})` : ""}`);
  errors.forEach(e => console.error(`  error ${e.file} ${e.path}: ${e.message}`));
  warnings.forEach(w => console.warn(`  warn  ${w.file} ${w.path}: ${w.message}`));
  info.forEach(i => console.log(`  info  ${i.file} ${i.path}: ${i.message}`));
}

async function main(argv) {
  const json = argv.includes("--json");
  const args = argv.filter(a => a !== "--json");
  if (!args.length) {
    console.error("Usage: node scripts/validate-tree.mjs <folder | file.sot.json ...> [--json]");
    process.exitCode = 2;
    return;
  }
  let files;
  try { files = collectFiles(args); }
  catch (cause) { console.error(`[FAIL] ${cause.message}`); process.exitCode = 2; return; }

  const docs = [];
  for (const file of files) {
    try { docs.push({ name: file, sot: JSON.parse(readFileSync(file, "utf8")) }); }
    catch (cause) { console.error(`[FAIL] ${file}: ${cause.message}`); process.exitCode = 1; return; }
  }

  const result = validateTree(docs);
  if (json) console.log(JSON.stringify(result, null, 2));
  else printTreeResult(result, files.length);
  if (!result.valid) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
