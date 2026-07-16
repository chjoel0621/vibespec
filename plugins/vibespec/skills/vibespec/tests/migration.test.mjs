import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { previewMigration } from "../scripts/migrate-sot.mjs";
import { validateSot } from "../scripts/validate-sot.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const valid = JSON.parse(readFileSync(join(here, "fixtures", "valid-minimal.sot.json"), "utf8"));
const clone = value => JSON.parse(JSON.stringify(value));
const legacy = clone(valid);
delete legacy.schemaVersion;
legacy.overview = legacy.prd.oneLiner; delete legacy.prd.oneLiner;
legacy.goals = [legacy.prd.goal]; delete legacy.prd.goal;
legacy.personas = ["Planner"]; delete legacy.prd.targets;
legacy.prd.kpis = [legacy.prd.kpis[0].name];
legacy.prd.scenarios = [legacy.prd.scenarios[0].text];
const result = previewMigration(legacy);
assert.equal(result.after.schemaVersion, "1.0");
assert.equal(result.after.prd.oneLiner, legacy.overview);
assert.equal(validateSot(result.after).valid, true);
console.log("[migrate] PASS legacy fields promote through the viewer normalization path");

const unknown = clone(valid); unknown.schemaVersion = "9.9";
assert.throws(() => previewMigration(unknown), /unsupported schemaVersion/);
console.log("[migrate] PASS unsupported schema versions are never silently reinterpreted");

const wrongRole = clone(valid); wrongRole.schemaVersion = "1.1";
assert.throws(() => previewMigration(wrongRole), /would change explicit schemaVersion/);
console.log("[migrate] PASS malformed explicit versions are never silently role-converted");

const workspace = mkdtempSync(join(tmpdir(), "vibespec-migrate-"));
try {
  const input = join(workspace, "legacy.sot.json");
  const output = join(workspace, "main.sot.json");
  writeFileSync(input, JSON.stringify(legacy));
  const cli = join(here, "..", "scripts", "migrate-sot.mjs");
  const run = args => spawnSync(process.execPath, [cli, input, "--out", output, ...args], { encoding: "utf8" });
  assert.equal(run([]).status, 0, "migration dry-run must pass: " + run([]).stderr);
  assert.equal(existsSync(output), false, "dry-run must not write");
  assert.equal(run(["--apply"]).status, 0, "migration apply must pass: " + run(["--apply"]).stderr);
  assert.equal(validateSot(JSON.parse(readFileSync(output, "utf8"))).valid, true);
  const overwrite = spawnSync(process.execPath, [cli, input, "--out", input, "--apply"], { encoding: "utf8" });
  assert.equal(overwrite.status, 2, "migration must refuse to overwrite its input");
  assert.equal(JSON.parse(readFileSync(input, "utf8")).schemaVersion, undefined, "refused overwrite must preserve the legacy source");
  console.log("[migrate] PASS CLI dry-run preserves disk and --apply writes a validated SOT");
} finally {
  try { rmSync(workspace, { recursive: true, force: true }); } catch {}
}
