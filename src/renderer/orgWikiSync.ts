/**
 * Push org de la wiki local tras cada turno con ingest.
 * Caché de hashes por scope org+workspaceId (misma lección del fix scoped de
 * notes: JAMÁS un mapa global por slug). El pull siembra el caché para no
 * re-pushear lo recién bajado; el diff decide upserts/deletes y las líneas
 * de log nuevas más allá del contador cacheado.
 */

import type { CovenantResult } from '@shared/covenantTypes'
import type { WikiGraphResult } from '@shared/wikiGraph'
import { MAX_WIKI_LOG_SUMMARY } from '@shared/wikiDoc'

export type OrgWikiSyncScope = {
  orgSlug: string
  workspaceId: string
}

/** Key estable del scope: `orgSlug\0workspaceId`; '' si falta alguno. */
export function orgWikiSyncScopeKey(scope: OrgWikiSyncScope): string {
  const org = scope.orgSlug.trim()
  const workspaceId = scope.workspaceId.trim()
  if (!org || !workspaceId) return ''
  return `${org}\0${workspaceId}`
}

type OrgWikiScopeState = {
  pageHashes: Map<string, string>
  /** Líneas de log ya vistas; null = sin baseline (primer push solo observa). */
  logLineCount: number | null
}

const stateByScope = new Map<string, OrgWikiScopeState>()

function scopeState(scopeKey: string): OrgWikiScopeState {
  let state = stateByScope.get(scopeKey)
  if (!state) {
    state = { pageHashes: new Map(), logLineCount: null }
    stateByScope.set(scopeKey, state)
  }
  return state
}

/** ¿Hay caché sembrado para este scope? (diagnóstico/tests). */
export function hasOrgWikiSyncScope(scope: OrgWikiSyncScope): boolean {
  return stateByScope.has(orgWikiSyncScopeKey(scope))
}

/** Borra solo el caché del scope dado (no toca otros workspaces). */
export function clearOrgWikiSyncScope(scope: OrgWikiSyncScope): void {
  const key = orgWikiSyncScopeKey(scope)
  if (key) stateByScope.delete(key)
}

export interface OrgWikiLocalPage {
  slug: string
  title: string
  type: string
  body: string
}

// SHA-256 puro y síncrono (FIPS 180-4): evita depender de WebCrypto, que no
// está garantizado en todos los entornos donde corre este módulo (tests node).
const SHA256_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]

function sha256Hex(input: string): string {
  const bytes = new TextEncoder().encode(input)
  const bitLength = bytes.length * 8
  const paddedLength = (((bytes.length + 8) >> 6) + 1) << 6
  const padded = new Uint8Array(paddedLength)
  padded.set(bytes)
  padded[bytes.length] = 0x80
  const view = new DataView(padded.buffer)
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000))
  view.setUint32(paddedLength - 4, bitLength >>> 0)

  const h = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]
  const w = new Uint32Array(64)
  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let i = 0; i < 16; i += 1) w[i] = view.getUint32(offset + i * 4)
    for (let i = 16; i < 64; i += 1) {
      const s0 = ((w[i - 15] >>> 7) | (w[i - 15] << 25))
        ^ ((w[i - 15] >>> 18) | (w[i - 15] << 14))
        ^ (w[i - 15] >>> 3)
      const s1 = ((w[i - 2] >>> 17) | (w[i - 2] << 15))
        ^ ((w[i - 2] >>> 19) | (w[i - 2] << 13))
        ^ (w[i - 2] >>> 10)
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0
    }
    let [a, b, c, d, e, f, g, hh] = h
    for (let i = 0; i < 64; i += 1) {
      const s1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))
      const ch = (e & f) ^ (~e & g)
      const temp1 = (hh + s1 + ch + SHA256_K[i] + w[i]) >>> 0
      const s0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const temp2 = (s0 + maj) >>> 0
      hh = g; g = f; f = e
      e = (d + temp1) >>> 0
      d = c; c = b; b = a
      a = (temp1 + temp2) >>> 0
    }
    h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + b) >>> 0
    h[2] = (h[2] + c) >>> 0; h[3] = (h[3] + d) >>> 0
    h[4] = (h[4] + e) >>> 0; h[5] = (h[5] + f) >>> 0
    h[6] = (h[6] + g) >>> 0; h[7] = (h[7] + hh) >>> 0
  }
  return h.map(word => word.toString(16).padStart(8, '0')).join('')
}

/** sha256 hex de `title|type|body` normalizados como composeWikiPage. */
export function orgWikiPageHash(page: {
  title: string
  type: string
  body: string
}): string {
  const title = page.title.trim()
  const type = page.type.trim()
  const body = page.body.replace(/\r\n/g, '\n').trim()
  return sha256Hex(`${title}\u0000${type}\u0000${body}`)
}

/**
 * Siembra el caché del scope con las pages bajadas del server (post-pull),
 * para que el siguiente push no re-pushee lo mismo. `logLineCount` opcional:
 * null (default) = sin baseline de log (primer push solo observa el tail).
 */
export function seedOrgWikiSyncScope(
  scope: OrgWikiSyncScope,
  pages: readonly OrgWikiLocalPage[],
  logLineCount: number | null = null,
): void {
  const key = orgWikiSyncScopeKey(scope)
  if (!key) return
  const hashes = new Map<string, string>()
  for (const page of pages) {
    const slug = page.slug.trim()
    if (!slug) continue
    hashes.set(slug, orgWikiPageHash(page))
  }
  stateByScope.set(key, { pageHashes: hashes, logLineCount })
}

/** Líneas del tail que son entradas de log (formatWikiLogEntry: `- …`). */
export function wikiLogEntryLines(logTail: readonly string[] | undefined): string[] {
  if (!logTail) return []
  return logTail
    .map(line => line.trim())
    .filter(line => line.startsWith('- '))
}

/** Forma local sin `- ` ni trim extremo; sin cap — solo para matching. */
export function wikiLogEntryForMatch(line: string): string {
  return line.replace(/^-\s+/, '').trim()
}

/** Entrada para el POST del log: sin el marcador `- `, cap del server. */
export function wikiLogEntryForServer(line: string): string {
  return wikiLogEntryForMatch(line).slice(0, MAX_WIKI_LOG_SUMMARY)
}

export interface OrgWikiPushDeps {
  scope: OrgWikiSyncScope
  cwd: string
  getWikiGraph: (cwd: string) => Promise<WikiGraphResult>
  upsertWikiPage: (
    pageSlug: string,
    payload: { title: string; pageType: string; body: string },
  ) => Promise<CovenantResult<unknown>>
  deleteWikiPage: (pageSlug: string) => Promise<CovenantResult<unknown>>
  appendWikiLog: (entry: string) => Promise<CovenantResult<unknown>>
  /**
   * Seed en frío tras reinicio: si el scope no tiene caché, lista el server y
   * siembra pageHashes para que los deletes locales propaguen.
   */
  listRemotePages?: () => Promise<CovenantResult<Array<{
    slug: string
    title: string
    pageType?: string
    type?: string
    body: string
  }>>>
  /**
   * Seed en frío del log: lista entries remotos (DESC) para subir solo las
   * líneas locales que falten (multiset: exacto → push-trunc → pull-wrap).
   * Si falta o falla → baseline.
   */
  listRemoteLog?: () => Promise<CovenantResult<{ entry: string }[]>>
}

export interface OrgWikiPushResult {
  ok: boolean
  upserts: number
  deletes: number
  logLines: number
}

/**
 * Lee el estado local (grafo + logTail), diffea contra el caché del scope y
 * pushea upserts/deletes/log al server. 401/403 (o cualquier error del
 * endpoint) → log silencioso a consola y corte: sin reintentos en loop
 * (assignees no-manager no pushean).
 */
export async function syncOrgWikiPush(deps: OrgWikiPushDeps): Promise<OrgWikiPushResult> {
  const none: OrgWikiPushResult = { ok: true, upserts: 0, deletes: 0, logLines: 0 }
  const key = orgWikiSyncScopeKey(deps.scope)
  const cwd = deps.cwd.trim()
  if (!key || !cwd) return none

  let graph: WikiGraphResult
  try {
    graph = await deps.getWikiGraph(cwd)
  } catch {
    return none
  }
  if (!graph.ok || !graph.data) return none

  let upserts = 0
  let deletes = 0
  let logLines = 0

  const abort = (stage: string, error: string): OrgWikiPushResult => {
    // 401/403 esperables (assignee no-manager): consola y listo, sin loop.
    console.warn(`[orgWikiSync] push ${stage} rechazado: ${error}`)
    return { ok: false, upserts, deletes, logLines }
  }

  // Scope frío + listRemotePages: siembra hashes del server antes del diff
  // (tras reinicio los deletes locales deben propagar). Con listRemoteLog ok
  // sube solo líneas locales faltantes; si falta/falla → logLineCount null.
  if (!stateByScope.has(key) && deps.listRemotePages) {
    try {
      const remote = await deps.listRemotePages()
      if (remote.ok) {
        const hashes = new Map<string, string>()
        for (const page of remote.data) {
          const slug = typeof page.slug === 'string' ? page.slug.trim() : ''
          if (!slug) continue
          const type = typeof page.pageType === 'string' && page.pageType.trim()
            ? page.pageType
            : typeof page.type === 'string' && page.type.trim()
              ? page.type
              : 'concept'
          hashes.set(slug, orgWikiPageHash({
            title: typeof page.title === 'string' ? page.title : slug,
            type,
            body: typeof page.body === 'string' ? page.body : '',
          }))
        }
        stateByScope.set(key, { pageHashes: hashes, logLineCount: null })

        if (deps.listRemoteLog) {
          try {
            const remoteLog = await deps.listRemoteLog()
            if (remoteLog.ok) {
              const remoteCounts = new Map<string, number>()
              for (const row of remoteLog.data) {
                const e = typeof row.entry === 'string' ? row.entry.trim() : ''
                if (!e) continue
                remoteCounts.set(e, (remoteCounts.get(e) ?? 0) + 1)
              }
              const consumeRemote = (entry: string): boolean => {
                const count = remoteCounts.get(entry) ?? 0
                if (count <= 0) return false
                if (count === 1) remoteCounts.delete(entry)
                else remoteCounts.set(entry, count - 1)
                return true
              }
              const localEntries = wikiLogEntryLines(graph.logTail)
              for (const line of localEntries) {
                const u = wikiLogEntryForMatch(line)
                if (!u) continue
                // a) Exacto.
                if (consumeRemote(u)) continue
                // b) Truncación por push (cap 200), luego c) wrap del pull.
                let pushTruncHit: string | undefined
                let wrapHit: string | undefined
                for (const [e, count] of remoteCounts) {
                  if (count <= 0) continue
                  if (
                    pushTruncHit === undefined
                    && e.length === MAX_WIKI_LOG_SUMMARY
                    && u.startsWith(e)
                  ) {
                    pushTruncHit = e
                  } else if (wrapHit === undefined && u.endsWith(e)) {
                    wrapHit = e
                  }
                  if (pushTruncHit !== undefined) break
                }
                const hit = pushTruncHit ?? wrapHit
                if (hit !== undefined && consumeRemote(hit)) continue
                const capped = wikiLogEntryForServer(line)
                const result = await deps.appendWikiLog(capped)
                if (!result.ok) return abort('log', result.error)
                logLines += 1
              }
              const seeded = stateByScope.get(key)
              if (seeded) seeded.logLineCount = localEntries.length
            }
          } catch {
            // Sin log remoto: baseline silencioso más abajo.
          }
        }
      }
    } catch {
      // Sin seed: cae al path vacío (upserta locales).
    }
  }

  const state = scopeState(key)
  const local = new Map<string, OrgWikiLocalPage>()
  for (const node of graph.data.nodes) {
    const slug = node.slug.trim()
    if (!slug) continue
    local.set(slug, {
      slug,
      title: node.title,
      type: node.type,
      body: node.body ?? '',
    })
  }

  for (const [slug, page] of local) {
    const hash = orgWikiPageHash(page)
    if (state.pageHashes.get(slug) === hash) continue
    const result = await deps.upsertWikiPage(slug, {
      title: page.title,
      pageType: page.type,
      body: page.body,
    })
    if (!result.ok) return abort(`upsert ${slug}`, result.error)
    state.pageHashes.set(slug, hash)
    upserts += 1
  }

  for (const slug of [...state.pageHashes.keys()]) {
    if (local.has(slug)) continue
    const result = await deps.deleteWikiPage(slug)
    if (!result.ok) return abort(`delete ${slug}`, result.error)
    state.pageHashes.delete(slug)
    deletes += 1
  }

  const entries = wikiLogEntryLines(graph.logTail)
  if (state.logLineCount == null) {
    // Primer push del scope: baseline sin re-pushear historial local.
    state.logLineCount = entries.length
  } else if (entries.length > state.logLineCount) {
    const fresh = entries.slice(state.logLineCount)
    for (const line of fresh) {
      const entry = wikiLogEntryForServer(line)
      if (!entry) {
        state.logLineCount += 1
        continue
      }
      const result = await deps.appendWikiLog(entry)
      if (!result.ok) return abort('log', result.error)
      state.logLineCount += 1
      logLines += 1
    }
  } else if (entries.length < state.logLineCount) {
    // Tail rotó (cap de 50) o wiki recreada: rebaselinear sin pushear.
    state.logLineCount = entries.length
  }

  return { ok: true, upserts, deletes, logLines }
}
