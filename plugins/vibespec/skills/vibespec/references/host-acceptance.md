# Host acceptance

Repository tests prove that manifests resolve and a copied plugin bundle can execute outside the source checkout. They do not launch Claude or Codex, install the plugin through that host, or prove that the host injected `$vibespec` into a task.

Run this acceptance check after every plugin release on each supported host:

1. Install or refresh the plugin in the host and start a new task/session.
2. Open the task on a writable empty folder.
3. Invoke VibeSpec explicitly and ask: `Create a compact meeting-room booking plan and save outputs/meeting-room.sot.json and outputs/meeting-room.html.`
4. Confirm that the host created both files without reading the VibeSpec source checkout.
5. Run the installed skill's verifier:

```text
node "<VIBESPEC_SKILL_DIR>/scripts/verify-host-output.mjs" "<workspace>/outputs/meeting-room.sot.json" "<workspace>/outputs/meeting-room.html" --host <host> --record "<workspace>/host-acceptance/<host>.json"
```

Allowed host values are `claude-code`, `cowork`, `codex-cli`, and `codex-desktop`. A release is fully host-accepted only when all supported hosts have a fresh evidence file. CI must describe untested hosts as unverified, never as passed.

If the host cannot run Node or cannot expose the installed skill directory, full SOT+embedded-HTML mode is unavailable. Use the reduced mode documented in `workflows/common.md`, and report that limitation to the user.
