#!/usr/bin/env node
// Build the navigable, read-only product workspace from the canonical product
// layout. This deliberately does not recursively scan the whole folder: a
// historical snapshot must never become a second main document by accident.
//
//   product/
//     main.sot.json
//     initiatives/*.sot.json
//     history/            (ignored)
//     output/             (written here, ignored)
//
// Usage: node scripts/workspace.mjs <product-folder> [--out <output-folder>] [--json]
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildProductMap } from "./lib/product-map.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const productPath = (root, target) => relative(root, target).replace(/\\/g, "/");

function collectSotFiles(dir) {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return [];
  const files = [];
  const visit = current => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile() && entry.name.endsWith(".sot.json")) files.push(path);
    }
  };
  visit(dir);
  return files.sort();
}

export function collectWorkspaceFiles(root) {
  const main = join(root, "main.sot.json");
  try { if (!statSync(main).isFile()) throw new Error("not a file"); }
  catch { throw new Error(`workspace requires ${main}`); }
  return [main, ...collectSotFiles(join(root, "initiatives"))];
}

export function loadWorkspace(root) {
  return collectWorkspaceFiles(root).map(name => ({ name, sot: JSON.parse(readFileSync(name, "utf8")) }));
}

function writeMapHtml(map, out) {
  const viewer = readFileSync(join(scriptDir, "..", "assets", "viewer.html"), "utf8");
  const tag = '<script type="application/json" id="embedded-sot"></script>';
  const payload = JSON.stringify(map).replace(/</g, "\\u003c");
  const attributedViewer = viewer.replace('data-vibespec-attribution="viewer" href="https://vbspec.com/?ref=viewer"', 'data-vibespec-attribution="workspace" href="https://vbspec.com/?ref=workspace"');
  writeFileSync(out, attributedViewer.replace(tag, tag.replace("></script>", `>${payload}</script>`)));
}

export function buildWorkspace(root, outDir = join(root, "output")) {
  const docs = loadWorkspace(root);
  const workspace = buildProductMap(docs, { mode: "workspace", embedDocs: true });
  const release = buildProductMap(docs, { mode: "release", embedDocs: true });
  if (!workspace.valid || !release.valid) {
    return { valid: false, docs, workspace, release, outDir };
  }
  mkdirSync(outDir, { recursive: true });
  const workspaceHtml = join(outDir, "workspace.html");
  const releaseHtml = join(outDir, "release-map.html");
  writeMapHtml(workspace, workspaceHtml);
  writeMapHtml(release, releaseHtml);
  return { valid: true, docs, workspace, release, outDir, workspaceHtml, releaseHtml };
}

function printFailure(result) {
  const map = result.workspace.valid ? result.release : result.workspace;
  console.error("[workspace] FAIL: 제품 트리가 유효하지 않습니다.");
  (map.errors || []).forEach(e => console.error(`  error ${e.file} ${e.path}: ${e.message}`));
}

async function main(argv) {
  const json = argv.includes("--json");
  const outIdx = argv.indexOf("--out");
  const out = outIdx >= 0 ? argv[outIdx + 1] : null;
  const paths = argv.filter((a, i) => !a.startsWith("--") && !(outIdx >= 0 && i === outIdx + 1));
  if (paths.length !== 1 || (outIdx >= 0 && !out)) {
    console.error("Usage: node scripts/workspace.mjs <product-folder> [--out <output-folder>] [--json]");
    process.exitCode = 2;
    return;
  }
  let result;
  try { result = buildWorkspace(paths[0], out || join(paths[0], "output")); }
  catch (cause) { console.error(`[workspace] FAIL: ${cause.message}`); process.exitCode = 2; return; }
  if (!result.valid) { printFailure(result); process.exitCode = 1; return; }
  const summary = {
    productId: result.workspace.productId,
    documents: result.docs.map(d => productPath(paths[0], d.name)),
    workspace: productPath(paths[0], result.workspaceHtml),
    releaseMap: productPath(paths[0], result.releaseHtml),
    visible: result.workspace.visible,
    active: result.release.active
  };
  if (json) console.log(JSON.stringify(summary, null, 2));
  else {
    console.log(`[workspace] PASS product ${summary.productId} · ${summary.documents.length} SOT file(s)`);
    console.log(`  workspace: ${summary.workspace} (제품 기획 + 작업 추가 기획: ${summary.visible.join(", ") || "없음"})`);
    console.log(`  release:   ${summary.releaseMap} (활성 추가 기획: ${summary.active.join(", ") || "없음"})`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
