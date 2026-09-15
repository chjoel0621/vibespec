# Semantic Assurance 0.17 calibration sprint design

## 1. Purpose

VibeSpec 0.17.2 proves that Semantic Assurance can be installed and invoked in
Claude and Codex. The next question is product quality rather than host
compatibility:

> Does Semantic Assurance expose real planning failures without creating
> misleading blockers or making ordinary planning too hard to author?

This sprint answers that question with reviewed product cases. It does not add
new SOT fields or expand the semantic rule engine before evidence shows which
change is needed.

## 2. Current baseline

The existing evaluator reports the following baseline on 2026-08-10:

- 3 assessed case artifacts;
- 7 assessed KPIs;
- 2 covered measurement modes: `event-ratio` and `external`;
- 2 labelled failures, both detected;
- 6 legacy comparison artifacts that remain correctly `not-assessed`;
- 2 reviewer baseline candidates containing 6 candidate KPIs, not yet counted.

The three assessed artifacts are not three independent product concepts.
WeekChef Korean and English are locale variants of the same product plan.
Accordingly, future progress must be counted by unique product concept, not by
artifact or translation count.

## 3. Scope

### 3.1 In scope

- Complete a first six-concept calibration pack.
- Cover all five measurement modes: `event-count`, `event-ratio`, `survey`,
  `manual`, and `external`.
- Record human adjudication, false positives, false negatives, resolution
  effort, authoring effort, explanation clarity, and host variance.
- Separate deterministic engine quality from AI generation quality.
- Preserve source SOTs and prompts without silent cleanup.
- Produce a versioned internal report that decides the 0.17.3 and 0.18 scope.
- Extend the pack after the first six concepts until the existing exit gate of
  at least 8 unique product concepts and 30 unique assessed KPIs is met.

### 3.2 Out of scope

- New semantic contract fields.
- Typed authentication, authorization, or integration policy rules.
- Public accuracy claims from the small evaluation sample.
- Bulk migration of legacy demo files.
- Treating locale translations or repeated host runs as independent product
  cases.
- Changing a source SOT merely to make the evaluator pass.

## 4. Evaluation model

### 4.1 Counting unit

Every case manifest gains a stable `conceptId`. Artifacts may additionally
declare `locale`, `host`, and `runId`.

- `uniqueConcepts` counts distinct `conceptId` values.
- `uniqueAssessedKpis` counts a KPI concept once within a `conceptId`, even when
  the plan has Korean and English variants or repeated host runs.
- Locale variants verify translation and rendering consistency.
- Repeated host runs measure generation variance.
- Neither may inflate the real-case or KPI coverage gates.

Existing case IDs remain stable. `conceptId` is evaluation metadata and never
enters the SOT or its digest.

### 4.2 Evidence lanes

The existing lanes remain and gain one explicit approval state:

- `natural`: an unmodified host or human-authored output.
- `controlled-mutation`: a pinned source plus explicit Before and Resolved
  change plans.
- `legacy-comparison`: an unchanged pre-semantic SOT, excluded from assessed
  KPI counts.
- `reviewer-baseline-candidate`: a proposed human baseline, excluded from
  assessed counts.
- `reviewer-baseline`: a candidate with a separate signed approval receipt.
  Only this approved form contributes to assessed coverage.

No lane may infer human approval from a green engine result.

### 4.3 Two scorecards

Deterministic engine quality and generation quality are reported separately.

**Engine scorecard**

- labelled semantic errors;
- true positives, false positives, and false negatives;
- blocker false positives;
- finding fingerprint stability;
- successful Before to Resolved transitions.

**Generation scorecard**

- measurement mode fitness;
- evidence fidelity and invented evidence count;
- preservation of ambiguity as an open decision;
- readiness calibration: correct, overconfident, or underconfident;
- domain-specific KPI quality;
- number of fields and product decisions requiring reviewer correction;
- material variance between fixed-brief Claude and Codex runs.

A template-shaped KPI or weak product choice is generation-quality evidence. It
is not automatically a Semantic Assurance false negative unless an approved
deterministic rule was expected to find it.

## 5. First six product concepts

| Concept | Source and lane | Primary purpose |
| --- | --- | --- |
| `meeting-room-no-show` | Existing controlled mutation | Event-ratio failure, open decision, producer/surface/flow resolution |
| `weekchef` | Existing natural Claude output; KO/EN are one concept | Passing event-ratio and external evidence without invented baselines |
| `crm-sales-operations` | Existing reviewer baseline candidate, then fixed-brief host runs | Event-ratio/manual ambiguity and actionable decision wording |
| `habit-routine` | Existing reviewer baseline candidate, then fixed-brief host runs | Retention ratios, consumer event evidence, and unresolved product choices |
| `external-business-outcome` | New natural or reviewed case | External source ownership, refresh cadence, and separation from internal UI events |
| `survey-manual-validation` | New natural or reviewed case | Legitimate survey/manual measurement without unnecessary event producers |

The final two or more concepts needed for the 8-concept/30-KPI gate are chosen
after this pack reveals the remaining coverage gaps. They must add missing
evidence rather than merely increase the count. Candidate domains include a
campaign ROI workflow, a B2B PoC success review, and an operational compliance
audit.

## 6. Human adjudication contract

Each assessed concept has a separate adjudication record. At minimum it stores:

- reviewer identity or stable reviewer alias;
- review timestamp and reviewed artifact digest;
- confirmed real errors and their expected finding keys;
- findings judged false positive, with rationale;
- confirmed false negatives, with the missing relationship described;
- time to understand each finding;
- time and steps required to reach a validated resolution;
- authoring effort for K/E/D and measurement data;
- explanation clarity using `clear`, `partly-clear`, or `unclear`;
- unresolved product decisions;
- publication permission: `private`, `anonymized`, or `public`.

Approval is an immutable receipt outside the adjudication file so that approval
cannot rewrite the evidence it approves. The evaluator verifies the receipt's
adjudication hash before counting the concept or its KPIs.

## 7. Workflow

### Phase A: stabilize the baseline

1. Add `conceptId` and unique-count aggregation without changing SOTs.
2. Add the human adjudication and approval-receipt contracts.
3. Approve or revise the CRM and habit reviewer baselines before any new host
   result is shown to the reviewer.
4. Re-run the current evaluation set and publish the corrected unique counts.

### Phase B: run the six-concept pack

1. Preserve each brief, source digest, artifact hash, plugin version, and host
   version.
2. Run fixed-brief Claude and Codex generation only for CRM and habit, where
   host variance is an explicit question.
3. Add one external-outcome case and one survey/manual case.
4. Adjudicate each result without editing the source artifact.
5. Apply explicit change plans for attempted resolutions and measure resolution
   time.

### Phase C: close the exit gate

1. Review mode and KPI coverage after the first six concepts.
2. Add at least two gap-driven concepts until there are 8 unique concepts, 30
   unique assessed KPIs, and all five modes.
3. Require zero adjudicated blocker false positives.
4. Require at least 90% of attempted findings to reach a validated resolution.
5. Report raw counts alongside percentages.

### Phase D: product decision

Classify findings rather than mixing them into one release:

- **0.17.3:** wording, navigation, duplicate findings, host guidance,
  measurement-mode guidance, or a narrowly corrected existing rule.
- **0.18:** a new typed relationship or policy only when the same missing
  contract recurs across at least three independent concepts and cannot be
  expressed by existing K/E/D evidence.
- **Documentation/demo:** correct engine behavior that users did not understand.
- **No change:** a one-off product decision or domain preference.

## 8. Outputs

The sprint produces:

- updated manifests and immutable approval receipts under
  `evaluation/semantic-assurance/cases/`;
- versioned machine-readable and Markdown summaries under
  `evaluation/semantic-assurance/reports/v0.17.2/`;
- disposable materialized SOT/report artifacts outside tracked source inputs;
- a 0.17.3 candidate list grouped by evidence category;
- one passing public example and one Before/Finding/Resolved public example,
  selected only from cases approved for publication.

The public demo remains a presentation of approved evidence. It is not the
evaluation database and does not become an additional source of truth.

## 9. Failure handling

- Source digest drift fails evaluation before adjudication is read.
- Missing or stale approval receipts keep a baseline in candidate status.
- Unknown measurement modes or unsupported evaluation contracts fail closed.
- Host failure is recorded as a run failure, not silently retried into a clean
  result. Retries remain visible.
- Private or unapproved source content must not enter tracked public fixtures.
- A green structural or semantic check never overrides a human finding about
  unsupported product facts.

## 10. Verification

Automated checks must prove:

- locale variants and repeated runs do not increase unique concept/KPI counts;
- candidate baselines do not count without a valid approval receipt;
- a changed adjudication invalidates its prior receipt;
- all five measurement modes are counted from approved assessed KPIs only;
- expected findings still compare by rule ID plus sorted subject references;
- Before and Resolved artifacts remain reproducible from pinned sources and
  change plans;
- the full repository check remains green without modifying runtime behavior.

Manual review must confirm:

- each labelled error is genuinely wrong in product context;
- each blocker explains what is missing and what the user should do next;
- a nontechnical planner can identify the affected KPI, event, feature, screen,
  flow, or decision without reading raw schema fields;
- the proposed resolution does not invent research results, baselines, or
  external system capabilities.

## 11. Completion criteria

The calibration sprint is complete only when:

1. at least 8 unique product concepts and 30 unique assessed KPI concepts are
   approved;
2. all five measurement modes are represented;
3. both natural output and controlled mutation evidence are present;
4. blocker false positives are zero in the approved set;
5. at least 90% of attempted findings are resolved and revalidated;
6. authoring effort and explanation clarity are recorded for every newly
   assessed concept;
7. Claude/Codex variance is measured from fixed briefs without counting runs as
   new concepts;
8. 0.17.3 and 0.18 candidates are justified by recorded evidence.
