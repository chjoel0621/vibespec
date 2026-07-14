#!/usr/bin/env node
// Compare two SOT files and report what changed, what it touches (impact
// radius), and what is provably untouched (canonical-byte identical).
// Usage: node scripts/diff-sot.mjs <before.sot.json> <after.sot.json> [--json]
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { diffReport } from "./lib/diff.mjs";

function fmt(value) {
  if (value === undefined) return "—";
  if (typeof value === "string") return JSON.stringify(value.length > 60 ? value.slice(0, 57) + "…" : value);
  return JSON.stringify(value);
}

export function printReport(report, beforeName, afterName) {
  const { changes, removedIds, unchanged, impact, digest } = report;
  console.log(`[diff] ${beforeName} → ${afterName}`);
  console.log(`digest: ${digest.before.slice(0, 19)}… → ${digest.after.slice(0, 19)}…`);
  if (!changes.length) { console.log("변경 없음 — 두 파일은 표준 직렬화 기준 동일합니다."); return; }
  const counts = changes.reduce((acc, c) => ((acc[c.type] = (acc[c.type] ?? 0) + 1), acc), {});
  console.log(`변경 ${changes.length}건 (추가 ${counts.added ?? 0} · 삭제 ${counts.removed ?? 0} · 수정 ${counts.modified ?? 0} · 이동 ${counts.moved ?? 0})`);
  if (unchanged.length) console.log(`바이트 동일 섹션: ${unchanged.join(", ")}`);
  console.log("");
  const label = { added: "추가", removed: "삭제", modified: "수정", moved: "이동" };
  for (const change of changes) {
    if (change.added || change.removed) {
      const parts = [];
      if (change.added) parts.push(`+${change.added.map(fmt).join(", +")}`);
      if (change.removed) parts.push(`-${change.removed.map(fmt).join(", -")}`);
      console.log(`  ${label[change.type]}  ${change.path}: ${parts.join("  ")}`);
    } else if (change.type === "modified") {
      console.log(`  수정  ${change.path}: ${fmt(change.before)} → ${fmt(change.after)}`);
    } else {
      console.log(`  ${label[change.type]}  ${change.path}${change.before !== undefined ? `: ${fmt(change.before)} → ${fmt(change.after)}` : ""}`);
    }
  }
  const impactIds = Object.keys(impact);
  if (impactIds.length) {
    console.log("\n영향 반경 (변경 항목이 연결된 곳):");
    for (const id of impactIds) {
      const i = impact[id];
      const parts = [];
      if (i.pages.length) parts.push(`화면 ${i.pages.join(", ")}`);
      if (i.transitions.length) parts.push(`전환 ${i.transitions.join(", ")}`);
      if (i.kpis.length) parts.push(`KPI ${i.kpis.map(fmt).join(", ")}`);
      if (i.scenarios.length) parts.push(`시나리오 ${i.scenarios.join(", ")}`);
      console.log(`  ${id} → ${parts.join(" · ")}`);
    }
  }
  if (removedIds.length) console.log(`\n⚠ 삭제된 id: ${removedIds.join(", ")} — 이 id들은 재사용하면 안 됩니다.`);
}

async function main(args) {
  const json = args.includes("--json");
  const files = args.filter(a => a !== "--json");
  if (files.length !== 2) {
    console.error("Usage: node scripts/diff-sot.mjs <before.sot.json> <after.sot.json> [--json]");
    process.exitCode = 2;
    return;
  }
  const [before, after] = files.map(f => JSON.parse(readFileSync(f, "utf8")));
  const report = diffReport(before, after);
  if (json) console.log(JSON.stringify(report, null, 2));
  else printReport(report, files[0], files[1]);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
