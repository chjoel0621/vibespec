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
assert.match(parent, /main document|제품 기획/, "band must name the parent scope");
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
assert.match(initDoctype, /Add-on|추가 기획/, "initiative doctype label");
console.log("[browser] PASS initiative PRD hides product-identity fields and leads with Scope");

const [plainFirst, pCat, pPlat, pAlt, pDiff, pNorth] = probe(plain, PRD_HARNESS).split("~");
assert.match(plainFirst, /1\. (Overview|개요)/, "1.0 PRD keeps Overview first");
assert.equal([pCat, pPlat, pAlt, pDiff, pNorth].join(""), "11111", "1.0 must keep every product-identity field");
console.log("[browser] PASS plain 1.0 PRD keeps the full profile and order");

// Hidden product-identity content is not a trap: an initiative carrying it
// shows a notice with a clear action; empty fields show nothing; the clear
// button empties the fields and the notice goes away.
const withIdentity = JSON.parse(JSON.stringify(initiative));
withIdentity.prd.category = "B2B SaaS";
withIdentity.prd.platforms = ["Web", "iOS"];
const NOTICE_HARNESS = `<script>
document.documentElement.setAttribute("data-probe",[!!document.querySelector(".prd-idnotice"),(document.querySelector(".prd-idnotice b")||{}).textContent||""].join("~"));
</script>`;
const [noticeShown, noticeNames] = probe(withIdentity, NOTICE_HARNESS).split("~");
assert.equal(noticeShown, "true", "stray product-identity content must surface a notice");
assert.match(noticeNames, /Category|카테고리/, "notice names the stray fields");
console.log("[browser] PASS stray product-identity surfaces a clear-notice");

const noNotice = probe(initiative, NOTICE_HARNESS).split("~")[0];
assert.equal(noNotice, "false", "empty product-identity fields must not show the notice");
console.log("[browser] PASS empty product-identity shows no notice");

// SOT is a top-level `let`, reachable by bare name from an appended classic script.
const CLEAR_HARNESS = `<script>
document.querySelector("[data-clear-identity]").click();
document.documentElement.setAttribute("data-probe",[!!document.querySelector(".prd-idnotice"),SOT.prd.category,JSON.stringify(SOT.prd.platforms)].join("~"));
</script>`;
const [afterNotice, afterCat, afterPlat] = probe(withIdentity, CLEAR_HARNESS).split("~");
assert.equal(afterNotice, "false", "clicking clear must remove the notice");
assert.equal(afterCat, "", "clear must empty string product-identity fields");
assert.equal(afterPlat, "[]", "clear must empty array product-identity fields");
console.log("[browser] PASS clear-identity button empties the fields and dismisses the notice");

// Boundary stub (§7): a reference to a parent page. Title/type/feature-linking
// are read-only (the parent owns them); adding child screens and deleting the
// stub stay allowed. A normal page keeps full editing.
const iaProbe = pageId => {
  const harness = `<script>
  VIEW="ia"; selPage="${pageId}"; render();
  const d=document.querySelector(".ia-side");
  document.documentElement.setAttribute("data-probe",[
    !!d.querySelector("[data-ia-title]"), !!d.querySelector("[data-ia-type]"), !!d.querySelector("[data-ia-link]"),
    !!d.querySelector("[data-add-page]"), !!d.querySelector("[data-del-page]"),
    !!document.querySelector(".snode.boundary"), !!d.querySelector(".ia-boundary-note")
  ].join("|"));
  </script>`;
  return probe(initiative, harness).split("|");
};
const [bTitle, bType, bLink, bAdd, bDel, bNode, bNote] = iaProbe("P1"); // P1 is the boundary stub in the fixture
assert.equal([bTitle, bType, bLink].join(""), "falsefalsefalse", "boundary stub must not expose title/type/feature-link editing");
assert.equal([bAdd, bDel].join(""), "truetrue", "boundary stub must still allow add-child and delete");
assert.equal(bNode, "true", "the boundary node must be visually marked in the sitemap");
assert.equal(bNote, "true", "the boundary detail must show the read-only explanation");
console.log("[browser] PASS boundary stub is read-only for title/type/refs but allows structure edits");

const [nTitle, nType, nLink] = iaProbe("P2"); // P2 is a normal initiative-owned page
assert.equal([nTitle, nType, nLink].join(""), "truetruetrue", "a normal page keeps full editing");
console.log("[browser] PASS a normal initiative page keeps full IA editing");

// A boundary stub with its own feature refs (validator warns, linking UI hidden)
// must not trap the value: it surfaces a clear action, and clicking empties refs.
const stubWithStrayRefs = JSON.parse(JSON.stringify(initiative));
stubWithStrayRefs.ia.sections[0].pages[0].refs = ["F1"]; // P1 is the boundary stub
const STRAY_SHOW = `<script>
VIEW="ia"; selPage="P1"; render();
document.documentElement.setAttribute("data-probe",[!!document.querySelector("[data-clear-boundary-refs]"),(document.querySelector(".prd-idnotice b")||{}).textContent||""].join("~"));
</script>`;
const [strayShown, strayNames] = probe(stubWithStrayRefs, STRAY_SHOW).split("~");
assert.equal(strayShown, "true", "a boundary stub carrying refs must surface a clear action");
assert.ok(strayNames.length > 0, "the notice must name the stray refs");
console.log("[browser] PASS boundary stub with feature refs surfaces a clear action");

const noStray = probe(initiative, STRAY_SHOW).split("~")[0]; // fixture P1 has empty refs
assert.equal(noStray, "false", "an empty boundary stub shows no clear action");
console.log("[browser] PASS boundary stub without refs shows no clear action");

const STRAY_CLEAR = `<script>
VIEW="ia"; selPage="P1"; render();
document.querySelector("[data-clear-boundary-refs]").click();
document.documentElement.setAttribute("data-probe",[!!document.querySelector("[data-clear-boundary-refs]"),JSON.stringify(iaFindPage("P1").page.refs)].join("~"));
</script>`;
const [afterStrayNotice, afterStrayRefs] = probe(stubWithStrayRefs, STRAY_CLEAR).split("~");
assert.equal(afterStrayNotice, "false", "clearing removes the boundary-refs notice");
assert.equal(afterStrayRefs, "[]", "clearing empties the boundary stub's refs");
console.log("[browser] PASS clear-boundary-refs empties the stub and dismisses the notice");

// Section boundary (§ section): a section that mirrors a main section is a
// reference — its title is read-only (owned by the main), it shows the target and
// the read-only note, and it is badged in the sitemap. Adding pages stays allowed.
const withSectionBoundary = JSON.parse(JSON.stringify(initiative));
withSectionBoundary.ia.sections[0].boundary = { scopeId: "root", sectionId: "S1" };
const SEC_HARNESS = `<script>
VIEW="ia"; selSec="${withSectionBoundary.ia.sections[0].id}"; selPage=null; render();
const d=document.querySelector(".ia-side");
document.documentElement.setAttribute("data-probe",[
  !!d.querySelector("[data-sec-title]"), !!d.querySelector(".ia-boundary-note"), !!d.querySelector(".boundary-tag"),
  !!d.querySelector("[data-add-toppage]"), !!document.querySelector(".snode.sec.boundary")
].join("|"));
</script>`;
const [sTitle, sNote, sTag, sAdd, sBadge] = probe(withSectionBoundary, SEC_HARNESS).split("|");
assert.equal(sTitle, "false", "a section boundary must not expose an editable title (the main owns it)");
assert.equal(sNote, "true", "a section boundary must show the read-only reference note");
assert.equal(sTag, "true", "a section boundary detail must carry the main-section tag");
assert.equal(sAdd, "true", "a section boundary still allows adding the increment's pages");
assert.equal(sBadge, "true", "the section boundary must be badged in the sitemap");
console.log("[browser] PASS section boundary is a read-only reference, badged, still accepts pages");

// A normal (non-boundary) section keeps its editable title.
const NORMAL_SEC = `<script>
VIEW="ia"; selSec="${initiative.ia.sections[0].id}"; selPage=null; render();
document.documentElement.setAttribute("data-probe",[!!document.querySelector(".ia-side [data-sec-title]")].join("|"));
</script>`;
assert.equal(probe(initiative, NORMAL_SEC).split("|")[0], "true", "a normal section keeps an editable title");
console.log("[browser] PASS a normal section keeps its editable title");
