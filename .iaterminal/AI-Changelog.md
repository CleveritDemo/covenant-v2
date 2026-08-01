# AI Changelog
<!-- iaterminal:context {"version":1,"id":"iaterminal:changelog:AI-Changelog","name":"AI Changelog","fileName":"AI-Changelog.md","kind":"changelog","icon":"history","color":"#a3e635"} -->

> Últimos 10 cambios realizados por la IA. Generado automáticamente.

- `2026-08-01T22:41:48.041Z` — `src/renderer/agent/TabContextFormModal.tsx` — Move Preview/Regenerate/Save buttons into TerminalModal footer prop
- `2026-08-01T22:41:48.041Z` — `src/renderer/agent/TabContextsEditor.tsx` — Remove in-body actions block and onSave/onLoadPreview/onRegenerate props
- `2026-08-01T22:41:48.041Z` — `src/renderer/agent/AgentPane.css` — Delete orphaned .tab-contexts__actions rule
- `2026-08-01T22:36:13.080Z` — `src/renderer/agent/TabContextsModal.tsx` — Hide list while form open; focus-from-plane ref closes full session on form dismiss
- `2026-08-01T22:36:13.080Z` — `src/renderer/agent/TabContextFormModal.tsx` — Backdrop/Esc dismiss saves via ref-backed save; closeOnBackdrop; fail keeps modal open
- `2026-08-01T05:43:28.723Z` — `src/renderer/workspace/PlaneChatComposer.tsx` — Effect clears editingQueuedId when edited turn leaves the queue (e.g. after merge)
- `2026-08-01T05:41:02.839Z` — `src/renderer/agent/__tests__/mergeQueuedTurns.test.ts` — Unit tests mergeQueuedTurns: fusión, flags, vacíos, referencia original
- `2026-08-01T05:37:27.603Z` — `src/renderer/agent/mergeQueuedTurns.ts` — New pure mergeQueuedTurns: merges flag-free turns into first position, joins texts, concats images
- `2026-08-01T05:37:27.603Z` — `src/renderer/agent/AgentPane.tsx` — handleMergeQueuedTurns callback, merge in AgentPlaneQueueControls, flags in plane status, props to AgentPaneMessages
- `2026-08-01T05:37:27.603Z` — `src/renderer/agent/AgentPaneMessages.tsx` — Queue header row with merge button when mergeableCount>=2
