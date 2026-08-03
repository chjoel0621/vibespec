import { readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deepenSot } from './deepen-sot.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const demoRoot = resolve(repoRoot, 'demo');
const protectedPrefixes = ['crm.', 'flea-market.', 'meeting-room-booking.'];
const consumerSlugs = new Set([
  'personal-finance-tracker',
  'habit-tracker-app',
  'meal-planning-grocery-app',
  'workout-progress-tracker'
]);
const marketplaceSlugs = new Set(['job-board-platform']);

const profileFor = (name) => {
  const slug = name.replace(/\.(ko|en)\.sot\.json$/, '');
  if (marketplaceSlugs.has(slug)) return 'marketplace';
  if (consumerSlugs.has(slug)) return 'consumer';
  return 'operations';
};

const files = (await readdir(demoRoot))
  .filter((name) => name.endsWith('.sot.json'))
  .filter((name) => !protectedPrefixes.some((prefix) => name.startsWith(prefix)))
  .sort();

let updated = 0;
for (const name of files) {
  const file = resolve(demoRoot, name);
  const sot = JSON.parse(await readFile(file, 'utf8'));
  const features = (sot.requirements ?? []).flatMap((requirement) => requirement.features ?? []);
  const specs = features.flatMap((feature) => feature.specs ?? []);
  const isTemplate = sot.schemaVersion === '1.0' && !sot.initiative && features.length === 12 && specs.length === 24;
  if (!isTemplate) continue;
  const next = deepenSot(sot, { profile: profileFor(name), iaOnly: true });
  await writeFile(file, JSON.stringify(next, null, 2) + '\n');
  updated += 1;
}

console.log(`[catalog] refreshed task-derived IA in ${updated} template SOT files`);
