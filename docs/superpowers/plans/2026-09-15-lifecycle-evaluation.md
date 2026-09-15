# Lifecycle Evaluation Implementation Plan

> **For agentic workers:** Execute sequentially with superpowers:executing-plans. No delegation is required.

**Goal:** Reproduce six successive planning changes in three synthetic service concepts and expose present limitations without claiming human approval.

**Architecture:** Evaluation-only case definitions generate valid pinned SOT inputs. A replay runner uses the existing typed change-plan, rebase and merge engines, retains per-stage snapshots/digests/impact, and compares literal expected observations. It reports reproducibility separately from lifecycle readiness. No new runtime SOT contract.

**Tech Stack:** Node ES modules, assert/node:test, existing plugin pure engines.

**Spec:** [Evolution roadmap](../specs/2026-09-15-vibespec-evolution-roadmap.md), phase B execution foundation.

## Global Constraints

- Synthetic, candidate-only cases; no private service source or invented human assessment.
- Six stages: add, policy change, rebase without reconciliation, merge with residual review, retirement, reintroduction.
- Plans have explicit expected paths. Do not derive expected change paths from actual diffs.
- Source snapshot digests are pinned; mutations or unsupported case data fail.
- Engine reproducibility PASS never means lifecycle/product approval.
- Human review, generation quality and handoff timing remain not-assessed until genuine records exist.
- Existing Semantic evaluation remains independent. Deduplicate its concepts and KPI IDs explicitly.

## Task 1: Replay and candidate cases

Create `evaluation/lifecycle/{cases.mjs,replay.mjs,evaluate.mjs,README.md}` and `plugins/vibespec/skills/vibespec/tests/lifecycle-evaluation.test.mjs`.

Consumes: existing `applyChangePlan`, `planRebase`, `applyRebase`, `planMerge`, `diffReport`, `validateSot`.

Produces: `replayCase(definition)` with stage snapshots/plans/results and candidate review questions; `summarize(results)` with distinct concept counts, known gaps and not-assessed human quality; CLI prints JSON or a concise report and writes only with `--write`.

- [x] Write tests for actual replay, pin drift, unchanged source, stale policy after rebase, manual merge review, retired ID reuse, duplicate concept counting and CLI errors.
- [x] Run failing tests before implementation.
- [x] Create three domain-specific synthetic briefs and pinned initial SOTs/initiatives.
- [x] Replay explicit plans; compare expected behavior, including current limitations.
- [x] Materialize one local report for human review; make every stage and residual question inspectable.
- [x] Integrate the runner/tests into existing npm test/check scripts.

## Task 2: Semantic distinct counting

Create an evaluation summary helper and focused tests; add explicit conceptId metadata to existing case manifests.

- [x] Test locale/repeated run deduplication and candidate exclusion with hand-authored metrics.
- [x] Count unique concept + KPI ID pairs; require matching measurement modes for repeated KPI IDs.
- [x] Preserve prior case counts and expectations; add distinct coverage rather than rewriting historical numbers.
- [x] Explicitly report whether 8 concepts/30 KPIs/5 modes are covered; do not imply human calibration approval.

## Task 3: Verification and handoff

- [x] Run new tests, existing evaluation, full non-browser regression and browser checks affected by phase A.
- [x] Record phase A implementation status, phase B candidate coverage, current lifecycle gaps and human review work separately.
- [x] Keep phase C/D and real host release acceptance outside completed claims.

Implementation verification: `npm run check:all` passed on 2026-09-15. See
[implementation report](../../reports/2026-09-15-planning-quality-and-lifecycle-foundation.md).
This checklist covers the implementation foundation, not human calibration,
real-host release acceptance or deployment.
