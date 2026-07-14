import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { planRebase, applyRebase, remainingStale } from "../scripts/lib/rebase.mjs";
import { validateTree } from "../scripts/lib/tree.mjs";
import { sotDigest, stableStringify } from "../scripts/lib/c14n.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const treeDir = join(here, "fixtures", "tree");
const load = name => JSON.parse(readFileSync(join(treeDir, name), "utf8"));
const main = load("main.sot.json");
const payment = load("shop.1-2.payment.sot.json");
const clone = v => JSON.parse(JSON.stringify(v));

// Two-level tree: main → payment(approved) → refund(approved).
function tree(rootTitle) {
  const m = clone(main); if (rootTitle) m.title = rootTitle;
  const p = clone(payment);
  const c = clone(payment);
  c.initiative.id = "refund";
  c.initiative.path = "1-2-1";
  c.initiative.status = "approved";
  c.initiative.parent = { scopeId: "payment", canonicalization: "sot-c14n-v1", digest: sotDigest(payment) };
  c.ia.sections[0].pages[0].boundary = { scopeId: "payment", pageId: "P2" };
  c.ia.sections[0].pages[0].title = "Pay";
  return [{ name: "main", sot: m }, { name: "payment", sot: p }, { name: "refund", sot: c }];
}

// A fresh tree has an empty plan.
assert.equal(planRebase(tree()).alreadyFresh, true, "unchanged tree needs no rebase");
console.log("[rebase] PASS fresh tree yields an empty plan");

// Editing the root stales payment, and cascade-stales refund. Plan is root→leaf.
const staleDocs = tree("Changed");
const plan = planRebase(staleDocs);
assert.deepEqual(plan.plan.map(s => s.id), ["payment", "refund"], "plan must be ordered root→leaf");
assert.equal(plan.plan[0].depth, 1);
assert.equal(plan.plan[1].depth, 2);
console.log("[rebase] PASS root edit produces a root→leaf cascade plan");

// Applying only the parent leaves the child stale (Merkle chain, not auto-heal).
assert.deepEqual(remainingStale(plan.plan, ["payment"]), ["refund"], "parent-only rebase leaves the child stale");
console.log("[rebase] PASS parent-only apply reports the child as still stale");

// A child cannot be written while its parent stays stale — no incoherent partial.
assert.equal(applyRebase(staleDocs, plan.plan, ["refund"]).length, 0, "child refused when parent not applied");
console.log("[rebase] PASS applying a child without its parent is refused");

// The full cascade restores a validate-tree-clean, fully-active tree.
const full = tree("Changed");
const writes = applyRebase(full, planRebase(full).plan, ["payment", "refund"]);
const applied = full.map(d => { const w = writes.find(x => x.file === d.name); return { name: d.name, sot: w ? JSON.parse(w.content) : d.sot }; });
const validated = validateTree(applied);
assert.equal(validated.valid, true, `rebased tree must validate: ${JSON.stringify(validated.errors)}`);
assert.deepEqual(validated.product.activeSet, ["payment", "refund"], "full cascade restores the whole active subtree");
console.log("[rebase] PASS full cascade restores a valid, fully-active tree");

// A cyclic/orphaned node is reported as unrebasable rather than hanging.
const broken = tree();
broken[1].sot.initiative.parent.scopeId = "refund"; // payment ← refund ← payment
broken[2].sot.initiative.parent.scopeId = "payment";
const brokenPlan = planRebase(broken);
assert.ok(brokenPlan.unrebasable.some(u => u.id === "payment"), "cyclic node must be flagged unrebasable, not hang");
console.log("[rebase] PASS cyclic ancestry is reported unrebasable");

// End-to-end via the file-writing CLI path: --apply actually rewrites files and
// the on-disk result validates clean.
const workDir = mkdtempSync(join(tmpdir(), "vibespec-rebase-"));
try {
  const changedMain = clone(main); changedMain.title = "Changed on disk";
  writeFileSync(join(workDir, "main.sot.json"), stableStringify(changedMain) + "\n");
  writeFileSync(join(workDir, "payment.sot.json"), stableStringify(clone(payment)) + "\n");
  const child = tree()[2].sot;
  writeFileSync(join(workDir, "refund.sot.json"), stableStringify(child) + "\n");

  const disk = ["main", "payment", "refund"].map(n => ({ name: join(workDir, `${n}.sot.json`), sot: JSON.parse(readFileSync(join(workDir, `${n}.sot.json`), "utf8")) }));
  const diskPlan = planRebase(disk);
  const diskWrites = applyRebase(disk, diskPlan.plan, diskPlan.plan.map(p => p.id));
  for (const w of diskWrites) writeFileSync(w.file, w.content);

  const after = disk.map(d => ({ name: d.name, sot: JSON.parse(readFileSync(d.name, "utf8")) }));
  assert.equal(validateTree(after).valid, true, "on-disk rebased tree must validate");
  assert.deepEqual(validateTree(after).product.activeSet, ["payment", "refund"]);
  console.log("[rebase] PASS on-disk apply rewrites files into a valid tree");
} finally {
  rmSync(workDir, { recursive: true, force: true });
}
