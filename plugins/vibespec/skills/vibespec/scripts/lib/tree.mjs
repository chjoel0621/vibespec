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
function sectionById(sot, id) {
  return (sot.ia?.sections ?? []).find(s => s.id === id) || null;
}
// Which main section contains a given page (at any depth). Used to check that a
// page-boundary stub's enclosing initiative section mirrors that main section.
function sectionOfPage(sot, pageId) {
  for (const section of sot.ia?.sections ?? []) {
    let hit = false;
    const walk = pages => { for (const p of pages ?? []) { if (hit) return; if (p.id === pageId) { hit = true; return; } walk(p.children); } };
    walk(section.pages);
    if (hit) return section;
  }
  return null;
}

// digest-mismatch severity by initiative status (roadmap §2).
function digestSeverity(status) {
  if (status === "approved") return "error";
  if (status === "implemented") return "warning"; // shipped reality — flagged "stale", still synthesized
  if (status === "dropped") return "info";
  if (status === "landed") return "info"; // merged into the main — its digest no longer matters
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
        const escapedParentPath = parentPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        if (!new RegExp(`^${escapedParentPath}-[1-9]\\d*$`).test(String(meta.path))) {
          err(d.name, "$.initiative.path", `path "${meta.path}" must extend parent path "${parentPath}" by exactly one numeric segment (e.g. "${parentPath}-1")`);
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
  const ancestorsOf = id => {
    const out = new Set();
    const seen = new Set([id]);
    let c = parentOf(id);
    while (c) {
      if (seen.has(c)) break; // The cycle is already reported above; never hang while reporting it.
      seen.add(c);
      out.add(c);
      if (c === ROOT) break;
      c = parentOf(c);
    }
    return out;
  };
  for (const d of initiatives) {
    const meta = d.sot.initiative;
    const ancestors = ancestorsOf(meta.id);
    // enc = the top-level initiative section wrapping the page (with its path), so
    // a page boundary can be checked against its enclosing section's boundary.
    const walk = (pages, base, enc) => (pages ?? []).forEach((p, i) => {
      const path = `${base}[${i}]`;
      if (isObject(p.boundary)) {
        const b = p.boundary;
        if (!ancestors.has(b.scopeId)) err(d.name, `${path}.boundary.scopeId`, `"${b.scopeId}" is not an ancestor scope of "${meta.id}"`);
        else if (scopes.has(b.scopeId)) { // if the ancestor scope's doc is missing, inv3 already flagged it
          const targetDoc = scopes.get(b.scopeId).doc.sot;
          const target = pageById(targetDoc, b.pageId);
          if (!target) err(d.name, `${path}.boundary.pageId`, `page "${b.pageId}" does not exist in scope "${b.scopeId}"`);
          else {
            if (target.title !== p.title) warn(d.name, `${path}.boundary`, `boundary title drift: stub "${p.title}" vs "${b.scopeId}/${b.pageId}" "${target.title}"`);
            if (target.type !== p.type) warn(d.name, `${path}.boundary`, `boundary type drift: stub "${p.type}" vs target "${target.type}"`);
            // Consistency: the enclosing initiative section should be a boundary
            // onto the main section that holds this target page — otherwise the
            // wrapper has no counterpart in the main and composes as a new section
            // (or silently vanishes). This is what keeps every level explicit:
            // a reference (mirror) or a declared new section, never a phantom.
            const mainSec = sectionOfPage(targetDoc, b.pageId);
            if (mainSec && enc) {
              const sb = enc.section.boundary;
              if (!isObject(sb)) warn(d.name, `${enc.path}.boundary`, `page boundary "${b.scopeId}/${b.pageId}" is under a section with no boundary — declare that section as a boundary onto "${b.scopeId}/${mainSec.id}" ("${mainSec.title}"), or it composes as a separate new section`);
              else if (!(sb.scopeId === b.scopeId && sb.sectionId === mainSec.id)) warn(d.name, `${enc.path}.boundary`, `section boundary "${sb.scopeId}/${sb.sectionId}" does not match where its page boundary attaches ("${b.scopeId}/${mainSec.id}")`);
            }
          }
        }
      }
      walk(p.children, `${path}.children`, enc);
    });
    d.sot.ia?.sections?.forEach((s, si) => {
      const sp = `$.ia.sections[${si}]`;
      // Section-level boundary: scopeId must be an ancestor, sectionId must exist
      // there, and the stored title must mirror the target section (drift warns).
      if (isObject(s.boundary)) {
        const b = s.boundary;
        if (!ancestors.has(b.scopeId)) err(d.name, `${sp}.boundary.scopeId`, `"${b.scopeId}" is not an ancestor scope of "${meta.id}"`);
        else if (scopes.has(b.scopeId)) {
          const targetSec = sectionById(scopes.get(b.scopeId).doc.sot, b.sectionId);
          if (!targetSec) err(d.name, `${sp}.boundary.sectionId`, `section "${b.sectionId}" does not exist in scope "${b.scopeId}"`);
          else if (targetSec.title !== s.title) warn(d.name, `${sp}.boundary`, `section boundary title drift: stub "${s.title}" vs "${b.scopeId}/${b.sectionId}" "${targetSec.title}"`);
        }
      }
      walk(s.pages, `${sp}.pages`, { section: s, path: sp });
    });
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

  // 8) Active set for map/index, ANCESTRY-CLOSED: an initiative is active only
  //    if it is self-active AND every ancestor up to root is active too. A
  //    stale approved parent that drops out must take its subtree with it —
  //    otherwise the map synthesizes an overlay onto a scope that isn't there.
  const digestOf = new Map(); // memoize parent-doc hashes
  const hashScope = id => { if (!digestOf.has(id)) digestOf.set(id, sotDigest(scopes.get(id).doc.sot)); return digestOf.get(id); };
  const isStale = meta => { const p = scopes.get(meta.parent.scopeId); return !!p && hashScope(meta.parent.scopeId) !== meta.parent.digest; };
  const selfActive = scope => {
    if (scope.isRoot) return true;
    const meta = scope.doc.sot.initiative;
    if (!ACTIVE.has(meta.status)) return false;
    if (meta.status === "approved" && isStale(meta)) return false; // excluded until rebased+reapproved
    return true;
  };
  const activeMemo = new Map();
  const isActive = id => {
    if (activeMemo.has(id)) return activeMemo.get(id);
    const scope = scopes.get(id);
    if (!scope) return false;
    activeMemo.set(id, false); // guard against cycles (already errored) while resolving
    const parentActive = scope.isRoot ? true : (scopes.has(scope.doc.sot.initiative.parent.scopeId) && isActive(scope.doc.sot.initiative.parent.scopeId));
    const result = selfActive(scope) && parentActive;
    activeMemo.set(id, result);
    return result;
  };
  const activeSet = [];
  const staleSet = [];
  for (const d of initiatives) {
    const meta = d.sot.initiative;
    if (isActive(meta.id)) {
      activeSet.push(meta.id);
      if (isStale(meta)) staleSet.push(meta.id); // only implemented reaches here while stale
    } else if (selfActive(scopes.get(meta.id))) {
      // self-active but excluded by an ancestor — point the user upstream.
      let cursor = meta.parent.scopeId, blocker = null;
      while (cursor && cursor !== ROOT && scopes.has(cursor)) {
        if (!selfActive(scopes.get(cursor))) { blocker = cursor; break; }
        cursor = scopes.get(cursor).doc.sot.initiative.parent.scopeId;
      }
      if (blocker) warn(d.name, "$.initiative", `excluded from the active set: ancestor "${blocker}" is not active — rebase/approve "${blocker}", not this`);
    }
  }

  // v1 only reports conflicts: active initiatives may still share a boundary,
  // but the user must see every affected file before resolving the overlap.
  const boundaryOwners = new Map();
  for (const d of initiatives) {
    if (!activeSet.includes(d.sot.initiative.id)) continue;
    const meta = d.sot.initiative;
    const walk = (pages, base) => (pages ?? []).forEach((page, i) => {
      const path = `${base}[${i}]`;
      if (isObject(page.boundary)) {
        const target = `${page.boundary.scopeId}/${page.boundary.pageId}`;
        if (!boundaryOwners.has(target)) boundaryOwners.set(target, new Map());
        boundaryOwners.get(target).set(meta.id, { file: d.name, path: `${path}.boundary` });
      }
      walk(page.children, `${path}.children`);
    });
    d.sot.ia?.sections?.forEach((section, i) => walk(section.pages, `$.ia.sections[${i}].pages`));
  }
  for (const [target, owners] of boundaryOwners) {
    if (owners.size < 2) continue;
    const ids = [...owners.keys()].join(", ");
    for (const { file, path } of owners.values()) {
      warn(file, path, `boundary conflict: active initiatives ${ids} all reference "${target}"`);
    }
  }

  return {
    valid: errors.length === 0,
    errors, warnings, info,
    product: { productId, root: roots[0]?.name ?? null, scopeCount: scopes.size, activeSet, staleSet }
  };
}
