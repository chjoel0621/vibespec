import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createDenseSot } from "./dense-fixture.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const viewer = join(here, "..", "assets", "viewer.html");

function findBrowser() {
  const roots = [process.env.PROGRAMFILES, process.env["PROGRAMFILES(X86)"], process.env.LOCALAPPDATA].filter(Boolean);
  const candidates = [
    ...roots.flatMap(root => [join(root, "Google", "Chrome", "Application", "chrome.exe"), join(root, "Microsoft", "Edge", "Application", "msedge.exe")]),
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/microsoft-edge"
  ];
  return candidates.find(existsSync);
}

const browserPath = findBrowser();
assert.ok(browserPath, "Chrome or Edge is required for the flow browser regression test");
assert.ok(existsSync(viewer), "built viewer.html is missing; run npm run build first");

const workspace = mkdtempSync(join(tmpdir(), "vibespec-browser-"));
const dense = createDenseSot();
const embedded = JSON.stringify(dense).replace(/</g, "\\u003c");
const source = readFileSync(viewer, "utf8").replace(
  '<script type="application/json" id="embedded-sot"></script>',
  `<script type="application/json" id="embedded-sot">${embedded}</script>`
);
const harness = `<script>
document.querySelector('[data-view="flow"]').click();
const stage=document.getElementById('stage');
const viewport=document.getElementById('flowVP');
const inner=document.getElementById('flowInner');
const nodes=[...document.querySelectorAll('.flowg .fnode')];
const labels=[...document.querySelectorAll('.flowg .elabel')];
const edges=[...document.querySelectorAll('.flowg .fedge')];
const vpRect=viewport&&viewport.getBoundingClientRect();
const innerRect=inner&&inner.getBoundingClientRect();
const rects=items=>items.map(item=>item.getBoundingClientRect()).filter(rect=>rect.width>0&&rect.height>0);
const overlaps=(a,b)=>a.left<b.right-1&&a.right>b.left+1&&a.top<b.bottom-1&&a.bottom>b.top+1;
const countPairs=items=>{let count=0;for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++)if(overlaps(items[i],items[j]))count++;return count};
const nodeRects=rects(nodes),labelRects=rects(labels);
let labelNodeOverlaps=0;for(const label of labelRects)for(const node of nodeRects)if(overlaps(label,node))labelNodeOverlaps++;
const labelOutOfBounds=labelRects.filter(label=>label.left<innerRect.left-1||label.right>innerRect.right+1||label.top<innerRect.top-1||label.bottom>innerRect.bottom+1).length;
const uniqueEdgePaths=new Set(edges.map(edge=>edge.getAttribute('d'))).size;
const metrics=[
  stage?getComputedStyle(stage).display:'missing',
  Math.round(vpRect&&vpRect.width||0),Math.round(vpRect&&vpRect.height||0),
  Math.round(innerRect&&innerRect.width||0),Math.round(innerRect&&innerRect.height||0),
  nodes.length,edges.length,
  nodes.filter(node=>{const r=node.getBoundingClientRect();return r.width===0||r.height===0}).length,
  countPairs(nodeRects),labelNodeOverlaps,countPairs(labelRects),labelOutOfBounds,uniqueEdgePaths,
  stage&&stage.textContent.includes('렌더 오류')?1:0
];
document.documentElement.setAttribute('data-flow-smoke',metrics.join(','));
</script>`;

function runViewport(name, width, height) {
  const testPage = join(workspace, `flow-${name}.html`);
  writeFileSync(testPage, source + harness);
  const launch = attempt => spawnSync(browserPath, [
      "--headless=new", "--allow-file-access-from-files", "--no-sandbox",
      "--disable-background-networking", "--disable-component-update", "--disable-default-apps",
      "--disable-extensions", "--disable-gpu", "--disable-sync", "--no-first-run", "--no-default-browser-check",
      `--window-size=${width},${height}`,
      `--user-data-dir=${join(workspace, `profile-${name}-${attempt}`)}`,
      "--virtual-time-budget=1000", "--dump-dom", pathToFileURL(testPage).href
    ], { encoding: "utf8", timeout: 60000, maxBuffer: 12 * 1024 * 1024 });
  let result = launch(1);
  if (result.error?.code === "ETIMEDOUT") result = launch(2);
  assert.equal(result.status, 0, `headless browser failed at ${name}: ${result.stderr || result.error || "unknown error"}`);
  const match = result.stdout.match(/data-flow-smoke="([^"]+)"/);
  assert.ok(match, `browser did not emit metrics at ${name}`);
  const [display, ...raw] = match[1].split(",");
  const [vpWidth, vpHeight, innerWidth, innerHeight, nodeCount, edgeCount, zeroSizeNodes, nodeOverlaps, labelNodeOverlaps, labelOverlaps, labelOutOfBounds, uniqueEdgePaths, renderError] = raw.map(Number);
  assert.equal(display, "block", `${name}: flow stage must use block layout`);
  assert.ok(vpWidth > Math.min(300, width - 30) && vpHeight > 200, `${name}: flow viewport collapsed: ${match[1]}`);
  assert.ok(innerWidth > 0 && innerHeight > 0, `${name}: flow inner canvas collapsed: ${match[1]}`);
  assert.equal(nodeCount, 45, `${name}: dense nodes did not all render`);
  assert.equal(edgeCount, 53, `${name}: dense edges did not all render`);
  assert.equal(zeroSizeNodes, 0, `${name}: one or more flow nodes have zero size`);
  assert.equal(nodeOverlaps, 0, `${name}: flow nodes overlap`);
  assert.equal(labelNodeOverlaps, 0, `${name}: edge labels overlap flow nodes`);
  assert.equal(labelOverlaps, 0, `${name}: edge labels overlap each other`);
  assert.equal(labelOutOfBounds, 0, `${name}: edge labels exceed the scrollable canvas`);
  assert.equal(uniqueEdgePaths, 53, `${name}: parallel transitions share an identical edge path`);
  assert.equal(renderError, 0, `${name}: flow renderer displayed an error`);
  console.log(`[browser] PASS ${name} ${width}x${height}: ${nodeCount} nodes, ${edgeCount} edges, ${labelOverlaps} label-label overlaps`);
}

try {
  runViewport("desktop", 1440, 900);
  runViewport("mobile", 430, 844);
} finally {
  try { rmSync(workspace, { recursive: true, force: true }); } catch {}
}
