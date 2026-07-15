#!/usr/bin/env node
// Merge (land) an implemented initiative into the main. DRY-RUN by default:
// prints what would fold in and stops. --apply rewrites the main (ids renumbered
// into its space) and marks the initiative landed. Because merging changes the
// main, remaining initiatives on it become stale — reported, not silently
// rewritten (run rebase next).
//
// Usage:
//   node scripts/merge.mjs <folder | file.sot.json ...> --only <initiativeId>            # dry-run
//   node scripts/merge.mjs <folder | file.sot.json ...> --only <initiativeId> --apply    # write
//   node scripts/merge.mjs <...> --only <id> --json
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { collectFiles } from "./validate-tree.mjs";
import { planMerge } from "./lib/merge.mjs";
import { stableStringify } from "./lib/c14n.mjs";

export function printPlan(r) {
  if (!r.ok) {
    console.error(`[merge] 불가: ${r.error}`);
    if (r.errors) r.errors.forEach(e => console.error(`  error ${e.file} ${e.path}: ${e.message}`));
    return;
  }
  const rep = r.report;
  console.log(`[merge] "${rep.initiative}" → 본편에 접어 넣기 (landed)`);
  if (rep.addedSections.length) console.log(`  섹션: ${rep.addedSections.join(", ")}`);
  if (rep.addedPages.length) console.log(`  페이지: ${rep.addedPages.join(", ")}`);
  if (rep.addedRequirements.length) console.log(`  요구사항: ${rep.addedRequirements.join(", ")}`);
  if (rep.addedFeatures.length) console.log(`  기능: ${rep.addedFeatures.join(", ")}`);
  if (rep.attachedAt.length) console.log(`  접점: ${rep.attachedAt.map(a => a.at).join(", ")}`);
  const pv = rep.prdReview;
  if (pv.problem || pv.solution || pv.goal || (pv.nonGoals || []).length) {
    console.log(`  PRD 검토 필요(본편 서사에 수동 반영): ${[pv.problem && `problem="${pv.problem}"`, pv.solution && `solution="${pv.solution}"`, pv.goal && `goal="${pv.goal}"`, (pv.nonGoals || []).length && `nonGoals=${JSON.stringify(pv.nonGoals)}`].filter(Boolean).join(" ")}`);
  }
  if (r.staleSiblings.length) console.log(`\n⚠ 머지 후 stale이 되는 본편 이니셔티브: ${r.staleSiblings.join(", ")} — rebase로 갱신하세요.`);
}

async function main(argv) {
  const json = argv.includes("--json");
  const apply = argv.includes("--apply");
  const onlyIdx = argv.indexOf("--only");
  const initId = onlyIdx >= 0 ? argv[onlyIdx + 1] : null;
  const paths = argv.filter((a, i) => !a.startsWith("--") && !(onlyIdx >= 0 && i === onlyIdx + 1));
  if (!paths.length || !initId) { console.error("Usage: node scripts/merge.mjs <folder | file.sot.json ...> --only <initiativeId> [--apply] [--json]"); process.exitCode = 2; return; }

  let files;
  try { files = collectFiles(paths); } catch (cause) { console.error(`[FAIL] ${cause.message}`); process.exitCode = 2; return; }
  const docs = [];
  for (const file of files) {
    try { docs.push({ name: file, sot: JSON.parse(readFileSync(file, "utf8")) }); }
    catch (cause) { console.error(`[FAIL] ${file}: ${cause.message}`); process.exitCode = 1; return; }
  }

  const r = planMerge(docs, initId);
  if (json) console.log(JSON.stringify(r, null, 2));
  else printPlan(r);
  if (!r.ok) { process.exitCode = 1; return; }

  if (apply) {
    writeFileSync(r.mainName, stableStringify(r.main));
    writeFileSync(r.landedName, stableStringify(r.landed));
    if (!json) console.log(`\n[merge] 적용 완료: 본편 갱신(${r.mainName}) + 이니셔티브 landed 표시(${r.landedName}).${r.staleSiblings.length ? " 이제 rebase로 나머지를 갱신하세요." : ""}`);
  } else if (!json) {
    console.log("\n(드라이런 — 실제 적용은 --apply.)");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
