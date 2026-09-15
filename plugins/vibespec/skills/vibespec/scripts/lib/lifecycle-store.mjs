// Local opt-in journal storage. A completion receipt means file writes finished,
// never that content was reviewed. Incomplete intents are recoverable evidence.
import { existsSync,lstatSync,mkdirSync,readdirSync,readFileSync,writeFileSync,renameSync,linkSync,unlinkSync,rmdirSync } from "node:fs";
import { resolve,join,relative,dirname,basename } from "node:path";
import { hostname } from "node:os";
import { randomUUID } from "node:crypto";
import { sotDigest,stableStringify } from "./c14n.mjs";
import { normalizeDocuments,verifyJournal,inspectLifecycle,planLifecycle } from "./lifecycle-journal.mjs";

const base="history/lifecycle";
const fail=message=>{throw new Error(message);};
const sequenceFile=n=>String(n).padStart(8,"0")+".json";
const readJson=path=>JSON.parse(readFileSync(path,"utf8"));

// Check every existing component before using it, including junctions on Windows.
function safePath(root,name) {
  const fullRoot=resolve(root);
  if(typeof name!=="string"||name.includes("\\")||name.split("/").some(p=>!p||p==="."||p===".."||p.includes(":"))) fail("unsafe workspace path");
  let current=fullRoot;
  for(const part of ["",...name.split("/")]) {
    if(part) current=join(current,part);
    try {if(lstatSync(current).isSymbolicLink()) fail("symlinked workspace paths are not supported");}
    catch(error) {if(error.code!=="ENOENT") throw error;}
  }
  return current;
}
function ensureDirectory(root,name) {
  const path=safePath(root,name);mkdirSync(path,{recursive:true});safePath(root,name);return path;
}
function documentsAt(root) {
  const names=["main.sot.json"],folder=safePath(root,"initiatives");
  const walk=dir=>{
    for(const entry of readdirSync(dir,{withFileTypes:true})) {
      const name=relative(resolve(root),join(dir,entry.name)).replaceAll("\\","/");
      const path=safePath(root,name);
      if(entry.isDirectory()) walk(path);
      else if(entry.isFile()&&entry.name.endsWith(".sot.json")) names.push(name);
    }
  };
  if(existsSync(folder)) walk(folder);
  return normalizeDocuments(names.map(name=>({name,sot:readJson(safePath(root,name))})));
}
function recordsAt(root) {
  const directory=safePath(root,base+"/records");
  const entries=existsSync(directory)?readdirSync(directory).filter(n=>!n.startsWith(".pending-")):[];
  if(entries.some(n=>!/^\d{8}\.json$/.test(n))) fail("unknown journal entry");
  const names=entries.sort();
  for(let i=0;i<names.length;i++) if(names[i]!==sequenceFile(i+1)) fail("journal sequence gap");
  const records=names.map(n=>readJson(safePath(root,base+"/records/"+n)));
  const receipts=safePath(root,base+"/completed");
  const receiptNames=existsSync(receipts)?readdirSync(receipts).filter(n=>!n.startsWith(".pending-")):[];
  if(receiptNames.some(n=>!/^\d{8}\.json$/.test(n)||!names.includes(n))) fail("missing journal history or orphan completion receipt");
  verifyJournal(records);return records;
}
function completed(root,record) {
  const path=safePath(root,base+"/completed/"+sequenceFile(record.sequence));
  if(!existsSync(path)) return false;
  const receipt=readJson(path);
  if(receipt.kind!=="lifecycle-write-complete-v1"||receipt.recordDigest!==record.digest) fail("completion receipt mismatch");
  return true;
}
export function readLifecycle(root,options={}) {
  const docs=documentsAt(root),records=recordsAt(root);
  for(const r of records.slice(0,-1)) if(!completed(root,r)) fail("incomplete earlier transaction");
  const report=inspectLifecycle(records,docs,options),head=records.at(-1);
  const done=!head||completed(root,head);
  report.transaction=done?"complete":"pending";
  if(!done&&report.status==="current") report.status="pending-write";
  if(done&&report.status==="pending-write") report.status="external-drift";
  return {docs,records,report};
}
function immutableJson(root,name,value) {
  ensureDirectory(root,name.slice(0,name.lastIndexOf("/")));
  const target=safePath(root,name),temporary=join(dirname(target),".pending-"+randomUUID());
  writeFileSync(temporary,JSON.stringify(value,null,2)+"\n",{flag:"wx"});
  try {linkSync(temporary,target);} finally {unlinkSync(temporary);}
}
export function publishRecord(root,record) {
  const records=recordsAt(root);
  if(records.at(-1)&&!completed(root,records.at(-1))) fail("pending transaction must complete before another record");
  verifyJournal([...records,record]);
  immutableJson(root,base+"/records/"+sequenceFile(record.sequence),record);
}
function complete(root,record) {
  if(completed(root,record)) return;
  immutableJson(root,base+"/completed/"+sequenceFile(record.sequence),{kind:"lifecycle-write-complete-v1",recordDigest:record.digest});
}
export function withLifecycleLock(root,operation) {
  ensureDirectory(root,base);
  const lock=safePath(root,base+"/write.lock");
  try {mkdirSync(lock);} catch(error) {if(error.code==="EEXIST") fail("journal is locked; a crashed owner needs explicit unlock");throw error;}
  const owner={pid:process.pid,host:hostname(),token:randomUUID()};
  const path=join(lock,"owner.json");writeFileSync(path,JSON.stringify(owner),{flag:"wx"});
  try {return operation();} finally {
    if(readJson(path).token!==owner.token) fail("lock ownership changed; refusing cleanup");
    unlinkSync(path);rmdirSync(lock);
  }
}
function unlock(root,apply) {
  const lock=safePath(root,base+"/write.lock");
  if(!existsSync(lock)) return {status:"unlocked",changed:false};
  const owner=readJson(safePath(root,base+"/write.lock/owner.json"));
  if(owner.host!==hostname()||!Number.isSafeInteger(owner.pid)||owner.pid<=0) fail("foreign or invalid lock owner; manual investigation required");
  try {process.kill(owner.pid,0);fail("lock owner is still running");}
  catch(error) {if(error.code!=="ESRCH") throw error;}
  if(apply) {unlinkSync(join(lock,"owner.json"));rmdirSync(lock);}
  return {status:apply?"unlocked":"dry-run",changed:apply};
}
function finishWrites(root,record) {
  const state=readLifecycle(root);
  if(state.report.status==="external-drift") fail("external drift: recovery refuses unrecognized contents");
  for(const doc of record.after) {
    const path=safePath(root,doc.name),actual=readJson(path),target=sotDigest(doc.sot);
    if(sotDigest(actual)===target) continue;
    const old=record.before.find(d=>d.name===doc.name);
    if(!old||sotDigest(actual)!==sotDigest(old.sot)) fail("source changed during write; recovery required");
    const temporary=join(dirname(path),"."+basename(path)+"."+randomUUID()+".tmp");
    writeFileSync(temporary,stableStringify(doc.sot)+"\n",{flag:"wx"});
    try {
      if(sotDigest(readJson(safePath(root,doc.name)))!==sotDigest(actual)) fail("source changed during write; recovery required");
      renameSync(temporary,path);
    } finally {if(existsSync(temporary)) unlinkSync(temporary);}
  }
  const after=documentsAt(root);
  if(sotDigest(after)!==sotDigest(record.after)) fail("workspace changed during write; recovery required");
  complete(root,record);
}

export function runLifecycle(root,intent,{apply=false}={}) {
  if(intent.kind==="unlock") return unlock(root,apply);
  const execute=()=>{
    const state=readLifecycle(root);
    if(intent.kind==="recover") {
      if(!state.records.length) fail("workspace is not enrolled");
      if(state.report.status==="external-drift") fail("external drift: recovery refuses unrecognized contents");
      if(apply) finishWrites(root,state.records.at(-1));
      return apply?readLifecycle(root).report:{...state.report,dryRun:true};
    }
    if(state.report.transaction==="pending") fail("pending transaction requires recovery before new changes");
    const plan=planLifecycle(state.records,state.docs,intent,{headComplete:state.report.transaction==="complete"});
    if(plan.noop) return {...state.report,noop:true};
    if(!apply) return {status:"dry-run",productApproval:"not-assessed",record:plan.record};
    publishRecord(root,plan.record);
    if(["init","capture"].includes(intent.kind)) {
      if(sotDigest(documentsAt(root))!==sotDigest(plan.record.after)) fail("workspace changed during capture; recovery required");
      complete(root,plan.record);
    } else finishWrites(root,plan.record);
    return readLifecycle(root).report;
  };
  // Validate before creating any journal directory, including on an invalid request.
  if(!apply) return execute();
  readLifecycle(root);
  return withLifecycleLock(root,execute);
}
