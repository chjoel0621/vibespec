// Browser regression for the derived Semantic Assurance report.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { reviewSemantic } from "../scripts/lib/semantic-engine.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const skillRoot = join(here, "..");
const viewerHtml = readFileSync(join(skillRoot, "assets", "viewer.html"), "utf8");
const SOT_TAG = '<script type="application/json" id="embedded-sot"></script>';
const REPORT_TAG = '<script type="application/json" id="embedded-semantic-report"></script>';

function findBrowser() {
  const roots = [process.env.PROGRAMFILES, process.env["PROGRAMFILES(X86)"], process.env.LOCALAPPDATA].filter(Boolean);
  const candidates = [
    ...roots.flatMap(root => [join(root, "Google", "Chrome", "Application", "chrome.exe"), join(root, "Microsoft", "Edge", "Application", "msedge.exe")]),
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/microsoft-edge"
  ];
  return candidates.find(existsSync);
}

const browserPath = findBrowser();
assert.ok(browserPath, "Chrome or Edge is required for the semantic browser regression test");

function probe(sot, report, harness) {
  const workspace = mkdtempSync(join(tmpdir(), "vibespec-semantic-browser-"));
  try {
    const payload = JSON.stringify(sot).replace(/</g, "\\u003c");
    const reportPayload = report ? JSON.stringify(report).replace(/</g, "\\u003c") : "";
    const page = join(workspace, "probe.html");
    const html = viewerHtml
      .replace(SOT_TAG, SOT_TAG.replace("></script>", `>${payload}</script>`))
      .replace(REPORT_TAG, REPORT_TAG.replace("></script>", `>${reportPayload}</script>`));
    writeFileSync(page, html + harness);
    const result = spawnSync(browserPath, [
      "--headless=new", "--allow-file-access-from-files", "--no-sandbox", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
      `--user-data-dir=${join(workspace, "profile")}`, "--virtual-time-budget=1500", "--dump-dom", pathToFileURL(page).href
    ], { encoding: "utf8", timeout: 20000, maxBuffer: 8 * 1024 * 1024 });
    assert.equal(result.status, 0, `headless browser failed: ${result.stderr || result.error || "unknown"}`);
    const match = result.stdout.match(/data-probe="([^"]*)"/);
    assert.ok(match, "probe did not emit data-probe");
    return match[1];
  } finally {
    try { rmSync(workspace, { recursive: true, force: true }); } catch {}
  }
}

const legacy = JSON.parse(readFileSync(join(here, "fixtures", "valid-minimal.sot.json"), "utf8"));
const semantic = JSON.parse(JSON.stringify(legacy));
semantic.prd.kpis[0].id = "K1";
semantic.prd.kpis[0].measurement = { mode: "event-count", eventRef: "E1", window: "calendar-day" };
semantic.semantic = {
  contractVersion: "semantic-0.1",
  events: [{ id: "E1", type: "user", name: "Validation requested", producers: [] }],
  decisions: []
};
const report = reviewSemantic(semantic);

const LEGACY_HARNESS = `<script>
document.documentElement.setAttribute("data-probe",String(document.getElementById("semanticTab").hidden));
</script>`;
assert.equal(probe(legacy, null, LEGACY_HARNESS), "true", "legacy SOT must hide the semantic tab");
console.log("[browser] PASS legacy SOT hides Semantic Review");

const REPORT_HARNESS = `<script>
document.getElementById("semanticTab").click();
document.documentElement.setAttribute("data-probe",[
  document.getElementById("semanticTab").hidden,
  VIEW,
  document.querySelector(".sem-summary").textContent.includes("Blocked")||document.querySelector(".sem-summary").textContent.includes("차단됨"),
  !!document.querySelector(".sem-finding")
].join("|"));
</script>`;
assert.equal(probe(semantic, report, REPORT_HARNESS), "false|semantic|true|true", "semantic report must render its blocked finding");
console.log("[browser] PASS semantic SOT renders the embedded blocked report");

const STALE_HARNESS = `<script>
document.getElementById("semanticTab").click();
commit();
document.documentElement.setAttribute("data-probe",[
  SEMANTIC_REPORT_STALE,
  !!document.querySelector(".sem-notice.stale"),
  document.querySelector(".sem-summary").textContent.includes("Review required")||document.querySelector(".sem-summary").textContent.includes("재검토 필요")
].join("|"));
</script>`;
assert.equal(probe(semantic, report, STALE_HARNESS), "true|true|true", "editing must stale the embedded semantic verdict");
console.log("[browser] PASS SOT edits invalidate the embedded semantic verdict");
