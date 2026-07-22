# Changelog

All notable changes to VibeSpec are documented here. VibeSpec follows semantic versioning.

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
