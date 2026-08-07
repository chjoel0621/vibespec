import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { loadChromium, resolveMarketingRoot } from '../lib/marketing-runtime.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const missingRootMessage = 'VIBESPEC_MARKETING_ROOT is required. Set it to the marketing repository root.';

function environmentWithoutMarketingRoot() {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key.toLowerCase() === 'vibespec_marketing_root') delete env[key];
  }
  return env;
}

function runNode(script, args = [], cwd = repoRoot) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd,
    encoding: 'utf8',
    env: environmentWithoutMarketingRoot(),
    timeout: 30_000
  });
}

async function createGeneratorFixture() {
  const root = await mkdtemp(join(tmpdir(), 'vibespec-generator-cli-'));
  const tools = join(root, 'tools');
  await mkdir(join(tools, 'lib'), { recursive: true });
  await mkdir(join(root, 'demo'), { recursive: true });
  await Promise.all([
    copyFile(resolve(repoRoot, 'tools/generate-template-batch.mjs'), join(tools, 'generate-template-batch.mjs')),
    copyFile(resolve(repoRoot, 'tools/deepen-sot.mjs'), join(tools, 'deepen-sot.mjs')),
    copyFile(resolve(repoRoot, 'tools/lib/marketing-runtime.mjs'), join(tools, 'lib/marketing-runtime.mjs'))
  ]);
  return { root, script: join(tools, 'generate-template-batch.mjs'), demo: join(root, 'demo') };
}

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

test('screenshot CLI reports a leak-safe missing-root error', () => {
  const result = runNode(resolve(repoRoot, 'tools/capture-template-screenshots.mjs'));

  assert.equal(result.status, 1);
  assert.equal(result.stderr.trim(), missingRootMessage);
  assert.equal(result.stdout, '');
});

test('generator validates non-SOT-only preconditions before writing demo files', async (t) => {
  const fixture = await createGeneratorFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  const result = runNode(fixture.script, ['visitor-management'], fixture.root);

  assert.equal(result.status, 1);
  assert.deepEqual(await readdir(fixture.demo), []);
  assert.equal(result.stderr.trim(), missingRootMessage);
});

test('generator SOT-only unknown slug fails before marketing-root validation without tracked demo writes', async (t) => {
  const fixture = await createGeneratorFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  const result = runNode(fixture.script, ['--sot-only', 'unknown-template-for-cli-test'], fixture.root);

  assert.equal(result.status, 1);
  assert.deepEqual(await readdir(fixture.demo), []);
  assert.equal(result.stderr.trim(), 'Unknown template slug: unknown-template-for-cli-test');
});
