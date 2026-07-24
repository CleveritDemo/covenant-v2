# qa
<!-- iaterminal:context {"version":1,"id":"iaterminal:result:qa","name":"qa","fileName":"results/qa.md","kind":"agentResult","icon":"bot","color":"#94a3b8"} -->

<!-- iaterminal:auto -->
## Latest
Más bugs en modal: rollback incompleto tras upsert fallido; loop desde config aborta busy; multi-orquestador; draft desync.

## Log
- `2026-07-24T01:35:13.977Z` — Upsert fail: handoff/mensaje no se revierten
- `2026-07-24T01:35:13.977Z` — Loop toggle busy→startLoop aborta turno
- `2026-07-24T01:35:13.977Z` — Sin límite a 1 orchestrator; a11y listbox/checkbox
- `2026-07-24T00:57:31.325Z` — handleAgentMetaChange sin update optimista del catálogo
- `2026-07-24T00:57:31.325Z` — cwd vacío: cambios no upsert
- `2026-07-24T00:57:31.325Z` — permission/model habilitados con loopActive; provider no
- `2026-07-23T19:58:13.432Z` — Previos config/menu parcialmente resueltos
- `2026-07-23T19:58:13.432Z` — Toggle UI sin callers; ThemePickerTrigger importa Button sin usarlo
- `2026-07-23T19:58:13.432Z` — Duplicidad composer pane vs plane; kind cards raw
- `2026-07-23T19:46:50.118Z` — UI contract check:ui pasa
- `2026-07-23T19:46:50.118Z` — ~91 buttons raw; Toggle/ChoiceCard/Input infrautilizados
- `2026-07-23T19:46:50.118Z` — Duplicidad context pickers y segment toggles
- `2026-07-23T16:12:23.626Z` — Dead IPC: projectAiContext, agentMd R/W, agentFile, agentShell
- `2026-07-23T16:12:23.626Z` — Legacy planeLoopGraph helpers; sanitize still live
- `2026-07-23T16:12:23.626Z` — Helpers/test-only: buildLoopPrompt, requiresShellConfirmation, etc.
- `2026-07-23T16:03:08.378Z` — Deleted orphans + protocol/writeGuard/contextBuilder/tools
- `2026-07-23T16:03:08.378Z` — Trimmed ollama/anthropic/openai and unused exports
- `2026-07-23T16:03:08.378Z` — Related unit tests green
- `2026-07-23T15:58:39.138Z` — Orphans: ollamaModels, stripShellPromptPrefix, agentWriteGuard
- `2026-07-23T15:58:39.138Z` — Dead: protocol extractors, ollama prompt builders, pane drag thumb, AI_TOOLS turns
- `2026-07-23T15:58:39.138Z` — Dato huérfano: color en example2.json post-schema
- `2026-07-23T04:12:40.809Z` — stop conserva cursor
- `2026-07-23T04:12:40.809Z` — interval→objective[0]
- `2026-07-23T04:12:40.809Z` — start sin projectFolder
- `2026-07-23T04:12:40.809Z` — multi-chain mismo pane
- `2026-07-23T04:08:39.285Z` — interval modal→objective[0]
- `2026-07-23T04:08:39.285Z` — no edit steps 1..n
- `2026-07-23T04:08:39.285Z` — stop conserva cursor
- `2026-07-23T04:08:39.285Z` — agente en N cadenas
- `2026-07-23T04:08:39.285Z` — sin validar projectFolder
<!-- /iaterminal:auto -->

<!-- iaterminal:notes -->
(no annotations yet)
<!-- /iaterminal:notes -->
