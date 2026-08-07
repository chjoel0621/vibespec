# Repository Facade and Portability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give first-time plugin users a concise bilingual GitHub entry point, portable development tools, and CI protection against broken documentation links and leaked workstation paths.

**Architecture:** Keep the plugin runtime untouched. Add small Node-only repository audit libraries under `tools/lib/`, test them with `node:test`, connect their CLIs to the existing plugin `check:all`, and split the current README content into audience-specific documents. Keep optional screenshot tooling in a private `tools` package so Playwright resolves normally without creating a root application package.

**Tech Stack:** Markdown, Node.js 22 in CI (Node.js 18+ compatible source), `node:test`, Git, GitHub Actions, `playwright-core@1.61.1` for the optional screenshot utility.

## Global Constraints

- Do not change SOT schemas, validation rules, viewer behavior, plugin runtime behavior, demo data, or user workflows.
- `README.md` is English by default and links to `README.ko.md` at the top; both use the same information architecture.
- The main README demo section contains exactly two products: meeting-room planning and CRM KPI measurement review.
- Do not reorganize or delete `demo/` in this phase.
- Do not bump the plugin version for documentation and development-tool cleanup.
- Use placeholders such as `<repo-root>`, `<task-folder>`, and `<marketing-root>` in user-facing documentation.
- The repository audit CLIs use only Node built-ins and must run without installing the optional `tools` package.
- Generated `plugins/vibespec/skills/vibespec/assets/viewer.html` changes only when `npm run build` produces a real source-derived difference.

---

## File Structure

### Create

- `tools/lib/path-leak.mjs`: pure detection plus tracked-file scanning.
- `tools/check-path-leaks.mjs`: CLI that reports leaks and exits non-zero.
- `tools/tests/path-leak.test.mjs`: positive and negative path detector tests.
- `tools/lib/markdown-links.mjs`: pure Markdown link extraction and validation.
- `tools/check-doc-links.mjs`: CLI for tracked Markdown files.
- `tools/tests/markdown-links.test.mjs`: relative-link regression tests.
- `tools/lib/marketing-runtime.mjs`: environment and Playwright dependency resolution.
- `tools/tests/marketing-runtime.test.mjs`: missing/present environment and dependency tests.
- `tools/package.json`: private optional development-tool package.
- `tools/package-lock.json`: locked `playwright-core@1.61.1` dependency.
- `docs/README.md`: documentation index.
- `docs/getting-started.md`: install and first-host acceptance.
- `docs/workflows.md`: product-plan workflows.
- `docs/live-demos.md`: complete demo catalog.
- `docs/architecture.md`: SOT/viewer/plugin architecture.
- `docs/development.md`: repository development guide.
- `CONTRIBUTING.md`: contribution contract.
- `SECURITY.md`: security and private reporting policy.

### Move

- `docs/consumer-app-generation-profile.md` to `docs/reference/consumer-app-generation-profile.md`.

### Modify

- `tools/capture-template-screenshots.mjs`: portable marketing root and normal Playwright resolution.
- `tools/generate-template-batch.mjs`: remove the workstation fallback.
- `plugins/vibespec/skills/vibespec/package.json`: add repository audit scripts to `check`.
- `.github/workflows/ci.yml`: install no extra dependency; run the existing `check:all` entry point.
- `README.md`: concise English installation facade.
- `README.ko.md`: concise Korean mirror.

---

### Task 1: Workstation Path Detector

**Files:**
- Create: `tools/lib/path-leak.mjs`
- Create: `tools/check-path-leaks.mjs`
- Create: `tools/tests/path-leak.test.mjs`

**Interfaces:**
- Produces: `findPathLeaks(filePath: string, text: string): PathLeak[]`.
- Produces: `scanTrackedFiles(repoRoot: string): Promise<PathLeak[]>`.
- Produces: `formatPathLeak(finding: PathLeak): string`, with personal segments redacted.
- `PathLeak` is `{ file: string, line: number, column: number, rule: string, match: string }`.
- CLI contract: `node tools/check-path-leaks.mjs [repo-root]`; exit `0` with `[paths] PASS`, exit `1` with one finding per line.

- [ ] **Step 1: Write detector tests with non-literal fixture construction**

```js
// tools/tests/path-leak.test.mjs
import assert from 'node:assert/strict';
import test from 'node:test';
import { findPathLeaks } from '../lib/path-leak.mjs';

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
```

- [ ] **Step 2: Run the focused test and confirm the module is missing**

Run: `node --test tools/tests/path-leak.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `tools/lib/path-leak.mjs`.

- [ ] **Step 3: Implement the pure detector**

```js
// tools/lib/path-leak.mjs
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const RULES = [
  ['windows-user-home', /[A-Za-z]:[\\/]Users[\\/][^<>{}\s\\/]+[\\/][^\r\n]*/g],
  ['mac-user-home', /\/Users\/[^<>{}\s/]+\/[^\r\n]*/g],
  ['linux-user-home', /\/home\/[^<>{}\s/]+\/[^\r\n]*/g],
  ['known-vibespec-root', /[A-Za-z]:[\\/]VibeSpec(?:-Marketing)?(?=[\\/\s'"`]|$)[^\r\n]*/g],
  ['windows-personal-segment', /[A-Za-z]:[\\/][^\r\n]*(?:OneDrive|AppData|WindowsApps)[^\r\n]*/g]
];

export function findPathLeaks(file, text) {
  const findings = [];
  for (const [rule, pattern] of RULES) {
    for (const match of text.matchAll(pattern)) {
      const before = text.slice(0, match.index);
      const line = before.split('\n').length;
      const column = match.index - before.lastIndexOf('\n');
      findings.push({ file, line, column, rule, match: match[0] });
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
    .replace(/([A-Za-z]:[\\/]Users[\\/])[^\\/]+/i, '$1<user>')
    .replace(/(\/(?:Users|home)\/)[^/]+/, '$1<user>');
  return `${finding.file}:${finding.line}:${finding.column} [${finding.rule}] ${redacted}`;
}
```

Implement `tools/check-path-leaks.mjs` as a thin CLI around `scanTrackedFiles()`:

```js
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
```

- [ ] **Step 4: Add CLI redaction and tracked-file tests**

Add tests that create a temporary Git repository, commit one safe file, leave one leaking file untracked, and assert `scanTrackedFiles()` ignores the untracked file. Add a formatter test asserting the reported match contains `<user>` rather than the fixture username.

- [ ] **Step 5: Run focused tests and the current repository audit**

Run:

```powershell
node --test tools/tests/path-leak.test.mjs
node tools/check-path-leaks.mjs .
```

Expected: unit tests PASS; repository audit FAILS only for the two known marketing tools before Task 2.

- [ ] **Step 6: Commit the detector**

```powershell
git add tools/lib/path-leak.mjs tools/check-path-leaks.mjs tools/tests/path-leak.test.mjs
git commit -m "test: prevent workstation path leaks"
```

---

### Task 2: Portable Marketing Tool Runtime

**Files:**
- Create: `tools/lib/marketing-runtime.mjs`
- Create: `tools/tests/marketing-runtime.test.mjs`
- Create: `tools/package.json`
- Create: `tools/package-lock.json`
- Modify: `tools/capture-template-screenshots.mjs:1-9`
- Modify: `tools/generate-template-batch.mjs:1-10`

**Interfaces:**
- Produces: `resolveMarketingRoot(env: NodeJS.ProcessEnv): string`.
- Produces: `loadChromium(importModule?: Function): Promise<Chromium>`.
- Both scripts consume `VIBESPEC_MARKETING_ROOT`; neither has a fallback directory.

- [ ] **Step 1: Write failing environment and dependency tests**

```js
// tools/tests/marketing-runtime.test.mjs
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
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `node --test tools/tests/marketing-runtime.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement runtime resolution**

```js
// tools/lib/marketing-runtime.mjs
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
```

Create `tools/package.json`:

```json
{
  "name": "vibespec-repository-tools",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test tests/*.test.mjs",
    "check:paths": "node check-path-leaks.mjs ..",
    "capture": "node capture-template-screenshots.mjs"
  },
  "devDependencies": {
    "playwright-core": "1.61.1"
  }
}
```

Run `npm --prefix tools install --package-lock-only` to generate the lockfile without adding a browser binary.

- [ ] **Step 4: Update both marketing tools**

In `tools/capture-template-screenshots.mjs`, remove `createRequire` and both absolute constants. Import `loadChromium` and `resolveMarketingRoot`, then initialize with:

```js
const marketingRoot = resolveMarketingRoot();
const chromium = await loadChromium();
```

In `tools/generate-template-batch.mjs`, replace the fallback with:

```js
import { resolveMarketingRoot } from './lib/marketing-runtime.mjs';

const marketingRoot = resolveMarketingRoot();
```

Preserve `--sot-only` behavior by resolving the marketing root only inside the `if (!sotOnly)` path. This keeps SOT-only generation independent of the separate marketing repository.

- [ ] **Step 5: Run tests and audits**

Run:

```powershell
node --test tools/tests/marketing-runtime.test.mjs
node --check tools/capture-template-screenshots.mjs
node --check tools/generate-template-batch.mjs
node tools/check-path-leaks.mjs .
git diff --check
```

Expected: tests PASS; both tools parse; path audit reports `[paths] PASS`; diff check is clean. The commands do not modify demo data.

- [ ] **Step 6: Commit portability changes**

```powershell
git add tools/package.json tools/package-lock.json tools/lib/marketing-runtime.mjs tools/tests/marketing-runtime.test.mjs tools/capture-template-screenshots.mjs tools/generate-template-batch.mjs
git commit -m "fix: make repository tools portable"
```

---

### Task 3: Markdown Link Validator

**Files:**
- Create: `tools/lib/markdown-links.mjs`
- Create: `tools/check-doc-links.mjs`
- Create: `tools/tests/markdown-links.test.mjs`
- Modify: `tools/package.json`

**Interfaces:**
- Produces: `extractRelativeMarkdownLinks(markdown: string): string[]`.
- Produces: `validateMarkdownFiles(repoRoot: string, files?: string[]): Promise<LinkError[]>`.
- `LinkError` is `{ file: string, target: string, reason: 'missing-target' | 'missing-anchor' }`.
- CLI contract: `node tools/check-doc-links.mjs [repo-root]`; exit `0` with `[docs] PASS`, exit `1` with deterministic errors.

- [ ] **Step 1: Write failing tests**

Create temporary Markdown fixtures and assert:

```js
assert.deepEqual(extractRelativeMarkdownLinks('[Guide](docs/guide.md#install)'), ['docs/guide.md#install']);
assert.deepEqual(extractRelativeMarkdownLinks('[Web](https://example.com) [Mail](mailto:a@example.com)'), []);
```

Also test an existing target, a missing file, a valid GitHub-style heading anchor, and a missing anchor.

- [ ] **Step 2: Run tests and verify module failure**

Run: `node --test tools/tests/markdown-links.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement extraction and validation**

Use Node built-ins only. Strip fenced code blocks before extracting inline Markdown links. Ignore `http:`, `https:`, `mailto:`, fragment-only links, and image links. Decode URL paths, resolve them relative to the source document, and derive GitHub-style anchors from ATX headings by lowercasing, removing punctuation, and replacing spaces with hyphens.

Implement the pure core with these signatures and behavior:

```js
// tools/lib/markdown-links.mjs
import { access, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const external = /^(?:https?:|mailto:|#)/i;

export function extractRelativeMarkdownLinks(markdown) {
  const withoutFences = markdown.replace(/```[\s\S]*?```/g, '');
  const links = [];
  for (const match of withoutFences.matchAll(/(?<!!)\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    if (!external.test(match[1])) links.push(match[1]);
  }
  return links;
}

function githubAnchor(heading) {
  return heading.trim().toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s+/g, '-');
}

export async function validateMarkdownFiles(repoRoot, files) {
  const errors = [];
  for (const file of files) {
    const markdown = await readFile(resolve(repoRoot, file), 'utf8');
    for (const link of extractRelativeMarkdownLinks(markdown)) {
      const [encodedPath, anchor] = link.split('#', 2);
      const target = resolve(repoRoot, dirname(file), decodeURIComponent(encodedPath));
      try {
        await access(target);
      } catch {
        errors.push({ file, target: link, reason: 'missing-target' });
        continue;
      }
      if (anchor && target.toLowerCase().endsWith('.md')) {
        const targetText = await readFile(target, 'utf8');
        const anchors = new Set([...targetText.matchAll(/^#{1,6}\s+(.+)$/gm)].map((match) => githubAnchor(match[1])));
        if (!anchors.has(anchor.toLowerCase())) errors.push({ file, target: link, reason: 'missing-anchor' });
      }
    }
  }
  return errors;
}
```

The CLI obtains tracked Markdown with:

```js
execFile('git', ['ls-files', '-z', '*.md'], { cwd: repoRoot, encoding: 'buffer' })
```

After the CLI exists, add `"check:docs": "node check-doc-links.mjs .."` to `tools/package.json`.

- [ ] **Step 4: Run focused and repository checks**

Run:

```powershell
node --test tools/tests/markdown-links.test.mjs
node tools/check-doc-links.mjs .
```

Expected: focused tests PASS. The repository check may fail on links that Task 4 and Task 5 will update; record each failure and do not weaken the validator.

- [ ] **Step 5: Commit the link validator**

```powershell
git add tools/lib/markdown-links.mjs tools/check-doc-links.mjs tools/tests/markdown-links.test.mjs tools/package.json
git commit -m "test: validate repository documentation links"
```

---

### Task 4: Documentation Information Architecture

**Files:**
- Create: `docs/README.md`
- Create: `docs/getting-started.md`
- Create: `docs/workflows.md`
- Create: `docs/live-demos.md`
- Create: `docs/architecture.md`
- Create: `docs/development.md`
- Move: `docs/consumer-app-generation-profile.md` to `docs/reference/consumer-app-generation-profile.md`
- Create: `CONTRIBUTING.md`
- Create: `SECURITY.md`

**Interfaces:**
- Produces: canonical destinations for content removed from both READMEs in Task 5.
- Consumes: current English and Korean README content as source material; do not invent new runtime claims.

- [ ] **Step 1: Move the existing reference without editing its contract**

Run:

```powershell
New-Item -ItemType Directory -Force docs/reference | Out-Null
git mv docs/consumer-app-generation-profile.md docs/reference/consumer-app-generation-profile.md
```

Update all tracked links returned by:

```powershell
rg -n "consumer-app-generation-profile" . --glob "!**/.git/**"
```

- [ ] **Step 2: Write the documentation index**

Use this exact audience ordering in `docs/README.md`:

```markdown
# VibeSpec Documentation

- **Install and try VibeSpec:** [Getting started](getting-started.md)
- **Understand the planning workflows:** [Workflows](workflows.md)
- **Explore every live example:** [Live demos](live-demos.md)
- **Understand the SOT and plugin architecture:** [Architecture](architecture.md)
- **Build and test the repository:** [Development](development.md)
- **Generate consumer app plans:** [Consumer app generation profile](reference/consumer-app-generation-profile.md)
```

- [ ] **Step 3: Split existing content into canonical documents**

Populate each document from the current READMEs:

- `getting-started.md`: runtime support; Cowork, Claude Code, and Codex installation; first-install acceptance; manual invocation.
- `workflows.md`: create; semantic decision answer and AI handoff; scoped edits; add-ons; rebase; review and integrated views; merge/land; Git collaboration.
- `live-demos.md`: meeting room, CRM, WeekChef, Neighborly, and the executable Before/Finding/Resolved evaluation case. State what each example proves.
- `architecture.md`: JSON SOT versus HTML app; plugin manifests; package boundary; no automatic network requests; write boundaries.
- `development.md`: repository tree; generated viewer rule; exact build, test, package, validation, and optional marketing-tool commands.

Do not duplicate full installation commands in more than `getting-started.md`; other documents link there.

- [ ] **Step 4: Add contribution and security contracts**

`CONTRIBUTING.md` must state:

```text
- Develop on a branch and keep changes scoped.
- Edit viewer source under src/ and commit the rebuilt viewer only after npm run build.
- Run npm run check:all before requesting review.
- Run node tools/check-path-leaks.mjs . and node tools/check-doc-links.mjs .
- Never commit workstation paths, credentials, host acceptance artifacts containing private paths, or generated local caches.
- Prefer squash merge for future feature PRs.
```

`SECURITY.md` must state that the latest released plugin line receives fixes, vulnerability reports should use GitHub private vulnerability reporting, public issues must not contain secrets or local paths, and accidental path disclosure should be reported with the file/ref but without repeating the path value.

- [ ] **Step 5: Validate the document tree**

Run:

```powershell
node tools/check-doc-links.mjs .
$IncompleteMarkers = @(('T' + 'BD'), ('T' + 'ODO'), ('FIX' + 'ME'))
foreach ($Marker in $IncompleteMarkers) {
  rg -n --fixed-strings $Marker README.md README.ko.md docs CONTRIBUTING.md SECURITY.md
  if ($LASTEXITCODE -eq 0) { throw "Incomplete documentation marker found: $Marker" }
}
git diff --check
```

Expected: link checker PASS; placeholder scan has no matches; diff check PASS.

- [ ] **Step 6: Commit the documentation foundation**

```powershell
git add docs CONTRIBUTING.md SECURITY.md
git commit -m "docs: add navigable project documentation"
```

---

### Task 5: Installation-First Bilingual README

**Files:**
- Modify: `README.md`
- Modify: `README.ko.md`

**Interfaces:**
- Consumes: canonical documents from Task 4.
- Produces: GitHub's public English entry point and a mirrored Korean entry point.

- [ ] **Step 1: Replace the English README with the agreed facade**

Keep the document in this order:

```markdown
# VibeSpec

**English · [한국어](README.ko.md)**

> Turn a product idea into an implementation-ready planning source of truth with Claude or Codex.

[What it creates]
[Host support and Node.js 18+ requirement]
[Install: Cowork, Claude Code, Codex]
[First request]
[Two live demos]
[Core workflow]
[What VibeSpec does not generate]
[Learn more]
[License]
```

Use the current verified host installation commands unchanged. Keep the reduced Cowork mode limitation visible next to host support, not buried in development documentation.

The featured demo table contains only:

```markdown
| Try | Demo |
| --- | --- |
| Create and edit a connected product plan | [Meeting-room planning](https://chjoel0621.github.io/vibespec/en/) |
| Resolve a blocked KPI measurement decision | [CRM KPI Measurement Check](https://chjoel0621.github.io/vibespec/crm/en/review/?view=semantic) |
```

- [ ] **Step 2: Mirror the structure in Korean**

Use the same section order, commands, limitations, and two demos. Translate user-facing prose, keep identifiers and commands unchanged, and link the Korean demo URLs:

```markdown
| 체험 | 데모 |
| --- | --- |
| 연결된 제품 기획 생성·편집 | [회의실 예약 기획](https://chjoel0621.github.io/vibespec/) |
| 차단된 KPI 측정 결정 해결 | [CRM KPI 측정 점검](https://chjoel0621.github.io/vibespec/crm/review/?view=semantic) |
```

- [ ] **Step 3: Check facade constraints**

Run:

```powershell
$english = Get-Content README.md
$korean = Get-Content README.ko.md
if ($english.Count -gt 150) { throw "README.md is still too long: $($english.Count)" }
if ($korean.Count -gt 150) { throw "README.ko.md is still too long: $($korean.Count)" }
node tools/check-doc-links.mjs .
node tools/check-path-leaks.mjs .
git diff --check
```

Expected: both line counts are at most 150; documentation and path checks PASS.

- [ ] **Step 4: Review the rendered Markdown**

Use `gh pr view --web` only after the branch is pushed, or inspect GitHub's rendered README in the PR Files view. Verify the language link, installation commands, tables, and relative documentation links render correctly on desktop and narrow widths.

- [ ] **Step 5: Commit the facade**

```powershell
git add README.md README.ko.md
git commit -m "docs: focus repository on first-time installation"
```

---

### Task 6: CI Integration and Phase A Acceptance

**Files:**
- Modify: `plugins/vibespec/skills/vibespec/package.json`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Produces: `npm run check:repo` from the plugin package.
- Preserves: `npm run check:all` as the single CI entry point.

- [ ] **Step 1: Add the repository check script**

Add to `plugins/vibespec/skills/vibespec/package.json`:

```json
"check:repo": "node ../../../../tools/check-path-leaks.mjs ../../../.. && node ../../../../tools/check-doc-links.mjs ../../../.."
```

Change `check:all` to:

```json
"check:all": "npm run check:repo && npm run check && npm run check:browser"
```

- [ ] **Step 2: Make CI intent explicit without adding another job**

Rename the existing `.github/workflows/ci.yml` step from `Build and test` to `Audit, build, and test`. Keep `npm run check:all`; do not install `tools` dependencies because the two repository audit CLIs use Node built-ins only.

- [ ] **Step 3: Run focused repository-tool tests**

Run:

```powershell
node --test tools/tests/path-leak.test.mjs tools/tests/markdown-links.test.mjs tools/tests/marketing-runtime.test.mjs
```

Expected: all tests PASS.

- [ ] **Step 4: Run the complete plugin regression suite**

Run:

```powershell
npm run check:all
```

Working directory: `plugins/vibespec/skills/vibespec`.

Expected: repository audits, build, schema/contract tests, semantic evaluation, packaging tests, and browser regressions all PASS.

- [ ] **Step 5: Verify generated and unrelated files**

Run:

```powershell
git status --short
git diff --check
git diff -- plugins/vibespec/skills/vibespec/assets/viewer.html demo
```

Expected: no demo change; no viewer change unless the existing build was stale. If the viewer differs only because of a stale generated artifact, include it and record that reason in the commit message body.

- [ ] **Step 6: Commit CI integration**

```powershell
git add plugins/vibespec/skills/vibespec/package.json .github/workflows/ci.yml
git commit -m "ci: enforce repository publication checks"
```

- [ ] **Step 7: Push and open the Phase A PR**

```powershell
$Branch = git branch --show-current
if (-not $Branch) { throw 'A named current branch is required before push.' }
git push -u origin $Branch
$PrBody = Join-Path ([IO.Path]::GetTempPath()) 'vibespec-phase-a-pr.md'
@'
## Summary
- make the English and Korean READMEs installation-first
- move advanced workflows, demos, architecture, and development guidance into navigable docs
- remove workstation-specific paths from optional repository tools
- add deterministic path-leak and Markdown-link checks to the existing CI entry point

## Verification
- `node --test tools/tests/path-leak.test.mjs tools/tests/markdown-links.test.mjs tools/tests/marketing-runtime.test.mjs`
- `npm run check:all` from `plugins/vibespec/skills/vibespec`
- `git diff --check`

## Scope
- no SOT schema or plugin runtime behavior change
- no demo reorganization
- no plugin version bump

Design: `docs/superpowers/specs/2026-08-07-repository-facade-history-sanitization-design.md`
'@ | Set-Content -Encoding utf8 $PrBody
gh pr create --base main --head $Branch --title "docs: clarify installation and prevent local path leaks" --body-file $PrBody
```

- [ ] **Step 8: Merge only after remote checks pass**

Run:

```powershell
gh pr checks --watch
gh pr view --json mergeStateStatus,isDraft,statusCheckRollup
```

Expected: all required checks PASS and the PR is not a draft. Merge using squash merge, then fetch `main` and verify the cleanup commit is present before beginning the separate history-sanitization plan.
