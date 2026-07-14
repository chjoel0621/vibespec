// Orchestration pre-flight (v2.5): classify an input (file or folder of SOTs)
// and return the deterministic facts the skill routes on — so mode selection,
// path issuance, and "does this need a rebase?" are computed, not eyeballed.
//
// Kept as skill-side tooling (not a separate agent) so the Codex dual-format
// contract holds. Pure and fs-free: takes [{ name, sot }] like the other libs.
import { validateTree } from "./tree.mjs";
import { sotDigest } from "./c14n.mjs";

const isObject = v => v !== null && typeof v === "object" && !Array.isArray(v);

function classify(doc) {
  const s = doc.sot;
  if (!isObject(s)) return { name: doc.name, kind: "unknown" };
  if (s.schemaVersion === "1.1" && isObject(s.initiative)) {
    const m = s.initiative;
    return { name: doc.name, kind: "initiative", productId: m.productId, id: m.id, path: m.path, status: m.status, parentScopeId: m.parent && m.parent.scopeId };
  }
  if (s.schemaVersion === "1.0") return { name: doc.name, kind: "main", title: s.title };
  return { name: doc.name, kind: "unknown", schemaVersion: s.schemaVersion };
}

// Next path to issue under a scope: root children are "1-<n>", an initiative's
// children are "<its path>-<n>". Numbering is max-existing + 1 (gaps allowed;
// paths are never reused, so dropped/archived files still occupy their number).
function nextPathUnder(scopePath, childPaths) {
  const nums = childPaths
    .map(p => p.startsWith(scopePath + "-") ? Number(p.slice(scopePath.length + 1).split("-")[0]) : NaN)
    .filter(Number.isFinite);
  return `${scopePath}-${(nums.length ? Math.max(...nums) : 0) + 1}`;
}

export function inspectDocs(docs) {
  const files = docs.map(classify);
  const mains = files.filter(f => f.kind === "main");
  const inits = files.filter(f => f.kind === "initiative");
  const hasMain = mains.length === 1;

  // Path issuance per scope. Root's conceptual path prefix is "1".
  const allChildPaths = inits.map(i => i.path).filter(Boolean);
  const nextPath = {};
  if (hasMain) nextPath.root = nextPathUnder("1", allChildPaths);
  for (const i of inits) if (i.path) nextPath[i.id] = nextPathUnder(i.path, allChildPaths);

  // Tree facts (only meaningful with a root).
  let tree = null, staleInitiatives = [];
  if (hasMain) {
    const r = validateTree(docs);
    // An initiative is stale when its recorded parent.digest != the parent's current hash.
    const scopeDoc = id => id === "root" ? docs.find(d => d.sot.schemaVersion === "1.0") : docs.find(d => d.sot.schemaVersion === "1.1" && d.sot.initiative && d.sot.initiative.id === id);
    for (const i of inits) {
      const d = docs.find(x => x.sot.initiative && x.sot.initiative.id === i.id);
      const parent = scopeDoc(i.parentScopeId);
      if (parent && d.sot.initiative.parent && sotDigest(parent.sot) !== d.sot.initiative.parent.digest) staleInitiatives.push(i.id);
    }
    tree = { valid: r.valid, productId: r.product.productId, activeSet: r.product.activeSet, staleSet: r.product.staleSet, errorCount: r.errors.length };
  }

  const needsRebase = staleInitiatives.length > 0;
  // Initiatives present but no main = incomplete: the skill should ask for the
  // main SOT before it can route to a tree operation.
  const incompleteTree = inits.length > 0 && !hasMain;
  const modes = [];
  if (!hasMain && !inits.length) modes.push("generate");
  if (hasMain) { modes.push("edit", "initiative"); if (tree && tree.activeSet.length && !needsRebase) modes.push("map"); }
  if (needsRebase) modes.push("rebase");

  return {
    files, hasMain, initiativeCount: inits.length, incompleteTree,
    tree, nextPath, staleInitiatives, needsRebase,
    suggestedModes: modes
  };
}
