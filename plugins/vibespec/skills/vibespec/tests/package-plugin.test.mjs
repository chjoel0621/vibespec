import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { packagePlugin } from "../package-plugin.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const temp = mkdtempSync(join(tmpdir(), "vibespec-package-"));
const bundle = join(temp, "vibespec");

function run(script, args, cwd) {
  const result = spawnSync(process.execPath, [script, ...args], { cwd, encoding: "utf8", timeout: 20000 });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout;
}

try {
  packagePlugin(bundle);
  const skill = join(bundle, "skills", "vibespec");
  for (const path of [
    ".codex-plugin/plugin.json",
    ".claude-plugin/plugin.json",
    "skills/vibespec/SKILL.md",
    "skills/vibespec/assets/viewer.html",
    "skills/vibespec/references/workflows/common.md",
    "skills/vibespec/references/semantic-assurance.md",
    "skills/vibespec/scripts/doctor.mjs",
    "skills/vibespec/scripts/review-semantic.mjs",
    "skills/vibespec/src/js/00-config.js",
    "skills/vibespec/src/js/05-c14n.js",
    "skills/vibespec/src/js/20-state.js"
  ]) assert.ok(existsSync(join(bundle, path)), `bundle missing ${path}`);
  for (const path of ["skills/vibespec/tests", "skills/vibespec/.build", "skills/vibespec/package.json", "skills/vibespec/build.mjs", "skills/vibespec/src/styles.css"]) {
    assert.equal(existsSync(join(bundle, path)), false, `development artifact leaked into bundle: ${path}`);
  }
  assert.deepEqual(readdirSync(join(skill, "src", "js")).sort(), ["00-config.js", "05-c14n.js", "20-state.js"]);

  const product = join(temp, "product");
  mkdirSync(product, { recursive: true });
  cpSync(join(here, "fixtures", "tree", "main.sot.json"), join(product, "main.sot.json"));
  run(join(skill, "scripts", "doctor.mjs"), [product, "--json"], product);
  run(join(skill, "scripts", "validate-sot.mjs"), [join(product, "main.sot.json")], product);
  run(join(skill, "scripts", "review-semantic.mjs"), [join(product, "main.sot.json"), "--json"], product);
  run(join(skill, "scripts", "workspace.mjs"), [product], product);
  run(join(skill, "scripts", "migrate-sot.mjs"), [join(product, "main.sot.json"), "--out", join(product, "migrated.sot.json")], product);
  console.log("[package] PASS minimal bundle excludes development files and retains every runtime dependency");
} finally {
  rmSync(temp, { recursive: true, force: true });
}
