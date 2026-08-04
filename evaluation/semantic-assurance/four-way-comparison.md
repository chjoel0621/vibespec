# Same-brief four-way comparison

This experiment separates deterministic engine behavior from generation
quality. It compares two domains, CRM operations and a consumer habit tracker,
using four artifact roles:

1. immutable legacy SOT (`not-assessed`);
2. reviewer baseline overlay candidate;
3. fresh Claude host generation from the frozen brief;
4. fresh Codex host generation from the same frozen brief.

The briefs are reconstructed evaluation inputs because the original prompts
were not preserved. Their provenance is explicit, and they omit legacy KPI
wording, semantic ids, and proposed measurement answers. They must not be
described as the historical source prompts.

## Ordering and approval gate

The baseline overlay is written before new host generations to reduce anchoring
on model output. Its current status is `candidate-needs-human-approval`.
Candidate KPI counts and modes do not satisfy sprint exit criteria until a human
reviewer approves the adjudication record. Host runs must not silently convert a
candidate into an approved baseline.

After approval, run Fresh Generation first. Legacy Upgrade is a separate later
experiment because it measures preservation and minimal editing rather than
from-scratch generation quality.

## KPI-level scoring

Score every KPI independently:

| Field | Question |
| --- | --- |
| domain specificity | Does it name a real product action or work event? |
| mode fitness | Is the measurement mode appropriate for its denominator and owner? |
| evidence fidelity | Is every asserted fact present in the frozen brief or resulting SOT? |
| invented evidence | Did the run invent an event, baseline, integration, or research result? |
| ambiguity handling | Did it preserve an unresolved fact as a decision? |
| production evidence | Does an event point to a real feature, system task, dependency, or manual process? |
| interaction evidence | Does a user event have an IA page or flow trigger? |
| review effort | How many fields and product decisions did a reviewer need to change? |
| readiness | Is it ready, at-risk, or blocked after deterministic review? |
| content quality | Is the KPI templated or mismatched to the domain? |

`ready` alone is not a success. A successful run is ready without invented
evidence and is materially consistent with the approved reviewer baseline.

## Metrics stay separate

Engine metrics apply only to labelled deterministic failures: TP, FP, FN,
blocker false positives, and finding fingerprint stability.

Generation metrics apply to natural host output: appropriate mode choices,
invented evidence count, uncertainty preserved as decisions, domain-specific
KPI count, reviewer edits, and variance across repeated runs. Template reuse is
a generation-quality observation, not automatically a Semantic Assurance FN.

## Repetition

The target is three independent Fresh Generation runs per host and domain. A
single run can prove host compatibility but cannot support conclusions about
model consistency. Each run must pin the host, plugin version, brief hash,
artifact hash, and whether it was fresh generation or legacy upgrade.

Start each run from
[`templates/four-way-host-run.template.json`](templates/four-way-host-run.template.json)
and score it with
[`templates/generation-quality.template.json`](templates/generation-quality.template.json).
Templates are not evaluation cases and contain no claimed result.

Use only the frozen brief as product input in a fresh workspace. Ask the host to
use VibeSpec normally and preserve the final SOT and HTML. Do not expose the
legacy SOT, reviewer overlay, another host's output, or a prior run until Fresh
Generation is complete.
