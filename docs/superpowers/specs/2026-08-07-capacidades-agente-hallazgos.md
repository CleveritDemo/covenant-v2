# Resolución de capacidades por agente — contraste contra el código real

Fecha: 2026-08-07
Sobre: spec «resolución de capacidades por agente (contexto, skills, MCP)», borrador del 2026-08-07

El spec pide en su sección 6 resolver las preguntas abiertas «leyendo el código real, no en
abstracto». Esto es ese contraste. Cada afirmación lleva archivo y línea.

## Correcciones a premisas del spec

### `'mcp'` no es un `TabContextKind` existente

La sección 5 lo lista como `# existente, delivery=catalog`, y la 4.2 apoya la materialización de
`context_ids` en «el patrón `mcp-como-contexto`, ya resuelto».

Nada de eso está en el código. `TabContextKind` (`src/shared/tabContext.ts:1-9`) son nueve:
`folderTree`, `files`, `symbols`, `notes`, `git`, `deps`, `readme`, `changelog`, `agentResult`.
No hay `mcp`, ni cliente MCP, ni refresco async. `rg -i mcp src/ electron/` devuelve cero.

El spec `mcp-como-contexto` se escribió y se **borró** el mismo día (commit `b9d5ff0`, «Descarta la
idea de contextos desde servidores MCP»), a petición tuya. El patrón que este spec da por heredado
no existe como código ni como documento.

**Lo que sí es cierto y sirve igual:** el invariante que aquel spec identificó —que
`materializeTabContext` es síncrono (`electron/tabContextBuild.ts:962`) y que cualquier fuente
async tiene que escribir el `.md` **antes** de componer el turno, no dentro de la
materialización— sigue siendo válido y es la restricción real que hereda el kind `skill`.

### `deliveryModeFor` no vive donde dice el spec

La sección 5 dice «`tabContextBuild.ts`: ajustar `deliveryModeFor`». Vive en
`src/shared/contextBudget.ts:28`, creada hoy mismo. `tabContextBuild.ts` no la conoce.

## Las siete preguntas

### 1. ¿Dónde vive el `manifest.json`?

**El layout de la sección 5 no existe.** No hay `agents/<slug>/config.json` ni `contexts/` por
agente. Hay **un archivo plano por agente**: `.gravity/agents/<id>.json`, con la interfaz
`ProjectAgentDefinition` (`src/shared/projectAgentCatalog.ts:31-52`), que **ya contiene
`contextIds`**.

El eje que este repo separa no es config-vs-manifest, es **compartible vs local**:
`ProjectAgentDefinition` va al repo del usuario y se commitea; `session.json` en userData guarda
solo un `AgentPaneBinding` (`agentId` + `cliSessionId`).

**Respuesta: extiende `ProjectAgentDefinition`, no añadas un segundo archivo.** `native_skills` y
`mcps_allowed` son decisiones compartibles del equipo, exactamente como `contextIds`, que ya está
ahí. Un `manifest.json` aparte duplicaría el lector, el escritor, la migración y la validación
para datos del mismo dueño y el mismo ciclo de vida. En UI es un tab más del modal de agente, no
una superficie nueva.

### 2. ¿El picker de skills nativas se re-scopea por agente?

**No hay picker.** `rg -il skill src/renderer/` no devuelve nada: cero. Las ~45 skills que ves son
el catálogo del propio Claude Code, no una vista de Gravity.

No hay nada que re-scopear: sería construirlo desde cero. Y antes de construirlo conviene leer el
hallazgo de la sección siguiente, porque determina si esa UI puede prometer lo que dice.

### 3. ¿Quién decide «need-sections»?

**El modelo elige, el host acota.** No hay llamada de inferencia extra, pero sí un coste que el
spec no nombra.

El host manda un catálogo compacto y un protocolo; el modelo responde con un fence
` ```ia-terminal-need-sections `, que `extractContextSectionRequest` parsea
(`electron/agentCliRuntime.ts:1011`). Los topes son deterministas y los impone el host:
≤8 secciones, ≤60.000 caracteres, ≤2 peticiones (`tabContextBuild.ts:82,75` y el texto del
protocolo en `:1626-1629`).

**El coste real son turnos, no tokens de decisión.** `contextRound < 2`
(`agentCliRuntime.ts:1012`) permite hasta **dos rondas de continuación**, y cada ronda es un
turno completo del CLI: `startPhase(continuationPrompt, contextRound + 1)` (`:1153`) relanza el
proceso. Un turno con dos rondas de `need-sections` son tres invocaciones del CLI, no una.

Ese coste es **por turno**, no por contexto: añadir el bucket `skill` no lo multiplica, comparte
el mismo presupuesto y las mismas rondas que los kinds ya existentes. Vale la pena costearlo, pero
la conclusión es la contraria a la que teme el spec: el bucket nuevo no añade inferencia.

### 4. ¿Cómo se instrumenta la medición?

**Ya existe instrumentación, y nadie la mira.** `ContextDeliveryMetrics`
(`electron/agentCliRuntime.ts:89-95`) cuenta `catalogChars`, `sectionsRequested`,
`sectionsDelivered`, `sectionsPreattached` y `annotationUpserts`, con
`getContextDeliveryMetrics()` (`:105`) y `clearContextDeliveryMetrics()` (`:109`).

Dos huecos para tu criterio de aceptación: cuenta **caracteres, no tokens**, y no está expuesta en
ninguna UI ni IPC. El camino más corto es exponerla por IPC y sumar el conteo real de tokens que
ya devuelve el CLI en su stream de eventos, en vez de instrumentar de cero.

### 5. ¿`.gravity` o `.iaterminal`?

**Resuelto y sin drift en el código.** `PROJECT_DIR = '.gravity'`,
`LEGACY_PROJECT_DIR = '.iaterminal'` (`src/shared/projectDir.ts`), y `projectDirName(cwd)`
(`electron/projectDir.ts`) devuelve `.gravity` salvo que el proyecto ya tenga `.iaterminal` y no
`.gravity`. Nunca se migra en disco: la carpeta vive en el repo del usuario y puede estar
commiteada.

El drift que observaste es real pero **es de datos, no de código**: son proyectos de usuario que
siguen en el nombre antiguo. En la captura del modal se ve
`/Users/…/karlTerminal/.iaterminal/folders.md` — ese proyecto es legacy y el host lo respeta a
propósito.

**Regla para cualquier código nuevo:** usar `projectDirPath(cwd, …)`, nunca un literal `.gravity`.

### 6. ¿Basta la allowlist por namespace? → ver el hallazgo bloqueante

### 7. ¿Quién dispara la Fase 1?

Decisión de personas, no de código. Sin respuesta desde el repo.

## El hallazgo que cambia el diseño

**La sección 4.2, paso 4 es incompatible con lo que `cwd` significa en este código.**

El spec propone, para un agente con `native_skills.enabled=true`, «construir un `cwd` efímero para
ese spawn, con symlinks selectivos» y lanzar el harness ahí.

En Gravity el `cwd` del spawn no es un directorio de trabajo cualquiera: es **el proyecto**, y de
él cuelga todo lo demás (`electron/agentCliRuntime.ts`):

| Qué | Línea | Qué se rompe con un cwd efímero |
|---|---|---|
| `buildContextPromptDelivery(contexts, cwd)` | `:138` | los contextos se materializan en el `.gravity` equivocado |
| `materializeClipboardImages(cwd, …)` | `:924` | las imágenes pegadas van a otra carpeta |
| `captureWorkspaceSnapshot(cwd)` antes y después | `:925`, `:1044` | el diff sale vacío: la IA edita el proyecto real, no el efímero |
| `appendAiChangelog(cwd, changes)` | `:1061` | el changelog se escribe fuera del repo |
| `initSessionCwd(paneId, cwd)` | `:923` | el explorador y el panel de git del pane apuntan a otro sitio |
| `spec.args({ cwd })` | `:733` | el CLI trabaja en la granja de symlinks, no en el repo |

El diff vacío es el peor: alimenta el changelog de IA y la evidencia que filtra las anotaciones de
contexto (`filterTabContextUpdatesByChangedPaths`). Un agente con skills nativas activadas dejaría
de generar changelog y de poder anotar contextos, en silencio.

Y el camino alternativo tampoco existe: el `.claude/` del proyecto es **uno solo para todos los
agentes** del mismo proyecto, así que tampoco puede filtrar por agente.

**Conclusión: el criterio de aceptación 2 —`namespace_allowlist=["superpowers:*"]` sin acceso a
`ponytail:*`— no tiene camino de implementación sin desacoplar `cwd`, que es cirugía mayor sobre
seis puntos de la runtime.**

## Lo que sí es barato

**El gate binario ya tiene toda la maquinaria.** `--disallowedTools` se usa hoy por spawn:

```ts
...(mode === 'ask' ? ['--disallowedTools', 'Edit,Write,NotebookEdit,Bash,MultiEdit'] : []),
```
(`src/shared/agentCliProviders.ts:74`)

Añadir `Skill` a esa lista cuando el agente tenga `native_skills.enabled === false` son unas pocas
líneas y satisface el **criterio de aceptación 1** entero.

**Y el bucket `skill` es más barato de lo que el spec cree.** La sección 5 propone un
`SECTIONED_CONTEXT_KINDS` nuevo para forzar `catalog`. No hace falta:

```ts
export function deliveryModeFor(kind: TabContextKind): ContextDelivery {
  return (CUSTOM_CONTEXT_KINDS as readonly TabContextKind[]).includes(kind) ? 'whole' : 'catalog'
}
```
(`src/shared/contextBudget.ts:28`)

Deriva por **exclusión**: cualquier kind que no esté en `CUSTOM_CONTEXT_KINDS` ya entrega
`catalog`. Añadir `skill` a `ALL_CONTEXT_KINDS` y `CREATABLE_CONTEXT_KINDS`, y a ninguno de los
dos buckets, da el delivery que quieres sin código nuevo ni un tercer set que mantener.

Lo mismo con el seccionado: `sectionsForContext` (`src/shared/contextSections.ts`) cae al `else`
final y usa `markdownSections`, que parte por encabezados `##`/`###`. Un `SKILL.md` bien
estructurado se secciona solo, sin partidor propio.

## Recomendación

Partir el spec en dos, porque tienen coste y riesgo incomparables:

**Spec A — asignable ya.** Kind `skill` + gate binario de la tool `Skill` + `mcps_allowed`. Toca
`tabContext.ts` (tres arrays), `agentCliProviders.ts` (una condición), `ProjectAgentDefinition`
(dos campos) y la UI del modal de agente. Sin mecanismos nuevos. Cubre los criterios de
aceptación 1, 3 y 4.

**Spec B — investigación, no implementación.** La allowlist por namespace. Antes de diseñarla hay
que responder si el harness admite apuntar el descubrimiento de skills a un directorio distinto
del `cwd` (algo tipo `--setting-sources` con raíz explícita). Si no lo admite, el criterio 2 no es
alcanzable y conviene decirlo en el spec en vez de dejarlo como objetivo.

La medición de tokens (criterio 5) va en A, porque es la que justifica todo lo demás y porque la
instrumentación ya está a medio construir.
