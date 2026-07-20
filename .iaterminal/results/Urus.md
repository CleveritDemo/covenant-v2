# Urus
<!-- iaterminal:context {"version":1,"id":"iaterminal:result:Urus","name":"Urus","fileName":"results/Urus.md","kind":"agentResult","icon":"bot","color":"#94a3b8"} -->

<!-- iaterminal:auto -->
## Latest
Open verified: 2 HIGH (shell $() inject; GREP/GLOB bypass off). stripThinking MED closed.

## Log
- `2026-07-20T18:58:09.017Z` — VERIFIED HIGH: JSON.stringify -lc $(cmd) injection
- `2026-07-20T18:58:09.017Z` — VERIFIED HIGH: Ollama GREP/GLOB/git-diff ignore shell off
- `2026-07-20T18:58:09.017Z` — CLOSED: stripThinking tag mismatch not present in current code
- `2026-07-20T18:40:53.187Z` — FIXED: prior 4 HIGH (shell guard, search policy, always confirm, nested .env)
- `2026-07-20T18:40:53.187Z` — HIGH: JSON.stringify in -lc allows $(cmd) injection
- `2026-07-20T18:40:53.187Z` — HIGH: Ollama GREP/GLOB/git-diff ignore shell policy off
- `2026-07-20T18:40:53.187Z` — MED: stripThinking mismatched close tag still present
- `2026-07-20T18:34:03.522Z` — HIGH: search_files bypasses shell off
- `2026-07-20T18:34:03.522Z` — HIGH: always+destructive silent reject
- `2026-07-20T18:34:03.522Z` — HIGH: nested .env not blocked
- `2026-07-20T18:34:03.522Z` — HIGH: main agentShell:run no destructive guard
- `2026-07-20T18:34:03.522Z` — MED: native write skips user-intent filter
- `2026-07-20T18:33:24.112Z` — HIGH: search_files bypasses shell off
- `2026-07-20T18:33:24.112Z` — HIGH: always+destructive silent reject
- `2026-07-20T18:33:24.112Z` — HIGH: nested .env not blocked
- `2026-07-20T18:33:24.112Z` — HIGH: main agentShell:run no destructive guard
- `2026-07-20T18:31:34.133Z` — Shell IPC: main has no destructive guard
- `2026-07-20T18:31:34.133Z` — search_files skips shell policy check
- `2026-07-20T18:31:34.133Z` — always+destructive: confirmShell unwired → silent reject
- `2026-07-20T18:31:34.133Z` — Nested .env paths not matched by ^\.env
- `2026-07-20T18:27:27.646Z` — Main agentShell:run has no destructive guard
- `2026-07-20T18:27:27.646Z` — search_files ignores shell policy off
- `2026-07-20T18:27:27.646Z` — always+destructive silently rejects (no confirmShell)
- `2026-07-20T18:27:27.646Z` — isSensitiveWritePath misses nested .env
<!-- /iaterminal:auto -->

<!-- iaterminal:notes -->
(no annotations yet)
<!-- /iaterminal:notes -->
