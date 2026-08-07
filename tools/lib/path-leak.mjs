import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const PATH_SEGMENT = "[^<>{}\\s/\\\\|\\[\\]\\^$;,'\"!?]+";
const RULES = [
  ['windows-user-home', new RegExp('[A-Za-z]:[\\\\/]Users[\\\\/]' + PATH_SEGMENT + '(?:[\\\\/]' + PATH_SEGMENT + ')*', 'g')],
  ['mac-user-home', new RegExp('/Users/' + PATH_SEGMENT + '(?:/' + PATH_SEGMENT + ')*', 'g')],
  ['linux-user-home', new RegExp('/home/' + PATH_SEGMENT + '(?:/' + PATH_SEGMENT + ')*', 'g')],
  ['known-vibespec-root', new RegExp('[A-Za-z]:[\\\\/]VibeSpec(?:-Marketing)?(?:[\\\\/]' + PATH_SEGMENT + ')*', 'g')],
  ['windows-personal-segment', new RegExp('[A-Za-z]:[\\\\/]' + PATH_SEGMENT + '(?:[\\\\/]' + PATH_SEGMENT + ')*', 'g')]
];

export function findPathLeaks(file, text) {
  const findings = [];
  const matchedRanges = [];
  for (const [rule, pattern] of RULES) {
    for (const match of text.matchAll(pattern)) {
      if (rule === 'windows-personal-segment' &&
          !/(?:OneDrive|AppData|WindowsApps)/.test(match[0])) {
        continue;
      }
      const start = match.index;
      const end = start + match[0].length;
      if (matchedRanges.some(([rangeStart, rangeEnd]) => start < rangeEnd && end > rangeStart)) {
        continue;
      }
      const before = text.slice(0, match.index);
      const line = before.split('\n').length;
      const column = match.index - before.lastIndexOf('\n');
      findings.push({ file, line, column, rule, match: match[0] });
      matchedRanges.push([start, end]);
    }
  }
  return findings;
}

export async function scanTrackedFiles(repoRoot) {
  const { stdout } = await execFileAsync('git', ['ls-files', '-z'], {
    cwd: repoRoot,
    encoding: 'buffer',
    maxBuffer: 32 * 1024 * 1024
  });
  const files = stdout.toString('utf8').split('\0').filter(Boolean);
  const findings = [];
  for (const file of files) {
    const buffer = await readFile(resolve(repoRoot, file));
    if (buffer.includes(0)) continue;
    findings.push(...findPathLeaks(file, buffer.toString('utf8')));
  }
  return findings;
}

export function formatPathLeak(finding) {
  const redacted = finding.match
    .replace(/([A-Za-z]:[\\/]Users[\\/])[^\\/]+/gi, '$1<user>')
    .replace(/(\/(?:Users|home)\/)[^/]+/gi, '$1<user>');
  return `${finding.file}:${finding.line}:${finding.column} [${finding.rule}] ${redacted}`;
}
