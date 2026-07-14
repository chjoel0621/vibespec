#!/usr/bin/env node
// Build the read-only product map for a tree: the main SOT composed with its
// ACTIVE initiatives (approved-fresh + implemented), grafted at their boundary
// attach points, with composite ids. Prints a summary, or the full map as JSON.
// A map is only built for a validate-tree-clean tree (rebase stale approveds
// first). Usage:
//   node scripts/product-map.mjs <folder | file.sot.json ...>
//   node scripts/product-map.mjs <...> --json
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { collectFiles } from "./validate-tree.mjs";
import { buildProductMap } from "./lib/product-map.mjs";

function printTree(pages, depth, out) {
  for (const p of pages) {
    out.push(`${"  ".repeat(depth + 1)}${p.compositeId}  ${p.title}${p.scope !== "root" ? `  · +${p.scope}` : ""}`);
    printTree(p.children, depth + 1, out);
  }
}

export function printMap(map) {
  if (!map.valid) {
    console.error("[map] FAIL: 제품 지도는 validate-tree를 통과한 트리에서만 만듭니다. 먼저 오류를 해결하세요(stale이면 rebase):");
    map.errors.forEach(e => console.error(`  error ${e.file} ${e.path}: ${e.message}`));
    return;
  }
  console.log(`[map] product ${map.productId} · 본편 + 활성 이니셔티브 ${map.active.length}개`);
  if (map.active.length) console.log(`활성: ${map.active.join(", ")}${map.stale.length ? ` (기준 낡음: ${map.stale.join(", ")})` : ""}`);
  if (map.excluded.length) console.log(`제외: ${map.excluded.map(e => `${e.id}(${e.reason})`).join(", ")}`);
  if (map.attachments.length) console.log(`접점: ${map.attachments.map(a => `${a.initiative}→${a.at}`).join(", ")}`);
  const out = [];
  for (const sec of map.ia) { out.push(`§ ${sec.title}${sec.scope !== "root" ? `  · +${sec.scope}` : ""}`); printTree(sec.pages, 0, out); }
  console.log(out.join("\n"));
}

async function main(argv) {
  const json = argv.includes("--json");
  const paths = argv.filter(a => a !== "--json");
  if (!paths.length) { console.error("Usage: node scripts/product-map.mjs <folder | file.sot.json ...> [--json]"); process.exitCode = 2; return; }
  let files;
  try { files = collectFiles(paths); } catch (cause) { console.error(`[FAIL] ${cause.message}`); process.exitCode = 2; return; }
  const docs = [];
  for (const file of files) {
    try { docs.push({ name: file, sot: JSON.parse(readFileSync(file, "utf8")) }); }
    catch (cause) { console.error(`[FAIL] ${file}: ${cause.message}`); process.exitCode = 1; return; }
  }
  const map = buildProductMap(docs);
  if (json) console.log(JSON.stringify(map, null, 2));
  else printMap(map);
  if (!map.valid) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
