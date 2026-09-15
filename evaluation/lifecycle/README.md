# Lifecycle evaluation foundation

This suite asks whether a planning asset retains useful context as a service
changes. It uses **synthetic, hand-authored fixtures**, not real host generation
or human-approved service policies. It does not add fields to the SOT contract.

## Cases and replay

Three domains have distinct policy wording and review questions:

- campaign consent: confirmation before linking a creator;
- room booking: cancellation cutoff before reservation start;
- CRM export: current consent before including a contact.

Each follows six changes through the existing engines: add a feature, change
the parent policy, rebase an initiative, merge it, retire a feature, and
reintroduce its old IDs. Initial SOTs and definitions have pinned digests.
Change plans contain literal expected impact. Stage reports preserve the input,
before/after tree digests, main-document diff, observed limitations, content and
measurement reviews, and both main/initiative snapshots. Unrelated requirements
and screens must remain unchanged.

## Run

From the repository root:

```sh
node evaluation/lifecycle/evaluate.mjs
node evaluation/lifecycle/evaluate.mjs --json
node evaluation/lifecycle/evaluate.mjs --case room-booking
node evaluation/lifecycle/evaluate.mjs --write outputs/lifecycle-review-new
```

The default run is read-only. `--write` requires a new directory and never
overwrites an existing review packet. Each packet includes `report.json` and,
per concept, the initial state, six stage files and `human-review.json`.
From the plugin skill directory, `npm run test:lifecycle` runs the focused test
and evaluator. Both evaluation suites are included in `npm test` and `npm run check`.

## Meaning of results

`reproducibility=passed` means that the expected engine behavior was reproduced,
including its present limitations. It does not mean the service or planning
asset is approved. `lifecycleReadiness=needs-human-review` remains explicit.

The cases currently characterize these gap candidates:

1. Updated parent policies can coexist with old initiative policy text without
   a policy-conflict finding from the content reviewer.
2. Rebase can refresh the parent digest while leaving initiative text unchanged.
3. Merge can land features while leaving policy/KPI review to the user.
4. Retired IDs can be reintroduced; the evaluation keeps the retirement reason,
   but the final SOT does not preserve that reason by itself.

These are deliberately constructed stress cases, not evidence of their
frequency in real service maintenance. Three domains share the same transition
pattern, so their recurrence alone does not justify a new runtime contract.
The `policyConflictDetectedByRuntime` observation checks this content-review
invocation for a policy-conflict code; it is not an exhaustive claim about
every workflow or the agent's ability to notice prose contradictions.

Human review status is pending. Ask a reviewer to inspect each stage snapshot
and answer the domain questions, record the reviewed digests, confirmed gaps,
false alarms, missed issues, review effort, and handoff time. This runner does
not yet ingest or validate approval receipts. Editing `human-review.json` does
not convert a replay into approval. Generation quality, human false-positive /
false-negative rates, authoring effort and handoff time remain not-assessed.

Repeated identical runs do not increase unique concept/transition coverage.
Conflicting runs under one concept ID fail and need explicit case versioning.
This suite is independent of Semantic Assurance's 8-concept/30-KPI/5-mode
calibration targets; its synthetic lifecycle cases are not added to those counts.

## Independent journal logic audit

`logic-matrix.mjs` tests the opt-in journal candidate against literal expected
truth tables using real temporary files and the public CLI. It covers completion
receipts, before/after/unknown file combinations, stale evidence, malformed
inputs/history, and retired identities. It is separate from the raw-engine gap
characterization above and from the default regression gate.

```sh
node evaluation/lifecycle/logic-matrix.mjs --write outputs/lifecycle-logic-audit-new.json
```

The parent output directory must exist and the report file must be new. Failures
produce exit code 1 and remain failures: the runner does not relabel a discovered
defect as expected behavior. See the [2026-09-15 audit report](../../docs/reports/2026-09-15-lifecycle-logic-validation.md)
for the 92-case scope, four failing values from one input-validation defect, and
the explicit limits of this synthetic verification.

The input-validation defect was subsequently fixed with the expectations intact:
the [post-fix run](../../outputs/lifecycle-logic-audit-after-fix-2026-09-15.json)
passes all 92 cases. Focused malformed-input and valid-default regression tests
now run in `test:journal`, `test`, and `check`; the complete matrix remains a
separate audit command. Earlier failing reports are retained as historical evidence.

## Shop-tree release holdout

`holdout.mjs` uses the existing shop/payment fixture family rather than the three synthetic
fixtures used by the logic matrix. Its 18 new integration scenarios exercise single-root
workspaces, interrupted enrollment/new-file capture, filename-only moves, scope deletion,
missing-parent diagnostics, root impact across three descendants, eight partial-write
states for a four-document rebase, consecutive sibling merges, 20 captures plus ten no-ops,
and a Unicode/spaced workspace through the CLI. This is different scenario coverage, not
18 new products or a statistical sample of production failures.

```sh
node evaluation/lifecycle/holdout.mjs --write outputs/lifecycle-holdout-new.json
```

The first run found 16 passing cases and two failures: filename moves vanished from the
handoff summary (not from snapshots), and capture dereferenced a missing parent. Both
were subsequently fixed without relaxing the original expectations; the
[post-fix run](../../outputs/lifecycle-holdout-after-path-parent-fix-2026-09-15.json)
passes 18/18. The [initial release report](../../docs/reports/2026-09-15-lifecycle-holdout-release.md)
remains historical evidence. Fresh installed-host acceptance is still required for release.

## Third-round process and repair resilience

`resilience.mjs` adds 12 different scenarios: whole-workspace relocation, two-file path
swaps, simultaneous move/edit, restoring or reparenting after parent removal, three
child-process exits with incomplete intent/lock state, competing process writers,
malformed lock ownership, redirected source folders, and malformed source JSON.

```sh
node evaluation/lifecycle/resilience.mjs --write outputs/lifecycle-resilience-new.json
```

The runner uses temporary fixtures and real child processes, not mocked locks. Interruption
points are explicitly placed after publishing an intent and after zero, one, or two
fixture source writes. This is not random fault injection, a power-loss simulation, or
proof of all race conditions. Expected failures check unchanged file bytes; raw SyntaxError
for malformed JSON is an explicit rejection, distinct from dereferencing a missing parent.

The [initial run](../../outputs/lifecycle-resilience-2026-09-15.json) passes 12/12. Repeated
runs do not add coverage or constitute new independent products. See the
[fix and third-round report](../../docs/reports/2026-09-15-lifecycle-path-parent-resilience.md)
for the overall 92 + 18 + 12 result and remaining release boundary.
