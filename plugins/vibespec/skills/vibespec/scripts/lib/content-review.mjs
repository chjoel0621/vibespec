// Advisory quality review, deliberately separate from structural validation.
// A valid SOT can still be too vague for a team to implement confidently.
const text = value => typeof value === "string" ? value.trim() : "";
const vague = value => /^(works?|ok|done|todo|tbd|test|동작|정상|확인|추후|미정)$/i.test(text(value));
const thin = value => text(value).length < 12;

export function reviewSot(sot) {
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
  return { valid: true, findings, summary: { warnings: findings.length } };
}
