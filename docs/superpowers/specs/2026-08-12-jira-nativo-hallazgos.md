# Jira nativo — hallazgos abiertos tras la implementación

Fecha: 2026-08-12
Rama: `agent/jira-integration-0812-pb0` (`9da631c..3b9a447`, 31 commits)
Spec: `2026-08-12-jira-nativo-design.md` · Plan: `../plans/2026-08-12-jira-nativo.md`

Todo lo que sigue se detectó en las revisiones por tarea o en la revisión final de rama, se
adjudicó como **no bloqueante para el merge**, y sigue abierto. Está aquí para que no se pierda al
borrar el scratch de trabajo.

## Requiere comprobación manual antes de fiarse

**Los «últimos N comentarios» dependen de que Jira honre `orderBy=-created`.**
`electron/jiraClient.ts` pide `/rest/api/3/issue/{key}/comment?orderBy=-created&maxResults=N` y hace
`.reverse()` para dejarlos en orden cronológico. Si el servidor **ignorase en silencio** ese
parámetro, devolvería ascendente desde `startAt: 0` y el `.reverse()` daría los **N más viejos en
orden invertido** — peor que el bug original (que al menos los daba en orden) en los dos ejes.

Un 400 sí es seguro: cae al bloque `comment` embebido de la issue.

Cómo comprobarlo: una issue real con más de una página de comentarios (>50), y verificar que el
`## Comentarios` del `.md` trae los últimos. Si no los trae, la salida es
`startAt: total - N` sobre el mismo endpoint.

## Fallo intermitente — IDENTIFICADO, y no es de Jira

`src/renderer/workspace/__tests__/PlaneMapGridParticles.test.tsx`, el caso
«beat alto aumenta radio/alpha/halo; al bajar el beat cae suave sin ir a idle de golpe».

Falla con una comparación numérica del decaimiento (`expected 0.5609… to be less than 0.5184…`).
Aparece **solo en la suite completa**, ~3 de 20 pasadas; en aislamiento pasó 8 de 8. Es sensible a
la carga: con varios workers de vitest en paralelo, los deltas del decaimiento no salen iguales.

No lo toco porque es de otra área (llegó a `main` mientras esta rama estaba en curso) y arreglarlo
bien pasa por que el test no dependa del reloj real. El arreglo natural es inyectar el tiempo en
vez de leerlo, como hace el resto de la lógica pura del repo.

## Correcciones pendientes, todas locales

| Dónde | Qué | Por qué importa |
|---|---|---|
| `electron/jiraIpcOps.ts` (`hasProject`) | Comprueba que el `cwd` no esté vacío, no que sea absoluto | Un `cwd` relativo pasaría el guard y resolvería contra `process.cwd()`. No alcanzable desde el renderer actual (el `projectFolder` sale de un picker nativo), pero detrás de ese guard ahora hay un efecto que **escribe `.gitignore`**. `isAbsolute()` lo cierra. |
| `electron/__tests__/jiraGitignore.test.ts` | El test «un `.gitignore` que no se puede escribir no lanza» no llega al `catch` que dice probar: la ruta usada no tiene ni `.gitignore` ni `.git`, así que sale por la rama de «sin repo» | El `catch` queda sin cubrir. Un `.gitignore` en modo 0444 sí lo ejercitaría. |
| `src/renderer/agent/AgentPane.tsx` | Si cambia el `cwd` y el descubrimiento falla, el pane retiene el catálogo del **proyecto anterior** | Antes se vaciaba. Enseñar los contextos de otro proyecto es peor que no enseñar ninguno. Limpiar cuando `cwdChanged && !result.ok` conserva la intención original sin la fuga entre proyectos. |
| `src/renderer/components/JiraConnectionField.tsx` | Al cambiar a un proyecto sin `jira.json`, el panel conserva `site`, `email` y «conectado» del proyecto anterior | Sin efecto real (`disconnectJira` sobre el nuevo `cwd` es no-op), pero informa mal. Basta resetear cuando `!status.configured`. |
| `electron/jiraClient.ts` | Un fallo transitorio del endpoint de comentarios se cachea como satisfecho (`commentsFor` se fija igual que en el caso bueno) | Hasta 15 min de comentarios viejos presentados como actuales, sin nada en el documento que lo indique. `commentsFor: recentComments ? maxComments : -1` fuerza el reintento. |
| `electron/jiraConfig.ts`, `electron/jiraIpcOps.ts` | Tres mensajes de error del main van en español cableado, sin pasar por i18n | Se renderizan tal cual en Ajustes. Uno de ellos es el que más necesita leer un usuario bloqueado (la negativa de `safeStorage`). |
| `src/renderer/workspace/PlaneMap.tsx`, `PlanePaneWindow.tsx` | `contextsRevision` como prop del plano re-renderiza todo el plano aunque el proyecto no tenga Jira | Único coste que la feature añade fuera de Jira. Acotado (los bumps vienen de `refreshTabContexts`, no de teclas). |
| `src/renderer/workspace/JiraIssueChip.tsx` | El tooltip pinta el timestamp ISO crudo | «Issue last updated 2026-08-11T10:00:00.000+0000». |
| `electron/tabContextBuild.ts:657-664` | Cuarta derivación del nombre de archivo de una issue, y no pasa a mayúsculas | Un contexto creado con `issueKey: 'grav-412'` guarda `jira/grav-412.md` en la metadata mientras el archivo vive en `jira/GRAV-412.md`. Invisible en macOS, importaría en Linux. **Preexistente**, y construye un nombre de archivo, no una clave, así que `issueKeyFor` no es el hoist directo. |
| `src/shared/jiraIssue.ts` | El patrón de clave vive en dos regex (`KEY_RE` anclada y la de lookaround en `parseIssueKeys`) | Si cambia la forma hay que tocar las dos. |
| `src/shared/jiraIssueDoc.ts` | La rama defensiva de `withJiraAutoBlock` solo cubre «sin marcadores»; un marcador de apertura huérfano deja el documento en un estado donde `extractSection` corta mal | Solo alcanzable editando el `.md` a mano. |
| `src/renderer/workspace/JiraIssueChip.css` | El arreglo de truncado no tiene test | jsdom no hace layout, así que una aserción sobre la regla CSS sería confianza falsa. Para una suite visual/e2e si aparece. |

## Crear rama desde la issue — pedido, y aplazado con motivo

`feature/CT-128-permissions-en-rojo` elegido desde el picker es una buena idea, pero **no es añadir
el selector a un campo que ya existe**: hoy Gravity no sabe crear ramas desde la UI.

- El badge de rama del panel de Git (`GitPanelModal.tsx`) es de solo lectura.
- No hay canal IPC de `checkout -b`; `GIT_*` cubre status, stage, commit, push, pull y worktrees.
- `gitWorktreeAdd` es lo único que crea ramas, y solo lo llama `App.tsx` para aislar delegaciones.

Construirlo implica canal IPC nuevo, la operación en el main, un punto de entrada en la UI, y tres
decisiones de producto que no deberían tomarse de pasada:

1. **¿Rama en el sitio o worktree?** Gravity usa worktrees para aislar agentes; una rama creada a
   mano en el repo de la pestaña se comporta distinto que todo lo demás.
2. **¿Qué pasa con los cambios sin commitear** al cambiar de rama?
3. **¿Dónde vive la acción?** El panel de Git es el sitio obvio, pero ahí hoy no se navega entre
   ramas, así que sería la primera.

El generador de nombre (issue → slug) es trivial y puro; se escribe cuando exista el consumidor, no
antes — añadirlo ahora sería código que nadie llama.

## Fuera de alcance por decisión, no por olvido

- **Linkificar las claves dentro del transcript** y que el clic del chip abra el `.md` completo.
  El clic de una tarjeta de contexto abre el chat del agente para los doce kinds; cambiarlo era
  mucho más que un chip. Fase 3.
- **Sugerir la issue desde el nombre de la rama** (`feature/GRAV-412-…`). Fase 3.
- **Escrituras nativas** (comentar, transicionar). El agente ya lo hace por MCP.
- **Jira Server / Data Center**, OAuth, y sincronización bidireccional. Ver «No objetivos» del spec.

## Lo que hay que probar con la app abierta

Nada de lo siguiente se pudo verificar: `npm run dev` no termina en una sesión no interactiva.

1. Conectar en Ajustes con credenciales reales; que la línea de `.gitignore` se añada y se avise.
2. Crear un contexto pegando una clave; que el placeholder se rellene en el primer turno.
3. Teclear una clave en el composer; que el picker aparezca, que Enter adjunte y que Escape deje
   la clave como texto.
4. Que el agente reciba de verdad la issue en ese primer turno (el fallo más repetido de esta
   rama fue justo este: la UI encendida y el contenido sin llegar).
5. Con Jira caído: que el turno salga igual, con el snapshot anterior.
6. Que el chip marque «desactualizado» antes del primer refresco y deje de marcarlo después.
