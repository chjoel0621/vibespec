#!/usr/bin/env node
import { constants, existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { access } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const skillDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pluginDir = resolve(skillDir, "..", "..");
const required = [
  "SKILL.md",
  "assets/viewer.html",
  "references/sot.schema.json",
  "references/workflows/common.md",
  "scripts/inspect.mjs",
  "scripts/validate-sot.mjs",
  "scripts/embed-sot.mjs"
];

export async function diagnose(workspace = process.cwd()) {
  const target = resolve(workspace);
  const checks = [];
  const check = (name, ok, detail) => checks.push({ name, ok, detail });
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  check("node", nodeMajor >= 18, `Node ${process.versions.node}; VibeSpec requires Node 18+`);
  check("skill-root", existsSync(join(skillDir, "SKILL.md")), skillDir);
  check("plugin-manifest", existsSync(join(pluginDir, ".codex-plugin", "plugin.json")) || existsSync(join(pluginDir, ".claude-plugin", "plugin.json")), pluginDir);
  for (const file of required) check(`bundle:${file}`, existsSync(join(skillDir, file)), join(skillDir, file));

  let writable = false;
  let writeDetail = target;
  const probe = join(target, `.vibespec-doctor-${process.pid}.tmp`);
  try {
    await access(target, constants.R_OK | constants.W_OK);
    writeFileSync(probe, "vibespec doctor\n", { flag: "wx" });
    unlinkSync(probe);
    writable = true;
  } catch (cause) {
    try { if (existsSync(probe)) unlinkSync(probe); } catch {}
    writeDetail = `${target}: ${cause.message}`;
  }
  check("workspace-write", writable, writeDetail);

  const manifestPath = [join(pluginDir, ".codex-plugin", "plugin.json"), join(pluginDir, ".claude-plugin", "plugin.json")].find(existsSync);
  const version = manifestPath ? JSON.parse(readFileSync(manifestPath, "utf8")).version : null;
  return {
    kind: "vibespec-doctor",
    valid: checks.every(item => item.ok),
    version,
    node: process.versions.node,
    skillDir,
    pluginDir,
    workspace: target,
    checks
  };
}

async function main(argv) {
  const json = argv.includes("--json");
  const workspace = argv.find(arg => !arg.startsWith("--")) ?? process.cwd();
  const result = await diagnose(workspace);
  if (json) console.log(JSON.stringify(result, null, 2));
  else {
    console.log(`[doctor] ${result.valid ? "PASS" : "FAIL"} VibeSpec ${result.version ?? "unknown"}`);
    for (const item of result.checks) console.log(`  ${item.ok ? "OK" : "NO"} ${item.name}: ${item.detail}`);
    console.log(`  skill: ${result.skillDir}`);
  }
  if (!result.valid) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main(process.argv.slice(2));
