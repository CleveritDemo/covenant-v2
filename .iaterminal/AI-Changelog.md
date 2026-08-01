# AI Changelog
<!-- iaterminal:context {"version":1,"id":"iaterminal:changelog:AI-Changelog","name":"AI Changelog","fileName":"AI-Changelog.md","kind":"changelog","icon":"history","color":"#a3e635"} -->

> Últimos 10 cambios realizados por la IA. Generado automáticamente.

- `2026-08-01T00:14:07.183Z` — `src/renderer/components/SettingsModal.tsx` — handleRequestClose guarda al cerrar por backdrop/Escape con guard de saving; Cancelar sigue descartando
- `2026-07-31T22:44:51.815Z` — `src/renderer/components/SettingsModal.tsx` — Prop closeOnBackdrop añadida al TerminalModal de ajustes
- `2026-07-31T22:41:42.232Z` — `src/renderer/App.tsx` — Guard de projectFolder en toggleTabExplorer; explorerSessionId null sin carpeta; explorerCwd = projectCwd; prop explorerEnabled a TerminalPane
- `2026-07-31T22:41:42.232Z` — `src/renderer/terminal/TerminalPane.tsx` — Nueva prop explorerEnabled (default true) propagada a PaneToolbar
- `2026-07-31T22:41:42.232Z` — `src/renderer/terminal/PaneToolbar.tsx` — Prop explorerEnabled; botón de explorador no se renderiza cuando es false
- `2026-07-31T22:35:41.560Z` — `src/shared/ipcChannels.ts` — Canal FILE_EXPLORER_SET_ROOT para fijar raíz del explorador
- `2026-07-31T22:35:41.560Z` — `electron/main.ts` — Mapa explorerRootBySession, explorerRootForSession en handlers FILE_EXPLORER_*, cleanup en PTY_KILL
- `2026-07-31T22:35:41.560Z` — `electron/preload.ts` — Expone fileExplorerSetRoot en la API del preload
- `2026-07-31T22:35:41.560Z` — `src/renderer/App.tsx` — SetRoot al abrir explorador y al cambiar projectFolder; explorerCwd prioriza projectFolder
- `2026-07-31T22:10:22.184Z` — `src/renderer/components/AiMarkdown.css` — Gate reduce-motion: cursor ai-md-blink sin animación, opacity 1
