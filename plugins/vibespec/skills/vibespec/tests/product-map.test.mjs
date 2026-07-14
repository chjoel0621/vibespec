import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
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

// CLI: --link <scopeId>=<url> attaches a link to each scope so the rendered map
// can open the document that defines it. The link value must not be mistaken for
// an input path (that used to make the CLI try to read "notif=/notif/" as a SOT).
const cli = join(here, "..", "scripts", "product-map.mjs");
const run = args => spawnSync(process.execPath, [cli, ...args], { encoding: "utf8" });
const linked = run([treeDir, "--link", "root=/", "--link", "payment=/pay/", "--json"]);
assert.equal(linked.status, 0, `--link run must succeed: ${linked.stderr}`);
const linkedMap = JSON.parse(linked.stdout);
assert.deepEqual(linkedMap.scopes.map(s => [s.id, s.href]), [["root", "/"], ["payment", "/pay/"]], "--link sets each scope's href");
const plain = run([treeDir, "--json"]);
assert.equal(plain.status, 0, `plain run must succeed: ${plain.stderr}`);
assert.ok(JSON.parse(plain.stdout).scopes.every(s => !("href" in s)), "without --link no scope carries an href");
console.log("[map] PASS --link gives each scope a link without being read as an input path");

// embedDocs carries each scope's source SOT so the rendered map can open the
// document behind a node. Off by default: a --json consumer must not be handed
// duplicated documents.
const bare = buildProductMap([doc("main", main), doc("pay", payment)]);
assert.ok(bare.scopes.every(s => !("sot" in s)), "buildProductMap must not embed documents unless asked");
const embedded = buildProductMap([doc("main", main), doc("pay", payment)], { embedDocs: true });
assert.deepEqual(embedded.scopes.map(s => s.sot.title), [main.title, payment.title], "each scope carries its own document");
assert.equal(embedded.scopes[1].sot.initiative.id, "payment", "the embedded initiative is the source doc, not the composite");
embedded.scopes[0].sot.title = "MUTATED";
assert.notEqual(main.title, "MUTATED", "embedding must deep-copy, never alias the caller's doc");
console.log("[map] PASS embedDocs carries each scope's source document (opt-in, deep-copied)");

// The HTML map embeds by default (so it is navigable standalone); --link means the
// scopes live at their own URLs, so embedding would be dead weight.
const htmlOut = join(here, "..", ".build", "map-embed-probe.html");
assert.equal(run([treeDir, "--html", htmlOut]).status, 0, "--html run must succeed");
assert.ok(readFileSync(htmlOut, "utf8").includes('"kind":"vibespec-product-map"'), "the html map carries its payload");
assert.ok(/"sot":\{/.test(readFileSync(htmlOut, "utf8")), "the html map embeds its scopes' documents by default");
assert.equal(run([treeDir, "--html", htmlOut, "--link", "root=/"]).status, 0, "--link run must succeed");
assert.ok(!/"sot":\{/.test(readFileSync(htmlOut, "utf8")), "--link points at real pages, so the html map does not embed docs");
console.log("[map] PASS the html map embeds documents by default and defers to --link when given");
