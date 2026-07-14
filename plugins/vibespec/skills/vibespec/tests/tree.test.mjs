import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { validateTree } from "../scripts/lib/tree.mjs";
import { sotDigest } from "../scripts/lib/c14n.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const treeDir = join(here, "fixtures", "tree");
const load = name => JSON.parse(readFileSync(join(treeDir, name), "utf8"));
const main = load("main.sot.json");
const payment = load("shop.1-2.payment.sot.json");
const doc = (name, sot) => ({ name, sot });
const clone = v => JSON.parse(JSON.stringify(v));

const hasError = (result, needle) => result.errors.some(e => e.message.includes(needle));
const hasWarn = (result, needle) => result.warnings.some(w => w.message.includes(needle));

// Baseline: the frozen fixture tree is clean. If someone edits main.sot.json,
// its digest changes and this fails (approved child → stale digest = error),
// which is exactly the self-guard we want.
const base = validateTree([doc("main.sot.json", main), doc("shop.1-2.payment.sot.json", payment)]);
assert.equal(base.valid, true, `clean tree must pass: ${JSON.stringify(base.errors)}`);
assert.equal(base.warnings.length, 0, `clean tree must be warning-free: ${JSON.stringify(base.warnings)}`);
assert.deepEqual(base.product.activeSet, ["payment"]);
assert.equal(base.product.productId, "shop");
console.log("[tree] PASS clean product tree validates with no findings");

const cases = [
  ["duplicate path", () => { const p2 = clone(payment); p2.initiative.id = "payment2"; return [main, payment, p2]; }, "duplicate path"],
  ["duplicate id", () => { const p2 = clone(payment); p2.initiative.path = "1-3"; return [main, payment, p2]; }, "duplicate initiative id"],
  ["missing parent scope", () => { const p = clone(payment); p.initiative.parent.scopeId = "ghost"; return [main, p]; }, "does not exist"],
  ["no root", () => [payment], "no 1.0 main"],
  ["two roots", () => [main, clone(main)], "found 2"],
  ["approved stale digest is error", () => { const m = clone(main); m.title = "Changed"; return [m, payment]; }, "digest stale"],
  ["boundary target missing", () => { const p = clone(payment); p.ia.sections[0].pages[0].boundary.pageId = "P99"; return [main, p]; }, "does not exist in scope"],
];
for (const [name, build, needle] of cases) {
  const docs = build().map((sot, i) => doc(`f${i}`, sot));
  assert.ok(hasError(validateTree(docs), needle), `${name}: missing "${needle}"`);
  console.log(`[tree] PASS rejects: ${name}`);
}

// Sibling boundary reference is a tree-level "not an ancestor" error (a self
// reference is caught earlier by validate-sot, so use a sibling here).
const sibling = clone(payment); sibling.initiative.id = "search"; sibling.initiative.path = "1-3";
const crossRef = clone(payment); crossRef.ia.sections[0].pages[0].boundary.scopeId = "search";
assert.ok(hasError(validateTree([doc("m", main), doc("s", sibling), doc("p", crossRef)]), "not an ancestor"),
  "boundary pointing at a sibling scope must error");
console.log("[tree] PASS rejects boundary pointing at a non-ancestor scope");

// Boundary drift is a warning, not an error.
const drifted = clone(payment); drifted.ia.sections[0].pages[0].title = "Renamed stub";
const driftResult = validateTree([doc("m", main), doc("p", drifted)]);
assert.equal(driftResult.valid, true, "drift is a warning, tree stays valid");
assert.ok(hasWarn(driftResult, "title drift"), "boundary title drift must warn");
console.log("[tree] PASS boundary title drift warns but tree stays valid");

// Nested: dropped parent with an approved child is an error.
const droppedParent = clone(payment); droppedParent.initiative.status = "dropped";
const activeChild = clone(payment);
activeChild.initiative.id = "refund";
activeChild.initiative.path = "1-2-1";
activeChild.initiative.status = "approved";
activeChild.initiative.parent = { scopeId: "payment", canonicalization: "sot-c14n-v1", digest: sotDigest(droppedParent) };
activeChild.ia.sections[0].pages[0].boundary = { scopeId: "payment", pageId: "P2" };
assert.ok(hasError(validateTree([doc("m", main), doc("p", droppedParent), doc("c", activeChild)]), "under dropped parent"),
  "approved child under dropped parent must error");
console.log("[tree] PASS rejects active child under a dropped parent");

// Nested: path must extend the parent's path.
const badPathChild = clone(activeChild);
badPathChild.initiative.status = "proposed";
badPathChild.initiative.path = "9-9";
badPathChild.initiative.parent.digest = sotDigest(payment);
badPathChild.initiative.parent.scopeId = "payment";
assert.ok(hasError(validateTree([doc("m", main), doc("p", payment), doc("c", badPathChild)]), "must extend parent path"),
  "child path must extend parent path");
console.log("[tree] PASS rejects child path that does not extend the parent path");

// implemented + stale digest = warning (not error), stays in the active set flagged stale.
const changedMain = clone(main); changedMain.title = "Changed";
const shipped = clone(payment); shipped.initiative.status = "implemented";
const shippedResult = validateTree([doc("m", changedMain), doc("p", shipped)]);
assert.equal(shippedResult.valid, true, "implemented + stale parent is a warning, not an error");
assert.ok(hasWarn(shippedResult, "기준 낡음"), "stale implemented must be flagged 기준 낡음");
assert.deepEqual(shippedResult.product.activeSet, ["payment"], "implemented stays active");
assert.deepEqual(shippedResult.product.staleSet, ["payment"], "and is flagged stale");
console.log("[tree] PASS stale implemented initiative stays active but flagged");

// approved + stale digest = excluded from the active set entirely.
const staleApproved = validateTree([doc("m", changedMain), doc("p", payment)]);
assert.equal(staleApproved.valid, false, "approved + stale = error");
assert.deepEqual(staleApproved.product.activeSet, [], "stale approved is excluded from the active set");
console.log("[tree] PASS stale approved initiative is excluded from the active set");
