import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WikiGraphNodeType, WikiGraphResult } from '@shared/wikiGraph'
import { MAX_WIKI_LOG_SUMMARY } from '@shared/wikiDoc'
import {
  clearOrgWikiSyncScope,
  hasOrgWikiSyncScope,
  orgWikiPageHash,
  orgWikiSyncScopeKey,
  seedOrgWikiSyncScope,
  syncOrgWikiPush,
  wikiLogEntryForMatch,
  wikiLogEntryForServer,
  wikiLogEntryLines,
  type OrgWikiPushDeps,
} from '../orgWikiSync'

const scopeA = { orgSlug: 'acme', workspaceId: 'ws-1' }
const scopeB = { orgSlug: 'acme', workspaceId: 'ws-2' }

function graphResult(
  nodes: Array<{ slug: string; title: string; type: string; body: string }>,
  logTail: string[] = [],
): WikiGraphResult {
  return {
    ok: true,
    data: {
      nodes: nodes.map(node => ({
        slug: node.slug,
        title: node.title,
        type: node.type as WikiGraphNodeType,
        linkCount: 0,
        body: node.body,
      })),
      edges: [],
    },
    logTail,
  }
}

function makeDeps(
  scope: { orgSlug: string; workspaceId: string },
  graph: WikiGraphResult,
): OrgWikiPushDeps & {
  upsertWikiPage: ReturnType<typeof vi.fn>
  deleteWikiPage: ReturnType<typeof vi.fn>
  appendWikiLog: ReturnType<typeof vi.fn>
} {
  return {
    scope,
    cwd: '/tmp/proyecto',
    getWikiGraph: vi.fn(async () => graph),
    upsertWikiPage: vi.fn(async () => ({ ok: true as const, data: null })),
    deleteWikiPage: vi.fn(async () => ({ ok: true as const, data: null })),
    appendWikiLog: vi.fn(async () => ({ ok: true as const, data: null })),
  }
}

beforeEach(() => {
  clearOrgWikiSyncScope(scopeA)
  clearOrgWikiSyncScope(scopeB)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  clearOrgWikiSyncScope(scopeA)
  clearOrgWikiSyncScope(scopeB)
  vi.restoreAllMocks()
})

describe('orgWikiPageHash', () => {
  it('coincide con sha256 real de title|type|body (vector de node:crypto)', () => {
    // node -e "crypto.createHash('sha256').update('Alfa\u0000concept\u0000a').digest('hex')"
    expect(orgWikiPageHash({ title: 'Alfa', type: 'concept', body: 'a' }))
      .toBe('71a1664c80bc7fe6706295ef91c66261f6d72fe047b33686ae0008a295c604d4')
    // Normaliza como composeWikiPage: trim + CRLF→LF.
    expect(orgWikiPageHash({ title: ' Alfa ', type: 'concept', body: ' a\r\n' }))
      .toBe(orgWikiPageHash({ title: 'Alfa', type: 'concept', body: 'a' }))
  })
})

describe('orgWikiSyncScopeKey', () => {
  it('separa org y workspace con \\0 y exige ambos', () => {
    expect(orgWikiSyncScopeKey(scopeA)).toBe('acme\0ws-1')
    expect(orgWikiSyncScopeKey({ orgSlug: '', workspaceId: 'ws-1' })).toBe('')
    expect(orgWikiSyncScopeKey({ orgSlug: 'acme', workspaceId: ' ' })).toBe('')
  })
})

describe('syncOrgWikiPush', () => {
  it('sin caché: upserta todas las pages locales y baselinea el log sin pushearlo', async () => {
    const deps = makeDeps(scopeA, graphResult(
      [
        { slug: 'alfa', title: 'Alfa', type: 'concept', body: 'a' },
        { slug: 'beta', title: 'Beta', type: 'flow', body: 'b' },
      ],
      ['# Wiki log', '- `2026-01-01` — [tl] vieja'],
    ))
    const result = await syncOrgWikiPush(deps)
    expect(result).toEqual({ ok: true, upserts: 2, deletes: 0, logLines: 0 })
    expect(deps.upsertWikiPage).toHaveBeenCalledWith('alfa', {
      title: 'Alfa',
      pageType: 'concept',
      body: 'a',
    })
    expect(deps.appendWikiLog).not.toHaveBeenCalled()
  })

  it('re-push sin cambios no llama a la API; cambios y bajas diffean', async () => {
    const first = makeDeps(scopeA, graphResult([
      { slug: 'alfa', title: 'Alfa', type: 'concept', body: 'a' },
      { slug: 'beta', title: 'Beta', type: 'flow', body: 'b' },
    ]))
    await syncOrgWikiPush(first)

    const same = makeDeps(scopeA, graphResult([
      { slug: 'alfa', title: 'Alfa', type: 'concept', body: 'a' },
      { slug: 'beta', title: 'Beta', type: 'flow', body: 'b' },
    ]))
    expect(await syncOrgWikiPush(same)).toEqual({ ok: true, upserts: 0, deletes: 0, logLines: 0 })
    expect(same.upsertWikiPage).not.toHaveBeenCalled()
    expect(same.deleteWikiPage).not.toHaveBeenCalled()

    // alfa cambia de body, beta desaparece.
    const changed = makeDeps(scopeA, graphResult([
      { slug: 'alfa', title: 'Alfa', type: 'concept', body: 'a v2' },
    ]))
    const result = await syncOrgWikiPush(changed)
    expect(result).toEqual({ ok: true, upserts: 1, deletes: 1, logLines: 0 })
    expect(changed.upsertWikiPage).toHaveBeenCalledWith('alfa', {
      title: 'Alfa',
      pageType: 'concept',
      body: 'a v2',
    })
    expect(changed.deleteWikiPage).toHaveBeenCalledWith('beta')
  })

  it('pushea solo las líneas de log nuevas más allá del contador cacheado', async () => {
    const baseline = makeDeps(scopeA, graphResult(
      [{ slug: 'alfa', title: 'Alfa', type: 'concept', body: 'a' }],
      ['# Wiki log', '- `t1` — [tl] alta de alfa'],
    ))
    await syncOrgWikiPush(baseline)

    const withNewLines = makeDeps(scopeA, graphResult(
      [{ slug: 'alfa', title: 'Alfa', type: 'concept', body: 'a' }],
      [
        '# Wiki log',
        '- `t1` — [tl] alta de alfa',
        '- `t2` — [fe] ajuste de alfa',
        '- `t3` — [qa] revisión',
      ],
    ))
    const result = await syncOrgWikiPush(withNewLines)
    expect(result.logLines).toBe(2)
    expect(withNewLines.appendWikiLog).toHaveBeenNthCalledWith(1, '`t2` — [fe] ajuste de alfa')
    expect(withNewLines.appendWikiLog).toHaveBeenNthCalledWith(2, '`t3` — [qa] revisión')

    // Re-push del mismo tail: nada nuevo.
    const again = makeDeps(scopeA, graphResult(
      [{ slug: 'alfa', title: 'Alfa', type: 'concept', body: 'a' }],
      [
        '# Wiki log',
        '- `t1` — [tl] alta de alfa',
        '- `t2` — [fe] ajuste de alfa',
        '- `t3` — [qa] revisión',
      ],
    ))
    expect((await syncOrgWikiPush(again)).logLines).toBe(0)
    expect(again.appendWikiLog).not.toHaveBeenCalled()
  })

  it('aísla scopes: el mismo slug en dos workspaces no comparte hashes', async () => {
    const pushA = makeDeps(scopeA, graphResult([
      { slug: 'alfa', title: 'Alfa', type: 'concept', body: 'cuerpo A' },
    ]))
    await syncOrgWikiPush(pushA)

    // Mismo slug y otro body en el workspace B: debe upsertear (no hay caché compartido).
    const pushB = makeDeps(scopeB, graphResult([
      { slug: 'alfa', title: 'Alfa', type: 'concept', body: 'cuerpo B' },
    ]))
    const result = await syncOrgWikiPush(pushB)
    expect(result.upserts).toBe(1)

    // Limpiar B no toca A.
    clearOrgWikiSyncScope(scopeB)
    expect(hasOrgWikiSyncScope(scopeA)).toBe(true)
    expect(hasOrgWikiSyncScope(scopeB)).toBe(false)
    const repushA = makeDeps(scopeA, graphResult([
      { slug: 'alfa', title: 'Alfa', type: 'concept', body: 'cuerpo A' },
    ]))
    expect((await syncOrgWikiPush(repushA)).upserts).toBe(0)
  })

  it('seed tras pull: lo bajado no se re-pushea', async () => {
    await seedOrgWikiSyncScope(scopeA, [
      { slug: 'alfa', title: 'Alfa', type: 'concept', body: 'a' },
      { slug: 'beta', title: 'Beta', type: 'flow', body: 'b' },
    ])
    const deps = makeDeps(scopeA, graphResult([
      { slug: 'alfa', title: 'Alfa', type: 'concept', body: 'a' },
      { slug: 'beta', title: 'Beta', type: 'flow', body: 'b' },
    ]))
    const result = await syncOrgWikiPush(deps)
    expect(result).toEqual({ ok: true, upserts: 0, deletes: 0, logLines: 0 })
    expect(deps.upsertWikiPage).not.toHaveBeenCalled()
    expect(deps.deleteWikiPage).not.toHaveBeenCalled()
  })

  it('seed en frío con listRemotePages: siembra y propaga delete local', async () => {
    const listRemotePages = vi.fn(async () => ({
      ok: true as const,
      data: [
        { slug: 'alfa', title: 'Alfa', pageType: 'concept', body: 'a' },
        { slug: 'beta', title: 'Beta', pageType: 'flow', body: 'b' },
      ],
    }))
    // Scope frío: local solo tiene alfa (beta borrada localmente tras reinicio).
    const deps = {
      ...makeDeps(scopeA, graphResult([
        { slug: 'alfa', title: 'Alfa', type: 'concept', body: 'a' },
      ])),
      listRemotePages,
    }
    const result = await syncOrgWikiPush(deps)
    expect(listRemotePages).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ ok: true, upserts: 0, deletes: 1, logLines: 0 })
    expect(deps.upsertWikiPage).not.toHaveBeenCalled()
    expect(deps.deleteWikiPage).toHaveBeenCalledWith('beta')

    // Segundo push: ya hay caché, no vuelve a listar.
    const again = {
      ...makeDeps(scopeA, graphResult([
        { slug: 'alfa', title: 'Alfa', type: 'concept', body: 'a' },
      ])),
      listRemotePages,
    }
    expect(await syncOrgWikiPush(again)).toEqual({ ok: true, upserts: 0, deletes: 0, logLines: 0 })
    expect(listRemotePages).toHaveBeenCalledTimes(1)
  })

  it('seed en frío + listRemoteLog: sube solo la línea local nueva', async () => {
    const listRemotePages = vi.fn(async () => ({
      ok: true as const,
      data: [{ slug: 'alfa', title: 'Alfa', pageType: 'concept', body: 'a' }],
    }))
    const listRemoteLog = vi.fn(async () => ({
      ok: true as const,
      // Server DESC: más reciente primero.
      data: [
        { entry: '`t2` — [fe] ajuste' },
        { entry: '`t1` — [tl] alta' },
      ],
    }))
    const deps = {
      ...makeDeps(scopeA, graphResult(
        [{ slug: 'alfa', title: 'Alfa', type: 'concept', body: 'a' }],
        [
          '# Wiki log',
          '- `t1` — [tl] alta',
          '- `t2` — [fe] ajuste',
          '- `t3` — [qa] revisión del turno',
        ],
      )),
      listRemotePages,
      listRemoteLog,
    }
    const result = await syncOrgWikiPush(deps)
    expect(listRemoteLog).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ ok: true, upserts: 0, deletes: 0, logLines: 1 })
    expect(deps.appendWikiLog).toHaveBeenCalledTimes(1)
    expect(deps.appendWikiLog).toHaveBeenCalledWith('`t3` — [qa] revisión del turno')

    // logLineCount = total local (3): re-push del mismo tail no vuelve a listar ni subir.
    const again = {
      ...makeDeps(scopeA, graphResult(
        [{ slug: 'alfa', title: 'Alfa', type: 'concept', body: 'a' }],
        [
          '# Wiki log',
          '- `t1` — [tl] alta',
          '- `t2` — [fe] ajuste',
          '- `t3` — [qa] revisión del turno',
        ],
      )),
      listRemotePages,
      listRemoteLog,
    }
    expect(await syncOrgWikiPush(again)).toEqual({ ok: true, upserts: 0, deletes: 0, logLines: 0 })
    expect(listRemoteLog).toHaveBeenCalledTimes(1)
    expect(again.appendWikiLog).not.toHaveBeenCalled()
  })

  it('seed en frío: suffix-match evita re-pushear líneas re-formateadas del pull', async () => {
    const listRemotePages = vi.fn(async () => ({
      ok: true as const,
      data: [{ slug: 'alfa', title: 'Alfa', pageType: 'concept', body: 'a' }],
    }))
    const listRemoteLog = vi.fn(async () => ({
      ok: true as const,
      data: [
        { entry: 'ajuste reciente' },
        { entry: 'alta inicial' },
      ],
    }))
    // Tail local como tras replaceWikiLogFromServer: timestamp/autor envuelven el entry.
    const deps = {
      ...makeDeps(scopeA, graphResult(
        [{ slug: 'alfa', title: 'Alfa', type: 'concept', body: 'a' }],
        [
          '# Wiki log',
          '- `2026-08-13T10:00:00.000Z` — [tl] alta inicial',
          '- `2026-08-13T12:00:00.000Z` — [fe] ajuste reciente',
        ],
      )),
      listRemotePages,
      listRemoteLog,
    }
    const result = await syncOrgWikiPush(deps)
    expect(result).toEqual({ ok: true, upserts: 0, deletes: 0, logLines: 0 })
    expect(deps.appendWikiLog).not.toHaveBeenCalled()
  })

  it('seed en frío: listRemoteLog falla → baseline sin push; segundo push sí sube nueva', async () => {
    const listRemotePages = vi.fn(async () => ({
      ok: true as const,
      data: [{ slug: 'alfa', title: 'Alfa', pageType: 'concept', body: 'a' }],
    }))
    const listRemoteLog = vi.fn(async () => ({
      ok: false as const,
      error: 'network',
    }))
    const first = {
      ...makeDeps(scopeA, graphResult(
        [{ slug: 'alfa', title: 'Alfa', type: 'concept', body: 'a' }],
        ['# Wiki log', '- `t1` — [tl] alta'],
      )),
      listRemotePages,
      listRemoteLog,
    }
    expect(await syncOrgWikiPush(first)).toEqual({ ok: true, upserts: 0, deletes: 0, logLines: 0 })
    expect(listRemoteLog).toHaveBeenCalledTimes(1)
    expect(first.appendWikiLog).not.toHaveBeenCalled()

    const second = {
      ...makeDeps(scopeA, graphResult(
        [{ slug: 'alfa', title: 'Alfa', type: 'concept', body: 'a' }],
        [
          '# Wiki log',
          '- `t1` — [tl] alta',
          '- `t2` — [fe] post-baseline',
        ],
      )),
      listRemotePages,
      listRemoteLog,
    }
    expect(await syncOrgWikiPush(second)).toEqual({ ok: true, upserts: 0, deletes: 0, logLines: 1 })
    expect(listRemoteLog).toHaveBeenCalledTimes(1)
    expect(second.appendWikiLog).toHaveBeenCalledWith('`t2` — [fe] post-baseline')
  })

  it('seed en frío: multiset sube la línea con summary repetido (timestamp distinto)', async () => {
    const listRemotePages = vi.fn(async () => ({
      ok: true as const,
      data: [{ slug: 'alfa', title: 'Alfa', pageType: 'concept', body: 'a' }],
    }))
    const listRemoteLog = vi.fn(async () => ({
      ok: true as const,
      data: [{ entry: '`ISO1` — [a] 1 wiki change' }],
    }))
    const deps = {
      ...makeDeps(scopeA, graphResult(
        [{ slug: 'alfa', title: 'Alfa', type: 'concept', body: 'a' }],
        [
          '# Wiki log',
          '- `ISO1` — [a] 1 wiki change',
          '- `ISO2` — [a] 1 wiki change',
        ],
      )),
      listRemotePages,
      listRemoteLog,
    }
    const result = await syncOrgWikiPush(deps)
    expect(result).toEqual({ ok: true, upserts: 0, deletes: 0, logLines: 1 })
    expect(deps.appendWikiLog).toHaveBeenCalledTimes(1)
    expect(deps.appendWikiLog).toHaveBeenCalledWith('`ISO2` — [a] 1 wiki change')
  })

  it('seed en frío: multiset — suffix compartido no absorbe la segunda línea', async () => {
    // Tras pull, el remoto puede ser solo el summary; ambas locales terminan igual.
    const listRemotePages = vi.fn(async () => ({
      ok: true as const,
      data: [{ slug: 'alfa', title: 'Alfa', pageType: 'concept', body: 'a' }],
    }))
    const listRemoteLog = vi.fn(async () => ({
      ok: true as const,
      data: [{ entry: '[a] 1 wiki change' }],
    }))
    const deps = {
      ...makeDeps(scopeA, graphResult(
        [{ slug: 'alfa', title: 'Alfa', type: 'concept', body: 'a' }],
        [
          '# Wiki log',
          '- `ISO1` — [a] 1 wiki change',
          '- `ISO2` — [a] 1 wiki change',
        ],
      )),
      listRemotePages,
      listRemoteLog,
    }
    const result = await syncOrgWikiPush(deps)
    expect(result).toEqual({ ok: true, upserts: 0, deletes: 0, logLines: 1 })
    expect(deps.appendWikiLog).toHaveBeenCalledTimes(1)
    expect(deps.appendWikiLog).toHaveBeenCalledWith('`ISO2` — [a] 1 wiki change')
  })

  it('seed en frío: multiset N=2 remotas y 2 locales equivalentes no sube nada', async () => {
    const listRemotePages = vi.fn(async () => ({
      ok: true as const,
      data: [{ slug: 'alfa', title: 'Alfa', pageType: 'concept', body: 'a' }],
    }))
    const entry = '`ISO1` — [a] 1 wiki change'
    const listRemoteLog = vi.fn(async () => ({
      ok: true as const,
      data: [{ entry }, { entry }],
    }))
    const deps = {
      ...makeDeps(scopeA, graphResult(
        [{ slug: 'alfa', title: 'Alfa', type: 'concept', body: 'a' }],
        [
          '# Wiki log',
          `- ${entry}`,
          `- ${entry}`,
        ],
      )),
      listRemotePages,
      listRemoteLog,
    }
    const result = await syncOrgWikiPush(deps)
    expect(result).toEqual({ ok: true, upserts: 0, deletes: 0, logLines: 0 })
    expect(deps.appendWikiLog).not.toHaveBeenCalled()
  })

  it('seed en frío: entry remoto de 200 chars pull-wrapped no se re-sube; la nueva sí', async () => {
    const remote200 = 'R'.repeat(MAX_WIKI_LOG_SUMMARY)
    expect(remote200).toHaveLength(200)
    const listRemotePages = vi.fn(async () => ({
      ok: true as const,
      data: [{ slug: 'alfa', title: 'Alfa', pageType: 'concept', body: 'a' }],
    }))
    const listRemoteLog = vi.fn(async () => ({
      ok: true as const,
      data: [{ entry: remote200 }],
    }))
    // Tras pull: wrapper + entry completo (antes el match truncaba y fallaba endsWith).
    const wrapped = `\`2026-08-13T14:00:00.000Z\` — [tl] ${remote200}`
    const deps = {
      ...makeDeps(scopeA, graphResult(
        [{ slug: 'alfa', title: 'Alfa', type: 'concept', body: 'a' }],
        [
          '# Wiki log',
          `- ${wrapped}`,
          '- `t-new` — [qa] línea nueva del turno',
        ],
      )),
      listRemotePages,
      listRemoteLog,
    }
    const result = await syncOrgWikiPush(deps)
    expect(result).toEqual({ ok: true, upserts: 0, deletes: 0, logLines: 1 })
    expect(deps.appendWikiLog).toHaveBeenCalledTimes(1)
    expect(deps.appendWikiLog).toHaveBeenCalledWith('`t-new` — [qa] línea nueva del turno')
  })

  it('seed en frío: línea local >200 se consume por startsWith del prefijo remoto', async () => {
    const full = `${'L'.repeat(150)}-${'X'.repeat(80)}`
    expect(full.length).toBeGreaterThan(MAX_WIKI_LOG_SUMMARY)
    const prefix200 = full.slice(0, MAX_WIKI_LOG_SUMMARY)
    const listRemotePages = vi.fn(async () => ({
      ok: true as const,
      data: [{ slug: 'alfa', title: 'Alfa', pageType: 'concept', body: 'a' }],
    }))
    const listRemoteLog = vi.fn(async () => ({
      ok: true as const,
      data: [{ entry: prefix200 }],
    }))
    const deps = {
      ...makeDeps(scopeA, graphResult(
        [{ slug: 'alfa', title: 'Alfa', type: 'concept', body: 'a' }],
        ['# Wiki log', `- ${full}`],
      )),
      listRemotePages,
      listRemoteLog,
    }
    const result = await syncOrgWikiPush(deps)
    expect(result).toEqual({ ok: true, upserts: 0, deletes: 0, logLines: 0 })
    expect(deps.appendWikiLog).not.toHaveBeenCalled()
  })

  it('seed en frío: prefijo remoto <200 no dispara startsWith; la local distinta sube', async () => {
    const remotePrefix = 'prefijo-corto-remoto'
    expect(remotePrefix.length).toBeLessThan(MAX_WIKI_LOG_SUMMARY)
    const localDistinct = `${remotePrefix}-y-mas-contenido-distinto`
    const listRemotePages = vi.fn(async () => ({
      ok: true as const,
      data: [{ slug: 'alfa', title: 'Alfa', pageType: 'concept', body: 'a' }],
    }))
    const listRemoteLog = vi.fn(async () => ({
      ok: true as const,
      data: [{ entry: remotePrefix }],
    }))
    const deps = {
      ...makeDeps(scopeA, graphResult(
        [{ slug: 'alfa', title: 'Alfa', type: 'concept', body: 'a' }],
        ['# Wiki log', `- ${localDistinct}`],
      )),
      listRemotePages,
      listRemoteLog,
    }
    const result = await syncOrgWikiPush(deps)
    expect(result).toEqual({ ok: true, upserts: 0, deletes: 0, logLines: 1 })
    expect(deps.appendWikiLog).toHaveBeenCalledTimes(1)
    expect(deps.appendWikiLog).toHaveBeenCalledWith(
      localDistinct.slice(0, MAX_WIKI_LOG_SUMMARY),
    )
  })

  it('scope ya sembrado: listRemoteLog no se llama', async () => {
    seedOrgWikiSyncScope(
      scopeA,
      [{ slug: 'alfa', title: 'Alfa', type: 'concept', body: 'a' }],
      1,
    )
    const listRemotePages = vi.fn(async () => ({
      ok: true as const,
      data: [{ slug: 'alfa', title: 'Alfa', pageType: 'concept', body: 'a' }],
    }))
    const listRemoteLog = vi.fn(async () => ({
      ok: true as const,
      data: [{ entry: '`t1` — [tl] alta' }],
    }))
    const deps = {
      ...makeDeps(scopeA, graphResult(
        [{ slug: 'alfa', title: 'Alfa', type: 'concept', body: 'a' }],
        ['# Wiki log', '- `t1` — [tl] alta'],
      )),
      listRemotePages,
      listRemoteLog,
    }
    expect(await syncOrgWikiPush(deps)).toEqual({ ok: true, upserts: 0, deletes: 0, logLines: 0 })
    expect(listRemotePages).not.toHaveBeenCalled()
    expect(listRemoteLog).not.toHaveBeenCalled()
    expect(deps.appendWikiLog).not.toHaveBeenCalled()
  })

  it('seedOrgWikiSyncScope con logLineCount baselinea el log', async () => {
    seedOrgWikiSyncScope(
      scopeA,
      [{ slug: 'alfa', title: 'Alfa', type: 'concept', body: 'a' }],
      1,
    )
    const same = makeDeps(scopeA, graphResult(
      [{ slug: 'alfa', title: 'Alfa', type: 'concept', body: 'a' }],
      ['# Wiki log', '- `t1` — [tl] alta'],
    ))
    expect(await syncOrgWikiPush(same)).toEqual({ ok: true, upserts: 0, deletes: 0, logLines: 0 })
    expect(same.appendWikiLog).not.toHaveBeenCalled()

    const withNew = makeDeps(scopeA, graphResult(
      [{ slug: 'alfa', title: 'Alfa', type: 'concept', body: 'a' }],
      ['# Wiki log', '- `t1` — [tl] alta', '- `t2` — [fe] ajuste'],
    ))
    expect((await syncOrgWikiPush(withNew)).logLines).toBe(1)
    expect(withNew.appendWikiLog).toHaveBeenCalledWith('`t2` — [fe] ajuste')
  })

  it('error del endpoint (401/403): log a consola, corta y no reintenta en loop', async () => {
    const deps = makeDeps(scopeA, graphResult([
      { slug: 'alfa', title: 'Alfa', type: 'concept', body: 'a' },
      { slug: 'beta', title: 'Beta', type: 'flow', body: 'b' },
    ]))
    deps.upsertWikiPage.mockResolvedValue({ ok: false, error: 'forbidden' })
    const result = await syncOrgWikiPush(deps)
    expect(result.ok).toBe(false)
    expect(deps.upsertWikiPage).toHaveBeenCalledTimes(1)
    expect(deps.deleteWikiPage).not.toHaveBeenCalled()
    expect(deps.appendWikiLog).not.toHaveBeenCalled()
    expect(console.warn).toHaveBeenCalledTimes(1)
  })

  it('grafo no ok o cwd vacío: no pushea nada', async () => {
    const broken = makeDeps(scopeA, { ok: false, error: 'sin wiki' })
    expect(await syncOrgWikiPush(broken)).toEqual({ ok: true, upserts: 0, deletes: 0, logLines: 0 })
    expect(broken.upsertWikiPage).not.toHaveBeenCalled()

    const noCwd = makeDeps(scopeA, graphResult([
      { slug: 'alfa', title: 'Alfa', type: 'concept', body: 'a' },
    ]))
    noCwd.cwd = '   '
    expect((await syncOrgWikiPush(noCwd)).upserts).toBe(0)
  })
})

describe('wikiLogEntryLines / wikiLogEntryForMatch / wikiLogEntryForServer', () => {
  it('filtra encabezados y líneas vacías; match sin cap; POST con cap', () => {
    const tail = ['# Wiki log', '', '- `t1` — [tl] alta', 'texto suelto', '- `t2` — [fe] ajuste']
    expect(wikiLogEntryLines(tail)).toEqual(['- `t1` — [tl] alta', '- `t2` — [fe] ajuste'])
    expect(wikiLogEntryForMatch('- `t1` — [tl] alta')).toBe('`t1` — [tl] alta')
    expect(wikiLogEntryForServer('- `t1` — [tl] alta')).toBe('`t1` — [tl] alta')
    const long = `- ${'Z'.repeat(250)}`
    expect(wikiLogEntryForMatch(long)).toHaveLength(250)
    expect(wikiLogEntryForServer(long)).toHaveLength(MAX_WIKI_LOG_SUMMARY)
    expect(wikiLogEntryLines(undefined)).toEqual([])
  })
})
