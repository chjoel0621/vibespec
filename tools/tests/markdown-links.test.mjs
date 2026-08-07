import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  extractRelativeMarkdownLinks,
  validateMarkdownFiles
} from '../lib/markdown-links.mjs';

async function createFixture(files) {
  const root = await mkdtemp(join(tmpdir(), 'markdown-links-'));
  for (const [file, content] of Object.entries(files)) {
    const target = join(root, file);
    await mkdir(join(target, '..'), { recursive: true });
    await writeFile(target, content);
  }
  return root;
}

test('extracts relative Markdown links', () => {
  assert.deepEqual(
    extractRelativeMarkdownLinks('[Guide](docs/guide.md#install)'),
    ['docs/guide.md#install']
  );
});

test('ignores external Markdown links', () => {
  assert.deepEqual(
    extractRelativeMarkdownLinks('[Web](https://example.com) [Mail](mailto:a@example.com)'),
    []
  );
});

test('ignores URI-scheme and protocol-relative Markdown links', () => {
  assert.deepEqual(
    extractRelativeMarkdownLinks(
      '[FTP](ftp://example.com) [Tel](tel:+821012345678) [Data](data:text/plain,hello) [CDN](//cdn.example.com/file.md)'
    ),
    []
  );
});

test('does not pair a reference label with a later image target', () => {
  assert.deepEqual(
    extractRelativeMarkdownLinks('[reference][id] ![preview](missing.png)'),
    []
  );
});

test('ignores links inside backtick and tilde fenced code blocks', () => {
  const markdown = [
    '````markdown',
    '[Four backticks](docs/four-backticks.md)',
    '```',
    '[Still four backticks](docs/still-four-backticks.md)',
    '`````',
    '~~~markdown',
    '[Tilde](docs/tilde.md)',
    '~~~~',
    '[Kept](docs/kept.md)'
  ].join('\n');

  assert.deepEqual(extractRelativeMarkdownLinks(markdown), ['docs/kept.md']);
});

test('ignores links inside inline code spans', () => {
  const markdown = [
    '`[Ignored](docs/ignored.md)`',
    '``[Also ignored](docs/also-ignored.md)``',
    '[Kept](docs/kept.md)'
  ].join(' ');

  assert.deepEqual(extractRelativeMarkdownLinks(markdown), ['docs/kept.md']);
});

test('extracts balanced-parenthesis and angle-bracket destinations', () => {
  assert.deepEqual(
    extractRelativeMarkdownLinks(
      '[Balanced](docs/guide_(draft).md) [Spaced](<docs/guide draft.md>)'
    ),
    ['docs/guide_(draft).md', 'docs/guide draft.md']
  );
});

test('validates an existing target', async () => {
  const root = await createFixture({
    'README.md': '[Guide](docs/guide.md)',
    'docs/guide.md': '# Guide\n'
  });

  assert.deepEqual(await validateMarkdownFiles(root, ['README.md']), []);
});

test('reports a missing target', async () => {
  const root = await createFixture({
    'README.md': '[Missing](docs/missing.md)'
  });

  assert.deepEqual(await validateMarkdownFiles(root, ['README.md']), [
    { file: 'README.md', target: 'docs/missing.md', reason: 'missing-target' }
  ]);
});

test('validates a GitHub-style heading anchor', async () => {
  const root = await createFixture({
    'README.md': '[Install](docs/guide.md#install-configure)',
    'docs/guide.md': '# Install & Configure!\n'
  });

  assert.deepEqual(await validateMarkdownFiles(root, ['README.md']), []);
});

test('validates GitHub duplicate heading suffix anchors', async () => {
  const root = await createFixture({
    'README.md': '[Second](docs/guide.md#install-1) [Third](docs/guide.md#install-2)',
    'docs/guide.md': '# Install\n## Install\n### Install\n'
  });

  assert.deepEqual(await validateMarkdownFiles(root, ['README.md']), []);
});

test('validates an angle-bracket target containing spaces', async () => {
  const root = await createFixture({
    'README.md': '[Guide](<docs/guide draft.md>)',
    'docs/guide draft.md': '# Guide\n'
  });

  assert.deepEqual(await validateMarkdownFiles(root, ['README.md']), []);
});

test('reports a missing heading anchor', async () => {
  const root = await createFixture({
    'README.md': '[Missing](docs/guide.md#missing)',
    'docs/guide.md': '# Guide\n'
  });

  assert.deepEqual(await validateMarkdownFiles(root, ['README.md']), [
    { file: 'README.md', target: 'docs/guide.md#missing', reason: 'missing-anchor' }
  ]);
});
