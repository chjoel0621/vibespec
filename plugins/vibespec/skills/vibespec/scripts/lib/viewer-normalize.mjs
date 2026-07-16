// Load the viewer's normalize/schemaVersionFor functions instead of copying
// them. Legacy migration and browser Save must produce the same SOT bytes.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const here = dirname(fileURLToPath(import.meta.url));
const sourceRoot = join(here, "..", "..", "src", "js");
const source = ["00-config.js", "20-state.js"]
  .map(file => readFileSync(join(sourceRoot, file), "utf8"))
  .join("\n") + "\nthis.vibespecNormalize = input => { const value=normalize(structuredClone(input)); value.schemaVersion=schemaVersionFor(value); return value; };";
const context = { structuredClone };
vm.runInNewContext(source, context);

export function normalizeForMigration(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) throw new Error("SOT must be an object");
  if (input.schemaVersion && !["1.0", "1.1"].includes(input.schemaVersion)) {
    throw new Error("unsupported schemaVersion " + JSON.stringify(input.schemaVersion) + "; only legacy (omitted), 1.0, and 1.1 can be migrated");
  }
  const output = context.vibespecNormalize(input);
  if (input.schemaVersion && output.schemaVersion !== input.schemaVersion) {
    throw new Error("migration would change explicit schemaVersion " + JSON.stringify(input.schemaVersion) + " to " + JSON.stringify(output.schemaVersion) + "; repair the role metadata first");
  }
  return output;
}
