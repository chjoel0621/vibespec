#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { stableStringify } from "./lib/c14n.mjs";
import { HOST_ACCEPTANCE_CONTRACT, hostFamily, sha256File, validateHostEvidence } from "./lib/host-acceptance.mjs";
import { runtimeBundleDigest } from "./lib/runtime-bundle.mjs";
import { validateSot } from "./validate-sot.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(scriptDir, "../../..");
const pluginVersion = JSON.parse(readFileSync(join(pluginRoot, ".claude-plugin", "plugin.json"), "utf8")).version;

export function verifyHostOutput(sotPath, htmlPath, host, options = {}) {
  const family = hostFamily(host);
  const sotFile = resolve(sotPath);
  const htmlFile = resolve(htmlPath);
  if (!existsSync(sotFile)) throw new Error(`missing SOT: ${sotFile}`);
  if (!existsSync(htmlFile)) throw new Error(`missing HTML: ${htmlFile}`);
  const sot = JSON.parse(readFileSync(sotFile, "utf8"));
  const validation = validateSot(sot);
  if (!validation.valid) throw new Error(`SOT validation failed: ${validation.errors.map(item => `${item.path} ${item.message}`).join("; ")}`);
  const html = readFileSync(htmlFile, "utf8");
  const match = html.match(/<script[^>]*\bid="embedded-sot"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) throw new Error("HTML has no embedded-sot payload");
  const embedded = JSON.parse(match[1]);
  if (stableStringify(embedded) !== stableStringify(sot)) throw new Error("HTML embedded SOT differs from the JSON file");
  return validateHostEvidence({
    kind: "vibespec-host-acceptance",
    contractVersion: HOST_ACCEPTANCE_CONTRACT,
    pluginVersion,
    pluginDigest: runtimeBundleDigest(pluginRoot),
    host,
    hostFamily: family,
    accepted: true,
    checkedAt: options.checkedAt || new Date().toISOString(),
    artifacts: {
      sot: { file: basename(sotFile), sha256: sha256File(sotFile) },
      html: { file: basename(htmlFile), sha256: sha256File(htmlFile) }
    },
    title: sot.title,
    schemaVersion: sot.schemaVersion
  });
}

function main(argv) {
  const json = argv.includes("--json");
  const hostIndex = argv.indexOf("--host");
  const recordIndex = argv.indexOf("--record");
  const host = hostIndex >= 0 ? argv[hostIndex + 1] : null;
  const excluded = new Set([
    ...(hostIndex >= 0 ? [hostIndex, hostIndex + 1] : []),
    ...(recordIndex >= 0 ? [recordIndex, recordIndex + 1] : [])
  ]);
  const files = argv.filter((arg, index) => !arg.startsWith("--") && !excluded.has(index));
  if (!host || files.length !== 2) {
    console.error("Usage: node scripts/verify-host-output.mjs <sot.json> <viewer.html> --host <claude-code|cowork|codex-cli|codex-desktop> [--record <evidence.json>] [--json]");
    process.exitCode = 2;
    return;
  }
  try {
    const result = verifyHostOutput(files[0], files[1], host);
    if (recordIndex >= 0) {
      const record = resolve(argv[recordIndex + 1]);
      mkdirSync(dirname(record), { recursive: true });
      writeFileSync(record, JSON.stringify(result, null, 2) + "\n");
    }
    if (json) console.log(JSON.stringify(result, null, 2));
    else console.log(`[host-acceptance] PASS ${host}: ${result.title}`);
  } catch (cause) {
    console.error(`[host-acceptance] FAIL ${host}: ${cause.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main(process.argv.slice(2));
