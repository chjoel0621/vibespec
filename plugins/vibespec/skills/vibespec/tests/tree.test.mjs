import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { validateTree } from "../scripts/lib/tree.mjs";
import { validateSot } from "../scripts/validate-sot.mjs";
import { collectFiles } from "../scripts/validate-tree.mjs";
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

// A direct child gets exactly one new path segment; otherwise a missing
// intermediate initiative could be implied by a valid-looking path.
const skippedLevel = clone(activeChild);
skippedLevel.initiative.status = "proposed";
skippedLevel.initiative.path = "1-2-1-1";
skippedLevel.initiative.parent = { scopeId: "payment", canonicalization: "sot-c14n-v1", digest: sotDigest(payment) };
assert.ok(hasError(validateTree([doc("m", main), doc("p", payment), doc("c", skippedLevel)]), "exactly one numeric segment"),
  "direct child path must add exactly one segment");
console.log("[tree] PASS rejects a child path that skips an intermediate level");

// A parent cycle must produce findings and return; boundary ancestry walks
// cannot be allowed to loop after the cycle detector has identified it.
const cycleA = clone(payment);
cycleA.initiative.parent.scopeId = "refund";
const cycleB = clone(payment);
cycleB.initiative.id = "refund";
cycleB.initiative.path = "1-2-1";
cycleB.initiative.parent.scopeId = "payment";
assert.ok(hasError(validateTree([doc("m", main), doc("a", cycleA), doc("b", cycleB)]), "cycle detected"),
  "parent cycle must be reported without hanging");
console.log("[tree] PASS reports a parent cycle without hanging");

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

// Ancestry closure: a stale approved parent takes its (otherwise-active) child
// out of the active set too — no orphan overlay — and the child is warned to
// rebase the ancestor, not itself.
const closureChild = clone(payment);
closureChild.initiative.id = "refund";
closureChild.initiative.path = "1-2-1";
closureChild.initiative.status = "approved";
closureChild.initiative.parent = { scopeId: "payment", canonicalization: "sot-c14n-v1", digest: sotDigest(payment) };
closureChild.ia.sections[0].pages[0].boundary = { scopeId: "payment", pageId: "P2" };
closureChild.ia.sections[0].pages[0].title = "Pay"; // match target to avoid unrelated drift noise
const closure = validateTree([doc("m", changedMain), doc("payment", payment), doc("refund", closureChild)]);
assert.deepEqual(closure.product.activeSet, [], "stale approved parent must exclude its whole subtree (no orphan child)");
assert.ok(closure.warnings.some(w => w.file === "refund" && w.message.includes('ancestor "payment"')),
  "orphaned child must be warned to rebase the ancestor");
console.log("[tree] PASS active set is ancestry-closed (stale parent excludes child, warns upstream)");

// Merkle-chain property: rebasing a parent alone does NOT restore its subtree,
// because parent.digest hashes the whole parent doc (including the parent's own
// parent.digest), so rebasing payment changes payment's hash and immediately
// stales refund. Restoration requires a top-down cascade. This guards the
// future rebase implementation against the "one rebase heals the subtree" myth.
const rebasedParent = clone(payment);
rebasedParent.initiative.parent.digest = sotDigest(changedMain); // rebase payment to the new root
const parentOnly = validateTree([doc("m", changedMain), doc("payment", rebasedParent), doc("refund", closureChild)]);
assert.deepEqual(parentOnly.product.activeSet, ["payment"], "rebasing the parent alone reactivates only the parent");
assert.ok(hasError(parentOnly, "digest stale") && parentOnly.errors.some(e => e.file === "refund"),
  "the child is immediately staled by the parent's new hash");
const cascadedChild = clone(closureChild);
cascadedChild.initiative.parent.digest = sotDigest(rebasedParent); // then rebase refund onto the rebased payment
const cascaded = validateTree([doc("m", changedMain), doc("payment", rebasedParent), doc("refund", cascadedChild)]);
assert.deepEqual(cascaded.product.activeSet, ["payment", "refund"], "only a top-down cascade restores the whole subtree");
console.log("[tree] PASS rebase does not propagate — subtree restore needs a top-down cascade");

// Active initiatives may overlap in v1, but each owner needs a conflict
// warning so a person can resolve it before product-map synthesis.
const paymentConflict = clone(payment);
paymentConflict.initiative.id = "search";
paymentConflict.initiative.path = "1-3";
const conflictResult = validateTree([doc("m", main), doc("payment", payment), doc("search", paymentConflict)]);
assert.equal(conflictResult.valid, true, "boundary overlap is a warning, not an error");
assert.ok(hasWarn(conflictResult, "boundary conflict"), "active initiatives sharing a boundary must warn");
console.log("[tree] PASS active initiatives sharing a boundary warn");

// Folder mode is the normal user path, so archived dropped files must be found
// recursively rather than silently disappearing from path-reuse protection.
const scanDir = mkdtempSync(join(tmpdir(), "vibespec-tree-"));
try {
  mkdirSync(join(scanDir, "archive"));
  copyFileSync(join(treeDir, "main.sot.json"), join(scanDir, "main.sot.json"));
  copyFileSync(join(treeDir, "shop.1-2.payment.sot.json"), join(scanDir, "archive", "shop.1-2.payment.sot.json"));
  const scanned = collectFiles([scanDir]).map(file => basename(file)).sort();
  assert.deepEqual(scanned, ["main.sot.json", "shop.1-2.payment.sot.json"], "folder scan must include archived SOT files");
} finally {
  rmSync(scanDir, { recursive: true, force: true });
}
console.log("[tree] PASS folder scan includes archived SOT files recursively");

// sot-digest.mjs prints exactly the digest an initiative records as
// parent.digest — i.e. the value validate-tree recomputes for freshness.
import { spawnSync } from "node:child_process";
import { sotDigest as digestOf } from "../scripts/lib/c14n.mjs";
const digestCli = spawnSync(process.execPath, [join(here, "..", "scripts", "sot-digest.mjs"), join(treeDir, "main.sot.json")], { encoding: "utf8" });
assert.equal(digestCli.status, 0, `sot-digest exit: ${digestCli.stderr}`);
assert.equal(digestCli.stdout.trim(), digestOf(main), "sot-digest CLI must match lib sotDigest");
assert.equal(digestCli.stdout.trim(), payment.initiative.parent.digest, "and match the fixture initiative's recorded parent digest");
console.log("[tree] PASS sot-digest CLI prints the canonical parent digest");

/* ==== section boundary (declare the wrapper: reference or new) ==== */
// The clean payment fixture now mirrors main section S1 ("Shop") with a section
// boundary, so its page boundary sits in a declared reference — no phantom.
const sbBase = validateTree([doc("main.sot.json", main), doc("shop.1-2.payment.sot.json", payment)]);
assert.equal(sbBase.warnings.length, 0, `section-boundary fixture must be clean: ${JSON.stringify(sbBase.warnings)}`);
assert.equal(payment.ia.sections[0].boundary.sectionId, "S1", "fixture must exercise a section boundary");
console.log("[tree] PASS a mirrored section boundary is clean (no phantom warning)");

// Missing target section → error.
const sbMissing = clone(payment); sbMissing.ia.sections[0].boundary.sectionId = "S9";
assert.ok(hasError(validateTree([doc("m", main), doc("p", sbMissing)]), 'section "S9" does not exist'),
  "a section boundary to a non-existent section must error");
console.log("[tree] PASS section boundary to a missing section errors");

// scopeId not an ancestor → error.
const sbScope = clone(payment); sbScope.ia.sections[0].boundary.scopeId = "ghost";
assert.ok(hasError(validateTree([doc("m", main), doc("p", sbScope)]), 'is not an ancestor scope'),
  "a section boundary to a non-ancestor scope must error");
console.log("[tree] PASS section boundary to a non-ancestor scope errors");

// Title drift (stub title ≠ main section title) → warning.
const sbDrift = clone(payment); sbDrift.ia.sections[0].title = "Renamed";
assert.ok(hasWarn(validateTree([doc("m", main), doc("p", sbDrift)]), "section boundary title drift"),
  "a drifted section-boundary title must warn");
console.log("[tree] PASS section boundary title drift warns");

// A section boundary that points at a DIFFERENT section than where its page
// boundary attaches → warning. (Needs a main with a second section.)
const mainTwoSec = clone(main);
mainTwoSec.ia.sections.push({ id: "S2", title: "Account", pages: [{ id: "P9", title: "Profile", type: "page", refs: [], children: [] }] });
const sbMismatch = clone(payment);
sbMismatch.ia.sections[0].boundary.sectionId = "S2"; sbMismatch.ia.sections[0].title = "Account"; // mirrors S2...
sbMismatch.initiative.parent.digest = sotDigest(mainTwoSec);                                       // ...but its page boundary still attaches in S1
assert.ok(hasWarn(validateTree([doc("m", mainTwoSec), doc("p", sbMismatch)]), "does not match where its page boundary attaches"),
  "a section boundary that doesn't match its page boundary's home section must warn");
console.log("[tree] PASS mismatched section vs page boundary warns");

// Dropping the section boundary reproduces the phantom-wrapper advisory.
const sbNone = clone(payment); delete sbNone.ia.sections[0].boundary;
assert.ok(hasWarn(validateTree([doc("m", main), doc("p", sbNone)]), "section with no boundary"),
  "a page boundary under an undeclared section must advise declaring it");
console.log("[tree] PASS an undeclared wrapper section is flagged (reference or new, never phantom)");

// Section boundary is 1.1-only (single-file rule).
const sbOnMain = clone(main); sbOnMain.ia.sections[0].boundary = { scopeId: "root", sectionId: "S1" };
assert.ok(validateSot(sbOnMain).errors.some(e => e.message.includes("section boundary requires schemaVersion 1.1")),
  "a section boundary on a 1.0 doc must be rejected");
console.log("[tree] PASS section boundary is 1.1-only");
