# Repository Facade and History Sanitization Design

## Status

- Date: 2026-08-07
- State: approved design, pending implementation plan
- Repository: `chjoel0621/vibespec`
- Primary audience: a first-time user who wants to install VibeSpec and use it immediately

## Problem

The repository works as a plugin marketplace and development source, but its public presentation does not reflect that clearly.

- The default README mixes product explanation, installation, advanced workflows, internal architecture, and development instructions in one long page.
- Four demo families compete for attention even though a new user needs only a basic example and a semantic-assurance example.
- Project documentation has no navigable information architecture or standard contributor and security entry points.
- Two development tools contain machine-specific absolute paths. Those paths also occur in public Git history.
- Old merged remote branches add noise, while manually collapsing old commits would destroy useful engineering context.

This work makes the repository easier to install from, safer to publish, and easier to maintain without changing VibeSpec's SOT schema, plugin behavior, demo data model, or user workflows.

## Goals

1. Make the first screen of the GitHub repository useful to an installation-oriented user.
2. Keep English as the default README and provide a prominent Korean README link.
3. Show exactly two representative demos on the README: basic meeting-room planning and CRM KPI measurement review.
4. Move advanced explanations into a small, navigable documentation structure.
5. Remove machine-specific filesystem paths from the current tree and all public branch/tag history.
6. Add CI that prevents machine-specific paths from being committed again.
7. Preserve meaningful commit messages, merge topology, releases, and tags wherever possible.
8. Make the history rewrite recoverable and independently verifiable.

## Non-goals

- Reorganizing or deleting the `demo/` catalog.
- Changing SOT schemas, validation rules, viewer behavior, or plugin runtime behavior.
- Rewriting public GitHub URLs or the repository owner name.
- Squashing historical commits for cosmetic reasons.
- Erasing GitHub PR discussion, issue history, or every unreachable object cached by GitHub.
- Publishing a new plugin version solely for documentation and development-tool cleanup.

## Design Decisions

### 1. Public README

`README.md` remains the default English entry point and targets a user who wants to install the plugin now. `README.ko.md` mirrors the same information architecture in Korean. Both begin with a visible language link.

The first screen contains, in this order:

1. One-sentence product definition.
2. A compact explanation of the JSON SOT and self-contained HTML viewer.
3. Host support summary for Claude Cowork, Claude Code, and Codex.
4. Installation paths.
5. Two representative live demos.

The two featured demos are:

- Meeting-room planning: basic SOT viewing/editing and linked planning views.
- CRM KPI measurement check: a decision-blocked semantic review and AI handoff workflow.

The README keeps only the shortest successful first-use path. Advanced workflows, all demo links, repository internals, and development commands move to documents linked from a compact "Learn more" section. The target size is about 100-130 lines per language, but clarity takes priority over an exact line count.

### 2. Documentation Information Architecture

The repository adopts this structure:

```text
docs/
  README.md
  getting-started.md
  workflows.md
  live-demos.md
  architecture.md
  development.md
  reference/
    consumer-app-generation-profile.md
  superpowers/
    specs/
      2026-08-07-repository-facade-history-sanitization-design.md
CONTRIBUTING.md
SECURITY.md
```

Responsibilities are explicit:

- `docs/README.md`: documentation index and audience-based navigation.
- `docs/getting-started.md`: host-specific installation, runtime requirements, first invocation, and acceptance check.
- `docs/workflows.md`: create, edit, add-on, rebase, review/integrated view, merge/land, and semantic-decision handoff.
- `docs/live-demos.md`: the complete demo catalog and what each demo proves.
- `docs/architecture.md`: SOT/viewer separation, plugin formats, script boundaries, and data/security boundaries.
- `docs/development.md`: build, test, package, viewer development, and repository layout.
- `docs/reference/consumer-app-generation-profile.md`: the existing profile moved without changing its contract.
- `CONTRIBUTING.md`: local setup, change scope, generated files, tests, and PR expectations.
- `SECURITY.md`: supported versions, private vulnerability reporting guidance, and the no-local-path publication rule.

Links are relative inside the repository. Public site links remain absolute HTTPS URLs.

### 3. Current-Tree Path Removal

Development tools must not contain workstation assumptions.

- `tools/capture-template-screenshots.mjs` loads Playwright through normal package resolution rather than an npm cache path.
- Both marketing tools read `VIBESPEC_MARKETING_ROOT` with no personal fallback.
- Missing dependencies or environment variables produce a short actionable error and a non-zero exit code.
- Documentation uses placeholders such as `<repo-root>`, `<task-folder>`, and `<marketing-root>`.

The implementation may add a development dependency only if the tool is expected to run from this repository. Otherwise, the error must tell the maintainer which package/runtime is required. The implementation plan will choose between these based on the existing package boundary rather than introducing a root package solely for this cleanup.

### 4. Path-Leak CI Guard

A deterministic repository script scans tracked text files and fails on machine-specific path signatures. At minimum it detects:

- Windows user profiles: drive letter plus `Users/<name>` or `Users\\<name>`.
- macOS user homes: `/Users/<name>/`.
- Linux user homes: `/home/<name>/`.
- Personal-system segments such as `OneDrive`, `AppData`, and `WindowsApps` when used in filesystem paths.
- The known local repository roots found during this audit.

The guard does not flag:

- Public GitHub account or repository URLs.
- Deliberate placeholders enclosed in angle brackets.
- Synthetic fixture values that do not identify a real workstation.

Allowlisting is file-and-line-pattern specific, documented in the guard source, and used only when a test must exercise a path detector. A broad directory allowlist is not permitted.

The guard runs in the normal CI workflow and in the full local check. It scans Git-tracked files, not ignored build caches or `.git` internals.

### 5. Two-Phase Delivery

The work is delivered in two operational phases.

#### Phase A: normal repository cleanup

1. Create the documentation structure and shorten both READMEs.
2. Remove current machine-specific paths from development tools.
3. Add the path-leak guard and CI integration.
4. Run documentation-link checks, path audit, plugin checks, browser regressions, and packaging tests.
5. Merge the cleanup through the normal review path.

No history rewrite begins while Phase A is unmerged or while the working tree is dirty.

#### Phase B: public history sanitization

1. Pause repository writes for the rewrite window.
2. Fetch all remote branches and tags, including tags associated with GitHub Releases.
3. Record the remote URL, all ref SHAs, release/tag mapping, and current Pages deployment.
4. Create a full Git bundle backup and verify that it can be listed and cloned.
5. Create a separate mirror clone for the rewrite; do not rewrite the maintainer's working clone in place.
6. Run an official, version-recorded `git-filter-repo` installation against all public branch and tag refs.
7. Replace the exact known personal paths and their slash variants with neutral placeholders or portable equivalents.
8. Prune only commits rendered empty by the rewrite. Preserve meaningful messages, authorship, dates, merge topology, and non-empty granular commits.
9. Delete only remote branches already merged into `main` and identified as stale during the preflight inventory.
10. Push rewritten public branches and tags with lease protection after comparing the expected old ref SHAs.
11. Keep the backup bundle outside the repository until post-rewrite acceptance is complete.

The rewrite must stop before pushing if remote refs changed after the inventory. It must also stop if any replacement changes public URLs, schema content, demo semantics, or executable behavior at rewritten `HEAD`.

### 6. Commit-History Policy

Historical commits are not squashed merely because their messages are terse. Context-bearing implementation and review commits remain valuable.

The rewrite may remove only:

- A commit that becomes empty solely because its only content was a sanitized path.
- An already-merged remote branch ref after its commits are reachable from rewritten `main`.

Future repository policy prefers squash-merging feature branches so the public mainline has one intentional commit per PR. Emergency fixes and release commits may remain direct when repository policy explicitly allows them.

### 7. GitHub Limitations

Force-pushing rewritten refs removes the paths from normal branch and tag history, fresh clones, and standard GitHub browsing. It does not guarantee immediate deletion of:

- Closed PR refs managed by GitHub.
- Cached diffs, forks, local clones, or external archives.
- Unreachable objects retained until GitHub garbage collection.

The exposed values are local paths rather than credentials. Therefore the acceptance target is public branch/tag sanitation plus prevention. If later inspection shows sensitive material or still-public path blobs in GitHub-managed refs, repository-owner support escalation is a separate follow-up.

## Error Handling and Recovery

- Phase A uses a normal branch and can be reverted normally.
- Phase B uses an immutable pre-rewrite Git bundle and a ref manifest containing old and new SHAs.
- A failed filter, test, or ref comparison produces no remote push.
- A partially failed push is treated as an incident: stop all writes, compare remote refs with the manifest, then either complete the planned ref set or restore old refs from the bundle.
- Pages and Releases are verified after the push. Broken Pages deployment is fixed from rewritten `main`; missing release tags are restored from the ref manifest.
- Contributors must re-clone or hard-reset their own clones after the rewrite. The project will publish that instruction before repository writes resume.

## Verification

### Phase A acceptance

- English README is the default and links to Korean at the top.
- Both READMEs present only the meeting-room and CRM demos in their main demo section.
- Every moved section has one canonical documentation destination and no broken relative links.
- Current tracked files contain no real workstation paths.
- Marketing tools fail clearly without `VIBESPEC_MARKETING_ROOT` and accept a supplied root.
- Screenshot tooling resolves Playwright portably or reports the missing dependency clearly.
- The leak guard has positive fixtures for Windows, macOS, and Linux paths and negative fixtures for placeholders and GitHub URLs.
- Existing plugin contract, SOT, browser, package, and Pages build checks pass.

### Phase B acceptance

- A fresh clone of rewritten `main` passes the full Phase A test suite.
- Scanning every rewritten public branch and tag finds no banned real paths.
- The preflight list of meaningful commits remains reachable, except explicitly recorded empty commits.
- Tags used by GitHub Releases point to their rewritten equivalents.
- GitHub Pages deploys successfully and both featured demo URLs return the expected content.
- The default GitHub repository page shows the shortened English README, working Korean link, installation path, and two featured demos.
- The ref manifest records old-to-new SHAs, removed empty commits, deleted stale branches, tool version, test results, and recovery bundle location.

## Rollout Order

1. Documentation and current-tree portability changes.
2. Local and CI leak prevention.
3. Normal review and merge of Phase A.
4. Announced history rewrite window and verified backup.
5. Rewrite, fresh-clone verification, and guarded ref push.
6. GitHub Pages, Releases, README, branch, and tag verification.
7. Contributor re-clone notice and future squash-merge policy.

## Success Criterion

A first-time visitor can understand, install, and try VibeSpec without reading internal implementation detail, while a fresh clone and every normal public branch/tag view contain no personal workstation paths. The cleanup remains recoverable, preserves meaningful engineering history, and prevents the same exposure from recurring.
