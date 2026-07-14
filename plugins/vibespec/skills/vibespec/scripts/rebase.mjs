#!/usr/bin/env node
// Rebase stale initiatives onto their parents' current state. DRY-RUN by
// default: prints the root→leaf cascade plan and stops. Nothing is written
// without --apply, and even then a child is refused unless its parent is also
// applied — the tool never silently produces a half-fresh, incoherent tree.
//
// Usage:
//   node scripts/rebase.mjs <folder | file.sot.json ...>            # dry-run plan
//   node scripts/rebase.mjs <...> --apply                          # apply the whole cascade
//   node scripts/rebase.mjs <...> --apply --only payment,refund    # apply a chosen prefix
//   node scripts/rebase.mjs <...> --json
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { collectFiles } from "./validate-tree.mjs";
import { validateTree } from "./lib/tree.mjs";
import { planRebase, applyRebase, remainingStale } from "./lib/rebase.mjs";

function shortHash(d) { return typeof d === "string" ? d.slice(0, 19) + "…" : "?"; }

export function printPlan(result, applied) {
  const { plan, unrebasable, alreadyFresh } = result;
  if (alreadyFresh) { console.log("[rebase] 트리가 이미 최신입니다 — 갱신할 이니셔티브가 없습니다."); return; }
  if (plan.length) {
    console.log(`[rebase] 연쇄 계획 (root→leaf, ${plan.length}개):`);
    for (const step of plan) {
      const mark = applied ? (applied.includes(step.id) ? "적용" : "보류") : "대상";
      console.log(`  [${mark}] ${step.id}  (부모 ${step.parentId}, 깊이 ${step.depth})  ${shortHash(step.from)} → ${shortHash(step.to)}  · ${step.file}`);
    }
  }
  for (const u of unrebasable) console.error(`  ⚠ ${u.id}: ${u.reason} · ${u.file}`);
  if (applied) {
    const stale = remainingStale(plan, applied);
    if (stale.length) console.log(`\n⚠ 적용 후에도 stale·비활성으로 남는 이니셔티브: ${stale.join(", ")} — 이들을 복구하려면 부모부터 연쇄 적용하세요.`);
    else console.log("\n✓ 적용 대상 전체가 연쇄로 복구되어 트리가 최신이 됩니다.");
  } else {
    console.log("\n(드라이런 — 실제 갱신은 --apply. 일부만 원하면 --apply --only <id,...>. 부모 없이 자식만 적용은 거부됩니다.)");
  }
}

async function main(argv) {
  const json = argv.includes("--json");
  const apply = argv.includes("--apply");
  const onlyIdx = argv.indexOf("--only");
  const onlyIds = onlyIdx >= 0 ? String(argv[onlyIdx + 1] || "").split(",").filter(Boolean) : null;
  const paths = argv.filter((a, i) => !a.startsWith("--") && !(onlyIdx >= 0 && i === onlyIdx + 1));
  if (!paths.length) { console.error("Usage: node scripts/rebase.mjs <folder | file.sot.json ...> [--apply] [--only id,...] [--json]"); process.exitCode = 2; return; }

  let files;
  try { files = collectFiles(paths); } catch (cause) { console.error(`[FAIL] ${cause.message}`); process.exitCode = 2; return; }
  const docs = [];
  for (const file of files) {
    try { docs.push({ name: file, sot: JSON.parse(readFileSync(file, "utf8")) }); }
    catch (cause) { console.error(`[FAIL] ${file}: ${cause.message}`); process.exitCode = 1; return; }
  }

  const result = planRebase(docs);
  const applied = apply ? (onlyIds ?? result.plan.map(p => p.id)) : null;

  // --apply must never write into a tree that isn't otherwise valid: a stale
  // digest is the ONLY finding rebase is allowed to fix. Any other error
  // (duplicate id, structural, cycle, missing parent) means the tree is not a
  // safe rebase target — refuse to write. Dry-run still shows the plan.
  let blocked = null;
  if (apply) {
    const tree = validateTree(docs);
    const nonStale = tree.errors.filter(e => !e.message.includes("digest stale"));
    if (nonStale.length) blocked = nonStale;
    else if (result.unrebasable.length) blocked = result.unrebasable.map(u => ({ file: u.file, path: "$.initiative", message: u.reason }));
  }

  if (json) { console.log(JSON.stringify({ ...result, applied, blocked }, null, 2)); }
  else printPlan(result, blocked ? null : applied);

  if (apply) {
    if (blocked) {
      console.error("\n[rebase] --apply 거부: rebase는 stale digest만 고칩니다. 먼저 validate-tree 오류를 해결하세요:");
      blocked.forEach(e => console.error(`  error ${e.file} ${e.path}: ${e.message}`));
      process.exitCode = 1;
      return;
    }
    const writes = applyRebase(docs, result.plan, applied);
    for (const w of writes) writeFileSync(w.file, w.content);
    if (!json) console.log(`\n[rebase] ${writes.length}개 파일 갱신 완료.`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
