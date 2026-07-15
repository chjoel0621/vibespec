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

export function inspectDocs(docs, opts = {}) {
  const files = docs.map(classify);
  const mains = files.filter(f => f.kind === "main");
  const inits = files.filter(f => f.kind === "initiative");
  const mainCount = mains.length;
  const hasMain = mainCount === 1;

  // Path issuance per scope. Root's conceptual path prefix is "1". Authority is
  // only "complete" when the caller scanned a product FOLDER — an explicit file
  // list may omit sibling initiatives and re-issue an already-used number.
  const allChildPaths = inits.map(i => i.path).filter(Boolean);
  const nextPath = {};
  if (hasMain) nextPath.root = nextPathUnder("1", allChildPaths);
  for (const i of inits) if (i.path) nextPath[i.id] = nextPathUnder(i.path, allChildPaths);
  const pathAuthority = opts.fromFolder ? "complete" : "incomplete";

  // Tree facts + validity. Separate stale-digest errors (fixable by rebase)
  // from structural errors (need a repair).
  let tree = null, staleInitiatives = [], nonStaleErrors = [];
  if (hasMain) {
    const r = validateTree(docs);
    nonStaleErrors = r.errors.filter(e => !e.message.includes("digest stale"));
    const scopeDoc = id => id === "root" ? docs.find(d => d.sot.schemaVersion === "1.0") : docs.find(d => d.sot.schemaVersion === "1.1" && d.sot.initiative && d.sot.initiative.id === id);
    for (const i of inits) {
      const d = docs.find(x => x.sot.initiative && x.sot.initiative.id === i.id);
      const parent = scopeDoc(i.parentScopeId);
      if (parent && d.sot.initiative.parent && sotDigest(parent.sot) !== d.sot.initiative.parent.digest) staleInitiatives.push(i.id);
    }
    tree = { valid: r.valid, productId: r.product.productId, activeSet: r.product.activeSet, staleSet: r.product.staleSet, errorCount: r.errors.length };
  }

  const needsRebase = staleInitiatives.length > 0;
  // Merge (land) candidates: an implemented, main-attached initiative with no
  // active children, in a valid tree. Computed here so routing trusts the tool
  // (suggestedModes) instead of re-deriving eligibility from prose.
  let mergeCandidates = [];
  if (hasMain && tree && tree.valid) {
    const parentsWithActiveChild = new Set(inits
      .filter(i => i.parentScopeId && i.parentScopeId !== "root" && !["dropped", "landed"].includes(i.status))
      .map(i => i.parentScopeId));
    mergeCandidates = inits
      .filter(i => i.status === "implemented" && i.parentScopeId === "root" && !parentsWithActiveChild.has(i.id))
      .map(i => i.id);
  }
  const incompleteTree = inits.length > 0 && !hasMain;
  const unknowns = files.filter(f => f.kind === "unknown");
  // A structural problem the skill cannot route around (only repair fixes it).
  // Unknown SOT files must NEVER fall through to `generate`: an unrecognized
  // existing document would be mistaken for a blank slate and overwritten.
  let invalidReason = null;
  if (unknowns.length) invalidReason = `unrecognized SOT file(s): ${unknowns.map(u => u.name).join(", ")} (unsupported schemaVersion — cannot route)`;
  else if (mainCount > 1) invalidReason = `multiple main documents (${mainCount})`;
  else if (nonStaleErrors.length) invalidReason = `tree has ${nonStaleErrors.length} structural error(s): ${nonStaleErrors[0].message}`;

  // Order matters: a structural problem blocks everything (rebase would refuse
  // to write anyway), then a missing main, then the actionable modes.
  const modes = [];
  if (invalidReason) modes.push("repair");
  else if (incompleteTree) { /* need the main first — no actionable mode */ }
  else if (!hasMain) modes.push("generate"); // no files at all → a fresh product
  else { // one main, no structural errors
    modes.push("edit", "initiative");
    if (needsRebase) modes.push("rebase");
    else if (tree.activeSet.length) modes.push("map");
    if (mergeCandidates.length) modes.push("merge"); // available; SKILL.md lands it only on an explicit request
  }

  return {
    files, hasMain, mainCount, initiativeCount: inits.length, incompleteTree, unknownCount: unknowns.length,
    tree, invalidReason, nextPath, pathAuthority, staleInitiatives, needsRebase, mergeCandidates,
    suggestedModes: modes
  };
}
