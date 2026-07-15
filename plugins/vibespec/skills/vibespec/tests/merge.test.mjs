import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { planMerge } from "../scripts/lib/merge.mjs";
import { validateSot } from "../scripts/validate-sot.mjs";
import { validateTree } from "../scripts/lib/tree.mjs";
import { sotDigest } from "../scripts/lib/c14n.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const treeDir = join(here, "fixtures", "tree");
const load = name => JSON.parse(readFileSync(join(treeDir, name), "utf8"));
const main = load("main.sot.json");
const payment = load("shop.1-2.payment.sot.json");
const doc = (name, sot) => ({ name, sot });
const clone = v => JSON.parse(JSON.stringify(v));
const implemented = () => { const p = clone(payment); p.initiative.status = "implemented"; return p; };

// Happy path: an implemented initiative folds into the main with renumbered ids;
// its boundary stubs resolve (screens graft under the main target); the result is
// a valid 1.0 doc; the initiative is marked landed; the report is complete.
{
  const r = planMerge([doc("main", main), doc("pay", implemented())], "payment");
  assert.equal(r.ok, true, `merge must succeed: ${r.error}`);
  assert.equal(r.main.schemaVersion, "1.0", "the merged main stays 1.0");
  assert.equal(validateSot(r.main).valid, true, `merged main must validate: ${JSON.stringify(validateSot(r.main).errors)}`);
  // payment's "Pay" (P2) became P3, grafted under the main's Cart (P2) — the boundary target.
  const cart = r.main.ia.sections[0].pages[0].children[0]; // S1 › P1 › P2 (Cart)
  assert.equal(cart.id, "P2", "sanity: the boundary target is the main Cart page");
  assert.ok(cart.children.some(c => c.id === "P3" && c.title === "Pay"), "the increment screen becomes a native child of the main target");
  assert.deepEqual(cart.children.find(c => c.id === "P3").refs, ["F2"], "the grafted screen's feature ref is renumbered into the main space");
  assert.ok(r.main.requirements.some(q => q.id === "R2" && q.features[0].id === "F2"), "the initiative requirement folds in renumbered");
  assert.ok(r.main.flow.transitions.some(t => t.from === "P2" && t.to === "P3" && t.ref === "F2"), "the initiative flow folds in remapped");
  assert.equal(r.landed.initiative.status, "landed", "the merged initiative is marked landed");
  assert.deepEqual(r.report.addedPages, ["P2→P3"], "report lists the renumbering");
  assert.deepEqual(r.report.attachedAt, [{ from: "payment", at: "root/P2" }], "report names where it attached");
  assert.match(r.report.prdReview.problem, /checkout/i, "report surfaces the lean PRD for human review");
  // The landed file + new main still form a valid tree (landed digest is info-level).
  assert.equal(validateTree([doc("m", r.main), doc("l", r.landed)]).valid, true, "the landed initiative + merged main validate as a tree");
  console.log("[merge] PASS an implemented initiative folds into the main, renumbered and valid");
}

// A non-boundary initiative section becomes a NEW main section (renumbered).
{
  const p = implemented();
  p.ia.sections.push({ id: "S2", title: "Wallet", pages: [{ id: "P3", title: "Balance", type: "page", refs: [], children: [] }] });
  const r = planMerge([doc("main", main), doc("pay", p)], "payment");
  assert.equal(r.ok, true, `merge with a new section must succeed: ${r.error}`);
  const wallet = r.main.ia.sections.find(s => s.title === "Wallet");
  assert.ok(wallet, "a non-boundary initiative section becomes a new main section");
  assert.equal(wallet.id, "S2", "the new section is renumbered into the main space");
  assert.ok(wallet.pages.some(pg => pg.title === "Balance"), "the new section's page folds in");
  assert.ok(r.report.addedSections.length === 1, "report lists the added section");
  assert.equal(validateSot(r.main).valid, true, "the merged main with a new section validates");
  console.log("[merge] PASS a new initiative section folds in as a renumbered main section");
}

// Eligibility: only implemented merges.
for (const status of ["proposed", "approved", "dropped"]) {
  const p = clone(payment); p.initiative.status = status;
  const r = planMerge([doc("main", main), doc("pay", p)], "payment");
  assert.equal(r.ok, false, `${status} must not be mergeable`);
  assert.match(r.error, /only an implemented/, `${status}: wrong error`);
}
console.log("[merge] PASS only an implemented initiative can be merged");

// A tree with errors is not mergeable (fix first).
{
  const staleMain = clone(main); staleMain.title = "Changed"; // approved child → stale digest = error
  const p = clone(payment); // still approved
  const r = planMerge([doc("main", staleMain), doc("pay", p)], "payment");
  assert.equal(r.ok, false, "a tree with errors must block merge");
  assert.match(r.error, /errors/, "merge names the tree-error precondition");
  console.log("[merge] PASS a tree with errors blocks merge");
}

// Active descendants block the merge (land bottom-up).
{
  const p = implemented();
  const child = clone(payment);
  child.initiative.id = "refund"; child.initiative.path = "1-2-1"; child.initiative.status = "approved";
  child.initiative.parent = { scopeId: "payment", canonicalization: "sot-c14n-v1", digest: sotDigest(p) };
  const r = planMerge([doc("main", main), doc("pay", p), doc("ref", child)], "payment");
  assert.equal(r.ok, false, "an initiative with active children must not merge");
  assert.match(r.error, /child initiative/, "merge names the blocking children");
  console.log("[merge] PASS active descendants block the merge");
}

// Remaining main-attached initiatives are reported stale (merge is a main change).
{
  const p = implemented();
  const sibling = clone(payment);
  sibling.initiative.id = "search"; sibling.initiative.path = "1-3"; sibling.initiative.status = "approved";
  const r = planMerge([doc("main", main), doc("pay", p), doc("sib", sibling)], "payment");
  assert.equal(r.ok, true, `merge must succeed with a sibling: ${r.error}`);
  assert.deepEqual(r.staleSiblings, ["search"], "sibling initiatives on the main are reported as newly stale");
  console.log("[merge] PASS remaining siblings are reported stale (rebase follow-up, not silent)");
}
