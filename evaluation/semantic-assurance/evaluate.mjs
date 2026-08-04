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

export function evaluateCase(caseDirectory) {
  const caseRoot = join(casesRoot, caseDirectory);
  const manifest = readJson(join(caseRoot, "case.json"));
  const source = sourceFor(manifest);
  if (manifest.lane === "controlled-mutation") return evaluateControlled(manifest, caseRoot, source);
  if (["natural", "legacy-comparison"].includes(manifest.lane)) return evaluateNatural(manifest, source);
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
    assessedCases: results.filter(result => result.manifest.lane !== "legacy-comparison").length,
    comparisonCases: results.filter(result => result.manifest.lane === "legacy-comparison").length,
    sourceKpis: 0,
    kpis: 0,
    labelledFailures: 0,
    truePositive: 0,
    falsePositive: 0,
    falseNegative: 0,
    measurementModes: []
  };
  const measurementModes = new Set();
  for (const result of results) {
    for (const key of ["sourceKpis", "kpis", "labelledFailures", "truePositive", "falsePositive", "falseNegative"]) aggregate[key] += result.metrics[key];
    result.metrics.measurementModes.forEach(mode => measurementModes.add(mode));
  }
  aggregate.measurementModes = [...measurementModes].sort();
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
    console.log(`[evaluation] ${aggregate.assessedCases} assessed + ${aggregate.comparisonCases} legacy comparison case(s), ${aggregate.sourceKpis} observed KPI(s), ${aggregate.kpis} assessed KPI(s), modes=${aggregate.measurementModes.join(",")}, ${aggregate.labelledFailures} labelled failure(s), TP=${aggregate.truePositive}, FP=${aggregate.falsePositive}, FN=${aggregate.falseNegative}`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
