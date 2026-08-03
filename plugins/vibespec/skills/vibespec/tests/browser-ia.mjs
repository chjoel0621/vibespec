import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const viewer = join(here, "..", "assets", "viewer.html");
const roots = [process.env.PROGRAMFILES, process.env["PROGRAMFILES(X86)"], process.env.LOCALAPPDATA].filter(Boolean);
const browser = [
  ...roots.flatMap(root => [join(root, "Google", "Chrome", "Application", "chrome.exe"), join(root, "Microsoft", "Edge", "Application", "msedge.exe")]),
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"
].find(existsSync);
assert.ok(browser, "Chrome or Edge is required for the IA browser regression test");
assert.ok(existsSync(viewer), "built viewer.html is missing; run npm run build first");

const sot = JSON.parse(readFileSync(join(here, "fixtures", "valid-minimal.sot.json"), "utf8"));
sot.ia.sections[0].pages[0].refs = [];
sot.ia.sections[0].pages[0].children[0].refs = [];
const embedded = JSON.stringify(sot).replace(/</g, "\\u003c");
const source = readFileSync(viewer, "utf8").replace(
  '<script type="application/json" id="embedded-sot"></script>',
  `<script type="application/json" id="embedded-sot">${embedded}</script>`
);
const harness = `<script>
document.querySelector('[data-view="ia"]').click();
const rebuild=document.querySelector('[data-ia-rebuild]');
document.querySelector('[data-selpage="P1"]').click();
const surface=document.querySelector('[data-ia-surface="P1"]');
surface.value='panel';
surface.dispatchEvent(new Event('change',{bubbles:true}));
const p=iaFindPage('P1').page;
document.documentElement.setAttribute('data-ia-smoke',[
  rebuild&&rebuild.textContent.trim(),
  rebuild&&rebuild.title.includes('navigation'),
  p.surface,
  document.querySelector('[data-ia-surface="P1"]')?.value
].join('|'));
</script>`;
const workspace = mkdtempSync(join(tmpdir(), "vibespec-browser-ia-"));
try {
  const page = join(workspace, "ia.html");
  writeFileSync(page, source + harness);
  const result = spawnSync(browser, [
    "--headless=new", "--allow-file-access-from-files", "--no-sandbox", "--disable-gpu",
    "--disable-background-networking", "--disable-extensions", "--no-first-run",
    `--user-data-dir=${join(workspace, "profile")}`, "--virtual-time-budget=1000", "--dump-dom", pathToFileURL(page).href
  ], { encoding: "utf8", timeout: 60000, maxBuffer: 12 * 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr || "headless browser failed");
  const match = result.stdout.match(/data-ia-smoke="([^"]+)"/);
  assert.ok(match, "browser did not emit IA metrics");
  assert.equal(match[1], "Coverage draft|true|panel|panel");
  console.log("[browser] PASS IA labels coverage rebuild honestly and persists surface roles");
} finally {
  try { rmSync(workspace, { recursive: true, force: true }); } catch {}
}
