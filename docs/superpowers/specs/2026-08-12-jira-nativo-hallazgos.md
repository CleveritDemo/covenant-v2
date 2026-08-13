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

## Fallo intermitente sin identificar

En una de diez ejecuciones de la suite completa falló un test; tres ejecuciones completas
posteriores y seis pasadas dirigidas a los ficheros sensibles a timing
(`jiraMentionPicker`, `planeChatComposerJiraMention`, `jiraContextRefresh`, `jiraClient`,
`jiraIssueChip`) salieron verdes. No se identificó cuál era. Si reaparece, el sospechoso más
probable es alguno de los tests con promesas diferidas o con `Promise.race` contra un temporizador.

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
