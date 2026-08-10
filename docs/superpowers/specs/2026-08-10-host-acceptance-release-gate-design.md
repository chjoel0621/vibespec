# Host Acceptance Release Gate Design

**Date:** 2026-08-10
**Status:** Approved

## Goal

Make real-host acceptance a release contract instead of an informal checklist. Every release must carry portable evidence from at least one Claude-family host and one Codex-family host.

## Acceptance policy

- Claude family: `claude-code` or `cowork`.
- Codex family: `codex-cli` or `codex-desktop`.
- A release is host-accepted only when one full-mode record from each family passes.
- Evidence must match the exact plugin version being released.
- Reduced-mode output cannot satisfy the release gate because it cannot prove validated embedded HTML.
- CI validates evidence; it does not claim to launch desktop hosts.

## Evidence layout

Committed evidence lives under:

```text
acceptance/hosts/vX.Y.Z/<host>.json
```

Each record contains only portable facts:

- evidence contract version
- plugin version
- host and host family
- acceptance result and timestamp
- artifact basenames and SHA-256 digests
- SOT title and schema version

Absolute paths, usernames, task folders, prompts, and raw host logs are excluded. Raw artifacts may remain private or be attached separately to a GitHub Release.

## Tooling

`verify-host-output.mjs` remains the command run after a real host creates JSON and HTML. It will emit the portable record directly and derive the plugin version from the installed package.

A new `check-host-acceptance.mjs` command will:

1. Read the expected release version.
2. Load all JSON records from `acceptance/hosts/vX.Y.Z/`.
3. Reject malformed records, unknown hosts, absolute paths, failed records, and version mismatches.
4. Require at least one Claude-family and one Codex-family record.
5. Print a concise release-readiness summary.

## CI and release boundary

Normal pull-request CI must test the evidence contract and verifier without requiring current release evidence. A separate release-readiness command is the hard gate used immediately before tagging or publishing. This avoids making every development commit depend on manually produced host evidence while preventing a release from being described as accepted without it.

The repository will provide a manually triggered GitHub Actions workflow that validates the committed evidence for the requested version. The workflow verifies records only; the real host sessions must already have been run.

## Failure behavior

- Missing either family: fail.
- Record version differs from requested version: fail.
- Record contains a local absolute path: fail.
- Artifact hash or required metadata missing: fail.
- Duplicate records are allowed when all are valid; one passing record per family is sufficient.
- Unknown extra fields are rejected so the evidence contract cannot drift silently.

## Verification

Tests cover portable evidence generation, artifact mismatch rejection, privacy rejection, version mismatch, missing host family, valid two-family acceptance, and the actual release-readiness CLI exit code.
