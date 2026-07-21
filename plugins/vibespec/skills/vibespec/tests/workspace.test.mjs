import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, "fixtures", "tree");
const main = JSON.parse(readFileSync(join(fixtureDir, "main.sot.json"), "utf8"));
const proposed = JSON.parse(readFileSync(join(fixtureDir, "shop.1-2.payment.sot.json"), "utf8"));
proposed.initiative.status = "proposed";
const workspace = mkdtempSync(join(tmpdir(), "vibespec-workspace-"));
const out = join(workspace, "output");
const cli = join(here, "..", "scripts", "workspace.mjs");

try {
  mkdirSync(join(workspace, "initiatives"));
  mkdirSync(join(workspace, "history"));
  writeFileSync(join(workspace, "main.sot.json"), JSON.stringify(main));
  writeFileSync(join(workspace, "initiatives", "1-2-payment.sot.json"), JSON.stringify(proposed));
  // These are deliberately valid SOTs but must never be discovered by a
  // workspace build. They model prior outputs and a before-land snapshot.
  writeFileSync(join(workspace, "history", "main-before-land.sot.json"), JSON.stringify(main));
  mkdirSync(out);
  writeFileSync(join(out, "old-export.sot.json"), JSON.stringify(main));

  const run = spawnSync(process.execPath, [cli, workspace, "--out", out, "--json"], { encoding: "utf8" });
  assert.equal(run.status, 0, `workspace CLI must pass: ${run.stderr}`);
  const summary = JSON.parse(run.stdout);
  assert.deepEqual(summary.documents, ["main.sot.json", "initiatives/1-2-payment.sot.json"], "workspace must ignore history and output SOT snapshots");
  assert.deepEqual(summary.visible, ["payment"], "workspace map must include proposed work for review");
  assert.deepEqual(summary.active, [], "release map must keep proposed work out of the active set");

  const payload = name => {
    const html = readFileSync(join(out, name), "utf8");
    const match = html.match(/id="embedded-sot">([\s\S]*?)<\/script>/);
    assert.ok(match, `${name} must embed a map payload`);
    return JSON.parse(match[1]);
  };
  const workMap = payload("workspace.html");
  const releaseMap = payload("release-map.html");
  for (const name of ["workspace.html", "release-map.html"]) {
    assert.ok(readFileSync(join(out, name), "utf8").includes('data-vibespec-attribution="workspace" href="https://vbspec.com/?ref=workspace"'), `${name} must attribute its create-more link to workspace`);
  }
  assert.equal(workMap.mode, "workspace");
  assert.deepEqual(workMap.scopes.map(s => [s.id, s.parentScopeId]), [["root", null], ["payment", "root"]]);
  assert.equal(releaseMap.mode, "release");
  assert.deepEqual(releaseMap.scopes.map(s => s.id), ["root"], "release map must not embed a proposed initiative");
  console.log("[workspace] PASS canonical layout ignores snapshots and builds review/release maps separately");

  const mainOnly = mkdtempSync(join(tmpdir(), "vibespec-main-only-"));
  try {
    writeFileSync(join(mainOnly, "main.sot.json"), JSON.stringify(main));
    const result = spawnSync(process.execPath, [cli, mainOnly, "--json"], { encoding: "utf8" });
    assert.equal(result.status, 0, "a main-only workspace must be supported before the first initiative");
    assert.deepEqual(JSON.parse(result.stdout).visible, []);
    console.log("[workspace] PASS main-only workspace builds before any initiative exists");
  } finally {
    try { rmSync(mainOnly, { recursive: true, force: true }); } catch {}
  }
} finally {
  try { rmSync(workspace, { recursive: true, force: true }); } catch {}
}
