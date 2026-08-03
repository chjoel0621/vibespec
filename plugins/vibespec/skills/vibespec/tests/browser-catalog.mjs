import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const skillRoot = join(here, "..");
const repoRoot = join(skillRoot, "..", "..", "..", "..");
const viewer = join(skillRoot, "assets", "viewer.html");
const roots = [process.env.PROGRAMFILES, process.env["PROGRAMFILES(X86)"], process.env.LOCALAPPDATA].filter(Boolean);
const browser = [
  ...roots.flatMap(root => [join(root, "Google", "Chrome", "Application", "chrome.exe"), join(root, "Microsoft", "Edge", "Application", "msedge.exe")]),
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"
].find(existsSync);

assert.ok(browser, "Chrome or Edge is required for the catalog browser regression test");
assert.ok(existsSync(viewer), "built viewer.html is missing; run npm run build first");

const cases = [
  ["asset-management.ko.sot.json", ["화면", "패널", "드로어", "모달"]],
  ["habit-tracker-app.en.sot.json", ["Screen", "Panel", "Drawer", "Modal"]],
  ["job-board-platform.en.sot.json", ["Screen", "Panel", "Drawer", "Modal"]]
];
const workspace = mkdtempSync(join(tmpdir(), "vibespec-browser-catalog-"));

try {
  for (const [name, roles] of cases) {
    const sot = JSON.parse(readFileSync(join(repoRoot, "demo", name), "utf8"));
    const embedded = JSON.stringify(sot).replace(/</g, "\\u003c");
    const harness = `<script>
document.querySelector('[data-view="ia"]').click();
const nodes=[...document.querySelectorAll('[data-selpage]')];
const labels=[...document.querySelectorAll('[data-selpage] .stype')].map(el=>el.textContent.trim());
const roles=${JSON.stringify(roles)};
const visible=nodes.every(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0;});
document.documentElement.setAttribute('data-catalog-smoke',[nodes.length,visible,roles.every(role=>labels.includes(role))].join('|'));
</script>`;
    const source = readFileSync(viewer, "utf8")
      .replace('<script type="application/json" id="embedded-sot"></script>', `<script type="application/json" id="embedded-sot">${embedded}</script>`)
      + harness;
    const page = join(workspace, name.replace(/\.json$/, ".html"));
    writeFileSync(page, source);
    const result = spawnSync(browser, [
      "--headless=new", "--allow-file-access-from-files", "--no-sandbox", "--disable-gpu",
      "--disable-background-networking", "--disable-extensions", "--no-first-run",
      `--user-data-dir=${join(workspace, `profile-${name}`)}`, "--virtual-time-budget=1000", "--dump-dom", pathToFileURL(page).href
    ], { encoding: "utf8", timeout: 60000, maxBuffer: 12 * 1024 * 1024 });
    assert.equal(result.status, 0, result.stderr || `${name} browser render failed`);
    const match = result.stdout.match(/data-catalog-smoke="([^"]+)"/);
    assert.ok(match, `${name} did not emit catalog render metrics`);
    assert.equal(match[1], "21|true|true", `${name} must render 21 visible typed IA nodes`);
  }
  console.log("[browser] PASS operations, consumer, and marketplace catalog IA render 21 typed task surfaces");
} finally {
  try { rmSync(workspace, { recursive: true, force: true }); } catch {}
}
