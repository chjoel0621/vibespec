#!/usr/bin/env node
// Demo-only: inject a small nav strip into the staged demo pages so the three
// documents (main · initiative · product map) are reachable from one another.
// The product map is otherwise a dead end you can only reach by typing the URL.
// Not part of the plugin — the Pages deploy calls this on _site/.
//   node demo/nav.mjs <base-url-path> <site-dir>
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const L = {
  ko: { main: "본편", notif: "이니셔티브", map: "제품 지도", other: "EN" },
  en: { main: "Main", notif: "Initiative", map: "Product map", other: "한국어" },
};

export function navHtml(base, lang, current) {
  const w = L[lang];
  const root = lang === "ko" ? base : `${base}/en`;
  const alt = lang === "ko" ? `${base}/en/` : `${base}/`;
  const link = (href, key) =>
    `<a href="${href}"${current === key ? ' class="on"' : ""}>${w[key]}</a>`;
  return `<div class="demo-nav">${link(`${root}/`, "main")}${link(`${root}/notif/`, "notif")}${link(`${root}/map/`, "map")}<a href="${alt}">${w.other}</a></div>`;
}

// The viewer is a single file with an implicit body (no </body> tag), so the strip
// is appended — it is static markup and the render only touches #stage.
export function inject(file, base, lang, current) {
  const html = readFileSync(file, "utf8");
  if (html.includes('class="demo-nav"')) return;
  writeFileSync(file, `${html}\n${navHtml(base, lang, current)}\n`);
}

function main([base, site]) {
  // base may legitimately be "" (site hosted at the origin root).
  if (base === undefined || !site) { console.error("Usage: node demo/nav.mjs <base-url-path> <site-dir>"); process.exitCode = 2; return; }
  for (const lang of ["ko", "en"]) {
    const dir = lang === "ko" ? site : `${site}/en`;
    for (const page of ["main", "notif", "map"]) {
      inject(`${dir}/${page === "main" ? "" : `${page}/`}index.html`, base, lang, page);
    }
  }
  console.log(`[nav] 데모 내비게이션 주입 완료 (6 pages, base=${base})`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
