# example TL — Results
<!-- iaterminal:context {"version":1,"id":"iaterminal:result:example-tl","name":"example TL","fileName":"results/example-tl.md","kind":"agentResult","icon":"bot","color":"#94a3b8"} -->

<!-- iaterminal:auto -->
## Latest
Fix OK: orchestrator respeta permissionMode del JSON; auto ya no se fuerza a ask.

## Log
- `2026-07-24T19:21:14.192Z` — commandAndArgs usa request.permissionMode
- `2026-07-24T19:21:14.192Z` — Tests 25/25 verdes según fullstack
- `2026-07-24T19:20:11.633Z` — Override en commandAndArgs L589
- `2026-07-24T19:20:11.633Z` — Test forces read-only confirma el bug
- `2026-07-24T19:18:25.128Z` — Agent JSONs referencian ids stemmed correctamente
- `2026-07-24T19:18:25.128Z` — Contextos globales nunca commiteados; otra máquina no los ve
- `2026-07-24T19:14:31.399Z` — Rebase sobre fixes remoto
- `2026-07-24T19:14:31.399Z` — Push main exitoso
- `2026-07-24T18:33:39.441Z` — pendingAgentMigrations always []; rich meta stripped
- `2026-07-24T18:29:41.247Z` — Other machine differs if .iaterminal/session differ
- `2026-07-24T18:29:41.247Z` — Legacy path: pendingAgentMigrations upserts session→catalog
- `2026-07-24T17:46:02.809Z` — Sync onCommit before resetDragVisuals; 5/5 tests
- `2026-07-24T17:43:51.112Z` — Commit sync before resetDragVisuals; add hook tests
- `2026-07-24T17:42:46.502Z` — Catalog/chips/tabContext tests passed; no reorder unit tests
- `2026-07-24T17:39:19.108Z` — Scope: reorder handle, results DnD, own-result block, pool drop
- `2026-07-24T17:31:04.325Z` — No code changes this turn
- `2026-07-24T17:30:31.222Z` — Verified isAgentOwnResultContext in App, AgentPane, picker
- `2026-07-24T17:28:53.126Z` — Guard DnD assign + config toggle/hide own agentResult
- `2026-07-24T17:26:57.247Z` — No stopPropagation on handle up; capture + lostpointercapture
- `2026-07-24T17:25:44.559Z` — Remove handle onPointerUp stop; use capture listeners
- `2026-07-24T17:21:23.787Z` — Verified dragOnMove + HANDLE_DRAG_THRESHOLD_PX
- `2026-07-24T17:20:10.022Z` — Root cause: beginDrag on pointerdown when immediate
- `2026-07-24T17:18:44.888Z` — Handle: no persistEditing; results absolute BR
- `2026-07-24T17:16:53.484Z` — Cause: sticky editing + mini-corner covering header icon
- `2026-07-24T17:12:13.766Z` — Verified PlaneMiniFace drag-handle and files DnD
- `2026-07-24T17:08:29.379Z` — Reorder only via handle; results icon uses planeContextDrag
- `2026-07-24T16:59:10.701Z` — Verified Gravity.css: no ::before, short box-shadow
- `2026-07-24T16:58:27.477Z` — Target: Gravity.css halo/brightness only
<!-- /iaterminal:auto -->

<!-- iaterminal:notes -->
(no annotations yet)
<!-- /iaterminal:notes -->
