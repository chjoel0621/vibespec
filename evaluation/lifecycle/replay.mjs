import assert from "node:assert/strict";
import { inputsFor } from "./cases.mjs";
import { sotDigest } from "../../plugins/vibespec/skills/vibespec/scripts/lib/c14n.mjs";
import { applyChangePlan } from "../../plugins/vibespec/skills/vibespec/scripts/lib/change-plan.mjs";
import { diffReport } from "../../plugins/vibespec/skills/vibespec/scripts/lib/diff.mjs";
import { planRebase, applyRebase } from "../../plugins/vibespec/skills/vibespec/scripts/lib/rebase.mjs";
import { planMerge } from "../../plugins/vibespec/skills/vibespec/scripts/lib/merge.mjs";
import { reviewSot } from "../../plugins/vibespec/skills/vibespec/scripts/lib/content-review.mjs";
import { reviewSemantic } from "../../plugins/vibespec/skills/vibespec/scripts/lib/semantic-engine.mjs";
import { validateSot } from "../../plugins/vibespec/skills/vibespec/scripts/validate-sot.mjs";
import { validateTree } from "../../plugins/vibespec/skills/vibespec/scripts/lib/tree.mjs";

const clone = value => structuredClone(value);
const feature = (sot, id) => sot.requirements.flatMap(r => r.features).find(f => f.id === id);
const docsFor = state => [{ name: "main.sot.json", sot: state.source }, { name: "batch.sot.json", sot: state.initiative }];

// This runner characterizes known limitations; PASS means reproducible, not safe
// planning. Expected paths/observations are explicit and never derived from diff.
export function replayCase(c) {
  const initial = inputsFor(c);
  assert.equal(sotDigest(initial.source), c.sourceDigest, `${c.conceptId} source drift`);
  assert.equal(sotDigest(initial.initiative), c.initiativeDigest, `${c.conceptId} initiative drift`);
  const { sourceDigest, initiativeDigest, definitionDigest, ...definition } = c;
  assert.equal(sotDigest(definition), definitionDigest, `${c.conceptId} case definition drift`);
  let state = clone(initial);
  const stages = [];
  const validState = () => {
    for (const sot of [state.source, state.initiative]) {
      const checked = validateSot(sot);
      assert.equal(checked.valid, true, JSON.stringify(checked.errors));
    }
  };
  validState();
  const record = (id, before, input, expected, observations) => {
    validState();
    observations.unrelatedRequirementPreserved = sotDigest(state.source.requirements.find(r => r.id === "R2")) === sotDigest(initial.source.requirements[1]);
    observations.unrelatedProfilePreserved = sotDigest(state.source.ia.sections[0].pages.find(p => p.id === "P3")) === sotDigest(initial.source.ia.sections[0].pages[1]);
    assert.equal(observations.unrelatedRequirementPreserved, true);
    assert.equal(observations.unrelatedProfilePreserved, true);
    for (const [key, value] of Object.entries(expected)) assert.deepEqual(observations[key], value, `${c.conceptId}/${id}/${key}`);
    stages.push({ id, beforeDigest: sotDigest(before), afterDigest: sotDigest(state), input, expected, observations,
      diff: diffReport(before.source, state.source), contentReview: reviewSot(state.source, { purpose: "current-state" }),
      measurement: reviewSemantic(state.source), snapshot: clone(state) });
  };
  const edit = (operations, expected) => {
    const plan = { kind: "vibespec-change-plan-v2", baseDigest: sotDigest(state.source), operations, expected };
    state.source = applyChangePlan(state.source, plan).after;
    return plan;
  };
  const monitor = { id: "F3", title: "Legacy status list", desc: c.monitoring, status: "todo", priority: "mid", acceptance: [{ text: "Opening status does not execute the primary action.", done: false }], specs: [] };
  const monitorPage = { id: "P4", title: "Status list", type: "page", surface: "screen", refs: ["F3"], children: [] };
  const monitorTransition = { from: "P1", to: "P4", ref: "F3" };
  const addOperations = [
    { op: "addFeature", requirementId: "R1", feature: monitor },
    { op: "addPage", sectionId: "S1", parentId: "P1", page: monitorPage },
    { op: "addTransition", transition: monitorTransition }
  ];
  const addExpected = { touchedIds: ["F3", "P1", "P4"], addedIds: ["F3", "P4"], removedIds: [], touchedPaths: ["F3", "P4", "flow.P1→P4[ref:F3]"] };
  let before = clone(state);
  let plan = edit(addOperations, addExpected);
  record("add", before, plan, { addedFeaturePresent: true }, { addedFeaturePresent: Boolean(feature(state.source, "F3")) });

  before = clone(state);
  plan = edit([
    { op: "updatePrdItem", field: "constraints", match: c.beforePolicy, changes: { value: c.afterPolicy } },
    { op: "updateFeature", id: "F1", changes: { desc: c.afterPolicy } },
    { op: "updateSpec", featureId: "F1", index: 0, before: clone(feature(state.source, "F1").specs[0]), changes: { desc: c.afterPolicy } }
  ], { touchedIds: ["F1"], addedIds: [], removedIds: [], touchedPaths: ["prd.constraints", "F1.desc", "F1:0.desc"] });
  record("policy-change", before, plan, { parentChanged: true, initiativeStillUsesOldPolicy: true }, {
    parentChanged: state.initiative.initiative.parent.digest !== sotDigest(state.source),
    initiativeStillUsesOldPolicy: feature(state.initiative, "F1").desc === c.beforePolicy
  });

  before = clone(state);
  const rebasePlan = planRebase(docsFor(state));
  const writes = applyRebase(docsFor(state), rebasePlan.plan, ["batch"]);
  assert.equal(writes.length, 1);
  state.initiative = JSON.parse(writes[0].content);
  const review = reviewSot(state.initiative, { purpose: "change" });
  record("rebase", before, { plan: rebasePlan, selectedIds: ["batch"] }, {
    parentReferenceFresh: true, oldPolicyRetained: true, policyConflictDetectedByRuntime: false, treeValid: true
  }, {
    parentReferenceFresh: state.initiative.initiative.parent.digest === sotDigest(state.source),
    oldPolicyRetained: feature(state.initiative, "F1").desc === c.beforePolicy,
    policyConflictDetectedByRuntime: review.findings.some(f => /policy-conflict/.test(f.code)),
    runtimeContentFindings: review.findings,
    treeValid: validateTree(docsFor(state)).valid
  });

  before = clone(state);
  const merged = planMerge(docsFor(state), "batch");
  assert.equal(merged.ok, true, JSON.stringify(merged));
  state = { source: merged.main, initiative: merged.landed };
  record("merge", before, { operation: "planMerge", initiativeId: "batch", report: merged.report }, {
    landed: true, residualPolicyNotIntegrated: true, mainKpiCount: 1, oldPolicyInMergedFeature: true
  }, {
    landed: state.initiative.initiative.status === "landed",
    manualPrdReview: Object.keys(merged.report.manualPrdReview),
    residualPolicyNotIntegrated: !state.source.prd.constraints.includes(c.mergePolicy),
    mainKpiCount: state.source.prd.kpis.length,
    oldPolicyInMergedFeature: feature(state.source, "F4")?.desc === c.beforePolicy
  });

  before = clone(state);
  plan = edit([
    { op: "removeTransition", transition: monitorTransition },
    { op: "removePage", id: "P4" },
    { op: "removeFeature", id: "F3" }
  ], { touchedIds: ["F3", "P1", "P4"], addedIds: [], removedIds: ["F3", "P4"], touchedPaths: ["F3", "P4", "flow.P1→P4[ref:F3]"] });
  record("retire", before, { plan, reason: c.retiredReason }, { featureRemoved: true }, { featureRemoved: !feature(state.source, "F3") });

  before = clone(state);
  plan = edit(addOperations, addExpected);
  record("reintroduce", before, plan, { retiredIdAccepted: true, retirementHistoryAvailableInSot: false }, {
    retiredIdAccepted: Boolean(feature(state.source, "F3")),
    retirementHistoryAvailableInSot: JSON.stringify(state.source).includes(c.retiredReason)
  });
  return {
    conceptId: c.conceptId, definitionDigest, initial, stages, reproducibility: "passed", lifecycleReadiness: "needs-human-review",
    knownGapCandidates: ["policy-conflict-not-detected", "rebase-does-not-reconcile-content", "merge-leaves-policy-and-kpi-review", "retired-id-reuse"],
    humanReview: { status: "pending", reviewer: null, reviewedDigest: null, questions: [
      `Does ${c.afterPolicy} invalidate the batch behavior that still says ${c.beforePolicy}?`,
      `Should the main plan incorporate this policy after merge: ${c.mergePolicy}?`,
      "Which batch KPI and scenario must be integrated before declaring the baseline current?",
      `Can a new owner discover why the status feature was retired: ${c.retiredReason}?`,
      "Which current behavior, pending proposal, policy reason, unreviewed change and replacement can the next owner identify?"
    ] }
  };
}

export function summarize(results) {
  const unique = new Map();
  for (const result of results) {
    const signature = sotDigest({ definition: result.definitionDigest, stages: result.stages.map(s => [s.id, s.beforeDigest, s.afterDigest]) });
    if (unique.has(result.conceptId)) assert.equal(unique.get(result.conceptId).signature, signature, "conflicting repeated run");
    else unique.set(result.conceptId, { signature, result });
  }
  const concepts = [...unique.values()].map(item => item.result);
  return {
    runs: results.length, uniqueConcepts: concepts.length, uniqueTransitions: concepts.reduce((n, r) => n + r.stages.length, 0),
    reproducibility: concepts.length && concepts.every(r => r.reproducibility === "passed") ? "passed" : "not-assessed",
    lifecycleReadiness: "needs-human-review", humanReviewedConcepts: 0,
    candidateGaps: [...new Set(concepts.flatMap(r => r.knownGapCandidates))],
    generationQuality: { status: "not-assessed", reason: "Synthetic controlled inputs, not fixed-brief host generation runs." },
    humanQuality: { status: "not-assessed", falsePositives: null, falseNegatives: null, authoringEffort: null, handoffTime: null }
  };
}
