import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { validateMarkdownFiles } from './lib/markdown-links.mjs';

const execFileAsync = promisify(execFile);

async function trackedMarkdownFiles(repoRoot) {
  const { stdout } = await execFileAsync(
    'git',
    ['ls-files', '-z', '*.md'],
    { cwd: repoRoot, encoding: 'buffer' }
  );
  return stdout.toString('utf8').split('\0').filter(Boolean).sort();
}

const repoRoot = resolve(process.argv[2] ?? '.');
const errors = await validateMarkdownFiles(repoRoot, await trackedMarkdownFiles(repoRoot));

if (errors.length === 0) {
  console.log('[docs] PASS');
  process.exitCode = 0;
} else {
  for (const error of errors) {
    console.error(`[docs] ${error.file}: ${error.reason}: ${error.target}`);
  }
  process.exitCode = 1;
}
