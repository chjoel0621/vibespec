# Semantic Assurance 0.1

Semantic Assurance checks whether a structurally valid plan declares enough
evidence to measure its KPIs. It does not calculate KPI values, validate SQL,
or replace human product judgment.

The measurement chain checked by semantic 0.1 is KPI -> structured measurement
-> declared production evidence -> user interaction evidence when the event is
user-produced. A user event needs a feature producer and either an IA page or an
existing flow trigger. Semantic 0.1 does not require both IA and flow evidence,
and it does not claim to prove a complete KPI -> event -> feature -> page -> flow
chain.

## Compatibility

- `schemaVersion` keeps its current meaning: `1.0` is a product plan and `1.1`
  is an Add-on.
- Semantic Assurance is explicitly enabled by top-level
  `semantic.contractVersion: "semantic-0.1"`.
- A SOT without `semantic` remains valid and reports `not-assessed`.
- Loading or saving a legacy SOT must not add `semantic`, KPI ids, measurements,
  empty arrays, or empty objects.
- Enabling the contract is a deliberate migration/change-plan operation. It is
  never a viewer normalization side effect.
- `sot-c14n-v1` is frozen. New semantic keys use its existing fallback ordering;
  changing canonical key priority requires a new canonicalization version.

## Stable ids

- KPI: `K1`, `K2`, ...
- Measurement event: `E1`, `E2`, ...
- Decision: `D1`, `D2`, ...

Ids are local to one SOT scope, never reused after deletion, and must be
renumbered with all references when an Add-on is landed into the product plan.
Flow transitions do not gain a new id in semantic-0.1. User-event flow evidence
is derived from the existing transition feature `ref`.

## Measurement modes

- `event-count`: count one declared event in a window.
- `event-ratio`: compare an occurrence or absence against one population event.
- `survey`: name the survey instrument and window; events are not required.
- `manual`: name the manual process and frequency; UI evidence is not required.
- `external`: name the external source, metric, and refresh cadence.

For an event ratio, numerator and denominator must use the same
`populationEventRef`. Exclusions are event references, not free-form formula
tokens. Semantic 0.1 verifies that declared evidence exists; it does not verify
join keys, grace periods, analytics SQL, or the resulting numeric value.
An entity-normalized metric such as “exports per active household” is not an
event count: it needs an `event-ratio` population denominator or an `external`
aggregate that owns that denominator.

## Scope boundary

Semantic 0.1 validates references inside the current SOT scope. It does not
infer whether a producer feature is included in MVP from the natural-language
`inScope` and `nonGoals` arrays. Therefore “measurement blocked by product
scope” is not a semantic 0.1 guarantee. Deterministic scope-blocking rules are
deferred until scope membership has machine-addressable references; open
decisions can still declare `blocks-measurement` explicitly today.

## Event producers

An event can have multiple producers.

- `feature`: references an existing `F#` or `F#:index`.
- `system-task`: inline name and design evidence for a scheduled/background task.
- `external-dependency`: inline name and integration evidence.
- `manual-process`: inline responsible product role and process evidence.

The initial contract deliberately avoids undeclared `ST#`, `X#`, or flow `U#`
namespaces. If those concepts later become first-class SOT entities, they need a
separate migration and stable-id contract.

Evidence requirements depend on event type:

- user: a feature producer plus an IA page or existing flow trigger.
- system: a feature or system-task producer; no screen is required.
- external: an external-dependency producer.
- manual: a manual-process or feature producer.

## Assessment and readiness

Assessment describes the result of a rule:

- `not-assessed`, `unknown`, `passed`, `failed`, `not-applicable`.

Readiness is derived from assessment findings:

- `ready`, `at-risk`, `blocked`.

A document without the semantic contract has assessment `not-assessed` and no
measurement readiness value. `failed` is a fact about a rule; `blocked` is the
derived consequence for the next workflow stage.

## Findings

Findings are derived output and are not written into the SOT. Their fingerprint
is based on rule id/version, scope, sorted subject/evidence references, normalized
evidence content, and severity. Display wording is excluded, so copy changes do
not create a new issue while changed evidence does stale the old fingerprint.

The open-source plugin does not store approvals, waivers, comments, or audit
history. Those belong to an optional governance ledger/SaaS layer.
