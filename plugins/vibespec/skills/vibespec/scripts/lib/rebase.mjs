// Rebase planning for the initiative tree. A rebase re-points an initiative's
// parent.digest at its parent's CURRENT canonical hash. Because digests form a
// Merkle chain (parent.digest hashes the whole parent, including the parent's
// own parent.digest), rebasing a node changes that node's hash and stales its
// children — so restoration is never automatic. planRebase computes the full
// root→leaf cascade needed to make the tree fresh, in dependency order, and
// the CLI applies only what the user confirms (never a blind bulk overwrite).
//
// Pure and fs-free: takes [{ name, sot }] like validateTree. Assumes the tree
// is otherwise validate-tree-clean (single product, no cycles/missing parents);
// nodes whose parent can't be resolved are reported as unrebasable, not crashed.
import { sotDigest, stableStringify } from "./c14n.mjs";

const ROOT = "root";
const isObject = v => v !== null && typeof v === "object" && !Array.isArray(v);

function buildScopes(docs) {
  const scopes = new Map();
  const roots = docs.filter(d => isObject(d.sot) && d.sot.schemaVersion === "1.0");
  const initiatives = docs.filter(d => isObject(d.sot) && d.sot.schemaVersion === "1.1" && isObject(d.sot.initiative));
  if (roots.length === 1) scopes.set(ROOT, { id: ROOT, isRoot: true, doc: roots[0] });
  for (const d of initiatives) {
    const id = d.sot.initiative.id;
    if (!scopes.has(id)) scopes.set(id, { id, isRoot: false, doc: d });
  }
  return { scopes, roots, initiatives };
}

function depthOf(id, scopes) {
  let depth = 0;
  const seen = new Set([id]);
  let cursor = scopes.get(id);
  while (cursor && !cursor.isRoot) {
    const parentId = cursor.doc.sot.initiative.parent.scopeId;
    if (seen.has(parentId)) return Infinity; // cycle — unresolvable
    seen.add(parentId);
    depth += 1;
    cursor = scopes.get(parentId);
    if (!cursor) return Infinity; // missing parent — unresolvable
  }
  return depth;
}

// Returns { plan: [{ id, file, depth, parentId, from, to }], unrebasable: [{id,file,reason}] }.
// plan is ordered root→leaf; `to` is the digest each node must record ASSUMING
// every shallower node in the plan is applied first (working copies carry the
// updated parent hashes forward). A node appears in the plan iff its recorded
// digest differs from that target — i.e. it is stale now OR becomes stale once
// its parent is rebased.
export function planRebase(docs) {
  const { scopes, initiatives } = buildScopes(docs);
  const plan = [];
  const unrebasable = [];

  const ordered = [];
  for (const d of initiatives) {
    const depth = depthOf(d.sot.initiative.id, scopes);
    if (depth === Infinity) { unrebasable.push({ id: d.sot.initiative.id, file: d.name, reason: "parent chain is cyclic or missing (run validate-tree first)" }); continue; }
    ordered.push({ d, depth });
  }
  ordered.sort((a, b) => a.depth - b.depth || a.d.sot.initiative.id.localeCompare(b.d.sot.initiative.id));

  // Working copies so a parent's post-rebase hash is visible to its children.
  const working = new Map();
  for (const [id, scope] of scopes) working.set(id, JSON.parse(JSON.stringify(scope.doc.sot)));

  for (const { d, depth } of ordered) {
    const meta = d.sot.initiative;
    const parentSot = working.get(meta.parent.scopeId);
    if (!parentSot) { unrebasable.push({ id: meta.id, file: d.name, reason: `parent scope "${meta.parent.scopeId}" not found` }); continue; }
    const target = sotDigest(parentSot);
    if (meta.parent.digest !== target) {
      plan.push({ id: meta.id, file: d.name, depth, parentId: meta.parent.scopeId, from: meta.parent.digest, to: target });
    }
    // Carry the (possibly-updated) digest into the working copy so descendants
    // compute their target against this node's post-rebase hash.
    working.get(meta.id).initiative.parent.digest = target;
  }

  return { plan, unrebasable, alreadyFresh: plan.length === 0 && unrebasable.length === 0 };
}

// Given a plan and the set of ids the user chose to apply, returns which planned
// nodes remain stale (either not selected, or selected but their parent was
// not — a child cannot be fresh unless its parent is rebased first).
export function remainingStale(plan, appliedIds) {
  const applied = new Set(appliedIds);
  const planned = new Set(plan.map(p => p.id));
  const remaining = [];
  for (const step of plan) {
    const parentInPlanUnapplied = planned.has(step.parentId) && !applied.has(step.parentId);
    if (!applied.has(step.id) || parentInPlanUnapplied) remaining.push(step.id);
  }
  return remaining;
}

// Produce the rewritten file contents for the selected ids. Only ids whose
// parent is either fresh or also being applied are written (a child is refused
// if its parent stays stale — no incoherent partial). Returns [{ file, content, id }].
export function applyRebase(docs, plan, appliedIds) {
  const applied = new Set(appliedIds);
  const planned = new Map(plan.map(p => [p.id, p]));
  const byName = new Map(docs.map(d => [d.name, d]));
  const writes = [];
  for (const step of plan) {
    if (!applied.has(step.id)) continue;
    if (planned.has(step.parentId) && !applied.has(step.parentId)) continue; // parent stays stale → refuse child
    const doc = byName.get(step.file);
    const next = JSON.parse(JSON.stringify(doc.sot));
    next.initiative.parent.digest = step.to;
    writes.push({ file: step.file, id: step.id, content: stableStringify(next) + "\n" });
  }
  return writes;
}
