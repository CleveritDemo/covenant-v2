# AI Changelog
<!-- iaterminal:context {"version":1,"id":"iaterminal:changelog:AI-Changelog","name":"AI Changelog","fileName":"changelog.md","kind":"changelog","icon":"history","color":"#a3e635"} -->

> Últimos 10 cambios realizados por la IA. Generado automáticamente.

- `2026-07-24T19:20:55.325Z` — `electron/agentCliRuntime.ts` — Use request.permissionMode always; drop orchestrator ask override
- `2026-07-24T19:20:55.325Z` — `electron/__tests__/agentCliRuntime.test.ts` — Expect orchestrator+auto same CLI flags as auto; keep ask case
- `2026-07-24T18:33:19.066Z` — `src/renderer/sessionSanitize.ts` — Drop legacy rich agent panes; migrations always empty; no invented bindings
- `2026-07-24T18:33:19.066Z` — `src/renderer/App.tsx` — Remove migration upsert loop; empty context pool when cwd/discover fails
- `2026-07-24T18:33:19.066Z` — `src/shared/projectAgentCatalog.ts` — planAgentCatalogMigration strips legacy panes; writes always []
- `2026-07-24T18:33:19.066Z` — `electron/projectAgentCatalogOps.ts` — migratePersistedSessionAgents never writes agent JSON from session
- `2026-07-24T18:33:19.066Z` — `electron/tabContextBuild.ts` — Comment: no .iaterminal in cwd yields zero contexts
- `2026-07-24T18:33:19.066Z` — `electron/__tests__/tabContextBuild.test.ts` — Smoke: cwd without .iaterminal returns empty contexts
- `2026-07-24T18:33:19.066Z` — `src/renderer/__tests__/sessionSanitize.test.ts` — Expect legacy panes dropped, not migrated
- `2026-07-24T18:33:19.066Z` — `src/shared/__tests__/projectAgentCatalog.test.ts` — Expect strip/no writes for rich meta migration plan
