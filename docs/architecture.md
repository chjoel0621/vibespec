# Architecture

## JSON SOT and HTML app

VibeSpec separates data from presentation:

- The `*.sot.json` file is the Single Source of Truth for product planning data.
- The HTML file is the self-contained viewer and editor application.
- Every viewer surface reads and writes one SOT, so a change in one view is reflected in related PRD, feature, IA, flow, and KPI references.
- Teams can share the viewer once and exchange only the JSON file for later plan revisions.

The generated viewer is an application artifact, not a second planning source. The source and build rule are documented in [Development](development.md).

## Plugin manifests

The repository exposes VibeSpec through two marketplace formats:

- `.agents/plugins/marketplace.json` registers the repository marketplace for Codex.
- `.claude-plugin/marketplace.json` is the Claude plugin catalog.
- `plugins/vibespec/.codex-plugin/plugin.json` is the Codex plugin manifest.
- `plugins/vibespec/.claude-plugin/plugin.json` is the Claude plugin manifest.
- `plugins/vibespec/skills/vibespec/` contains the shared skill, workflow references, schemas, scripts, viewer source, and built viewer.

Host-specific installation is kept in [Getting started](getting-started.md).

## Package boundary

`plugins/vibespec/skills/vibespec/package-plugin.mjs` writes the minimal runtime bundle to `.dist/vibespec`. The packaged boundary excludes tests, `.build/`, and development-only files. Package checks exercise the installed form so repository-only files do not become hidden runtime dependencies.

The JSON schema and workflow references travel with the skill. Scripts resolve installed paths from the skill directory rather than assuming a particular workstation checkout.

## Network boundary

VibeSpec's Node.js scripts make no automatic network requests. They read only the SOT paths, schema, and viewer template explicitly supplied to them.

The viewer contains an optional link to [vbspec.com](https://vbspec.com/) that opens only after a user click. SOT contents are not sent to that site.

## Write boundary

Node.js scripts write only to explicit output paths or to a selected SOT when the user explicitly runs an `--apply` command. Dry-run tree and change-plan commands do not write their proposed changes.

The browser viewer writes only to a file the user selected through the file picker. In browsers without that file connection, saving downloads canonical JSON instead.

These boundaries do not expand the host's capabilities. Full and reduced runtime support is described in [Getting started](getting-started.md#runtime-support).
