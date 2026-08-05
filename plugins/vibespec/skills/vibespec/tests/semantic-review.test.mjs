import assert from "node:assert/strict";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { reviewSemantic } from "../scripts/lib/semantic-engine.mjs";
import { sotDigest } from "../scripts/lib/c14n.mjs";
import { diffReport } from "../scripts/lib/diff.mjs";
import { normalizeForMigration } from "../scripts/lib/viewer-normalize.mjs";
import { validateSot } from "../scripts/validate-sot.mjs";
import { semanticReferenceFields } from "../scripts/lib/semantic-reference-registry.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const valid = JSON.parse(readFileSync(join(here, "fixtures", "valid-minimal.sot.json"), "utf8"));
const clone = value => JSON.parse(JSON.stringify(value));

const schema = JSON.parse(readFileSync(join(here, "..", "references", "sot.schema.json"), "utf8"));
const semanticRefKeys = new Set();
const collectRefKeys = node => {
  if (!node || typeof node !== "object") return;
  for (const [key, value] of Object.entries(node.properties || {})) {
    if (/(?:Ref|Refs)$/.test(key)) semanticRefKeys.add(key);
    collectRefKeys(value);
  }
  (node.oneOf || []).forEach(collectRefKeys);
  if (node.items) collectRefKeys(node.items);
};
for (const name of ["measurement", "ratioNumerator", "ratioDenominator", "measurementEvent", "eventProducer", "decisionImpact"]) collectRefKeys(schema.$defs[name]);
for (const key of semanticRefKeys) {
  assert.ok(semanticReferenceFields.some(field => field.source.includes(`.${key}`)), `semantic schema ref field ${key} is missing from the central registry`);
}
console.log("[semantic] PASS every semantic schema reference field is registered centrally");

function enableSemantic(sot, measurement, events = [], decisions = []) {
  const next = clone(sot);
  next.prd.kpis[0].id = "K1";
  next.prd.kpis[0].measurement = measurement;
  next.semantic = { contractVersion: "semantic-0.1", events, decisions };
  return next;
}

const legacyDigest = sotDigest(valid);
const normalizedLegacy = normalizeForMigration(valid);
assert.equal(sotDigest(normalizedLegacy), legacyDigest, "legacy viewer round-trip must preserve the canonical digest");
assert.equal(Object.hasOwn(normalizedLegacy, "semantic"), false, "legacy viewer round-trip must not inject semantic");
assert.equal(Object.hasOwn(normalizedLegacy.prd.kpis[0], "id"), false, "legacy KPI must not receive an automatic id");
assert.deepEqual(reviewSemantic(valid).assessment, { status: "not-assessed" });
assert.deepEqual(reviewSemantic(valid).readiness, {});
console.log("[semantic] PASS legacy SOT stays unchanged and reports not-assessed");

const survey = enableSemantic(valid, { mode: "survey", instrument: "Quarterly planner survey", window: "calendar-quarter" });
assert.equal(validateSot(survey).valid, true);
assert.equal(reviewSemantic(survey).assessment.status, "passed");
assert.equal(reviewSemantic(survey).readiness.measurement, "ready");
console.log("[semantic] PASS survey measurement needs no event producer");

const manual = enableSemantic(valid, { mode: "manual", process: "Monthly audit worksheet", frequency: "monthly" });
assert.equal(validateSot(manual).valid, true);
assert.equal(reviewSemantic(manual).readiness.measurement, "ready");
const external = enableSemantic(valid, { mode: "external", source: "Billing warehouse", metric: "paid_accounts", refresh: "daily" });
assert.equal(validateSot(external).valid, true);
assert.equal(reviewSemantic(external).readiness.measurement, "ready");
console.log("[semantic] PASS manual and external measurements do not require UI evidence");

const system = enableSemantic(valid,
  { mode: "event-count", eventRef: "E1", window: "calendar-day" },
  [{ id: "E1", type: "system", name: "Validation completed", producers: [{ type: "system-task", name: "Validation runner", description: "Records completion after the validator exits" }] }]);
system.prd.kpis[0].name = "Daily validation completions";
system.prd.kpis[0].target = "At least 10 per day";
system.prd.kpis[0].method = "Count validation completion events";
assert.equal(validateSot(system).valid, true);
assert.equal(reviewSemantic(system).readiness.measurement, "ready");
console.log("[semantic] PASS system events need no screen");

const multiProducer = enableSemantic(valid,
  { mode: "event-count", eventRef: "E1", window: "calendar-day" },
  [{
    id: "E1", type: "user", name: "Validation requested",
    producers: [{ type: "feature", ref: "F1" }, { type: "system-task", name: "CLI wrapper", description: "Starts validation on behalf of the user" }],
    surfaceRefs: ["P1"]
  }]);
multiProducer.prd.kpis[0].name = "Daily validation requests";
multiProducer.prd.kpis[0].target = "At least 10 per day";
multiProducer.prd.kpis[0].method = "Count validation request events";
assert.equal(validateSot(multiProducer).valid, true);
assert.equal(reviewSemantic(multiProducer).readiness.measurement, "ready");
assert.equal(normalizeForMigration(multiProducer).prd.kpis[0].id, "K1");
assert.equal(normalizeForMigration(multiProducer).prd.kpis[0].measurement.eventRef, "E1");
console.log("[semantic] PASS multiple producers and semantic viewer round-trip");

const normalizedCount = clone(multiProducer);
normalizedCount.prd.kpis[0].name = "Exports per active household per week";
normalizedCount.prd.kpis[0].method = "Weekly exports / active households";
assert.ok(reviewSemantic(normalizedCount).findings.some(item => item.ruleId === "normalized-metric-denominator-required"));
for (const name of ["노쇼율", "전환율", "이탈률", "재방문율", "오류율", "성공률", "사용자당 예약 수"]) {
  const koreanNormalizedCount = clone(multiProducer);
  koreanNormalizedCount.lang = "ko";
  koreanNormalizedCount.prd.kpis[0].name = name;
  assert.ok(
    reviewSemantic(koreanNormalizedCount).findings.some(item => item.ruleId === "normalized-metric-denominator-required"),
    `${name} must not be accepted as an event-count without a denominator`
  );
}
const rawKoreanCount = clone(multiProducer);
rawKoreanCount.lang = "ko";
rawKoreanCount.prd.kpis[0].name = "월간 예약 건수";
assert.ok(!reviewSemantic(rawKoreanCount).findings.some(item => item.ruleId === "normalized-metric-denominator-required"));
normalizedCount.prd.kpis[0].measurement = { mode: "external", source: "Product analytics", metric: "exports_per_active_household", refresh: "weekly" };
assert.ok(!reviewSemantic(normalizedCount).findings.some(item => item.ruleId === "normalized-metric-denominator-required"));
console.log("[semantic] PASS English and Korean normalized metrics cannot masquerade as raw event counts");

const noShow = enableSemantic(valid,
  {
    mode: "event-ratio",
    numerator: { populationEventRef: "E1", absenceOfEventRef: "E2" },
    denominator: { populationEventRef: "E1" },
    window: "calendar-month",
    exclusionEventRefs: ["E3"]
  },
  [
    { id: "E1", type: "system", name: "Booking start reached", producers: [{ type: "system-task", name: "Booking clock", description: "Emits when a valid booking reaches its start time" }] },
    { id: "E2", type: "user", name: "Room check-in completed", producers: [] },
    { id: "E3", type: "system", name: "Booking cancelled", producers: [{ type: "feature", ref: "F1" }] }
  ],
  [{ id: "D1", question: "Should check-in use QR or NFC?", status: "open", impacts: [{ effect: "blocks-measurement", refs: ["K1", "E2"] }] }]);
assert.equal(validateSot(noShow).valid, true, JSON.stringify(validateSot(noShow).errors));
const blocked = reviewSemantic(noShow);
assert.equal(blocked.assessment.status, "failed");
assert.equal(blocked.readiness.measurement, "blocked");
for (const ruleId of ["measurement-event-producer-required", "open-decision-blocks-measurement"]) {
  assert.ok(blocked.findings.some(item => item.ruleId === ruleId), "missing semantic finding " + ruleId);
}
const koreanNoShow = clone(noShow);
koreanNoShow.lang = "ko";
assert.match(reviewSemantic(koreanNoShow).findings[0].summary, /[가-힣]/, "Korean SOT findings must be readable in Korean");
const englishNoShow = clone(noShow);
englishNoShow.lang = "en";
assert.match(reviewSemantic(englishNoShow).findings[0].summary, /[A-Za-z]/, "English SOT findings must be readable in English");
console.log("[semantic] PASS no-show KPI is blocked without check-in production evidence and a resolved decision");

const decidedWithoutResolution = clone(noShow);
decidedWithoutResolution.semantic.decisions[0].status = "decided";
assert.equal(validateSot(decidedWithoutResolution).valid, false, "decided decision must record its resolution");
assert.ok(reviewSemantic(decidedWithoutResolution).findings.some(item => item.ruleId === "decision-resolution-required"));
decidedWithoutResolution.semantic.decisions[0].resolution = "MVP uses QR check-in.";
assert.equal(validateSot(decidedWithoutResolution).valid, true, JSON.stringify(validateSot(decidedWithoutResolution).errors));
assert.equal(reviewSemantic(decidedWithoutResolution).findings.some(item => item.ruleId === "decision-resolution-required"), false);
console.log("[semantic] PASS a decision cannot close without a recorded resolution");

const unknownEvent = enableSemantic(valid, { mode: "event-count", eventRef: "E9", window: "calendar-day" });
assert.equal(validateSot(unknownEvent).valid, false);
assert.ok(reviewSemantic(unknownEvent).findings.some(item => item.ruleId === "semantic-reference-exists"));
console.log("[semantic] PASS unknown event references fail structural and semantic checks");

const featureDecision = clone(survey);
featureDecision.semantic.decisions.push({
  id: "D1", question: "Should validation move to a background worker?", status: "open",
  impacts: [{ effect: "blocks-implementation", refs: ["F1", "P1"] }]
});
assert.equal(validateSot(featureDecision).valid, true, "decision impacts may target existing product ids");
featureDecision.semantic.decisions[0].impacts[0].refs.push("F9");
assert.equal(validateSot(featureDecision).valid, false, "decision impacts must not target unknown product ids");
assert.ok(reviewSemantic(featureDecision).findings.some(item => item.ruleId === "semantic-reference-exists"));
assert.throws(() => reviewSemantic({ ...survey, semantic: { ...survey.semantic, contractVersion: "semantic-9.9" } }), /unsupported semantic contract/);
console.log("[semantic] PASS dynamic decision refs cover product ids and reject unknown targets");

const mismatchedPopulation = clone(noShow);
mismatchedPopulation.prd.kpis[0].measurement.denominator.populationEventRef = "E3";
assert.ok(reviewSemantic(mismatchedPopulation).findings.some(item => item.ruleId === "ratio-population-consistent"));
console.log("[semantic] PASS ratio numerator and denominator share one population event");

const firstFinding = blocked.findings.find(item => item.ruleId === "measurement-event-producer-required");
const repeatedFinding = reviewSemantic(noShow).findings.find(item => item.ruleId === "measurement-event-producer-required");
assert.equal(firstFinding.fingerprint, repeatedFinding.fingerprint, "same evidence must keep a stable finding fingerprint");
const changedEvidence = clone(noShow);
changedEvidence.semantic.events[1].name = "Physical room check-in completed";
const changedFinding = reviewSemantic(changedEvidence).findings.find(item => item.ruleId === "measurement-event-producer-required");
assert.notEqual(firstFinding.fingerprint, changedFinding.fingerprint, "changed evidence must stale the finding fingerprint");
console.log("[semantic] PASS finding fingerprints are stable but evidence-sensitive");

const renamedEvent = clone(multiProducer);
renamedEvent.semantic.events[0].name = "Validation command requested";
const semanticDiff = diffReport(multiProducer, renamedEvent);
assert.ok(semanticDiff.changes.some(item => item.path === "E1.name"));
assert.deepEqual(semanticDiff.impact.E1.kpis, ["K1"]);
const removedEvent = clone(multiProducer);
removedEvent.prd.kpis[0].measurement = { mode: "survey", instrument: "Daily validation survey", window: "calendar-day" };
removedEvent.semantic.events = [];
const removalDiff = diffReport(multiProducer, removedEvent);
assert.ok(removalDiff.removedIds.includes("E1"));
assert.deepEqual(removalDiff.impact.E1.kpis, ["K1"], "deleted-event impact must survive after-side cleanup");
console.log("[semantic] PASS diff tracks K/E/D ids and preserves deleted semantic impact");

const cliFile = join(tmpdir(), `vibespec-semantic-${process.pid}.sot.json`);
writeFileSync(cliFile, JSON.stringify(noShow));
const cli = spawnSync(process.execPath, [join(here, "..", "scripts", "review-semantic.mjs"), cliFile, "--json"], { encoding: "utf8" });
assert.equal(cli.status, 1, cli.stderr);
assert.equal(JSON.parse(cli.stdout).readiness.measurement, "blocked");
rmSync(cliFile, { force: true });
console.log("[semantic] PASS CLI returns a machine-readable blocked report and exit 1");
