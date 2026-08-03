// Advisory quality review, deliberately separate from structural validation.
// A valid SOT can still be too vague for a team to implement confidently.
const text = value => typeof value === "string" ? value.trim() : "";
const vague = value => /^(works?|ok|done|todo|tbd|test|동작|정상|확인|추후|미정)$/i.test(text(value));
const thin = value => text(value).length < 12;
export const generationProfiles = ["operations", "consumer", "marketplace"];

const normalizedTitle = value => text(value).toLocaleLowerCase().replace(/[\s·/\\,_()\[\]-]+/g, "");
const similarTitle = (left, right) => {
  const a = normalizedTitle(left);
  const b = normalizedTitle(right);
  return a && b && (a === b || a.includes(b) || b.includes(a));
};

const textEntries = (value, path = "$") => {
  if (typeof value === "string") return [{ path, value }];
  if (Array.isArray(value)) return value.flatMap((item, index) => textEntries(item, path + "[" + index + "]"));
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, item]) => textEntries(item, path + "." + key));
  }
  return [];
};

const consumerOperationLanguage = [
  /\boperations dashboard\b/i,
  /\bowner, priority, and sla management\b/i,
  /\bapproval and policy review\b/i,
  /\bexception and audit handling\b/i,
  /\bsystem and policy administrator\b/i,
  /\boperations and security administrator\b/i,
  /운영 대시보드/,
  /담당자·우선순위·SLA 관리/,
  /승인·정책 검토/,
  /예외·감사 처리/,
  /시스템·정책 관리자/,
  /운영·보안 관리자/
];

export function reviewSot(sot, { profile = "operations" } = {}) {
  if (!generationProfiles.includes(profile)) throw new Error("unsupported generation profile: " + profile);
  const findings = [];
  const warn = (code, path, message) => findings.push({ severity: "warning", code, path, message });
  const prd = sot.prd || {};
  for (const field of ["problem", "solution"]) {
    if (thin(prd[field])) warn("thin-prd", "$.prd." + field, field + " needs a concrete user/problem statement");
  }
  if (!Array.isArray(prd.inScope) || !prd.inScope.length) warn("empty-scope", "$.prd.inScope", "inScope should name the intended delivery boundary");
  if (!Array.isArray(prd.nonGoals) || !prd.nonGoals.length) warn("empty-non-goals", "$.prd.nonGoals", "nonGoals should state what this change will not do");

  const flowRefs = new Set((sot.flow?.transitions || []).map(item => item.ref && item.ref.split(":")[0]).filter(Boolean));
  const walkPages = (pages, fn, depth = 1) => (pages || []).forEach(page => { fn(page, depth); walkPages(page.children, fn, depth + 1); });
  const pageRefs = new Map();
  const sectionFeatureRefs = new Map();
  const pageStats = [];
  let pageCount = 0;
  let nestedPageCount = 0;
  let maxDepth = 0;
  (sot.ia?.sections || []).forEach(section => walkPages(section.pages, (page, depth) => {
    pageCount += 1;
    maxDepth = Math.max(maxDepth, depth);
    if ((page.children || []).length) nestedPageCount += page.children.length;
    pageStats.push({ page, depth });
    (page.refs || []).forEach(ref => {
      const id = ref.split(":")[0];
      if (!pageRefs.has(id)) pageRefs.set(id, []);
      pageRefs.get(id).push(page.id);
      if (!sectionFeatureRefs.has(section.id)) sectionFeatureRefs.set(section.id, new Set());
      sectionFeatureRefs.get(section.id).add(id);
    });
  }));
  const requirements = sot.requirements || [];
  const sections = sot.ia?.sections || [];
  const featureOwner = new Map();
  requirements.forEach(requirement => (requirement.features || []).forEach(feature => featureOwner.set(feature.id, requirement.id)));
  const featureCount = featureOwner.size;
  if (featureCount >= 8 && pageCount >= 6 && nestedPageCount === 0) {
    warn("flat-ia-for-complex-product", "$.ia.sections", "complex plans should express meaningful navigation or task hierarchy; every IA page is currently top-level");
  }
  if (featureCount >= 8 && pageCount <= featureCount && maxDepth <= 2) {
    warn("shallow-ia-for-complex-product", "$.ia.sections", "the IA is shallow and compressed relative to product complexity; derive task steps and screen surfaces before assigning feature refs");
  }
  const ceremonialSections = sections.filter(section => {
    if ((section.pages || []).length !== 1) return false;
    const root = section.pages[0];
    const children = root.children || [];
    return children.length <= 2 && children.every(child => !(child.children || []).length);
  });
  if (sections.length >= 3 && ceremonialSections.length >= Math.ceil(sections.length * 0.75)) {
    warn("ceremonial-ia-hierarchy", "$.ia.sections", "most sections use the same shallow root-to-one-child shape; the hierarchy may be structural decoration rather than a task-derived IA");
  }
  for (const { page, depth } of pageStats) {
    if (depth > 1 && page.type === "top") {
      warn("nested-top-ia-page", `$.ia.pages[${page.id}].type`, `page ${page.id} is nested but still marked top; use page or action for a child node`);
    }
    const featureBases = new Set((page.refs || []).map(ref => ref.split(":")[0]).filter(id => featureOwner.has(id)));
    if (featureBases.size >= 3) {
      warn("catch-all-ia-page", `$.ia.pages[${page.id}]`, `page ${page.id} combines ${featureBases.size} independent feature groups; split task surfaces or document why this is a dashboard/summary`);
    }
  }
  if (requirements.length >= 3 && requirements.length === sections.length) {
    const similarCount = requirements.filter((requirement, index) => similarTitle(requirement.title, sections[index]?.title)).length;
    const alignedOwners = sections.map(section => {
      const owners = new Set([...(sectionFeatureRefs.get(section.id) || [])].map(id => featureOwner.get(id)).filter(Boolean));
      return owners.size === 1 ? [...owners][0] : null;
    });
    const oneToOneOwners = alignedOwners.every(Boolean) && new Set(alignedOwners).size === requirements.length;
    if (similarCount >= Math.ceil(requirements.length * 0.6) || oneToOneOwners) {
      warn("requirement-shaped-ia", "$.ia.sections", "IA appears to mirror requirements one-for-one; design sections and page hierarchy from user navigation and task flow instead");
    }
  }
  for (const requirement of requirements) {
    for (const feature of requirement.features || []) {
      const base = "$.requirements[" + requirement.id + "].features[" + feature.id + "]";
      if (thin(feature.desc)) warn("thin-feature-description", base + ".desc", "feature needs an implementation-relevant description");
      if (!Array.isArray(feature.acceptance) || !feature.acceptance.length) warn("missing-acceptance", base + ".acceptance", "feature has no acceptance criteria");
      (feature.acceptance || []).forEach((item, index) => {
        if (vague(item?.text)) warn("vague-acceptance", base + ".acceptance[" + index + "]", "acceptance criterion is too vague to verify");
      });
      if ((pageRefs.get(feature.id) || []).length && !flowRefs.has(feature.id)) {
        warn("feature-without-flow-trigger", base, "feature appears in IA but no user-flow transition names it as a trigger");
      }
    }
  }
  if (profile === "consumer") {
    for (const entry of textEntries(sot)) {
      if (consumerOperationLanguage.some(pattern => pattern.test(entry.value))) {
        warn("consumer-operations-language", entry.path, "consumer plans should not default to internal operations, approval, SLA, or audit language");
      }
    }
  }
  if (profile === "marketplace" && !sot.initiative && (prd.targets || []).length < 2) {
    warn("marketplace-needs-multiple-user-groups", "$.prd.targets", "marketplace plans should name at least two participant groups");
  }
  return { valid: true, findings, summary: { warnings: findings.length } };
}
