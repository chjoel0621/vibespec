import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { inspectDocs } from "../scripts/lib/inspect.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const treeDir = join(here, "fixtures", "tree");
const load = name => JSON.parse(readFileSync(join(treeDir, name), "utf8"));
const main = load("main.sot.json");
const payment = load("shop.1-2.payment.sot.json");
const doc = (name, sot) => ({ name, sot });
const clone = v => JSON.parse(JSON.stringify(v));

// A full tree: classification, next-path issuance, and mode suggestions.
const t = inspectDocs([doc("main.sot.json", main), doc("shop.1-2.payment.sot.json", payment)]);
assert.equal(t.hasMain, true);
assert.equal(t.initiativeCount, 1);
assert.equal(t.files.find(f => f.kind === "initiative").id, "payment");
assert.equal(t.tree.valid, true);
assert.deepEqual(t.tree.activeSet, ["payment"]);
assert.equal(t.nextPath.root, "1-3", "next root path is max(existing)+1 (1-2 exists → 1-3)");
assert.equal(t.nextPath.payment, "1-2-1", "next child of payment extends its path");
assert.ok(t.suggestedModes.includes("edit") && t.suggestedModes.includes("initiative") && t.suggestedModes.includes("map"));
assert.equal(t.needsRebase, false);
console.log("[inspect] PASS classifies a tree, issues next paths, suggests modes");

// A lone main: no initiatives, first path is 1-1, no map/rebase.
const m = inspectDocs([doc("main.sot.json", main)], { fromFolder: true });
assert.equal(m.hasMain, true);
assert.equal(m.initiativeCount, 0);
assert.equal(m.nextPath.root, "1-1", "first initiative under a fresh main is 1-1");
assert.deepEqual(m.suggestedModes, ["edit", "initiative"]);
console.log("[inspect] PASS a lone main suggests edit/initiative and issues 1-1");

// Path authority: a folder scan is authoritative; an explicit file list is not
// (sibling initiatives may be missing → a number could be re-issued).
assert.equal(inspectDocs([doc("main", main)], { fromFolder: true }).pathAuthority, "complete");
assert.equal(inspectDocs([doc("main", main)]).pathAuthority, "incomplete", "an explicit file list must flag path issuance incomplete");
console.log("[inspect] PASS path authority is complete only for a folder scan");

// A structurally invalid tree (missing boundary target) offers only repair —
// never edit/initiative/map (which would act on a broken tree).
const badTarget = clone(payment); badTarget.ia.sections[0].pages[0].boundary.pageId = "P99";
const bad = inspectDocs([doc("main", main), doc("pay", badTarget)], { fromFolder: true });
assert.ok(bad.invalidReason && /structural/.test(bad.invalidReason), "invalid tree must expose a reason");
assert.deepEqual(bad.suggestedModes, ["repair"], "an invalid tree offers only repair");
console.log("[inspect] PASS structurally invalid tree offers only repair");

// Two mains in one folder is invalid → repair, with mainCount exposed.
const twoMains = inspectDocs([doc("a", main), doc("b", clone(main))], { fromFolder: true });
assert.equal(twoMains.mainCount, 2);
assert.ok(/multiple main/.test(twoMains.invalidReason), "two mains must be flagged");
assert.deepEqual(twoMains.suggestedModes, ["repair"], "two mains offers only repair (not generate)");
console.log("[inspect] PASS two mains in a folder offers only repair");

// A lone initiative (no main): incomplete — the skill must ask for the main
// before any tree operation. No actionable mode, and generate is NOT offered.
const i = inspectDocs([doc("x", clone(payment))]);
assert.equal(i.hasMain, false);
assert.equal(i.tree, null);
assert.equal(i.incompleteTree, true, "an initiative without its main is flagged incomplete");
assert.deepEqual(i.suggestedModes, [], "no actionable mode until the main is provided");
console.log("[inspect] PASS a lone initiative without a main is flagged incomplete");

// Editing the main makes the initiative stale → rebase is flagged and offered,
// and the map drops out (a stale-approved tree can't be composed).
const changedMain = clone(main); changedMain.title = "Changed";
const r = inspectDocs([doc("main", changedMain), doc("pay", payment)]);
assert.equal(r.needsRebase, true);
assert.deepEqual(r.staleInitiatives, ["payment"]);
assert.ok(r.suggestedModes.includes("rebase"), "stale tree must suggest rebase");
assert.ok(!r.suggestedModes.includes("map"), "a stale-approved tree drops the map option");
console.log("[inspect] PASS flags rebase and drops map when the main has drifted");

// No files at all → generate.
const empty = inspectDocs([]);
assert.deepEqual(empty.suggestedModes, ["generate"]);
console.log("[inspect] PASS empty input suggests generate");
