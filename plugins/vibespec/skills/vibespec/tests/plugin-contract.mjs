import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const skillRoot = resolve(here, "..");
const pluginRoot = resolve(skillRoot, "..", "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const readJson = path => JSON.parse(readFileSync(path, "utf8"));
const requireString = (value, label) => assert.ok(typeof value === "string" && value.trim(), `${label} must be a non-empty string`);
const requireOnlyKeys = (value, allowed, label) => {
  const unknown = Object.keys(value).filter(key => !allowed.includes(key));
  assert.deepEqual(unknown, [], `${label} contains unsupported fields: ${unknown.join(", ")}`);
};

const packageJson = readJson(resolve(skillRoot, "package.json"));
const claudePlugin = readJson(resolve(pluginRoot, ".claude-plugin", "plugin.json"));
const codexPlugin = readJson(resolve(pluginRoot, ".codex-plugin", "plugin.json"));
const codexMarketplace = readJson(resolve(repoRoot, ".agents", "plugins", "marketplace.json"));
const claudeMarketplace = readJson(resolve(repoRoot, ".claude-plugin", "marketplace.json"));
const skillMd = readFileSync(resolve(skillRoot, "SKILL.md"), "utf8");
const agentYaml = readFileSync(resolve(skillRoot, "agents", "openai.yaml"), "utf8");

assert.equal(basename(pluginRoot), "vibespec");
assert.match(packageJson.version, /^\d+\.\d+\.\d+$/);
assert.equal(claudePlugin.name, "vibespec");
assert.equal(codexPlugin.name, "vibespec");
requireOnlyKeys(codexPlugin, ["id", "name", "version", "description", "skills", "apps", "mcpServers", "interface", "author", "homepage", "repository", "license", "keywords"], "Codex plugin");
requireOnlyKeys(codexPlugin.author, ["name", "email", "url"], "Codex author");
requireOnlyKeys(codexPlugin.interface, ["displayName", "shortDescription", "longDescription", "developerName", "category", "capabilities", "websiteURL", "privacyPolicyURL", "termsOfServiceURL", "brandColor", "composerIcon", "logo", "logoDark", "screenshots", "defaultPrompt", "default_prompt"], "Codex interface");
assert.equal(claudePlugin.version, packageJson.version);
assert.equal(codexPlugin.version, packageJson.version);
assert.equal(codexPlugin.skills, "./skills/");
assert.ok(existsSync(resolve(pluginRoot, "skills", "vibespec", "SKILL.md")));
requireString(codexPlugin.description, "Codex description");
requireString(codexPlugin.author?.name, "Codex author.name");
for (const field of ["displayName", "shortDescription", "longDescription", "developerName", "category"]) requireString(codexPlugin.interface?.[field], `Codex interface.${field}`);
assert.ok(Array.isArray(codexPlugin.interface.capabilities) && codexPlugin.interface.capabilities.length > 0);
assert.ok(Array.isArray(codexPlugin.interface.defaultPrompt) && codexPlugin.interface.defaultPrompt.length >= 1 && codexPlugin.interface.defaultPrompt.length <= 3);
assert.ok(codexPlugin.interface.defaultPrompt.every(prompt => typeof prompt === "string" && prompt.length <= 128));
assert.match(codexPlugin.interface.brandColor, /^#[0-9A-F]{6}$/i);
assert.match(codexPlugin.interface.websiteURL, /^https:\/\//);

assert.equal(codexMarketplace.name, "vibespec");
requireOnlyKeys(codexMarketplace, ["name", "interface", "plugins"], "Codex marketplace");
assert.equal(codexMarketplace.interface?.displayName, "VibeSpec");
const codexEntry = codexMarketplace.plugins.find(plugin => plugin.name === "vibespec");
assert.ok(codexEntry, "Codex marketplace entry is missing");
requireOnlyKeys(codexEntry, ["name", "source", "policy", "category"], "Codex marketplace entry");
requireOnlyKeys(codexEntry.source, ["source", "path"], "Codex marketplace source");
requireOnlyKeys(codexEntry.policy, ["installation", "authentication", "products"], "Codex marketplace policy");
assert.deepEqual(codexEntry.source, { source: "local", path: "./plugins/vibespec" });
assert.deepEqual(codexEntry.policy, { installation: "AVAILABLE", authentication: "ON_INSTALL" });
assert.equal(codexEntry.category, "Productivity");

assert.equal(claudeMarketplace.name, "vibespec");
assert.equal(claudeMarketplace.plugins.find(plugin => plugin.name === "vibespec")?.source, "./plugins/vibespec");
assert.match(skillMd, /^---\r?\nname: vibespec\r?\ndescription:/);
assert.match(agentYaml, /display_name:\s*"VibeSpec"/);
assert.match(agentYaml, /default_prompt:\s*"[^"]*\$vibespec/);
assert.doesNotMatch(JSON.stringify({ codexPlugin, codexMarketplace }), /\[TODO:/);

console.log(`[plugin] PASS Claude/Codex manifests and marketplaces match version ${packageJson.version}`);
