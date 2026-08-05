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
semantic.lang = "ko";
semantic.prd.kpis[0].id = "K1";
semantic.prd.kpis[0].measurement = { mode: "event-count", eventRef: "E1", window: "calendar-day" };
semantic.prd.kpis.push({
  id: "K2",
  name: "Manual audit coverage",
  baseline: "Unknown",
  target: "Monthly review",
  method: "Administrator reviews the audit log",
  refs: ["F1"],
  measurement: { mode: "manual", process: "Administrator reviews the audit log", frequency: "monthly" }
});
semantic.semantic = {
  contractVersion: "semantic-0.1",
  events: [{ id: "E1", type: "user", name: "Validation requested", producers: [] }],
  decisions: [{
    id: "D1",
    status: "open",
    question: "Which records belong to the validation population?",
    impacts: [{ effect: "blocks-measurement", refs: ["K1"] }]
  },{
    id: "D2",
    status: "decided",
    question: "How often should the audit be reviewed?",
    resolution: "Review it monthly.",
    impacts: [{ effect: "blocks-measurement", refs: ["K2"] }]
  }]
};
const report = reviewSemantic(semantic);

const LEGACY_HARNESS = `<script>
document.documentElement.setAttribute("data-probe",String(document.getElementById("semanticTab").hidden));
</script>`;
assert.equal(probe(legacy, null, LEGACY_HARNESS), "true", "legacy SOT must hide the semantic tab");
console.log("[browser] PASS legacy SOT hides Measurement Check");

const REPORT_HARNESS = `<script>
document.getElementById("semanticTab").click();
document.documentElement.setAttribute("data-probe",[
  document.getElementById("semanticTab").hidden,
  VIEW,
  document.getElementById("semanticTab").textContent.includes("측정 점검"),
  document.querySelector(".sem-summary").textContent.includes("결정 또는 보완 필요"),
  !document.querySelector(".sem-summary").textContent.includes("실패"),
  !!document.querySelector(".sem-next"),
  document.querySelector(".sem-mode").textContent.includes("이벤트 수"),
  document.querySelector(".sem-scope").textContent.includes("현재 버전은 KPI가 기능과 데이터로 실제 측정 가능한지만 확인합니다"),
  document.querySelectorAll(".sem-measure.issue").length===1,
  document.querySelector(".sem-measure.issue").textContent.includes("K1")&&document.querySelector(".sem-measure.issue").textContent.includes("확인 필요"),
  document.querySelectorAll(".sem-measure.clear").length===1,
  document.querySelector(".sem-measure.clear").textContent.includes("K2")&&document.querySelector(".sem-measure.clear").textContent.includes("현재 문제 없음"),
  document.querySelector(".sem-summary").textContent.includes("K1에서 3개"),
  document.querySelectorAll(".sem-decision-card").length===2,
  document.querySelector(".sem-actions .sem-decision-card.open h3").textContent.includes("Which records belong to the validation population?"),
  document.querySelector(".sem-actions .sem-decision-card.open").textContent.includes("시스템 참조 ID D1"),
  document.querySelector(".sem-actions textarea[data-sem-answer='D1']") instanceof HTMLTextAreaElement,
  document.querySelector(".sem-actions button[data-sem-saveanswer='D1']").textContent.includes("답변 저장"),
  document.querySelectorAll(".sem-actions .sem-finding").length===2,
  document.querySelector(".sem-completed .sem-decision-card.decided").textContent.includes("결정 반영 완료")&&document.querySelector(".sem-completed textarea[data-sem-answer='D2']").value.includes("Review it monthly."),
  [...document.querySelectorAll(".semantic-view h2")].some(h=>h.textContent==="해결할 항목"),
  ![...document.querySelectorAll(".semantic-view h2")].some(h=>h.textContent==="결정 사항"||h.textContent==="확인할 항목")
].join("|"));
</script>`;
assert.equal(probe(semantic, report, REPORT_HARNESS), ["false","semantic",...Array(20).fill("true")].join("|"), "measurement check must use one action list and render real decision inputs");
console.log("[browser] PASS measurement check uses one action list with real decision inputs");

const EMPTY_DECISION_HARNESS = `<script>
document.getElementById("semanticTab").click();
document.querySelector("button[data-sem-saveanswer='D1']").click();
document.documentElement.setAttribute("data-probe",[
  SOT.semantic.decisions.find(item=>item.id==="D1").status==="open",
  !SEMANTIC_REPORT_STALE,
  document.querySelector("textarea[data-sem-answer='D1']").classList.contains("invalid"),
  !document.querySelector(".sem-answer-error").hidden
].join("|"));
</script>`;
assert.equal(probe(semantic, report, EMPTY_DECISION_HARNESS), "true|true|true|true", "an empty decision must be rejected without changing SOT or staling the report");
console.log("[browser] PASS empty decision answers are rejected without changing SOT");

const DECISION_EDIT_HARNESS = `<script>
document.getElementById("semanticTab").click();
const decisionAnswer=document.querySelector("textarea[data-sem-answer='D1']");
decisionAnswer.value="Use every validation request created in the calendar month.";
document.querySelector("button[data-sem-saveanswer='D1']").click();
const savedDecision=SOT.semantic.decisions.find(item=>item.id==="D1");
document.documentElement.setAttribute("data-probe",[
  savedDecision.status==="open",
  savedDecision.resolution==="Use every validation request created in the calendar month.",
  SEMANTIC_REPORT_STALE,
  !!document.querySelector(".sem-notice.stale"),
  document.querySelector(".sem-actions textarea[data-sem-answer='D1']").value.includes("Use every validation request"),
  document.querySelector(".sem-actions .sem-decision-card.open").textContent.includes("답변 작성됨 · 반영 대기"),
  document.querySelector(".sem-ai-handoff").textContent.includes("상단의 저장"),
  document.querySelector(".sem-ai-handoff").textContent.includes("Claude 또는 Codex"),
  document.querySelector("textarea[data-sem-prompt='D1']").value.includes("결정 질문: Which records belong to the validation population?"),
  document.querySelector("textarea[data-sem-prompt='D1']").value.includes("확정 답변: Use every validation request created in the calendar month."),
  document.querySelector("button[data-sem-copyprompt='D1']").textContent.includes("요청 문구 복사")
].join("|"));
</script>`;
assert.equal(probe(semantic, report, DECISION_EDIT_HARNESS), Array(11).fill("true").join("|"), "saving an answer must show how to hand the updated SOT back to AI");
console.log("[browser] PASS saved answers stay open and show an actionable AI handoff guide");

const STALE_HARNESS = `<script>
document.getElementById("semanticTab").click();
commit();
document.documentElement.setAttribute("data-probe",[
  SEMANTIC_REPORT_STALE,
  !!document.querySelector(".sem-notice.stale"),
  document.querySelector(".sem-summary").textContent.includes("Check again")||document.querySelector(".sem-summary").textContent.includes("다시 점검 필요")
].join("|"));
</script>`;
assert.equal(probe(semantic, report, STALE_HARNESS), "true|true|true", "editing must stale the embedded semantic verdict");
console.log("[browser] PASS SOT edits invalidate the embedded semantic verdict");
