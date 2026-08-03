#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { basename, dirname, join, parse, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const skillRoot = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(skillRoot, "..", "..");

const entries = [
  [".claude-plugin/plugin.json"],
  [".codex-plugin/plugin.json"],
  ["LICENSE"],
  ["README.md"],
  ["skills/vibespec/SKILL.md"],
  ["skills/vibespec/agents"],
  ["skills/vibespec/assets/viewer.html"],
  ["skills/vibespec/references"],
  ["skills/vibespec/scripts"],
  ["skills/vibespec/src/js/00-config.js"],
  ["skills/vibespec/src/js/05-c14n.js"],
  ["skills/vibespec/src/js/20-state.js"]
];

function safeOutput(path) {
  const output = resolve(path);
  const root = parse(output).root;
  const namedForPlugin = basename(output).toLowerCase() === "vibespec" || basename(dirname(output)).toLowerCase() === "vibespec";
  if (output === root || output === pluginRoot || output === skillRoot || !namedForPlugin) {
    throw new Error(`refusing unsafe bundle output ${output}; target or its parent must be named vibespec`);
  }
  return output;
}

export function packagePlugin(outputPath = join(skillRoot, ".dist", "vibespec")) {
  const output = safeOutput(outputPath);
  if (existsSync(output)) rmSync(output, { recursive: true, force: true });
  mkdirSync(output, { recursive: true });
  for (const [relative] of entries) {
    const source = join(pluginRoot, relative);
    if (!existsSync(source)) throw new Error(`missing runtime bundle entry ${source}`);
    const destination = join(output, relative);
    mkdirSync(dirname(destination), { recursive: true });
    cpSync(source, destination, { recursive: true });
  }
  return output;
}

function main(argv) {
  try {
    const output = packagePlugin(argv[0]);
    console.log(`[package] wrote minimal plugin bundle: ${output}`);
  } catch (cause) {
    console.error(`[package] FAIL: ${cause.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main(process.argv.slice(2));
