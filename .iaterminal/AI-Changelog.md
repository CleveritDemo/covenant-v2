# AI Changelog
<!-- iaterminal:context {"version":1,"id":"iaterminal:changelog:AI-Changelog","name":"AI Changelog","fileName":"AI-Changelog.md","kind":"changelog","icon":"history","color":"#a3e635"} -->

> Últimos 10 cambios realizados por la IA. Generado automáticamente.

- `2026-07-24T20:33:14.182Z` — `src/renderer/App.tsx` — Deriva y propaga los panes destino de delegaciones pendientes.
- `2026-07-24T20:33:14.182Z` — `src/renderer/agent/AgentPane.tsx` — Bloquea composer, envío y drain humano según los nuevos candados.
- `2026-07-24T20:33:14.182Z` — `src/renderer/agent/AgentPaneFooter.tsx` — Muestra placeholder de espera para todos los bloqueos de orquestación.
- `2026-07-24T20:33:14.182Z` — `src/renderer/workspace/PlaneChatComposer.tsx` — Bloquea el composer del plano durante trabajo delegado u orquestador busy.
- `2026-07-24T20:33:14.182Z` — `src/renderer/workspace/TabAgenticPlane.tsx` — Propaga delegationWorkActive y orchestratorBusy al composer del plano.
- `2026-07-24T20:33:14.182Z` — `src/renderer/agent/agentInputGuards.ts` — Centraliza las reglas puras de bloqueo humano y drain.
- `2026-07-24T20:33:14.182Z` — `src/renderer/agent/__tests__/agentInputGuards.test.ts` — Cubre awaiting, orquestador busy y target delegado.
- `2026-07-24T20:32:36.455Z` — `electron/tabContextBuild.ts` — Ingest/filter agentResult con slug normalizado; idRemap de stems no canónicos
- `2026-07-24T20:32:36.455Z` — `electron/aiAgentResults.ts` — migrateLegacy renombra case-only Product-Designer.md vía temp
- `2026-07-24T20:32:36.455Z` — `electron/__tests__/tabContextBuild.test.ts` — Tests casing, cross-assign result:qa, own no autoasignado; orphan aclarado
