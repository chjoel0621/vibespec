# Semantic Assurance Calibration Sprint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an evidence-driven calibration lane that counts unique product concepts and KPI concepts, requires human approval for product-quality claims, covers all five measurement modes, and produces a versioned 0.17.2 calibration report without changing the VibeSpec runtime.

**Architecture:** Keep SOT files as immutable product evidence and place all experiment metadata outside them. Split the growing evaluator into focused aggregation, approval, and reporting modules; let `evaluate.mjs` orchestrate source verification and deterministic reviews. Existing cases remain reproducible, while locale variants and repeated host runs share stable concept identifiers so they cannot inflate coverage.

**Tech Stack:** Node.js 22 ESM, built-in `node:test`, JSON manifests and receipts, Markdown reports, existing VibeSpec canonical digest/change-plan/semantic review libraries, Claude Code and Codex CLI for fixed-brief host runs.

## Global Constraints

- Do not change the SOT schema, semantic contract, viewer, skill routing, or runtime rules during this sprint.
- Never edit a natural host artifact after generation; corrections use separate change plans or adjudication records.
- Count product concepts and KPI concepts once across locales, hosts, and repeated runs.
- Do not count legacy comparison cases, baseline candidates, or unapproved human reviews toward exit criteria.
- Preserve source digests, file SHA-256 values, prompt hashes, plugin versions, host versions, timestamps, and retry counts.
- Keep private customer data and raw host logs out of tracked fixtures.
- Report raw counts alongside percentages; do not publish accuracy claims from this sample.
- The sprint gate remains at least 8 approved unique product concepts, 30 approved unique KPI concepts, all five measurement modes, zero blocker false positives, and at least 90% validated resolution success.

---

## File Structure

### New focused modules

- `evaluation/semantic-assurance/lib/concepts.mjs`: validate concept metadata and deduplicate product/KPI coverage.
- `evaluation/semantic-assurance/lib/approval.mjs`: hash and verify immutable human approval receipts.
- `evaluation/semantic-assurance/lib/report.mjs`: build deterministic JSON and Markdown calibration summaries.
- `evaluation/semantic-assurance/approve-baseline.mjs`: explicit CLI for producing a receipt after human approval.
- `evaluation/semantic-assurance/report.mjs`: CLI for writing versioned reports.
- `evaluation/semantic-assurance/tests/concepts.test.mjs`: locale/run deduplication and coverage-gate tests.
- `evaluation/semantic-assurance/tests/approval.test.mjs`: valid, stale, and incomplete receipt tests.
- `evaluation/semantic-assurance/tests/report.test.mjs`: stable report and release-bucket tests.
- `evaluation/semantic-assurance/templates/human-adjudication.template.json`: generic engine/UX adjudication record.

### Existing files to modify

- `evaluation/semantic-assurance/evaluate.mjs`: consume focused modules, expose artifact and approved unique metrics, and support `reviewer-baseline`.
- `evaluation/semantic-assurance/README.md`: document concept counting, approval, report generation, and reviewer responsibilities.
- `evaluation/semantic-assurance/cases/*/case.json`: add stable concept metadata to all current cases.
- `evaluation/semantic-assurance/templates/baseline-approval.template.json`: align the receipt with the executable approval contract.
- `evaluation/semantic-assurance/templates/generation-quality.template.json`: record explanation clarity, review effort, confirmed errors, FP/FN, and release recommendation.
- `plugins/vibespec/skills/vibespec/package.json`: run the three focused evaluation tests before the full case evaluator.

### Evidence added in later tasks

- `evaluation/semantic-assurance/cases/external-business-outcome/`: synthetic fixed brief, host artifact, manifest, and adjudication.
- `evaluation/semantic-assurance/cases/survey-manual-validation/`: synthetic fixed brief, host artifact, manifest, and adjudication.
- `evaluation/semantic-assurance/runs/<experiment>/<host>/<run-id>/`: sanitized run manifest, exact synthetic SOT, and generation-quality review.
- `evaluation/semantic-assurance/reports/v0.17.2/summary.json`: machine-readable calibration result.
- `evaluation/semantic-assurance/reports/v0.17.2/summary.md`: reviewer-readable result and release recommendations.

---

### Task 1: Unique Product and KPI Concept Aggregation

**Files:**
- Create: `evaluation/semantic-assurance/lib/concepts.mjs`
- Create: `evaluation/semantic-assurance/tests/concepts.test.mjs`
- Modify: `evaluation/semantic-assurance/evaluate.mjs`
- Modify: all `evaluation/semantic-assurance/cases/*/case.json`
- Modify: `plugins/vibespec/skills/vibespec/package.json`

**Interfaces:**
- Consumes: evaluated results with `manifest.concept`, `metrics.kpis`, and `metrics.measurementModes`.
- Produces: `validateConceptManifest(manifest)`, `conceptCoverageFor(result)`, and `aggregateConceptCoverage(results)`.
- Manifest shape:

```json
{
  "concept": {
    "id": "weekchef",
    "variant": { "locale": "ko", "host": "claude-code", "runId": "original" },
    "kpiConcepts": {
      "K1": "weekchef-plan-completion",
      "K2": "weekchef-grocery-completion"
    }
  }
}
```

- `aggregateConceptCoverage(results)` returns:

```js
{
  artifactCount: 3,
  uniqueConcepts: ["meeting-room-booking", "weekchef"],
  uniqueKpiConcepts: ["meeting-room-booking/no-show-rate", "weekchef/plan-completion"],
  measurementModes: ["event-ratio", "external"]
}
```

- Only `natural`, `controlled-mutation`, and later `reviewer-baseline` results contribute. Candidate and legacy lanes return empty approved coverage.

- [ ] **Step 1: Write failing concept-deduplication tests**

Create tests with two WeekChef results that share `concept.id` and KPI concept slugs but differ in locale, plus a third repeated Claude run. Assert that artifacts equal three while unique products equal one and unique KPI concepts equal two.

```js
import assert from "node:assert/strict";
import test from "node:test";
import { aggregateConceptCoverage } from "../lib/concepts.mjs";

test("locale variants and repeated runs do not inflate concept coverage", () => {
  const results = [
    result("ko", "claude-code", "run-1"),
    result("en", "claude-code", "run-1"),
    result("ko", "claude-code", "run-2")
  ];
  const coverage = aggregateConceptCoverage(results);
  assert.equal(coverage.artifactCount, 3);
  assert.deepEqual(coverage.uniqueConcepts, ["weekchef"]);
  assert.equal(coverage.uniqueKpiConcepts.length, 2);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run from repository root:

```bash
node --test evaluation/semantic-assurance/tests/concepts.test.mjs
```

Expected: FAIL because `lib/concepts.mjs` does not exist.

- [ ] **Step 3: Implement concept validation and deduplication**

Use slug validation `/^[a-z0-9]+(?:-[a-z0-9]+)*$/`, sort all returned arrays, and throw on a measured KPI whose ID is absent from `kpiConcepts`. Use `${conceptId}/${kpiConceptSlug}` as the global key. Keep artifact counts separate from unique counts.

- [ ] **Step 4: Add concept metadata to every existing manifest**

Use one shared `concept.id` for:

- `weekchef-claude-ko` and `weekchef-claude-en`: `weekchef`;
- `four-way-crm-baseline` and `legacy-crm-operations`: `crm-sales-operations`;
- `four-way-habit-baseline` and `legacy-habit-consumer`: `habit-routine`.

Give all other legacy examples independent domain concept IDs. Map each semantic KPI ID to a domain-stable KPI concept slug. Legacy manifests may record KPI concepts for comparison but remain excluded from approved coverage.

- [ ] **Step 5: Wire unique coverage into the evaluator output**

Preserve existing aggregate fields for backward-compatible artifact diagnostics and add:

```js
aggregate.calibration = {
  uniqueConceptCount,
  uniqueKpiConceptCount,
  uniqueConcepts,
  uniqueKpiConcepts,
  measurementModes
};
```

The current set must report two machine-assessed unique concepts and five unique KPI concepts: three from the resolved meeting-room plan and two from WeekChef. CRM and habit remain candidates.

- [ ] **Step 6: Add the focused test to the package test commands**

Add `node ../../../../evaluation/semantic-assurance/tests/concepts.test.mjs` before `evaluate.mjs` in `test`, `check`, and `test:evaluation`.

- [ ] **Step 7: Run focused and full evaluation tests**

```bash
node --test evaluation/semantic-assurance/tests/concepts.test.mjs
cd plugins/vibespec/skills/vibespec
npm run test:evaluation
```

Expected: PASS; artifact diagnostics remain reproducible and unique coverage is not inflated by WeekChef locales.

- [ ] **Step 8: Commit**

```bash
git add evaluation/semantic-assurance plugins/vibespec/skills/vibespec/package.json
git commit -m "test: count unique semantic evaluation concepts"
```

---

### Task 2: Human Approval Receipt Gate

**Files:**
- Create: `evaluation/semantic-assurance/lib/approval.mjs`
- Create: `evaluation/semantic-assurance/approve-baseline.mjs`
- Create: `evaluation/semantic-assurance/tests/approval.test.mjs`
- Modify: `evaluation/semantic-assurance/evaluate.mjs`
- Modify: `evaluation/semantic-assurance/templates/baseline-approval.template.json`
- Modify: `plugins/vibespec/skills/vibespec/package.json`

**Interfaces:**
- Produces `sha256Bytes(bytes)`, `verifyApproval({ caseRoot, manifest, receipt })`, and `buildApprovalReceipt({ caseRoot, manifest, reviewer, approvedAt, kpiVerdicts })`.
- A `reviewer-baseline` manifest adds:

```json
{
  "lane": "reviewer-baseline",
  "overlay": {
    "plan": { "path": "overlay.plan.json", "fileSha256": "..." },
    "adjudication": { "path": "adjudication.json", "fileSha256": "..." },
    "approval": { "path": "approval.json", "fileSha256": "..." },
    "resultDigest": "sha256:..."
  }
}
```

- A receipt is valid only when it pins the current brief, plan, adjudication, and result digest and every KPI verdict is `accepted` or `accepted-as-blocked`.

- [ ] **Step 1: Write failing approval tests**

Test three cases:

1. a receipt whose hashes match returns `{ valid: true }`;
2. one changed byte in adjudication returns an `adjudication-drift` failure;
3. a KPI verdict of `revise-before-approval` cannot contribute coverage.

- [ ] **Step 2: Run the approval test and verify RED**

```bash
node --test evaluation/semantic-assurance/tests/approval.test.mjs
```

Expected: FAIL because the approval module does not exist.

- [ ] **Step 3: Implement pure receipt creation and verification**

Hash raw file bytes with uppercase SHA-256 to match existing manifest conventions. Validate receipt contract `semantic-baseline-approval-0.1`, human reviewer name, ISO-8601 `approvedAt`, exact artifact hashes, exact result digest, unique KPI concept verdicts, and allowed status `approved` or `approved-with-open-decisions`.

- [ ] **Step 4: Implement the explicit approval CLI**

The CLI must require all approval intent on the command line and never infer it from a green report:

```bash
node evaluation/semantic-assurance/approve-baseline.mjs \
  --case four-way-crm-baseline \
  --reviewer "reviewer-alias" \
  --status approved-with-open-decisions \
  --out evaluation/semantic-assurance/cases/four-way-crm-baseline/approval.json
```

Reject candidate adjudications that still contain `pending-human-review` verdicts. The reviewer must first change each verdict to `accepted`, `accepted-as-blocked`, or `revise-before-approval`.

- [ ] **Step 5: Add `reviewer-baseline` evaluation support**

Keep `reviewer-baseline-candidate` behavior unchanged and excluded. For `reviewer-baseline`, verify the receipt before applying the overlay and expose approved KPI concept coverage only after the receipt passes.

- [ ] **Step 6: Verify candidate and approved paths**

Use temporary fixtures in the test; do not approve CRM or habit in this task. Run:

```bash
node --test evaluation/semantic-assurance/tests/approval.test.mjs
node evaluation/semantic-assurance/evaluate.mjs
```

Expected: PASS; both real baseline cases remain candidates and contribute zero approved coverage.

- [ ] **Step 7: Wire the test and commit**

```bash
git add evaluation/semantic-assurance plugins/vibespec/skills/vibespec/package.json
git commit -m "test: require human receipts for semantic baselines"
```

---

### Task 3: Human Adjudication and Versioned Reports

**Files:**
- Create: `evaluation/semantic-assurance/lib/report.mjs`
- Create: `evaluation/semantic-assurance/report.mjs`
- Create: `evaluation/semantic-assurance/tests/report.test.mjs`
- Create: `evaluation/semantic-assurance/templates/human-adjudication.template.json`
- Modify: `evaluation/semantic-assurance/templates/generation-quality.template.json`
- Modify: `evaluation/semantic-assurance/evaluate.mjs`
- Modify: `evaluation/semantic-assurance/README.md`
- Modify: `plugins/vibespec/skills/vibespec/package.json`

**Interfaces:**
- `buildCalibrationReport(evaluationOutput, adjudications)` returns a JSON-safe report.
- `renderCalibrationMarkdown(report)` returns deterministic Markdown ending with one newline.
- Human adjudication contract:

```json
{
  "contractVersion": "semantic-human-adjudication-0.1",
  "status": "draft",
  "reviewer": { "type": "human-assisted", "name": "reviewer-alias" },
  "reviewedAt": "2026-08-10T00:00:00Z",
  "artifact": { "digest": "sha256:...", "fileSha256": "..." },
  "confirmedErrors": [],
  "falsePositives": [],
  "falseNegatives": [],
  "resolutionAttempts": [],
  "authoringEffort": { "minutes": 0, "fieldsChanged": 0, "notes": "" },
  "explanationClarity": "clear",
  "publication": "private",
  "recommendations": []
}
```

- Recommendation category is exactly one of `0.17.3`, `0.18`, `docs-demo`, or `no-change`.

- [ ] **Step 1: Write failing report tests**

Assert that the report:

- separates machine-assessed and human-approved counts;
- includes raw TP/FP/FN and resolution counts;
- rejects an adjudication whose artifact digest does not match;
- groups recommendations by the four allowed categories;
- renders stable Markdown in concept ID order.

- [ ] **Step 2: Run the report test and verify RED**

```bash
node --test evaluation/semantic-assurance/tests/report.test.mjs
```

Expected: FAIL because the report module does not exist.

- [ ] **Step 3: Implement adjudication validation and report building**

Treat `draft` adjudications as visible but not approved. Require numeric nonnegative minutes/counts, known finding keys, a clarity enum of `clear`, `partly-clear`, or `unclear`, and publication enum `private`, `anonymized`, or `public`. Compute resolution success as raw `resolved / attempted`; emit `null` percentage when there are no attempts.

- [ ] **Step 4: Implement deterministic report CLI**

```bash
node evaluation/semantic-assurance/report.mjs \
  --version v0.17.2 \
  --out evaluation/semantic-assurance/reports/v0.17.2
```

Write `summary.json` and `summary.md` through temporary sibling files followed by rename so a failed report does not leave one half updated. Refuse to overwrite a report for another plugin version.

- [ ] **Step 5: Update templates and documentation**

Add confirmed errors, FP/FN, clarity, effort, resolution attempts, and recommendations to the generation-quality template. Document that Codex drafts the review but the human owns product judgments and publication approval.

- [ ] **Step 6: Run focused tests and a disposable report**

```bash
node --test evaluation/semantic-assurance/tests/report.test.mjs
node evaluation/semantic-assurance/report.mjs --version v0.17.2 --out artifacts/calibration-report
```

Expected: PASS; the disposable report explicitly says there are zero human-approved concepts until receipts exist.

- [ ] **Step 7: Wire tests and commit**

```bash
git add evaluation/semantic-assurance plugins/vibespec/skills/vibespec/package.json
git commit -m "test: report human semantic calibration evidence"
```

---

### Task 4: Calibrate Existing Cases and Add Missing Measurement Modes

**Files:**
- Modify: `evaluation/semantic-assurance/cases/four-way-crm-baseline/adjudication.json`
- Modify: `evaluation/semantic-assurance/cases/four-way-habit-baseline/adjudication.json`
- Create after explicit human decisions: their `approval.json` files
- Create: `evaluation/semantic-assurance/cases/external-business-outcome/brief.md`
- Create: `evaluation/semantic-assurance/cases/external-business-outcome/case.json`
- Create: `evaluation/semantic-assurance/cases/external-business-outcome/adjudication.json`
- Create: `evaluation/semantic-assurance/cases/survey-manual-validation/brief.md`
- Create: `evaluation/semantic-assurance/cases/survey-manual-validation/case.json`
- Create: `evaluation/semantic-assurance/cases/survey-manual-validation/adjudication.json`
- Create: exact synthetic SOT artifacts referenced by the two new manifests

**Interfaces:**
- External concept must include at least one `external` KPI and one internal `event-count` diagnostic without treating external revenue as a UI event.
- Survey/manual concept must include at least one `survey` KPI and one `manual` KPI without manufacturing an event producer.
- Both artifacts use semantic contract `semantic-0.1` and pass `validate-sot`, `review-sot`, and `review-semantic` according to their adjudicated expectations.

- [ ] **Step 1: Present CRM and habit decisions for human review**

Ask only the unresolved product choices already recorded in their adjudications:

- CRM: define K2 population and report-link completion; choose K3 monthly manual audit or a ratio with an explicit population.
- Habit: choose the first-week value action; define what counts as weekly return; resolve the F9/F10 data-control ownership mismatch.

Record answers in the adjudication and overlay plan. Do not change unrelated SOT content.

- [ ] **Step 2: Re-run candidate evaluation before approval**

```bash
node evaluation/semantic-assurance/evaluate.mjs --case four-way-crm-baseline
node evaluation/semantic-assurance/evaluate.mjs --case four-way-habit-baseline
```

Expected: each candidate matches its approved expected readiness, which may legitimately remain `blocked` when an open decision is intentionally preserved.

- [ ] **Step 3: Generate approval receipts only after explicit approval**

Use `approve-baseline.mjs`, change each manifest lane to `reviewer-baseline`, pin the approval file SHA-256, and verify that stale or revised adjudication bytes invalidate the receipt.

- [ ] **Step 4: Write the external-outcome brief and generate its exact artifact**

Use a synthetic campaign performance product with these facts:

- internal workflow records campaign creation and completion;
- attributed revenue comes from a named external commerce warehouse;
- no historical baseline or attribution result is supplied;
- data refresh cadence is daily;
- the product must not invent revenue, lift, or attribution accuracy.

The artifact must use `event-count` for an internal operational count and `external` for attributed revenue or ROI.

- [ ] **Step 5: Write the survey/manual brief and generate its exact artifact**

Use a synthetic B2B PoC review product with these facts:

- satisfaction is measured by a named post-PoC survey instrument;
- implementation-readiness evidence is reviewed in a monthly human checklist;
- no automatic event producer exists for either metric;
- no survey result, response rate, or historical baseline is supplied.

The artifact must use `survey` and `manual` modes and must not create fake events merely to obtain `ready`.

- [ ] **Step 6: Adjudicate without polishing source artifacts**

For each new case, record supported facts, invented evidence, mode fitness, real errors, FP/FN, clarity, effort, and publication status. If the host result is wrong, preserve it and use a separate change plan for a resolution attempt.

- [ ] **Step 7: Verify all five modes and unique counting**

```bash
node evaluation/semantic-assurance/evaluate.mjs --json
node evaluation/semantic-assurance/report.mjs --version v0.17.2 --out artifacts/calibration-report
```

Expected: the machine-assessed set covers `event-count`, `event-ratio`, `survey`, `manual`, and `external`. Approved counts include only cases with valid receipts.

- [ ] **Step 8: Commit cases in reviewable units**

```bash
git add evaluation/semantic-assurance/cases/four-way-crm-baseline evaluation/semantic-assurance/cases/four-way-habit-baseline
git commit -m "test: approve reviewed CRM and habit baselines"
git add evaluation/semantic-assurance/cases/external-business-outcome evaluation/semantic-assurance/cases/survey-manual-validation
git commit -m "test: cover external survey and manual measurements"
```

---

### Task 5: Fixed-Brief Host Runs and Final Calibration Report

**Files:**
- Create: `evaluation/semantic-assurance/runs/crm-sales-operations/{claude-code,codex}/{run-01,run-02,run-03}/`
- Create: `evaluation/semantic-assurance/runs/habit-routine/{claude-code,codex}/{run-01,run-02,run-03}/`
- Create: `evaluation/semantic-assurance/reports/v0.17.2/summary.json`
- Create: `evaluation/semantic-assurance/reports/v0.17.2/summary.md`
- Modify: `evaluation/semantic-assurance/four-way-comparison.md`
- Modify: `docs/live-demos.md` only when a case has `publication: public`

**Interfaces:**
- Each run directory contains `run.json`, the exact generated `.sot.json`, and `generation-quality.json`.
- `run.json` follows `semantic-host-run-0.1` and pins plugin `0.17.2`, installed bundle digest, brief/prompt hashes, timestamps, retry count, and artifact digest/hash.
- Runs share the product `conceptId` and KPI concept alignment values; they never increase unique concept/KPI counts.

- [ ] **Step 1: Confirm fresh host installations**

Use the already released `v0.17.2` package. Record Claude Code and Codex CLI versions and installed bundle digest. Do not use the source checkout as the installed plugin.

- [ ] **Step 2: Run three isolated CRM generations per host**

For each host/run combination:

1. create an empty temporary workspace;
2. invoke VibeSpec with the pinned prompt and CRM brief only;
3. provide no clarification answers;
4. preserve the exact SOT and HTML;
5. run structural, content, and semantic verification;
6. store only the synthetic SOT and sanitized run metadata in the evaluation directory.

- [ ] **Step 3: Run three isolated habit generations per host**

Repeat the same procedure with the habit brief. Prior runs, legacy SOTs, reviewer overlays, and other-host outputs must not be visible to the host.

- [ ] **Step 4: Adjudicate host generation quality**

Align each generated KPI to the stable product concept using `exact`, `partial`, `split`, `merged`, `additional`, or `missing`. Record mode fitness, evidence fidelity, invented evidence, ambiguity preservation, readiness calibration, domain specificity, and reviewer correction count.

- [ ] **Step 5: Add gap-driven concepts until the exit gate is honest**

Inspect the report after the six-concept pack. Add independent concepts only when they supply missing KPI volume, failure type, or mode evidence. Stop only after at least 8 approved unique concepts and 30 approved unique KPI concepts; do not count translations or repeated runs.

- [ ] **Step 6: Generate and inspect the tracked report**

```bash
node evaluation/semantic-assurance/report.mjs \
  --version v0.17.2 \
  --out evaluation/semantic-assurance/reports/v0.17.2
```

Confirm raw counts, zero blocker false positives, resolution numerator/denominator, all five modes, host variance, and recommendation evidence.

- [ ] **Step 7: Classify recommendations**

- Put wording, navigation, duplicate findings, mode guidance, and narrow corrections in `0.17.3`.
- Put a new typed semantic relationship in `0.18` only when at least three independent concepts show the same missing contract.
- Put correct-but-confusing behavior in `docs-demo`.
- Put one-off product preferences in `no-change`.

- [ ] **Step 8: Run full repository verification**

From `plugins/vibespec/skills/vibespec`:

```bash
npm run check:all
```

Also run from repository root:

```bash
git diff --check
node evaluation/semantic-assurance/evaluate.mjs
node evaluation/semantic-assurance/report.mjs --version v0.17.2 --out artifacts/final-calibration-check
```

Expected: all checks pass, tracked source paths remain portable, and runtime/plugin files have no behavioral diff unless a separate evidence-backed release task was approved.

- [ ] **Step 9: Commit the evidence report**

```bash
git add evaluation/semantic-assurance docs/live-demos.md
git commit -m "test: publish 0.17.2 semantic calibration evidence"
```

Do not tag a new plugin version from this evidence-only commit. Open separate 0.17.3 and 0.18 work only from the report's approved recommendations.
