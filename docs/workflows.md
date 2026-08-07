# Planning Workflows

VibeSpec keeps the JSON SOT as the planning source and regenerates the HTML viewer from it. The workflows below describe how to create, change, review, and land plans without silently broadening scope.

## Create a plan

Describe a product idea or attach a business plan, PRD draft, or meeting notes. VibeSpec creates a SOT JSON and viewer HTML. New plans declare how each KPI will be measured and include a derived KPI Measurement Check. A result that still needs a decision or supporting evidence can be delivered as a draft, but it is not labeled ready for approval or developer handoff.

## Resolve a semantic decision

In KPI Measurement Check, answer the question and choose **Save answer**. The answer is recorded in the SOT, but the decision remains open. Save the JSON, then attach it to Claude or Codex with the copy-ready request shown in the viewer.

VibeSpec updates only the affected KPI, event, feature, page, and flow through a reviewed change plan. It reruns structural, content, and measurement checks and closes the decision only after those checks pass. It then regenerates the current JSON and HTML.

## Make a scoped edit

Attach the current `*.sot.json` and request a bounded change, such as renaming `F3` or adding an acceptance criterion. Existing IDs remain stable. VibeSpec reports what changed, what it affects, and which sections remain byte-identical.

For large plans, the skill queries only the requested requirement, feature, specification, section, screen, or PRD fields. It applies a typed `change-plan-v2` with a base digest, explicit IDs, and expected diff paths. Applied plans and before/after digest receipts belong in `history/change-plans/`; `outputs/` contains only the current SOT and HTML.

## Add an initiative

Attach the main `*.sot.json` and ask for a scoped increment. VibeSpec creates a separate `<product>.<path>.<id>.sot.json` initiative with its own lean PRD and a boundary that identifies its attachment screen. The main plan remains unchanged, so the initiative can be reviewed, approved, and shipped independently.

Each initiative records the digest of the parent plan it was created against. Boundary and initiative metadata changes remain deliberate tree operations because they require cross-file validation.

## Rebase a plan tree

When a parent changes, inspect and validate the tree, then rebase affected initiatives from root to leaf:

```text
node scripts/inspect.mjs path/to/product-folder
node scripts/validate-tree.mjs path/to/product-folder
node scripts/rebase.mjs path/to/product-folder
```

The rebase command is a dry run unless `--apply` is added.

## Review and integrate

Keep `main.sot.json` at the product root and initiatives under `initiatives/`. The workspace builder creates a self-contained `workspace.html` for reviewing proposed, approved, and implemented initiatives. It also creates a release map where proposed work remains excluded.

```text
node scripts/workspace.mjs path/to/product-folder
node scripts/product-map.mjs path/to/product-folder --html map.html
```

The read-only product map composes the main plan with active initiatives. Composite IDs preserve provenance, and selecting a node opens the source plan that defines it. Proposed and dropped initiatives are listed as excluded.

## Merge and land

After an initiative is implemented and the product tree validates, preview landing that initiative into the main plan:

```text
node scripts/merge.mjs path/to/product-folder --only <id>
```

The merge command is a dry run unless `--apply` is added. Revalidate the tree and regenerate review or integrated views after applying it.

## Collaborate with Git

Git is optional. For durable team history, keep `*.sot.json` files under version control. In Chrome or Edge, **File -> Connect file** selects the SOT that **Save** updates; **Save as** creates and selects a new version. Other browsers download the same canonical JSON.

Use this repository attribute for consistent text diffs:

```gitattributes
*.sot.json text eol=lf
```

A typical team flow is: edit in the viewer, save the SOT, commit it on a branch, open a pull request, and have teammates pull the same JSON into the shared viewer. Stable key order, pretty printing, and `schemaVersion` keep diffs focused, while normal JSON conflicts remain manually resolvable.

See [Architecture](architecture.md) for the SOT/viewer boundary and [Live demos](live-demos.md) for working examples of these flows.
