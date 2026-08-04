import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { reviewSemantic } from "../scripts/lib/semantic-engine.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const skillRoot = join(here, "..");
const fixturePath = join(here, "fixtures", "valid-minimal.sot.json");
const viewerPath = join(skillRoot, "assets", "viewer.html");
const tempDir = mkdtempSync(join(tmpdir(), "vibespec-embed-"));

try {
  const sourcePath = join(tempDir, "source.sot.json");
  const outputPath = join(tempDir, "viewer.html");
  const source = JSON.parse(readFileSync(fixturePath, "utf8"));
  source.title = "Embed <script> safety";
  source.prd.problem = "A literal </script> must stay data.";
  writeFileSync(sourcePath, JSON.stringify(source, null, 2));

  const result = spawnSync(process.execPath, [join(skillRoot, "scripts", "embed-sot.mjs"), viewerPath, sourcePath, outputPath], {
    encoding: "utf8"
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const html = readFileSync(outputPath, "utf8");
  const marker = '<script type="application/json" id="embedded-sot">';
  const start = html.indexOf(marker);
  const end = html.indexOf("</script>", start);
  assert.ok(start >= 0 && end > start, "viewer must contain a populated embedded-sot tag");
  const embedded = JSON.parse(html.slice(start + marker.length, end));
  assert.deepEqual(embedded, source, "viewer must embed the exact source SOT, not a separately generated copy");
  assert.ok(html.includes("\\u003c/script>"), "script-closing text must be escaped inside embedded JSON");
  const reportMarker = '<script type="application/json" id="embedded-semantic-report">';
  const reportStart = html.indexOf(reportMarker);
  const reportEnd = html.indexOf("</script>", reportStart);
  assert.equal(html.slice(reportStart + reportMarker.length, reportEnd), "", "legacy SOT must not receive an implied semantic report");
  console.log("[embed] PASS deterministic JSON-to-HTML embedding");

  const semanticPath = join(tempDir, "semantic.sot.json");
  const semanticOutputPath = join(tempDir, "semantic.html");
  const semantic = JSON.parse(JSON.stringify(source));
  semantic.prd.kpis[0].id = "K1";
  semantic.prd.kpis[0].measurement = { mode: "event-count", eventRef: "E1", window: "calendar-day" };
  semantic.semantic = {
    contractVersion: "semantic-0.1",
    events: [{ id: "E1", type: "user", name: "Validation requested", producers: [] }],
    decisions: []
  };
  writeFileSync(semanticPath, JSON.stringify(semantic, null, 2));
  const semanticResult = spawnSync(process.execPath, [join(skillRoot, "scripts", "embed-sot.mjs"), viewerPath, semanticPath, semanticOutputPath], { encoding: "utf8" });
  assert.equal(semanticResult.status, 0, semanticResult.stderr || semanticResult.stdout);
  const semanticHtml = readFileSync(semanticOutputPath, "utf8");
  const semanticReportStart = semanticHtml.indexOf(reportMarker);
  const semanticReportEnd = semanticHtml.indexOf("</script>", semanticReportStart);
  const embeddedReport = JSON.parse(semanticHtml.slice(semanticReportStart + reportMarker.length, semanticReportEnd));
  assert.deepEqual(embeddedReport, reviewSemantic(semantic), "embedded report must come from the shared semantic engine");
  assert.equal(embeddedReport.readiness.measurement, "blocked", "missing event evidence must stay blocked in the HTML report");
  console.log("[embed] PASS semantic SOT embeds the shared derived report without mutating the SOT");
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
