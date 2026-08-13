/**
 * El único paso async del feature: refrescar los snapshots vencidos ANTES de
 * componer el turno.
 *
 * Jira escribe el archivo; el pipeline de contextos sigue haciendo lo único que
 * sabe hacer, leer disco. De ahí salen dos propiedades: si Jira está caído el
 * snapshot anterior sigue sirviendo, y la caché por mtime solo invalida cuando
 * el archivo cambió de verdad.
 */

import { basename, dirname } from 'path'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'fs'
import { AUTO_END, AUTO_START, extractSection } from '../src/shared/contextSections'
import { isSnapshotStale } from '../src/shared/jiraIssue'
import { issueAutoMarkdown, jiraContextMetadataLine, withJiraAutoBlock } from '../src/shared/jiraIssueDoc'
import { normalizeContextFileName, type TabContext } from '../src/shared/tabContext'
import { readJiraConfig, readJiraCredentials } from './jiraConfig'
import { jiraGetIssue } from './jiraClient'
import { projectDirPath } from './projectDir'

interface RefreshDeps {
  fetchIssue?: typeof jiraGetIssue
}

/**
 * Misma clave de fallback que `contextFilePath` (tabContextBuild.ts): un context
 * jira recién descubierto en disco, antes de que la metadata persista el
 * `issueKey`, cae al nombre de archivo. Sin este espejo, esos contexts nunca se
 * refrescarían (se filtrarían al no tener `issueKey` explícito).
 */
function issueKeyFor(context: TabContext): string {
  return (context.issueKey || basename(context.fileName || context.name, '.md')).trim().toUpperCase()
}

/**
 * Un snapshot con la región `auto` vacía o ausente no tiene contenido real de
 * Jira, así que no puede tratarse como "fresco" solo porque su mtime sea
 * reciente. Dos caminos producen justo esto: el placeholder que
 * `materializeTabContext` escribe al alta (Task 9, `write:true` sin
 * snapshot) y un fetch que falló *después* de que este mismo refresher ya
 * hubiera creado el archivo en una pasada anterior (no puede pasar hoy —
 * `withJiraAutoBlock` siempre escribe algo en `auto` cuando `fetchIssue`
 * resuelve — pero cierra el caso simétrico sin depender de cuál de los dos
 * caminos fue). Sin este chequeo, el mtime fresco del placeholder bloquea el
 * único mecanismo (`isSnapshotStale`) que podría rellenarlo, y el turno recibe
 * un contexto vacío indistinguible de una issue sin contenido durante hasta
 * `refreshSeconds`.
 */
function hasEmptyAutoRegion(raw: string): boolean {
  return !extractSection(raw, AUTO_START, AUTO_END).trim()
}

export async function refreshStaleJiraContexts(
  contexts: readonly TabContext[],
  cwd: string,
  deps: RefreshDeps = {},
): Promise<void> {
  const pending = contexts.filter(context => context.kind === 'jira')
  if (!pending.length) return

  const config = readJiraConfig(cwd)
  if (!config) return
  const credentials = readJiraCredentials(config.site)
  if (!credentials) return

  const fetchIssue = deps.fetchIssue ?? jiraGetIssue
  const now = Date.now()

  for (const context of pending) {
    try {
      const issueKey = issueKeyFor(context)
      // `normalizeContextFileName` (no concatenación) es lo que hace la
      // coincidencia con `contextFilePath` estructural en vez de casual: cierra
      // el mismo hueco de sanitización que ya cerraba el lado lector (un
      // issueKey `../../evil` no puede escribir fuera de `.gravity/jira/`).
      const filePath = projectDirPath(cwd, 'jira', normalizeContextFileName(issueKey, 'issue'))
      // `statSync`/lectura dentro del try: si el snapshot se borra entre este
      // chequeo y la escritura (TOCTOU), no debe tumbar el resto de los
      // contexts pendientes.
      const mtimeMs = existsSync(filePath) ? statSync(filePath).mtimeMs : 0
      const currentContent = mtimeMs ? readFileSync(filePath, 'utf8') : ''
      const refreshSeconds = context.refreshSeconds ?? config.refreshSeconds
      // El chequeo de contenido va antes del de mtime, no después: un
      // placeholder recién escrito tiene mtime "ahora" (nunca vencido por
      // tiempo) pero cero contenido real de Jira, así que la sola comprobación
      // de mtime jamás dispararía el fetch que lo rellena.
      if (!hasEmptyAutoRegion(currentContent) && !isSnapshotStale(mtimeMs, refreshSeconds, now)) continue

      const issue = await fetchIssue(credentials, issueKey, config.maxComments)
      const metadataLine = jiraContextMetadataLine(issueKey)
      // Releer justo antes de componer, no reusar `currentContent`: ese valor
      // solo sirve para decidir si hacía falta el fetch (arriba), pero el
      // `await` de la línea anterior puede tardar hasta `TIMEOUT_MS` (10s,
      // `jiraClient.ts`), y en esa ventana otro escritor —
      // `mergeAnnotations` vía `TAB_CONTEXT_MERGE_ANNOTATIONS`, que sí toca
      // `jira` (excluye solo changelog/notes/agentResult)— puede haber
      // guardado anotaciones nuevas. Componer desde la copia pre-fetch las
      // pisaría sin error: el read-modify-write deja de ser atómico en
      // cuanto hay un `await` en medio, así que el "modify" tiene que leer
      // lo más tarde posible.
      const latestContent = existsSync(filePath) ? readFileSync(filePath, 'utf8') : ''
      const next = withJiraAutoBlock(
        latestContent,
        metadataLine,
        issueAutoMarkdown(issue, config.maxComments),
      )
      mkdirSync(dirname(filePath), { recursive: true })
      writeFileSync(filePath, next, 'utf8')
    } catch {
      // Jira caído, clave inexistente o un stat que perdió la carrera con un
      // borrado: el snapshot anterior (si lo hay) sigue en disco y el turno
      // funciona igual. Nunca se propaga: esto corre en el camino del turno.
    }
  }
}
