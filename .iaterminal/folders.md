# folders
<!-- iaterminal:context {"version":1,"id":"discovered-file:folders.md","name":"folders","fileName":"folders.md","kind":"folderTree","icon":"folder","color":"#5ec8ff"} -->

<!-- iaterminal:auto -->
ia_terminal/  (project root; paths are relative to this folder)

docs/
electron/
  electron/__tests__/
relative/
  relative/path/
renderer/
scripts/
src/
  src/ai/
  src/i18n/
    src/i18n/__tests__/
    src/i18n/locales/
  src/renderer/
    src/renderer/__tests__/
    src/renderer/agent/
      src/renderer/agent/__tests__/
    src/renderer/components/
      src/renderer/components/__tests__/
      src/renderer/components/ai/
      src/renderer/components/git/
        src/renderer/components/git/__tests__/
      src/renderer/components/ui/
    src/renderer/history/
      src/renderer/history/__tests__/
    src/renderer/styles/
    src/renderer/terminal/
      src/renderer/terminal/__tests__/
      src/renderer/terminal/explorer/
        src/renderer/terminal/explorer/__tests__/
    src/renderer/workspace/
  src/shared/
    src/shared/__tests__/
  src/themes/
<!-- /iaterminal:auto -->

<!-- iaterminal:notes -->
- `docs` — QA + agent context guides
- `electron` — Main/preload/PTY/CLI/contexts
- `src` — Renderer, shared, themes, i18n
- `scripts` — Build/icon helpers
- `electron/tabContextBuild.ts` — Materialize and deliver tab contexts
- `src/renderer/agent` — Agent UI including context modal
- `src/renderer/workspace` — Plano 2D, chat dock y composer
<!-- /iaterminal:notes -->
