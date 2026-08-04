import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { applyChangePlan } from "../../plugins/vibespec/skills/vibespec/scripts/lib/change-plan.mjs";
import { sotDigest } from "../../plugins/vibespec/skills/vibespec/scripts/lib/c14n.mjs";
import { reviewSot } from "../../plugins/vibespec/skills/vibespec/scripts/lib/content-review.mjs";
import { reviewSemantic } from "../../plugins/vibespec/skills/vibespec/scripts/lib/semantic-engine.mjs";
import { validateSot } from "../../plugins/vibespec/skills/vibespec/scripts/validate-sot.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");
const casesRoot = join(here, "cases");
const readJson = path => JSON.parse(readFileSync(path, "utf8"));
const findingKey = finding => `${finding.ruleId}|${[...(finding.subjectRefs || [])].sort().join(",")}`;
const contentFindingKey = finding => `${finding.code}|${finding.path}`;

function compareFindings(actual, expected) {
  const expectedKeys = new Set(expected.map(item => `${item.ruleId}|${[...(item.subjectRefs || [])].sort().join(",")}`));
  const actualKeys = new Set(actual.map(findingKey));
  return {
    truePositive: [...actualKeys].filter(key => expectedKeys.has(key)),
    falsePositive: [...actualKeys].filter(key => !expectedKeys.has(key)),
    falseNegative: [...expectedKeys].filter(key => !actualKeys.has(key))
  };
}

function assertStage(caseId, name, sot, expected) {
  const validation = validateSot(sot);
  if (!validation.valid) throw new Error(`${caseId} ${name} is structurally invalid: ${JSON.stringify(validation.errors)}`);
  const report = reviewSemantic(sot);
  const comparison = compareFindings(report.findings, expected.findings || []);
  if (report.assessment.status !== expected.assessment) {
    throw new Error(`${caseId} ${name} assessment: expected ${expected.assessment}, got ${report.assessment.status}`);
  }
  const actualReadiness = report.readiness.measurement ?? null;
  if (actualReadiness !== expected.measurementReadiness) {
    throw new Error(`${caseId} ${name} readiness: expected ${expected.measurementReadiness}, got ${actualReadiness}`);
  }
  if (comparison.falsePositive.length || comparison.falseNegative.length) {
    throw new Error(`${caseId} ${name} finding mismatch: ${JSON.stringify(comparison)}`);
  }
  return { report, comparison };
}

function sourceFor(manifest) {
  const sourcePath = resolve(repoRoot, manifest.source.path);
  const bytes = readFileSync(sourcePath);
  const source = JSON.parse(bytes.toString("utf8"));
  const actualSourceDigest = sotDigest(source);
  if (actualSourceDigest !== manifest.source.digest) {
    throw new Error(`${manifest.id} source drift: expected ${manifest.source.digest}, got ${actualSourceDigest}`);
  }
  if (manifest.source.fileSha256) {
    const actualFileSha256 = createHash("sha256").update(bytes).digest("hex").toUpperCase();
    if (actualFileSha256 !== manifest.source.fileSha256) {
      throw new Error(`${manifest.id} file drift: expected ${manifest.source.fileSha256}, got ${actualFileSha256}`);
    }
  }
  return source;
}

function verifyPinnedCaseFile(caseRoot, descriptor, label) {
  if (!descriptor || typeof descriptor.path !== "string" || typeof descriptor.fileSha256 !== "string") {
    throw new Error(`${label} must declare path and fileSha256`);
  }
  const path = resolve(caseRoot, descriptor.path);
  const bytes = readFileSync(path);
  const actual = createHash("sha256").update(bytes).digest("hex").toUpperCase();
  if (actual !== descriptor.fileSha256) throw new Error(`${label} drift: expected ${descriptor.fileSha256}, got ${actual}`);
  return { path, bytes };
}

const coverageFor = sot => ({
  sourceKpis: (sot.prd?.kpis || []).length,
  kpis: (sot.prd?.kpis || []).filter(kpi => kpi.measurement).length,
  measurementModes: [...new Set((sot.prd?.kpis || []).map(kpi => kpi.measurement?.mode).filter(Boolean))].sort()
});

function comparisonFor(manifest, source) {
  const fields = manifest.comparison?.kpiSignatureFields;
  if (!Array.isArray(fields) || !fields.length) return null;
  const values = (source.prd?.kpis || []).map(kpi => Object.fromEntries(fields.map(field => [field, kpi[field] ?? null])));
  const material = JSON.stringify(values);
  return {
    cohort: manifest.comparison.cohort,
    signature: createHash("sha256").update(material).digest("hex").slice(0, 12),
    fields,
    values
  };
}

function evaluateControlled(manifest, caseRoot, source) {
  const beforePlan = readJson(join(caseRoot, manifest.stages.before.plan));
  const before = applyChangePlan(source, beforePlan).after;
  const beforeResult = assertStage(manifest.id, "before", before, manifest.stages.before.expected);

  const resolvedPlan = readJson(join(caseRoot, manifest.stages.resolved.plan));
  const resolved = applyChangePlan(before, resolvedPlan).after;
  const resolvedResult = assertStage(manifest.id, "resolved", resolved, manifest.stages.resolved.expected);
  return {
    manifest,
    artifacts: { before, resolved },
    stages: { before: beforeResult, resolved: resolvedResult },
    metrics: {
      labelledFailures: beforeResult.comparison.truePositive.length,
      truePositive: beforeResult.comparison.truePositive.length + resolvedResult.comparison.truePositive.length,
      falsePositive: 0,
      falseNegative: 0,
      ...coverageFor(resolved)
    }
  };
}

function evaluateNatural(manifest, source) {
  const observed = assertStage(manifest.id, "observed", source, manifest.expected);
  const content = reviewSot(source, { profile: manifest.contentReview.profile });
  const expectedContent = new Set((manifest.contentReview.findings || []).map(contentFindingKey));
  const actualContent = new Set(content.findings.map(contentFindingKey));
  const falsePositive = [...actualContent].filter(key => !expectedContent.has(key));
  const falseNegative = [...expectedContent].filter(key => !actualContent.has(key));
  if (falsePositive.length || falseNegative.length) {
    throw new Error(`${manifest.id} content-review mismatch: ${JSON.stringify({ falsePositive, falseNegative })}`);
  }
  return {
    manifest,
    artifacts: { observed: source },
    stages: { observed: { ...observed, contentReview: content } },
    comparison: comparisonFor(manifest, source),
    metrics: {
      labelledFailures: observed.comparison.truePositive.length,
      truePositive: observed.comparison.truePositive.length,
      falsePositive: 0,
      falseNegative: 0,
      ...coverageFor(source)
    }
  };
}

function evaluateReviewerBaseline(manifest, caseRoot, source) {
  verifyPinnedCaseFile(caseRoot, manifest.brief, `${manifest.id} brief`);
  const planFile = verifyPinnedCaseFile(caseRoot, manifest.overlay?.plan, `${manifest.id} overlay plan`);
  const adjudicationFile = verifyPinnedCaseFile(caseRoot, manifest.overlay?.adjudication, `${manifest.id} adjudication`);
  const plan = JSON.parse(planFile.bytes.toString("utf8"));
  const adjudication = JSON.parse(adjudicationFile.bytes.toString("utf8"));
  if (adjudication.contractVersion !== "semantic-generation-review-0.1") {
    throw new Error(`${manifest.id} adjudication has unsupported contractVersion`);
  }
  if (adjudication.status !== "candidate-needs-human-approval") {
    throw new Error(`${manifest.id} reviewer baseline must remain a candidate until explicitly approved`);
  }
  const applied = applyChangePlan(source, plan);
  if (applied.digest.after !== manifest.overlay.resultDigest) {
    throw new Error(`${manifest.id} overlay result drift: expected ${manifest.overlay.resultDigest}, got ${applied.digest.after}`);
  }
  const candidate = assertStage(manifest.id, "candidate", applied.after, manifest.expected);
  const kpiIds = new Set((applied.after.prd?.kpis || []).map(kpi => kpi.id).filter(Boolean));
  const adjudicatedIds = new Set((adjudication.kpis || []).map(kpi => kpi.id));
  if (kpiIds.size !== adjudicatedIds.size || [...kpiIds].some(id => !adjudicatedIds.has(id))) {
    throw new Error(`${manifest.id} adjudication must cover every semantic KPI exactly once`);
  }
  for (const kpi of adjudication.kpis) {
    if (typeof kpi.inventedEvidence !== "boolean") throw new Error(`${manifest.id} ${kpi.id} must adjudicate inventedEvidence`);
    if (!Array.isArray(kpi.evidenceBasis)) throw new Error(`${manifest.id} ${kpi.id} must list evidenceBasis`);
  }
  const coverage = coverageFor(applied.after);
  return {
    manifest,
    artifacts: { candidate: applied.after },
    stages: { candidate },
    quality: {
      status: adjudication.status,
      adjudicatedKpis: adjudication.kpis.length,
      inventedEvidenceClaims: adjudication.kpis.filter(kpi => kpi.inventedEvidence).length,
      unresolvedHumanDecisions: adjudication.kpis.filter(kpi => kpi.requiredHumanDecision).length
    },
    metrics: {
      labelledFailures: 0,
      truePositive: 0,
      falsePositive: 0,
      falseNegative: 0,
      sourceKpis: 0,
      kpis: 0,
      measurementModes: [],
      candidateKpis: coverage.kpis,
      candidateMeasurementModes: coverage.measurementModes
    }
  };
}

export function evaluateCase(caseDirectory) {
  const caseRoot = join(casesRoot, caseDirectory);
  const manifest = readJson(join(caseRoot, "case.json"));
  const source = sourceFor(manifest);
  if (manifest.lane === "controlled-mutation") return evaluateControlled(manifest, caseRoot, source);
  if (["natural", "legacy-comparison"].includes(manifest.lane)) return evaluateNatural(manifest, source);
  if (manifest.lane === "reviewer-baseline-candidate") return evaluateReviewerBaseline(manifest, caseRoot, source);
  throw new Error(`${manifest.id} has unsupported lane ${manifest.lane}`);
}

function parseArgs(argv) {
  const args = { json: false, caseId: null, write: null };
  for (let index = 0; index < argv.length; index++) {
    const value = argv[index];
    if (value === "--json") args.json = true;
    else if (value === "--case") args.caseId = argv[++index];
    else if (value === "--write") args.write = argv[++index];
    else throw new Error(`unknown argument ${value}`);
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const directories = readdirSync(casesRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && (!args.caseId || entry.name === args.caseId))
    .map(entry => entry.name)
    .sort();
  if (!directories.length) throw new Error(args.caseId ? `unknown case ${args.caseId}` : "no evaluation cases found");

  const results = directories.map(evaluateCase);
  if (args.write) {
    const output = resolve(repoRoot, args.write);
    mkdirSync(output, { recursive: true });
    for (const result of results) {
      for (const [stage, artifact] of Object.entries(result.artifacts)) {
        writeFileSync(join(output, `${result.manifest.id}.${stage}.sot.json`), JSON.stringify(artifact, null, 2) + "\n");
        writeFileSync(join(output, `${result.manifest.id}.${stage}.semantic-report.json`), JSON.stringify(result.stages[stage].report, null, 2) + "\n");
      }
    }
  }

  const aggregate = {
    cases: results.length,
    assessedCases: results.filter(result => ["natural", "controlled-mutation"].includes(result.manifest.lane)).length,
    comparisonCases: results.filter(result => result.manifest.lane === "legacy-comparison").length,
    baselineCandidateCases: results.filter(result => result.manifest.lane === "reviewer-baseline-candidate").length,
    sourceKpis: 0,
    kpis: 0,
    labelledFailures: 0,
    truePositive: 0,
    falsePositive: 0,
    falseNegative: 0,
    measurementModes: [],
    candidateKpis: 0,
    candidateMeasurementModes: []
  };
  const measurementModes = new Set();
  const candidateMeasurementModes = new Set();
  for (const result of results) {
    for (const key of ["sourceKpis", "kpis", "labelledFailures", "truePositive", "falsePositive", "falseNegative"]) aggregate[key] += result.metrics[key];
    result.metrics.measurementModes.forEach(mode => measurementModes.add(mode));
    aggregate.candidateKpis += result.metrics.candidateKpis || 0;
    (result.metrics.candidateMeasurementModes || []).forEach(mode => candidateMeasurementModes.add(mode));
  }
  aggregate.measurementModes = [...measurementModes].sort();
  aggregate.candidateMeasurementModes = [...candidateMeasurementModes].sort();
  const comparisonGroups = new Map();
  for (const result of results.filter(result => result.comparison)) {
    const key = result.comparison.signature;
    if (!comparisonGroups.has(key)) comparisonGroups.set(key, { ...result.comparison, cases: [] });
    comparisonGroups.get(key).cases.push(result.manifest.id);
  }
  const duplicateKpiGroups = [...comparisonGroups.values()].filter(group => group.cases.length > 1);
  const output = {
    contractVersion: "semantic-evaluation-0.1",
    aggregate,
    duplicateKpiGroups,
    cases: results.map(result => ({
      id: result.manifest.id,
      lane: result.manifest.lane,
      sourceDigest: result.manifest.source.digest,
      quality: result.quality || null,
      stages: Object.fromEntries(Object.entries(result.stages).map(([name, stage]) => [name, stage.report]))
    }))
  };
  if (args.json) console.log(JSON.stringify(output, null, 2));
  else {
    for (const result of results) {
      const readiness = Object.entries(result.stages).map(([name, stage]) =>
        `${name}=${stage.report.readiness.measurement ?? stage.report.assessment.status}`).join(", ");
      console.log(`[evaluation] PASS ${result.manifest.id}: ${readiness}, TP=${result.metrics.truePositive}, FP=0, FN=0`);
    }
    for (const group of duplicateKpiGroups) console.log(`[comparison] duplicate KPI signature ${group.signature}: ${group.cases.join(", ")}`);
    console.log(`[evaluation] ${aggregate.assessedCases} assessed + ${aggregate.comparisonCases} legacy comparison + ${aggregate.baselineCandidateCases} reviewer baseline candidate case(s), ${aggregate.sourceKpis} observed KPI(s), ${aggregate.kpis} assessed KPI(s), modes=${aggregate.measurementModes.join(",")}, candidateKpis=${aggregate.candidateKpis}, candidateModes=${aggregate.candidateMeasurementModes.join(",")}, ${aggregate.labelledFailures} labelled failure(s), TP=${aggregate.truePositive}, FP=${aggregate.falsePositive}, FN=${aggregate.falseNegative}`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
