import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { diagnose } from "../scripts/doctor.mjs";
import { verifyHostOutput } from "../scripts/verify-host-output.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const skillRoot = join(here, "..");
const tempDir = mkdtempSync(join(tmpdir(), "vibespec-host-runtime-"));

try {
  const doctor = await diagnose(tempDir);
  assert.equal(doctor.valid, true, JSON.stringify(doctor.checks));
  assert.equal(doctor.skillDir, skillRoot);
  assert.ok(doctor.checks.some(item => item.name === "workspace-write" && item.ok));
  console.log("[host-runtime] PASS doctor self-resolves the installed skill and writable workspace");

  const source = join(tempDir, "meeting-room.sot.json");
  const html = join(tempDir, "meeting-room.html");
  writeFileSync(source, readFileSync(join(here, "fixtures", "valid-minimal.sot.json")));
  const embedded = spawnSync(process.execPath, [join(skillRoot, "scripts", "embed-sot.mjs"), join(skillRoot, "assets", "viewer.html"), source, html], { encoding: "utf8" });
  assert.equal(embedded.status, 0, embedded.stderr || embedded.stdout);
  const accepted = verifyHostOutput(source, html, "codex-cli");
  assert.equal(accepted.accepted, true);

  const changed = JSON.parse(readFileSync(source, "utf8"));
  changed.title = "Changed after HTML generation";
  writeFileSync(source, JSON.stringify(changed, null, 2));
  assert.throws(() => verifyHostOutput(source, html, "codex-cli"), /differs from the JSON/);
  console.log("[host-runtime] PASS host output verifier rejects split JSON and HTML artifacts");
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
