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
const initNode=document.querySelector(".snode.map-init");
const ir=initNode?initNode.getBoundingClientRect():null;
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
  scopes: [...document.querySelectorAll(".map-scope b, .map-scope .map-scope-link")].map(e=>e.textContent),
  // With a scope href the map must be navigable: its nodes and its legend entry
  // link to the document that defines them (without one, they stay plain divs).
  linkedNodes: [...document.querySelectorAll("a.snode.map-linked")].map(e=>e.getAttribute("href")),
  legendLinks: [...document.querySelectorAll(".map-scope-link")].map(e=>e.getAttribute("href")),
  // The increment must be on-screen when the map opens (a wide composite used to
  // push it past the right edge, so the map showed only the main).
  incrementOnScreen: !!ir && ir.x>=0 && ir.right<=window.innerWidth && ir.y>=0 && ir.bottom<=window.innerHeight,
  attachLine: (document.querySelector(".map-attach")||{}).textContent||""
}));
</script>`;

const workspace = mkdtempSync(join(tmpdir(), "vibespec-map-"));
// body: optional JS returning the probe object; defaults to the map-mode harness.
function probe(payload, name, body) {
  const script = body
    ? `<script>document.documentElement.setAttribute("data-probe",JSON.stringify((()=>{${body}})()));</script>`
    : harness;
  const embedded = JSON.stringify(payload).replace(/</g, "\\u003c");
  const page = join(workspace, `${name}.html`);
  writeFileSync(page, viewerHtml.replace(EMPTY_TAG, EMPTY_TAG.replace("></script>", `>${embedded}</script>`)) + script);
  const result = spawnSync(browserPath, [
    "--headless=new", "--allow-file-access-from-files", "--no-sandbox", "--disable-gpu",
    "--no-first-run", "--no-default-browser-check", `--user-data-dir=${join(workspace, "profile")}`,
    "--virtual-time-budget=1500", "--dump-dom", pathToFileURL(page).href
  ], { encoding: "utf8", timeout: 20000, maxBuffer: 8 * 1024 * 1024 });
  assert.equal(result.status, 0, `headless browser failed: ${result.stderr || result.error || "unknown"}`);
  const match = result.stdout.match(/data-probe="([^"]*)"/);
  assert.ok(match, `map probe (${name}) did not emit data-probe`);
  return JSON.parse(match[1].replace(/&quot;/g, String.fromCharCode(34)));
}

try {
  const p = probe(map, "map");
  assert.equal(p.mapHead, true, "map mode must render the map header");
  assert.equal(p.tabsHidden, true, "map mode must hide the editing tabs");
  assert.equal(p.saveHidden, true, "map mode must hide the Save button (read-only)");
  assert.equal(p.grafted, true, "the active initiative's screen must be grafted into the composite");
  assert.deepEqual(p.compositeIds, ["root/P1", "root/P2", "payment/P2"], "composite ids carry provenance");
  assert.deepEqual(p.scopes, ["Shop", "Payment"], "legend lists the main and the active initiative");
  assert.equal(p.titleEditable, false, "map mode: the product title must not be contenteditable");
  assert.equal(p.titleWriteIgnored, true, "map mode: editing the title must not write to SOT (read-only)");
  assert.equal(p.incrementOnScreen, true, "the initiative's screen must be visible when the map opens");
  assert.match(p.attachLine, /Payment|Cart|접점|Attaches/, "the map names where each initiative attaches");
  assert.deepEqual(p.linkedNodes, [], "without scope hrefs the map stays plain (no links)");
  console.log("[browser] PASS product map is read-only, shows the increment on open, and names its attach point");

  // With hrefs the map must be navigable — seeing an increment you cannot open
  // makes the map a dead end.
  const linked = JSON.parse(JSON.stringify(map));
  linked.scopes.forEach(s => { s.href = s.id === "root" ? "../main/" : `../${s.id}/`; });
  const q = probe(linked, "map-linked");
  assert.deepEqual(q.compositeIds, ["root/P1", "root/P2", "payment/P2"], "linking must not change the composite");
  assert.deepEqual(q.linkedNodes, ["../main/", "../main/", "../payment/"], "every node links to the document that defines it");
  assert.deepEqual(q.legendLinks, ["../main/", "../payment/"], "the legend links to each scope's document");
  assert.deepEqual(q.scopes, ["Shop", "Payment"], "linked legend still names the scopes");
  console.log("[browser] PASS a linked map opens each scope's own document (nodes + legend)");

  // With embedded docs the map is navigable on its own (one self-contained file):
  // clicking a node opens that scope's document, READ-ONLY — no editable field, no
  // enabled control, and nothing may reach localStorage (shared with the user's
  // own working SOT) or the undo history.
  const withDocs = buildProductMap([{ name: "main", sot: main }, { name: "pay", sot: payment }], { embedDocs: true });
  assert.ok(withDocs.scopes.every(s => s.sot), "embedDocs must carry every scope's SOT");
  const d = probe(withDocs, "map-docs", `
    localStorage.setItem(LS_KEY, "SENTINEL");
    document.querySelector('[data-open="payment"]').click();
    const stage = document.getElementById("stage");
    const editable = [...stage.querySelectorAll('[contenteditable="true"]')].length;
    const enabled = [...stage.querySelectorAll("button,input,select,textarea")]
      .filter(e => !e.disabled && !e.matches(RO_ALLOW) && !e.closest("[data-ro-ok]")).length;
    SOT.title = "HACKED"; pushHistory("hack"); saveLocal();
    return {
      openedTitle: SOT.title === "HACKED" ? "(in-memory only)" : SOT.title,
      docView: !!stage.querySelector(".map-back"),
      docPrd: stage.className.includes("prd"),
      editableFields: editable,
      enabledControls: enabled,
      historyLen: HISTORY.length,
      localStorageIntact: localStorage.getItem(LS_KEY) === "SENTINEL",
      backToMap: (() => { stage.querySelector("[data-back-to-map]").click();
        return !!document.querySelector(".map-head"); })()
    };
  `);
  assert.equal(d.docView, true, "clicking a node must open that scope's document");
  assert.equal(d.docPrd, true, "the opened document renders its PRD view");
  assert.equal(d.editableFields, 0, "an opened document must have no editable field");
  assert.equal(d.enabledControls, 0, "an opened document must have no enabled editing control");
  assert.equal(d.historyLen, 0, "a read-only document must not create undo history");
  assert.equal(d.localStorageIntact, true, "a map must never write over the user's own working SOT");
  assert.equal(d.backToMap, true, "the back control must return to the map");
  console.log("[browser] PASS an embedded map opens its documents read-only and never persists");

  // The attach-point jump buttons ([data-jump]) are view navigation, not editing.
  // A re-render (language toggle) or returning from an opened doc re-runs the RO
  // hardening; the jump buttons must survive it and still jump. (Regression: the
  // hardening once disabled every non-allowlisted button, killing these.)
  const j = probe(withDocs, "map-jump", `
    const before = [...document.querySelectorAll("[data-jump]")].length;
    rerender();            // what a language toggle does: MAP && !MAPDOC -> renderMap()
    roHarden();            // what the RO MutationObserver does on that re-render
    const jumps = [...document.querySelectorAll("[data-jump]")];
    let flashed = false;
    if (jumps.length) { jumps[0].click(); flashed = !!document.querySelector(".snode.map-flash"); }
    return { before, after: jumps.length, anyDisabled: jumps.some(b => b.disabled), flashed };
  `);
  assert.ok(j.before > 0, "the fixture must have at least one attach-point jump button");
  assert.equal(j.after, j.before, "jump buttons must survive a re-render");
  assert.equal(j.anyDisabled, false, "attach jump buttons must stay enabled after RO re-hardening");
  assert.equal(j.flashed, true, "an enabled jump button must still jump to its increment");
  console.log("[browser] PASS attach-point jump buttons stay live across re-render + RO hardening");
} finally {
  try { rmSync(workspace, { recursive: true, force: true }); } catch {}
}
