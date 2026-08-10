# Real-host acceptance evidence

Each released VibeSpec version must include portable acceptance evidence from:

- at least one Claude-family host: `claude-code` or `cowork`; and
- at least one Codex-family host: `codex-cli` or `codex-desktop`.

Store records under `acceptance/hosts/vX.Y.Z/`. Generate them with the verifier shipped in the installed plugin. Do not hand-edit records and do not commit raw logs, product artifacts, prompts, absolute paths, usernames, or task-folder names.

The release gate validates the exact plugin version and runtime-bundle digest, then requires both host families:

```text
cd plugins/vibespec/skills/vibespec
npm run check:host-acceptance
```

See [Releasing VibeSpec](../../docs/releasing.md) for the real-host procedure.
