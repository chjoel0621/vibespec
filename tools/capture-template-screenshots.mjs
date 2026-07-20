import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/chjoe/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright');
const marketingRoot = 'C:/VibeSpec-Marketing';
const systems = ['leave-attendance', 'recruitment-ats', 'procurement-request', 'vendor-management', 'electronic-approval', 'knowledge-base', 'learning-management', 'vehicle-reservation', 'parking-management', 'event-registration'];
const views = ['prd', 'spec', 'flow'];

const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 });

try {
  for (const slug of systems) {
    for (const lang of ['ko', 'en']) {
      const html = resolve(marketingRoot, 'content', 'systems', slug, 'downloads', `${slug}-prd-template-${lang}.html`);
      const output = resolve(marketingRoot, 'content', 'systems', slug, 'screenshots', 'publish');
      await mkdir(output, { recursive: true });
      await page.goto(pathToFileURL(html).href, { waitUntil: 'load' });
      for (const view of views) {
        await page.locator(`button[data-view="${view}"]`).click();
        await page.locator('#stage').waitFor({ state: 'visible' });
        await page.screenshot({ path: resolve(output, `${slug}-${view}-${lang}.png`), fullPage: false });
      }
    }
  }
} finally {
  await browser.close();
}

console.log(`Captured ${systems.length * 2 * views.length} screenshots.`);
