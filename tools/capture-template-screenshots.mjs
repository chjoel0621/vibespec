import { mkdir, readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/chjoe/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright');
const marketingRoot = 'C:/VibeSpec-Marketing';
const source = JSON.parse(await readFile(resolve(marketingRoot, 'content', 'templates.json'), 'utf8'));
const batch = JSON.parse(await readFile(resolve(marketingRoot, 'content', 'batch-templates.json'), 'utf8'));
const requestedSlugs = new Set(process.argv.slice(2));
const templates = [...source.templates, ...batch.templates]
  .filter((template) => template.published)
  .filter((template) => !requestedSlugs.size || requestedSlugs.has(template.slug));
if (requestedSlugs.size && templates.length !== requestedSlugs.size) {
  const found = new Set(templates.map((template) => template.slug));
  throw new Error(`Unknown template slug: ${[...requestedSlugs].filter((slug) => !found.has(slug)).join(', ')}`);
}

function viewFor(filename) {
  if (filename.includes('feature-spec') || filename.includes('-spec-')) return 'spec';
  if (filename.includes('requirements-tree') || filename.includes('-tree-')) return 'tree';
  if (filename.includes('information-architecture')) return 'ia';
  if (filename.includes('user-flow') || filename.includes('-flow-')) return 'flow';
  return 'prd';
}

const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 });

try {
  for (const template of templates) {
    for (const [lang, locale] of Object.entries(template.locales)) {
      const html = resolve(marketingRoot, 'content', 'systems', template.slug, 'downloads', basename(locale.htmlDownloadUrl));
      const output = resolve(marketingRoot, 'content', 'systems', template.slug, 'screenshots', 'publish');
      await mkdir(output, { recursive: true });
      await page.goto(pathToFileURL(html).href, { waitUntil: 'load' });
      for (const image of locale.images ?? []) {
        const view = viewFor(image.filename);
        await page.locator(`button[data-view="${view}"]`).click();
        await page.locator('#stage').waitFor({ state: 'visible' });
        await page.screenshot({ path: resolve(output, image.filename), fullPage: false });
      }
    }
  }
} finally {
  await browser.close();
}

console.log(`Captured ${templates.flatMap((template) => Object.values(template.locales)).reduce((count, locale) => count + (locale.images?.length ?? 0), 0)} screenshots.`);
