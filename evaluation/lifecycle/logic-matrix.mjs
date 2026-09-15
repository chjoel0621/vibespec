// Independent contract audit: expected states are literal, not computed by the implementation.
// Intentionally separate from the regression gate: retain discovered failures until fixed.
import assert from "node:assert/strict";
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,readdirSync,existsSync,rmSync,unlinkSync,renameSync} from "node:fs";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {createHash} from "node:crypto";
import {spawnSync} from "node:child_process";
import {cases,inputsFor} from "./cases.mjs";
import {replayCase} from "./replay.mjs";
import {readLifecycle,runLifecycle,publishRecord} from "../../plugins/vibespec/skills/vibespec/scripts/lib/lifecycle-store.mjs";
import {planLifecycle} from "../../plugins/vibespec/skills/vibespec/scripts/lib/lifecycle-journal.mjs";

// B = exact before, A = exact after, X = valid but unrecognized externally edited document.
// receipt, main, initiative, status, transaction, recovery allowed, capture allowed
export const stateTable=[
  [false,"B","B","pending-write","pending",true,false],
  [false,"B","A","pending-write","pending",true,false],
  [false,"B","X","external-drift","pending",false,false],
  [false,"A","B","pending-write","pending",true,false],
  [false,"A","A","pending-write","pending",true,false],
  [false,"A","X","external-drift","pending",false,false],
  [false,"X","B","external-drift","pending",false,false],
  [false,"X","A","external-drift","pending",false,false],
  [false,"X","X","external-drift","pending",false,false],
  [true,"B","B","external-drift","complete",false,true],
  [true,"B","A","external-drift","complete",false,true],
  [true,"B","X","external-drift","complete",false,true],
  [true,"A","B","external-drift","complete",false,true],
  [true,"A","A","current","complete",true,true],
  [true,"A","X","external-drift","complete",false,true],
  [true,"X","B","external-drift","complete",false,true],
  [true,"X","A","external-drift","complete",false,true],
  [true,"X","X","external-drift","complete",false,true]
];
// root changed, child changed, root-check stale, child-check stale, parent-impact stale
const staleTable=[
  [false,false,false,false,false],
  [true,false,true,false,true],
  [false,true,false,true,true],
  [true,true,true,true,true]
];
const intent=kind=>({kind,reason:"Independent logic audit",...(kind==="merge"?{initiative:"batch"}:{})});
const json=(root,name,value)=>writeFileSync(join(root,name),JSON.stringify(value,null,2)+"\n");
const read=(root,name)=>JSON.parse(readFileSync(join(root,name),"utf8"));
const recordName=n=>`history/lifecycle/records/${String(n).padStart(8,"0")}.json`;
const receiptName=n=>`history/lifecycle/completed/${String(n).padStart(8,"0")}.json`;
function files(root) {
  const result={};
  const walk=(folder,prefix="")=>{
    for(const e of readdirSync(folder,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))) {
      const name=prefix+e.name,path=join(folder,e.name);
      if(e.isDirectory()) walk(path,name+"/");
      else result[name]=createHash("sha256").update(readFileSync(path)).digest("hex");
    }
  };
  walk(root);return result;
}
function noApproval(report) {
  assert.equal(report.productApproval,"not-assessed");
  for(const review of report.pendingReviews||[]) assert.equal(review.status,"pending");
}
function seed(root,c) {
  const input=inputsFor(c);
  mkdirSync(join(root,"initiatives"),{recursive:true});
  json(root,"main.sot.json",input.source);json(root,"initiatives/batch.sot.json",input.initiative);
  runLifecycle(root,intent("init"),{apply:true});
}
function matrixFixture(root,c,row) {
  seed(root,c);
  const state=readLifecycle(root),plan=planLifecycle(state.records,state.docs,intent("merge"));
  // Ensure the fixture actually exercises two distinct source-file transitions.
  assert.notDeepEqual(plan.record.before[0].sot,plan.record.after[0].sot);
  assert.notDeepEqual(plan.record.before[1].sot,plan.record.after[1].sot);
  if(row[0]) runLifecycle(root,intent("merge"),{apply:true});
  else publishRecord(root,plan.record);
  for(const [i,symbol] of [row[1],row[2]].entries()) {
    const doc=structuredClone((symbol==="B"?plan.record.before:plan.record.after)[i]);
    if(symbol==="X") doc.sot.title+=" [external edit]";
    json(root,doc.name,doc.sot);
  }
  return plan.record;
}

export function auditLogic() {
  const workspace=mkdtempSync(join(tmpdir(),"vibespec-logic-audit-")),results=[];
  const check=(id,category,expectation,fn)=>{
    const root=join(workspace,String(results.length+1));
    mkdirSync(root);
    const evidence={};
    try {fn(root,evidence);results.push({id,category,expectation,pass:true,evidence});}
    catch(error) {results.push({id,category,expectation,pass:false,evidence,error:error.message});}
  };
  try {
    for(const c of cases) for(const row of stateTable) {
      const [receipt,main,child,status,transaction,recovery,capture]=row;
      check(`${c.conceptId}/receipt-${receipt}/${main}${child}`,"transaction",
        {status,transaction,recovery,capture,productApproval:"not-assessed"},(root,evidence)=>{
          const recoverRoot=join(root,"recover"),captureRoot=join(root,"capture");
          const record=matrixFixture(recoverRoot,c,row);
          const before=files(recoverRoot),observed=readLifecycle(recoverRoot).report;
          evidence.status=observed.status;evidence.transaction=observed.transaction;
          assert.equal(observed.status,status);assert.equal(observed.transaction,transaction);noApproval(observed);
          // Detect read-only status unexpectedly writing any source/history bytes.
          assert.deepEqual(files(recoverRoot),before);
          if(recovery) {
            const report=runLifecycle(recoverRoot,intent("recover"),{apply:true});
            assert.equal(report.status,"current");assert.equal(report.transaction,"complete");noApproval(report);
            assert.deepEqual(readLifecycle(recoverRoot).docs,record.after);
            const once=files(recoverRoot);
            runLifecycle(recoverRoot,intent("recover"),{apply:true});
            assert.deepEqual(files(recoverRoot),once,"recovery must be idempotent");
          } else {
            assert.throws(()=>runLifecycle(recoverRoot,intent("recover"),{apply:true}),/external drift/);
            assert.deepEqual(files(recoverRoot),before,"rejected recovery must not overwrite sources/history");
          }
          evidence.recovery=recovery?"completed, idempotent":"refused, bytes unchanged";
          matrixFixture(captureRoot,c,row);
          const captureBefore=files(captureRoot);
          if(capture) {
            const report=runLifecycle(captureRoot,intent("capture"),{apply:true});
            assert.equal(report.status,"current");assert.equal(report.transaction,"complete");noApproval(report);
            for(const name of ["main.sot.json","initiatives/batch.sot.json"])
              assert.equal(files(captureRoot)[name],captureBefore[name],"capture must preserve source bytes");
            assert.equal(readLifecycle(captureRoot).records.length,main==="A"&&child==="A"?2:3);
          } else {
            assert.throws(()=>runLifecycle(captureRoot,intent("capture"),{apply:true}),/pending transaction/);
            assert.deepEqual(files(captureRoot),captureBefore);
          }
          evidence.capture=capture?"accepted, sources unchanged":"refused, bytes unchanged";
        });
    }
    for(const c of cases) for(const row of staleTable) {
      const [parent,child,rootStale,childStale,parentStale]=row;
      check(`${c.conceptId}/stale-${parent}-${child}`,"staleness",
        {rootStale,childStale,parentStale},(root,evidence)=>{
          seed(root,c);
          if(parent) {const sot=read(root,"main.sot.json");sot.title+=" external";json(root,"main.sot.json",sot);}
          if(child) {const sot=read(root,"initiatives/batch.sot.json");sot.title+=" external";json(root,"initiatives/batch.sot.json",sot);}
          const report=readLifecycle(root).report;
          const actual={rootStale:report.historicalChecks.find(c=>c.scope==="root").stale,
            childStale:report.historicalChecks.find(c=>c.scope==="batch").stale,
            parentStale:report.pendingReviews.find(t=>t.type==="parent-change").stale};
          evidence.actual=actual;assert.deepEqual(actual,{rootStale,childStale,parentStale});noApproval(report);
        });
    }
    // Detect JavaScript truthiness silently converting invalid explicit values to {}.
    for(const [label,value,allowed] of [["object",{},true],["omitted",undefined,true],["false",false,false],
      ["zero",0,false],["empty-string","",false],["null",null,false],["array",[],false],["string","bad",false],
      ["invalid-mapping",{"root/F1":"root/F2"},false]]) {
      check(`replacements/${label}`,"input-validation",{allowed},(root,evidence)=>{
        seed(root,cases[0]);const sot=read(root,"main.sot.json");sot.title+=" external";json(root,"main.sot.json",sot);
        const request=intent("capture");if(label!=="omitted") request.replacements=value;
        const before=files(root);let error=null,report;
        try {report=runLifecycle(root,request);} catch(e) {error=e;}
        evidence.accepted=!error;evidence.error=error?.message||null;
        assert.deepEqual(files(root),before,"preview must never write");
        // Exercise the public CLI too: malformed inputs must not become durable records.
        const args=[fileURLToPath(new URL("../../plugins/vibespec/skills/vibespec/scripts/lifecycle.mjs",import.meta.url)),
          root,"capture","--reason","Independent CLI input audit","--apply","--json"];
        if(label!=="omitted") {json(root,"replacement-input.json",value);args.push("--replacements",join(root,"replacement-input.json"));}
        const cliBefore=files(root),cli=spawnSync(process.execPath,args,{encoding:"utf8"});
        if(cli.error) throw cli.error;
        evidence.cliExitCode=cli.status;evidence.cliError=cli.stderr.trim();
        evidence.recordCountAfterCli=readLifecycle(root).records.length;
        if(cli.status===0) {
          const head=readLifecycle(root).records.at(-1);
          evidence.persistedReplacements=head.replacements;
          evidence.persistedInputReplacements=head.input.replacements??null;
          noApproval(JSON.parse(cli.stdout));
          for(const name of ["main.sot.json","initiatives/batch.sot.json"]) assert.equal(files(root)[name],cliBefore[name]);
        } else assert.deepEqual(files(root),cliBefore,"rejected CLI input must not write history or sources");
        assert.equal(!error,allowed,"explicit replacement input type must be validated");
        assert.equal(cli.status===0,allowed,"CLI apply must enforce the same input contract");
        if(report) noApproval(report);
      });
    }
    for(const [label,reason,allowed] of [["normal","Observed policy changed",true],["whitespace"," \t\n",false],
      ["empty","",false],["null",null,false],["number",7,false],["omitted",undefined,false]]) {
      check(`reason/${label}`,"input-validation",{allowed},(root,evidence)=>{
        seed(root,cases[0]);const before=files(root);let error=null;
        try {runLifecycle(root,{kind:"capture",reason},{apply:true});} catch(e) {error=e;}
        evidence.accepted=!error;evidence.error=error?.message||null;
        assert.deepEqual(files(root),before);assert.equal(!error,allowed);
      });
    }
    const corruptions=[
      ["receipt-kind",root=>{const r=read(root,receiptName(2));r.kind="approved";json(root,receiptName(2),r);}],
      ["receipt-digest",root=>{const r=read(root,receiptName(2));r.recordDigest="wrong";json(root,receiptName(2),r);}],
      ["earlier-receipt-missing",root=>unlinkSync(join(root,receiptName(1)))],
      ["record-tamper",root=>{const r=read(root,recordName(2));r.reason="changed";json(root,recordName(2),r);}],
      ["head-record-missing",root=>unlinkSync(join(root,recordName(2)))],
      ["sequence-gap",root=>{renameSync(join(root,recordName(1)),join(root,"removed-record.json"));}],
      ["unknown-history-entry",root=>json(root,"history/lifecycle/records/unrecognized.json",{})],
      ["malformed-record-json",root=>writeFileSync(join(root,recordName(2)),"{")]
    ];
    for(const [label,mutate] of corruptions) check(`history/${label}`,"integrity",{read:"refused",capture:"refused",bytes:"unchanged"},(root,evidence)=>{
      seed(root,cases[0]);runLifecycle(root,intent("merge"),{apply:true});mutate(root);
      const before=files(root);
      assert.throws(()=>readLifecycle(root),e=>{evidence.readError=e.message;return true;});
      assert.throws(()=>runLifecycle(root,intent("capture"),{apply:true}),e=>{evidence.captureError=e.message;return true;});
      assert.deepEqual(files(root),before);
    });
    for(const c of cases) check(`${c.conceptId}/retired-reuse`,"identity",{reuse:"refused",bytes:"unchanged",productApproval:"not-assessed"},(root,evidence)=>{
      seed(root,c);const replay=replayCase(c);
      for(const change of [
        {kind:"apply",scope:"root",plan:replay.stages[0].input},
        {kind:"apply",scope:"root",plan:replay.stages[1].input},
        {kind:"rebase"},{kind:"merge",initiative:"batch"},
        {kind:"apply",scope:"root",plan:replay.stages[4].input.plan,replacements:{"root/F3":"root/F1"}}
      ]) runLifecycle(root,{...change,reason:"Explicit audit transition"},{apply:true});
      const before=files(root),report=readLifecycle(root,{id:"root/F3"}).report;
      assert.equal(report.lookup.active,false);assert.equal(report.lookup.retirement.replacement,"root/F1");
      assert.throws(()=>runLifecycle(root,{kind:"apply",scope:"root",plan:replay.stages[5].input,reason:"Attempt retired reuse"},{apply:true}),/retired ID/);
      assert.deepEqual(files(root),before);noApproval(report);
      evidence.retired=report.lookup.retirement;evidence.pendingReviews=report.pendingReviews.length;
    });
    return {scope:"independent lifecycle candidate logic audit",humanApproval:"not-assessed",
      total:results.length,passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass).length,results};
  } finally {rmSync(workspace,{recursive:true,force:true});}
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  if(process.argv.length!==4||process.argv[2]!=="--write") throw new Error("Usage: node evaluation/lifecycle/logic-matrix.mjs --write <new-report.json>");
  const path=resolve(process.argv[3]);
  if(existsSync(path)) throw new Error("Report already exists; choose a new path");
  const report=auditLogic();
  writeFileSync(path,JSON.stringify(report,null,2)+"\n",{flag:"wx"});
  console.log(JSON.stringify({total:report.total,passed:report.passed,failed:report.failed}));
  for(const failure of report.results.filter(r=>!r.pass)) console.error(failure.id+": "+failure.error);
  if(report.failed) process.exitCode=1;
}
