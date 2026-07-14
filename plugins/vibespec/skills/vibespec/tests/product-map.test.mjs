import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildProductMap } from "../scripts/lib/product-map.mjs";
import { sotDigest } from "../scripts/lib/c14n.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const treeDir = join(here, "fixtures", "tree");
const load = name => JSON.parse(readFileSync(join(treeDir, name), "utf8"));
const main = load("main.sot.json");
const payment = load("shop.1-2.payment.sot.json");
const doc = (name, sot) => ({ name, sot });
const clone = v => JSON.parse(JSON.stringify(v));

const nodeById = (map, cid) => {
  const walk = pages => { for (const p of pages) { if (p.compositeId === cid) return p; const r = walk(p.children); if (r) return r; } return null; };
  return walk(map.ia.flatMap(s => s.pages));
};

// An active initiative is grafted under its boundary target, with composite ids
// that carry provenance.
const map = buildProductMap([doc("main", main), doc("pay", payment)]);
assert.equal(map.valid, true, `map must build for a clean tree: ${JSON.stringify(map.errors)}`);
assert.equal(map.productId, "shop");
assert.deepEqual(map.active, ["payment"]);
assert.deepEqual(map.attachments, [{ initiative: "payment", at: "root/P2" }]);
const cart = nodeById(map, "root/P2");
assert.ok(cart, "the main Cart page must be in the composite");
assert.equal(cart.scope, "root");
assert.deepEqual(cart.children.map(c => c.compositeId), ["payment/P2"], "the initiative screen grafts under the boundary target");
assert.equal(nodeById(map, "payment/P2").scope, "payment", "grafted node carries its initiative provenance");
assert.deepEqual(nodeById(map, "payment/P2").refs, ["payment/F1"], "grafted refs are scope-qualified");
console.log("[map] PASS active initiative grafts under its boundary with composite ids");

// A proposed initiative is excluded (with a reason) and not grafted.
const proposed = clone(payment); proposed.initiative.status = "proposed";
const m2 = buildProductMap([doc("main", main), doc("pay", proposed)]);
assert.deepEqual(m2.active, []);
assert.ok(m2.excluded.some(e => e.id === "payment" && /proposed/.test(e.reason)), "proposed must be excluded with a reason");
assert.equal(nodeById(m2, "payment/P2"), null, "a proposed initiative must not appear in the composite");
console.log("[map] PASS proposed initiative is excluded from the map");

// A stale approved tree does not produce a map at all (rebase first).
const changedMain = clone(main); changedMain.title = "Changed";
const m3 = buildProductMap([doc("main", changedMain), doc("pay", payment)]);
assert.equal(m3.valid, false, "a stale-approved (validate-tree-failing) tree must not build a map");
console.log("[map] PASS a stale-approved tree refuses to build a map");

// A stale implemented initiative stays in the map, flagged stale (shipped
// reality is not removed).
const implemented = clone(payment); implemented.initiative.status = "implemented";
const m4 = buildProductMap([doc("main", changedMain), doc("pay", implemented)]);
assert.equal(m4.valid, true, "implemented+stale keeps the tree valid and mappable");
assert.deepEqual(m4.active, ["payment"]);
assert.deepEqual(m4.stale, ["payment"]);
assert.ok(nodeById(m4, "payment/P2"), "stale implemented initiative stays composed");
console.log("[map] PASS stale implemented initiative stays in the map, flagged");

// Nested: an initiative on an initiative grafts under its parent's grafted node.
const refund = clone(payment);
refund.initiative.id = "refund";
refund.initiative.path = "1-2-1";
refund.initiative.status = "approved";
refund.initiative.parent = { scopeId: "payment", canonicalization: "sot-c14n-v1", digest: sotDigest(payment) };
refund.ia.sections[0].pages[0].title = "Pay"; // boundary stub mirrors payment/P2
refund.ia.sections[0].pages[0].type = "page";
refund.ia.sections[0].pages[0].boundary = { scopeId: "payment", pageId: "P2" };
const m5 = buildProductMap([doc("main", main), doc("pay", payment), doc("ref", refund)]);
assert.equal(m5.valid, true, `nested tree must build: ${JSON.stringify(m5.errors)}`);
const payNode = nodeById(m5, "payment/P2");
assert.ok(payNode.children.some(c => c.compositeId === "refund/P2"), "a grandchild initiative grafts under its parent's grafted node");
console.log("[map] PASS nested initiatives graft onto their parent's composite node");

// A boundary stub nested below a non-boundary wrapper page (validate-tree allows
// a boundary at any depth) must still graft at its target — the stub is not
// materialized, and the wrapper becomes the initiative's own composite node.
const nestedStub = clone(payment);
nestedStub.ia.sections[0].pages = [{
  id: "P3", title: "Wrapper", type: "top", refs: [], children: [
    { id: "P1", title: "Cart", type: "page", refs: [], boundary: { scopeId: "root", pageId: "P2" }, children: [
      { id: "P2", title: "Pay", type: "page", refs: ["F1"], children: [] }] }] }];
const m6 = buildProductMap([doc("main", main), doc("pay", nestedStub)]);
assert.deepEqual(m6.attachments, [{ initiative: "payment", at: "root/P2" }], "a deep boundary still attaches");
assert.ok(nodeById(m6, "root/P2").children.some(c => c.compositeId === "payment/P2"), "the increment screen grafts under the main target");
assert.ok(nodeById(m6, "payment/P3"), "the wrapper becomes the initiative's own node");
assert.equal(nodeById(m6, "payment/P1"), null, "the boundary stub itself is not materialized");
console.log("[map] PASS a boundary nested under a wrapper still grafts at its target");
