# Contributing to VibeSpec

## Change scope

- Develop on a branch and keep changes scoped.
- Never commit workstation paths, credentials, host acceptance artifacts containing private paths, or generated local caches.
- Prefer squash merge for future feature PRs.

## Viewer changes

- Edit viewer source under `src/` and commit the rebuilt viewer only after `npm run build`.
- Do not edit `plugins/vibespec/skills/vibespec/assets/viewer.html` as the source of a change.

## Review checks

Run the plugin checks from `plugins/vibespec/skills/vibespec`:

```text
npm run check:all
```

Run the repository audits from the repository root:

```text
node tools/check-path-leaks.mjs .
node tools/check-doc-links.mjs .
```

Run these checks before requesting review. See [Development](docs/development.md) for the complete command reference and [Security](SECURITY.md) for reporting rules.
