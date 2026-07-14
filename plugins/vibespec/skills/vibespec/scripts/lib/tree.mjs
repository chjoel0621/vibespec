// Cross-file (tree-level) validation for a single product: one 1.0 main doc
// (scope "root") plus its 1.1 initiatives. Enforces the roadmap v1 invariants
// that a single-file validator cannot: scope existence, no cycles, path prefix
// consistency, status-scaled parent-digest policy, boundary target existence +
// drift, dropped-parent rules, and active-set classification.
//
// Pure and fs-free: takes an array of { name, sot } so tests can drive it in
// memory. scripts/validate-tree.mjs is the fs/CLI wrapper.
import { sotDigest } from "./c14n.mjs";
import { validateSot } from "../validate-sot.mjs";

const ROOT = "root";
const isObject = v => v !== null && typeof v === "object" && !Array.isArray(v);
const ACTIVE = new Set(["approved", "implemented"]);

function pageById(sot, id) {
  let found = null;
  const walk = pages => { for (const p of pages ?? []) { if (found) return; if (p.id === id) { found = p; return; } walk(p.children); } };
  (sot.ia?.sections ?? []).forEach(section => walk(section.pages));
  return found;
}

// digest-mismatch severity by initiative status (roadmap §2).
function digestSeverity(status) {
  if (status === "approved") return "error";
  if (status === "implemented") return "warning"; // shipped reality — flagged "stale", still synthesized
  if (status === "dropped") return "info";
  return "warning"; // proposed
}

export function validateTree(docs) {
  const errors = [];
  const warnings = [];
  const info = [];
  const err = (file, path, message) => errors.push({ file, path, message });
  const warn = (file, path, message) => warnings.push({ file, path, message });
  const note = (file, path, message) => info.push({ file, path, message });

  // 1) Each file must pass single-file validation first; drop structurally
  //    invalid files from the graph so tree checks never crash on garbage.
  const valid = [];
  for (const doc of docs) {
    if (!isObject(doc?.sot)) { err(doc?.name ?? "?", "$", "not an object"); continue; }
    const r = validateSot(doc.sot);
    r.errors.forEach(e => err(doc.name, e.path, e.message));
    if (r.valid) valid.push(doc);
  }

  const roots = valid.filter(d => d.sot.schemaVersion === "1.0");
  const initiatives = valid.filter(d => d.sot.schemaVersion === "1.1");

  if (roots.length === 0 && initiatives.length) err("(tree)", "$", "no 1.0 main document found — initiatives have no root to anchor to");
  if (roots.length > 1) err("(tree)", "$", `expected one 1.0 main document per product tree, found ${roots.length}`);

  const productIds = new Set(initiatives.map(d => d.sot.initiative.productId));
  if (productIds.size > 1) err("(tree)", "$", `a tree must be a single product, found productIds: ${[...productIds].join(", ")}`);
  const productId = productIds.size === 1 ? [...productIds][0] : (roots.length ? "(root only)" : null);

  // 2) Build the scope map: "root" + each initiative by its id.
  const scopes = new Map();
  if (roots.length === 1) scopes.set(ROOT, { id: ROOT, isRoot: true, doc: roots[0], status: "implemented" });
  const seenIds = new Map();
  const seenPaths = new Map();
  for (const d of initiatives) {
    const meta = d.sot.initiative;
    if (seenIds.has(meta.id)) err(d.name, "$.initiative.id", `duplicate initiative id "${meta.id}" (also in ${seenIds.get(meta.id)})`);
    else { seenIds.set(meta.id, d.name); scopes.set(meta.id, { id: meta.id, isRoot: false, doc: d, status: meta.status }); }
    const pathKey = meta.path;
    if (seenPaths.has(pathKey)) err(d.name, "$.initiative.path", `duplicate path "${pathKey}" (also in ${seenPaths.get(pathKey)}) — paths must never be reused, dropped files included`);
    else seenPaths.set(pathKey, d.name);
  }

  // 3) Parent existence + no cycles, per initiative.
  const parentOf = id => { const s = scopes.get(id); return s && !s.isRoot ? s.doc.sot.initiative.parent.scopeId : null; };
  for (const d of initiatives) {
    const meta = d.sot.initiative;
    if (!scopes.has(meta.parent.scopeId)) { err(d.name, "$.initiative.parent.scopeId", `parent scope "${meta.parent.scopeId}" does not exist in this tree`); continue; }
    // walk the ancestry to root, detecting cycles
    const seen = new Set([meta.id]);
    let cursor = meta.parent.scopeId, cyclic = false;
    while (cursor && cursor !== ROOT) {
      if (seen.has(cursor)) { cyclic = true; break; }
      seen.add(cursor);
      cursor = parentOf(cursor);
    }
    if (cyclic) err(d.name, "$.initiative.parent", `cycle detected in ancestry of "${meta.id}"`);

    // 4) path prefix: only constrained when the parent is another initiative.
    //    (root has no path; root-child numbering is an open roadmap question.)
    if (meta.parent.scopeId !== ROOT) {
      const parentScope = scopes.get(meta.parent.scopeId);
      if (parentScope && !parentScope.isRoot) {
        const parentPath = parentScope.doc.sot.initiative.path;
        if (!String(meta.path).startsWith(parentPath + "-")) {
          err(d.name, "$.initiative.path", `path "${meta.path}" must extend parent path "${parentPath}" (e.g. "${parentPath}-1")`);
        }
      }
    }

    // 5) parent digest vs actual parent, severity by status.
    const parentScope = scopes.get(meta.parent.scopeId);
    if (parentScope) {
      const actual = sotDigest(parentScope.doc.sot);
      if (actual !== meta.parent.digest) {
        const sev = digestSeverity(meta.status);
        const msg = `parent digest stale: recorded ${meta.parent.digest.slice(0, 19)}… but ${parentScope.doc.name} now hashes ${actual.slice(0, 19)}…`;
        (sev === "error" ? err : sev === "info" ? note : warn)(d.name, "$.initiative.parent.digest",
          sev === "warning" && meta.status === "implemented" ? msg + " (기준 낡음 — 지도에는 유지)" : msg);
      }
    }
  }

  // 6) Boundary stubs: scopeId must be a real ancestor, pageId must exist there,
  //    and stored title/type must not have drifted from the target page.
  const ancestorsOf = id => { const out = new Set(); let c = parentOf(id); while (c) { out.add(c); c = c === ROOT ? null : parentOf(c); } return out; };
  for (const d of initiatives) {
    const meta = d.sot.initiative;
    const ancestors = ancestorsOf(meta.id);
    const walk = (pages, base) => (pages ?? []).forEach((p, i) => {
      const path = `${base}[${i}]`;
      if (isObject(p.boundary)) {
        const b = p.boundary;
        if (!ancestors.has(b.scopeId)) err(d.name, `${path}.boundary.scopeId`, `"${b.scopeId}" is not an ancestor scope of "${meta.id}"`);
        else if (scopes.has(b.scopeId)) { // if the ancestor scope's doc is missing, inv3 already flagged it
          const target = pageById(scopes.get(b.scopeId).doc.sot, b.pageId);
          if (!target) err(d.name, `${path}.boundary.pageId`, `page "${b.pageId}" does not exist in scope "${b.scopeId}"`);
          else {
            if (target.title !== p.title) warn(d.name, `${path}.boundary`, `boundary title drift: stub "${p.title}" vs "${b.scopeId}/${b.pageId}" "${target.title}"`);
            if (target.type !== p.type) warn(d.name, `${path}.boundary`, `boundary type drift: stub "${p.type}" vs target "${target.type}"`);
          }
        }
      }
      walk(p.children, `${path}.children`);
    });
    d.sot.ia?.sections?.forEach((s, si) => walk(s.pages, `$.ia.sections[${si}].pages`));
  }

  // 7) dropped parent → active child = error, proposed child = warning.
  for (const d of initiatives) {
    const meta = d.sot.initiative;
    const parentScope = scopes.get(meta.parent.scopeId);
    if (parentScope && parentScope.status === "dropped") {
      if (ACTIVE.has(meta.status)) err(d.name, "$.initiative", `"${meta.status}" initiative under dropped parent "${parentScope.id}" — approve the parent or drop this`);
      else if (meta.status === "proposed") warn(d.name, "$.initiative", `proposed initiative under dropped parent "${parentScope.id}" — excluded from active synthesis`);
    }
  }

  // 8) Active set for map/index: approved requires a clean digest; implemented
  //    is always included (stale ones flagged above).
  const activeSet = [];
  const staleSet = [];
  for (const d of initiatives) {
    const meta = d.sot.initiative;
    if (!ACTIVE.has(meta.status)) continue;
    const parentScope = scopes.get(meta.parent.scopeId);
    const stale = parentScope && sotDigest(parentScope.doc.sot) !== meta.parent.digest;
    if (meta.status === "approved" && stale) continue; // excluded until rebased+reapproved
    activeSet.push(meta.id);
    if (stale) staleSet.push(meta.id);
  }

  return {
    valid: errors.length === 0,
    errors, warnings, info,
    product: { productId, root: roots[0]?.name ?? null, scopeCount: scopes.size, activeSet, staleSet }
  };
}
