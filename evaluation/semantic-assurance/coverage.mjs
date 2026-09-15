const modes = ["event-count", "event-ratio", "survey", "manual", "external"];
const lanes = ["natural", "controlled-mutation", "legacy-comparison", "reviewer-baseline-candidate"];

// Artifact coverage only. Approval receipts and human calibration are a
// separate gate; neither legacy documents nor baseline candidates count here.
export function distinctCoverage(results) {
  const concepts = new Set(), kpis = new Map();
  for (const { manifest, artifacts } of results) {
    if (typeof manifest.conceptId !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(manifest.conceptId)) throw new Error(`${manifest.id}: missing or invalid conceptId`);
    if (!lanes.includes(manifest.lane)) throw new Error(`unsupported lane ${manifest.lane}`);
    if (!["natural", "controlled-mutation"].includes(manifest.lane)) continue;
    const sot = artifacts[manifest.lane === "natural" ? "observed" : "resolved"];
    if (!sot) throw new Error(`${manifest.id}: missing assessed artifact`);
    const localIds = new Set();
    for (const kpi of sot.prd?.kpis || []) {
      if (!kpi.measurement) continue;
      if (typeof kpi.id !== "string" || !/^K[1-9]\d*$/.test(kpi.id)) throw new Error(`${manifest.id}: missing or invalid KPI id`);
      if (localIds.has(kpi.id)) throw new Error(`${manifest.id}: duplicate KPI ${kpi.id}`);
      localIds.add(kpi.id);
      const mode = kpi.measurement.mode;
      if (!modes.includes(mode)) throw new Error(`unsupported measurement mode ${mode}`);
      const key = `${manifest.conceptId}/${kpi.id}`;
      if (kpis.has(key) && kpis.get(key) !== mode) throw new Error(`conflicting measurement mode for ${key}`);
      kpis.set(key, mode);
      concepts.add(manifest.conceptId);
    }
  }
  const measured = [...new Set(kpis.values())].sort();
  const remaining = { concepts: Math.max(0, 8 - concepts.size), kpis: Math.max(0, 30 - kpis.size), measurementModes: modes.filter(mode => !measured.includes(mode)) };
  return {
    scope: "assessed-artifact-coverage-only", uniqueConcepts: concepts.size, uniqueAssessedKpis: kpis.size,
    measurementModes: measured, targets: { concepts: 8, kpis: 30, measurementModes: modes }, remaining,
    coverageThresholdsMet: remaining.concepts === 0 && remaining.kpis === 0 && remaining.measurementModes.length === 0,
    calibrationApproval: "not-assessed",
    limitation: "Stable KPI IDs must denote the same KPI concept across locale/run variants. These counts do not verify human adjudication or approval receipts."
  };
}
