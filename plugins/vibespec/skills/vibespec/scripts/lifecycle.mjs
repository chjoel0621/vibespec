#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { readLifecycle,runLifecycle } from "./lib/lifecycle-store.mjs";

function main(argv) {
  const [root,kind,...args]=argv;
  const allowed={init:["reason"],status:["id"],capture:["reason","replacements"],apply:["reason","scope","plan","replacements"],rebase:["reason"],merge:["reason","initiative"],recover:[],unlock:[]};
  if(!root||!Object.hasOwn(allowed,kind)) throw new Error("Usage: lifecycle.mjs <workspace> init|status|capture|apply|rebase|merge|recover|unlock [options] [--apply] [--json]");
  const options={};let apply=false,json=false;
  for(let i=0;i<args.length;i++) {
    const arg=args[i];
    if(arg==="--json") {json=true;continue;}
    if(arg==="--apply"&&kind!=="status") {apply=true;continue;}
    const key=arg.slice(2);
    if(!arg.startsWith("--")||!allowed[kind].includes(key)||Object.hasOwn(options,key)) throw new Error("unknown or duplicate option "+arg);
    if(!args[i+1]||args[i+1].startsWith("--")) throw new Error("missing value for "+arg);
    options[key]=args[++i];
  }
  if(kind==="apply"&&(!options.scope||!options.plan)) throw new Error("apply requires --scope and --plan");
  if(kind==="merge"&&!options.initiative) throw new Error("merge requires --initiative");
  if(options.plan) options.plan=JSON.parse(readFileSync(options.plan,"utf8"));
  if(options.replacements) options.replacements=JSON.parse(readFileSync(options.replacements,"utf8"));
  const result=kind==="status"?readLifecycle(root,options).report:runLifecycle(root,{kind,...options},{apply});
  if(json) console.log(JSON.stringify(result,null,2));
  else {
    console.log(`[lifecycle] ${result.status}; product approval: not-assessed`);
    if(result.record) console.log(`  proposed ${result.record.kind}: ${result.record.reason}; ${result.record.changes.length} changed scope(s); pass --apply to write`);
    if(result.pendingReviews) console.log(`  ${result.pendingReviews.length} pending review item(s); ${result.retired.length} retired ID(s); ${result.historicalChecks.filter(c=>c.stale).length} stale automated check(s)`);
    for(const r of result.pendingReviews||[]) console.log(`  pending ${r.scope}: ${r.type}${r.field?"/"+r.field:""}${r.stale?" (basis changed)":""}`);
    if(result.lookup) console.log(JSON.stringify(result.lookup,null,2));
  }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  try {main(process.argv.slice(2));} catch(error) {console.error("[lifecycle] FAIL: "+error.message);process.exitCode=1;}
}
