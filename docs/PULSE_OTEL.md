# Pulse → OTLP — diseño técnico

Cómo exportar la bitácora local de Pulse (`pulse.ndjson`) como métricas OpenTelemetry
vía OTLP, sin romper el contrato de telemetría del main process.

**Estado:** diseño. No hay runtime OTEL en el árbol hoy: cero `@opentelemetry/*`,
cero servidor HTTP en `electron/`. Este documento cierra arquitectura, mapeo,
privacidad y plan de archivos; la implementación va en un slice aparte.

**Anclas del repo (verificadas):**

| Pieza | Dónde |
|---|---|
| Append-only NDJSON | `electron/pulseStore.ts` → `app.getPath('userData')/pulse.ndjson` |
| Contrato “nunca lanza” | `recordPulseEvent` (try/catch vacío) |
| Tipo + agregación pura | `src/shared/pulseEvents.ts` (`PulseEvent`, `aggregatePulse`, `aggregateAgents`) |
| Emisores | `electron/agentCliRuntime.ts` (~1090 derivados, ~1364 `recordTurnInPulse`) |
| Lectura IPC | `IPC.PULSE_SNAPSHOT` en `src/shared/ipcChannels.ts`, handler en `electron/main.ts`, bridge en `electron/preload.ts` |
| Config | `userData/config.json` vía `AppConfig` en `src/shared/configSchema.ts` |

---

## 1. Arquitecturas: push vs scrape local

### (a) Push OTLP/HTTP desde el proceso main

El main lee el NDJSON (o un delta desde un cursor), construye un payload
`ExportMetricsServiceRequest` y hace `POST {endpoint}/v1/metrics` hacia un
Collector / backend OTLP configurable.

| Dimensión | Comportamiento |
|---|---|
| Quién inicia | **Gravity** (cliente). El collector solo escucha. |
| NAT / firewall / laptop suspendida | Funciona detrás de NAT: la laptop abre la salida. Tras suspender, el export se reanuda al despertar; no hay puerto inbound que “muera”. |
| Autenticación | Headers en el POST (`Authorization: Bearer …`, `Api-Key`, mTLS vía `NODE_EXTRA_CA_CERTS` si hace falta). El secreto vive en `config.json` cifrado (mismo patrón que `githubToken` en `SECRET_FIELDS` de `electron/main.ts`). |
| Collector caído | El POST falla o hace timeout. El turno **no** se entera: export en background, cola/descarte (véase §6). No hay socket de escucha que bloquee el event loop del main. |

### (b) Endpoint local embebido (OTLP receiver o `/metrics` Prometheus)

Gravity abre un puerto local (p. ej. `127.0.0.1:4318` OTLP o `:9464` Prometheus).
Un Collector en la misma máquina (o con tunnel) scrapea / hace pull.

| Dimensión | Comportamiento |
|---|---|
| Quién inicia | El **Collector** (o Prometheus). Gravity es servidor. |
| NAT / firewall / laptop suspendida | Scrapes solo llegan si el collector alcanza ese host. En laptops de producto (NAT doméstico, VPN, sleep) el scrape se pierde o hay que forzar sidecar local + outbound del collector. Abrir un puerto en el main añade superficie y choca con políticas corporativas. |
| Autenticación | Bind a loopback mitiga red externa, pero no autentica al scraper local. Auth HTTP en un server casero = más código y más superficie. |
| Collector caído | Gravity sigue sirviendo (o el puerto queda idle). **No hay backpressure natural hacia el NDJSON**: quien no scrapea no lleva datos. Hay que decidir si el server retiene estado en memoria (doble fuente de verdad vs NDJSON) o regenera en cada scrape (CPU en el main). |

### Recomendación cerrada: **(a) push OTLP/HTTP**

Razones, en orden:

1. **Cero servidor HTTP nuevo** en `electron/` — el árbol hoy no tiene uno; meterlo solo por scrape viola el sesgo del repo (driver fino + lógica pura).
2. **Laptops reales**: push saliente sobrevive NAT, sleep y VPN mejor que un puerto local que alguien deba scrapear.
3. **Mismo contrato de resiliencia** que `recordPulseEvent`: fallo de red = log + reintento/descarte, nunca falla un turno.
4. **Auth estándar** en headers del POST, reutilizando el cifrado de secretos de `config.json`.

El scrape local queda como escape hatch documentado (Collector sidecar en
`127.0.0.1` que Gravity empuja), no como arquitectura primaria.

---

## 2. Mapeo `PulseEvent` → métricas OTEL

Pulse no es un contador vivo: es un log de eventos. El exportador **deriva**
métricas sum/histogram a partir de cada evento (o del delta desde el cursor).
Nombres bajo el prefijo `gravity.pulse.*` (producto, no genérico `app.*`).

### Instrumentos

| Métrica | Tipo OTEL | Unidad | Origen (`PulseEvent`) | Notas |
|---|---|---|---|---|
| `gravity.pulse.turns` | Counter (Sum, monotonic) | `{turn}` | `kind === 'prompt'` | Un turno CLI cerrado. |
| `gravity.pulse.tokens` | Counter | `{token}` | `tokensIn` / `tokensOut` en prompts | Atributo `direction=in\|out`. `in` incluye caché (contrato actual del campo). |
| `gravity.pulse.turn.duration` | Histogram | `s` | `durationMs / 1000` en prompts | Buckets sugeridos: `[0.5, 1, 2, 5, 10, 30, 60, 120, 300, 600]`. |
| `gravity.pulse.delegations` | Counter | `{delegation}` | `kind === 'delegate'` | Atributo `role=out\|in` si se emiten dos series (emisor / destino); ver abajo. |
| `gravity.pulse.commits` | Counter | `{commit}` | `kind === 'commit'` **con** `agentId` | Igual que `aggregateAgents`: commits del panel Git sin agente no cuentan como agente. |
| `gravity.pulse.results` | Counter | `{result}` | `kind === 'result'` | Opcional v1; barato y alinea con el roster. |

**Delegaciones:** un solo evento nombra dos agentes (`agentId`, `toAgentId`).
Opciones:

- **v1 (recomendada):** un incremento de `gravity.pulse.delegations` con
  `agent.id=<emisor>` y atributo `delegation.target` omitido o hasheado; el
  destino se puede contar en un segundo datapoint con `role=in` solo si el
  modo de privacidad lo permite.
- No meter ambos ids en la misma serie sin recortar cardinalidad.

### Atributos (resource vs datapoint)

**Resource** (una vez por export, estable por instalación):

| Atributo | Valor |
|---|---|
| `service.name` | `covenant-gravity` |
| `service.version` | `app.getVersion()` |
| `gravity.installation.id` | UUID opaco persistido en userData (no PII) |

**Datapoint / data point attributes** (por evento agregado):

| Campo Pulse | Atributo OTEL | ¿Default ON? | Justificación |
|---|---|---|---|
| `agentId` | `agent.id` | Sí | Cardinalidad acotada al catálogo local (decenas). |
| `provider` | `agent.provider` | Sí | Enum pequeño (`claude` / `cursor` / `copilot` / …). |
| `permissionMode` | `permission_mode` | Sí | `ask` \| `plan` \| `auto` \| `other`. |
| `viaLoop` | `via_loop` | Sí | booleano → `"true"` \| `"false"`. |
| `workspace` | `workspace` | Solo modo “full” | Slug org; PII organizacional. |
| `repo` | `repo` | **No** en default | Basename; explota con muchos clones. |
| `branch` | `branch` | **No** en default | Cardinalidad alta (feature branches). |
| `agentName` | — | Nunca como atributo | Nombre libre; usar solo `agent.id`. |

### Cardinalidad: qué recortar o hashear

Producto peligroso: `repo × branch × agent.id × permission_mode × via_loop`.

**Reglas cerradas:**

1. **Default (`attributes: "aggregate"`):** solo `agent.id`, `agent.provider`,
   `permission_mode`, `via_loop`. Sin `repo` / `branch` / `workspace`.
2. **Modo full (`attributes: "full"`):** añade `workspace`; `repo` y `branch`
   van como **hash corto** (SHA-256 truncado a 12 hex) salvo que
   `includeRepoNames: true` (opt-in explícito, warning en UI).
3. **Techo de series:** si el exportador ve > N combinaciones distintas de
   atributos en una ventana (p. ej. 500), deja de añadir dimensiones nuevas y
   loguea `pulse-otel: cardinality cap`; no tumba el export.

Esto alinea el default con Discord Presence (`discordPresenceEnabled`: off,
sin rutas) y con el hecho de que Pulse ya guarda datos locales sensibles pero
**exportarlos** es otro contrato.

### Ejemplo de payload OTLP/HTTP (JSON)

`POST https://otel.example.com/v1/metrics`  
`Content-Type: application/json`

```json
{
  "resourceMetrics": [{
    "resource": {
      "attributes": [
        { "key": "service.name", "value": { "stringValue": "covenant-gravity" } },
        { "key": "service.version", "value": { "stringValue": "0.39.0" } },
        { "key": "gravity.installation.id", "value": { "stringValue": "7c2e…" } }
      ]
    },
    "scopeMetrics": [{
      "scope": { "name": "gravity.pulse", "version": "1" },
      "metrics": [
        {
          "name": "gravity.pulse.turns",
          "unit": "{turn}",
          "sum": {
            "aggregationTemporality": "AGGREGATION_TEMPORALITY_CUMULATIVE",
            "isMonotonic": true,
            "dataPoints": [{
              "asInt": "42",
              "startTimeUnixNano": "1710000000000000000",
              "timeUnixNano": "1710086400000000000",
              "attributes": [
                { "key": "agent.id", "value": { "stringValue": "orchestrator" } },
                { "key": "agent.provider", "value": { "stringValue": "claude" } },
                { "key": "permission_mode", "value": { "stringValue": "ask" } },
                { "key": "via_loop", "value": { "stringValue": "false" } }
              ]
            }]
          }
        },
        {
          "name": "gravity.pulse.tokens",
          "unit": "{token}",
          "sum": {
            "aggregationTemporality": "AGGREGATION_TEMPORALITY_CUMULATIVE",
            "isMonotonic": true,
            "dataPoints": [
              {
                "asInt": "12000",
                "startTimeUnixNano": "1710000000000000000",
                "timeUnixNano": "1710086400000000000",
                "attributes": [
                  { "key": "direction", "value": { "stringValue": "in" } },
                  { "key": "agent.id", "value": { "stringValue": "orchestrator" } }
                ]
              },
              {
                "asInt": "3400",
                "startTimeUnixNano": "1710000000000000000",
                "timeUnixNano": "1710086400000000000",
                "attributes": [
                  { "key": "direction", "value": { "stringValue": "out" } },
                  { "key": "agent.id", "value": { "stringValue": "orchestrator" } }
                ]
              }
            ]
          }
        },
        {
          "name": "gravity.pulse.turn.duration",
          "unit": "s",
          "histogram": {
            "aggregationTemporality": "AGGREGATION_TEMPORALITY_CUMULATIVE",
            "dataPoints": [{
              "startTimeUnixNano": "1710000000000000000",
              "timeUnixNano": "1710086400000000000",
              "count": "42",
              "sum": 1800.5,
              "bucketCounts": ["2", "5", "10", "8", "7", "5", "3", "1", "1", "0", "0"],
              "explicitBounds": [0.5, 1, 2, 5, 10, 30, 60, 120, 300, 600],
              "attributes": [
                { "key": "agent.id", "value": { "stringValue": "orchestrator" } }
              ]
            }]
          }
        }
      ]
    }]
  }]
}
```

---

## 3. Temporalidad y backfill

El NDJSON es **histórico append-only**, no un `Meter` en memoria. Cada línea es
un hecho pasado. Por eso:

### Cumulative + `start_time_unix_nano` fijo

- Temporalidad: **`AGGREGATION_TEMPORALITY_CUMULATIVE`**.
- `startTimeUnixNano` = timestamp del **primer evento** de la bitácora (o del
  primer evento tras un reset explícito del cursor/archivo), en nanos.
- `timeUnixNano` = momento del export (o `ts` del último evento incluido).

Así un backend que hace delta entre scrapes/exports ve incrementos correctos.
`DELTA` forzaría a recordar “lo que ya mandé” en el payload mismo; cumulative
+ cursor de lectura es más simple y encaja con relecturas del archivo.

### Evitar doble conteo al re-exportar

Releer todo `pulse.ndjson` y volver a sumar desde cero **sin** cursor produce
doble conteo en backends que tratan cada export como delta implícito, o series
que saltan si el backend espera cumulative monotónico pero el cliente
reenvía subconjuntos inconsistentes.

**Cursor persistido** (recomendado: **offset de bytes**):

| Campo | Dónde | Semántica |
|---|---|---|
| `byteOffset` | `userData/pulse-otel-cursor.json` | Bytes ya consumidos de `pulse.ndjson`. El próximo export hace `fs.read(fd, { position: byteOffset })`. |
| `startTimeUnixNano` | mismo archivo | Fijo hasta reset. |
| `lastEventTs` | mismo archivo | Auditoría / fallback si el archivo se truncó. |
| `installationId` | mismo archivo o hermano | Resource attribute. |

**Por qué offset y no solo `ts`:** dos eventos pueden compartir ms; un crash a
mitad de línea deja una línea truncada que `parsePulseLines` ya descarta
(`electron/pulseStore.ts`). El offset avanza solo tras un POST **2xx**, y solo
hasta el final de la última línea completa parseada del chunk.

**Si el archivo encoge** (usuario borró `pulse.ndjson`): resetear cursor a 0 y
nuevo `startTimeUnixNano` (tratar como nueva serie; opcional sufijo
`gravity.pulse.series_epoch` en resource).

Snippet de intención (puro en shared, I/O en electron):

```ts
// src/shared/pulseOtel.ts (nuevo) — decisión pura
export interface PulseOtelCursor {
  byteOffset: number
  startTimeUnixNano: string
  lastEventTs: number
}

export function advanceCursorAfterParse(
  cursor: PulseOtelCursor,
  chunk: string,
  chunkStartOffset: number,
): { events: PulseEvent[]; next: PulseOtelCursor } {
  // parsear líneas completas; next.byteOffset = chunkStartOffset + bytesConsumidos
  // no mutar cursor si el chunk no termina en '\n'
}
```

```ts
// electron/pulseOtelExport.ts (nuevo) — driver
// leer desde pulse.ndjson en cursor.byteOffset → advanceCursorAfterParse
// → buildOtlpMetrics → fetch → si ok, writeCursor(next)
```

---

## 4. Dependencias

### Opción A — SDK oficial

`@opentelemetry/sdk-metrics` + `@opentelemetry/exporter-metrics-otlp-http`
(+ API, resources, core…).

| Pros | Contras |
|---|---|
| Semantic conventions, temporality, retries “de libro” | Árbol grande; en Electron ya hay `node-pty` nativo y rebuild en `postinstall` |
| | Sin linter en el repo: más superficie opaca que auditar |
| | El Meter SDK asume contadores vivos; nosotros partimos de un log — acabaríamos usándolo como transport raro |

### Opción B — JSON OTLP a mano + `fetch`

Construir el envelope del ejemplo de §2 y `fetch(endpoint + '/v1/metrics', { method: 'POST', … })` con `AbortSignal.timeout`.

| Pros | Contras |
|---|---|
| Cero deps nuevas (Node 18+/Electron ya trae `fetch`) | Hay que cuidar el shape protobuf-JSON (ints como string, nanos como string) |
| Encaja con “shared puro + driver fino” | Sin retries del SDK: los escribimos nosotros (§6) |
| Mismo espíritu que instalar `xlsx` desde CDN para no hinchar el árbol | Tests propios del builder |

### Recomendación cerrada: **Opción B (JSON a mano + `fetch`)**

El costo de dependencia en este repo es real (nativos, empaquetado,
`electron-rebuild`). Pulse→OTLP es un export periódico de un archivo local, no
un producto de instrumentación distribuida. Un builder testeable en
`src/shared/` + `fetch` en `electron/` es suficiente y reversible: si más
adelante hace falta traces/logs OTEL, se evalúa el SDK entonces, no ahora.

---

## 5. Privacidad y opt-in

### Flag en `config.json` (default OFF)

Extender `AppConfig` en `src/shared/configSchema.ts` (mismo patrón que
`discordPresenceEnabled`):

```ts
/** Export OTLP de métricas Pulse. Off por defecto: no sale nada de la máquina. */
pulseOtelEnabled: boolean
/** URL base del collector, sin path; se concatena `/v1/metrics`. */
pulseOtelEndpoint: string
/** Header Authorization (Bearer/Api-Key). Vacío = sin auth. Cifrado en disco. */
pulseOtelAuthHeader: string
/**
 * `aggregate` = sin repo/branch/workspace.
 * `full` = workspace + hashes de repo/branch (nombres claros solo si includeRepoNames).
 */
pulseOtelAttributeMode: 'aggregate' | 'full'
/** Solo con attributeMode full: enviar basenames/branch en claro. Default false. */
pulseOtelIncludeRepoNames: boolean
/** Intervalo de export en segundos. Default 60; mínimo 15. */
pulseOtelIntervalSec: number
```

Defaults en `CONFIG_DEFAULTS`:

```ts
pulseOtelEnabled: false,
pulseOtelEndpoint: '',
pulseOtelAuthHeader: '',
pulseOtelAttributeMode: 'aggregate',
pulseOtelIncludeRepoNames: false,
pulseOtelIntervalSec: 60,
```

Añadir `pulseOtelAuthHeader` a `SECRET_FIELDS` en `electron/main.ts`.

### Redacción / hash

| Dato | Modo `aggregate` | Modo `full` |
|---|---|---|
| `agent.id` / `provider` / modos | en claro | en claro |
| `agentName` | omitido | omitido |
| `workspace` | omitido | en claro |
| `repo` / `branch` | omitido | hash 12 hex; en claro solo si `includeRepoNames` |

### Modo “solo agregados”

`attributeMode: "aggregate"` **es** ese modo: contadores globales por agente/proveedor/modo,
sin repo/branch/workspace. Suficiente para dashboards de uso sin filtrar PII de
cliente.

El NDJSON local **no cambia**: Pulse sigue grabando todo para el dashboard in-app
(`PULSE_SNAPSHOT`). El opt-in solo gobierna **qué sale** por red.

---

## 6. Resiliencia (no romper turnos, no bloquear el main)

Contrato heredado de `recordPulseEvent`: la telemetría jamás rompe un turno.

| Control | Valor cerrado |
|---|---|
| Dónde corre | `setInterval` / timer en main; **nunca** en el hot path de `startAgentTurn` / `recordTurnInPulse` |
| Timeout HTTP | `AbortSignal.timeout(5_000)` (5 s) |
| Reintentos | 3 intentos, backoff `1s → 2s → 4s` + jitter ±20 %; solo ante red/5xx |
| Tras agotar reintentos | **No** avanzar cursor; siguiente tick del intervalo reintenta el mismo delta |
| Cola en disco | El NDJSON **es** la cola. No segundo spool salvo un log de fallos |
| Descarte | Si el chunk pendiente supera un techo (p. ej. 5 MiB sin éxito) → log warn, **avanzar cursor** (preferir pérdida de export a memoria/CPU infinita). Documentar en UI |
| Logging | Append a `userData/pulse-otel.log` (misma idea que `updater.log` en `electron/selfUpdate.ts`): timestamp, status, bytes, error. Nunca el auth header. Nunca `console` ruidoso en el camino del agente |
| Fallos de I/O / parse | Swallow + log; igual que `pulseStore` |

El exportador se registra solo si `pulseOtelEnabled && pulseOtelEndpoint.trim()`;
cambiar config vía `CONFIG_SET` rearranca o para el timer.

---

## 7. Plan de implementación (sin ejecutar aún)

Patrón del repo: **decisión pura en `src/shared/` + tests**; **driver fino en
`electron/`**. No tocar `covenant-v2/scripts/**`.

### Paso 1 — Tipos y builder puro (~0.5–1 d)

| Acción | Archivo |
|---|---|
| Crear | `src/shared/pulseOtel.ts` — cursor, hash de atributos, `eventsToOtlpMetrics`, temporality cumulative |
| Crear | `src/shared/__tests__/pulseOtel.test.ts` — fixtures NDJSON → JSON OTLP; no doble conteo con cursor; modo aggregate vs full |
| Tocar | `src/shared/configSchema.ts` — campos + defaults + `mergeWithDefaults` |

### Paso 2 — Driver Electron (~0.5–1 d)

| Acción | Archivo |
|---|---|
| Crear | `electron/pulseOtelExport.ts` — leer NDJSON por offset, `fetch`, cursor JSON, log, timer `startPulseOtelExporter` / `stopPulseOtelExporter` |
| Crear | `electron/__tests__/pulseOtelExport.test.ts` — mock `fetch`, archivo temp (sin app real si se inyecta paths) |
| Tocar | `electron/main.ts` — arrancar/parar según config; `SECRET_FIELDS` += `pulseOtelAuthHeader`; hook tras `CONFIG_SET` |
| **No tocar** | `electron/pulseStore.ts` / `agentCliRuntime.ts` — el append sigue igual; el export es lector aparte |

### Paso 3 — IPC de estado (opcional pero útil para UI) (~0.25–0.5 d)

Cuatro sitios (patrón del repo):

| Acción | Archivo |
|---|---|
| Tocar | `src/shared/ipcChannels.ts` — p. ej. `PULSE_OTEL_STATUS: 'pulseOtel:status'` |
| Tocar | `electron/main.ts` — handler: `{ enabled, lastSuccessAt, lastError, pendingBytes }` |
| Tocar | `electron/preload.ts` — `getPulseOtelStatus()` |
| Tocar | tipado del bridge en preload / `src/renderer` según el patrón existente de `getPulseSnapshot` |

No hace falta IPC para “forzar export” en v1; el intervalo basta. Si se añade
`PULSE_OTEL_FLUSH`, mismos cuatro sitios.

### Paso 4 — UI Ajustes (~0.5 d)

| Acción | Archivo |
|---|---|
| Tocar | `src/renderer/components/SettingsModal.tsx` — sección Advanced `settings-pulse-otel` (junto a Discord): toggle, endpoint, auth, modo de atributos, checkbox nombres de repo |
| Tocar | `src/shared/settingsSearch.ts` / entradas de búsqueda del modal |
| Tocar | `src/i18n/locales/es.ts` + `en.ts` — labels/hints (default OFF, aviso de privacidad) |

### Paso 5 — Docs de operación (~0.25 d)

| Acción | Archivo |
|---|---|
| Actualizar | este `docs/PULSE_OTEL.md` con “cómo activar” + ejemplo de Collector |
| Opcional | mención breve en `README.md` (ruta de config) — solo si el slice de docs lo pide |

### Estimación total

**~2–3 días** de un backend engineer familiarizado con el main process, incluyendo
tests Vitest. Sin cambios a `package.json`.

### Fuera de alcance (v1)

- Servidor Prometheus/OTLP embebido
- SDK `@opentelemetry/*`
- Export de traces/logs
- Cambiar el schema de `PulseEvent` o el append path
- Touch de `covenant-v2/scripts/**`

---

## Checklist de aceptación (para el slice de implementación)

- [ ] `pulseOtelEnabled` default `false` — sin tráfico de red
- [ ] Con enabled + endpoint: POST OTLP JSON cumulative con métricas de §2
- [ ] Cursor por offset; re-export no duplica en el backend
- [ ] Fallo de red / timeout no afecta turnos ni `recordPulseEvent`
- [ ] Modo `aggregate` sin `repo`/`branch`/`workspace`
- [ ] Auth header cifrado en `config.json`
- [ ] Tests en `src/shared/__tests__/pulseOtel.test.ts` verdes
- [ ] Sin dependencias `@opentelemetry/*` nuevas
)
