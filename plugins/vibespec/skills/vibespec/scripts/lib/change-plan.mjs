// Deterministic, ID-addressed SOT editing. Agents submit a narrow change plan
// instead of rewriting a whole SOT, so unrelated entities cannot disappear as
// a side effect of context loss. This is intentionally not generic JSON Patch:
// every operation understands VibeSpec ids and ownership.
import { sotDigest, stableStringify } from "./c14n.mjs";
import { diffReport } from "./diff.mjs";
import { validateSot } from "../validate-sot.mjs";

const clone = value => JSON.parse(JSON.stringify(value));
const FEATURE_KEYS = new Set(["title", "desc", "status", "priority", "acceptance"]);
const REQUIREMENT_KEYS = new Set(["title", "desc", "status", "priority", "acceptance"]);
const PAGE_KEYS = new Set(["title", "type", "refs"]);
const SECTION_KEYS = new Set(["title"]);
const SPEC_KEYS = new Set(["title", "desc", "acceptance"]);
const DOCUMENT_KEYS = new Set(["title", "lang"]);
const PRD_TEXT_FIELDS = new Set(["oneLiner", "goal", "whyNow", "category", "problem", "solution", "alternatives", "differentiator", "northStar"]);
const PRD_STRING_LIST_FIELDS = new Set(["platforms", "inScope", "nonGoals", "assumptions", "risks", "openQuestions", "constraints"]);
const PRD_OBJECT_LISTS = {
  targets: { key: "name", keys: new Set(["name", "role", "needs", "pain"]) },
  scenarios: { key: "text", keys: new Set(["text", "start"]) },
  kpis: { key: "name", keys: new Set(["name", "target", "baseline", "method", "refs"]) }
};
const INITIATIVE_IDENTITY_FIELDS = new Set(["category", "platforms", "northStar", "differentiator", "alternatives"]);
const V1_OPERATIONS = new Set(["updateFeature", "addFeature", "removeFeature", "updatePage", "addPage", "removePage", "addTransition", "removeTransition"]);
const fail = message => { throw new Error(message); };
const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value);

function requireObject(value, label) {
  if (!isObject(value)) fail(label + " must be an object");
  return value;
}
function idSet(value, field) {
  if (!Array.isArray(value) || value.some(id => typeof id !== "string" || !/^[RFSP][1-9]\d*$/.test(id))) {
    fail("expected." + field + " must be an array of stable R#/F#/S#/P# ids");
  }
  if (new Set(value).size !== value.length) fail("expected." + field + " must not contain duplicates");
  return new Set(value);
}
function pathSet(value, field) {
  if (!Array.isArray(value) || value.some(path => typeof path !== "string" || !path)) fail("expected." + field + " must be an array of non-empty change paths");
  if (new Set(value).size !== value.length) fail("expected." + field + " must not contain duplicates");
  return new Set(value);
}
function sameSet(a, b) { return a.size === b.size && [...a].every(value => b.has(value)); }
function featureEntry(sot, id) {
  for (const requirement of sot.requirements || []) {
    const index = (requirement.features || []).findIndex(feature => feature.id === id);
    if (index >= 0) return { requirement, index, feature: requirement.features[index] };
  }
  return null;
}
function requirementEntry(sot, id) {
  const index = (sot.requirements || []).findIndex(requirement => requirement.id === id);
  return index < 0 ? null : { index, requirement: sot.requirements[index] };
}
function sectionEntry(sot, id) {
  const index = (sot.ia?.sections || []).findIndex(section => section.id === id);
  return index < 0 ? null : { index, section: sot.ia.sections[index] };
}
function pageEntry(sot, id) {
  const walk = (pages, owner) => {
    for (let index = 0; index < (pages || []).length; index++) {
      const page = pages[index];
      if (page.id === id) return { pages, index, page, owner };
      const nested = walk(page.children, page);
      if (nested) return nested;
    }
    return null;
  };
  for (const section of sot.ia?.sections || []) {
    const found = walk(section.pages, section);
    if (found) return found;
  }
  return null;
}
function pageIds(sot) {
  const ids = new Set();
  const walk = pages => (pages || []).forEach(page => { ids.add(page.id); walk(page.children); });
  (sot.ia?.sections || []).forEach(section => walk(section.pages));
  return ids;
}
function featureIds(sot) {
  return new Set((sot.requirements || []).flatMap(requirement => (requirement.features || []).map(feature => feature.id)));
}
function requirementIds(sot) { return new Set((sot.requirements || []).map(requirement => requirement.id)); }
function sectionIds(sot) { return new Set((sot.ia?.sections || []).map(section => section.id)); }
function collectPageIds(pages, ids = new Set()) {
  for (const page of pages || []) {
    if (ids.has(page.id)) fail("duplicate page id " + page.id + " inside added section");
    ids.add(page.id);
    collectPageIds(page.children, ids);
  }
  return ids;
}
function same(value, other) { return stableStringify(value) === stableStringify(other); }
function requireV2(kind, op) {
  if (kind !== "vibespec-change-plan-v2") fail(op + " requires vibespec-change-plan-v2");
}
function requireExactBefore(actual, before, label) {
  if (!isObject(before) || !same(actual, before)) fail(label + ".before must exactly match the current value");
}
function assertInitiativeFieldAllowed(sot, field) {
  if (sot.initiative && INITIATIVE_IDENTITY_FIELDS.has(field)) {
    fail("initiative " + field + " belongs to the main document; edit the main instead");
  }
}
function listForPrd(sot, field) {
  if (!PRD_STRING_LIST_FIELDS.has(field) && !Object.hasOwn(PRD_OBJECT_LISTS, field)) fail("unknown PRD list field " + field);
  assertInitiativeFieldAllowed(sot, field);
  if (!Array.isArray(sot.prd[field])) sot.prd[field] = [];
  return sot.prd[field];
}
function prdItemIndex(list, field, match) {
  if (PRD_STRING_LIST_FIELDS.has(field)) {
    if (typeof match !== "string" || !match) fail("PRD string-list match must be a non-empty string");
    const found = list.reduce((all, item, index) => item === match ? [...all, index] : all, []);
    if (found.length !== 1) fail("PRD " + field + " match must identify exactly one item");
    return found[0];
  }
  const key = PRD_OBJECT_LISTS[field].key;
  if (!isObject(match) || typeof match[key] !== "string" || !match[key]) fail("PRD " + field + ".match must contain " + key);
  const found = list.reduce((all, item, index) => item && item[key] === match[key] ? [...all, index] : all, []);
  if (found.length !== 1) fail("PRD " + field + " match must identify exactly one item");
  return found[0];
}
function assertUniquePrdItem(list, field, item, exceptIndex = -1) {
  if (PRD_STRING_LIST_FIELDS.has(field)) {
    if (typeof item !== "string" || !item) fail("PRD " + field + " item must be a non-empty string");
    if (list.some((value, index) => index !== exceptIndex && value === item)) fail("PRD " + field + " item must be unique");
    return;
  }
  const key = PRD_OBJECT_LISTS[field].key;
  if (!isObject(item) || typeof item[key] !== "string" || !item[key]) fail("PRD " + field + " item must contain " + key);
  if (list.some((value, index) => index !== exceptIndex && value && value[key] === item[key])) fail("PRD " + field + " " + key + " must be unique");
}
function pageHasDescendant(page, id) {
  return (page.children || []).some(child => child.id === id || pageHasDescendant(child, id));
}
function hasBoundaryPage(pages) {
  return (pages || []).some(page => page.boundary || hasBoundaryPage(page.children));
}
function assignAllowed(target, changes, allowed, label) {
  const patch = requireObject(changes, label + ".changes");
  const keys = Object.keys(patch);
  if (!keys.length) fail(label + ".changes must not be empty");
  for (const key of keys) {
    if (!allowed.has(key)) fail(label + ".changes." + key + " is not an allowed field");
    target[key] = clone(patch[key]);
  }
}

function applyOperation(sot, operation, kind) {
  const op = requireObject(operation, "operation");
  if (typeof op.op !== "string") fail("operation.op must be a string");
  if (kind === "vibespec-change-plan-v1" && !V1_OPERATIONS.has(op.op)) fail(op.op + " requires vibespec-change-plan-v2");
  if (op.op === "updateDocument") {
    requireV2(kind, op.op);
    assignAllowed(sot, op.changes, DOCUMENT_KEYS, "updateDocument");
    return;
  }
  if (op.op === "updatePrdText") {
    requireV2(kind, op.op);
    if (!PRD_TEXT_FIELDS.has(op.field)) fail("updatePrdText.field is not an editable PRD text field");
    assertInitiativeFieldAllowed(sot, op.field);
    if (typeof op.value !== "string") fail("updatePrdText.value must be a string");
    if (op.expectedValue !== sot.prd[op.field]) fail("updatePrdText.expectedValue must match the current field value");
    sot.prd[op.field] = op.value;
    return;
  }
  if (op.op === "appendPrdItem") {
    requireV2(kind, op.op);
    const list = listForPrd(sot, op.field);
    assertUniquePrdItem(list, op.field, op.item);
    list.push(clone(op.item));
    return;
  }
  if (op.op === "updatePrdItem") {
    requireV2(kind, op.op);
    const list = listForPrd(sot, op.field);
    const index = prdItemIndex(list, op.field, op.match);
    if (PRD_STRING_LIST_FIELDS.has(op.field)) {
      if (!isObject(op.changes) || Object.keys(op.changes).length !== 1 || typeof op.changes.value !== "string") fail("updatePrdItem string-list changes must contain only value");
      assertUniquePrdItem(list, op.field, op.changes.value, index);
      list[index] = op.changes.value;
    } else {
      assignAllowed(list[index], op.changes, PRD_OBJECT_LISTS[op.field].keys, "updatePrdItem");
      assertUniquePrdItem(list, op.field, list[index], index);
    }
    return;
  }
  if (op.op === "removePrdItem") {
    requireV2(kind, op.op);
    const list = listForPrd(sot, op.field);
    const index = prdItemIndex(list, op.field, op.match);
    list.splice(index, 1);
    return;
  }
  if (op.op === "updateRequirement") {
    requireV2(kind, op.op);
    const entry = requirementEntry(sot, op.id);
    if (!entry) fail("updateRequirement: unknown requirement " + op.id);
    assignAllowed(entry.requirement, op.changes, REQUIREMENT_KEYS, "updateRequirement");
    return;
  }
  if (op.op === "addRequirement") {
    requireV2(kind, op.op);
    const requirement = requireObject(op.requirement, "addRequirement.requirement");
    if (typeof requirement.id !== "string" || !/^R[1-9]\d*$/.test(requirement.id)) fail("addRequirement.requirement.id must be a stable R# id");
    if (requirementIds(sot).has(requirement.id)) fail("addRequirement: duplicate requirement id " + requirement.id);
    const addedFeatures = new Set();
    for (const feature of requirement.features || []) {
      if (typeof feature.id !== "string" || !/^F[1-9]\d*$/.test(feature.id)) fail("addRequirement features must have stable F# ids");
      if (featureIds(sot).has(feature.id) || addedFeatures.has(feature.id)) fail("addRequirement: duplicate feature id " + feature.id);
      addedFeatures.add(feature.id);
    }
    sot.requirements.push(clone(requirement));
    return;
  }
  if (op.op === "removeRequirement") {
    requireV2(kind, op.op);
    const entry = requirementEntry(sot, op.id);
    if (!entry) fail("removeRequirement: unknown requirement " + op.id);
    if ((entry.requirement.features || []).length) fail("removeRequirement: remove or move its features explicitly first");
    sot.requirements.splice(entry.index, 1);
    return;
  }
  if (op.op === "updateFeature") {
    const entry = featureEntry(sot, op.id);
    if (!entry) fail("updateFeature: unknown feature " + op.id);
    assignAllowed(entry.feature, op.changes, FEATURE_KEYS, "updateFeature");
    return;
  }
  if (op.op === "addFeature") {
    const requirement = (sot.requirements || []).find(item => item.id === op.requirementId);
    const feature = requireObject(op.feature, "addFeature.feature");
    if (!requirement) fail("addFeature: unknown requirement " + op.requirementId);
    if (typeof feature.id !== "string" || !/^F[1-9]\d*$/.test(feature.id)) fail("addFeature.feature.id must be a stable F# id");
    if (featureIds(sot).has(feature.id)) fail("addFeature: duplicate feature id " + feature.id);
    requirement.features.push(clone(feature));
    return;
  }
  if (op.op === "removeFeature") {
    const entry = featureEntry(sot, op.id);
    if (!entry) fail("removeFeature: unknown feature " + op.id);
    entry.requirement.features.splice(entry.index, 1);
    return;
  }
  if (op.op === "moveFeature") {
    requireV2(kind, op.op);
    const entry = featureEntry(sot, op.id);
    const target = requirementEntry(sot, op.requirementId);
    if (!entry) fail("moveFeature: unknown feature " + op.id);
    if (!target) fail("moveFeature: unknown requirement " + op.requirementId);
    if (entry.requirement === target.requirement) fail("moveFeature: feature is already owned by " + op.requirementId);
    const [feature] = entry.requirement.features.splice(entry.index, 1);
    target.requirement.features.push(feature);
    return;
  }
  if (op.op === "updateSpec") {
    requireV2(kind, op.op);
    const entry = featureEntry(sot, op.featureId);
    if (!entry) fail("updateSpec: unknown feature " + op.featureId);
    if (!Number.isInteger(op.index) || op.index < 0 || op.index >= (entry.feature.specs || []).length) fail("updateSpec.index is out of range");
    requireExactBefore(entry.feature.specs[op.index], op.before, "updateSpec");
    assignAllowed(entry.feature.specs[op.index], op.changes, SPEC_KEYS, "updateSpec");
    return;
  }
  if (op.op === "appendSpec") {
    requireV2(kind, op.op);
    const entry = featureEntry(sot, op.featureId);
    if (!entry) fail("appendSpec: unknown feature " + op.featureId);
    entry.feature.specs.push(clone(requireObject(op.spec, "appendSpec.spec")));
    return;
  }
  if (op.op === "removeSpec") {
    requireV2(kind, op.op);
    const entry = featureEntry(sot, op.featureId);
    if (!entry) fail("removeSpec: unknown feature " + op.featureId);
    if (!Number.isInteger(op.index) || op.index < 0 || op.index >= (entry.feature.specs || []).length) fail("removeSpec.index is out of range");
    if (op.index !== entry.feature.specs.length - 1) fail("removeSpec: only the final spec may be removed; earlier indexes are reference-bearing");
    requireExactBefore(entry.feature.specs[op.index], op.before, "removeSpec");
    entry.feature.specs.pop();
    return;
  }
  if (op.op === "updateSection") {
    requireV2(kind, op.op);
    const entry = sectionEntry(sot, op.id);
    if (!entry) fail("updateSection: unknown section " + op.id);
    if (entry.section.boundary) fail("updateSection: " + op.id + " is a boundary section; edit the parent-owned source instead");
    assignAllowed(entry.section, op.changes, SECTION_KEYS, "updateSection");
    return;
  }
  if (op.op === "addSection") {
    requireV2(kind, op.op);
    const section = requireObject(op.section, "addSection.section");
    if (typeof section.id !== "string" || !/^S[1-9]\d*$/.test(section.id)) fail("addSection.section.id must be a stable S# id");
    if (sectionIds(sot).has(section.id)) fail("addSection: duplicate section id " + section.id);
    if (section.boundary || hasBoundaryPage(section.pages)) fail("addSection: boundaries are parent-owned; create them only in an initiative/tree workflow");
    const addedPages = collectPageIds(section.pages);
    for (const id of addedPages) if (pageIds(sot).has(id)) fail("addSection: duplicate page id " + id);
    sot.ia.sections.push(clone(section));
    return;
  }
  if (op.op === "removeSection") {
    requireV2(kind, op.op);
    const entry = sectionEntry(sot, op.id);
    if (!entry) fail("removeSection: unknown section " + op.id);
    if (entry.section.boundary) fail("removeSection: boundary sections are parent-owned and cannot be removed here");
    if ((entry.section.pages || []).length) fail("removeSection: move or remove every page explicitly first");
    sot.ia.sections.splice(entry.index, 1);
    return;
  }
  if (op.op === "updatePage") {
    const entry = pageEntry(sot, op.id);
    if (!entry) fail("updatePage: unknown page " + op.id);
    if (entry.page.boundary) fail("updatePage: " + op.id + " is a boundary stub; update its owner instead");
    assignAllowed(entry.page, op.changes, PAGE_KEYS, "updatePage");
    return;
  }
  if (op.op === "addPage") {
    const section = (sot.ia?.sections || []).find(item => item.id === op.sectionId);
    const page = requireObject(op.page, "addPage.page");
    if (!section) fail("addPage: unknown section " + op.sectionId);
    if (typeof page.id !== "string" || !/^P[1-9]\d*$/.test(page.id)) fail("addPage.page.id must be a stable P# id");
    if (pageIds(sot).has(page.id)) fail("addPage: duplicate page id " + page.id);
    if (page.boundary) fail("addPage: boundaries are parent-owned; create them only in an initiative/tree workflow");
    if (Array.isArray(page.children) && page.children.length) fail("addPage.page.children must be empty; add descendants separately");
    const added = { ...clone(page), children: [] };
    if (op.parentId === undefined || op.parentId === null) section.pages.push(added);
    else {
      const parent = pageEntry(sot, op.parentId);
      if (!parent) fail("addPage: unknown parent page " + op.parentId);
      parent.page.children.push(added);
    }
    return;
  }
  if (op.op === "removePage") {
    const entry = pageEntry(sot, op.id);
    if (!entry) fail("removePage: unknown page " + op.id);
    if (entry.page.boundary) fail("removePage: boundary stubs are parent-owned and cannot be removed here");
    if ((entry.page.children || []).length) fail("removePage: " + op.id + " has children; remove or move them explicitly first");
    entry.pages.splice(entry.index, 1);
    return;
  }
  if (op.op === "movePage") {
    requireV2(kind, op.op);
    const entry = pageEntry(sot, op.id);
    if (!entry) fail("movePage: unknown page " + op.id);
    if (entry.page.boundary) fail("movePage: boundary stubs are parent-owned and cannot be moved here");
    let targetPages;
    if (op.parentId !== undefined && op.parentId !== null) {
      const parent = pageEntry(sot, op.parentId);
      if (!parent) fail("movePage: unknown parent page " + op.parentId);
      if (parent.page.id === entry.page.id || pageHasDescendant(entry.page, parent.page.id)) fail("movePage: cannot move a page under itself or its descendant");
      targetPages = parent.page.children;
    } else {
      const section = sectionEntry(sot, op.sectionId);
      if (!section) fail("movePage: unknown destination section " + op.sectionId);
      targetPages = section.section.pages;
    }
    if (targetPages === entry.pages) fail("movePage: source and destination are the same");
    const [page] = entry.pages.splice(entry.index, 1);
    targetPages.push(page);
    return;
  }
  if (op.op === "addTransition") {
    sot.flow.transitions.push(clone(requireObject(op.transition, "addTransition.transition")));
    return;
  }
  if (op.op === "removeTransition") {
    const match = requireObject(op.transition, "removeTransition.transition");
    const index = (sot.flow?.transitions || []).findIndex(item =>
      item.from === match.from && item.to === match.to && item.ref === match.ref && item.label === match.label);
    if (index < 0) fail("removeTransition: exact transition not found");
    sot.flow.transitions.splice(index, 1);
    return;
  }
  if (op.op === "updateTransition") {
    requireV2(kind, op.op);
    const before = requireObject(op.before, "updateTransition.before");
    const after = requireObject(op.after, "updateTransition.after");
    const index = (sot.flow?.transitions || []).findIndex(item => same(item, before));
    if (index < 0) fail("updateTransition: exact current transition not found");
    sot.flow.transitions[index] = clone(after);
    return;
  }
  if (op.op === "setFlowStart") {
    requireV2(kind, op.op);
    if (op.expectedPageId !== sot.flow.start) fail("setFlowStart.expectedPageId must match the current flow start");
    if (typeof op.pageId !== "string" || !/^P[1-9]\d*$/.test(op.pageId)) fail("setFlowStart.pageId must be a P# id");
    sot.flow.start = op.pageId;
    return;
  }
  fail('unsupported operation "' + op.op + '"');
}

function changedIds(report) {
  const ids = new Set();
  for (const change of report.changes) {
    for (const match of change.path.matchAll(/(?:^|[^A-Z0-9])([RFSP][1-9]\d*)/g)) ids.add(match[1]);
  }
  return ids;
}
function idsByType(report, type) {
  // A removed acceptance row such as F1.acceptance[0], or a positional spec
  // such as F1:0, is not a removed persistent entity. V2 tracks those exact
  // paths separately; only true R/F/S/P entities belong in removedIds.
  return new Set(report.changes
    .filter(change => change.type === type)
    .map(change => {
      const match = change.path.match(/^([RFSP][1-9]\d*)$/);
      return match ? match[1] : null;
    })
    .filter(Boolean));
}

export function applyChangePlan(before, plan) {
  requireObject(plan, "plan");
  if (!["vibespec-change-plan-v1", "vibespec-change-plan-v2"].includes(plan.kind)) fail('plan.kind must equal "vibespec-change-plan-v1" or "vibespec-change-plan-v2"');
  const actualDigest = sotDigest(before);
  if (plan.baseDigest !== actualDigest) fail("base digest mismatch: plan " + plan.baseDigest + " but document " + actualDigest);
  const expected = requireObject(plan.expected, "plan.expected");
  const expectedTouched = idSet(expected.touchedIds, "touchedIds");
  const expectedAdded = idSet(expected.addedIds, "addedIds");
  const expectedRemoved = idSet(expected.removedIds, "removedIds");
  const expectedPaths = plan.kind === "vibespec-change-plan-v2" ? pathSet(expected.touchedPaths, "touchedPaths") : null;
  if (!Array.isArray(plan.operations) || !plan.operations.length) fail("plan.operations must be a non-empty array");

  const after = clone(before);
  plan.operations.forEach(operation => applyOperation(after, operation, plan.kind));
  const validation = validateSot(after);
  if (!validation.valid) fail("change plan produced an invalid SOT: " + validation.errors.map(e => e.path + " " + e.message).join("; "));
  const report = diffReport(before, after);
  const actualTouched = changedIds(report);
  const actualAdded = idsByType(report, "added");
  const actualRemoved = idsByType(report, "removed");
  const actualPaths = new Set(report.changes.map(change => change.path));
  if (!sameSet(actualTouched, expectedTouched)) fail("unexpected touched ids: expected [" + [...expectedTouched].join(", ") + "], actual [" + [...actualTouched].join(", ") + "]");
  if (!sameSet(actualAdded, expectedAdded)) fail("unexpected added ids: expected [" + [...expectedAdded].join(", ") + "], actual [" + [...actualAdded].join(", ") + "]");
  if (!sameSet(actualRemoved, expectedRemoved)) fail("unexpected removed ids: expected [" + [...expectedRemoved].join(", ") + "], actual [" + [...actualRemoved].join(", ") + "]");
  if (expectedPaths && !sameSet(actualPaths, expectedPaths)) fail("unexpected touched paths: expected [" + [...expectedPaths].join(", ") + "], actual [" + [...actualPaths].join(", ") + "]");
  return { after, report, validation, digest: { before: actualDigest, after: sotDigest(after) } };
}
