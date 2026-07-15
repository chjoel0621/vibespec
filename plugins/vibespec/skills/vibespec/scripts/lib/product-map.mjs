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
        : s === "landed" ? "landed (merged into the main)"
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
  // Index composed sections by "scope/sectionId" so a section boundary resolves.
  const sectionIndex = new Map();
  const iaSections = root ? root.sot.ia.sections.map(sec => {
    const s = { id: `root/${sec.id}`, scope: "root", title: sec.title, pages: cloneInto(sec.pages, "root") };
    sectionIndex.set(`root/${sec.id}`, s);
    return s;
  }) : [];
  // 2) Graft each ACTIVE initiative, shallowest first, so an ancestor scope is
  //    already in the index before its descendants attach.
  const activeDocs = initiatives.filter(d => active.has(d.sot.initiative.id))
    .sort((a, b) => a.sot.initiative.path.split("-").length - b.sot.initiative.path.split("-").length
      || a.sot.initiative.path.localeCompare(b.sot.initiative.path, undefined, { numeric: true }));
  const attachments = [];

  for (const d of activeDocs) {
    const meta = d.sot.initiative;
    scopeInfo.push({ id: meta.id, title: d.sot.title, status: meta.status, path: meta.path, ...embed(d.sot) });
    // Walk the initiative IA at ANY depth. A page boundary stub is a reference,
    // not a real node: it is not materialized; its children graft under the
    // boundary target. A non-boundary page is a new screen and becomes a
    // composite node. `host` is the composite node it attaches to; `secHost` is
    // the composed section it lands in when it has no page host.
    const graftPage = (p, host, secHost) => {
      if (isObject(p.boundary)) {
        const targetKey = `${p.boundary.scopeId}/${p.boundary.pageId}`;
        const target = index.get(targetKey);
        if (target) attachments.push({ initiative: meta.id, at: targetKey });
        const stubHost = target || secHost; // missing target: keep children in the section
        (p.children || []).forEach(child => graftPage(child, stubHost, secHost));
      } else {
        const node = compositePage(p, meta.id);
        index.set(node.compositeId, node);
        (host ? host.children : secHost.pages).push(node);
        (p.children || []).forEach(child => graftPage(child, node, secHost));
      }
    };
    // A section boundary mirrors a main section: the initiative's new pages land
    // in that main section (page stubs still graft under their page targets). A
    // section WITHOUT a boundary is a new section of the initiative, kept with the
    // author's title and tagged by scope. Either way nothing is silently dropped —
    // but a new section is surfaced only if a page actually lands in it, so a
    // pure wrapper (only page-boundary stubs that graft elsewhere) adds no phantom.
    (d.sot.ia.sections || []).forEach(sec => {
      const bkey = isObject(sec.boundary) ? `${sec.boundary.scopeId}/${sec.boundary.sectionId}` : null;
      const existing = bkey ? sectionIndex.get(bkey) : null;
      const secHost = existing || { id: `${meta.id}/${sec.id}`, scope: meta.id, title: sec.title, pages: [] };
      (sec.pages || []).forEach(p => graftPage(p, null, secHost));
      if (!existing && secHost.pages.length) { iaSections.push(secHost); sectionIndex.set(secHost.id, secHost); }
    });
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
