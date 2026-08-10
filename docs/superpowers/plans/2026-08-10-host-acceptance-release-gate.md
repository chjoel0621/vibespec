# Host Acceptance Release Gate Implementation Plan

**Goal:** Require portable Claude-family and Codex-family real-host evidence before a VibeSpec release.

**Architecture:** Extend the existing installed verifier to emit privacy-safe, versioned evidence. Add a repository-aware gate that validates a version directory and connect it to tests, documentation, package scripts, and a manual release-readiness workflow.

## Task 1: Evidence contract and verifier

- Add shared host/family and evidence validation helpers.
- Write failing tests for hashes, version metadata, and path privacy.
- Update `verify-host-output.mjs` to emit the portable contract.
- Keep JSON/HTML equivalence and structural validation unchanged.

## Task 2: Release gate

- Write failing tests for missing families, mismatched versions, malformed evidence, and a valid pair.
- Add `check-host-acceptance.mjs` with library and CLI entry points.
- Add an npm script that checks `acceptance/hosts/v<package-version>/` by default.

## Task 3: Documentation and workflow

- Add the committed evidence directory contract and a non-sensitive example policy.
- Update first-install and development/release documentation.
- Add a manually triggered GitHub Actions workflow with a version input.
- Ensure repository path audits accept portable records and reject workstation paths.

## Task 4: Verification and publication

- Run focused host acceptance tests.
- Run `npm run check:all`.
- Review the diff for private paths and generated artifacts.
- Commit and push the feature branch.
