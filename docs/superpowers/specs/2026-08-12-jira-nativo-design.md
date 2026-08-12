# Jira nativo: la issue como contexto

Fecha: 2026-08-12

Artifact con la versión visual de este documento:
<https://claude.ai/code/artifact/822b7cbd-fa54-4af6-a12e-4c8f594b9790>

## Problema

Jira ya se coló en el código, pero como excepción. Hay iconos `jira` y `atlassian` en el kit de UI
(`src/renderer/components/ui/Icon.tsx:60`), palabras clave de búsqueda
(`src/shared/tabContextAppearance.ts:94`) y frases cableadas en el prompt del turno:
`buildMcpCapabilityPrompt()` (`src/shared/mcpCapabilityPrompt.ts:17`) le dice al modelo
literalmente *«no digas que no tienes acceso a Jira/Atlassian»*.

El producto ya asume que Jira es la fuente del trabajo, pero no sabe nada de una issue. Todo lo que
hay es **MCP como herramienta del CLI**, y eso trae tres problemas:

- **No es universal.** Solo los CLIs que hablan MCP (Claude Code, Copilot, Gemini) alcanzan Jira.
  Con `cursor-agent` la misma pestaña pierde la capacidad sin que nada lo explique.
- **No es visible.** La UI no puede pintar un selector, una tarjeta ni un preview: los datos viven
  dentro del proceso hijo y salen como texto en el transcript.
- **No es determinista.** Que el agente consulte el ticket depende de que decida llamar a la tool.
  El contexto de un turno no debería ser opcional.

El spec `2026-08-07-mcp-como-contexto-design.md` vio esta grieta y propuso materializar respuestas
MCP como contexto. Lo que se construyó fue el estante de herramientas (`McpToolShelf`): útil, pero
es configuración, no contenido. El contexto `mcp` de hoy lista **servidores**
(`src/shared/mcpContext.ts:1`), no issues.

## Objetivo

Que una issue de Jira sea un contexto de primera clase en Gravity:

1. un `TabContextKind` nuevo, `'jira'`, materializado como Markdown seccionado en `.gravity/jira/`;
2. mención en el composer (`GRAV-412` → picker → chip adjunto);
3. tarjeta de issue al pasar el cursor sobre una clave;
4. sugerencia desde el nombre de la rama.

**La prueba de que el diseño está bien:** ninguna función del pipeline de contextos cambia de
firma. Si hubo que volver algo `async`, nos salimos del carril.

## No objetivos

- **Un tablero dentro de Gravity.** Jira ya tiene uno y es mejor. La app aporta la issue *en el
  turno*, no un segundo cliente de Jira.
- **Escrituras nativas** (transicionar, comentar). El agente ya lo hace por MCP. Si aparece la
  demanda, es un fence ` ```ia-terminal-jira ` y el patrón ya existe (`aiAgentResults.ts`).
- **Scheduler en background.** El refresco es perezoso, al componer el turno.
- **OAuth.** API token pegado una vez. OAuth cuando alguien lo pida por política.
- **Jira Server / Data Center.** Solo Cloud en v1; la API v2 de DC cabe después detrás de la misma
  interfaz.
- **Sincronización bidireccional.** El `.md` es un snapshot de lectura más notas locales; editar el
  bloque `auto` no escribe en Jira.
- **Cliente MCP dentro de Electron.** Ver «Datos».

## Arquitectura

### La tesis

Gravity ya tiene un objeto para «pedazo de mundo que enmarca un turno»: el contexto de
`.gravity/*.md`, con catálogo compacto, `need-sections`, presupuesto de 60.000 caracteres
(`MAX_REQUESTED_CONTEXT_CHARS`, `src/shared/contextSections.ts:15`), refresco cada 10 turnos, chips
arrastrables y asignación por agente. Nada de eso hay que volver a construirlo.

Una issue en disco, `.gravity/jira/GRAV-412.md`:

```markdown
<!-- iaterminal:context {"id":"jira-grav-412","kind":"jira","icon":"jira"} -->
<!-- iaterminal:auto -->
## Resumen
GRAV-412 · Loop chain se queda colgada si el agente B muere
Estado: In Progress · Tipo: Bug · Prioridad: High
Asignada a: Rodrigo · Sprint: Sprint 34 · Actualizada: 2026-08-12T09:40:00Z

## Descripción
…

## Criterios de aceptación
…

## Comentarios (últimos 10)
…

## Enlaces y subtareas
…
<!-- /iaterminal:auto -->

<!-- iaterminal:notes -->
Lo que sabemos y Jira no: la carrera está en loopChainFifo, no en el orquestador.
<!-- /iaterminal:notes -->
```

El bloque `auto` lo regenera el host desde Jira; el bloque `notes` es de la persona o del agente y
**sobrevive al refresco** — el espejo exacto de `withAgentResultsNotes()`
(`src/shared/agentResultsDoc.ts:106`), que reemplaza solo `notes` y deja `auto` intacto. Aquí se
reemplaza solo `auto` y se deja `notes`.

Eso ya es producto que Jira no da: el ticket más lo que el equipo aprendió trabajándolo, junto al
código.

Los `##` son las claves de sección que ve el modelo. Un ticket con 80 comentarios no revienta el
presupuesto: entra al catálogo compacto y el agente pide `Comentarios` solo si lo necesita.
**`sectionsForContext` no se toca** — un contexto `jira` cae en el `else` final y usa
`markdownSections`, igual que se diseñó para `mcp`.

### El refresco va antes del turno, no dentro

`materializeTabContext()` (`electron/tabContextBuild.ts:1057`) es **síncrono**, y toda la cadena por
encima también. Volverla async sería el cambio grande del feature y no hace falta: **Jira escribe el
archivo; el pipeline sigue leyendo disco.**

```
ipcMain.on(IPC.AGENT_CLI_START)              electron/main.ts:1874
  ├─ validaciones (sin cambios)
  ├─ stopAgentRun(request.paneId)             ← movido aquí, antes del await
  ├─ await refreshStaleJiraContexts(...)      ← ÚNICA pieza async nueva
  │    por cada contexto kind='jira' vencido:
  │      GET /issue/{key} → issueAutoMarkdown → withJiraAutoBlock → escribir .md
  │      si falla: no escribe nada, el archivo anterior queda intacto
  └─ startAgentTurn(...)                      ← sin cambios
       └─ materializeTabContext(kind='jira')  → lee el .md (síncrono)
       └─ markdownSections                    → catálogo por sección
```

Dos propiedades salen gratis: si Jira está caído o no hay red, el snapshot anterior sigue en disco y
el turno funciona igual; y la caché por `materializationSignature` (mtime) solo invalida cuando el
archivo cambió de verdad.

**Carrera.** `startAgentTurn` hoy empieza llamando a `stopAgentRun(request.paneId)`. Si se hace
`await` antes, un turno previo sigue vivo hasta 10 s durante el refresco. La mitigación es llamar a
`stopAgentRun(request.paneId)` en el handler, antes del `await`; `startAgentTurn` volverá a
llamarlo y es idempotente (sale con `if (!run) return`).

`resolveWorkingDirectory()` (`electron/agentCliRuntime.ts:680`) hoy es local; hay que exportarla
para que el handler resuelva el mismo `cwd` que usará `startAgentTurn`.

### Datos: la app lee por REST, el agente escribe por MCP

Es la decisión central. Son dos caminos porque son dos consumidores distintos: la UI necesita
respuestas rápidas, predecibles y disponibles con cualquier CLI; el agente necesita actuar y ya
tiene tools.

| Camino | Quién | Para qué | Coste |
|---|---|---|---|
| REST v3 desde `electron/` | La app | Buscar, leer, materializar el `.md` | 3 endpoints, `fetch` nativo, cero dependencias |
| MCP de Atlassian | El agente (CLI) | Comentar, transicionar, crear | Ya existe; no se toca |

La alternativa era un cliente MCP dentro de Electron (lo que proponía el spec de agosto). Se
descarta para v1: añade `@modelcontextprotocol/sdk`, arrastra el flujo OAuth del server remoto de
Atlassian y devuelve texto pensado para un modelo, no un objeto que podamos pintar. Tres `fetch`
contra Jira Cloud con un API token en `safeStorage` son menos código y mejor UI.

Endpoints usados (Jira Cloud REST v3):

- `GET /rest/api/3/myself` — probar la conexión.
- `GET /rest/api/3/search/jql?jql=…&maxResults=8&fields=summary,status,issuetype,assignee` — el picker.
- `GET /rest/api/3/issue/{key}?fields=…&expand=renderedFields` — el snapshot.

Auth: `Authorization: Basic base64(email:apiToken)`. Timeout 10 s con `AbortSignal.timeout`.

### Piezas nuevas

| Archivo | Responsabilidad | ~líneas |
|---|---|---|
| `src/shared/jiraIssue.ts` | Puro: tipos, `parseIssueKeys()`, `jiraContextFileName()`, `isSnapshotStale()` | 90 |
| `src/shared/jiraIssueDoc.ts` | Puro: `issueAutoMarkdown()`, `withJiraAutoBlock()` (preserva `notes`) | 90 |
| `src/shared/jiraConfig.ts` | Puro: `parseJiraConfig()` con defaults | 50 |
| `electron/jiraConfig.ts` | Lee `.gravity/jira.json`; credenciales vía `safeStorage` | 70 |
| `electron/jiraClient.ts` | `fetch` a los tres endpoints; caché por clave con TTL | 130 |
| `electron/jiraContextRefresh.ts` | `refreshStaleJiraContexts(contexts, cwd)` | 60 |
| `renderer/workspace/JiraMentionPicker.tsx` + css | Picker inline del composer | 150 |
| `renderer/workspace/JiraIssueCard.tsx` + css | Tarjeta hover sobre una clave | 90 |

### Cambios en lo existente

- `src/shared/tabContext.ts` — `'jira'` en `TabContextKind`, `HOST_CONTEXT_KINDS`,
  `CREATABLE_CONTEXT_KINDS`, `ALL_CONTEXT_KINDS`; caso en `defaultCreatableStem`. Campos opcionales
  en `TabContext`: `issueKey`, `refreshSeconds`.
- `electron/tabContextBuild.ts` — rama `'jira'` en `materializeTabContext`: **solo lee el archivo**,
  no llama a nadie.
- `src/shared/ipcChannels.ts` + `electron/main.ts` + `electron/preload.ts` — tres canales:
  `JIRA_TEST`, `JIRA_SEARCH`, `JIRA_GET_ISSUE`.
- `src/renderer/workspace/PlaneChatComposer.tsx` — el disparador de mención. Es el único archivo
  caliente que se toca; el resto es aditivo.
- `src/shared/tabContextAppearance.ts` (`KIND_DEFAULT_ICON`, `KIND_DEFAULT_COLOR`) y
  `src/renderer/agent/tabContextKindIcons.ts` (`KIND_ICONS`) — el icono `jira` ya existe en el kit.
- `src/renderer/agent/TabContextFormModal.tsx` — campo «clave de issue» para el kind `jira`.
- `src/i18n/locales/{en,es}.ts` — cadenas nuevas en los dos idiomas.

## Modelo de datos

`.gravity/jira.json` — commiteable, **nunca lleva credenciales**:

```json
{
  "site": "https://cleverit.atlassian.net",
  "projectKeys": ["GRAV", "COV"],
  "defaultJql": "assignee = currentUser() AND sprint in openSprints()",
  "refreshSeconds": 900,
  "maxComments": 10
}
```

El par *email + API token* se cifra con `safeStorage` por sitio, igual que hace
`electron/covenantSession.ts` con la sesión Covenant. Mismo patrón, misma garantía: el repo se
comparte, el token no.

## Interfaz

Cuatro superficies, en orden de valor:

**A · Mención en el composer.** Escribir una clave (`GRAV-4…`) o `@` abre un picker con búsqueda
JQL con debounce. Enter adjunta el chip de contexto y deja la clave como texto; Esc la deja como
texto plano. Sin conexión configurada el picker no aparece y el composer se comporta como hoy.

El disparador es `[A-Z][A-Z0-9]+-\d+` **acotado a `projectKeys`**. Sin ese filtro, `UTF-8`,
`SHA-256` o `CVE-2023-30533` abrirían el picker en medio de una frase.

**B · Tarjeta de issue.** El chip de la issue (en el composer y en el pool de contextos) es
hoverable: título, estado, asignado. Clic abre el `.md` completo en `ContextContentPreviewModal`,
que ya existe. Linkificar las claves *dentro del transcript* obliga a tocar el render de Markdown
del chat, así que va a la fase 3.

**C · Chip de contexto.** La issue vive en el pool de contextos del plano como cualquier otro:
arrastrable a un agente, asignable a varios, con su presupuesto visible.

**D · La rama sabe su issue.** En `feature/GRAV-412-loop-chain`, la app ofrece adjuntar GRAV-412.
Un botón, no una sincronización.

### Frescura visible

Un snapshot viejo presentado como actual es peor que no tenerlo. La cabecera de `## Resumen` lleva
la fecha de actualización y el chip la muestra al pasar el cursor. Si el refresco falla, se marca
*desactualizada* en vez de fingir.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Falsos positivos del patrón de clave (`UTF-8`, `CVE-2023-30533`) | Se exige que el prefijo esté en `projectKeys`. Sin `jira.json`, no hay disparador. |
| Una issue enorme se come el presupuesto | Lo resuelve el catálogo compacto; además `maxComments` recorta el bloque más largo en origen. |
| Rate limit con 6 agentes en el plano | Caché por clave en el main con TTL = `refreshSeconds`: seis agentes con la misma issue son un GET, no seis. |
| Token filtrado a un prompt o a un `.md` | El cliente vive solo en `electron/`; `jira.json` no tiene campo de credencial donde escribirlo. |
| Dos fuentes de verdad (contexto `jira` vs. MCP del CLI) | Cuando el turno lleva contextos `jira`, el preámbulo dice qué issues vienen adjuntas y que no hace falta buscarlas. |

## Pregunta abierta

**¿Dónde vive el `.md` de una issue?** Commitear `.gravity/jira/GRAV-412.md` hace el conocimiento
del equipo compartible y revisable en PR — que es media gracia de la propuesta. Pero mete
descripciones y comentarios de Jira en el repo, y en algunos clientes eso es un problema de
gobierno de datos.

Salida propuesta: los contextos `jira` se materializan en `.gravity/jira/` y la app ofrece añadir
esa ruta a `.gitignore` al conectar. Quien quiera compartirlos, la quita.

## Fases

1. **La issue como contexto.** Cliente REST, `jira.json`, kind `'jira'`, refresco previo al turno,
   alta desde el gestor de contextos pegando una clave. Sin mención ni tarjeta. Ya es usable: se
   arrastra al agente como cualquier contexto.
2. **Mención y tarjeta.** El picker en el composer y el hover sobre la clave. Es la fase que hace
   que se sienta nativo, y la única que toca un archivo caliente.
3. **Rama, transcript y vuelta.** Sugerir la issue desde el nombre de la rama; linkificar las claves
   dentro del transcript; enlazar el `ia-terminal-results` del agente con la issue que lo originó.
   Escrituras nativas solo si aparece la demanda.

Plan de implementación (fases 1 y 2): `docs/superpowers/plans/2026-08-12-jira-nativo.md`.
