# Getting Started

VibeSpec is a plugin for Claude Cowork, Claude Code, and OpenAI Codex. It turns an idea or an attached planning document into a schema-compliant SOT JSON and a dedicated HTML viewer.

## Runtime support

Full mode requires Node.js 18 or later, read access to the installed VibeSpec skill directory, and write access to the task folder. It produces validated JSON and a self-contained HTML viewer and supports safe edits, rebase, maps, and merge. Claude Code and filesystem-enabled Codex tasks normally provide these capabilities.

A Cowork task without Node.js or shell access can use reduced mode. VibeSpec creates the JSON and supplies the unchanged viewer, and the user loads the JSON in that viewer. In this environment VibeSpec cannot claim validated embedded HTML or apply deterministic tree edits.

The `/plugin` slash commands below are for the Claude Code terminal only. They do not work in Cowork or Codex.

## Cowork

Install through the desktop UI:

1. Open **Customize** in the left sidebar.
2. Open the **Plugins** tab. Under **Personal plugins**, select **`+`**, then **Add marketplace**.
3. Choose a GitHub repository and enter `https://github.com/chjoel0621/vibespec.git`.
4. In the added marketplace, select **Install** for `vibespec`.
5. Use the same Plugins screen for updates.

Cowork does not recognize `/plugin`. Use the UI path above.

## Claude Code

Run these commands in the Claude Code terminal input, one after the other:

```text
/plugin marketplace add https://github.com/chjoel0621/vibespec.git
/plugin install vibespec@vibespec
```

To update, run `/plugin marketplace update vibespec`, then update VibeSpec from the Installed tab of the `/plugin` manager.

## OpenAI Codex

Clone the repository and register its repository-local marketplace:

```text
git clone https://github.com/chjoel0621/vibespec.git
codex plugin marketplace add <absolute-path-to-the-cloned-vibespec-repo>
```

In the ChatGPT desktop app, open **Codex -> Plugins**, choose the `vibespec` marketplace, install VibeSpec, and start a new task. In Codex CLI, run `codex`, open `/plugins`, choose the `vibespec` marketplace, install VibeSpec, and start a new session. Invoke the skill naturally or explicitly with `$vibespec`.

## First-install acceptance

Open a new task on a writable folder. Invoke `$vibespec` with a request such as: "Create a compact meeting-room booking plan and save both `outputs/meeting-room.sot.json` and `outputs/meeting-room.html`."

First run the installed doctor:

```text
node <VibeSpec-skill-dir>/scripts/doctor.mjs <task-folder> --json
```

Full-mode acceptance requires the doctor to pass, both output files to exist, and the installed verifier to report PASS:

```text
node <VibeSpec-skill-dir>/scripts/verify-host-output.mjs outputs/meeting-room.sot.json outputs/meeting-room.html --host <claude-code|cowork|codex-cli|codex-desktop> --record host-acceptance/<host>.json
```

The verifier checks that the host-created JSON is structurally valid and exactly matches the SOT embedded in the HTML. Repository CI cannot launch desktop hosts, so a release is described as host-accepted only after this check has run on that host. If VibeSpec is unavailable in a new task, reopen the task after installation or restart the desktop app.

## Manual invocation

Natural-language requests normally activate the skill. When they do not:

- **Cowork:** type `/` in the prompt box or select **`+`**, then choose **VibeSpec**.
- **Claude Code:** run `/vibespec:vibespec`.
- **Codex:** select the VibeSpec plugin or skill, or invoke `$vibespec` in a new task.

Continue with the supported planning flows in [Workflows](workflows.md).
