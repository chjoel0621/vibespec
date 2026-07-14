#!/usr/bin/env node
// Pre-flight for routing: classify a file or folder of SOTs and print the
// deterministic facts (kinds, tree validity, active/stale set, next path to
// issue, suggested modes). The skill runs this first, then routes on it.
// Usage:
//   node scripts/inspect.mjs <folder | file.sot.json ...>
//   node scripts/inspect.mjs <...> --json
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { basename } from "node:path";
import { collectFiles } from "./validate-tree.mjs";
import { inspectDocs } from "./lib/inspect.mjs";

export function printInspect(r) {
  console.log(`[inspect] 파일 ${r.files.length}개 · 본편 ${r.hasMain ? "있음" : "없음"} · 이니셔티브 ${r.initiativeCount}개`);
  for (const f of r.files) {
    if (f.kind === "main") console.log(`  main        ${basename(f.name)}  "${f.title ?? ""}"`);
    else if (f.kind === "initiative") console.log(`  initiative  ${basename(f.name)}  id=${f.id} path=${f.path} status=${f.status} parent=${f.parentScopeId}`);
    else console.log(`  unknown     ${basename(f.name)}`);
  }
  if (r.tree) console.log(`트리: ${r.tree.valid ? "valid" : `INVALID(${r.tree.errorCount} errors)`} · product ${r.tree.productId ?? "?"} · 활성 [${r.tree.activeSet.join(", ")}]${r.tree.staleSet.length ? ` · 기준낡음 [${r.tree.staleSet.join(", ")}]` : ""}`);
  if (r.needsRebase) console.log(`⚠ 재기준 필요: ${r.staleInitiatives.join(", ")}`);
  const np = Object.entries(r.nextPath).map(([k, v]) => `${k}→${v}`).join(", ");
  if (np) console.log(`다음 path 발급: ${np}`);
  console.log(`추천 모드: ${r.suggestedModes.join(", ") || "generate"}`);
}

async function main(argv) {
  const json = argv.includes("--json");
  const paths = argv.filter(a => a !== "--json");
  if (!paths.length) { console.error("Usage: node scripts/inspect.mjs <folder | file.sot.json ...> [--json]"); process.exitCode = 2; return; }
  let files;
  try { files = collectFiles(paths); } catch (cause) { console.error(`[FAIL] ${cause.message}`); process.exitCode = 2; return; }
  const docs = [];
  for (const file of files) {
    try { docs.push({ name: file, sot: JSON.parse(readFileSync(file, "utf8")) }); }
    catch (cause) { console.error(`[FAIL] ${file}: ${cause.message}`); process.exitCode = 1; return; }
  }
  const r = inspectDocs(docs);
  if (json) console.log(JSON.stringify(r, null, 2));
  else printInspect(r);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
