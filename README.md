# VibeSpec

**🌐 언어 / Language: English (current) · [한국어](./README.ko.md)**

> Like vibe coding — but for **product planning.**
> Drop in a product idea or a planning document, and VibeSpec organizes it into a single **SOT (Single Source of Truth, JSON)**, then lets you view and edit the **PRD · Feature Spec · IA (Information Architecture) · User Flow** all in one screen.

VibeSpec is a dual-format **plugin marketplace** for Claude Cowork / Claude Code and OpenAI Codex. Describe an idea or attach a document (business plan, PRD draft, meeting notes), and the AI generates a schema-compliant SOT JSON that opens in a dedicated HTML viewer for immediate editing.

**🕹️ [Live demo](https://chjoel0621.github.io/vibespec/en/)** — ask "turn my product idea into a planning tool" or attach a business plan, and the skill produces an HTML just like this demo. Try the viewer in your browser right now, no install needed. It opens with a sample product in English (a meeting-room booking app); everything is editable, and Save exports the SOT JSON. A [Korean demo](https://chjoel0621.github.io/vibespec/) is also available.

## Core idea

- **HTML = the app (viewer/editor)** · **JSON = the data (SOT)** — the two are kept separate.
- Every view reads and writes **one SOT**. Fix something in one place and the rest sync automatically.
- Share the viewer (app) once; after that, **just exchange the JSON file** to see the same thing.

## Five views

| View | What it shows |
| --- | --- |
| **PRD** | Overview · Problem/Value · Users · Success Metrics · Scope · Risks/Assumptions (6 sections). Persona cards, scenario → user-flow linking, structured KPIs (target · measurement + feature links). |
| **Feature Spec** | Requirement → Feature → Sub-feature (status · priority · description · acceptance criteria). The detail panel shows **connections (IA screens · user flow · KPIs)** and a **progress summary** (status breakdown · acceptance-criteria completion); click a chip to jump to that view. |
| **Tree** | A node canvas of the requirement hierarchy. Click a node to jump to the Feature Spec. |
| **IA (Information Architecture)** | Section → Page → Action sitemap. Feature-to-screen mapping, missing-coverage warnings, and auto-fill. |
| **User Flow** | A screen-transition graph (start → screen navigation, branches/loops, zoom/pan). Add or remove transitions from a panel; link a trigger to a feature and its label auto-syncs; warnings for unconnected/missing screens. |

## Installation

How you install depends on your environment. Claude and Codex use different plugin commands; the `/plugin` slash commands below are **Claude Code terminal only** and do **not** work in Cowork or Codex.

### Cowork (desktop app)

Install through the UI:

1. Open **Customize** in the left sidebar.
2. Go to the **Plugins** tab → under **Personal plugins**, click **`+`** → **Add marketplace**.
3. Choose to add from a **GitHub repository** and enter `https://github.com/chjoel0621/vibespec.git`.
4. From the added marketplace, click **Install** on `vibespec`.
5. Updates are done from the same Plugins screen.

> Note: In Cowork, `/plugin` is not recognized ("only works in the Claude Code terminal"). Use the UI path above.

### Claude Code (CLI · terminal)

Run these in the input box (terminal), one after another:

```
/plugin marketplace add https://github.com/chjoel0621/vibespec.git
/plugin install vibespec@vibespec
```

To update, run `/plugin marketplace update vibespec`, then update it from the Installed tab of the `/plugin` manager.

### OpenAI Codex (CLI / desktop app)

Clone the repository, register its repo-local marketplace, and install the plugin:

```
git clone https://github.com/chjoel0621/vibespec.git
codex plugin marketplace add <absolute-path-to-the-cloned-vibespec-repo>
codex plugin add vibespec@vibespec
```

Start a new Codex task after installing or updating so the plugin skills are loaded. Invoke it naturally or explicitly with `$vibespec`.

## Usage

Ask something like "turn my product idea into a planning tool" or attach a business plan, and the skill produces a viewer HTML with the SOT JSON embedded. Open it and all five views appear immediately — edit, save, and load right there.

**Updating an existing plan:** attach your `*.sot.json` with a request like "rename F3 and add an acceptance criterion." The skill applies a minimal edit — every existing id stays stable — then validates the result and reports exactly what changed, what it touches (screens, transitions, KPIs), and which sections are untouched byte-for-byte.

### If the skill doesn't auto-trigger (invoke it manually)

The skill fires automatically on natural-language requests, but if it doesn't, you can call it directly.

- **Cowork (desktop app):** type `/` in the prompt box or click the **`+`** button, then pick **VibeSpec** from the skills list.
- **Claude Code (terminal):** run `/vibespec:vibespec`.
- **Codex:** select the VibeSpec plugin/skill or invoke `$vibespec` in a new task.

## Tips for getting the most out of it

- **For team collaboration, share only the JSON file.** The viewer (HTML) is the app, so you only need to hand it out once. After that, exchange the `*.sot.json` file you get from Save (JSON export); the other person opens it in the same viewer via Load and sees the **exact same five views**. No more copying around heavy documents.

- **Edit once, in the Feature Spec.** Because every view reads and writes one SOT, renaming a feature automatically updates the user-flow label, the KPI link, and the IA mapping. Never retype the same thing in multiple places.

- **Draft with AI, then refine in the viewer.** Don't try to write it perfectly from scratch — generating an SOT from an idea or business plan and then editing in the viewer is the fastest path.

- **Trust the history before big changes.** Undo/history can restore any point in time, and Reset returns to the first version. Change things boldly.

- **Use the warnings as a roadmap.** The IA "missing coverage" and user-flow "unconnected" indicators tell you which screens/transitions are missing. Use auto-fill to lay down a skeleton quickly, then refine.

- **Check impact with connections (traceability).** The connection (IA · user flow · KPI) and progress summary in the Feature Spec detail panel let you answer "what breaks if I drop this feature?" before development starts.

- **Link features to KPIs and start-screens to scenarios.** Once metric-to-feature and scenario-to-flow are connected, they auto-update when names change, and you can click a chip to jump straight there. Your PRD becomes a living hub.

- **Version-control your `*.sot.json`.** Keeping the SOT file in git or a drive gives you change history and backups. This JSON is exactly the spec you'll hand off to developers or AI coding agents.

## Optional: version control with Git (for teams)

**Git is not required.** Working solo, the viewer's undo/history (auto-saved in your browser) is enough, and sharing just means handing someone the `*.sot.json` file by any means you like. What follows is for **editing together** or when you want **durable history**.

Because the data lives in a plain `*.sot.json` file, you can put it under Git and let Git handle history, branching, review, and rollback — no extra tooling needed.

- **Save produces a Git-friendly file.** Export (Save) writes canonical JSON — stable key order and pretty-printing, with a `schemaVersion`. The filename is stable (`<title>.sot.json`, no date), so you drop the downloaded file straight over the tracked one and Git sees an edit rather than a delete-plus-add. The same content always serializes identically, so a diff shows only what actually changed.
- **Recommended workflow.** Edit in the viewer → **Save** → replace the `*.sot.json` in your repo → commit / open a PR. Teammates pull and open the file in the same viewer to see the exact same five views.
- **`.gitattributes`.** Add this so the SOT is treated as text with consistent line endings:

  ```
  *.sot.json text eol=lf
  ```

- **Merges.** The canonical format keeps most diffs readable and conflicts hand-resolvable.

## Repository structure

```
vibespec/
├── .agents/plugins/marketplace.json   # Codex repository marketplace
├── .claude-plugin/marketplace.json     # Plugin catalog
├── plugins/vibespec/
│   ├── .codex-plugin/plugin.json       # Codex plugin manifest
│   ├── .claude-plugin/plugin.json
│   └── skills/vibespec/
│       ├── agents/openai.yaml          # Codex skill UI metadata
│       ├── SKILL.md                    # Skill: idea/document → SOT JSON (+ targeted edits)
│       ├── references/sot-schema.md    # JSON data contract (schema)
│       ├── references/sot.schema.json  # Machine-readable JSON Schema
│       ├── scripts/
│       │   ├── validate-sot.mjs        # Single-file validator (structure, refs, coverage)
│       │   ├── diff-sot.mjs            # Change + impact-radius report between two SOTs
│       │   ├── embed-sot.mjs           # Inline a SOT into the viewer's embedded-sot tag
│       │   └── lib/                    # Shared: c14n (sot-c14n-v1), diff, tree, rebase
│       ├── tests/                      # Validator, viewer round-trip, and headless-flow regressions
│       ├── assets/viewer.html          # HTML viewer (app) — BUILT OUTPUT
│       ├── src/                        # Viewer source (styles.css, head.html, js/NN-*.js)
│       ├── build.mjs                   # Inlines src/ into the single-file viewer
│       └── package.json                # npm run build · check · validate
├── demo/meeting-room-booking.ko.sot.json  # Korean demo SOT (deployed to /)
├── demo/meeting-room-booking.en.sot.json  # English demo SOT (deployed to /en/)
├── .github/workflows/                  # CI (build + tests) and Pages demo deploy
├── LICENSE
├── README.md                           # English (default)
└── README.ko.md                        # Korean
```

### Working on the viewer

`assets/viewer.html` is generated. Edit the modules under `src/`, then rebuild and commit both:

```
cd plugins/vibespec/skills/vibespec
npm run check       # build + syntax + schema/round-trip + Claude/Codex plugin contracts
npm run check:all   # check + Chrome/Edge dense-flow layout regression
```

Validate a generated or edited SOT file with the command below. It enforces the JSON Schema and checks duplicate IDs, IA feature coverage, and KPI, scenario, and user-flow references.

```
npm run validate -- path/to/product.sot.json
```

To compare two versions of a SOT — what changed, what it touches (screens, transitions, KPIs), and what is byte-identical:

```
node scripts/diff-sot.mjs before.sot.json after.sot.json
```

For an older SOT, load it in the viewer and save it once to promote it to the 1.0 format, then validate the newly saved file. Loading normalizes legacy KPI, scenario, and field shapes.

The build concatenates `src/js/*.js` in filename order into one shared scope, so `90-init.js` (event wiring and boot) must always sort last. There are no npm dependencies or install step. A local Chrome or Edge installation is required only for `npm run check:browser` or `npm run check:all`.

## License

[MIT](./LICENSE) © 2026 chjoel0621
