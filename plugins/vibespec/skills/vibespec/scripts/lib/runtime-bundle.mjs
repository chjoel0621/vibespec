import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

export const runtimeBundleEntries = Object.freeze([
  ".claude-plugin/plugin.json",
  ".codex-plugin/plugin.json",
  "LICENSE",
  "README.md",
  "skills/vibespec/SKILL.md",
  "skills/vibespec/agents",
  "skills/vibespec/assets/viewer.html",
  "skills/vibespec/references",
  "skills/vibespec/scripts",
  "skills/vibespec/src/js/00-config.js",
  "skills/vibespec/src/js/05-c14n.js",
  "skills/vibespec/src/js/20-state.js"
]);

function filesUnder(path) {
  if (!statSync(path).isDirectory()) return [path];
  return readdirSync(path, { withFileTypes: true })
    .sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)
    .flatMap(entry => filesUnder(join(path, entry.name)));
}

const textExtensions = new Set([".html", ".js", ".json", ".md", ".mjs", ".txt", ".yaml", ".yml"]);

function canonicalBytes(file) {
  const bytes = readFileSync(file);
  const name = file.split(/[\\/]/).at(-1);
  if (textExtensions.has(extname(file).toLowerCase()) || name === "LICENSE") return Buffer.from(bytes.toString("utf8").replaceAll("\r\n", "\n"));
  return bytes;
}

export function runtimeBundleDigest(pluginRoot) {
  const hash = createHash("sha256");
  const files = runtimeBundleEntries.flatMap(entry => filesUnder(join(pluginRoot, entry)))
    .map(file => ({ file, portablePath: relative(pluginRoot, file).replaceAll("\\", "/") }))
    .sort((a, b) => a.portablePath < b.portablePath ? -1 : a.portablePath > b.portablePath ? 1 : 0);
  for (const { file, portablePath } of files) {
    hash.update(portablePath);
    hash.update("\0");
    hash.update(canonicalBytes(file));
    hash.update("\0");
  }
  return hash.digest("hex");
}
