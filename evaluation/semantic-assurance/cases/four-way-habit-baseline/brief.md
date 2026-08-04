# Habit tracker semantic comparison brief

## Provenance

This is a reconstructed evaluation brief, not the original prompt that created
`demo/habit-tracker-app.ko.sot.json`. It contains only product facts explicitly
present in that legacy SOT. Legacy KPI wording, semantic ids, and proposed
measurement answers are intentionally omitted from the generation input.

## Product

Plan a web habit and routine tracker for an individual user. The product should
connect habit setup, daily check-ins, streaks, reminders, weekly reflection, and
pattern insights so the user can see progress and choose a next action.

The MVP must support:

- habit frequency, reminder time, and start-date setup;
- completion and skip records;
- streak, weekly completion, time-of-day, and per-habit trend views;
- reminder consent, schedule, pause, and frequency controls;
- weekly reflection and next-action adjustment;
- export, deletion, privacy controls, and optional sharing.

Known measurement facts:

- habit creation, completion, skip, reminder adjustment, export, and deletion
  can be represented as product interactions;
- the product has not decided which behavior is the single "first-week core
  action" that proves initial value;
- no production baseline, retention result, or research result is available.

Do not invent baseline values, survey findings, event availability, or a core
action decision. Preserve the core-action choice as an explicit open decision.
