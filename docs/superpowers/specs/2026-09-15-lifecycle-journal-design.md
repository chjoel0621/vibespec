# Optional lifecycle journal candidate

User-approved intent: proceed through work that does not require product
decisions or human approval. Preserve compatibility; no migration or deployment.
This is an architectural candidate implementing deterministic lifecycle mechanics,
not adoption of new product-policy fields from roadmap C.

## Decision and alternatives

Use an opt-in sidecar journal around the existing pure change/rebase/merge
engines. This preserves SOT 1.0/1.1 and viewer round trips. Embedding lifecycle
fields in SOT would require schema/ID policy adoption; Git-only history would
exclude file-only users. Neither is necessary for this candidate.

## Contract

- Canonical workspace: main.sot.json and initiatives/**/*.sot.json.
- Immutable sequential records in history/lifecycle/records/*.json contain full
  before/after documents, previous-record digest, reason and engine input/report.
- A content hash detects accidental tampering, not authorship or approval.
- Journal is authoritative only for captured history; initialization cannot
  reconstruct earlier deleted IDs or infer deployed behavior.
- IDs are scoped by main/root or stable initiative ID. Definition IDs R/F/S/P/
  K/E/D and F#:index are reserved after disappearance, including disappeared
  scopes. Safe apply/capture rejects reuse. Merge allocates fresh IDs above
  current and captured IDs, including pending semantic remaps, and preserves
  its normal explicit ID mapping report; it never rebinds a retired identity.
- Existing tools remain compatible but bypass this opt-in guard. External edits
  appear as drift and require explicit capture before further guarded writes.
- Automated content/measurement reports are bound to document digests. New
  changes mark prior results stale. No automatic product approval.
- Every change leaves a pending content-review task. Parent changes additionally
  identify affected descendants from explicit parent links, conservatively;
  prose-level policy dependency completeness is not claimed.
- Merge records preserve the real engine's ID maps and manualPrdReview /
  manualSemanticReview as pending tasks. Later rebase never closes them.
- An automated report cannot close human review tasks. This candidate has no
  approval or human-decision receipt ingestion command.

## Durable writes and recovery

Persist one complete immutable intent record before modifying SOT files. Each
source file is replaced atomically; multiple files are not a single transaction.
Read-only status compares current files against the head's before/after snapshots:
head matches = current; every file matches before or after = recoverable pending
write; any unknown contents or file-set change = external drift, do not overwrite.
Recovery explicitly completes the recorded after state, is idempotent and cannot
roll back unrecognized changes. Explicit capture may acknowledge external drift
with a reason, but not a known pending transaction or retired-ID violation.
Each completed write gets a separate immutable digest-bound completion receipt.
This distinguishes an interrupted intent from an external edit made after a
completed transaction. Without this marker, capture cannot advance the journal,
even if current external contents no longer match the before/after snapshots.
The marker proves file-write completion only, never product/content approval.

An exclusive local lock prevents concurrent journal writers. A crashed lock can
only be released explicitly when its recorded process is no longer running on
this host. Corrupt/foreign/live locks fail closed. No process is terminated.
Filesystem paths are constrained to the workspace; symlinked journal/source
paths are refused. Malformed history, unknown versions and broken chains block
mutation rather than being reconstructed from guesses. Records are not deleted.

## Interface

`node scripts/lifecycle.mjs <workspace> init|status|capture|apply|rebase|merge|recover|unlock`

Mutations default to dry-run; `--apply` opts in. New events require `--reason`.
`apply` also takes `--scope` and `--plan`; `merge` takes `--initiative`.
`status --id <scope>/<local-id>` returns retirement/history context.
All commands support `--json`; malformed options fail. No workspace is migrated
or enrolled just by invoking the old commands or opening a viewer.

## Verification and release boundary

Exercise real engines and real temporary files: dry-run, snapshot preservation,
unknown/missing history, hash drift, external edits, ID reuse, scoped IDs, stale
checks, pending merge tasks, crash recovery, locking and path escape rejection.
Replay the three existing six-stage cases via this journal, retaining the old
unguarded characterization suite; the final retired-ID reintroduction must now
be refused. Add a CLI-only handoff summary so no new viewer contract is needed.
Run full package/browser regression; do not alter public or private service
source files, install caches, version numbers, commits or deployments.
