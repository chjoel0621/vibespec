# Semantic Assurance validation sprint

This directory measures whether Semantic Assurance finds real planning failures
without making ordinary plans harder to author. It is evaluation evidence, not
an extension of the SOT contract: source plans remain the product truth, while
labels, reports, and host metadata stay outside the SOT.

## Exit criteria

The sprint ends on evidence, not elapsed time:

- at least 8 real planning cases and 30 KPIs;
- all five measurement modes (`event-count`, `event-ratio`, `survey`, `manual`,
  and `external`);
- both natural host output and controlled mutations;
- zero blocker false positives in the adjudicated set;
- finding resolution succeeds in at least 90% of attempted cases;
- authoring effort and explanation clarity are recorded, not inferred.

These are internal release gates, not public accuracy claims. Small samples are
reported with raw counts rather than percentages alone.

## Two case lanes

- `natural`: preserve an AI or human-authored output exactly. Record the host,
  plugin version, prompt/brief, artifact hash, advisory findings, and human
  adjudication. Do not silently polish it.
- `controlled-mutation`: begin with a known source and apply explicit change
  plans that create and then resolve one labelled failure. This lane measures
  deterministic detection and regression safety.
- `legacy-comparison`: preserve a pre-semantic SOT, verify that it remains
  `not-assessed`, and compare its KPI vocabulary with other domains. Legacy
  KPIs without measurements are observed but do not count toward the 30-KPI
  assessed exit gate.

Every case has a `case.json`, an immutable source digest, and expected finding
keys. Controlled mutations additionally carry Before and Resolved change plans.
Natural cases preserve host metadata, the exact file SHA-256, and adjudicated
content-review findings. A semantic finding key is the rule id plus its sorted
`subjectRefs`; display copy is intentionally excluded.

## Running the set

```bash
node evaluation/semantic-assurance/evaluate.mjs
node evaluation/semantic-assurance/evaluate.mjs --json
node evaluation/semantic-assurance/evaluate.mjs --case meeting-room-no-show --write artifacts/semantic-evaluation
```

`--write` materializes the derived Before/Resolved SOTs and reports for review.
Those files are disposable evidence; the source SOT and change plans are the
reproducible inputs.

The current legacy comparison and its interpretation are recorded in
[existing-case-comparison.md](existing-case-comparison.md). Comparison-only
documents do not increase the assessed case or KPI exit-gate counts.

## Human evaluation record

For natural cases, reviewers additionally record:

| Field | Meaning |
| --- | --- |
| real errors | Meaning failures confirmed by a human reviewer |
| detected | Whether Semantic Assurance found each error |
| false positives | Findings judged correct in structure but wrong in context |
| false negatives | Confirmed errors with no finding |
| resolution time | Time from reading a finding to a validated fix |
| authoring effort | Friction adding or correcting K/E/D and measurement data |
| explanation clarity | Whether the user understood the finding without schema knowledge |
| host variance | Material differences between fixed-brief Claude and Codex runs |

Do not include private customer data. Public cases must be synthetic,
anonymized, or explicitly approved for publication.
