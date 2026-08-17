/**
 * El único paso async del feature: refrescar los snapshots vencidos ANTES de
 * componer el turno.
 *
 * Jira escribe el archivo; el pipeline de contextos sigue haciendo lo único que
 * sabe hacer, leer disco. De ahí salen dos propiedades: si Jira está caído el
 * snapshot anterior sigue sirviendo, y la caché por mtime solo invalida cuando
 * el archivo cambió de verdad.
 */

import { dirname } from 'path'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'fs'
import { issueKeyFor, isSnapshotStale } from '../src/shared/jiraIssue'
import {
  issueAutoMarkdown,
  jiraContextMetadataLine,
  jiraSnapshotHasContent,
  withJiraAutoBlock,
} from '../src/shared/jiraIssueDoc'
import { normalizeContextFileName, type TabContext } from '../src/shared/tabContext'
import { readJiraConfig, readJiraCredentials } from './jiraConfig'
import { jiraGetIssue } from './jiraClient'
import { projectDirPath } from './projectDir'

interface RefreshDeps {
  fetchIssue?: typeof jiraGetIssue
  /** Solo tests: acortar la ventana de castigo sin esperar minutos reales. */
  failureCooldownMs?: number
  /** Solo tests: acortar el presupuesto total sin esperar el timeout real. */
  budgetMs?: number
}

/**
 * Cuánto se deja de reintentar una issue que falló. Una clave con typo o una
 * issue borrada falla SIEMPRE, y sin memoria de fallos cada envío del composer
 * volvía a pagar el timeout completo del cliente (10 s) por ella, para
 * siempre. Cinco minutos es lo bastante corto para que arreglar la clave o que
 * vuelva Jira se note en el siguiente turno, y lo bastante largo para que una
 * issue rota deje de costar tiempo de usuario.
 */
const FAILURE_COOLDOWN_MS = 5 * 60_000

/**
 * Techo de lo que el turno espera por Jira, pase lo que pase. Con las peticiones
 * en paralelo el peor caso ya es un timeout, no N; este presupuesto es la
 * garantía dura de que ni un cliente que ignore su propio `AbortSignal` puede
 * dejar el composer colgado. Lo que llegue tarde se escribe igual y lo recoge
 * el turno siguiente: el pipeline solo lee disco.
 */
const REFRESH_TOTAL_BUDGET_MS = 12_000

/** `site:KEY` → cuándo falló. Ver `FAILURE_COOLDOWN_MS`. */
const failures = new Map<string, number>()

/**
 * Olvida todos los castigos. La llama `connectJira` (`electron/jiraIpcOps.ts`)
 * tras un connect exitoso: si el token había expirado, cada issue adjunta tiene
 * su `site:KEY` anotado, y sin esto el usuario reconectaría bien y aun así no se
 * refrescaría nada durante hasta `FAILURE_COOLDOWN_MS`, con los chips vencidos y
 * sin nada que se lo explique. Reconectar es exactamente la señal de que el
 * motivo del fallo puede haber desaparecido.
 *
 * Se limpia el mapa entero, no solo las claves del sitio reconectado: el
 * castigo es una heurística de ahorro, no un estado que valga la pena
 * conservar con precisión, y un connect es una acción explícita del usuario.
 *
 * Los tests la usan además para aislarse entre sí.
 */
export function clearJiraRefreshFailures(): void {
  failures.clear()
}

/**
 * Corre `task` con un techo de tiempo. No cancela nada (no hay a quién
 * cancelar: el `AbortSignal` vive dentro del cliente): solo deja de esperar.
 * El timer se libera siempre y va `unref`ado para no sostener el proceso.
 */
async function withBudget(task: Promise<unknown>, budgetMs: number): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const budget = new Promise<void>(resolve => {
    timer = setTimeout(resolve, budgetMs)
    ;(timer as { unref?: () => void }).unref?.()
  })
  try {
    await Promise.race([task, budget])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/**
 * Un snapshot con la región `auto` vacía o ausente no tiene contenido real de
 * Jira, así que no puede tratarse como "fresco" solo porque su mtime sea
 * reciente. Dos caminos producen justo esto: el placeholder que
 * `materializeTabContext` escribe al alta (Task 9, `write:true` sin
 * snapshot) y un fetch que falló *después* de que este mismo refresher ya
 * hubiera creado el archivo en una pasada anterior. Sin este chequeo, el mtime
 * fresco del placeholder bloquea el único mecanismo (`isSnapshotStale`) que
 * podría rellenarlo, y el turno recibe un contexto vacío indistinguible de una
 * issue sin contenido durante hasta `refreshSeconds`.
 *
 * La regla vive en `src/shared/jiraIssueDoc.ts` porque `composePrompt` decide
 * con ella si puede anunciarle la issue al agente: si acá y allá no fuera
 * literalmente la misma función, volverían a divergir (ya pasó dos veces).
 */
function hasEmptyAutoRegion(raw: string): boolean {
  return !jiraSnapshotHasContent(raw)
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
  const cooldownMs = deps.failureCooldownMs ?? FAILURE_COOLDOWN_MS
  const now = Date.now()

  const refreshOne = async (context: TabContext): Promise<void> => {
    try {
      const issueKey = issueKeyFor(context)
      if (!issueKey) return
      // Memoria de fallos ANTES de cualquier trabajo: una clave con typo o una
      // issue borrada falla siempre, y sin esto cada envío del composer volvía
      // a pagar su timeout completo, para siempre y sin dejar rastro.
      const failureKey = `${config.site}:${issueKey}`
      const failedAt = failures.get(failureKey)
      if (failedAt !== undefined && now - failedAt < cooldownMs) return
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
      if (!hasEmptyAutoRegion(currentContent) && !isSnapshotStale(mtimeMs, refreshSeconds, now)) return

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
      // Volvió a funcionar: se olvida el castigo (Jira caído que ya volvió,
      // credenciales corregidas, issue que dejó de estar restringida).
      failures.delete(failureKey)
    } catch (error) {
      // Jira caído, clave inexistente o un stat que perdió la carrera con un
      // borrado: el snapshot anterior (si lo hay) sigue en disco y el turno
      // funciona igual. Nunca se propaga: esto corre en el camino del turno.
      // Pero sí se recuerda, y sí se dice: un fallo permanentemente silencioso
      // es indistinguible de una issue sin contenido.
      const issueKey = issueKeyFor(context)
      if (issueKey) failures.set(`${config.site}:${issueKey}`, now)
      console.warn('[jira] no se pudo refrescar el snapshot de', issueKey, '·', error instanceof Error ? error.message : String(error))
    }
  }

  // `allSettled` y no un `for await`: en serie, dos issues rotas costaban dos
  // timeouts encadenados (10 s cada uno) antes de que el turno arrancara. En
  // paralelo el peor caso es UN timeout, y `withBudget` pone el techo duro.
  // `allSettled` además garantiza que ningún rechazo escape — `refreshOne` ya
  // no rechaza, pero esta función no puede depender de que siga siendo así.
  await withBudget(
    Promise.allSettled(pending.map(refreshOne)),
    deps.budgetMs ?? REFRESH_TOTAL_BUDGET_MS,
  )
}
