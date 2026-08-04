# CRM semantic comparison brief

## Provenance

This is a reconstructed evaluation brief, not the original prompt that created
`demo/crm.ko.sot.json`. It contains only product facts explicitly present in
that legacy SOT. Legacy KPI wording, semantic ids, and proposed measurement
answers are intentionally omitted from the generation input.

## Product

Plan a web-first CRM for a 10-100 person B2B SaaS sales organization. Sales
representatives and RevOps need one connected workflow for leads, accounts,
contacts, opportunities, activities, follow-up tasks, pipeline reporting, and
role-based administration.

The MVP must support:

- manual lead entry and CSV import;
- duplicate detection, validation, assignment, and an auditable status history;
- opportunity stage, amount, expected close date, probability, and next action;
- calls, email, meetings, notes, tasks, due dates, reminders, and owner queues;
- dashboards for pipeline, activities, tasks, and lead performance;
- OAuth-based email/calendar integration with disconnect and audit paths;
- role-based access, team structure, required fields, and audit logs.

Known measurement facts:

- managed follow-up tasks have an owner, due time, status, and status-change time;
- audit logs record core administrative changes;
- report and source records can be linked, but the exact eligible population
  and successful-link condition have not been decided;
- no production baseline or observed result is available yet.

Do not invent baseline values, customer research, event availability, or an
external system that is not named above. Preserve undecided measurement details
as an explicit open decision.
