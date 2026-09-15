// Third-round behavioral tests: real child-process interruptions and workspace repairs.
import assert from "node:assert/strict";
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,readdirSync,renameSync,unlinkSync,rmSync,existsSync,symlinkSync} from "node:fs";
import {tmpdir} from "node:os";
import {dirname,basename,join,resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {createHash} from "node:crypto";
import {spawnSync} from "node:child_process";
import {runLifecycle,readLifecycle,publishRecord,withLifecycleLock} from "../../plugins/vibespec/skills/vibespec/scripts/lib/lifecycle-store.mjs";
import {planLifecycle} from "../../plugins/vibespec/skills/vibespec/scripts/lib/lifecycle-journal.mjs";
import {sotDigest} from "../../plugins/vibespec/skills/vibespec/scripts/lib/c14n.mjs";
import {validateTree} from "../../plugins/vibespec/skills/vibespec/scripts/lib/tree.mjs";

const self=fileURLToPath(import.meta.url);
const cli=fileURLToPath(new URL("../../plugins/vibespec/skills/vibespec/scripts/lifecycle.mjs",import.meta.url));
const fixture=name=>JSON.parse(readFileSync(new URL("../../plugins/vibespec/skills/vibespec/tests/fixtures/tree/"+name,import.meta.url),"utf8"));
const save=(root,name,sot)=>{mkdirSync(dirname(join(root,name)),{recursive:true});writeFileSync(join(root,name),JSON.stringify(sot,null,2)+"\n");};
const intent=kind=>({kind,reason:"Third-round resilience test"});
const doc=(root,scope)=>readLifecycle(root).docs.find(d=>(d.sot.initiative?.id||"root")===scope);
function files(root) {
  const values={};
  const walk=(dir,prefix="")=>{for(const e of readdirSync(dir,{withFileTypes:true})) {
    const name=prefix+e.name,path=join(dir,e.name);
    if(e.isSymbolicLink()) values[name]="symlink";
    else if(e.isDirectory()) walk(path,name+"/");
    else values[name]=createHash("sha256").update(readFileSync(path)).digest("hex");
  }};walk(root);return values;
}
function setup(root,nested=false) {
  const main=fixture("main.sot.json"),payment=fixture("shop.1-2.payment.sot.json");
  payment.initiative.status="implemented";
  const docs=[{name:"main.sot.json",sot:main},{name:"initiatives/payment.sot.json",sot:payment}];
  if(nested) {
    const refund=structuredClone(payment);refund.title="Refund";refund.initiative.id="refund";refund.initiative.path="1-2-1";
    refund.initiative.parent={scopeId:"payment",canonicalization:"sot-c14n-v1",digest:sotDigest(payment)};
    refund.ia.sections[0].boundary.scopeId="payment";refund.ia.sections[0].pages[0].boundary.scopeId="payment";
    refund.ia.sections[0].pages[0].title="Pay";docs.push({name:"initiatives/refund.sot.json",sot:refund});
  }
  assert.equal(validateTree(docs).valid,true);
  for(const d of docs) save(root,d.name,d.sot);
  runLifecycle(root,intent("init"),{apply:true});
}
function noApproval(report) {assert.equal(report.productApproval,"not-assessed");assert.ok(report.pendingReviews.every(t=>t.status==="pending"));}
function worker(root,mode) {
  // Only the runner's explicitly named temporary fixture directories are eligible.
  assert.ok(basename(dirname(root)).startsWith("vibespec-resilience-"));
  if(mode==="contend") {
    withLifecycleLock(root,()=>{
      const before=files(root),result=spawnSync(process.execPath,[cli,root,"capture","--reason","Competing process","--apply","--json"],{encoding:"utf8",timeout:15000});
      if(result.error) throw result.error;
      assert.equal(result.status,1);assert.match(result.stderr,/locked/);assert.deepEqual(files(root),before);
      console.log(JSON.stringify({competingExitCode:result.status,locked:true}));
    });
    return;
  }
  assert.ok(["crash-0","crash-1","crash-2"].includes(mode));
  withLifecycleLock(root,()=>{
    const state=readLifecycle(root),plan=planLifecycle(state.records,state.docs,{...intent("merge"),initiative:"payment"});
    publishRecord(root,plan.record);
    // Explicitly controlled interruption points; not a power-loss durability claim.
    for(const d of plan.record.after.slice(0,Number(mode.at(-1)))) save(root,d.name,d.sot);
    process.exit(23); // Skip lock cleanup exactly as an abruptly exited writer would.
  });
}

export function runResilience() {
  const workspace=mkdtempSync(join(tmpdir(),"vibespec-resilience-")),results=[];
  const test=(id,expected,body)=>{
    const root=join(workspace,String(results.length+1));mkdirSync(root);const evidence={};
    try {body(root,evidence);results.push({id,expected,pass:true,evidence});}
    catch(error) {results.push({id,expected,pass:false,evidence,error:{name:error.name,message:error.message}});}
  };
  try {
    test("whole-workspace-relocation","moving the workspace with its journal preserves status and history bytes",root=>{
      setup(root);const before=files(root),moved=root+"-relocated";renameSync(root,moved);
      const report=readLifecycle(moved).report;assert.equal(report.status,"current");noApproval(report);
      assert.equal(runLifecycle(moved,intent("capture"),{apply:true}).noop,true);assert.deepEqual(files(moved),before);
    });
    test("two-file-path-swap","swapping two scope file paths records both moves without changing identities",root=>{
      setup(root,true);const a="initiatives/payment.sot.json",b="initiatives/refund.sot.json",held="initiatives/held.tmp";
      renameSync(join(root,a),join(root,held));renameSync(join(root,b),join(root,a));renameSync(join(root,held),join(root,b));
      const report=runLifecycle(root,intent("capture"),{apply:true});
      assert.deepEqual(report.history.at(-1).changes.map(c=>[c.scope,c.previousFile,c.file]).sort(),[
        ["payment",a,b],["refund",b,a]
      ]);
      assert.equal(report.retired.length,0);assert.equal(report.pendingReviews.filter(t=>t.sequence===2).length,0);
      assert.equal(report.tree.valid,true);noApproval(report);
    });
    test("path-move-and-content-edit","a simultaneous move and edit retains its path history and content/descendant reviews",root=>{
      setup(root,true);const p=doc(root,"payment");p.sot.title="Payment amended";
      unlinkSync(join(root,p.name));save(root,"initiatives/archive/payment.sot.json",p.sot);
      const report=runLifecycle(root,intent("capture"),{apply:true});
      const change=report.history.at(-1).changes.find(c=>c.scope==="payment");
      assert.equal(change.previousFile,"initiatives/payment.sot.json");assert.equal(change.file,"initiatives/archive/payment.sot.json");
      const tasks=report.pendingReviews.filter(t=>t.sequence===2);
      assert.ok(tasks.some(t=>t.type==="content-review"&&t.scope==="payment"));
      assert.ok(tasks.some(t=>t.type==="parent-change"&&t.scope==="refund"&&t.parentScope==="payment"));noApproval(report);
    });
    test("restore-missing-parent-after-refusal","a refused parent deletion leaves history intact and an exact restore returns to current",root=>{
      setup(root,true);const saved=readFileSync(join(root,"initiatives/payment.sot.json"));unlinkSync(join(root,"initiatives/payment.sot.json"));
      const before=files(root);
      assert.throws(()=>runLifecycle(root,intent("capture"),{apply:true}),/missing parent scope payment.*refund/);
      assert.deepEqual(files(root),before);writeFileSync(join(root,"initiatives/payment.sot.json"),saved);
      assert.equal(readLifecycle(root).report.status,"current");assert.equal(readLifecycle(root).records.length,1);
    });
    test("repair-reparent-before-capture","explicitly repairing a surviving child's references permits capture and retires only the removed scope",root=>{
      setup(root,true);unlinkSync(join(root,"initiatives/payment.sot.json"));
      const child=doc(root,"refund"),main=doc(root,"root");
      child.sot.initiative.path="1-3";child.sot.initiative.parent={scopeId:"root",canonicalization:"sot-c14n-v1",digest:sotDigest(main.sot)};
      child.sot.ia.sections[0].boundary.scopeId="root";child.sot.ia.sections[0].pages[0].boundary.scopeId="root";
      child.sot.ia.sections[0].pages[0].title="Cart";save(root,child.name,child.sot);
      const report=runLifecycle(root,intent("capture"),{apply:true});assert.equal(report.status,"current");assert.equal(report.tree.valid,true);
      assert.ok(report.retired.some(r=>r.id==="payment/F1"));assert.ok(report.retired.every(r=>r.id.startsWith("payment/")));noApproval(report);
    });
    for(const stage of [0,1,2]) test(`process-exit-after-${stage}-writes`,"a dead writer lock requires explicit unlock and its intent remains recoverable",(root,evidence)=>{
      setup(root);const child=spawnSync(process.execPath,[self,"--worker",root,`crash-${stage}`],{encoding:"utf8",timeout:15000});
      if(child.error) throw child.error;assert.equal(child.status,23,child.stderr);
      const state=readLifecycle(root);assert.equal(state.report.status,"pending-write");assert.equal(state.report.transaction,"pending");
      const before=files(root);assert.throws(()=>runLifecycle(root,{kind:"recover"},{apply:true}),/locked/);assert.deepEqual(files(root),before);
      assert.equal(runLifecycle(root,{kind:"unlock"}).status,"dry-run");assert.deepEqual(files(root),before);
      assert.equal(runLifecycle(root,{kind:"unlock"},{apply:true}).status,"unlocked");
      const report=runLifecycle(root,{kind:"recover"},{apply:true});assert.equal(report.status,"current");assert.equal(report.transaction,"complete");
      assert.deepEqual(readLifecycle(root).docs,state.records.at(-1).after);noApproval(report);
      evidence.workerExitCode=23;evidence.recovered=true;evidence.recordCount=readLifecycle(root).records.length;
    });
    test("cross-process-exclusive-writer","a second process cannot write while the first holds the journal lock",(root,evidence)=>{
      setup(root);const before=files(root),child=spawnSync(process.execPath,[self,"--worker",root,"contend"],{encoding:"utf8",timeout:20000});
      if(child.error) throw child.error;assert.equal(child.status,0,child.stderr);
      evidence.result=JSON.parse(child.stdout);assert.deepEqual(evidence.result,{competingExitCode:1,locked:true});
      assert.deepEqual(files(root),before);assert.equal(readLifecycle(root).records.length,1);
    });
    test("corrupt-lock-owner","malformed lock ownership is never guessed or silently removed",root=>{
      setup(root);mkdirSync(join(root,"history/lifecycle/write.lock"));writeFileSync(join(root,"history/lifecycle/write.lock/owner.json"),"{");
      const before=files(root);assert.throws(()=>runLifecycle(root,{kind:"unlock"},{apply:true}),SyntaxError);assert.deepEqual(files(root),before);
      assert.throws(()=>runLifecycle(root,intent("capture"),{apply:true}),/locked/);assert.deepEqual(files(root),before);
    });
    test("source-directory-junction","redirected initiative sources are refused without changing source or target files",root=>{
      setup(root);const outside=root+"-source-target";renameSync(join(root,"initiatives"),outside);
      symlinkSync(outside,join(root,"initiatives"),"junction");const before=files(outside),journal=files(join(root,"history"));
      try {
        assert.throws(()=>readLifecycle(root),/symlink/);assert.throws(()=>runLifecycle(root,intent("capture"),{apply:true}),/symlink/);
        assert.deepEqual(files(outside),before);assert.deepEqual(files(join(root,"history")),journal);
      } finally {rmSync(join(root,"initiatives"));} // Remove only the test-owned junction, not its target.
    });
    test("invalid-source-json","malformed source JSON blocks status and capture without new history",root=>{
      setup(root);writeFileSync(join(root,"main.sot.json"),"{");const before=files(root);
      assert.throws(()=>readLifecycle(root),SyntaxError);assert.throws(()=>runLifecycle(root,intent("capture"),{apply:true}),SyntaxError);
      assert.deepEqual(files(root),before);
    });
    return {scope:"third-round lifecycle process and repair resilience",productApproval:"not-assessed",total:results.length,
      passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass).length,results};
  } finally {rmSync(workspace,{recursive:true,force:true});}
}
if(process.argv[1]&&resolve(process.argv[1])===self) {
  if(process.argv[2]==="--worker") worker(resolve(process.argv[3]),process.argv[4]);
  else {
    if(process.argv.length!==4||process.argv[2]!=="--write") throw new Error("Usage: node evaluation/lifecycle/resilience.mjs --write <new-report.json>");
    const path=resolve(process.argv[3]);if(existsSync(path)) throw new Error("Report already exists");
    const report=runResilience();writeFileSync(path,JSON.stringify(report,null,2)+"\n",{flag:"wx"});
    console.log(JSON.stringify({total:report.total,passed:report.passed,failed:report.failed}));
    for(const r of report.results.filter(r=>!r.pass)) console.error(`${r.id}: ${r.error.name}: ${r.error.message}`);
    if(report.failed) process.exitCode=1;
  }
}
