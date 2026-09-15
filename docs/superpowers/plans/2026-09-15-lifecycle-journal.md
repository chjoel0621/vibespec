# Lifecycle Journal Implementation Plan

> **For agentic workers:** Execute sequentially with TDD and verification-before-completion. User requested autonomous continuation; no new approval ceremony for the agreed candidate scope. No deployment or commits.

**Goal:** Preserve captured planning history and expose pending review without inventing approval.

**Architecture:** Pure journal planning/analysis, constrained filesystem storage,
and an opt-in CLI that wraps existing engines. Records are persisted before source
writes and act as an explicit recovery intent.

**Tech Stack:** Dependency-free Node ES modules and existing SOT engines.

**Spec:** [Candidate design](../specs/2026-09-15-lifecycle-journal-design.md).

## Global constraints

- SOT schema/canonicalization unchanged; history is opt-in and snapshot-based.
- Every automatic review is machine evidence, never human approval.
- Existing workspace/user modifications are preserved.
- No guessed resolution for policy conflicts, corrupted history or foreign locks.

## Task 1: Pure journal

Files: `scripts/lib/lifecycle-journal.mjs`, `tests/lifecycle-journal.test.mjs`.
Also extend `scripts/lib/merge.mjs` with optional `reservedIds`, preserving the
existing allocator defaults for non-journal callers.
Consumes normalized `{name,sot}[]`, immutable record array and explicit intent.
Produces `planLifecycle(records, docs, intent)`, `inspectLifecycle(records, docs)`
and `verifyJournal(records)`. Each record's `digest` hashes all other fields;
`previous` binds it to the previous record.

- [x] Test empty history, valid enrollment, chained snapshots and tampering.
- [x] Observe failure before implementation.
- [x] Test retired F#/spec/child IDs, unrelated scope IDs and duplicate identities.
- [x] Test parent impact, stale report binding and pending merge task persistence.
- [x] Implement with real applyChangePlan / planRebase / planMerge.

Representative assertion:
```js
const p = planLifecycle([], docs, {kind:"init", reason:"Enroll baseline"});
assert.equal(inspectLifecycle([p.record], docs).productApproval, "not-assessed");
assert.throws(() => planLifecycle(history, retired, reuseIntent), /retired ID/);
```

## Task 2: Storage, CLI and interruption safety

Files: `scripts/lib/lifecycle-store.mjs`, `scripts/lifecycle.mjs`,
`tests/lifecycle-store.test.mjs`.
Consumes pure plans; produces `runLifecycle(root, intent, {apply})`, read-only
`readLifecycle(root)` and explicit dead-lock release through the CLI.

- [x] Test default dry-run causes zero writes; apply creates new journal records.
- [x] Test unknown file contents, stale plans, damaged/foreign history and paths.
- [x] Simulate interruption by persisting a real plan record before applying its
  source writes; recovery must restore only recognized before/after contents.
- [x] Test actual lock contention and explicit dead/live lock behavior.
- [x] Test malformed CLI flags, ID lookup and immutable no-overwrite records.
- [x] Implement exclusive record publication, source compare-before-write,
  atomic per-file replacement, inspectable incomplete state and recovery.

Representative assertion:
```js
runLifecycle(root, intent, {apply:false});
assert.equal(existsSync(join(root,"history")), false);
assert.equal(runLifecycle(root,{kind:"recover"},{apply:true}).status,"current");
```

## Task 3: Integration and autonomous handoff

Files: `tests/lifecycle-managed.test.mjs`, `package.json`,
`references/lifecycle-journal.md`, `docs/lifecycle-journal.md`, implementation report.

- [x] Replay all three synthetic six-stage cases through real journal storage.
- [x] Confirm rebase does not resolve policy review, merge retains residual work,
  retired IDs are rejected and no unrelated data is changed.
- [x] Add focused npm command and include tests in test/check.
- [x] Document opt-in command usage, limitations, recovery and human review boundary.
- [x] Verify packaged runtime includes new dependencies and run check:all.
- [x] Review the candidate and stop only at real product decisions, release
  approval, ambiguous corrupted inputs or other authority boundaries.

Verification: `npm run check:all` and focused journal tests passed on 2026-09-15.
Independent code review findings were reproduced, fixed and rechecked. See
[implementation report](../../reports/2026-09-15-autonomous-lifecycle-candidate.md).
This completes the agreed candidate mechanics, not product policy approval,
real-host release acceptance, deployment or full roadmap C–E.
