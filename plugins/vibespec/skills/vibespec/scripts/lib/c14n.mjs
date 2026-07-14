// Node-side gateway to the SINGLE canonicalization source (src/js/05-c14n.js).
// Never reimplement stableStringify here — vm-load the viewer source so the
// browser bundle and Node tools cannot drift apart.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import vm from "node:vm";

const source = readFileSync(new URL("../../src/js/05-c14n.js", import.meta.url), "utf8");
const sandbox = {};
vm.runInNewContext(source, sandbox);

export const SOT_C14N_V1 = sandbox.SOT_C14N_V1;
export const stableStringify = sandbox.stableStringify;

// Digest per the roadmap contract: SHA-256 over the UTF-8 bytes of the
// canonical JSON — no BOM, no trailing newline. Input object is not mutated.
export function sotDigest(sot) {
  return "sha256:" + createHash("sha256").update(Buffer.from(stableStringify(sot), "utf8")).digest("hex");
}
