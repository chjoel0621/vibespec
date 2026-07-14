// Headless regression for the adaptive viewer: an initiative (SOT 1.1) document
// renders the initiative band; a plain (1.0) document hides it. Grows as the
// activation adds PRD section gating and read-only boundary stubs.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const viewer = join(here, "..", "assets", "viewer.html");

function findBrowser() {
  const roots = [process.env.PROGRAMFILES, process.env["PROGRAMFILES(X86)"], process.env.LOCALAPPDATA].filter(Boolean);
  const candidates = [
    ...roots.flatMap(root => [join(root, "Google", "Chrome", "Application", "chrome.exe"), join(root, "Microsoft", "Edge", "Application", "msedge.exe")]),
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/microsoft-edge"
  ];
  return candidates.find(existsSync);
}

const browserPath = findBrowser();
assert.ok(browserPath, "Chrome or Edge is required for the initiative browser regression test");
assert.ok(existsSync(viewer), "built viewer.html is missing; run npm run build first");

const viewerHtml = readFileSync(viewer, "utf8");
const EMPTY_TAG = '<script type="application/json" id="embedded-sot"></script>';

// Reads document state after boot via a probe appended to the page. Returns the
// parsed `data-probe` payload the harness stamps on <html>. `windowSize` sets
// the headless viewport (e.g. "430,844") for responsive checks.
function probe(sot, harness, windowSize) {
  const workspace = mkdtempSync(join(tmpdir(), "vibespec-init-"));
  try {
    const embedded = JSON.stringify(sot).replace(/</g, "\\u003c");
    const page = join(workspace, "probe.html");
    writeFileSync(page, viewerHtml.replace(EMPTY_TAG, EMPTY_TAG.replace("></script>", `>${embedded}</script>`)) + harness);
    const result = spawnSync(browserPath, [
      "--headless=new", "--allow-file-access-from-files", "--no-sandbox", "--disable-gpu",
      "--no-first-run", "--no-default-browser-check", `--user-data-dir=${join(workspace, "profile")}`,
      ...(windowSize ? [`--window-size=${windowSize}`] : []),
      "--virtual-time-budget=1500", "--dump-dom", pathToFileURL(page).href
    ], { encoding: "utf8", timeout: 20000, maxBuffer: 8 * 1024 * 1024 });
    assert.equal(result.status, 0, `headless browser failed: ${result.stderr || result.error || "unknown"}`);
    const match = result.stdout.match(/data-probe="([^"]*)"/);
    assert.ok(match, "probe did not emit data-probe");
    return match[1];
  } finally {
    try { rmSync(workspace, { recursive: true, force: true }); } catch {}
  }
}

const BAND_HARNESS = `<script>
const b=document.getElementById("initBand");
const g=id=>(document.getElementById(id)||{}).textContent||"";
document.documentElement.setAttribute("data-probe",[b&&b.hidden?"hidden":"shown",g("ibName"),g("ibParent"),g("ibStatusLabel"),(document.getElementById("ibDot")||{}).className||""].join("|"));
</script>`;

const initiative = JSON.parse(readFileSync(join(here, "fixtures", "valid-initiative-1.1.sot.json"), "utf8"));
const plain = JSON.parse(readFileSync(join(here, "fixtures", "valid-minimal.sot.json"), "utf8"));

const [state, name, parent, status, dotClass] = probe(initiative, BAND_HARNESS).split("|");
assert.equal(state, "shown", "initiative document must show the band");
assert.equal(name, "payment", "band must show the initiative id");
assert.match(parent, /main document|본편/, "band must name the parent scope");
assert.match(status, /Proposed|제안/, "band must show the status");
assert.ok(dotClass.includes("proposed"), "status dot must reflect the status");
console.log("[browser] PASS initiative band shows id, parent, and status for a 1.1 document");

const plainState = probe(plain, BAND_HARNESS).split("|")[0];
assert.equal(plainState, "hidden", "a plain 1.0 document must hide the initiative band");
console.log("[browser] PASS initiative band is hidden for a plain 1.0 document");

// Unbounded slugs must not overflow the band at mobile width: name/parent
// truncate (band scrollWidth == clientWidth) and the status stays on-screen.
const longSlugs = JSON.parse(JSON.stringify(initiative));
longSlugs.initiative.productId = "acme-shopping-platform-north-america-region";
longSlugs.initiative.id = "payment-gateway-with-multi-currency-and-fraud-checks";
const OVERFLOW_HARNESS = `<script>
const b=document.getElementById("initBand");
const st=document.getElementById("ibStatus").getBoundingClientRect();
document.documentElement.setAttribute("data-probe",[b.scrollWidth,b.clientWidth,Math.round(st.right),window.innerWidth].join("|"));
</script>`;
const [bandScroll, bandClient, statusRight, innerW] = probe(longSlugs, OVERFLOW_HARNESS, "430,844").split("|").map(Number);
assert.ok(bandScroll <= bandClient, `long slugs must truncate, not overflow the band: scrollWidth ${bandScroll} > clientWidth ${bandClient}`);
assert.ok(statusRight <= innerW, `status must stay on-screen at 430px: right ${statusRight} > innerWidth ${innerW}`);
console.log("[browser] PASS initiative band truncates long slugs without overflow at 430px");

// PRD role gating (§7): an initiative hides product-identity fields and
// foregrounds Scope; a plain document keeps the full profile and order.
const PRD_HARNESS = `<script>
const keys=[...document.querySelectorAll(".prd-k")].map(e=>e.textContent);
const has=re=>keys.some(k=>re.test(k))?"1":"0";
document.documentElement.setAttribute("data-probe",[
  (document.querySelectorAll(".prd-doc h2")[0]||{}).textContent||"",
  has(/카테고리|Category/),has(/사용 환경|Platforms/),has(/대안|Alternatives/),has(/차별점|Differentiator/),has(/North Star/),
  document.querySelector(".kv").textContent
].join("~"));
</script>`;
const [initFirst, iCat, iPlat, iAlt, iDiff, iNorth, initDoctype] = probe(initiative, PRD_HARNESS).split("~");
assert.match(initFirst, /1\. (Scope|범위)/, "initiative PRD must lead with Scope");
assert.equal([iCat, iPlat, iAlt, iDiff, iNorth].join(""), "00000", "initiative must hide every product-identity field");
assert.match(initDoctype, /Initiative|이니셔티브/, "initiative doctype label");
console.log("[browser] PASS initiative PRD hides product-identity fields and leads with Scope");

const [plainFirst, pCat, pPlat, pAlt, pDiff, pNorth] = probe(plain, PRD_HARNESS).split("~");
assert.match(plainFirst, /1\. (Overview|개요)/, "1.0 PRD keeps Overview first");
assert.equal([pCat, pPlat, pAlt, pDiff, pNorth].join(""), "11111", "1.0 must keep every product-identity field");
console.log("[browser] PASS plain 1.0 PRD keeps the full profile and order");
