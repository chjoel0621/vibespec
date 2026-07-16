#!/usr/bin/env node
// Demo-only: inject a small nav strip into each staged demo page so a product's
// documents reach one another, the two languages toggle, and the two demo
// products cross-link. Without it a map is a dead end you could only reach by
// typing the URL. Not part of the plugin — the Pages deploy calls this on _site/.
//   node demo/nav.mjs <base-url-path> <site-dir>
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const L = {
  ko: { main: "본편", init: "이니셔티브", map: "제품 지도", release: "출시 지도", workspace: "작업공간", other: "EN" },
  en: { main: "Main", init: "Initiative", map: "Product map", release: "Release map", workspace: "Workspace", other: "한국어" },
};
// Each product declares its pages as [labelKey, urlSlug]. The meeting-room demo
// shows the basics (main · initiative · map); the flea demo is the workspace
// demo — it splits the release map from the workspace map (which also shows the
// proposed increment). sub "" is the site root; a non-empty sub nests (/flea/).
const PRODUCTS = [
  { sub: "", title: { ko: "회의실 예약", en: "Meeting booking" }, pages: [["main", ""], ["init", "notif/"], ["map", "map/"]] },
  { sub: "flea", title: { ko: "동네장터", en: "Neighborly" }, pages: [["main", ""], ["init", "escrow/"], ["release", "map/"], ["workspace", "workspace/"]] },
];

const productRoot = (base, sub, lang) => `${base}${sub ? `/${sub}` : ""}${lang === "en" ? "/en" : ""}`;
const siteDir = (site, sub, lang) => `${site}${sub ? `/${sub}` : ""}${lang === "en" ? "/en" : ""}`;

export function navHtml(base, product, lang, currentKey) {
  const w = L[lang];
  const r = productRoot(base, product.sub, lang);
  const other = lang === "ko" ? "en" : "ko";
  const within = product.pages.map(([key, slug]) =>
    `<a href="${r}/${slug}"${currentKey === key ? ' class="on"' : ""}>${w[key]}</a>`).join("");
  const currentSlug = product.pages.find(([key]) => key === currentKey)[1];
  const langToggle = `<a href="${productRoot(base, product.sub, other)}/${currentSlug}">${w.other}</a>`;
  const cross = PRODUCTS.filter(p => p.sub !== product.sub)
    .map(p => `<a class="demo-nav-alt" href="${productRoot(base, p.sub, lang)}/">${p.title[lang]} →</a>`).join("");
  return `<div class="demo-nav">${within}<span class="demo-nav-sep"></span>${langToggle}${cross}</div>`;
}

// The viewer is a single file with an implicit body (no </body> tag), so the strip
// is appended — it is static markup and the render only touches #stage.
export function inject(file, base, product, lang, currentKey) {
  const html = readFileSync(file, "utf8");
  if (html.includes('class="demo-nav"')) return;
  writeFileSync(file, `${html}\n${navHtml(base, product, lang, currentKey)}\n`);
}

function main([base, site]) {
  // base may legitimately be "" (site hosted at the origin root).
  if (base === undefined || !site) { console.error("Usage: node demo/nav.mjs <base-url-path> <site-dir>"); process.exitCode = 2; return; }
  let count = 0;
  for (const product of PRODUCTS) {
    for (const lang of ["ko", "en"]) {
      const dir = siteDir(site, product.sub, lang);
      for (const [key, slug] of product.pages) {
        inject(`${dir}/${slug}index.html`, base, product, lang, key);
        count++;
      }
    }
  }
  console.log(`[nav] 데모 내비게이션 주입 완료 (${count} pages, ${PRODUCTS.length} products, base=${base})`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
