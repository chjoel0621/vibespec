// Advisory quality review, deliberately separate from structural validation.
// A valid SOT can still be too vague for a team to implement confidently.
const text = value => typeof value === "string" ? value.trim() : "";
const vague = value => /^(works?|ok|done|todo|tbd|test|동작|정상|확인|추후|미정)$/i.test(text(value));
const thin = value => text(value).length < 12;
export const generationProfiles = ["operations", "consumer", "marketplace"];

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
  const walkPages = (pages, fn) => (pages || []).forEach(page => { fn(page); walkPages(page.children, fn); });
  const pageRefs = new Map();
  (sot.ia?.sections || []).forEach(section => walkPages(section.pages, page => {
    (page.refs || []).forEach(ref => {
      const id = ref.split(":")[0];
      if (!pageRefs.has(id)) pageRefs.set(id, []);
      pageRefs.get(id).push(page.id);
    });
  }));
  for (const requirement of sot.requirements || []) {
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
  if (profile === "marketplace" && (prd.targets || []).length < 2) {
    warn("marketplace-needs-multiple-user-groups", "$.prd.targets", "marketplace plans should name at least two participant groups");
  }
  return { valid: true, findings, summary: { warnings: findings.length } };
}
