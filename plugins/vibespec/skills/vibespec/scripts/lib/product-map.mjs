// Product map (v2 data layer): compose a main SOT with its ACTIVE initiatives
// into one read-only tree. An initiative attaches via a boundary stub — a page
// that references a parent page ({scopeId,pageId}); the stub's own children
// (the increment's screens) are grafted under that parent page in the composite.
// Every node carries a composite id ("root/P6", "notif/P2") and its provenance
// scope, so nothing collides and the viewer can show what came from where.
//
// Only the ancestry-closed active set (validate-tree's rule: approved with a
// fresh digest + implemented) is composed; proposed/dropped/stale are excluded
// with a reason. A map is only built for a tree that validate-tree accepts.
import { validateTree } from "./tree.mjs";

const isObject = v => v !== null && typeof v === "object" && !Array.isArray(v);

function compositePage(page, scope, refScope) {
  // refs are feature refs local to `scope`; qualify them for the composite.
  const node = {
    compositeId: `${scope}/${page.id}`,
    localId: page.id,
    scope,
    title: page.title,
    type: page.type,
    refs: (page.refs || []).map(ref => `${refScope || scope}/${ref}`),
    children: []
  };
  return node;
}

// opts.embedDocs: carry each scope's source SOT in the payload, so the rendered
// map can open the document that defines a node. Without it a map shows an
// increment you have no way to read — a dead end. The HTML map embeds by default;
// the JSON map does not, so a data consumer is not handed duplicated documents.
export function buildProductMap(docs, opts = {}) {
  const tree = validateTree(docs);
  if (!tree.valid) return { valid: false, errors: tree.errors, warnings: tree.warnings };

  const active = new Set(tree.product.activeSet);
  const initiatives = docs.filter(d => isObject(d.sot) && d.sot.schemaVersion === "1.1" && isObject(d.sot.initiative));
  const root = docs.find(d => isObject(d.sot) && d.sot.schemaVersion === "1.0");

  // Excluded initiatives (with reason) so the map is honest about what it omits.
  const staleSet = new Set(tree.product.staleSet);
  const excluded = initiatives
    .filter(d => !active.has(d.sot.initiative.id))
    .map(d => {
      const s = d.sot.initiative.status;
      const reason = s === "proposed" ? "proposed (not yet approved)"
        : s === "dropped" ? "dropped"
        : "excluded by an inactive ancestor";
      return { id: d.sot.initiative.id, status: s, reason };
    });

  // 1) Seed the composite with the main IA. Index every composite page by
  //    "scope/localId" so graft targets resolve.
  const index = new Map();
  const embed = sot => (opts.embedDocs ? { sot: JSON.parse(JSON.stringify(sot)) } : {});
  const scopeInfo = [{ id: "root", title: (root && root.sot.title) || "Main", status: "main", ...(root ? embed(root.sot) : {}) }];
  const cloneInto = (pages, scope) => (pages || []).map(p => {
    const node = compositePage(p, scope);
    index.set(node.compositeId, node);
    node.children = cloneInto(p.children, scope);
    return node;
  });
  const iaSections = root ? root.sot.ia.sections.map(sec => ({
    id: `root/${sec.id}`, scope: "root", title: sec.title, pages: cloneInto(sec.pages, "root")
  })) : [];

  // 2) Graft each ACTIVE initiative, shallowest first, so an ancestor scope is
  //    already in the index before its descendants attach.
  const activeDocs = initiatives.filter(d => active.has(d.sot.initiative.id))
    .sort((a, b) => a.sot.initiative.path.split("-").length - b.sot.initiative.path.split("-").length
      || a.sot.initiative.path.localeCompare(b.sot.initiative.path, undefined, { numeric: true }));
  const attachments = [];

  for (const d of activeDocs) {
    const meta = d.sot.initiative;
    scopeInfo.push({ id: meta.id, title: d.sot.title, status: meta.status, path: meta.path, ...embed(d.sot) });
    // Walk the initiative IA at ANY depth (validate-tree allows a boundary at
    // any depth). A boundary stub is a reference, not a real node: it is not
    // materialized; its children graft under the boundary target. A non-boundary
    // page is a screen the initiative introduces and becomes a composite node.
    // `host` is the composite node (or section-pages holder) new nodes attach to.
    const graftPage = (p, host) => {
      if (isObject(p.boundary)) {
        const targetKey = `${p.boundary.scopeId}/${p.boundary.pageId}`;
        const target = index.get(targetKey);
        if (target) attachments.push({ initiative: meta.id, at: targetKey });
        const stubHost = target || { children: orphanSection(iaSections, meta).pages }; // missing target: defensive
        (p.children || []).forEach(child => graftPage(child, stubHost));
      } else {
        const node = compositePage(p, meta.id);
        index.set(node.compositeId, node);
        (host ? host.children : orphanSection(iaSections, meta).pages).push(node);
        (p.children || []).forEach(child => graftPage(child, node));
      }
    };
    (d.sot.ia.sections || []).forEach(sec => (sec.pages || []).forEach(p => graftPage(p, null)));
  }

  return {
    // `kind` lets the viewer detect a read-only map payload vs an editable SOT.
    kind: "vibespec-product-map",
    valid: true,
    lang: (root && root.sot.lang) || "ko",
    productId: tree.product.productId,
    scopes: scopeInfo,
    active: [...active],
    excluded,
    stale: [...staleSet],
    attachments,
    ia: iaSections
  };
}

// A place to hang an initiative's non-boundary top pages: one composite section
// per initiative, created lazily.
function orphanSection(iaSections, meta) {
  const id = `${meta.id}/__added`;
  let sec = iaSections.find(s => s.id === id);
  if (!sec) { sec = { id, scope: meta.id, title: `＋ ${meta.title}`, pages: [] }; iaSections.push(sec); }
  return sec;
}
