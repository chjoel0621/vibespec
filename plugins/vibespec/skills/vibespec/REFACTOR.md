# Viewer refactor — modular source, single-file output

## Goal & invariant
- **SOT stays one.** The data model (single SOT JSON) does not change.
- **End-user artifact stays a single self-contained HTML.** Users still receive one `viewer.html` (with SOT embedded) that opens anywhere with no server/build. Do **not** split the shipped file into multiple runtime files.
- **Source becomes modular.** Developers edit small files under `src/`; a build inlines them into `assets/viewer.html`.

## Layout
```
skills/vibespec/
├── src/
│   ├── head.html         # static chrome: topbar, tabs, drawers (no logic)
│   ├── styles.css        # the whole <style> block
│   └── js/               # plain scripts, one shared scope, concatenated in filename order
│       ├── 00-config.js  # esc, SCHEMA_VERSION, LS_KEY, PRIO/STAT, VIEWNAME(_EN), PTYPE(_EN)
│       ├── 10-i18n.js    # LANG, t(ko,en), ptype(), applyStaticI18n()
│       ├── 20-state.js   # SEED, normalize(), deriveFlow(), SOT/VIEW/selection globals
│       ├── 30-history.js # snapshot, pushHistory, undo/redo, restoreTo, renderHistory
│       ├── 40-io.js      # canonicalSOT/stableStringify (save), load, SOT modal
│       ├── 50-render.js  # render() dispatch + shared helpers (specCatalog, allPages, flowMeta, coverage…)
│       ├── 55-prd.js     # renderPRD + persona/scenario/kpi renders
│       ├── 60-spec.js    # renderSpec (3-col directory)
│       ├── 65-detail.js  # renderDetail + renderTrace + renderProgress
│       ├── 70-ia.js      # renderIA + renderIADetail + iaPageLi + iaFillMissing/buildIAFromSpec
│       ├── 75-tree.js    # renderTree + layoutTree
│       ├── 80-flow.js    # computeFlow + renderFlow + layout/zoom/focus
│       ├── 85-flow-edit.js # flowCoverage, triggerSelect, renderFlowEditPanel
│       └── 90-init.js    # ALL event listeners + boot sequence (must be LAST)
├── build.mjs             # zero-dependency Node build (no npm install needed)
├── references/           # human-readable contract + executable JSON Schema
├── scripts/              # SOT 1.0 validator
├── tests/                # schema, viewer round-trip, and browser flow regression tests
├── package.json          # npm run build / npm run check
└── assets/viewer.html    # BUILT OUTPUT (do not hand-edit after migration)
```

## Build
- `npm run build` → `node build.mjs` inlines `styles.css` + `head.html` + concatenated `js/*.js` (filename order) into `assets/viewer.html` as one self-contained file. Zero dependencies (offline).
- `npm run check` → build + syntax check + JSON Schema/semantic tests + viewer export and legacy-promotion round trips + Claude/Codex manifest and marketplace contracts. It needs no browser.
- `npm run check:all` → `check` + a headless Chrome/Edge 45-node/53-edge layout regression at desktop and mobile viewports.
- The skill embeds the generated SOT into the built file's `<script id="embedded-sot">` exactly as today.

## Why concatenation (not ES modules/bundler)
The current app is one scope of plain functions/globals with a strict top-to-bottom execution order (config → state → functions → wiring/init last). Concatenating files in numeric order preserves that exactly, needs no bundler, and keeps diffs and mental model simple. `90-init.js` MUST sort last.

## Status — migration COMPLETE (2026-07-10)
- All CSS/HTML/JS was extracted **verbatim, line-for-line** from the pre-migration `viewer.html` into `src/` (verified by multiset line diff — zero lines added, dropped, or changed).
- `npm run check` passes; `assets/viewer.html` is now the built output (`build.mjs` OUT switched from `build/` to `assets/`).
- Verified in browser against the built file: all 5 views render without errors, KO/EN toggle, edit + undo/redo, history drawer, IA coverage banner, flow focus/edit panel, localStorage persistence.
- **From now on: edit `src/`, run `npm run build` (or `npm run check`), and commit the rebuilt `assets/viewer.html` together with the `src/` change.** Never hand-edit `assets/viewer.html`.

Note: the starter `00-config.js` from the earlier (file-sync-broken) session had a corrupted `esc()` (`"<":"<"` instead of `"&lt;"`); it was replaced by the verbatim original during migration.
