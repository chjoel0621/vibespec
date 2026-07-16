// Return a bounded edit context for stable feature/page ids. This lets an
// agent plan a narrow operation without loading and reserializing the full SOT.
import { sotDigest } from "./c14n.mjs";

const clone = value => JSON.parse(JSON.stringify(value));
const pageWalk = (pages, fn, parents = []) => (pages || []).forEach(page => {
  fn(page, parents);
  pageWalk(page.children, fn, [...parents, page.id]);
});
function featureEntry(sot, id) {
  for (const requirement of sot.requirements || []) {
    const feature = (requirement.features || []).find(item => item.id === id);
    if (feature) return { requirement, feature };
  }
  return null;
}
function pageEntry(sot, id) {
  for (const section of sot.ia?.sections || []) {
    let found = null;
    pageWalk(section.pages, (page, parents) => {
      if (!found && page.id === id) found = { section, page, parents };
    });
    if (found) return found;
  }
  return null;
}
function refsFeature(page, featureId) {
  return (page.refs || []).some(ref => ref === featureId || ref.startsWith(featureId + ":"));
}

export function querySot(sot, ids = [], prdFields = []) {
  const idPattern = /^(?:R[1-9]\d*|F[1-9]\d*(?::\d+)?|S[1-9]\d*|P[1-9]\d*)$/;
  if (!Array.isArray(ids) || ids.some(id => typeof id !== "string" || !idPattern.test(id))) {
    throw new Error("ids must contain only stable R#/F#/F#:index/S#/P# selectors");
  }
  if (!Array.isArray(prdFields) || prdFields.some(field => typeof field !== "string" || !Object.hasOwn(sot.prd || {}, field))) {
    throw new Error("prdFields must name fields present in prd");
  }
  if (!ids.length && !prdFields.length) throw new Error("request at least one id or PRD field");
  const requested = [...new Set(ids)];
  const requestedPrdFields = [...new Set(prdFields)];
  const requirements = new Set(requested.filter(id => id.startsWith("R")));
  const sections = new Set(requested.filter(id => id.startsWith("S")));
  const requestedSpecs = requested.filter(id => /^F[1-9]\d*:\d+$/.test(id));
  const features = new Set(requested.filter(id => id.startsWith("F")).map(id => id.split(":")[0]));
  const pages = new Set(requested.filter(id => id.startsWith("P")));
  const featureContexts = [];
  const pageContexts = [];

  for (const id of requirements) {
    const entry = (sot.requirements || []).find(requirement => requirement.id === id);
    if (!entry) throw new Error("unknown requirement " + id);
    (entry.features || []).forEach(feature => features.add(feature.id));
  }
  for (const id of sections) {
    const entry = (sot.ia?.sections || []).find(section => section.id === id);
    if (!entry) throw new Error("unknown section " + id);
    pageWalk(entry.pages, page => pages.add(page.id));
  }
  for (const id of requestedSpecs) {
    const [featureId, indexText] = id.split(":");
    const entry = featureEntry(sot, featureId);
    if (!entry) throw new Error("unknown feature " + featureId);
    if (!Number.isInteger(Number(indexText)) || Number(indexText) < 0 || Number(indexText) >= (entry.feature.specs || []).length) {
      throw new Error("unknown feature spec " + id);
    }
  }

  for (const id of [...features]) {
    const entry = featureEntry(sot, id);
    if (!entry) throw new Error("unknown feature " + id);
    featureContexts.push({ requirementId: entry.requirement.id, requirementTitle: entry.requirement.title, feature: clone(entry.feature) });
    (sot.ia?.sections || []).forEach(section => pageWalk(section.pages, page => {
      if (refsFeature(page, id)) pages.add(page.id);
    }));
  }
  for (const id of [...pages]) {
    const entry = pageEntry(sot, id);
    if (!entry) throw new Error("unknown page " + id);
    pageContexts.push({
      sectionId: entry.section.id,
      sectionTitle: entry.section.title,
      ancestors: entry.parents,
      page: clone(entry.page)
    });
    (entry.page.refs || []).forEach(ref => features.add(ref.split(":")[0]));
  }
  // A feature discovered through a focused page still needs its owning
  // requirement and full feature record, but never pulls unrelated features.
  for (const id of [...features]) {
    if (featureContexts.some(item => item.feature.id === id)) continue;
    const entry = featureEntry(sot, id);
    if (entry) featureContexts.push({ requirementId: entry.requirement.id, requirementTitle: entry.requirement.title, feature: clone(entry.feature) });
  }
  // A page discovered from a feature reference is returned with its section.
  for (const id of [...pages]) {
    if (pageContexts.some(item => item.page.id === id)) continue;
    const entry = pageEntry(sot, id);
    if (entry) pageContexts.push({ sectionId: entry.section.id, sectionTitle: entry.section.title, ancestors: entry.parents, page: clone(entry.page) });
  }

  const pageSet = new Set(pageContexts.map(item => item.page.id));
  const featureSet = new Set(featureContexts.map(item => item.feature.id));
  return {
    kind: "vibespec-edit-context-v2",
    baseDigest: sotDigest(sot),
    requested,
    requestedPrdFields,
    requirements: [...requirements].map(id => clone((sot.requirements || []).find(requirement => requirement.id === id))),
    sections: [...sections].map(id => clone((sot.ia?.sections || []).find(section => section.id === id))),
    ...(requestedPrdFields.length ? { prd: Object.fromEntries(requestedPrdFields.map(field => [field, clone(sot.prd[field])])) } : {}),
    features: featureContexts,
    pages: pageContexts,
    transitions: (sot.flow?.transitions || []).filter(transition =>
      pageSet.has(transition.from) || pageSet.has(transition.to) || (transition.ref && featureSet.has(transition.ref.split(":")[0]))
    ).map(clone),
    kpis: (sot.prd?.kpis || []).filter(kpi => (kpi.refs || []).some(ref => featureSet.has(ref.split(":")[0]))).map(clone),
    scenarios: (sot.prd?.scenarios || []).filter(scenario => pageSet.has(scenario.start)).map(clone)
  };
}
