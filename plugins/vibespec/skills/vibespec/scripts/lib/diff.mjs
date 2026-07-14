// SOT diff + impact-radius library (v0.5 contract).
// Consumed by the diff-sot CLI today and by the v1 rebase flow later, so keep
// the exported shapes stable: diffSot() returns change records addressed by
// stable ids (R#/F#/F#:i/S#/P#), impactFor() maps changed entities to the
// pages/transitions/KPIs/scenarios they touch, and unchangedSections() proves
// what did NOT change via canonical-byte equality.
// Known limitation: specs and scenarios have no ids, so they diff by position —
// inserting one in the middle reports the shifted tail as modified. Producers
// (viewer, skill) only append, which keeps positional diffs honest.
import { stableStringify, sotDigest } from "./c14n.mjs";

const same = (a, b) => stableStringify(a) === stableStringify(b);
const scalar = v => (v === undefined ? undefined : v);

function record(list, path, type, before, after) {
  const entry = { path, type };
  if (before !== undefined) entry.before = before;
  if (after !== undefined) entry.after = after;
  list.push(entry);
}

function diffScalars(list, basePath, before = {}, after = {}, keys) {
  for (const key of keys) {
    if (!same(scalar(before[key]), scalar(after[key]))) {
      record(list, basePath ? `${basePath}.${key}` : key, "modified", before[key], after[key]);
    }
  }
}

function diffStringArray(list, path, before = [], after = []) {
  const added = after.filter(x => !before.includes(x));
  const removed = before.filter(x => !after.includes(x));
  if (added.length || removed.length) {
    const entry = { path, type: "modified" };
    if (added.length) entry.added = added;
    if (removed.length) entry.removed = removed;
    list.push(entry);
  }
}

function diffAcceptance(list, basePath, before = [], after = []) {
  const max = Math.max(before.length, after.length);
  for (let i = 0; i < max; i++) {
    if (i >= before.length) record(list, `${basePath}.acceptance[${i}]`, "added", undefined, after[i]);
    else if (i >= after.length) record(list, `${basePath}.acceptance[${i}]`, "removed", before[i], undefined);
    else if (!same(before[i], after[i])) record(list, `${basePath}.acceptance[${i}]`, "modified", before[i], after[i]);
  }
}

function byKey(items = [], keyOf) {
  const map = new Map();
  items.forEach((item, index) => { if (item && typeof item === "object") map.set(keyOf(item, index), item); });
  return map;
}

function featureIndex(sot) {
  const map = new Map();
  (sot.requirements ?? []).forEach(requirement =>
    (requirement.features ?? []).forEach(feature => map.set(feature.id, { feature, owner: requirement.id })));
  return map;
}

function flattenPages(sot) {
  const map = new Map();
  const walk = (pages, parent) => (pages ?? []).forEach(page => {
    map.set(page.id, { page, parent });
    walk(page.children, page.id);
  });
  (sot.ia?.sections ?? []).forEach(section => walk(section.pages, section.id));
  return map;
}

const transitionKey = t => `${t.from}→${t.to}`;
const transitionTrigger = t => (t.ref !== undefined ? `ref:${t.ref}` : t.label !== undefined ? `label:${t.label}` : "무트리거");
const groupTransitions = (list = []) => {
  const map = new Map();
  for (const t of list) {
    if (!t || typeof t !== "object") continue;
    const key = transitionKey(t);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(t);
  }
  return map;
};

export function diffSot(before, after) {
  const changes = [];
  diffScalars(changes, "", before, after, ["schemaVersion", "title", "lang"]);

  const prdBefore = before.prd ?? {}, prdAfter = after.prd ?? {};
  diffScalars(changes, "prd", prdBefore, prdAfter,
    ["oneLiner", "goal", "whyNow", "category", "problem", "solution", "alternatives", "differentiator", "northStar"]);
  for (const key of ["platforms", "inScope", "nonGoals", "assumptions", "risks", "openQuestions", "constraints"]) {
    diffStringArray(changes, `prd.${key}`, prdBefore[key], prdAfter[key]);
  }
  for (const [key, keyOf, fields] of [
    ["targets", t => t.name, ["role", "needs", "pain"]],
    ["kpis", k => k.name, ["target", "baseline", "method"]]
  ]) {
    const b = byKey(prdBefore[key], keyOf), a = byKey(prdAfter[key], keyOf);
    for (const [name, item] of a) if (!b.has(name)) record(changes, `prd.${key}[${name}]`, "added", undefined, item);
    for (const [name, item] of b) {
      if (!a.has(name)) { record(changes, `prd.${key}[${name}]`, "removed", item, undefined); continue; }
      const next = a.get(name);
      diffScalars(changes, `prd.${key}[${name}]`, item, next, fields);
      if (key === "kpis") diffStringArray(changes, `prd.${key}[${name}].refs`, item.refs, next.refs);
    }
  }
  const scnB = prdBefore.scenarios ?? [], scnA = prdAfter.scenarios ?? [];
  for (let i = 0; i < Math.max(scnB.length, scnA.length); i++) {
    if (i >= scnB.length) record(changes, `prd.scenarios[${i}]`, "added", undefined, scnA[i]);
    else if (i >= scnA.length) record(changes, `prd.scenarios[${i}]`, "removed", scnB[i], undefined);
    else if (!same(scnB[i], scnA[i])) record(changes, `prd.scenarios[${i}]`, "modified", scnB[i], scnA[i]);
  }

  const reqB = byKey(before.requirements, r => r.id), reqA = byKey(after.requirements, r => r.id);
  for (const [id, req] of reqA) if (!reqB.has(id)) record(changes, id, "added", undefined, { title: req.title });
  for (const [id, req] of reqB) {
    if (!reqA.has(id)) { record(changes, id, "removed", { title: req.title }, undefined); continue; }
    const next = reqA.get(id);
    diffScalars(changes, id, req, next, ["title", "desc", "status", "priority"]);
    diffAcceptance(changes, id, req.acceptance, next.acceptance);
  }
  const featB = featureIndex(before), featA = featureIndex(after);
  for (const [id, { feature }] of featA) if (!featB.has(id)) record(changes, id, "added", undefined, { title: feature.title });
  for (const [id, { feature, owner }] of featB) {
    if (!featA.has(id)) { record(changes, id, "removed", { title: feature.title }, undefined); continue; }
    const { feature: next, owner: nextOwner } = featA.get(id);
    if (owner !== nextOwner) record(changes, id, "moved", owner, nextOwner);
    diffScalars(changes, id, feature, next, ["title", "desc", "status", "priority"]);
    diffAcceptance(changes, id, feature.acceptance, next.acceptance);
    const specsB = feature.specs ?? [], specsA = next.specs ?? [];
    for (let i = 0; i < Math.max(specsB.length, specsA.length); i++) {
      const path = `${id}:${i}`;
      if (i >= specsB.length) record(changes, path, "added", undefined, { title: specsA[i].title });
      else if (i >= specsA.length) record(changes, path, "removed", { title: specsB[i].title }, undefined);
      else {
        diffScalars(changes, path, specsB[i], specsA[i], ["title", "desc"]);
        diffAcceptance(changes, path, specsB[i].acceptance, specsA[i].acceptance);
      }
    }
  }

  const secB = byKey(before.ia?.sections, s => s.id), secA = byKey(after.ia?.sections, s => s.id);
  for (const [id, sec] of secA) if (!secB.has(id)) record(changes, id, "added", undefined, { title: sec.title });
  for (const [id, sec] of secB) {
    if (!secA.has(id)) { record(changes, id, "removed", { title: sec.title }, undefined); continue; }
    diffScalars(changes, id, sec, secA.get(id), ["title"]);
  }
  const pageB = flattenPages(before), pageA = flattenPages(after);
  for (const [id, { page }] of pageA) if (!pageB.has(id)) record(changes, id, "added", undefined, { title: page.title });
  for (const [id, { page, parent }] of pageB) {
    if (!pageA.has(id)) { record(changes, id, "removed", { title: page.title }, undefined); continue; }
    const { page: next, parent: nextParent } = pageA.get(id);
    if (parent !== nextParent) record(changes, id, "moved", parent, nextParent);
    diffScalars(changes, id, page, next, ["title", "type"]);
    diffStringArray(changes, `${id}.refs`, page.refs, next.refs);
  }

  if (!same(scalar(before.flow?.start), scalar(after.flow?.start))) {
    record(changes, "flow.start", "modified", before.flow?.start, after.flow?.start);
  }
  // Parallel transitions (same from→to, different trigger) are legal per the
  // contract, so from→to alone is NOT an identity. Diff as a multiset per
  // from→to group: the 1-vs-1 case stays a friendly "modified"; anything else
  // matches exact-equal pairs and reports the rest as added/removed,
  // disambiguated by trigger in the path.
  const grpB = groupTransitions(before.flow?.transitions), grpA = groupTransitions(after.flow?.transitions);
  for (const key of new Set([...grpB.keys(), ...grpA.keys()])) {
    const b = grpB.get(key) ?? [], a = grpA.get(key) ?? [];
    if (b.length === 1 && a.length === 1) {
      if (!same(b[0], a[0])) record(changes, `flow.${key}`, "modified", b[0], a[0]);
      continue;
    }
    const remaining = [...a];
    for (const t of b) {
      const match = remaining.findIndex(x => same(x, t));
      if (match >= 0) remaining.splice(match, 1);
      else record(changes, `flow.${key}[${transitionTrigger(t)}]`, "removed", t, undefined);
    }
    for (const t of remaining) record(changes, `flow.${key}[${transitionTrigger(t)}]`, "added", undefined, t);
  }

  const removedIds = changes.filter(c => c.type === "removed" && /^[RFSP][0-9]/.test(c.path)).map(c => c.path);
  return { changes, removedIds };
}

export function unchangedSections(before, after) {
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  return [...keys].filter(key => same(before?.[key], after?.[key])).sort();
}

// Expand an entity to itself + its children (a feature owns its specs, a
// requirement owns its features and their specs) — mirrors the viewer's
// traceability so "F3 changed" reports everything F3's subtree touches.
function expandEntity(id, sot) {
  const ids = new Set([id]);
  const features = featureIndex(sot);
  const addFeature = fid => {
    ids.add(fid);
    const entry = features.get(fid);
    (entry?.feature.specs ?? []).forEach((_, i) => ids.add(`${fid}:${i}`));
  };
  if (/^R[0-9]/.test(id)) {
    const requirement = (sot.requirements ?? []).find(r => r.id === id);
    (requirement?.features ?? []).forEach(f => addFeature(f.id));
  } else if (/^F[0-9]+$/.test(id)) addFeature(id);
  return ids;
}

export function impactFor(entityIds, sot) {
  const pages = flattenPages(sot);
  const transitions = sot.flow?.transitions ?? [];
  const report = {};
  for (const id of entityIds) {
    const impact = { pages: [], transitions: [], kpis: [], scenarios: [] };
    if (/^P[0-9]/.test(id)) {
      impact.transitions = transitions.filter(t => t.from === id || t.to === id).map(transitionKey);
      impact.scenarios = (sot.prd?.scenarios ?? []).flatMap((s, i) => (s.start === id ? [`prd.scenarios[${i}]`] : []));
    } else {
      const subtree = expandEntity(id, sot);
      for (const [pid, { page }] of pages) if ((page.refs ?? []).some(ref => subtree.has(ref))) impact.pages.push(pid);
      impact.transitions = transitions.filter(t => t.ref && subtree.has(t.ref)).map(transitionKey);
      impact.kpis = (sot.prd?.kpis ?? []).filter(k => (k.refs ?? []).some(ref => subtree.has(ref))).map(k => k.name);
    }
    if (impact.pages.length || impact.transitions.length || impact.kpis.length || impact.scenarios.length) report[id] = impact;
  }
  return report;
}

function mergeImpact(primary, secondary) {
  const merged = {};
  for (const id of new Set([...Object.keys(primary), ...Object.keys(secondary)])) {
    merged[id] = Object.fromEntries(["pages", "transitions", "kpis", "scenarios"].map(key => [
      key,
      [...new Set([...(primary[id]?.[key] ?? []), ...(secondary[id]?.[key] ?? [])])]
    ]));
  }
  return merged;
}

export function diffReport(before, after) {
  const { changes, removedIds } = diffSot(before, after);
  const changedEntities = [...new Set(changes.map(c => c.path.split(".")[0].split(":")[0]).filter(p => /^[RFP][0-9]/.test(p)))];
  return {
    changes,
    removedIds,
    unchanged: unchangedSections(before, after),
    // Impact must consider BOTH documents: a deleted feature's connections
    // exist only in `before` (the update contract says to clean its refs),
    // while an added feature's connections exist only in `after`.
    impact: mergeImpact(impactFor(changedEntities, before), impactFor(changedEntities, after)),
    digest: { before: sotDigest(before), after: sotDigest(after) }
  };
}
