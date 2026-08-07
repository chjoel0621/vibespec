import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import {
  findPathLeaks,
  formatPathLeak,
  scanTrackedFiles
} from '../lib/path-leak.mjs';

const execFileAsync = promisify(execFile);
const path = (...parts) => parts.join('/');

test('detects Windows, macOS, Linux, and known local roots', () => {
  const samples = [
    path('C:', 'Users', 'alice', 'work', 'file.json'),
    path('', 'Users', 'alice', 'work', 'file.json'),
    path('', 'home', 'alice', 'work', 'file.json'),
    path('C:', 'VibeSpec-Marketing', 'content', 'file.json')
  ];
  for (const sample of samples) {
    assert.equal(findPathLeaks('sample.txt', sample).length, 1, sample);
  }
});

test('allows placeholders and public repository URLs', () => {
  const safe = [
    '<repo-root>/plugins/vibespec',
    '<marketing-root>/content/templates.json',
    'https://github.com/chjoel0621/vibespec'
  ].join('\n');
  assert.deepEqual(findPathLeaks('README.md', safe), []);
});

test('scans tracked files and ignores untracked files', async () => {
  const repoRoot = await mkdtemp(join(tmpdir(), 'path-leak-'));
  const trackedFile = join(repoRoot, 'README.md');
  const untrackedFile = join(repoRoot, 'untracked.txt');
  await writeFile(trackedFile, 'repository documentation\n');
  await writeFile(untrackedFile, path('C:', 'Users', 'fixture-user', 'private.txt'));
  await execFileAsync('git', ['init', '-q'], { cwd: repoRoot });
  await execFileAsync('git', ['add', 'README.md'], { cwd: repoRoot });
  await execFileAsync('git', [
    '-c', 'user.name=Path Leak Test',
    '-c', 'user.email=path-leak@example.test',
    'commit', '-qm', 'add safe file'
  ], { cwd: repoRoot });

  assert.deepEqual(await scanTrackedFiles(repoRoot), []);
});

test('redacts personal usernames when formatting findings', () => {
  const finding = findPathLeaks(
    'README.md',
    path('C:', 'Users', 'fixture-user', 'work', 'file.json')
  )[0];

  const formatted = formatPathLeak(finding);
  assert.match(formatted, /<user>/);
  assert.doesNotMatch(formatted, /fixture-user/);
});
