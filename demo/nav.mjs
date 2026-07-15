#!/usr/bin/env node
// Demo-only: inject a small nav strip into each staged demo page so a product's
// three documents (main · initiative · product map) reach one another, the two
// languages toggle, and the two demo products cross-link. Without it the product
// map is a dead end you could only reach by typing the URL. Not part of the
// plugin — the Pages deploy calls this on _site/.
//   node demo/nav.mjs <base-url-path> <site-dir>
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

// Each demo product and where it is staged. sub "" is the site root (the
// meeting-room demo); a non-empty sub nests the product (e.g. /flea/).
const PRODUCTS = [
  { sub: "", title: { ko: "회의실 예약", en: "Meeting booking" }, init: "notif" },
  { sub: "flea", title: { ko: "동네장터", en: "Neighborly" }, init: "escrow" },
];
const L = {
  ko: { main: "본편", init: "이니셔티브", map: "제품 지도", other: "EN" },
  en: { main: "Main", init: "Initiative", map: "Product map", other: "한국어" },
};
const PAGES = ["main", "init", "map"];

const root = (base, sub, lang) => `${base}${sub ? `/${sub}` : ""}${lang === "en" ? "/en" : ""}`;
const siteDir = (site, sub, lang) => `${site}${sub ? `/${sub}` : ""}${lang === "en" ? "/en" : ""}`;
const pageHref = (r, page, init) => page === "main" ? `${r}/` : page === "map" ? `${r}/map/` : `${r}/${init}/`;

export function navHtml(base, product, lang, current) {
  const w = L[lang];
  const r = root(base, product.sub, lang);
  const other = lang === "ko" ? "en" : "ko";
  const within = PAGES.map(p =>
    `<a href="${pageHref(r, p, product.init)}"${current === p ? ' class="on"' : ""}>${w[p]}</a>`).join("");
  const langToggle = `<a href="${pageHref(root(base, product.sub, other), current, product.init)}">${w.other}</a>`;
  const cross = PRODUCTS.filter(p => p.sub !== product.sub)
    .map(p => `<a class="demo-nav-alt" href="${root(base, p.sub, lang)}/">${p.title[lang]} →</a>`).join("");
  return `<div class="demo-nav">${within}<span class="demo-nav-sep"></span>${langToggle}${cross}</div>`;
}

// The viewer is a single file with an implicit body (no </body> tag), so the strip
// is appended — it is static markup and the render only touches #stage.
export function inject(file, base, product, lang, current) {
  const html = readFileSync(file, "utf8");
  if (html.includes('class="demo-nav"')) return;
  writeFileSync(file, `${html}\n${navHtml(base, product, lang, current)}\n`);
}

function main([base, site]) {
  // base may legitimately be "" (site hosted at the origin root).
  if (base === undefined || !site) { console.error("Usage: node demo/nav.mjs <base-url-path> <site-dir>"); process.exitCode = 2; return; }
  let count = 0;
  for (const product of PRODUCTS) {
    for (const lang of ["ko", "en"]) {
      const dir = siteDir(site, product.sub, lang);
      for (const page of PAGES) {
        const slug = page === "main" ? "" : page === "map" ? "map/" : `${product.init}/`;
        inject(`${dir}/${slug}index.html`, base, product, lang, page);
        count++;
      }
    }
  }
  console.log(`[nav] 데모 내비게이션 주입 완료 (${count} pages, ${PRODUCTS.length} products, base=${base})`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
