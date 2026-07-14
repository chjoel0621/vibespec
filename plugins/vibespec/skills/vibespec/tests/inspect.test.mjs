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
const m = inspectDocs([doc("main.sot.json", main)]);
assert.equal(m.hasMain, true);
assert.equal(m.initiativeCount, 0);
assert.equal(m.nextPath.root, "1-1", "first initiative under a fresh main is 1-1");
assert.deepEqual(m.suggestedModes, ["edit", "initiative"]);
console.log("[inspect] PASS a lone main suggests edit/initiative and issues 1-1");

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
