# Releasing VibeSpec

## Required gates

A release candidate is ready to tag only after:

1. `npm run check:all` passes from `plugins/vibespec/skills/vibespec`.
2. A fresh full-mode installation succeeds on at least one Claude-family host.
3. A fresh full-mode installation succeeds on at least one Codex-family host.
4. Both portable records match the exact plugin version and `npm run check:host-acceptance` passes.
5. The **Host acceptance release gate** GitHub Actions workflow passes for that version.

Claude-family hosts are `claude-code` and `cowork`. Codex-family hosts are `codex-cli` and `codex-desktop`. Reduced-mode Cowork output does not satisfy the release gate because it cannot prove validated embedded HTML.

## Release sequence

1. Merge the release candidate and version bump to `main`, but do not create the tag yet.
2. Install that `main` candidate in fresh Claude and Codex sessions and generate independent artifacts.
3. Commit only the two portable evidence records. Do not change plugin runtime files after acceptance.
4. Run the local gate and the manual GitHub Actions gate.
5. Tag and publish the exact evidence commit.

If any runtime-bundle file changes after acceptance, its digest changes and the gate rejects the old records. Repeat both real-host checks before tagging.

## Documentation and candidate audits

Treat documentation as part of every release, not as a follow-up task:

- Maintain `CHANGELOG.md` under **Unreleased** while preparing the candidate. Move entries to the actual version/date only when publishing that version; keep known blockers explicit.
- Update affected usage, compatibility, migration, recovery, and troubleshooting guidance. Add links from the documentation index when a new workflow becomes user-facing.
- Record the exact commands, pass/fail results, untested boundaries, and release decision in a dated report. Preserve earlier failures as historical evidence rather than rewriting them as successes.
- Run repository path/privacy and Markdown-link checks after documentation edits. Keep private raw host outputs and workstation paths out of published material.
- Finalize runtime-bundled documentation before collecting host acceptance evidence; changing it afterward also invalidates that evidence.

For the lifecycle journal candidate, run all three audits from the repository root in addition to `check:all`:

```text
node evaluation/lifecycle/logic-matrix.mjs --write outputs/lifecycle-logic-release-new.json
node evaluation/lifecycle/holdout.mjs --write outputs/lifecycle-holdout-release-new.json
node evaluation/lifecycle/resilience.mjs --write outputs/lifecycle-resilience-release-new.json
```

The output parent directory must exist and each report path must be new. These are separate
audits, not currently part of `check:all`. Exit code 1 blocks this candidate's publication;
do not weaken expectations or relabel failures to proceed. Automated test success does not
replace fresh installed-host evidence or the remote release gate.

## Canonical acceptance task

Use a new writable task folder and a fresh task or session for each host. Install or update the release candidate, invoke VibeSpec explicitly, and request:

> Create a compact meeting-room booking plan and save both `outputs/meeting-room.sot.json` and `outputs/meeting-room.html`.

The host must load the installed skill, run its doctor/preflight, and create both files. Do not reuse artifacts created by another host.

## Generate portable evidence

After the host reports its installed VibeSpec skill directory, run the verifier from that installed plugin:

```text
node <VibeSpec-skill-dir>/scripts/verify-host-output.mjs outputs/meeting-room.sot.json outputs/meeting-room.html --host <host> --record host-acceptance/<host>.json
```

The verifier proves that the SOT is structurally valid and exactly matches the SOT embedded in the HTML. Its record contains the installed runtime-bundle digest plus artifact basenames and SHA-256 hashes; it excludes local paths and raw task content. The bundle digest prevents evidence from being reused after runtime files change without a version bump.

Copy the generated record into the source repository without editing it:

```text
acceptance/hosts/vX.Y.Z/<host>.json
```

Repeat in the other host family. Multiple records are allowed, but at least one accepted record per family is required.

## Run the release gate

Confirm that the package and both plugin manifests already carry the intended version. Then run:

```text
cd plugins/vibespec/skills/vibespec
npm run check:host-acceptance
```

The command fails when evidence is missing, malformed, from another plugin version, or contains fields outside the portable contract.

Push the records and run **Actions -> Host acceptance release gate -> Run workflow** with the same `X.Y.Z` version. This workflow validates committed evidence; it does not launch Claude or Codex.

## Privacy and audit boundary

Commit only the generated portable JSON records. Keep raw host logs and generated product artifacts private unless they are intentionally published as release assets. Never add workstation paths, credentials, personal prompts, or customer plans to acceptance evidence.
