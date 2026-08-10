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

El toolchain es Vite 6 + electron-vite 5, que piden Node `^20.19 || >=22.12` (antes bastaba Node 18).
`vitest` se queda en 3.x a propósito: Vite 7/8 exigiría vitest 4, y eso es otro cambio.

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

## The LSP layer (code intelligence)

Ported from Covenant's Rust `crates/lsp` + Tauri commands. Same split, different processes:

- `electron/lsp/` is the engine — `registry.ts` (the server manifest as a TS const: rust-analyzer,
  typescript-language-server, Roslyn, jdtls), `install.ts` (sha256-verified download, `gunzipSync` for gzip and
  shell-out to `unzip`/`tar` for the rest, `npm install --prefix` for npm-method servers), `runtimeDetect.ts`
  (node/dotnet/java on `process.env.PATH`, which `applyLoginShellPath()` already widened), `root.ts`,
  `framing.ts`, `serverProcess.ts`, and `lspOps.ts` (live-server registry, spawn args per install kind, the
  Roslyn `solution/open` vs `project/open` handshake, and the fs trust boundary).
- `src/renderer/lsp/` is the client — `client.ts` (JSON-RPC correlation), `manager.ts` (one `LspClient` per
  server, LRU + idle shutdown, consent in `localStorage`), `cm6.ts` (definition, hover, references panel,
  rename, code actions, diagnostics, completion), `edits.ts` (WorkspaceEdit applier).

Everything crosses via 10 IPC channels + 3 muxed events (`LSP_*` in `ipcChannels.ts`). **The renderer never
sends absolute paths in**: `lspStart(sessionId, relPath)` and the main resolves against the session's explorer
root. Reads/writes for cross-file renames go back through `lspReadFile`/`lspWriteFile`, validated against the
workspace root *main itself* computed with `detectRoot` — and against its realpath, since `/var` →
`/private/var` on macOS would otherwise break the inside-the-project check.

`lspStart` is fully synchronous, which is why it has none of the double-check/race-loser cleanup the Rust
original needs. `detectRuntimeCached` exists because runtime detection is an `execFileSync` on the main
thread; the "Recheck" button clears it.

`electron/__tests__/lspSmoke.test.ts` is the end-to-end check: for each of the four languages it really
installs the server, spawns it and does an `initialize → didOpen → hover`. Skipped unless `LSP_SMOKE=1`, since
it downloads ~290 MB; `LSP_SMOKE_DATA_DIR=/path` reuses the installs across runs. The csharp and java hovers
are deliberately **cross-file** — a same-file hover passes even with the project-load handshake broken
(verified: disabling `solution/open`/`project/open` makes Roslyn return `null` for two minutes). jdtls needs a
JDK ≥ 21 on `PATH`, so a Homebrew-only `openjdk@17` box has to run it as
`PATH="/opt/homebrew/opt/openjdk/bin:$PATH" LSP_SMOKE=1 …`.

## The agent layer

This is the part that requires reading several files to understand.

**Agents live on disk, in the user's project — not in this repo's state.** For a pane whose cwd is
`<project>`, the catalog is `<project>/.gravity/agents/<id>.json` (`ProjectAgentDefinition`:
provider, permissionMode, identity, `contextIds`, `coordination`, `delegateTo`). `session.json` in Electron
userData only stores a thin `AgentPaneBinding` (`agentId` + `threads` + `activeThreadId`) per pane, so agent
definitions are shareable/committable while local session state is not. `electron/projectAgentCatalogOps.ts`
owns read/write plus migration of older inline pane configs.

**Threads** are the pane's conversations (`src/shared/agentThreads.ts`, pure + tested). Gravity never stored
the model's memory — the CLI does, and `--resume <cliSessionId>` recovers it; a thread is just a *local* id
that owns one transcript and remembers which CLI session goes with it. The local id exists because the first
turn has no `cliSessionId` yet (the CLI emits one with its first response), and because the thread must
survive a `--resume` that fails. Five of the nine providers take a resume flag (see
`agentCliProviders.ts`); the rest keep the transcript and start the CLI cold.

- On disk: `agent-chats/<paneId>/<threadId>.json` in userData. A pre-threads flat `agent-chats/<paneId>.json`
  is adopted as thread `t1` on first read (`electron/persistence.ts`); ids are validated before they reach a
  path.
- `AgentPaneMeta.cliSessionId` is a **projection of the active thread**, which is why the whole turn runtime
  is unaware threads exist: `resolveAgentPaneMeta` reads it out, `agentBindingFromMeta` writes it back into
  the active thread. Anything that switches threads must project the new thread's session (`threadPatch`),
  never carry the old meta value over.
- A delegated subtask runs on a fresh CLI **and does not adopt** the session it emits
  (`shouldResumeCliSessionForTurn` gates both ends) — otherwise the specialist's own conversation would be
  replaced by the orchestrator's job.

The folder name is resolved by `projectDirName()` (`electron/projectDir.ts`), never hardcoded: `.gravity`,
unless the project still has the pre-rebrand `.iaterminal` and no `.gravity` — then it keeps using the old one.
Nothing is renamed on disk (the folder lives in the user's repo). The names are `PROJECT_DIR` /
`LEGACY_PROJECT_DIR` in `src/shared/projectDir.ts`. The `iaterminal:` HTML markers and the ` ```ia-terminal-* `
fences below were deliberately NOT renamed — they are persisted inside users' Markdown files and invisible in
the UI, so renaming them would break existing data for zero gain.

**Contexts** are Markdown files under `<project>/.gravity/*.md`, structured by HTML markers:
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
| ` ```ia-terminal-results ` | `electron/aiAgentResults.ts` | appends to `.gravity/results/<agent>.md`, consumable as a context by other agents |
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

The plane's UX intent (`.gravity/About.md`): *control in the center, execution at the periphery* — the user
directs, agents advance.

## Frontend rules (`.cursor/rules/frontend-components.mdc`)

- Shared UI kit components (`src/renderer/components/ui/**`, shared chrome) must **not** expose `className` or
  `style` props. Style through typed props (`size`, `variant`, `pressed`, …). `npm run check:ui` fails the
  build on violations.
- Tooltips are always `components/ui/Tooltip`, never the browser's `title` attribute — the native one ignores
  the theme, has an uncontrollable delay and can't carry the second `hint` line. `check:ui` also fails on a
  `title=` over a DOM element or over a kit component that spreads `{...rest}` (`Button`).
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
- `xlsx` se instala desde el CDN de SheetJS (la URL está en `dependencies`), no desde npm: npm
  se quedó en 0.18.5, que arrastra prototype pollution (CVE-2023-30533) y ReDoS (CVE-2024-22363),
  y las versiones corregidas solo se publican en `cdn.sheetjs.com`. El lock guarda el `integrity`,
  así que `npm ci` es reproducible, pero **el install necesita alcanzar ese host**. Al subir versión
  hay que cambiar la URL a mano; Dependabot no ve este paquete.
- Agent Auto mode (`--permission-mode bypassPermissions` / `--force` / `--yolo`) lets the CLI act unconfirmed.
  Destructive-command heuristics are in `src/shared/agentShellGuard.ts`.
- `src/shared/ptyInputSanitize.ts` strips ANSI before reconstructing typed lines — terminal input parsing
  regressions usually start here.
