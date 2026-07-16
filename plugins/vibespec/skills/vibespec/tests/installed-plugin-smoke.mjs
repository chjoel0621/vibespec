// Host-like package smoke: Codex installs local marketplace plugins into its
// cache. Execute the plugin from a clean copied bundle so no script, asset, or
// relative path can accidentally depend on this source checkout.
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const skillRoot = resolve(here, "..");
const pluginRoot = resolve(skillRoot, "..", "..");
const fixture = join(here, "fixtures", "tree", "main.sot.json");
const work = mkdtempSync(join(tmpdir(), "vibespec-installed-"));

function run(script, args, cwd) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd,
    encoding: "utf8",
    timeout: 20000
  });
  assert.equal(result.status, 0, `${script} failed: ${result.stderr || result.stdout || "unknown error"}`);
  return result.stdout;
}

try {
  // Mirror the relevant cache shape without retaining a link to the source.
  const installedRoot = join(work, "cache", "vibespec", "vibespec", "local");
  cpSync(pluginRoot, installedRoot, { recursive: true });
  const manifest = JSON.parse(readFileSync(join(installedRoot, ".codex-plugin", "plugin.json"), "utf8"));
  const installedSkill = resolve(installedRoot, manifest.skills, "vibespec");
  assert.ok(existsSync(join(installedSkill, "SKILL.md")), "installed skill must resolve from the manifest");

  const product = join(work, "product");
  cpSync(fixture, join(product, "main.sot.json"));
  // Run from the product folder, never the source checkout. This mirrors a
  // user task whose working directory is unrelated to the plugin cache.
  const validate = join(installedSkill, "scripts", "validate-sot.mjs");
  run(validate, [join(product, "main.sot.json")], product);
  const workspace = join(installedSkill, "scripts", "workspace.mjs");
  run(workspace, [product], product);
  assert.ok(existsSync(join(product, "output", "workspace.html")), "installed plugin must produce a workspace map");
  assert.ok(existsSync(join(product, "output", "release-map.html")), "installed plugin must produce a release map");

  // The emitted maps must contain the copied source document, not a reference
  // back into this checkout. A teammate can therefore open the installed output
  // without relying on the plugin's original working tree.
  const output = readFileSync(join(product, "output", "workspace.html"), "utf8");
  assert.match(output, /vibespec-product-map/);
  assert.doesNotMatch(output, /C:\\VibeSpec/i);
  console.log("[installed] PASS cached plugin bundle executes outside the source checkout");
} finally {
  try { rmSync(work, { recursive: true, force: true }); } catch {}
}
