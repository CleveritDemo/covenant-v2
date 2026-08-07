# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Covenant Gravity (package name `gravity`, product name "Covenant Gravity") — an Electron desktop app for macOS that
combines PTY terminals, a file explorer, Git/GitHub Actions and **orchestrated coding agents** in one
workspace. Agents are the local `claude`, `cursor-agent` and `copilot` CLIs driven as child processes; the app
never talks to a model API for agent panes.

Docs and code comments are in Spanish. `README.md` (Spanish) covers user-facing behavior; `FEATURES.md` is an
exhaustive feature inventory; `KNOWN_ISSUES.md` / `ISSUES.md` document xterm/PTY/compositing bugs and their
mitigations — read the relevant entry before touching terminal CSS, themes or pane lifecycle.

## Commands

```bash
npm run dev              # electron-vite dev (main + preload + renderer)
npm test                 # vitest run — 68 files / ~466 tests, ~5s
npm run test:watch
npx vitest run src/shared/__tests__/agentLoop.test.ts        # single file
npx vitest run -t "stops after the cap"                      # single test by name
npm run build            # compile main/preload/renderer into out/
npm run check:ui         # UI-kit contract check (see Frontend rules)
npm run rebuild:native   # rebuild node-pty for the current Electron ABI
npm run dist:dmg         # macOS arm64 DMG
```

There is no linter. `npx tsc -b` typechecks but **currently reports ~36 pre-existing errors** across 11 files
(`App.tsx`, `PaneWindow.tsx`, `planeLoopChain.ts`, `projectAgentCatalog.ts`, several tests) — the build uses
esbuild and does not typecheck, so `tsc -b` is not a pass/fail gate. Compare error counts before/after rather
than expecting zero.

## Process boundaries

Three graphs, deliberately kept apart:

- `electron/` — main + preload. Every privileged operation (PTY, fs, git, spawning agent CLIs) lives here.
- `src/renderer/` — React UI. No Node access; everything goes through `window.api` from `electron/preload.ts`.
- `src/shared/` — types, sanitizers and pure logic imported by **both**. This is why `tabSession.ts`,
  `projectAgentCatalog.ts` etc. live here instead of next to their consumers.

`tsconfig.web.json` (renderer + shared + three preload-safe electron files) and `tsconfig.node.json`
(electron + shared) enforce the split. A renderer file importing from `electron/` will fail typecheck — put
the shared piece in `src/shared/` instead.

Adding an IPC route means touching four places: `src/shared/ipcChannels.ts` (the `IPC` const, ~190 channels),
a handler in `electron/main.ts`, an exposed method in `electron/preload.ts`, and the caller. Aliases
(`@shared`, `@renderer`, `@themes`, `@ai`, `@i18n`) are declared three times — `electron.vite.config.ts`,
`vitest.config.ts`, and both tsconfigs — keep them in sync.

## The agent layer

This is the part that requires reading several files to understand.

**Agents live on disk, in the user's project — not in this repo's state.** For a pane whose cwd is
`<project>`, the catalog is `<project>/.iaterminal/agents/<id>.json` (`ProjectAgentDefinition`:
provider, permissionMode, identity, `contextIds`, `coordination`, `delegateTo`). `session.json` in Electron
userData only stores a thin `AgentPaneBinding` (`agentId` + `cliSessionId`) per pane, so agent definitions are
shareable/committable while local session state is not. `electron/projectAgentCatalogOps.ts` owns read/write
plus migration of older inline pane configs.

**Contexts** are Markdown files under `<project>/.iaterminal/*.md`, structured by HTML markers:
`<!-- iaterminal:context {json} -->` (id/kind/icon), `<!-- iaterminal:auto -->` (host-generated, deterministic)
and `<!-- iaterminal:notes -->` (human- or AI-written annotations). Host kinds (`folderTree`, `files`,
`symbols`, `git`, `deps`, `readme`, `changelog`) are re-materialized from disk at send time by
`electron/tabContextBuild.ts`; `notes` and `agentResult` are attached whole. Large contexts are sent as a
compact catalog (section keys + sizes) and the model requests bodies via a `need-sections` round — budgets and
the full rationale are in `docs/AI_PROJECT_CONTEXT_GUIDE.md`. Full snapshots are re-sent every
`CONTEXT_FULL_REFRESH_INTERVAL_TURNS` (10) turns.

**A turn** is assembled by `composePrompt()` in `electron/agentCliRuntime.ts`: identity → context catalog →
orchestration block → delegation results → images → user request → changelog/results protocols.
`commandAndArgs()` in the same file maps `(provider, permissionMode)` to CLI flags — this is where the
Ask/Auto/Plan semantics actually live (e.g. Claude has no ask mode, so Ask is implemented as
`--disallowedTools Edit,Write,...`). Output is normalized per provider (`normalizeClaudeEvent`,
`normalizeCursorEvent`, `normalizeCopilotEvent`) into one `AgentCliUiEvent` stream.

**Fenced protocols** — the model writes these blocks, main parses and strips them before the text reaches the
chat:

| Fence | Parsed by | Effect |
|---|---|---|
| ` ```ia-terminal-delegate ` | `electron/aiAgentDelegate.ts` | orchestrator/productOwner spawns subtasks on other agents |
| ` ```ia-terminal-results ` | `electron/aiAgentResults.ts` | appends to `.iaterminal/results/<agent>.md`, consumable as a context by other agents |
| ` ```ia-terminal-changelog ` | `electron/aiChangelog.ts` | appends to the project AI changelog |

Caps are constants in `src/shared/agentOrchestration.ts` (`MAX_DELEGATIONS_PER_TURN`,
`MAX_ORCHESTRATION_ROUNDS`) and `src/shared/agentLoop.ts` (`MAX_AGENT_LOOP_ITERATIONS`, `[[LOOP_DONE]]`).

**Multi-agent runtime modes** — all state machines are pure functions in `src/shared/`, tested there, and
driven from the renderer:
- loop chains A→B→C with an interval (`planeLoopChain.ts` + `renderer/workspace/loopOrchestrator.ts`);
- a loop graph with cycle detection (`planeLoopGraph.ts`);
- brainstorm rooms, round-robin turn-taking between agents (`shared/brainstormRoom.ts` + `electron/brainstormRoom.ts`).

When changing any of this, put the decision logic in `src/shared/` as a pure function and keep the
React/Electron side as a thin driver — that is the existing pattern and the reason the test suite is fast.

## Renderer structure

`App.tsx` (~3.3k lines) owns tabs, panes and layout persistence. A tab renders either classic split panes or
the **agentic plane** (`workspace/TabAgenticPlane.tsx`): a canvas of draggable agent/terminal mini-windows
around a central chat composer. `PaneWindow.tsx` implements the floating-window geometry; sizing constants
live in `shared/paneWindows.ts`. `agent/AgentPane.tsx` is the full agent chat; `terminal/TerminalPane.tsx`
wraps xterm.js and its explorer.

The plane's UX intent (`.iaterminal/About.md`): *control in the center, execution at the periphery* — the user
directs, agents advance.

## Frontend rules (`.cursor/rules/frontend-components.mdc`)

- Shared UI kit components (`src/renderer/components/ui/**`, shared chrome) must **not** expose `className` or
  `style` props. Style through typed props (`size`, `variant`, `pressed`, …). `npm run check:ui` fails the
  build on violations.
- Need a different look that props can't express? Create a new component with its own CSS — don't patch with
  `className` or `!important`.
- Allowed: feature-internal BEM classes (`agent-pane__header`), CSS vars set inside the owning component for
  dynamic values, and inline `style` for runtime geometry (virtualizer, drag ratios, menu coords).
- CSS is colocated: `Foo.tsx` + `Foo.css`. Themes are data in `src/themes/presets.ts`.
- All user-facing strings go through i18n (`src/i18n/locales/{en,es}.ts`) — both locales must be updated.

## Tests

Vitest, colocated in `__tests__/` next to the code. Default environment is `node`; React/DOM tests opt in with
a `/** @vitest-environment jsdom */` docblock at the top of the file. Coverage is concentrated on
`src/shared/` pure logic and `electron/` ops — favor extracting logic there over testing components.

## Gotchas

- `node-pty` is native: `postinstall` rebuilds it for Electron. ABI errors after an Electron bump →
  `npm run rebuild:native`.
- User config/session live at `~/Library/Application Support/Covenant Gravity/` (`config.json`, `session.json`).
  `migrateLegacyUserData()` in `electron/main.ts` renames the pre-rebrand `ai-terminal` / `AI Terminal`
  folder on first launch.
  Persisted shapes are versioned and migrated on load in `electron/persistence.ts` — extend migrations, don't
  break old sessions.
- El auto-updater (`electron/selfUpdate.ts` + `UpdateBanner.tsx`) depende del empaquetado: macOS necesita el
  target `zip` junto al `dmg` y Windows el `nsis` (el `portable` no se actualiza). Si se quitan, el updater
  deja de funcionar **sin error**. Ver `docs/AUTO_UPDATER.md`.
- Agent Auto mode (`--permission-mode bypassPermissions` / `--force` / `--yolo`) lets the CLI act unconfirmed.
  Destructive-command heuristics are in `src/shared/agentShellGuard.ts`.
- `src/shared/ptyInputSanitize.ts` strips ANSI before reconstructing typed lines — terminal input parsing
  regressions usually start here.
