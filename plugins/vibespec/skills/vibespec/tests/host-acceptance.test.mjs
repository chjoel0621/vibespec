import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { checkHostAcceptance } from "../scripts/check-host-acceptance.mjs";
import { verifyHostOutput } from "../scripts/verify-host-output.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const skillRoot = join(here, "..");
const tempDir = mkdtempSync(join(tmpdir(), "vibespec-host-acceptance-"));
const pluginVersion = JSON.parse(readFileSync(join(skillRoot, "..", "..", ".claude-plugin", "plugin.json"), "utf8")).version;
const nextPatchVersion = pluginVersion.replace(/(\d+)$/, value => String(Number(value) + 1));

function createOutput(name) {
  const sotPath = join(tempDir, `${name}.sot.json`);
  const htmlPath = join(tempDir, `${name}.html`);
  writeFileSync(sotPath, readFileSync(join(here, "fixtures", "valid-minimal.sot.json")));
  const embedded = spawnSync(process.execPath, [join(skillRoot, "scripts", "embed-sot.mjs"), join(skillRoot, "assets", "viewer.html"), sotPath, htmlPath], { encoding: "utf8" });
  assert.equal(embedded.status, 0, embedded.stderr || embedded.stdout);
  return { sotPath, htmlPath };
}

function writeEvidence(dir, name, evidence) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${name}.json`), JSON.stringify(evidence, null, 2));
}

try {
  const output = createOutput("meeting-room");
  const claude = verifyHostOutput(output.sotPath, output.htmlPath, "claude-code", { checkedAt: "2026-08-10T00:00:00.000Z" });
  assert.equal(claude.contractVersion, "host-acceptance-v1");
  assert.equal(claude.pluginVersion, pluginVersion);
  assert.match(claude.pluginDigest, /^[a-f0-9]{64}$/);
  assert.equal(claude.hostFamily, "claude");
  assert.equal(claude.artifacts.sot.file, "meeting-room.sot.json");
  assert.match(claude.artifacts.sot.sha256, /^[a-f0-9]{64}$/);
  assert.match(claude.artifacts.html.sha256, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(claude).includes(tempDir), false, "portable evidence must not expose its source directory");
  assert.equal(JSON.stringify(claude).includes("\\"), false, "portable evidence must not contain Windows path separators");
  console.log("[host-acceptance] PASS verifier emits versioned, hashed, portable evidence");

  const codex = verifyHostOutput(output.sotPath, output.htmlPath, "codex-desktop", { checkedAt: "2026-08-10T00:01:00.000Z" });
  const validDir = join(tempDir, "valid", `v${pluginVersion}`);
  writeEvidence(validDir, "claude-code", claude);
  writeEvidence(validDir, "codex-desktop", codex);
  const accepted = checkHostAcceptance(validDir, pluginVersion);
  assert.equal(accepted.valid, true);
  assert.deepEqual(accepted.families, { claude: ["claude-code"], codex: ["codex-desktop"] });
  console.log("[host-acceptance] PASS one Claude-family and one Codex-family record satisfy the release gate");

  const missingDir = join(tempDir, "missing", `v${pluginVersion}`);
  writeEvidence(missingDir, "claude-code", claude);
  assert.throws(() => checkHostAcceptance(missingDir, pluginVersion), /missing Codex-family/i);
  console.log("[host-acceptance] PASS release gate rejects a missing host family");

  const mismatchDir = join(tempDir, "mismatch", `v${nextPatchVersion}`);
  writeEvidence(mismatchDir, "claude-code", claude);
  writeEvidence(mismatchDir, "codex-desktop", codex);
  assert.throws(() => checkHostAcceptance(mismatchDir, nextPatchVersion), /pluginVersion/i);
  console.log("[host-acceptance] PASS release gate rejects evidence from another plugin version");

  assert.throws(() => checkHostAcceptance(validDir, pluginVersion, "0".repeat(64)), /pluginDigest/);
  console.log("[host-acceptance] PASS release gate rejects evidence from different runtime bytes");

  const privateDir = join(tempDir, "private", `v${pluginVersion}`);
  const privatePath = ["C:", "Users", "someone", "meeting-room.sot.json"].join("\\");
  writeEvidence(privateDir, "claude-code", { ...claude, title: privatePath });
  writeEvidence(privateDir, "codex-desktop", codex);
  assert.throws(() => checkHostAcceptance(privateDir, pluginVersion), /absolute local path/i);
  console.log("[host-acceptance] PASS release gate rejects private or non-contract path fields");

  const cli = spawnSync(process.execPath, [join(skillRoot, "scripts", "check-host-acceptance.mjs"), "--version", pluginVersion, "--dir", validDir, "--json"], { encoding: "utf8" });
  assert.equal(cli.status, 0, cli.stderr || cli.stdout);
  assert.equal(JSON.parse(cli.stdout).valid, true);
  console.log("[host-acceptance] PASS release gate CLI validates the committed evidence directory");

  const wrongRelease = spawnSync(process.execPath, [join(skillRoot, "scripts", "check-host-acceptance.mjs"), "--version", nextPatchVersion, "--dir", mismatchDir], { encoding: "utf8" });
  assert.equal(wrongRelease.status, 1);
  assert.match(wrongRelease.stderr, /does not match installed plugin/);
  console.log("[host-acceptance] PASS release gate CLI binds evidence to the installed plugin version");
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
