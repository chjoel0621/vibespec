#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const sotSchema = JSON.parse(readFileSync(join(here, "..", "references", "sot.schema.json"), "utf8"));

const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value);
const featureRefPattern = /^F[1-9]\d*(?::\d+)?$/;
const pageIdPattern = /^P[1-9]\d*$/;

function validateJsonSchema(value) {
  const errors = [];
  const resolveRef = ref => ref.slice(2).split("/").reduce((node, key) => node?.[key.replace(/~1/g, "/").replace(/~0/g, "~")], sotSchema);
  const typeMatches = (candidate, type) => {
    if (type === "object") return isObject(candidate);
    if (type === "array") return Array.isArray(candidate);
    if (type === "integer") return Number.isInteger(candidate);
    if (type === "null") return candidate === null;
    return typeof candidate === type;
  };
  const visit = (candidate, schema, path, out) => {
    if (schema.$ref) {
      const target = resolveRef(schema.$ref);
      if (!target) out.push({ path, message: `unresolved schema ref ${schema.$ref}` });
      else visit(candidate, target, path, out);
      return;
    }
    if (schema.oneOf) {
      const matches = schema.oneOf.filter(option => {
        const branchErrors = [];
        visit(candidate, option, path, branchErrors);
        return branchErrors.length === 0;
      }).length;
      if (matches !== 1) out.push({ path, message: "must match exactly one allowed shape" });
      return;
    }
    if (schema.type && !typeMatches(candidate, schema.type)) {
      out.push({ path, message: `must be ${schema.type}` });
      return;
    }
    if (Object.hasOwn(schema, "const") && candidate !== schema.const) out.push({ path, message: `must equal ${JSON.stringify(schema.const)}` });
    if (schema.enum && !schema.enum.includes(candidate)) out.push({ path, message: `must be one of ${schema.enum.join(", ")}` });
    if (typeof candidate === "string") {
      if (schema.minLength !== undefined && candidate.length < schema.minLength) out.push({ path, message: `must have at least ${schema.minLength} character(s)` });
      if (schema.pattern && !new RegExp(schema.pattern).test(candidate)) out.push({ path, message: `must match ${schema.pattern}` });
    }
    if (Array.isArray(candidate)) {
      if (schema.minItems !== undefined && candidate.length < schema.minItems) out.push({ path, message: `must contain at least ${schema.minItems} item(s)` });
      if (schema.items) candidate.forEach((item, index) => visit(item, schema.items, `${path}[${index}]`, out));
    }
    if (isObject(candidate)) {
      (schema.required || []).forEach(key => {
        if (!Object.hasOwn(candidate, key)) out.push({ path: `${path}.${key}`, message: "is required" });
      });
      Object.entries(schema.properties || {}).forEach(([key, childSchema]) => {
        if (Object.hasOwn(candidate, key)) visit(candidate[key], childSchema, `${path}.${key}`, out);
      });
      if (schema.additionalProperties === false) {
        const allowed = new Set(Object.keys(schema.properties || {}));
        Object.keys(candidate).filter(key => !allowed.has(key)).forEach(key => out.push({ path: `${path}.${key}`, message: "field is not allowed" }));
      }
    }
  };
  visit(value, sotSchema, "$", errors);
  return errors;
}

export function validateSot(sot) {
  const errors = validateJsonSchema(sot);
  const warnings = [];
  const error = (path, message) => errors.push({ path, message });
  const warning = (path, message) => warnings.push({ path, message });
  const requireObject = (value, path) => {
    if (!isObject(value)) { error(path, "must be an object"); return false; }
    return true;
  };
  const requireArray = (value, path) => {
    if (!Array.isArray(value)) { error(path, "must be an array"); return false; }
    return true;
  };
  const requireString = (value, path, nonEmpty = false) => {
    if (typeof value !== "string" || (nonEmpty && !value.trim())) {
      error(path, nonEmpty ? "must be a non-empty string" : "must be a string");
      return false;
    }
    return true;
  };

  const result = () => {
    const uniqueErrors = [...new Map(errors.map(item => [`${item.path}\0${item.message}`, item])).values()];
    const uniqueWarnings = [...new Map(warnings.map(item => [`${item.path}\0${item.message}`, item])).values()];
    return { valid: uniqueErrors.length === 0, errors: uniqueErrors, warnings: uniqueWarnings };
  };
  if (!requireObject(sot, "$")) return result();
  if (!["1.0", "1.1"].includes(sot.schemaVersion)) error("$.schemaVersion", 'must equal "1.0" or "1.1"');
  const isInitiative = sot.schemaVersion === "1.1";
  requireString(sot.title, "$.title", true);
  if (sot.lang !== undefined && !["ko", "en"].includes(sot.lang)) error("$.lang", 'must be "ko" or "en"');

  const prd = sot.prd;
  if (requireObject(prd, "$.prd")) {
    const strings = ["oneLiner", "goal", "whyNow", "category", "problem", "solution", "alternatives", "differentiator", "northStar"];
    const nonEmpty = new Set(["oneLiner", "goal", "problem", "solution"]);
    strings.forEach(key => requireString(prd[key], `$.prd.${key}`, nonEmpty.has(key)));
    ["platforms", "targets", "scenarios", "kpis", "inScope", "nonGoals", "assumptions", "risks", "openQuestions", "constraints"]
      .forEach(key => requireArray(prd[key], `$.prd.${key}`));
  }

  const requirementIds = new Set();
  const featureIds = new Set();
  const featureRefs = new Set();
  if (requireArray(sot.requirements, "$.requirements")) {
    if (!sot.requirements.length) error("$.requirements", "must contain at least one requirement");
    sot.requirements.forEach((requirement, ri) => {
      const rp = `$.requirements[${ri}]`;
      if (!requireObject(requirement, rp)) return;
      if (!/^R[1-9]\d*$/.test(requirement.id || "")) error(`${rp}.id`, "must match R1, R2, ...");
      else if (requirementIds.has(requirement.id)) error(`${rp}.id`, `duplicate requirement id ${requirement.id}`);
      else requirementIds.add(requirement.id);
      requireString(requirement.title, `${rp}.title`, true);
      requireString(requirement.desc, `${rp}.desc`);
      if (!["todo", "doing", "done"].includes(requirement.status)) error(`${rp}.status`, "must be todo, doing, or done");
      if (!["high", "mid", "low"].includes(requirement.priority)) error(`${rp}.priority`, "must be high, mid, or low");
      requireArray(requirement.acceptance, `${rp}.acceptance`);
      if (!requireArray(requirement.features, `${rp}.features`)) return;
      if (!requirement.features.length) error(`${rp}.features`, "must contain at least one feature");
      requirement.features.forEach((feature, fi) => {
        const fp = `${rp}.features[${fi}]`;
        if (!requireObject(feature, fp)) return;
        if (!/^F[1-9]\d*$/.test(feature.id || "")) error(`${fp}.id`, "must match F1, F2, ...");
        else if (featureIds.has(feature.id)) error(`${fp}.id`, `duplicate feature id ${feature.id}`);
        else { featureIds.add(feature.id); featureRefs.add(feature.id); }
        requireString(feature.title, `${fp}.title`, true);
        requireString(feature.desc, `${fp}.desc`);
        if (!["todo", "doing", "done"].includes(feature.status)) error(`${fp}.status`, "must be todo, doing, or done");
        if (!["high", "mid", "low"].includes(feature.priority)) error(`${fp}.priority`, "must be high, mid, or low");
        requireArray(feature.acceptance, `${fp}.acceptance`);
        if (!requireArray(feature.specs, `${fp}.specs`)) return;
        feature.specs.forEach((spec, si) => {
          const sp = `${fp}.specs[${si}]`;
          featureRefs.add(`${feature.id}:${si}`);
          if (!requireObject(spec, sp)) return;
          requireString(spec.title, `${sp}.title`, true);
          requireString(spec.desc, `${sp}.desc`);
          requireArray(spec.acceptance, `${sp}.acceptance`);
        });
      });
    });
  }

  const pageIds = new Set();
  const iaRefs = new Set();
  const sectionIds = new Set();
  const boundaryPages = [];
  const walkPage = (page, path) => {
    if (!requireObject(page, path)) return;
    if (!pageIdPattern.test(page.id || "")) error(`${path}.id`, "must match P1, P2, ...");
    else if (pageIds.has(page.id)) error(`${path}.id`, `duplicate page id ${page.id}`);
    else pageIds.add(page.id);
    requireString(page.title, `${path}.title`, true);
    if (!["top", "page", "action"].includes(page.type)) error(`${path}.type`, "must be top, page, or action");
    if (requireArray(page.refs, `${path}.refs`)) page.refs.forEach((ref, i) => {
      if (!featureRefPattern.test(ref || "")) error(`${path}.refs[${i}]`, "must be a feature ref such as F1 or F1:0");
      else if (!featureRefs.has(ref)) error(`${path}.refs[${i}]`, `unknown feature ref ${ref}`);
      else iaRefs.add(ref);
    });
    if (Object.hasOwn(page, "boundary")) boundaryPages.push({ page, path });
    if (requireArray(page.children, `${path}.children`)) page.children.forEach((child, i) => walkPage(child, `${path}.children[${i}]`));
  };
  if (requireObject(sot.ia, "$.ia") && requireArray(sot.ia.sections, "$.ia.sections")) {
    if (!sot.ia.sections.length) error("$.ia.sections", "must contain at least one section");
    sot.ia.sections.forEach((section, si) => {
      const sp = `$.ia.sections[${si}]`;
      if (!requireObject(section, sp)) return;
      if (!/^S[1-9]\d*$/.test(section.id || "")) error(`${sp}.id`, "must match S1, S2, ...");
      else if (sectionIds.has(section.id)) error(`${sp}.id`, `duplicate section id ${section.id}`);
      else sectionIds.add(section.id);
      requireString(section.title, `${sp}.title`, true);
      if (requireArray(section.pages, `${sp}.pages`)) section.pages.forEach((page, pi) => walkPage(page, `${sp}.pages[${pi}]`));
    });
  }
  for (const ref of featureRefs) if (!iaRefs.has(ref)) error("$.ia", `missing IA coverage for ${ref}`);

  // Version-conditional: initiative meta + page boundary are 1.1-only. The
  // JSON Schema layer only accepts them structurally (superset); presence
  // rules and self-reference checks live here. Cross-file existence of
  // parent.scopeId / boundary.scopeId is validate-tree's job, not this file's.
  if (isInitiative) {
    // Single-file checks only. path↔parent-prefix consistency and cross-file
    // existence of parent.scopeId are validate-tree invariants (and exact path
    // issuance is still an open roadmap question), so they are NOT enforced here.
    const meta = sot.initiative;
    if (requireObject(meta, "$.initiative")) {
      if (meta.id === "root") error("$.initiative.id", '"root" is reserved for the main document');
      if (isObject(meta.parent) && meta.parent.scopeId === meta.id) error("$.initiative.parent.scopeId", "initiative cannot be its own parent");
    }
    for (const { page, path } of boundaryPages) {
      if (isObject(page.boundary) && page.boundary.scopeId === (meta && meta.id)) {
        error(`${path}.boundary.scopeId`, "boundary cannot reference the initiative's own scope");
      }
      if ((page.refs || []).length) warning(`${path}.refs`, "a boundary stub page should not carry its own feature refs");
    }
  } else {
    if (Object.hasOwn(sot, "initiative")) error("$.initiative", "initiative meta requires schemaVersion 1.1");
    for (const { path } of boundaryPages) error(`${path}.boundary`, "page boundary requires schemaVersion 1.1");
  }

  if (isObject(prd)) {
    if (Array.isArray(prd.scenarios)) prd.scenarios.forEach((scenario, i) => {
      const path = `$.prd.scenarios[${i}]`;
      if (!requireObject(scenario, path)) return;
      requireString(scenario.text, `${path}.text`, true);
      if (scenario.start !== undefined && scenario.start !== "" && !pageIds.has(scenario.start)) error(`${path}.start`, `unknown page id ${scenario.start}`);
    });
    if (Array.isArray(prd.kpis)) prd.kpis.forEach((kpi, i) => {
      const path = `$.prd.kpis[${i}]`;
      if (!requireObject(kpi, path)) return;
      requireString(kpi.name, `${path}.name`, true);
      ["target", "baseline", "method"].forEach(key => requireString(kpi[key], `${path}.${key}`));
      if (requireArray(kpi.refs, `${path}.refs`)) kpi.refs.forEach((ref, ri) => {
        if (!featureRefs.has(ref)) error(`${path}.refs[${ri}]`, `unknown feature ref ${ref}`);
      });
    });
  }

  const flow = sot.flow;
  const connectedPages = new Set();
  if (requireObject(flow, "$.flow")) {
    if (!pageIds.has(flow.start)) error("$.flow.start", `unknown page id ${String(flow.start)}`);
    if (requireArray(flow.transitions, "$.flow.transitions")) {
      if (!flow.transitions.length) error("$.flow.transitions", "must contain at least one transition");
      flow.transitions.forEach((transition, i) => {
        const path = `$.flow.transitions[${i}]`;
        if (!requireObject(transition, path)) return;
        const hasRef = Object.hasOwn(transition, "ref");
        const hasLabel = Object.hasOwn(transition, "label");
        const allowed = new Set(["from", "to", "ref", "label"]);
        Object.keys(transition).filter(key => !allowed.has(key)).forEach(key => error(`${path}.${key}`, "field is not allowed"));
        if (hasRef && hasLabel) error(path, "must not contain both ref and label");
        if (!pageIds.has(transition.from)) error(`${path}.from`, `unknown page id ${String(transition.from)}`);
        if (!pageIds.has(transition.to)) error(`${path}.to`, `unknown page id ${String(transition.to)}`);
        if (pageIds.has(transition.from)) connectedPages.add(transition.from);
        if (pageIds.has(transition.to)) connectedPages.add(transition.to);
        if (hasRef && !featureRefs.has(transition.ref)) error(`${path}.ref`, `unknown feature ref ${String(transition.ref)}`);
        if (hasLabel) requireString(transition.label, `${path}.label`, true);
      });
    }
  }
  for (const pageId of pageIds) if (!connectedPages.has(pageId)) warning("$.flow", `${pageId} is not connected to any transition`);

  return result();
}

function printResult(file, result) {
  console.log(`[${result.valid ? "PASS" : "FAIL"}] ${file}`);
  result.errors.forEach(item => console.error(`  error ${item.path}: ${item.message}`));
  result.warnings.forEach(item => console.warn(`  warn  ${item.path}: ${item.message}`));
}

async function main(files) {
  if (!files.length) {
    console.error("Usage: node scripts/validate-sot.mjs <file.sot.json> [...]");
    process.exitCode = 2;
    return;
  }
  let failed = false;
  for (const file of files) {
    try {
      const result = validateSot(JSON.parse(readFileSync(file, "utf8")));
      printResult(file, result);
      if (!result.valid) failed = true;
    } catch (cause) {
      failed = true;
      console.error(`[FAIL] ${file}`);
      console.error(`  error $: ${cause.message}`);
    }
  }
  if (failed) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
