# Getting Started

VibeSpec is a plugin for Claude Cowork, Claude Code, and OpenAI Codex. It turns an idea or an attached planning document into a schema-compliant SOT JSON and a dedicated HTML viewer.

## Runtime support

Full mode requires Node.js 18 or later, read access to the installed VibeSpec skill directory, and write access to the task folder. It produces validated JSON and a self-contained HTML viewer and supports safe edits, rebase, maps, and merge. Claude Code and filesystem-enabled Codex tasks normally provide these capabilities.

A Cowork task without Node.js or shell access can use reduced mode after the user accepts that limitation. VibeSpec provides the SOT JSON. If the host can read and copy the installed `assets/viewer.html`, VibeSpec also supplies that unchanged viewer for the user to load the JSON into; without asset access, only the JSON can be provided. In this environment VibeSpec cannot claim validated embedded HTML or apply deterministic tree edits.

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
codex plugin marketplace add "<absolute-path-to-the-cloned-vibespec-repo>"
```

Replace the quoted placeholder with the absolute path to the cloned repository.

In the ChatGPT desktop app, open **Codex -> Plugins**, choose the `vibespec` marketplace, install VibeSpec, and start a new task. In Codex CLI, run `codex`, open `/plugins`, choose the `vibespec` marketplace, install VibeSpec, and start a new session. Invoke the skill naturally or explicitly with `$vibespec`.

## First-install acceptance

Open a new task on a writable folder. Select **VibeSpec** in Cowork, invoke `/vibespec:vibespec` in Claude Code, or invoke `$vibespec` in Codex. Then request: "Create a compact meeting-room booking plan and save both `outputs/meeting-room.sot.json` and `outputs/meeting-room.html`." In reduced mode, VibeSpec may provide only the JSON and includes the unchanged viewer only when the host can access the installed viewer asset.

The loaded skill owns discovery of its installed path and runs doctor/preflight before it uses repository scripts. Do not guess or hard-code `<VibeSpec-skill-dir>`. For optional host acceptance after the host or loaded skill reports that path, run:

```text
node <VibeSpec-skill-dir>/scripts/doctor.mjs <task-folder> --json
```

Full-mode acceptance requires doctor/preflight to pass, both output files to exist, and the installed verifier to report PASS:

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
