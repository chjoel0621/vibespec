import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

// Depth-3 partial apply: "refuse a child whose parent stays stale" must hold at
// EVERY depth. Selecting a grandchild while skipping the middle node writes
// nothing, and remainingStale reports the whole chain.
function tree3() {
  const [m, p, r] = tree("Changed");
  const cb = clone(r.sot);
  cb.name = undefined;
  cb.initiative.id = "chargeback";
  cb.initiative.path = "1-2-1-1";
  cb.initiative.parent = { scopeId: "refund", canonicalization: "sot-c14n-v1", digest: sotDigest(r.sot) };
  cb.ia.sections[0].pages[0].boundary = { scopeId: "refund", pageId: "P2" };
  return [m, p, r, { name: "chargeback", sot: cb }];
}
const d3 = tree3();
const p3 = planRebase(d3).plan;
assert.deepEqual(p3.map(s => s.id), ["payment", "refund", "chargeback"], "depth-3 plan is root→leaf");
assert.equal(applyRebase(d3, p3, ["refund", "chargeback"]).length, 0, "skipping the root of the chain writes nothing, even for the grandchild");
assert.deepEqual(remainingStale(p3, ["refund", "chargeback"]), ["payment", "refund", "chargeback"], "the whole chain stays stale");
assert.deepEqual(applyRebase(d3, p3, ["payment", "chargeback"]).map(w => w.id), ["payment"], "skipping the middle node strands the grandchild");
assert.deepEqual(remainingStale(p3, ["payment", "chargeback"]), ["refund", "chargeback"], "grandchild stranded when middle is skipped");
console.log("[rebase] PASS depth-3 partial apply refuses stranded descendants at every level");

// End-to-end through the REAL CLI (spawn, arg parsing, exit codes, file writes).
const cliPath = join(here, "..", "scripts", "rebase.mjs");
const run = (args, cwd) => spawnSync(process.execPath, [cliPath, ...args], { cwd, encoding: "utf8" });
const workDir = mkdtempSync(join(tmpdir(), "vibespec-rebase-"));
try {
  const changedMain = clone(main); changedMain.title = "Changed on disk";
  writeFileSync(join(workDir, "main.sot.json"), stableStringify(changedMain) + "\n");
  writeFileSync(join(workDir, "payment.sot.json"), stableStringify(clone(payment)) + "\n");

  // Dry-run: plans without writing, exit 0.
  const dry = run([workDir], workDir);
  assert.equal(dry.status, 0, `dry-run exit: ${dry.stderr}`);
  assert.match(dry.stdout, /연쇄 계획/);
  assert.match(dry.stdout, /드라이런/);
  const beforeBytes = readFileSync(join(workDir, "payment.sot.json"), "utf8");
  assert.match(beforeBytes, /"schemaVersion": "1.1"/); // untouched by dry-run

  // Apply: rewrites files, exit 0, result validates clean.
  const applied = run([workDir, "--apply"], workDir);
  assert.equal(applied.status, 0, `apply exit: ${applied.stderr}`);
  assert.match(applied.stdout, /갱신 완료/);
  const afterDocs = ["main", "payment"].map(n => ({ name: n, sot: JSON.parse(readFileSync(join(workDir, `${n}.sot.json`), "utf8")) }));
  assert.equal(validateTree(afterDocs).valid, true, "CLI --apply must produce a valid tree");
  console.log("[rebase] PASS CLI dry-run then --apply rewrites files into a valid tree");

  // Apply on a tree with a non-stale error (duplicate id) is refused, exit 1,
  // and nothing is written.
  writeFileSync(join(workDir, "dupe.sot.json"), stableStringify({ ...clone(payment), initiative: { ...clone(payment).initiative, path: "1-9" } }) + "\n");
  const beforeDupe = readFileSync(join(workDir, "payment.sot.json"), "utf8");
  const refused = run([workDir, "--apply"], workDir);
  assert.equal(refused.status, 1, "apply on an invalid tree must exit 1");
  assert.match(refused.stderr, /거부|duplicate/);
  assert.equal(readFileSync(join(workDir, "payment.sot.json"), "utf8"), beforeDupe, "refused apply must not write any file");
  console.log("[rebase] PASS CLI --apply is refused (exit 1, no writes) on a non-stale error");
} finally {
  rmSync(workDir, { recursive: true, force: true });
}
