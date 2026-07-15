// Merge (land) an implemented initiative into the main: materialize the increment
// as permanent, editable main content — the composition, but written back to the
// 1.0 baseline instead of a read-only map. The initiative's ids are renumbered
// into the main's id space, its boundary stubs resolve (children graft onto the
// main target), its non-boundary sections/pages become native main nodes, and its
// requirements/flow/inScope fold in. The landed initiative is marked (tombstone),
// and because the main changed, every remaining initiative on it is now stale
// (report — never silently rewritten; that's rebase's job).
import { validateTree } from "./tree.mjs";

const isObject = v => v !== null && typeof v === "object" && !Array.isArray(v);
const clone = v => JSON.parse(JSON.stringify(v));

function maxNum(sot, prefix) {
  let max = 0;
  const re = new RegExp(`^${prefix}([1-9][0-9]*)$`);
  const scan = v => {
    if (Array.isArray(v)) v.forEach(scan);
    else if (isObject(v)) for (const [k, val] of Object.entries(v)) {
      if (k === "id" && typeof val === "string") { const m = re.exec(val); if (m) max = Math.max(max, +m[1]); }
      else scan(val);
    }
  };
  scan(sot);
  return max;
}

// planMerge(docs, initiativeId) → { ok, error?, errors?, main?, landed?, report?, staleSiblings? }
// docs: [{ name, sot }]. Pure — computes the merge but writes nothing.
export function planMerge(docs, initiativeId) {
  const tree = validateTree(docs);
  if (!tree.valid) return { ok: false, error: "the tree has errors — fix them before merging", errors: tree.errors };

  const initDoc = docs.find(d => isObject(d.sot.initiative) && d.sot.initiative.id === initiativeId);
  if (!initDoc) return { ok: false, error: `no initiative "${initiativeId}" in the tree` };
  const I = initDoc.sot, meta = I.initiative;

  if (meta.status !== "implemented") return { ok: false, error: `only an implemented initiative can be merged; "${initiativeId}" is "${meta.status}"` };
  if (!meta.parent || meta.parent.scopeId !== "root") return { ok: false, error: `merge supports main-attached initiatives only; "${initiativeId}" is layered on "${meta.parent && meta.parent.scopeId}"` };
  const activeChildren = docs.filter(d => isObject(d.sot.initiative)
    && d.sot.initiative.parent && d.sot.initiative.parent.scopeId === meta.id
    && !["dropped", "landed"].includes(d.sot.initiative.status));
  if (activeChildren.length) return { ok: false, error: `land or drop the child initiative(s) first: ${activeChildren.map(d => d.sot.initiative.id).join(", ")}` };

  const mainDoc = docs.find(d => isObject(d.sot) && d.sot.schemaVersion === "1.0" && !isObject(d.sot.initiative));
  if (!mainDoc) return { ok: false, error: "no main (1.0) document in the tree" };

  const M = clone(mainDoc.sot);
  let nextP = maxNum(M, "P") + 1, nextF = maxNum(M, "F") + 1, nextR = maxNum(M, "R") + 1, nextS = maxNum(M, "S") + 1;

  // Pass 1: assign new main ids to the initiative's own nodes; record boundary resolutions.
  const reqMap = {}, featMap = {}, pageMap = {}, secMap = {}, pageResolve = {};
  for (const r of I.requirements || []) { reqMap[r.id] = `R${nextR++}`; for (const f of r.features || []) featMap[f.id] = `F${nextF++}`; }
  const assignPages = pages => (pages || []).forEach(p => {
    if (isObject(p.boundary)) pageResolve[p.id] = p.boundary.pageId; else pageMap[p.id] = `P${nextP++}`;
    assignPages(p.children);
  });
  for (const s of I.ia.sections || []) { if (!isObject(s.boundary)) secMap[s.id] = `S${nextS++}`; assignPages(s.pages); }

  const mapRef = ref => { const [f, idx] = String(ref).split(":"); const nf = featMap[f] || f; return idx !== undefined ? `${nf}:${idx}` : nf; };
  const mapPage = id => pageMap[id] || pageResolve[id] || id;
  const findMainPage = id => { let hit = null; const w = pgs => { for (const p of pgs || []) { if (hit) return; if (p.id === id) { hit = p; return; } w(p.children); } }; M.ia.sections.forEach(s => w(s.pages)); return hit; };
  const findMainSection = id => M.ia.sections.find(s => s.id === id);

  // Pass 2: place the initiative's pages. A non-boundary page becomes a new main
  // node in hostArray; a boundary page vanishes and its children graft onto the
  // resolved main target page.
  const attachedAt = [];
  const placePages = (pages, hostArray) => (pages || []).forEach(p => {
    if (isObject(p.boundary)) {
      const target = findMainPage(p.boundary.pageId);
      if (target) { target.children = target.children || []; attachedAt.push({ from: initiativeId, at: `${p.boundary.scopeId}/${p.boundary.pageId}` }); placePages(p.children, target.children); }
    } else {
      hostArray.push({ id: pageMap[p.id], title: p.title, type: p.type, refs: (p.refs || []).map(mapRef), children: [] });
      placePages(p.children, hostArray[hostArray.length - 1].children);
    }
  });
  for (const s of I.ia.sections || []) {
    if (isObject(s.boundary)) {
      const ms = findMainSection(s.boundary.sectionId);
      if (ms) { ms.pages = ms.pages || []; placePages(s.pages, ms.pages); }
    } else {
      const ns = { id: secMap[s.id], title: s.title, pages: [] };
      placePages(s.pages, ns.pages);
      M.ia.sections.push(ns);
    }
  }

  // Requirements fold in as new main requirements (ids renumbered, specs keep index).
  for (const r of I.requirements || []) {
    M.requirements.push({
      id: reqMap[r.id], title: r.title, desc: r.desc || "", status: r.status || "todo", priority: r.priority || "mid",
      acceptance: r.acceptance || [],
      features: (r.features || []).map(f => ({ id: featMap[f.id], title: f.title, desc: f.desc || "", status: f.status || "todo", priority: f.priority || "mid", acceptance: f.acceptance || [], specs: f.specs || [] }))
    });
  }

  // Flow transitions fold in (from/to remapped, boundary from/to → the main target).
  M.flow = M.flow || { start: null, transitions: [] };
  M.flow.transitions = M.flow.transitions || [];
  for (const t of I.flow?.transitions || []) {
    const nt = { from: mapPage(t.from), to: mapPage(t.to) };
    if (t.ref) nt.ref = mapRef(t.ref); else if (t.label) nt.label = t.label;
    M.flow.transitions.push(nt);
  }

  // PRD: only `inScope` auto-merges (the increment is now in scope). Every OTHER
  // lean-PRD field the initiative carries is semantic — folding it into the main's
  // narrative/metrics blind would corrupt them — so surface ALL of it for human
  // review. Nothing the initiative planned is silently lost: it stays in the
  // landed file AND appears here, with kpi refs / scenario starts renumbered into
  // the main's id space so a reviewer can wire them straight in.
  const P = I.prd || {};
  if (Array.isArray(P.inScope) && P.inScope.length) { M.prd.inScope = M.prd.inScope || []; M.prd.inScope.push(...P.inScope); }
  M.schemaVersion = "1.0";

  const manualPrdReview = {};
  for (const f of ["problem", "solution", "goal", "oneLiner"]) if (P[f]) manualPrdReview[f] = P[f];
  for (const f of ["nonGoals", "targets", "assumptions", "risks", "openQuestions", "constraints"]) if ((P[f] || []).length) manualPrdReview[f] = P[f];
  if ((P.kpis || []).length) manualPrdReview.kpis = P.kpis.map(k => ({ ...k, refs: (k.refs || []).map(mapRef) }));      // refs → new main F#/F#:idx
  if ((P.scenarios || []).length) manualPrdReview.scenarios = P.scenarios.map(s => (s.start ? { ...s, start: mapPage(s.start) } : { ...s })); // start → new main P#

  const landed = clone(I); landed.initiative.status = "landed";

  // Every remaining main-attached initiative now references a stale main digest.
  const staleSiblings = docs.filter(d => isObject(d.sot.initiative) && d.sot.initiative.id !== initiativeId
    && d.sot.initiative.parent && d.sot.initiative.parent.scopeId === "root"
    && !["dropped", "landed"].includes(d.sot.initiative.status)).map(d => d.sot.initiative.id);

  const report = {
    initiative: initiativeId,
    addedRequirements: Object.entries(reqMap).map(([o, n]) => `${o}→${n}`),
    addedFeatures: Object.entries(featMap).map(([o, n]) => `${o}→${n}`),
    addedPages: Object.entries(pageMap).map(([o, n]) => `${o}→${n}`),
    addedSections: Object.entries(secMap).map(([o, n]) => `${o}→${n}`),
    attachedAt,
    mergedInScope: (P.inScope || []).slice(),          // what auto-merged into the main
    manualPrdReview,                                    // everything else the reviewer must fold in by hand
    staleSiblings
  };
  return { ok: true, main: M, mainName: mainDoc.name, landed, landedName: initDoc.name, report, staleSiblings };
}
