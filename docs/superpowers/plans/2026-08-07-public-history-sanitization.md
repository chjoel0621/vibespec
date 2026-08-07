# Public Git History Sanitization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove known workstation paths from normal public branch and tag history while preserving meaningful commits and maintaining a verified recovery path.

**Architecture:** Run the rewrite only after the repository facade and leak-prevention work is merged. Inventory and back up every ref, perform `git-filter-repo` in a disposable mirror clone, verify rewritten refs and a fresh working clone, then update GitHub refs with explicit leases. Treat the remote push as a separate approval gate and never rewrite the maintainer working clone in place.

**Tech Stack:** Git, GitHub CLI, PowerShell 7, Python 3, official `git-filter-repo`, Node.js 22, existing VibeSpec test suite.

## Global Constraints

- This plan starts only after the Phase A PR is merged to `main` and all checks pass.
- Freeze repository writes during the rewrite window.
- Preserve commit messages, authorship, dates, merge topology, release tags, and every non-empty meaningful commit.
- Remove only commits made empty by path replacement.
- Delete only branches proven merged into `main`; halt on unmerged branches without an open PR classification.
- Never rewrite the maintainer working clone in place.
- Never use `git push --mirror` or an unleased force push.
- Keep the verified backup bundle outside the repository until all acceptance checks pass.
- Do not claim GitHub-managed PR refs, forks, caches, or unreachable objects are erased.

---

## Operational Artifacts

All artifacts live under a timestamped directory returned by `[IO.Path]::GetTempPath()` and are not committed:

```text
vibespec-history-sanitization-<timestamp>/
  original.bundle
  original-mirror.git/
  original-refs.json
  github-releases.json
  branch-classification.json
  replacements.txt
  mirror.git/
  fresh-clone/
  rewrite-manifest.json
  verification.txt
```

`rewrite-manifest.json` records the repository URL, `git-filter-repo` version, old/new ref SHAs, removed empty commits, deleted branches, test commands, test outcomes, and backup bundle path.

---

### Task 1: Freeze, Inventory, and Classify Public Refs

**Files:**
- Read: remote branches, tags, releases, open PRs, and current Pages deployment.
- Create outside repository: `original-refs.json`, `github-releases.json`, `branch-classification.json`.

**Interfaces:**
- Produces: a complete old-SHA lease map consumed by Task 4.
- Produces: branch classes `keep`, `delete-merged`, and `halt-unclassified`.

- [ ] **Step 1: Confirm clean merged Phase A state**

Run from the normal working clone:

```powershell
git switch main
git fetch origin --prune --tags
git pull --ff-only
git status --short
node tools/check-path-leaks.mjs .
node tools/check-doc-links.mjs .
```

Expected: clean status and both audits PASS. Stop if `main` is not a fast-forward of `origin/main`.

- [ ] **Step 2: Create the private audit directory**

```powershell
$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$AuditRoot = Join-Path ([IO.Path]::GetTempPath()) "vibespec-history-sanitization-$Stamp"
New-Item -ItemType Directory -Path $AuditRoot | Out-Null
$AuditRoot
```

Record `$AuditRoot` in the task log. Do not place it in a tracked file.

- [ ] **Step 3: Inventory refs, releases, and open PR branches**

```powershell
$Refs = foreach ($Line in (git ls-remote --heads --tags origin)) {
  $Sha, $Ref = $Line -split "`t", 2
  [pscustomobject]@{ ref = $Ref; sha = $Sha }
}
$Refs | ConvertTo-Json -Depth 3 | Set-Content -Encoding utf8 (Join-Path $AuditRoot 'original-refs.json')
gh release list --limit 100 --json tagName,name,isDraft,isPrerelease,publishedAt,targetCommitish | Set-Content -Encoding utf8 (Join-Path $AuditRoot 'github-releases.json')
$OpenPrHeads = gh pr list --state open --limit 100 --json headRefName | ConvertFrom-Json | ForEach-Object headRefName
```

Parse `$Refs` into exact `refs/heads/*` and peeled `refs/tags/*` SHAs. Ignore `^{} ` pseudo-refs only after recording their annotated-tag relationship.

- [ ] **Step 4: Classify every remote branch**

For each branch except `main`:

```powershell
git merge-base --is-ancestor "origin/$Branch" origin/main
$Merged = ($LASTEXITCODE -eq 0)
$Class = if ($OpenPrHeads -contains $Branch) { 'keep' } elseif ($Merged) { 'delete-merged' } else { 'halt-unclassified' }
```

Write objects `{ name, oldSha, mergedIntoMain, openPr, class }` to `branch-classification.json`.

Expected: `main` and open-PR branches are `keep`; only branches reachable from `main` are `delete-merged`. Stop and ask for branch-specific direction if any branch is `halt-unclassified`.

- [ ] **Step 5: Record the current public endpoints**

Record status and final URL for:

```text
https://github.com/chjoel0621/vibespec
https://chjoel0621.github.io/vibespec/en/
https://chjoel0621.github.io/vibespec/crm/en/review/?view=semantic
```

Do not start Task 2 while another repository write or deployment is in progress.

---

### Task 2: Create and Prove the Recovery Backup

**Files:**
- Create outside repository: `original.bundle`, `backup-probe.git/`.

**Interfaces:**
- Produces: an immutable restoration source for every fetched branch and tag.

- [ ] **Step 1: Create the full bundle**

Create a mirror directly from the remote so branch heads are preserved as `refs/heads/*`, then create the bundle from that mirror:

```powershell
$RepoUrl = 'https://github.com/chjoel0621/vibespec.git'
$OriginalMirror = Join-Path $AuditRoot 'original-mirror.git'
git clone --mirror $RepoUrl $OriginalMirror
$MirrorRefs = git -C $OriginalMirror show-ref
$MirrorRefs | Set-Content -Encoding utf8 (Join-Path $AuditRoot 'original-mirror-refs.txt')
$Bundle = Join-Path $AuditRoot 'original.bundle'
git -C $OriginalMirror bundle create $Bundle --all
git -C $OriginalMirror bundle verify $Bundle
```

Expected: mirror refs match `original-refs.json`; `git bundle verify` reports a complete history and exits `0`.

- [ ] **Step 2: Prove the bundle can seed a repository**

```powershell
$BackupProbe = Join-Path $AuditRoot 'backup-probe.git'
git clone --mirror $Bundle $BackupProbe
git -C $BackupProbe fsck --full
git -C $BackupProbe show-ref
```

Expected: `fsck` exits `0`; every branch/tag SHA in `original-refs.json` is present in `show-ref` after accounting for remote-ref naming.

- [ ] **Step 3: Protect the backup from accidental mutation**

Set the bundle read-only and record its SHA-256:

```powershell
(Get-Item $Bundle).IsReadOnly = $true
(Get-FileHash -Algorithm SHA256 $Bundle).Hash | Set-Content -Encoding ascii (Join-Path $AuditRoot 'original.bundle.sha256')
```

Stop the rewrite if the bundle hash changes at any later checkpoint.

---

### Task 3: Rewrite and Verify in an Isolated Mirror

**Files:**
- Create outside repository: `mirror.git/`, `replacements.txt`, `rewrite-manifest.json`, `verification.txt`.

**Interfaces:**
- Consumes: old ref SHAs and backup from Tasks 1-2.
- Produces: rewritten kept branches and tags with zero banned path matches.

- [ ] **Step 1: Create the disposable mirror from the verified bundle**

```powershell
$RepoUrl = 'https://github.com/chjoel0621/vibespec.git'
$Mirror = Join-Path $AuditRoot 'mirror.git'
git clone --mirror $Bundle $Mirror
git -C $Mirror remote set-url origin $RepoUrl
git -C $Mirror fsck --full
```

Compare every branch and tag SHA with `original-refs.json`. Stop if any differs.

- [ ] **Step 2: Install official git-filter-repo in an isolated virtual environment**

```powershell
$Venv = Join-Path $AuditRoot 'filter-repo-venv'
python -m venv $Venv
$Python = Join-Path $Venv 'Scripts/python.exe'
& $Python -m pip install --disable-pip-version-check git-filter-repo
$FilterRepo = Join-Path $Venv 'Scripts/git-filter-repo.exe'
& $FilterRepo --version
```

Record the printed version in `rewrite-manifest.json`. Stop if installation or version reporting fails.

- [ ] **Step 3: Build exact replacements outside the repository**

Discover exact values without printing them, then write `replacements.txt` in `git-filter-repo --replace-text` format:

```powershell
$LeakPatterns = @(
  '[A-Za-z]:[/\\]Users[/\\][^/\\[:space:]]+[/\\]AppData[/\\]Local[/\\]npm-cache[/\\]_npx[/\\][^/\\[:space:]]+[/\\]node_modules[/\\]playwright',
  '[A-Za-z]:[/\\]VibeSpec-Marketing',
  '[A-Za-z]:[/\\]VibeSpec([^A-Za-z-]|$)'
)
$Detected = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
foreach ($Commit in (git -C $Mirror rev-list --all)) {
  foreach ($Pattern in $LeakPatterns) {
    foreach ($Match in (git -C $Mirror grep -I -h -o -E $Pattern $Commit -- 2>$null)) {
      $Value = $Match -replace '([^A-Za-z-])$', ''
      [void]$Detected.Add($Value)
    }
  }
}
if ($Detected.Count -eq 0) { throw 'No historical paths were detected; stop and re-audit the patterns.' }
$ReplacementLines = foreach ($Value in ($Detected | Sort-Object Length -Descending)) {
  $Target = if ($Value -match 'node_modules[/\\]playwright$') {
    'playwright-core'
  } elseif ($Value -match 'VibeSpec-Marketing$') {
    '<marketing-root>'
  } else {
    '<repo-root>'
  }
  "literal:$Value==$([char]62)$Target"
}
$ReplacementLines | Set-Content -Encoding utf8 (Join-Path $AuditRoot 'replacements.txt')
```

The expression uses `[char]62` to build the `==>` delimiter without confusing PowerShell interpolation. Do not print `replacements.txt` or paste its source values into tracked files, shared CI logs, or GitHub comments.

- [ ] **Step 4: Run the rewrite**

```powershell
Push-Location $Mirror
try {
  & $FilterRepo --force --replace-text (Join-Path $AuditRoot 'replacements.txt') --prune-empty always --prune-degenerate always
} finally {
  Pop-Location
}
```

Expected: exit `0`. Re-add `origin` if `git-filter-repo` removed it:

```powershell
if (-not (git -C $Mirror remote)) { git -C $Mirror remote add origin $RepoUrl }
```

- [ ] **Step 5: Verify history content and topology locally**

For each kept branch and tag, scan every reachable commit's text blobs for the same detector classes. A practical implementation is:

```powershell
$Commits = git -C $Mirror rev-list --all
foreach ($Commit in $Commits) {
  $Matches = git -C $Mirror grep -I -n -E '([A-Za-z]:[/\\]Users[/\\]|/Users/[^/]+/|/home/[^/]+/|[A-Za-z]:[/\\]VibeSpec)' $Commit -- 2>$null
  if ($Matches) { throw "Path leak remains in commit $Commit" }
}
```

Then run:

```powershell
git -C $Mirror fsck --full
git -C $Mirror log --all --format='%H%x09%P%x09%s' | Set-Content -Encoding utf8 (Join-Path $AuditRoot 'rewritten-commits.tsv')
git -C $Mirror show-ref | Set-Content -Encoding utf8 (Join-Path $AuditRoot 'rewritten-refs.txt')
```

Compare old and new commit subjects and parent counts. Record commits removed because they became empty; fail if a non-empty meaningful subject disappears without an explicit mapping.

- [ ] **Step 6: Verify rewritten HEAD in a temporary working clone**

```powershell
$Fresh = Join-Path $AuditRoot 'fresh-clone'
git clone $Mirror $Fresh
node (Join-Path $Fresh 'tools/check-path-leaks.mjs') $Fresh
node (Join-Path $Fresh 'tools/check-doc-links.mjs') $Fresh
npm --prefix (Join-Path $Fresh 'plugins/vibespec/skills/vibespec') run check:all
```

Expected: all audits and regressions PASS. No remote push is allowed if this step fails.

---

### Task 4: Guarded Atomic Remote Ref Update

**Files:**
- Update: GitHub branch and tag refs.
- Delete: only remote branches classified `delete-merged`.
- Preserve: backup and manifest outside the repository.

**Interfaces:**
- Consumes: exact old SHAs as leases and locally verified rewritten refs.
- Produces: sanitized normal public history.

- [ ] **Step 1: Recheck the remote freeze**

Immediately before pushing:

```powershell
$CurrentRefs = git ls-remote --heads --tags origin
```

Byte-compare normalized refs with `original-refs.json`. Stop if any branch or tag changed.

- [ ] **Step 2: Present the push manifest for explicit approval**

Print, without path values:

```text
- kept branches and old -> new SHA
- tags and old -> new SHA
- merged branches to delete
- empty commits removed
- backup bundle path and SHA-256
- fresh-clone test result
```

Do not execute Step 3 until the repository owner explicitly approves this exact manifest.

- [ ] **Step 3: Push kept branches and tags with explicit leases**

Build the push arguments from the manifests rather than hand-typing any ref or SHA:

```powershell
$OriginalRefs = Get-Content (Join-Path $AuditRoot 'original-refs.json') | ConvertFrom-Json
$Classification = Get-Content (Join-Path $AuditRoot 'branch-classification.json') | ConvertFrom-Json
$RewrittenRefs = @{}
foreach ($Line in (git -C $Mirror show-ref)) {
  $Sha, $Ref = $Line -split ' ', 2
  $RewrittenRefs[$Ref] = $Sha
}
$PushArguments = @()
foreach ($Branch in ($Classification | Where-Object class -eq 'keep')) {
  $Ref = "refs/heads/$($Branch.name)"
  $PushArguments += "--force-with-lease=$Ref`:$($Branch.oldSha)"
  $PushArguments += "$($RewrittenRefs[$Ref])`:$Ref"
}
foreach ($Tag in ($OriginalRefs | Where-Object { $_.ref -like 'refs/tags/*' -and $_.ref -notlike '*^{}' })) {
  $PushArguments += "--force-with-lease=$($Tag.ref)`:$($Tag.sha)"
  $PushArguments += "$($RewrittenRefs[$Tag.ref])`:$($Tag.ref)"
}
foreach ($Branch in ($Classification | Where-Object class -eq 'delete-merged')) {
  $Ref = "refs/heads/$($Branch.name)"
  $PushArguments += "--force-with-lease=$Ref`:$($Branch.oldSha)"
  $PushArguments += ":$Ref"
}
git -C $Mirror push --atomic @PushArguments origin
```

Expected: atomic success. If the server does not support atomic pushes, stop and ask for a new push strategy; do not silently retry non-atomically.

- [ ] **Step 4: Record new remote refs**

```powershell
git ls-remote --heads --tags origin | Set-Content -Encoding utf8 (Join-Path $AuditRoot 'remote-refs-after.txt')
```

Compare them with rewritten refs and the deletion list. Any mismatch starts the recovery procedure before repository writes resume.

---

### Task 5: Post-Rewrite Acceptance and Recovery Readiness

**Files:**
- Create outside repository: final `rewrite-manifest.json` and `verification.txt`.
- Verify: GitHub README, Releases, Pages, branches, and tags.

**Interfaces:**
- Produces: evidence that public normal history and deployed artifacts remain usable.

- [ ] **Step 1: Clone from GitHub, not the local mirror**

```powershell
$RemoteFresh = Join-Path $AuditRoot 'remote-fresh-clone'
git clone https://github.com/chjoel0621/vibespec.git $RemoteFresh
node (Join-Path $RemoteFresh 'tools/check-path-leaks.mjs') $RemoteFresh
node (Join-Path $RemoteFresh 'tools/check-doc-links.mjs') $RemoteFresh
npm --prefix (Join-Path $RemoteFresh 'plugins/vibespec/skills/vibespec') run check:all
```

Expected: fresh public clone and full suite PASS.

- [ ] **Step 2: Verify releases and branch cleanup**

Run:

```powershell
gh release list --limit 100 --json tagName,name,isDraft,isPrerelease,publishedAt,targetCommitish
gh api repos/chjoel0621/vibespec/branches --paginate --jq '.[].name'
```

Expected: release tags exist at rewritten SHAs; branches classified `delete-merged` are absent; all kept branches remain.

- [ ] **Step 3: Verify GitHub Actions and Pages**

Run:

```powershell
gh run list --branch main --limit 10
```

Wait for the rewritten `main` CI and Pages runs to finish. Verify HTTP `200` and expected headings at:

```text
https://chjoel0621.github.io/vibespec/en/
https://chjoel0621.github.io/vibespec/crm/en/review/?view=semantic
```

- [ ] **Step 4: Inspect the public facade**

Open `https://github.com/chjoel0621/vibespec` and verify:

```text
- English README is default.
- Korean link is visible at the top.
- Installation appears before advanced documentation.
- Only meeting-room and CRM demos are featured.
- Relative documentation links resolve.
```

- [ ] **Step 5: Finalize the rewrite manifest**

Write all old/new refs, deleted branches, removed empty commits, tool version, bundle SHA-256, test outputs, GitHub run URLs, and Pages checks to `rewrite-manifest.json` and `verification.txt`. Do not include the personal path strings themselves.

- [ ] **Step 6: Publish the contributor reset notice**

Post a repository announcement or issue with:

```text
The repository history was rewritten to remove workstation-specific paths.
Fresh clone is recommended. Existing clones must fetch, switch to main, and reset to origin/main only after preserving local work on a separate branch or bundle.
No SOT schema or plugin behavior changed.
```

Do not tell contributors to run a destructive reset without first preserving their local work.

- [ ] **Step 7: Retain recovery material through the observation window**

Keep the read-only bundle, checksum, and manifest until CI, Pages, Releases, and normal repository use remain healthy for at least seven days. Afterward, move the bundle to private archival storage or delete it according to the repository owner's retention choice.

---

## Recovery Procedure

If the atomic push succeeds but post-rewrite acceptance fails:

1. Freeze repository writes again.
2. Compare `remote-refs-after.txt`, rewritten refs, and `original-refs.json`.
3. Clone `original.bundle` into a new recovery mirror.
4. Verify the bundle SHA-256 and run `git fsck --full`.
5. Build an explicit leased atomic push from current remote SHAs back to original branch/tag SHAs.
6. Present that rollback manifest for owner approval.
7. Push atomically and re-run the fresh-clone, release, and Pages checks.

Never recover from the maintainer's preexisting working clone; use the verified bundle.
