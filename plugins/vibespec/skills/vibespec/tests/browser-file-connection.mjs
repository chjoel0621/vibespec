import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const viewer = join(here, "..", "assets", "viewer.html");
const fixture = join(here, "fixtures", "valid-minimal.sot.json");

function findBrowser() {
  const roots = [process.env.PROGRAMFILES, process.env["PROGRAMFILES(X86)"], process.env.LOCALAPPDATA].filter(Boolean);
  const candidates = [
    ...roots.flatMap(root => [join(root, "Google", "Chrome", "Application", "chrome.exe"), join(root, "Microsoft", "Edge", "Application", "msedge.exe")]),
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/microsoft-edge"
  ];
  return candidates.find(existsSync);
}

const browserPath = findBrowser();
assert.ok(browserPath, "Chrome or Edge is required for the file-connection browser regression test");
assert.ok(existsSync(viewer), "built viewer.html is missing; run npm run build first");

const workspace = mkdtempSync(join(tmpdir(), "vibespec-file-connection-"));
const initial = readFileSync(fixture, "utf8");
const embedded = initial.replace(/</g, "\\u003c");
const shim = `<script>
try{Object.defineProperty(window,"isSecureContext",{value:true,configurable:true});}catch(_){}
const __connectedFile={name:"connected.sot.json",text:${JSON.stringify(initial)},writes:0};
const __connectedHandle={
  get name(){return __connectedFile.name;},
  queryPermission:async()=>"granted", requestPermission:async()=>"granted",
  getFile:async()=>({name:__connectedFile.name,text:async()=>__connectedFile.text}),
  createWritable:async()=>({write:async text=>{__connectedFile.text=text;__connectedFile.writes++;},close:async()=>{},abort:async()=>{}})
};
window.showSaveFilePicker=async()=>__connectedHandle;
window.showOpenFilePicker=async()=>[__connectedHandle];
window.confirm=()=>true;
</script>`;
const source = readFileSync(viewer, "utf8")
  .replace('<script type="application/json" id="embedded-sot"></script>', `${shim}<script type="application/json" id="embedded-sot">${embedded}</script>`);
const harness = `<script>
(async()=>{
  fileMenuBtn.click();
  const fileMenuOpens=!fileMenuPanel.hidden;
  document.body.click();
  const fileMenuCloses=fileMenuPanel.hidden;
  // A viewer may reopen with a persisted handle while its embedded SOT is
  // stale. Save must reload that file first, never overwrite it.
  const recovered=JSON.parse(__connectedFile.text); recovered.title="Recovered from existing file"; __connectedFile.text=JSON.stringify(recovered,null,2);
  CONNECTED_FILE_HANDLE=__connectedHandle; CONNECTED_FILE_SIGNATURE=""; CONNECTED_FILE_RESTORE_PENDING=true;
  await saveCurrentSot();
  const restoredTitle=SOT.title;
  const restoredHistoryLength=HISTORY.length;
  const writesAfterRestore=__connectedFile.writes;
  await saveCurrentSot();
  const firstWrite=JSON.parse(__connectedFile.text);
  SOT.title="Saved through handle";
  await saveCurrentSot();
  const secondWrite=JSON.parse(__connectedFile.text);
  const external=JSON.parse(__connectedFile.text); external.title="Changed by AI"; __connectedFile.text=JSON.stringify(external,null,2);
  await reloadConnectedSot();
  const reloaded=SOT.title;
  SOT.title="Viewer-only change";
  const beforeConflict=__connectedFile.text;
  const externalAgain=JSON.parse(__connectedFile.text); externalAgain.title="Changed again by AI"; __connectedFile.text=JSON.stringify(externalAgain);
  window.confirm=()=>false;
  await saveCurrentSot();
  const result={
    fileMenuOpens,
    fileMenuCloses,
    restoredTitle,
    restoredHistoryLength,
    writesAfterRestore,
    firstSchema:firstWrite.schemaVersion,
    secondTitle:secondWrite.title,
    reloaded,
    conflictPreserved:beforeConflict!==__connectedFile.text,
    finalTitle:JSON.parse(__connectedFile.text).title,
    writes:__connectedFile.writes,
    status:document.getElementById("fileStatus").textContent
  };
  document.documentElement.setAttribute("data-file-connection",encodeURIComponent(JSON.stringify(result)));
})();
</script>`;
const testPage = join(workspace, "file-connection.html");
writeFileSync(testPage, source + harness);

try {
  const result = spawnSync(browserPath, [
    "--headless=new", "--allow-file-access-from-files", "--no-sandbox",
    "--disable-background-networking", "--disable-component-update", "--disable-default-apps",
    "--disable-extensions", "--disable-gpu", "--disable-sync", "--no-first-run", "--no-default-browser-check",
    `--user-data-dir=${join(workspace, "profile")}`, "--virtual-time-budget=1500", "--dump-dom", pathToFileURL(testPage).href
  ], {encoding:"utf8", timeout:60000, maxBuffer:12*1024*1024});
  assert.equal(result.status, 0, `headless browser failed: ${result.stderr || result.error || "unknown error"}`);
  const match = result.stdout.match(/data-file-connection="([^"]+)"/);
  assert.ok(match, "browser did not emit file-connection results");
  const measured = JSON.parse(decodeURIComponent(match[1]));
  assert.equal(measured.fileMenuOpens, true, "file actions must open from the compact toolbar menu");
  assert.equal(measured.fileMenuCloses, true, "the compact file menu must close when focus moves outside it");
  assert.equal(measured.restoredTitle, "Recovered from existing file", "a recovered handle must reload the source SOT before any write");
  assert.equal(measured.restoredHistoryLength, 1, "connecting another SOT must replace, not mix, viewer history");
  assert.equal(measured.writesAfterRestore, 0, "the safety reload for a recovered handle must not write the stale viewer state");
  assert.equal(measured.firstSchema, "1.0", "first connected save must keep schemaVersion");
  assert.equal(measured.secondTitle, "Saved through handle", "second save must overwrite the connected file without another picker");
  assert.equal(measured.reloaded, "Changed by AI", "reload must read external file changes");
  assert.equal(measured.finalTitle, "Changed again by AI", "declining an external-change overwrite must preserve the AI edit");
  assert.equal(measured.writes, 2, "first and second saves must be the only writes");
  assert.match(measured.status, /외부 변경 감지|External change detected/, "conflict must be visible to the user");
  console.log("[browser] PASS File System Access save, reload, and external-change protection");
} finally {
  try { rmSync(workspace, {recursive:true, force:true}); } catch {}
}
