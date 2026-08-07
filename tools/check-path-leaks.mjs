#!/usr/bin/env node
import { resolve } from 'node:path';
import { formatPathLeak, scanTrackedFiles } from './lib/path-leak.mjs';

const root = resolve(process.argv[2] ?? '.');
const findings = (await scanTrackedFiles(root)).sort((a, b) =>
  a.file.localeCompare(b.file) || a.line - b.line || a.column - b.column
);
if (findings.length) {
  for (const finding of findings) console.error(formatPathLeak(finding));
  process.exitCode = 1;
} else {
  console.log('[paths] PASS');
}
