# AI Changelog
<!-- iaterminal:context {"version":1,"id":"iaterminal:changelog","name":"AI Changelog","fileName":"changelog.md","kind":"changelog","icon":"history","color":"#a3e635"} -->

> Últimos 10 cambios realizados por la IA. Generado automáticamente.

- `2026-07-23T15:02:04.390Z` — `src/shared/projectAgentCatalog.ts` — planAgentCatalogMigration: session rica → writes+bindings
- `2026-07-23T15:02:04.390Z` — `electron/projectAgentCatalogOps.ts` — migratePersistedSessionAgents escribe agentes en disco
- `2026-07-23T15:02:04.390Z` — `electron/persistence.ts` — loadSession migra y reescribe session slim
- `2026-07-23T15:02:04.390Z` — `scripts/migrate-agents-to-project.mjs` — Script one-shot session.json → .iaterminal/agents
- `2026-07-23T15:02:04.390Z` — `package.json` — Script npm migrate:agents
- `2026-07-23T14:53:33.622Z` — `src/shared/projectAgentCatalog.ts` — Tipos, parse, slug, resolve y migración legacy→definición
- `2026-07-23T14:53:33.622Z` — `src/shared/tabSession.ts` — agentByPane pasa a binding agentId+cliSessionId
- `2026-07-23T14:53:33.622Z` — `electron/projectAgentCatalogOps.ts` — list/upsert/delete en .iaterminal/agents
- `2026-07-23T14:53:33.622Z` — `electron/main.ts` — IPC PROJECT_AGENTS_LIST/UPSERT/DELETE
- `2026-07-23T14:53:33.622Z` — `electron/preload.ts` — API list/upsert/delete project agents
