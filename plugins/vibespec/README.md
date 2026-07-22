# VibeSpec

**VibeSpec is a free, open-source AI product-planning plugin for Claude and Codex.** It turns product ideas into editable SOT JSON with a PRD, feature spec, information architecture, and user flow, plus a self-contained HTML viewer.

VibeSpec is a dual-format plugin: Claude reads `.claude-plugin/`, OpenAI Codex reads `.codex-plugin/`, and both share the same skill, schema, scripts, and viewer.

## Data and security boundaries

- Node scripts make **no automatic network requests**. They read the SOT paths, schema, and viewer template explicitly supplied to them.
- Scripts write only to an explicit output path, or to the selected SOT when a user explicitly runs an `--apply` command. Generated HTML and change-plan receipts are written only to their requested paths.
- In Chromium browsers, the viewer writes only to a file selected by the user through the browser file picker. Unsupported browsers fall back to a normal download.
- The viewer contains an optional, user-clicked link to [vbspec.com](https://vbspec.com/); it does not send SOT contents there.

## Contents

- **HTML = viewer/editor** · **JSON = SOT data**
- Skill: idea or document → validated SOT JSON with viewer
- Schema: `skills/vibespec/references/sot-schema.md`
- Full installation, usage, and release notes: [repository README](../../README.md)
