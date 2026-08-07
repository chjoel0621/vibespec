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

test('detects case variants and escaped Windows separators', () => {
  const slash = '\\';
  const escapedSlash = slash.repeat(2);
  const samples = [
    {
      text: ['c:', 'uSeRs', 'fixture-user', 'work', 'file.json'].join(slash),
      rule: 'windows-user-home'
    },
    {
      text: ['D:', 'USERS', 'fixture-user', 'work', 'file.json'].join(escapedSlash),
      rule: 'windows-user-home'
    },
    {
      text: ['e:', 'vIbEsPeC', 'tools', 'file.mjs'].join(escapedSlash),
      rule: 'known-vibespec-root'
    },
    {
      text: ['F:', 'vibespec-MARKETING', 'content', 'file.json'].join(escapedSlash),
      rule: 'known-marketing-root'
    },
    {
      text: ['g:', 'work', 'aPpDaTa', 'cache'].join(escapedSlash),
      rule: 'windows-personal-segment'
    }
  ];

  for (const sample of samples) {
    const findings = findPathLeaks('sample.txt', sample.text);
    assert.equal(findings.length, 1, sample.text);
    assert.equal(findings[0].rule, sample.rule, sample.text);
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

test('formats findings without publishing any offending path content', () => {
  const base = { file: 'README.md', line: 3, column: 9, match: 'do-not-publish-this-value' };
  const expectedTokens = new Map([
    ['windows-user-home', '<local-path>'],
    ['mac-user-home', '<local-path>'],
    ['linux-user-home', '<local-path>'],
    ['known-vibespec-root', '<repo-root>'],
    ['known-marketing-root', '<marketing-root>'],
    ['windows-personal-segment', '<local-path>']
  ]);

  for (const [rule, token] of expectedTokens) {
    assert.equal(
      formatPathLeak({ ...base, rule }),
      `README.md:3:9 [${rule}] ${token}`
    );
  }
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
