import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

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
  console.log("[embed] PASS deterministic JSON-to-HTML embedding");
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
