// Release holdout: different fixture family and lifecycle shapes from logic-matrix.mjs.
// No mocks, no product approval, no expectation inferred from the returned verdict.
import assert from "node:assert/strict";
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,readdirSync,renameSync,unlinkSync,rmSync,existsSync} from "node:fs";
import {tmpdir} from "node:os";
import {dirname,join,resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {createHash} from "node:crypto";
import {spawnSync} from "node:child_process";
import {planLifecycle} from "../../plugins/vibespec/skills/vibespec/scripts/lib/lifecycle-journal.mjs";
import {readLifecycle,runLifecycle,publishRecord} from "../../plugins/vibespec/skills/vibespec/scripts/lib/lifecycle-store.mjs";
import {sotDigest} from "../../plugins/vibespec/skills/vibespec/scripts/lib/c14n.mjs";
import {validateTree} from "../../plugins/vibespec/skills/vibespec/scripts/lib/tree.mjs";

const fixtures=new URL("../../plugins/vibespec/skills/vibespec/tests/fixtures/tree/",import.meta.url);
const readFixture=name=>JSON.parse(readFileSync(new URL(name,fixtures),"utf8"));
const cli=fileURLToPath(new URL("../../plugins/vibespec/skills/vibespec/scripts/lifecycle.mjs",import.meta.url));
const intent=kind=>({kind,reason:"Independent holdout transition"});
const save=(root,name,sot)=>{mkdirSync(dirname(join(root,name)),{recursive:true});writeFileSync(join(root,name),JSON.stringify(sot,null,2)+"\n");};
function tree(depth=1) {
  const docs=[{name:"main.sot.json",sot:readFixture("main.sot.json")}];
  const ids=["payment","refund","chargeback"];
  for(let i=0;i<depth;i++) {
    const sot=readFixture("shop.1-2.payment.sot.json"),parent=docs.at(-1);
    sot.title=["Payment","Refund","Chargeback"][i];
    sot.initiative.id=ids[i];sot.initiative.status="implemented";
    sot.initiative.path="1-2"+"-1".repeat(i);
    const scope=i?ids[i-1]:"root";
    sot.initiative.parent={scopeId:scope,canonicalization:"sot-c14n-v1",digest:sotDigest(parent.sot)};
    sot.ia.sections[0].boundary.scopeId=scope;
    sot.ia.sections[0].pages[0].boundary.scopeId=scope;
    sot.ia.sections[0].pages[0].title=i?"Pay":"Cart";
    docs.push({name:`initiatives/${ids[i]}.sot.json`,sot});
  }
  const valid=validateTree(docs);assert.equal(valid.valid,true,JSON.stringify(valid.errors));
  return docs;
}
function setup(root,depth=1) {for(const d of tree(depth)) save(root,d.name,d.sot);runLifecycle(root,intent("init"),{apply:true});}
function bytes(root) {
  const result={};
  const walk=(folder,prefix="")=>{for(const e of readdirSync(folder,{withFileTypes:true})) {
    const name=prefix+e.name,path=join(folder,e.name);
    if(e.isDirectory()) walk(path,name+"/");else result[name]=createHash("sha256").update(readFileSync(path)).digest("hex");
  }};walk(root);return result;
}
const document=(root,scope)=>readLifecycle(root).docs.find(d=>(d.sot.initiative?.id||"root")===scope);
function noApproval(report) {assert.equal(report.productApproval,"not-assessed");assert.ok(report.pendingReviews.every(t=>t.status==="pending"));}
function changeTitle(root,scope,text) {const d=document(root,scope);d.sot.title=text;save(root,d.name,d.sot);}

export function runHoldout() {
  const workspace=mkdtempSync(join(tmpdir(),"vibespec-holdout-")),results=[];
  const test=(id,expected,body)=>{
    const root=join(workspace,String(results.length+1));mkdirSync(root);const evidence={};
    try {body(root,evidence);results.push({id,expected,pass:true,evidence});}
    catch(error) {results.push({id,expected,pass:false,evidence,error:{name:error.name,message:error.message}});}
  };
  try {
    test("single-root-format-only","formatting and object-key order do not create drift or a new record",root=>{
      setup(root,0);const d=document(root,"root");
      writeFileSync(join(root,d.name),JSON.stringify(Object.fromEntries(Object.entries(d.sot).reverse())));
      const before=bytes(root),report=readLifecycle(root).report;assert.equal(report.status,"current");
      assert.equal(runLifecycle(root,intent("capture"),{apply:true}).noop,true);
      assert.deepEqual(bytes(root),before);assert.equal(readLifecycle(root).records.length,1);noApproval(report);
    });
    test("init-receipt-interruption","published enrollment recovers without rewriting source bytes",root=>{
      for(const d of tree(0)) save(root,d.name,d.sot);
      const state=readLifecycle(root),plan=planLifecycle([],state.docs,intent("init"));publishRecord(root,plan.record);
      const source=bytes(root)["main.sot.json"];assert.equal(readLifecycle(root).report.status,"pending-write");
      const result=runLifecycle(root,{kind:"recover"},{apply:true});assert.equal(result.status,"current");noApproval(result);
      assert.equal(bytes(root)["main.sot.json"],source);assert.equal(readLifecycle(root).records.length,1);
    });
    test("new-scope-capture-interruption","an interrupted capture with an added file completes only its receipt",root=>{
      setup(root,0);const added=tree(1)[1];save(root,added.name,added.sot);
      const state=readLifecycle(root);publishRecord(root,planLifecycle(state.records,state.docs,intent("capture"),{headComplete:true}).record);
      assert.equal(readLifecycle(root).report.status,"pending-write");const source=bytes(root)[added.name];
      assert.equal(runLifecycle(root,{kind:"recover"},{apply:true}).status,"current");
      assert.equal(bytes(root)[added.name],source);assert.equal(readLifecycle(root).records.length,2);
    });
    test("rename-visible-in-handoff","a captured filename move is visible in change history without retiring the stable scope",(root,evidence)=>{
      setup(root);mkdirSync(join(root,"initiatives/archive"));
      renameSync(join(root,"initiatives/payment.sot.json"),join(root,"initiatives/archive/payment.sot.json"));
      assert.equal(readLifecycle(root).report.status,"external-drift");
      const report=runLifecycle(root,intent("capture"),{apply:true});
      evidence.changes=report.history.at(-1).changes;evidence.reviewCount=report.pendingReviews.filter(t=>t.sequence===2).length;
      assert.equal(report.status,"current");assert.equal(report.retired.length,0);noApproval(report);
      assert.ok(report.history.at(-1).changes.some(c=>c.scope==="payment"&&c.file==="initiatives/archive/payment.sot.json"),"file-only changes must not disappear from handoff history");
    });
    test("retire-whole-scope","removing a leaf retires its local IDs and rejects its reintroduction",root=>{
      setup(root);const removed=document(root,"payment");unlinkSync(join(root,removed.name));
      const report=runLifecycle(root,intent("capture"),{apply:true});assert.equal(report.status,"current");
      assert.ok(report.retired.some(r=>r.id==="payment/F1"));
      save(root,removed.name,removed.sot);const before=bytes(root);
      assert.throws(()=>runLifecycle(root,intent("capture"),{apply:true}),/retired ID/);assert.deepEqual(bytes(root),before);
    });
    test("removed-parent-diagnostic","a dangling child produces an explicit tree diagnostic or controlled refusal, not an internal TypeError",(root,evidence)=>{
      setup(root,2);unlinkSync(join(root,"initiatives/payment.sot.json"));const before=bytes(root);
      const state=readLifecycle(root);assert.equal(state.report.tree.valid,false);
      try {
        const report=runLifecycle(root,intent("capture"),{apply:true});
        evidence.outcome="captured-invalid-tree";assert.equal(report.tree.valid,false);noApproval(report);
      } catch(error) {
        evidence.outcome="refused";evidence.errorName=error.name;evidence.message=error.message;
        assert.deepEqual(bytes(root),before,"refusal must preserve source and history bytes");
        assert.notEqual(error.name,"TypeError","missing parent must not dereference an absent SOT");
        assert.match(error.message,/parent|scope|tree/i);
      }
    });
    test("deep-ancestor-impact","a root change reaches three descendants without marking their own unchanged checks stale",root=>{
      setup(root,3);changeTitle(root,"root","Shop revised");
      const report=runLifecycle(root,intent("capture"),{apply:true});
      const impacts=report.pendingReviews.filter(t=>t.sequence===2&&t.type==="parent-change");
      assert.deepEqual(impacts.map(t=>t.scope).sort(),["chargeback","payment","refund"]);
      assert.ok(impacts.every(t=>t.parentScope==="root"&&!t.stale));
      assert.ok(report.historicalChecks.filter(c=>c.sequence===1&&c.scope!=="root").every(c=>!c.stale));noApproval(report);
    });
    // Three independently written descendants, across a four-document dependency chain.
    for(const pattern of ["BBB","BBA","BAB","BAA","ABB","ABA","AAB","AAA"]) {
      test(`deep-rebase-recovery-${pattern}`,"all known partial writes recover top-to-bottom and preserve pending reviews",root=>{
        setup(root,3);changeTitle(root,"root","Shop revised");runLifecycle(root,intent("capture"),{apply:true});
        const state=readLifecycle(root),planned=planLifecycle(state.records,state.docs,intent("rebase"));
        publishRecord(root,planned.record);
        for(const [i,scope] of ["payment","refund","chargeback"].entries()) {
          const before=planned.record.before.find(d=>d.sot.initiative?.id===scope),after=planned.record.after.find(d=>d.sot.initiative?.id===scope);
          assert.notDeepEqual(before.sot,after.sot);const d=pattern[i]==="B"?before:after;save(root,d.name,d.sot);
        }
        assert.equal(readLifecycle(root).report.status,"pending-write");
        const report=runLifecycle(root,{kind:"recover"},{apply:true});assert.equal(report.status,"current");
        assert.equal(report.tree.valid,true);assert.deepEqual(readLifecycle(root).docs,planned.record.after);noApproval(report);
        const once=bytes(root);runLifecycle(root,{kind:"recover"},{apply:true});assert.deepEqual(bytes(root),once);
      });
    }
    test("successive-sibling-merges","two sibling merges allocate distinct root IDs and retain both sets of manual review",root=>{
      setup(root);const sibling=document(root,"payment");sibling.name="initiatives/alternate.sot.json";
      sibling.sot.initiative.id="alternate";sibling.sot.initiative.path="1-3";save(root,sibling.name,sibling.sot);
      runLifecycle(root,intent("capture"),{apply:true});
      const first=runLifecycle(root,{...intent("merge"),initiative:"payment"},{apply:true});
      const second=runLifecycle(root,{...intent("merge"),initiative:"alternate"},{apply:true});
      const features=document(root,"root").sot.requirements.flatMap(r=>r.features.map(f=>f.id));
      assert.deepEqual(features,["F1","F2","F3"]);assert.ok(second.pendingReviews.length>first.pendingReviews.length);
      assert.ok(second.pendingReviews.some(t=>t.sequence===3&&t.type==="merge-prd"));
      assert.ok(second.pendingReviews.some(t=>t.sequence===4&&t.type==="merge-prd"));noApproval(second);
    });
    test("many-captures-and-noops","20 distinct edits remain sequential and ten no-ops add no history",(root,evidence)=>{
      setup(root,0);
      for(let i=1;i<=20;i++) {changeTitle(root,"root",`Shop revision ${i}`);runLifecycle(root,intent("capture"),{apply:true});}
      const before=bytes(root);
      for(let i=0;i<10;i++) assert.equal(runLifecycle(root,intent("capture"),{apply:true}).noop,true);
      assert.deepEqual(bytes(root),before);const state=readLifecycle(root);
      assert.equal(state.records.length,21);assert.equal(state.report.historicalChecks.filter(c=>c.stale).length,20);
      assert.equal(state.report.pendingReviews.length,21);evidence.records=21;evidence.pendingReviews=21;noApproval(state.report);
    });
    test("unicode-workspace-cli","CLI operates in a Unicode and spaced folder with an unchanged source",(root,evidence)=>{
      const target=join(root,"기획 검증 공간");mkdirSync(target);setup(target,0);const before=bytes(target);
      const run=spawnSync(process.execPath,[cli,target,"status","--json"],{encoding:"utf8"});
      assert.equal(run.status,0,run.stderr);const report=JSON.parse(run.stdout);assert.equal(report.status,"current");
      assert.deepEqual(bytes(target),before);noApproval(report);evidence.cliExitCode=run.status;
    });
    return {scope:"shop-tree lifecycle release holdout",productApproval:"not-assessed",total:results.length,
      passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass).length,results};
  } finally {rmSync(workspace,{recursive:true,force:true});}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  if(process.argv.length!==4||process.argv[2]!=="--write") throw new Error("Usage: node evaluation/lifecycle/holdout.mjs --write <new-report.json>");
  const path=resolve(process.argv[3]);if(existsSync(path)) throw new Error("Report already exists");
  const report=runHoldout();writeFileSync(path,JSON.stringify(report,null,2)+"\n",{flag:"wx"});
  console.log(JSON.stringify({total:report.total,passed:report.passed,failed:report.failed}));
  for(const r of report.results.filter(r=>!r.pass)) console.error(`${r.id}: ${r.error.name}: ${r.error.message}`);
  if(report.failed) process.exitCode=1;
}
