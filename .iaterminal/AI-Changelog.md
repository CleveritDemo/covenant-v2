# AI Changelog
<!-- iaterminal:context {"version":1,"id":"iaterminal:changelog:AI-Changelog","name":"AI Changelog","fileName":"AI-Changelog.md","kind":"changelog","icon":"history","color":"#a3e635"} -->

> Últimos 10 cambios realizados por la IA. Generado automáticamente.

- `2026-08-05T21:17:51.795Z` — `electron/agentCliModelsList.ts` — Needle sweagent-capi, PATH/realpath + cache universal, error fallback sin help
- `2026-08-05T21:17:51.795Z` — `electron/__tests__/agentCliModelsList.test.ts` — Fixtures Hut/JEt, smoke local ≥8, eliminado pass con lista vacía
- `2026-08-05T20:44:45.773Z` — `src/shared/agentCliModels.ts` — COPILOT_AGENT_MODELS ampliado a 20 IDs verificados del paquete CLI
- `2026-08-05T20:44:45.773Z` — `electron/agentCliModelsList.ts` — Umbral Copilot <8 fuerza fallback completo con source=fallback y error
- `2026-08-05T20:38:23.129Z` — `electron/agentCliModelsList.ts` — Copilot con <4 modelos parseados fuerza fallback completo (6) preservando error
- `2026-08-05T20:23:13.089Z` — `electron/agentCliModelsList.ts` — Copilot now falls back to the full static model list when CLI output is insufficient.
- `2026-08-05T20:23:13.089Z` — `electron/__tests__/agentCliModelsList.test.ts` — Added regression test for Copilot auto-only output.
- `2026-08-05T20:16:41.203Z` — `src/renderer/agent/AgentConfigModal.tsx` — No pisa fallback de modelos si el CLI devuelve lista vacía
- `2026-08-05T20:16:41.203Z` — `src/renderer/agent/AgentConfigSettingsPane.tsx` — Misma guarda: setLocalModels solo si result.models.length > 0
- `2026-08-04T18:32:10.760Z` — `electron/agentCliRuntime.ts` — Use cross-spawn for agent CLI run/start turns
