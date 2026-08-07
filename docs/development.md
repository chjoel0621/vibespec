# Development

## Repository tree

```text
vibespec/
|-- .agents/plugins/marketplace.json
|-- .claude-plugin/marketplace.json
|-- plugins/vibespec/
|   |-- .codex-plugin/plugin.json
|   |-- .claude-plugin/plugin.json
|   `-- skills/vibespec/
|       |-- agents/openai.yaml
|       |-- references/
|       |-- scripts/
|       |-- tests/
|       |-- src/
|       |-- assets/viewer.html
|       |-- build.mjs
|       |-- package-plugin.mjs
|       `-- package.json
|-- demo/
|-- evaluation/semantic-assurance/
|-- tools/
|-- docs/
|-- CONTRIBUTING.md
|-- SECURITY.md
|-- README.md
`-- README.ko.md
```

The plugin's `references/` directory contains the JSON data contract and mode-specific instructions. `scripts/` contains validation, inspection, change-plan, rebase, merge, map, workspace, migration, and host-verification tools. The root `tools/` directory contains repository documentation, path-audit, and optional marketing helpers.

## Viewer build rule

`plugins/vibespec/skills/vibespec/assets/viewer.html` is generated. Edit viewer modules only under `src/`, run the build, and commit the rebuilt viewer with the source change. The build concatenates `src/js/*.js` in filename order into one shared scope, so `90-init.js` must remain last.

The plugin itself has no npm dependencies or install step. A local Chrome or Edge installation is required only for `npm run check:browser` or `npm run check:all`.

## Build, test, and package

Run plugin commands from the skill directory:

```text
cd plugins/vibespec/skills/vibespec
npm run build
npm test
npm run check
npm run check:all
npm run package:plugin
```

- `npm run build` rebuilds the self-contained viewer.
- `npm test` runs the non-browser test suite.
- `npm run check` rebuilds and runs syntax, schema, round-trip, workflow, plugin-contract, host, package, and evaluation checks.
- `npm run check:all` adds the Chrome or Edge browser-flow suite.
- `npm run package:plugin` writes the minimal runtime bundle to `.dist/vibespec`.

## Validate plans and trees

Validate a generated or edited SOT:

```text
npm run validate -- path/to/product.sot.json
```

This checks the JSON Schema, duplicate IDs, IA feature coverage, and KPI, scenario, and user-flow references. Common tree and review commands are:

```text
node scripts/inspect.mjs path/to/product-folder
node scripts/validate-tree.mjs path/to/product-folder
node scripts/diff-sot.mjs before.sot.json after.sot.json
node scripts/review-sot.mjs main.sot.json
node scripts/review-semantic.mjs main.sot.json --json
```

Load and save an older SOT in the viewer to promote it to the 1.0 format, then validate the newly saved file. Loading normalizes legacy KPI, scenario, and field shapes.

## Repository checks

From the repository root, run:

```text
node --test tools/tests/*.test.mjs
node tools/check-path-leaks.mjs .
node tools/check-doc-links.mjs .
```

The path audit scans tracked files. The documentation check validates relative Markdown targets and GitHub-style heading anchors.

## Optional marketing tools

The `tools/` package is separate from the plugin runtime. Run every command in this section from the repository root. Install its locked development dependency only when using the screenshot helper:

```text
npm --prefix tools install
npm --prefix tools test
```

Screenshot capture requires a local Chrome installation and an explicit marketing repository root:

```powershell
$env:VIBESPEC_MARKETING_ROOT = '<marketing-root>'
npm --prefix tools run capture -- [template-slug ...]
```

Batch template generation can be run directly:

```text
node tools/generate-template-batch.mjs --sot-only
```

`--sot-only` keeps generation independent of the separate marketing repository. Running without that flag also requires `VIBESPEC_MARKETING_ROOT`.

Contribution checks and pull request expectations are in [CONTRIBUTING.md](../CONTRIBUTING.md).
