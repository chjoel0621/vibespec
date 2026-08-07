# VibeSpec

**English · [한국어](README.ko.md)**

> Turn a product idea into an implementation-ready planning source of truth with Claude or Codex.

## What it creates

Describe an idea or attach a business plan, PRD draft, or meeting notes. VibeSpec creates:

- a schema-compliant `*.sot.json` connecting the PRD, feature specifications, information architecture, user flows, and KPI measurement evidence;
- a self-contained HTML viewer generated from the same SOT for reviewing and editing the plan; and
- structural, content, and measurement checks that keep unresolved decisions visible.

The JSON is the canonical planning source. The HTML is the viewer and editor that reads it.

## Host support

VibeSpec runs as a plugin for Claude Cowork, Claude Code, and OpenAI Codex.

Full mode requires Node.js 18 or later, read access to the installed VibeSpec skill directory, and write access to the task folder. It produces validated JSON and a self-contained HTML viewer and supports safe edits, rebase, maps, and merge. Claude Code and filesystem-enabled Codex tasks normally provide these capabilities.

A Cowork task without Node.js or shell access can use reduced mode. VibeSpec creates the JSON and supplies the unchanged viewer, and the user loads the JSON in that viewer. In this environment VibeSpec cannot claim validated embedded HTML or apply deterministic tree edits.

The `/plugin` slash commands below are for the Claude Code terminal only. They do not work in Cowork or Codex.

## Install

### Cowork

Install through the desktop UI:

1. Open **Customize** in the left sidebar.
2. Open the **Plugins** tab. Under **Personal plugins**, select **`+`**, then **Add marketplace**.
3. Choose a GitHub repository and enter `https://github.com/chjoel0621/vibespec.git`.
4. In the added marketplace, select **Install** for `vibespec`.
5. Use the same Plugins screen for updates.

Cowork does not recognize `/plugin`. Use the UI path above.

### Claude Code

Run these commands in the Claude Code terminal input, one after the other:

```text
/plugin marketplace add https://github.com/chjoel0621/vibespec.git
/plugin install vibespec@vibespec
```

To update, run `/plugin marketplace update vibespec`, then update VibeSpec from the Installed tab of the `/plugin` manager.

### OpenAI Codex

Clone the repository and register its repository-local marketplace:

```text
git clone https://github.com/chjoel0621/vibespec.git
codex plugin marketplace add <absolute-path-to-the-cloned-vibespec-repo>
```

In the ChatGPT desktop app, open **Codex -> Plugins**, choose the `vibespec` marketplace, install VibeSpec, and start a new task. In Codex CLI, run `codex`, open `/plugins`, choose the `vibespec` marketplace, install VibeSpec, and start a new session. Invoke the skill naturally or explicitly with `$vibespec`.

## First request

Open a new task on a writable folder. Run the installed doctor first:

```text
node <VibeSpec-skill-dir>/scripts/doctor.mjs <task-folder> --json
```

Then invoke VibeSpec with:

> Create a compact meeting-room booking plan and save both `outputs/meeting-room.sot.json` and `outputs/meeting-room.html`.

Full-mode acceptance requires the doctor to pass, both output files to exist, and the installed verifier to report PASS:

```text
node <VibeSpec-skill-dir>/scripts/verify-host-output.mjs outputs/meeting-room.sot.json outputs/meeting-room.html --host <claude-code|cowork|codex-cli|codex-desktop> --record host-acceptance/<host>.json
```

If VibeSpec is unavailable in the new task, reopen the task after installation or restart the desktop app. See [Getting started](docs/getting-started.md) for manual invocation and acceptance details.

## Live demos

| Try | Demo |
| --- | --- |
| Create and edit a connected product plan | [Meeting-room planning](https://chjoel0621.github.io/vibespec/en/) |
| Resolve a blocked KPI measurement decision | [CRM KPI Measurement Check](https://chjoel0621.github.io/vibespec/crm/en/review/?view=semantic) |

See [all live demos](docs/live-demos.md) for additional examples and evaluation cases.

## Core workflow

1. Describe a product idea or attach an existing planning document.
2. Review the generated SOT and HTML viewer, including any open KPI measurement decisions.
3. Edit the SOT in the viewer or ask Claude or Codex for a scoped, validated change.
4. Hand the current `*.sot.json` to developers or coding agents as the planning source of truth.

VibeSpec keeps existing IDs stable during scoped edits and closes semantic decisions only after the affected plan passes its checks. Learn about create, edit, initiative, rebase, review, and merge flows in [Planning workflows](docs/workflows.md).

## What VibeSpec does not generate

VibeSpec does not generate or deploy the product's implementation code. It produces planning artifacts for developers and coding agents. It also does not label a plan ready for approval or developer handoff while required KPI decisions or measurement evidence remain unresolved.

## Learn more

- [Documentation index](docs/README.md)
- [Getting started](docs/getting-started.md)
- [Planning workflows](docs/workflows.md)
- [Live demos](docs/live-demos.md)
- [Architecture and data boundaries](docs/architecture.md)
- [Development and testing](docs/development.md)
- [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md)

## License

[MIT](LICENSE) © 2026 chjoel0621
