import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cases } from "./cases.mjs";
import { replayCase, summarize } from "./replay.mjs";

function main(argv) {
  let json = false, caseId, output;
  for (let i = 0; i < argv.length; i++) {
    const option = argv[i];
    if (option === "--json") json = true;
    else if (["--case", "--write"].includes(option)) {
      if (!argv[i + 1] || argv[i + 1].startsWith("--")) throw new Error(`missing value for ${option}`);
      if (option === "--case") caseId = argv[++i]; else output = resolve(argv[++i]);
    } else throw new Error(`unknown option ${option}`);
  }
  const selected = cases.filter(c => !caseId || c.conceptId === caseId);
  if (!selected.length) throw new Error(`unknown case ${caseId}`);
  const results = selected.map(replayCase);
  const report = { contractVersion: "lifecycle-evaluation-0.1", summary: summarize(results), cases: results };
  if (output) {
    // Require a new output folder, so a report never overwrites its evidence.
    if (existsSync(output)) throw new Error("output already exists; choose a new report directory");
    mkdirSync(output, { recursive: true });
    writeFileSync(join(output, "report.json"), JSON.stringify(report, null, 2) + "\n");
    for (const result of results) {
      const dir = join(output, result.conceptId);
      mkdirSync(dir);
      writeFileSync(join(dir, "initial.json"), JSON.stringify(result.initial, null, 2) + "\n");
      for (const stage of result.stages) writeFileSync(join(dir, `${stage.id}.json`), JSON.stringify(stage, null, 2) + "\n");
      writeFileSync(join(dir, "human-review.json"), JSON.stringify(result.humanReview, null, 2) + "\n");
    }
  }
  if (json) console.log(JSON.stringify(report, null, 2));
  else {
    for (const r of results) console.log(`[lifecycle] REPRODUCED ${r.conceptId}: ${r.stages.length} changes; ${r.knownGapCandidates.length} gap candidates; human review pending`);
    console.log(`[lifecycle] ${report.summary.uniqueConcepts} unique concepts / ${report.summary.uniqueTransitions} transitions. Reproducibility=${report.summary.reproducibility}; lifecycle=${report.summary.lifecycleReadiness}; generation and human quality not-assessed.`);
    if (output) console.log(`[lifecycle] evidence: ${output}`);
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)); } catch (error) { console.error(`[lifecycle] FAIL ${error.message}`); process.exitCode = 1; }
}
