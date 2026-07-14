#!/usr/bin/env node
// Build the read-only product map for a tree: the main SOT composed with its
// ACTIVE initiatives (approved-fresh + implemented), grafted at their boundary
// attach points, with composite ids. Prints a summary, or the full map as JSON.
// A map is only built for a validate-tree-clean tree (rebase stale approveds
// first). Usage:
//   node scripts/product-map.mjs <folder | file.sot.json ...>
//   node scripts/product-map.mjs <...> --json
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { collectFiles } from "./validate-tree.mjs";
import { buildProductMap } from "./lib/product-map.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));

// Embed a built map into a copy of the viewer, which renders it read-only.
function writeMapHtml(map, out) {
  const viewer = readFileSync(join(scriptDir, "..", "assets", "viewer.html"), "utf8");
  const tag = '<script type="application/json" id="embedded-sot"></script>';
  const payload = JSON.stringify(map).replace(/</g, "\\u003c");
  writeFileSync(out, viewer.replace(tag, tag.replace("></script>", `>${payload}</script>`)));
}

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
  const htmlIdx = argv.indexOf("--html");
  const htmlOut = htmlIdx >= 0 ? argv[htmlIdx + 1] : null;
  // --link <scopeId>=<url> (repeatable): give a scope a link to its own document
  // so the map is navigable (click an increment → open the initiative that defines it).
  const links = {};
  const linkValueIdx = new Set();
  argv.forEach((a, i) => {
    if (a === "--link" && argv[i + 1]) {
      linkValueIdx.add(i + 1);
      const eq = argv[i + 1].indexOf("=");
      if (eq > 0) links[argv[i + 1].slice(0, eq)] = argv[i + 1].slice(eq + 1);
    }
  });
  const paths = argv.filter((a, i) => !a.startsWith("--") && !(htmlIdx >= 0 && i === htmlIdx + 1) && !linkValueIdx.has(i));
  if (!paths.length) { console.error("Usage: node scripts/product-map.mjs <folder | file.sot.json ...> [--json] [--html <out.html>] [--link <scopeId>=<url> ...]"); process.exitCode = 2; return; }
  let files;
  try { files = collectFiles(paths); } catch (cause) { console.error(`[FAIL] ${cause.message}`); process.exitCode = 2; return; }
  const docs = [];
  for (const file of files) {
    try { docs.push({ name: file, sot: JSON.parse(readFileSync(file, "utf8")) }); }
    catch (cause) { console.error(`[FAIL] ${file}: ${cause.message}`); process.exitCode = 1; return; }
  }
  // The HTML map embeds each scope's document so a node can be opened from the
  // map itself (one self-contained file). --link points at separate pages instead
  // (a deployed site); --embed-docs forces embedding into --json output too.
  const embedDocs = argv.includes("--embed-docs") || (!!htmlOut && !Object.keys(links).length);
  const map = buildProductMap(docs, { embedDocs });
  if (map.valid && map.scopes) map.scopes.forEach(s => { if (links[s.id]) s.href = links[s.id]; });
  if (json) console.log(JSON.stringify(map, null, 2));
  else printMap(map);
  if (map.valid && htmlOut) {
    writeMapHtml(map, htmlOut);
    if (!json) console.log(`\n[map] 읽기전용 지도 HTML: ${htmlOut}${embedDocs ? ` (${map.scopes.length}개 문서 내장 — 노드를 눌러 원문 열람)` : ""}`);
  }
  if (!map.valid) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
