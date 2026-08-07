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

test('redacts every Windows user home on a line with multiple paths', () => {
  const findings = findPathLeaks(
    'README.md',
    path('C:', 'Users', 'alice', 'a') + '; ' + path('C:', 'Users', 'bob', 'b')
  );

  assert.equal(findings.length, 2);
  const formatted = findings.map(formatPathLeak).join('\n');
  assert.doesNotMatch(formatted, /alice|bob/);
  assert.equal((formatted.match(/<user>/g) ?? []).length, 2);

  const combined = formatPathLeak({
    file: 'README.md',
    line: 1,
    column: 1,
    rule: 'windows-user-home',
    match: path('C:', 'Users', 'alice', 'a') + '; ' + path('C:', 'Users', 'bob', 'b')
  });
  assert.doesNotMatch(combined, /alice|bob/);
  assert.equal((combined.match(/<user>/g) ?? []).length, 2);
});

test('detects a Windows path before a shell pipe and ignores regex syntax', () => {
  const shellCommand = path('C:', 'Users', 'alice', 'script.ps1') + ' | Select-Object Name';
  const findings = findPathLeaks('script.ps1', shellCommand);

  assert.equal(findings.length, 1);
  assert.equal(findings[0].match, path('C:', 'Users', 'alice', 'script.ps1'));
  assert.deepEqual(
    findPathLeaks('plan.md', '/Users/[^/]+/|/home/[^/]+/|[A-Za-z]:[/\\]VibeSpec)'),
    []
  );
});
