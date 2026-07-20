import { readFile } from 'node:fs/promises';

const files = process.argv.slice(2);
if (!files.length) {
  console.error('Usage: node tools/validate-template-depth.mjs <sot.json> [...]');
  process.exit(2);
}

let failed = 0;
for (const file of files) {
  const sot = JSON.parse(await readFile(file, 'utf8'));
  const features = sot.requirements.flatMap((requirement) => requirement.features ?? []);
  const specs = features.flatMap((feature) => feature.specs ?? []);
  const pages = sot.ia.sections.flatMap((section) => section.pages ?? []);
  const checks = {
    requirements: (sot.requirements?.length ?? 0) >= 6,
    features: features.length >= 12,
    specifications: specs.length >= 24,
    personas: (sot.prd?.targets?.length ?? 0) >= 3,
    scenarios: (sot.prd?.scenarios?.length ?? 0) >= 4,
    kpis: (sot.prd?.kpis?.length ?? 0) >= 3,
    pages: pages.length >= 8,
    flows: (sot.flow?.transitions?.length ?? 0) >= 10,
  };
  const missing = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
  if (missing.length) {
    failed += 1;
    console.error(`[DEPTH FAIL] ${file}: ${missing.join(', ')}`);
  } else {
    console.log(`[DEPTH PASS] ${file}`);
  }
}
if (failed) process.exit(1);
