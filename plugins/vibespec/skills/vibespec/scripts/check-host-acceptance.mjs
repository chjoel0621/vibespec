#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { validateHostEvidence } from "./lib/host-acceptance.mjs";
import { runtimeBundleDigest } from "./lib/runtime-bundle.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const skillRoot = resolve(scriptDir, "..");
const pluginRoot = resolve(skillRoot, "../..");
const repositoryRoot = resolve(pluginRoot, "../..");
const pluginVersion = JSON.parse(readFileSync(join(pluginRoot, ".claude-plugin", "plugin.json"), "utf8")).version;

export function checkHostAcceptance(directory, expectedVersion, expectedPluginDigest = runtimeBundleDigest(pluginRoot)) {
  const evidenceDir = resolve(directory);
  if (!existsSync(evidenceDir)) throw new Error(`missing host acceptance directory: ${evidenceDir}`);
  if (basename(evidenceDir) !== `v${expectedVersion}`) throw new Error(`host acceptance directory must be named v${expectedVersion}`);
  const files = readdirSync(evidenceDir).filter(name => name.endsWith(".json")).sort();
  if (!files.length) throw new Error(`no host acceptance records in ${evidenceDir}`);
  const records = files.map(name => {
    let evidence;
    try {
      evidence = JSON.parse(readFileSync(join(evidenceDir, name), "utf8"));
    } catch (cause) {
      throw new Error(`${name}: invalid JSON: ${cause.message}`);
    }
    try {
      const valid = validateHostEvidence(evidence, expectedVersion);
      if (valid.pluginDigest !== expectedPluginDigest) throw new Error(`pluginDigest does not match the current runtime bundle`);
      return valid;
    } catch (cause) {
      throw new Error(`${name}: ${cause.message}`);
    }
  });
  const families = {
    claude: records.filter(item => item.hostFamily === "claude").map(item => item.host),
    codex: records.filter(item => item.hostFamily === "codex").map(item => item.host)
  };
  if (!families.claude.length) throw new Error("missing Claude-family host acceptance evidence");
  if (!families.codex.length) throw new Error("missing Codex-family host acceptance evidence");
  return { kind: "vibespec-host-acceptance-gate", valid: true, version: expectedVersion, recordCount: records.length, families };
}

function argument(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : null;
}

function main(argv) {
  const json = argv.includes("--json");
  const version = argument(argv, "--version") || pluginVersion;
  const directory = argument(argv, "--dir") || join(repositoryRoot, "acceptance", "hosts", `v${version}`);
  try {
    if (version !== pluginVersion) throw new Error(`requested release ${version} does not match installed plugin ${pluginVersion}`);
    const result = checkHostAcceptance(directory, version);
    if (json) console.log(JSON.stringify(result, null, 2));
    else console.log(`[host-acceptance-gate] PASS v${version}: Claude ${result.families.claude.join(", ")} | Codex ${result.families.codex.join(", ")}`);
  } catch (cause) {
    console.error(`[host-acceptance-gate] FAIL v${version}: ${cause.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main(process.argv.slice(2));
