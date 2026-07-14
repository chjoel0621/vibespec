// Headless regression for the read-only product-map viewer mode. A map payload
// (kind: "vibespec-product-map") renders a composite, read-only overview; a
// normal SOT is untouched (proven by the other browser tests).
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildProductMap } from "../scripts/lib/product-map.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const viewer = join(here, "..", "assets", "viewer.html");

function findBrowser() {
  const roots = [process.env.PROGRAMFILES, process.env["PROGRAMFILES(X86)"], process.env.LOCALAPPDATA].filter(Boolean);
  return [
    ...roots.flatMap(root => [join(root, "Google", "Chrome", "Application", "chrome.exe"), join(root, "Microsoft", "Edge", "Application", "msedge.exe")]),
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/microsoft-edge"
  ].find(existsSync);
}
const browserPath = findBrowser();
assert.ok(browserPath, "Chrome or Edge is required for the product-map browser regression test");
assert.ok(existsSync(viewer), "built viewer.html is missing; run npm run build first");

const viewerHtml = readFileSync(viewer, "utf8");
const EMPTY_TAG = '<script type="application/json" id="embedded-sot"></script>';
const treeDir = join(here, "fixtures", "tree");
const main = JSON.parse(readFileSync(join(treeDir, "main.sot.json"), "utf8"));
const payment = JSON.parse(readFileSync(join(treeDir, "shop.1-2.payment.sot.json"), "utf8"));
const map = buildProductMap([{ name: "main", sot: main }, { name: "pay", sot: payment }]);

const harness = `<script>
const pt=document.getElementById("prodTitle");
const before=pt.firstChild?pt.firstChild.textContent:"";
// Try to edit the (read-only) title: simulate typing + input event.
if(pt.firstChild) pt.firstChild.textContent="HACKED";
pt.dispatchEvent(new Event("input",{bubbles:true}));
document.documentElement.setAttribute("data-probe",JSON.stringify({
  mapHead: !!document.querySelector(".map-head"),
  tabsHidden: !!document.querySelector(".tabs") && getComputedStyle(document.querySelector(".tabs")).display==="none",
  saveHidden: getComputedStyle(document.getElementById("saveBtn")).display==="none",
  titleEditable: pt.isContentEditable,
  titleWriteIgnored: (typeof SOT==="undefined") || !SOT || SOT.title!=="HACKED",
  grafted: [...document.querySelectorAll(".snode.map-init .stitle")].some(e=>/Pay/.test(e.textContent)),
  compositeIds: [...document.querySelectorAll(".sitemap .stype")].map(e=>e.textContent).filter(x=>x.includes("/")),
  scopes: [...document.querySelectorAll(".map-scope b")].map(e=>e.textContent)
}));
</script>`;

const workspace = mkdtempSync(join(tmpdir(), "vibespec-map-"));
try {
  const embedded = JSON.stringify(map).replace(/</g, "\\u003c");
  const page = join(workspace, "map.html");
  writeFileSync(page, viewerHtml.replace(EMPTY_TAG, EMPTY_TAG.replace("></script>", `>${embedded}</script>`)) + harness);
  const result = spawnSync(browserPath, [
    "--headless=new", "--allow-file-access-from-files", "--no-sandbox", "--disable-gpu",
    "--no-first-run", "--no-default-browser-check", `--user-data-dir=${join(workspace, "profile")}`,
    "--virtual-time-budget=1500", "--dump-dom", pathToFileURL(page).href
  ], { encoding: "utf8", timeout: 20000, maxBuffer: 8 * 1024 * 1024 });
  assert.equal(result.status, 0, `headless browser failed: ${result.stderr || result.error || "unknown"}`);
  const match = result.stdout.match(/data-probe="([^"]*)"/);
  assert.ok(match, "map probe did not emit data-probe");
  const p = JSON.parse(match[1].replace(/&quot;/g, String.fromCharCode(34)));
  assert.equal(p.mapHead, true, "map mode must render the map header");
  assert.equal(p.tabsHidden, true, "map mode must hide the editing tabs");
  assert.equal(p.saveHidden, true, "map mode must hide the Save button (read-only)");
  assert.equal(p.grafted, true, "the active initiative's screen must be grafted into the composite");
  assert.deepEqual(p.compositeIds, ["root/P1", "root/P2", "payment/P2"], "composite ids carry provenance");
  assert.deepEqual(p.scopes, ["Shop", "Payment"], "legend lists the main and the active initiative");
  assert.equal(p.titleEditable, false, "map mode: the product title must not be contenteditable");
  assert.equal(p.titleWriteIgnored, true, "map mode: editing the title must not write to SOT (read-only)");
  console.log("[browser] PASS product map is read-only (composite + non-editable title)");
} finally {
  try { rmSync(workspace, { recursive: true, force: true }); } catch {}
}
