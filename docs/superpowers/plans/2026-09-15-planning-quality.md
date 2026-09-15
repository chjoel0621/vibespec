# Planning Quality Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans for sequential execution. No delegation is required. Steps use checkbox syntax for tracking.

**Goal:** Expose empty detailed specifications and distinguish content review from structural validity and KPI measurement readiness.

**Architecture:** Extend the existing advisory reviewer with a purpose option outside the SOT. Preserve schema, canonicalization and semantic reports; update CLI, authoring instructions and viewer explanations together.

**Tech Stack:** Dependency-free Node ES modules, existing JSON SOT and generated HTML viewer.

**Spec:** [Evolution roadmap](../specs/2026-09-15-vibespec-evolution-roadmap.md), phase A.

## Global Constraints

- No automatic schema migration or inserted SOT fields.
- Existing `valid` is advisory compatibility, not a structural or delivery verdict.
- Purpose: `overview | current-state | change`, default `current-state`; independent of audience profile.
- In overview mode, missing detail is information, not a blocker. Known generic claims remain advisory warnings.
- No invented approval, operating facts or measurement baselines.
- Existing dirty files outside this scope remain user-owned; no commit or deployment in this task.

## Task 1: Reviewer and CLI

Files: `scripts/lib/content-review.mjs`, `scripts/review-sot.mjs`, `tests/content-review.test.mjs` under the plugin skill.

Consumes: `reviewSot(sot, { profile })`. Produces: `reviewSot(sot, { profile, purpose })` with context, information count and explicit assessment limits; unchanged SOT input.

- [x] Add regression tests that erase descriptions/acceptance of 31 synthetic specs; expect 31 missing-description and 31 missing-acceptance findings.
- [x] Add tests for overview information, explicit concrete criteria, generic KO/EN sentences, unsupported purpose, CLI purpose forwarding, no input mutation.
- [x] Run tests and verify failures identify the missing behavior.
- [x] Add conservative full-sentence generic checks and spec-level findings with stable F#:index paths and next questions.
- [x] Add CLI `--purpose`, reject malformed/unknown options, print review limits and info separately.
- [x] Run reviewer and semantic/evaluation regressions; retain historical adjudications and explain any changed findings rather than rewriting them into success.

## Task 2: Instructions and measurement explanation

Files: `SKILL.md`, `references/workflows/{common,create,edit,initiative,rebase,merge}.md`, `src/js/56-semantic.js`, `tests/browser-semantic.mjs`, generated `assets/viewer.html`, `docs/workflows.md`.

- [x] Describe purpose selection and actor/precondition/input/result/exception/verification prompts using existing fields.
- [x] Replace delivery-ready equivalence with three separate assessment descriptions; document limitations for rebase and merge.
- [x] Add rendered KO/EN measurement scope assertions to existing viewer tests, observe failure, then add explanatory UI copy.
- [x] Build the viewer and run content, semantic, round-trip and browser semantic checks.

## Completion

- [x] The 31-spec reproduction is detected without reading private service data into public fixtures.
- [x] Existing valid files and not-assessed legacy behavior remain supported.
- [x] Record test results and remaining limitations in the implementation report.

Phase B has a separate implementation plan; phase C/D data contracts are excluded.

Implementation verification: `npm run check:all` passed on 2026-09-15. See
[implementation report](../../reports/2026-09-15-planning-quality-and-lifecycle-foundation.md).
This checklist covers the implementation foundation, not human calibration,
real-host release acceptance or deployment.
