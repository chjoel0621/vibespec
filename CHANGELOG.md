# Changelog

All notable changes to VibeSpec are documented here. VibeSpec follows semantic versioning.

## [0.17.0] - 2026-08-04

### Added

- Added optional Semantic Assurance 0.1 for stable KPI, event, and decision identities and typed measurement evidence.
- Added the shared `review-semantic` engine/CLI with deterministic findings, readiness, and evidence-sensitive fingerprints.
- Added a blocker for entity-normalized KPIs that are incorrectly declared as raw event counts without a denominator.
- Covered Korean `율`/`률` and `사용자당`-style normalized KPI names without relying on ASCII word boundaries.
- Added a read-only Semantic Review viewer tab whose embedded verdict becomes stale immediately after SOT edits.
- Added K/E/D query, diff, impact, typed change-plan, and Add-on landing/remap support.

### Changed

- New product plans and Add-ons enable Semantic Assurance by default; existing SOTs remain valid and are never upgraded implicitly.
- Drafts may retain blocked human decisions, but only structurally valid plans with ready measurement evidence may be described as approval or developer-handoff ready.

## [0.16.1] - 2026-08-03

### Changed

- Migrated all 212 catalog template SOTs from flat feature-shaped IA to task-derived navigation with 21 typed surfaces and depth-three workflows.
- Made the template generator repository-relative and added reproducible SOT-only and IA-only refresh paths.
- Applied marketplace participant-group review to product plans while allowing focused Add-ons to target one participant group.

### Fixed

- Removed the legacy IA warning allowlist: all 224 demo SOTs now pass schema and content review without warnings.
- Expanded demo regression coverage to validate every catalog SOT and enforce template navigation depth and surface roles.

## [0.15.0] - 2026-08-03

### Added

- Added operations, consumer, and marketplace generation profiles with profile-aware content review and demo coverage.
- Added an installed-runtime doctor and a host-output acceptance verifier for Claude and Codex installations.
- Added an allowlist-based production packager that excludes tests, build probes, and development-only sources.

### Changed

- Split the skill into a compact router and mode-specific workflow references that are loaded only when needed.
- Made skill-directory discovery and Node.js requirements explicit, with a documented reduced mode for hosts without a usable Node runtime.
- Refined consumer and marketplace demo templates to prioritize real participant actions over generic internal-operations boilerplate.
- Updated checkout and Node setup steps in GitHub CI and Pages workflows to Node 24-based action runtimes.

### Security

- Reduced the installed plugin surface and added regression checks that every packaged runtime dependency is present and executable.

## [0.14.1] - 2026-07-22

### Changed

- Added the official Claude marketplace schema and a clear marketplace description so `claude plugin validate .` passes without warnings.

## [0.14.0] - 2026-07-22

### Added

- Connected SOT file workflow for Chromium browsers: connect an existing SOT, reload external AI edits, and save directly back to the selected file.
- **Save as** workflow that proposes a next-version filename such as `booking-v2.sot.json` and makes the new file the active save target.
- External-change protection before a connected file is overwritten.
- Browser regression coverage for connected-file restore safety, file menu behavior, direct saves, reloads, and conflict handling.

### Changed

- Reopening a viewer now reloads the persisted connected file before it can be saved, preventing stale embedded content from overwriting the source SOT.
- File controls are grouped under a compact **File** menu; toolbar tabs no longer wrap vertically.
- Claude and Codex plugin manifests now share version `0.14.0`.

### Security

- Documented the plugin's file access boundaries and its lack of automatic network requests.
