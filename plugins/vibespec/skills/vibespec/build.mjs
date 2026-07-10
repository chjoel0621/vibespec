import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const SRC = join(here, "src");
const JS  = join(SRC, "js");

// assets/viewer.html is BUILT OUTPUT — edit src/ and run `npm run build`.
const OUTDIR = join(here, "assets");
const OUT = join(OUTDIR, "viewer.html");
const DBG = join(here, ".build");

const css  = readFileSync(join(SRC, "styles.css"), "utf8");
const head = readFileSync(join(SRC, "head.html"), "utf8");

// Plain scripts sharing one scope, concatenated in filename order. 90-init.js MUST be last.
const files = readdirSync(JS).filter(f => f.endsWith(".js")).sort();
const app = files.map(f => `/* ==== ${f} ==== */\n` + readFileSync(join(JS, f), "utf8")).join("\n\n");

if (!existsSync(DBG)) mkdirSync(DBG);
writeFileSync(join(DBG, "app.js"), app);          // for `node --check`
if (!existsSync(OUTDIR)) mkdirSync(OUTDIR);

const html =
`<!doctype html>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>VibeSpec</title>
<style>
${css}
</style>
${head}
<script type="application/json" id="embedded-sot"></script>
<script>
${app}
</script>
`;
writeFileSync(OUT, html);
console.log(`[build] modules (in order): ${files.join(", ")}`);
console.log(`[build] wrote ${OUT} (${Buffer.byteLength(html)} bytes)`);
console.log(`[build] syntax-check:  node --check .build/app.js`);
