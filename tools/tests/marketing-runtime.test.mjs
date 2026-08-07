import assert from 'node:assert/strict';
import test from 'node:test';
import { loadChromium, resolveMarketingRoot } from '../lib/marketing-runtime.mjs';

test('requires VIBESPEC_MARKETING_ROOT', () => {
  assert.throws(() => resolveMarketingRoot({}), /VIBESPEC_MARKETING_ROOT/);
});

test('resolves the supplied marketing root', () => {
  assert.equal(resolveMarketingRoot({ VIBESPEC_MARKETING_ROOT: 'marketing-fixture' }).endsWith('marketing-fixture'), true);
});

test('reports how to install playwright-core', async () => {
  await assert.rejects(
    loadChromium(async () => { throw new Error('missing'); }),
    /npm --prefix tools install/
  );
});

test('returns chromium from the injected module', async () => {
  const chromium = { launch() {} };
  assert.equal(await loadChromium(async () => ({ chromium })), chromium);
});
