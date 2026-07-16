// Both hosts discover the same skill directory through different manifests.
// This smoke test keeps the packaging contract executable without requiring a
// locally installed Claude or Codex desktop application.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const skillRoot = resolve(here, "..");
const pluginRoot = resolve(skillRoot, "..", "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const readJson = path => JSON.parse(readFileSync(path, "utf8"));
const claude = readJson(resolve(pluginRoot, ".claude-plugin", "plugin.json"));
const codex = readJson(resolve(pluginRoot, ".codex-plugin", "plugin.json"));

assert.equal(basename(pluginRoot), "vibespec");
assert.equal(claude.name, codex.name);
assert.equal(claude.version, codex.version);
assert.equal(codex.skills, "./skills/");
const sharedSkill = resolve(pluginRoot, "skills", "vibespec", "SKILL.md");
assert.equal(sharedSkill, resolve(skillRoot, "SKILL.md"));
assert.ok(existsSync(sharedSkill), "both hosts must resolve the same SKILL.md");

const text = readFileSync(sharedSkill, "utf8");
const scripts = [...text.matchAll(/scripts\/([a-z-]+\.mjs)/g)].map(match => match[1]);
for (const script of new Set(scripts)) assert.ok(existsSync(resolve(skillRoot, "scripts", script)), "SKILL.md references missing script " + script);
assert.ok(existsSync(resolve(skillRoot, "agents", "openai.yaml")), "Codex UI metadata must exist beside the shared skill");
for (const readme of ["README.md", "README.ko.md"]) {
  const docs = readFileSync(resolve(repoRoot, readme), "utf8");
  assert.match(docs, /codex plugin marketplace add/, `${readme} must document marketplace registration`);
  assert.match(docs, /`\/plugins`/, `${readme} must document the supported Codex CLI installer`);
  assert.doesNotMatch(docs, /codex plugin add vibespec@vibespec/, `${readme} must not document the obsolete direct install command`);
}
console.log("[host] PASS Claude and Codex resolve one versioned skill with executable script references");
