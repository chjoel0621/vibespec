// Central registry for Semantic Assurance ids and references. Every consumer
// (validation, query, diff, merge) must use this module instead of rediscovering
// semantic paths independently.

export const semanticNamespaces = Object.freeze({
  KPI: { prefix: "K", pattern: /^K[1-9]\d*$/ },
  EVENT: { prefix: "E", pattern: /^E[1-9]\d*$/ },
  DECISION: { prefix: "D", pattern: /^D[1-9]\d*$/ }
});

const add = (items, path, ref, target) => {
  if (typeof ref === "string" && ref) items.push({ path, ref, target });
};

export const semanticReferenceFields = Object.freeze([
  { source: "prd.kpis[].measurement.eventRef", target: "EVENT", collect: (sot, out) =>
    (sot.prd?.kpis || []).forEach((kpi, i) => add(out, `$.prd.kpis[${i}].measurement.eventRef`, kpi.measurement?.eventRef, "EVENT")) },
  { source: "prd.kpis[].measurement.numerator.populationEventRef", target: "EVENT", collect: (sot, out) =>
    (sot.prd?.kpis || []).forEach((kpi, i) => add(out, `$.prd.kpis[${i}].measurement.numerator.populationEventRef`, kpi.measurement?.numerator?.populationEventRef, "EVENT")) },
  { source: "prd.kpis[].measurement.numerator.eventRef", target: "EVENT", collect: (sot, out) =>
    (sot.prd?.kpis || []).forEach((kpi, i) => add(out, `$.prd.kpis[${i}].measurement.numerator.eventRef`, kpi.measurement?.numerator?.eventRef, "EVENT")) },
  { source: "prd.kpis[].measurement.numerator.absenceOfEventRef", target: "EVENT", collect: (sot, out) =>
    (sot.prd?.kpis || []).forEach((kpi, i) => add(out, `$.prd.kpis[${i}].measurement.numerator.absenceOfEventRef`, kpi.measurement?.numerator?.absenceOfEventRef, "EVENT")) },
  { source: "prd.kpis[].measurement.denominator.populationEventRef", target: "EVENT", collect: (sot, out) =>
    (sot.prd?.kpis || []).forEach((kpi, i) => add(out, `$.prd.kpis[${i}].measurement.denominator.populationEventRef`, kpi.measurement?.denominator?.populationEventRef, "EVENT")) },
  { source: "prd.kpis[].measurement.exclusionEventRefs[]", target: "EVENT", collect: (sot, out) =>
    (sot.prd?.kpis || []).forEach((kpi, i) => (kpi.measurement?.exclusionEventRefs || []).forEach((ref, ri) => add(out, `$.prd.kpis[${i}].measurement.exclusionEventRefs[${ri}]`, ref, "EVENT"))) },
  { source: "semantic.events[].producers[type=feature].ref", target: "FEATURE", collect: (sot, out) =>
    (sot.semantic?.events || []).forEach((event, i) => (event.producers || []).forEach((producer, pi) => {
      if (producer.type === "feature") add(out, `$.semantic.events[${i}].producers[${pi}].ref`, producer.ref, "FEATURE");
    })) },
  { source: "semantic.events[].surfaceRefs[]", target: "PAGE", collect: (sot, out) =>
    (sot.semantic?.events || []).forEach((event, i) => (event.surfaceRefs || []).forEach((ref, ri) => add(out, `$.semantic.events[${i}].surfaceRefs[${ri}]`, ref, "PAGE"))) },
  { source: "semantic.decisions[].impacts[].refs[]", target: "DYNAMIC", collect: (sot, out) =>
    (sot.semantic?.decisions || []).forEach((decision, i) => (decision.impacts || []).forEach((impact, ii) => (impact.refs || []).forEach((ref, ri) =>
      add(out, `$.semantic.decisions[${i}].impacts[${ii}].refs[${ri}]`, ref, "DYNAMIC")))) }
]);

export function semanticIdIndex(sot) {
  const entries = [];
  for (const [index, kpi] of (sot.prd?.kpis || []).entries()) {
    if (kpi?.id) entries.push({ id: kpi.id, namespace: "KPI", path: `$.prd.kpis[${index}].id`, value: kpi });
  }
  for (const [index, event] of (sot.semantic?.events || []).entries()) {
    if (event?.id) entries.push({ id: event.id, namespace: "EVENT", path: `$.semantic.events[${index}].id`, value: event });
  }
  for (const [index, decision] of (sot.semantic?.decisions || []).entries()) {
    if (decision?.id) entries.push({ id: decision.id, namespace: "DECISION", path: `$.semantic.decisions[${index}].id`, value: decision });
  }
  return entries;
}

export function semanticReferences(sot) {
  const refs = [];
  semanticReferenceFields.forEach(field => field.collect(sot, refs));
  return refs;
}

export function measurementEventRefs(kpi) {
  const measurement = kpi?.measurement;
  if (!measurement || !measurement.mode?.startsWith("event-")) return [];
  const refs = [];
  const take = value => { if (typeof value === "string" && !refs.includes(value)) refs.push(value); };
  take(measurement.eventRef);
  take(measurement.numerator?.populationEventRef);
  take(measurement.numerator?.eventRef);
  take(measurement.numerator?.absenceOfEventRef);
  take(measurement.denominator?.populationEventRef);
  (measurement.exclusionEventRefs || []).forEach(take);
  return refs;
}

export function semanticGraphClosure(sot, seeds = []) {
  const selected = new Set(seeds);
  const kpis = (sot.prd?.kpis || []).filter(item => item?.id);
  const events = sot.semantic?.events || [];
  const decisions = sot.semantic?.decisions || [];
  let changed = true;
  const add = ref => {
    if (typeof ref !== "string" || !ref || selected.has(ref)) return false;
    selected.add(ref);
    return true;
  };
  while (changed) {
    changed = false;
    for (const kpi of kpis) {
      const featureRefs = kpi.refs || [];
      const eventRefs = measurementEventRefs(kpi);
      if (selected.has(kpi.id) || featureRefs.some(ref => selected.has(ref) || selected.has(ref.split(":")[0])) || eventRefs.some(ref => selected.has(ref))) {
        changed = add(kpi.id) || changed;
        featureRefs.forEach(ref => { changed = add(ref) || changed; });
        eventRefs.forEach(ref => { changed = add(ref) || changed; });
      }
    }
    for (const event of events) {
      const featureRefs = (event.producers || []).filter(item => item.type === "feature").map(item => item.ref);
      const surfaceRefs = event.surfaceRefs || [];
      if (selected.has(event.id) || featureRefs.some(ref => selected.has(ref) || selected.has(ref.split(":")[0])) || surfaceRefs.some(ref => selected.has(ref))) {
        changed = add(event.id) || changed;
        featureRefs.forEach(ref => { changed = add(ref) || changed; });
        surfaceRefs.forEach(ref => { changed = add(ref) || changed; });
      }
    }
    for (const decision of decisions) {
      const refs = (decision.impacts || []).flatMap(impact => impact.refs || []);
      if (selected.has(decision.id) || refs.some(ref => selected.has(ref))) {
        changed = add(decision.id) || changed;
        refs.forEach(ref => { changed = add(ref) || changed; });
      }
    }
  }
  const match = pattern => [...selected].filter(id => pattern.test(id));
  return {
    ids: selected,
    requirementIds: match(/^R[1-9]\d*$/),
    featureRefs: match(/^F[1-9]\d*(?::\d+)?$/),
    sectionIds: match(/^S[1-9]\d*$/),
    pageIds: match(/^P[1-9]\d*$/),
    kpiIds: match(/^K[1-9]\d*$/),
    eventIds: match(/^E[1-9]\d*$/),
    decisionIds: match(/^D[1-9]\d*$/)
  };
}

export function remapSemanticContent(sot, maps = {}) {
  const clone = value => JSON.parse(JSON.stringify(value));
  const mapWith = (map, value) => map?.[value] || value;
  const mapFeature = ref => {
    const [feature, index] = String(ref).split(":");
    const mapped = mapWith(maps.features, feature);
    return index === undefined ? mapped : `${mapped}:${index}`;
  };
  const mapEntity = ref => {
    if (/^F[1-9]\d*(?::\d+)?$/.test(ref)) return mapFeature(ref);
    if (/^R/.test(ref)) return mapWith(maps.requirements, ref);
    if (/^S/.test(ref)) return mapWith(maps.sections, ref);
    if (/^P/.test(ref)) return mapWith(maps.pages, ref);
    if (/^K/.test(ref)) return mapWith(maps.kpis, ref);
    if (/^E/.test(ref)) return mapWith(maps.events, ref);
    if (/^D/.test(ref)) return mapWith(maps.decisions, ref);
    return ref;
  };
  const mapMeasurement = measurement => {
    if (!measurement) return measurement;
    const next = clone(measurement);
    if (next.eventRef) next.eventRef = mapWith(maps.events, next.eventRef);
    if (next.numerator?.populationEventRef) next.numerator.populationEventRef = mapWith(maps.events, next.numerator.populationEventRef);
    if (next.numerator?.eventRef) next.numerator.eventRef = mapWith(maps.events, next.numerator.eventRef);
    if (next.numerator?.absenceOfEventRef) next.numerator.absenceOfEventRef = mapWith(maps.events, next.numerator.absenceOfEventRef);
    if (next.denominator?.populationEventRef) next.denominator.populationEventRef = mapWith(maps.events, next.denominator.populationEventRef);
    if (next.exclusionEventRefs) next.exclusionEventRefs = next.exclusionEventRefs.map(ref => mapWith(maps.events, ref));
    return next;
  };
  const kpis = (sot.prd?.kpis || []).map(kpi => ({
    ...clone(kpi),
    ...(kpi.id ? { id: mapWith(maps.kpis, kpi.id) } : {}),
    refs: (kpi.refs || []).map(mapFeature),
    ...(kpi.measurement ? { measurement: mapMeasurement(kpi.measurement) } : {})
  }));
  if (!sot.semantic) return { kpis, semantic: null };
  return {
    kpis,
    semantic: {
      contractVersion: sot.semantic.contractVersion,
      events: (sot.semantic.events || []).map(event => ({
        ...clone(event),
        id: mapWith(maps.events, event.id),
        producers: (event.producers || []).map(producer => producer.type === "feature" ? { ...clone(producer), ref: mapFeature(producer.ref) } : clone(producer)),
        ...(event.surfaceRefs ? { surfaceRefs: event.surfaceRefs.map(ref => mapWith(maps.pages, ref)) } : {})
      })),
      decisions: (sot.semantic.decisions || []).map(decision => ({
        ...clone(decision),
        id: mapWith(maps.decisions, decision.id),
        impacts: (decision.impacts || []).map(impact => ({ ...clone(impact), refs: (impact.refs || []).map(mapEntity) }))
      }))
    }
  };
}
