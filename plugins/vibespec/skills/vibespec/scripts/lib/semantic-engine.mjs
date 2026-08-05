import { createHash } from "node:crypto";
import { stableStringify, sotDigest } from "./c14n.mjs";
import { measurementEventRefs, semanticIdIndex, semanticNamespaces, semanticReferences } from "./semantic-reference-registry.mjs";

export const SEMANTIC_REPORT_VERSION = "semantic-report-0.1";
export const SEMANTIC_CONTRACT_VERSION = "semantic-0.1";
export const MEASUREMENT_RULESET_VERSION = "measurement-0.1";

const digestValue = value => "sha256:" + createHash("sha256").update(Buffer.from(stableStringify(value), "utf8")).digest("hex");
const featureEntries = sot => (sot.requirements || []).flatMap(requirement =>
  (requirement.features || []).map(feature => ({ requirement, feature })));
const pageEntries = sot => {
  const entries = [];
  const walk = pages => (pages || []).forEach(page => { entries.push(page); walk(page.children); });
  (sot.ia?.sections || []).forEach(section => walk(section.pages));
  return entries;
};
const baseFeatureRef = ref => String(ref || "").split(":")[0];
const NORMALIZED_METRIC_PATTERN = /(?:\b(?:percentage|rate|ratio)\b|%|\bper\s+(?:active\s+)?(?:user|account|household|employee|member|customer|tenant|booking|reservation)\b|\/\s*(?:user|account|household|employee|member|customer|tenant|booking|reservation)\b|[가-힣]+(?:율|률)(?=$|[\s%(),/])|(?:사용자|계정|가구|직원|회원|고객|테넌트|예약)\s*당)/i;

function reportScope(sot) {
  return sot.initiative?.id || "root";
}

function finding({ scopeRef, ruleId, severity = "blocker", assessment = "failed", summary, subjectRefs = [], evidenceRefs = [], evidence = [] }) {
  const ruleVersion = MEASUREMENT_RULESET_VERSION;
  const material = {
    ruleId,
    ruleVersion,
    scopeRef,
    subjectRefs: [...new Set(subjectRefs)].sort(),
    evidenceRefs: [...new Set(evidenceRefs)].sort(),
    evidenceDigest: digestValue(evidence),
    severity
  };
  const fingerprint = digestValue(material);
  return {
    id: "SEM-" + fingerprint.slice(7, 19).toUpperCase(),
    fingerprint,
    severity,
    assessment,
    summary,
    subjectRefs: material.subjectRefs,
    evidenceRefs: material.evidenceRefs,
    ruleId,
    ruleVersion
  };
}

export function reviewSemantic(sot) {
  const message = (ko, en) => sot.lang === "en" ? en : ko;
  const base = {
    reportVersion: SEMANTIC_REPORT_VERSION,
    semanticContractVersion: sot.semantic?.contractVersion || null,
    rulesetVersion: MEASUREMENT_RULESET_VERSION,
    sotDigest: sotDigest(sot),
    scopeRef: reportScope(sot)
  };
  if (!sot.semantic) {
    return { ...base, assessment: { status: "not-assessed" }, readiness: {}, findings: [] };
  }
  if (sot.semantic.contractVersion !== SEMANTIC_CONTRACT_VERSION) {
    throw new Error(`unsupported semantic contract ${JSON.stringify(sot.semantic.contractVersion)}`);
  }

  const findings = [];
  const scopeRef = reportScope(sot);
  const push = values => findings.push(finding({ scopeRef, ...values }));
  const features = new Map(featureEntries(sot).map(entry => [entry.feature.id, entry.feature]));
  const pages = new Map(pageEntries(sot).map(page => [page.id, page]));
  const events = new Map();
  const decisions = new Map();
  const semanticIds = new Map();

  for (const entry of semanticIdIndex(sot)) {
    if (semanticIds.has(entry.id)) {
      push({
        ruleId: "semantic-id-unique",
        summary: message(`의미 계약에서 ${entry.id} ID가 두 번 이상 사용됩니다.`, `${entry.id} is used more than once in the semantic contract.`),
        subjectRefs: [entry.id],
        evidenceRefs: [semanticIds.get(entry.id).path, entry.path],
        evidence: [semanticIds.get(entry.id).value, entry.value]
      });
    } else semanticIds.set(entry.id, entry);
    if (entry.namespace === "EVENT") events.set(entry.id, entry.value);
    if (entry.namespace === "DECISION") decisions.set(entry.id, entry.value);
  }

  for (const [index, kpi] of (sot.prd?.kpis || []).entries()) {
    const subject = kpi?.id || `prd.kpis[${index}]`;
    if (!semanticNamespaces.KPI.pattern.test(kpi?.id || "")) {
      push({
        ruleId: "kpi-stable-id-required",
        summary: message(`${kpi?.name || subject}에 의미 검토용 안정 K# ID가 필요합니다.`, `${kpi?.name || subject} needs a stable K# id before semantic assessment.`),
        subjectRefs: [subject],
        evidenceRefs: [`$.prd.kpis[${index}]`],
        evidence: [kpi]
      });
    }
    if (!kpi?.measurement) {
      push({
        ruleId: "kpi-measurement-required",
        summary: message(`${kpi?.id || kpi?.name || subject}에 구조화된 측정 정의가 없습니다.`, `${kpi?.id || kpi?.name || subject} has no structured measurement definition.`),
        subjectRefs: [subject],
        evidenceRefs: [`$.prd.kpis[${index}]`],
        evidence: [kpi]
      });
      continue;
    }
    if (kpi.measurement.mode === "event-count"
      && NORMALIZED_METRIC_PATTERN.test([kpi.name, kpi.target, kpi.method].filter(Boolean).join(" "))) {
      push({
        ruleId: "normalized-metric-denominator-required",
        summary: message(`${subject}은 개체당 비율 지표지만 event-count에는 분모가 없습니다. event-ratio나 외부 집계 정의를 사용하세요.`, `${subject} is normalized per entity, but event-count declares no denominator. Use event-ratio or an external aggregate.`),
        subjectRefs: [subject],
        evidenceRefs: measurementEventRefs(kpi),
        evidence: [kpi]
      });
    }
    if (kpi.measurement.mode === "event-ratio"
      && kpi.measurement.numerator?.populationEventRef !== kpi.measurement.denominator?.populationEventRef) {
      push({
        ruleId: "ratio-population-consistent",
        summary: message(`${subject}의 분자와 분모가 서로 다른 모집단 이벤트를 사용합니다.`, `${subject} uses different population events for its numerator and denominator.`),
        subjectRefs: [subject],
        evidenceRefs: measurementEventRefs(kpi),
        evidence: [kpi.measurement]
      });
    }
  }

  const knownDynamic = new Set([
    ...semanticIds.keys(),
    ...(sot.requirements || []).map(requirement => requirement.id),
    ...features.keys(),
    ...(sot.requirements || []).flatMap(requirement => (requirement.features || []).flatMap(feature =>
      (feature.specs || []).map((_, index) => `${feature.id}:${index}`))),
    ...(sot.ia?.sections || []).map(section => section.id),
    ...pages.keys()
  ]);
  for (const reference of semanticReferences(sot)) {
    let exists = true;
    if (reference.target === "EVENT") exists = events.has(reference.ref);
    else if (reference.target === "FEATURE") exists = features.has(baseFeatureRef(reference.ref));
    else if (reference.target === "PAGE") exists = pages.has(reference.ref);
    else if (reference.target === "DYNAMIC") exists = knownDynamic.has(reference.ref);
    if (!exists) {
      push({
        ruleId: "semantic-reference-exists",
        summary: message(`${reference.path}에서 참조한 ${reference.ref}이 존재하지 않습니다.`, `${reference.ref} referenced at ${reference.path} does not exist.`),
        subjectRefs: [reference.ref],
        evidenceRefs: [reference.path],
        evidence: [reference]
      });
    }
  }

  const measuredEventIds = new Set((sot.prd?.kpis || []).flatMap(measurementEventRefs));
  for (const eventId of measuredEventIds) {
    const event = events.get(eventId);
    if (!event) continue;
    if (!(event.producers || []).length) {
      push({
        ruleId: "measurement-event-producer-required",
        summary: message(`${eventId}(${event.name})에 선언된 이벤트 생산 근거가 없습니다.`, `${eventId} (${event.name}) has no declared production evidence.`),
        subjectRefs: [eventId],
        evidenceRefs: [eventId],
        evidence: [event]
      });
      continue;
    }
    const producerTypes = new Set(event.producers.map(producer => producer.type));
    const compatible = event.type === "user" ? producerTypes.has("feature")
      : event.type === "system" ? producerTypes.has("feature") || producerTypes.has("system-task")
        : event.type === "external" ? producerTypes.has("external-dependency")
          : event.type === "manual" ? producerTypes.has("manual-process") || producerTypes.has("feature")
            : false;
    if (!compatible) {
      push({
        ruleId: "event-producer-type-compatible",
        summary: message(`${eventId}(${event.type})에 이벤트 유형과 맞는 생산자가 없습니다.`, `${eventId} (${event.type}) has no producer appropriate for its event type.`),
        subjectRefs: [eventId],
        evidenceRefs: event.producers.map(producer => producer.ref).filter(Boolean),
        evidence: [event]
      });
    }
    if (event.type === "user") {
      const featureRefs = event.producers.filter(producer => producer.type === "feature").map(producer => producer.ref);
      const hasSurface = (event.surfaceRefs || []).some(ref => pages.has(ref)) || featureRefs.some(ref =>
        [...pages.values()].some(page => (page.refs || []).some(pageRef => baseFeatureRef(pageRef) === baseFeatureRef(ref))));
      const hasFlow = featureRefs.some(ref => (sot.flow?.transitions || []).some(transition =>
        transition.ref && baseFeatureRef(transition.ref) === baseFeatureRef(ref)));
      if (!hasSurface && !hasFlow) {
        push({
          ruleId: "user-event-interaction-evidence-required",
          summary: message(`${eventId}은 사용자 이벤트지만 생산 기능에 IA 또는 flow 근거가 없습니다.`, `${eventId} is a user event but its producing feature has no IA or flow evidence.`),
          subjectRefs: [eventId, ...featureRefs],
          evidenceRefs: featureRefs,
          evidence: [event]
        });
      }
    }
  }

  for (const decision of decisions.values()) {
    if (decision.status === "decided" && !(typeof decision.resolution === "string" && decision.resolution.trim())) {
      push({
        ruleId: "decision-resolution-required",
        summary: message(`${decision.id}은 결정 완료 상태지만 확정 내용이 없습니다.`, `${decision.id} is marked decided but has no resolution.`),
        subjectRefs: [decision.id],
        evidenceRefs: [decision.id],
        evidence: [decision]
      });
      continue;
    }
    if (decision.status !== "open") continue;
    for (const impact of decision.impacts || []) {
      if (impact.effect !== "blocks-measurement") continue;
      push({
        ruleId: "open-decision-blocks-measurement",
        summary: message(`${decision.id} 결정이 열려 있어 ${impact.refs.join(", ")} 측정을 차단합니다.`, `${decision.id} remains open and blocks measurement for ${impact.refs.join(", ")}.`),
        subjectRefs: [decision.id, ...impact.refs],
        evidenceRefs: impact.refs,
        evidence: [decision]
      });
    }
  }

  const hasFailed = findings.some(item => item.assessment === "failed");
  const hasBlocker = findings.some(item => item.assessment === "failed" && item.severity === "blocker");
  const hasUnknown = findings.some(item => item.assessment === "unknown");
  return {
    ...base,
    assessment: { status: hasFailed ? "failed" : hasUnknown ? "unknown" : "passed" },
    readiness: { measurement: hasBlocker ? "blocked" : findings.length ? "at-risk" : "ready" },
    findings
  };
}
