import { resolve } from 'node:path';

export function resolveMarketingRoot(env = process.env) {
  const value = env.VIBESPEC_MARKETING_ROOT?.trim();
  if (!value) {
    throw new Error('VIBESPEC_MARKETING_ROOT is required. Set it to the marketing repository root.');
  }
  return resolve(value);
}

export async function loadChromium(importModule = (name) => import(name)) {
  try {
    const { chromium } = await importModule('playwright-core');
    return chromium;
  } catch (error) {
    throw new Error('playwright-core is required for screenshots. Run: npm --prefix tools install', { cause: error });
  }
}
