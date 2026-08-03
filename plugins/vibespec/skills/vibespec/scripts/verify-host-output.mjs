#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { stableStringify } from "./lib/c14n.mjs";
import { validateSot } from "./validate-sot.mjs";

const hosts = new Set(["claude-code", "cowork", "codex-cli", "codex-desktop"]);

export function verifyHostOutput(sotPath, htmlPath, host) {
  if (!hosts.has(host)) throw new Error(`unsupported host ${JSON.stringify(host)}`);
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
  return {
    kind: "vibespec-host-acceptance",
    host,
    accepted: true,
    checkedAt: new Date().toISOString(),
    sot: sotFile,
    html: htmlFile,
    title: sot.title,
    schemaVersion: sot.schemaVersion
  };
}

function main(argv) {
  const json = argv.includes("--json");
  const hostIndex = argv.indexOf("--host");
  const recordIndex = argv.indexOf("--record");
  const host = hostIndex >= 0 ? argv[hostIndex + 1] : null;
  const excluded = new Set([hostIndex, hostIndex + 1, recordIndex, recordIndex + 1]);
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
