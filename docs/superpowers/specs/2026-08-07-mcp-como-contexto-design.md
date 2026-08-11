# Contextos desde servidores MCP

Fecha: 2026-08-07

## Problema

Hoy un contexto es siempre un snapshot **local**: `materializeTabContext()` lee el disco del
proyecto y escribe Markdown en `.gravity/`. Los siete `HOST_CONTEXT_KINDS` cubren el repositorio
(`folderTree`, `files`, `symbols`, `git`, `deps`, `readme`, `changelog`) y los dos
`CUSTOM_CONTEXT_KINDS` cubren texto escrito por una persona (`notes`) o por un agente
(`agentResult`).

Nada cubre las fuentes externas donde vive el trabajo: el board de Jira, el sprint, los tickets
asignados. Un PO o un TL que dirige agentes desde el plano agéntico necesita que el estado del
board **enmarque cada turno**, no que el agente decida consultarlo a veces.

No hay ninguna referencia a MCP en el código actual (`grep -ril mcp src electron` → cero
resultados).

## Objetivo

Un tipo de contexto nuevo, `mcp`, que materializa la respuesta de una herramienta MCP como
Markdown seccionado en `.gravity/`, y que desde ahí atraviesa el pipeline existente sin
modificarlo: catálogo compacto, `need-sections`, presupuesto de 8 secciones / 60.000 caracteres.

El rediseño del modal de contextos, que este tipo hace necesario, va en un spec aparte:
`docs/superpowers/specs/2026-08-07-rediseno-modal-contextos-design.md`. Los dos son
independientes y pueden mergear por separado, pero conviene hacer aquel primero — ver
«Interfaz».

## No objetivos

- **MCP como herramienta** (que el agente llame a Jira cuando quiera). Los CLIs que Gravity lanza
  ya leen su propia configuración de MCP; eso es un spec aparte y mucho más pequeño, orientado al
  rol de dev. Este spec cubre solo el snapshot, orientado a PO/TL.
- **MCP resources** (`resources/list` / `resources/read`). Conceptualmente encajarían mejor que
  las tools, pero el MCP de Atlassian expone tools, así que Jira quedaría fuera. Se puede añadir
  después sin romper nada.
- **Scheduler en background.** El refresco es perezoso, al componer el turno.
- **Tests del cliente MCP.** Es el SDK oficial.
- **Renombrar nada en disco.** El nombre de la carpeta lo sigue resolviendo `projectDirName()`.
- **Cambiar el formato de los `.md` ni los ids canónicos.** Un contexto `mcp` es un contexto más.

## Arquitectura

### El invariante que hay que preservar

`materializeTabContext()` (`electron/tabContextBuild.ts:962`) es **síncrono**: devuelve
`TabContextPreviewResult`, no una `Promise`. Toda la cadena por encima lo es —
`sectionsForContext` (`:1341`) → `buildContextSectionCatalog` (`:1399`) → `composePrompt`
(`electron/agentCliRuntime.ts:628`) → `startAgentTurn` (`:910`, `: void`).

Una llamada MCP es asíncrona. Volver async esa cadena sería el cambio grande del feature, y no
hace falta: **el refresco ocurre fuera de la materialización.**

```
ipcMain.on(IPC.AGENT_CLI_START)          electron/main.ts:1332
  ├─ validaciones (sin cambios)
  ├─ stopAgentRun(request.paneId)         ← movido aquí, ver «Carrera» abajo
  ├─ await refreshStaleMcpContexts(...)   ← ÚNICA pieza async nueva
  │    por cada contexto kind='mcp' en request.contexts con el .md vencido:
  │      callTool → mcpResponseToMarkdown → escribir .gravity/<file>.md
  │      si falla: no escribe nada, el archivo anterior queda intacto
  └─ startAgentTurn(...)                  ← sin cambios
       └─ materializeTabContext(kind='mcp') → lee el .md del disco (síncrono)
       └─ markdownSections → catálogo por issue (código existente)
```

El MCP escribe el archivo; el pipeline sigue haciendo lo único que sabe hacer, leer disco. De ahí
salen dos propiedades gratis: si Jira está caído o no hay red, el snapshot anterior sigue en disco
y el turno funciona igual; y el caché por `materializationSignature` (mtime) invalida solo cuando
el archivo cambió de verdad.

**Carrera.** Hoy `startAgentTurn` empieza llamando a `stopAgentRun(request.paneId)` para matar el
turno anterior y reservar el pane. Si se hace `await` antes de eso, un turno previo sigue vivo
hasta 10 s durante el refresco. La mitigación es llamar a `stopAgentRun(request.paneId)` en el
handler, antes del `await`. `startAgentTurn` volverá a llamarlo, y eso es seguro:
`stopAgentRun` es idempotente (`agentCliRuntime.ts:1179`, sale con `if (!run) return`).

`resolveWorkingDirectory()` (`agentCliRuntime.ts:619`) hoy es local. Hay que exportarla para que
el handler resuelva el mismo `cwd` que usará `startAgentTurn`.

### Piezas nuevas

| Archivo | Responsabilidad | ~líneas |
|---|---|---|
| `src/shared/mcpContext.ts` | Puro: `mcpResponseToMarkdown()`, `isSnapshotStale()`. Sin `fs`, sin red. | 40 |
| `electron/mcpClient.ts` | Conectar y llamar tools vía `@modelcontextprotocol/sdk`. Conexión cacheada por servidor, timeout de 10 s. | 80 |
| `electron/mcpContextRefresh.ts` | `refreshStaleMcpContexts(contexts, cwd)`: el paso async del diagrama. | 60 |
| `electron/mcpServers.ts` | Lee `.gravity/mcp.json`; credenciales desde `safeStorage`. | 50 |

Una dependencia nueva: **`@modelcontextprotocol/sdk`**. Escribir el cliente JSON-RPC a mano sería
reimplementar el protocolo.

### Cambios en lo existente

- `src/shared/tabContext.ts` — `'mcp'` en `TabContextKind`, `HOST_CONTEXT_KINDS`,
  `CREATABLE_CONTEXT_KINDS` y `ALL_CONTEXT_KINDS`. Campos opcionales en `TabContext`:
  `mcpServer`, `mcpTool`, `mcpArgs`, `refreshSeconds`. Caso `'mcp'` en `defaultCreatableStem`
  y `canonicalContextName`.
- `electron/tabContextBuild.ts` — rama `'mcp'` en `materializeTabContext`: **solo lee el archivo
  del disco**, no llama a nadie. Y `snapshotAge` en `compactSectionCatalog` (`:1412`), ver
  «Frescura».
- `electron/main.ts` — el handler de arriba, más canales IPC para el modal
  (`MCP_LIST_SERVERS`, `MCP_LIST_TOOLS`) siguiendo el camino de siempre: `ipcChannels.ts` →
  handler en `main.ts` → método en `preload.ts` → llamador.
- `src/shared/tabContextAppearance.ts`, `src/renderer/agent/tabContextKindIcons.ts` — icono y
  color por defecto del kind.
- `src/i18n/locales/{en,es}.ts` — cadenas nuevas en los dos idiomas.

**`sectionsForContext` no se toca.** Cae al `else` final (`:1359`) y usa `markdownSections`, así
que el seccionado por issue sale del código que ya existe. Este es el pilar del diseño y tiene un
test dedicado.

### Modelo de datos

`.gravity/mcp.json` — commiteable, define servidores, **nunca tokens**:

```json
{
  "jira": { "transport": "http", "url": "https://mcp.atlassian.com/v1/sse" }
}
```

Credenciales en `safeStorage`, en userData, junto al resto de la configuración de usuario.

La definición del contexto vive donde vive la de cualquier otro: en el `.md`, en el marcador
`<!-- iaterminal:context {json} -->`, más `contextIds` en `.gravity/agents/<id>.json`.

El `.md` materializado se añade a `.gitignore`. No tanto por confidencialidad como por ruido: un
board que cambia cada diez minutos ensucia el historial. La **definición** sí se commitea, así el
equipo comparte la configuración y cada uno materializa su propio snapshot.

### Las tres reglas de conversión

`mcpResponseToMarkdown(text)`, en orden:

1. Si el texto ya contiene headings `##`, se devuelve tal cual.
2. Si parsea como JSON y es un array de objetos (o un objeto con una única propiedad que es un
   array de objetos), se emite un `##` por elemento. El título del heading es el valor del primer
   campo que exista entre `key`, `id`, `name`; si no existe ninguno, se usa el índice
   (`## 1`, `## 2`, …). El cuerpo son los campos escalares restantes, uno por línea.
3. Cualquier otra cosa: una sola sección `## Contenido`.

Sin campos de configuración en el modal. Cubre Jira y la mayoría de servidores; si aparece un
caso raro, la salida sigue siendo un contexto válido de una sola sección, no un error.

Tope duro `MAX_MCP_RESPONSE_CHARS = 200_000`. Un JQL mal escrito devuelve 5.000 issues; sin tope
eso son ~2 MB escritos en el repositorio del usuario. Se trunca y se anota el truncado.

### Frescura

`markdownSections` (`:1268`) **descarta todo el contenido anterior al primer `##`**: el bucle
devuelve solo las rebanadas delimitadas por headings. Una línea de frescura al principio del
archivo nunca llegaría al modelo. Por eso hacen falta dos piezas, una por lector:

- **Para la persona** — dentro del bloque `iaterminal:auto`, antes del primer heading:
  `> Snapshot 2026-08-07 14:02 · jira · searchJiraIssuesUsingJql`. Se ve en la vista previa y en
  el archivo. Que el seccionador la ignore es correcto: es metadato, no contenido.
- **Para el modelo** — un campo `snapshotAge` (p. ej. `"2h"`) en la entrada del catálogo que
  produce `compactSectionCatalog` (`:1428`), solo cuando el kind es `mcp`. Así lo ve sin tener
  que pedir ninguna sección.

## Errores y estados

Regla que gobierna todo: **un contexto MCP nunca rompe un turno.** El refresco es best-effort.

**Al configurar, en el modal.** Son errores del usuario y bloquean el guardado:

| Fallo | Detección |
|---|---|
| El servidor no está en `.gravity/mcp.json` | el desplegable viene vacío |
| Sin credenciales u OAuth vencido | al elegir servidor se llama a `tools/list`; si falla, banner con acción **Conectar** |
| Tool inexistente o argumentos inválidos | el mismo `tools/list` puebla el desplegable de tools; los argumentos se validan contra su schema |

Ese `tools/list` al elegir servidor hace tres cosas de una: valida credenciales, puebla el
desplegable y evita que el usuario escriba nombres de tool a mano.

**Al refrescar, durante el turno.** No bloquean nada: servidor caído, timeout de 10 s, respuesta
vacía. No se escribe el archivo, se conserva el anterior, se registra en el log. El modal muestra
el estado en el medidor la próxima vez que se abra.

## Interfaz

El rediseño del modal vive en su propio spec:
`docs/superpowers/specs/2026-08-07-rediseno-modal-contextos-design.md`. Aquí solo lo que el kind
`mcp` necesita del formulario, sea cual sea su forma final.

**Cuatro campos** que ningún otro tipo pide:

| Campo | Control | De dónde salen los valores |
|---|---|---|
| Servidor | desplegable | claves de `.gravity/mcp.json` |
| Herramienta | desplegable | `tools/list` del servidor elegido |
| Argumentos | según el schema de la tool | plantilla prerrellenada + campos avanzados |
| Refrescar cada | desplegable | `refreshSeconds`, por defecto 600 |

Las **plantillas** existen para que un PO no tenga que escribir JQL desde cero: tres o cuatro por
servidor conocido («Mi sprint actual», «Mi backlog», «Bugs abiertos»), cada una un par
`(tool, args)` ya relleno, con los campos crudos detrás de un desplegable de avanzado.

**Dos estados** que ningún otro tipo tiene y que necesitan un sitio visible: «sin credenciales u
OAuth vencido» y «el último refresco falló, estás viendo el snapshot de las 14:02».

En el rediseño ese sitio es el medidor de presupuesto del panel derecho, donde ya está mirando
quien va a guardar. En el modal actual no hay ningún sitio equivalente, y los cuatro campos serían
cuatro filas más empujando la cosmética todavía más abajo. Por eso, aunque los dos specs son
independientes y pueden mergear por separado, **conviene implementar el rediseño primero**: al
revés, MCP paga el coste de encajar en un formulario que se va a rehacer.

Mockup interactivo de ambas cosas, con el tipo MCP seleccionable:
<https://claude.ai/code/artifact/eefb584c-d5c6-4ea0-bce7-495078ffae9c>

## Tests

Vitest, colocado en `__tests__/`, entorno `node`.

**`src/shared/__tests__/mcpContext.test.ts`** — donde vive el riesgo, porque las tres reglas son
heurísticas:

- `mcpResponseToMarkdown`, regla 1: texto que ya trae `##` se devuelve intacto.
- Regla 2: array de objetos → un `##` por item; key desde `key`, desde `id`, desde `name`, y el
  caso en que no existe ninguno (índice).
- Regla 3: texto suelto → una sola sección `## Contenido`.
- Truncado al llegar a `MAX_MCP_RESPONSE_CHARS`.
- `isSnapshotStale`: vencido, fresco, archivo inexistente (cuenta como vencido),
  `refreshSeconds` en 0.

**`electron/__tests__/mcpContextRefresh.test.ts`**, con un cliente MCP falso:

- Refresca solo los contextos vencidos; ignora los frescos.
- Error o timeout → **no escribe**; el archivo anterior queda intacto byte a byte.
- Éxito → escribe con los marcadores y la línea de snapshot.
- Contextos que no son `mcp` → no se tocan.

**`electron/__tests__/tabContextBuild.test.ts`**, un caso nuevo: un `.md` de kind `mcp` puesto a
mano en disco → `buildContextSectionCatalog` lo devuelve seccionado por issue key. Verifica que la
rama «kind desconocido cae a `markdownSections`» funciona de verdad, que es el pilar del diseño.

El cliente MCP no se testea: es el SDK.

## Seguridad

El cuerpo de un contexto MCP es texto que escribió otra persona en Jira. Un ticket cuya
descripción diga «ignora tus instrucciones anteriores» va a llegar al prompt. El pipeline ya marca
los cuerpos de sección como datos del proyecto no confiables y no como instrucciones
(`docs/AI_PROJECT_CONTEXT_GUIDE.md`, «Orden recomendado del prompt»); **la rama `mcp` tiene que
pasar por ese mismo marcado y no por el camino de `notes`**, que se adjunta entero y con menos
ceremonia.

Las credenciales nunca se escriben en `.gravity/`. El `.md` materializado va a `.gitignore`.

## Orden de implementación

1. `src/shared/mcpContext.ts` y sus tests. Es puro y no depende de nada.
2. El kind `mcp` en los tipos compartidos y en `materializeTabContext` (solo lectura de archivo),
   más el test de seccionado en `tabContextBuild.test.ts`. Con un `.md` escrito a mano, el
   contexto ya funciona de punta a punta sin cliente MCP.
3. `mcpServers.ts` y `mcpClient.ts` con el SDK.
4. `mcpContextRefresh.ts`, el handler de `main.ts` y `snapshotAge` en el catálogo.
5. Los cuatro campos y los dos estados en el modal.

Los pasos 1 y 2 dejan el feature verificable antes de tocar nada de red.

El paso 5 asume que el rediseño del modal ya está hecho. Si se decide implementar MCP antes, ese
paso crece: hay que meter cuatro campos y dos estados en el formulario actual, sabiendo que se
va a rehacer.
