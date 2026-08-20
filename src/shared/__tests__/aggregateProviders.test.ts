import { describe, expect, it } from 'vitest'
import { aggregateProviders, aggregatePulse, type PulseEvent } from '../pulseEvents'

/** epoch ms del mediodía local de un día ISO — evita que la tz corra la fecha. */
function noon(day: string): number {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y!, m! - 1, d!, 12, 0, 0).getTime()
}

function prompt(day: string, extra: Partial<PulseEvent> = {}): PulseEvent {
  return { ts: noon(day), kind: 'prompt', ...extra }
}

const now = noon('2026-08-09')

describe('aggregateProviders', () => {
  it('agrupa dos providers por separado sin mezclar tokensIn/tokensOut', () => {
    const rows = aggregateProviders(
      [
        prompt('2026-08-09', { provider: 'claude', tokensIn: 100, tokensOut: 20 }),
        prompt('2026-08-09', { provider: 'claude', tokensIn: 50, tokensOut: 10 }),
        prompt('2026-08-09', { provider: 'codex', tokensIn: 300, tokensOut: 40 }),
      ],
      now,
    )
    const claude = rows.find(r => r.provider === 'claude')!
    const codex = rows.find(r => r.provider === 'codex')!
    expect(claude.tokensIn).toBe(150)
    expect(claude.tokensOut).toBe(30)
    expect(claude.tokens).toBe(180)
    expect(codex.tokensIn).toBe(300)
    expect(codex.tokensOut).toBe(40)
    expect(codex.tokens).toBe(340)
  })

  it('ignora commit, delegate, result y prompts sin provider', () => {
    const rows = aggregateProviders(
      [
        prompt('2026-08-09', { provider: 'claude' }),
        { ts: noon('2026-08-09'), kind: 'commit' },
        { ts: noon('2026-08-09'), kind: 'delegate', agentId: 'tl', toAgentId: 'qa' },
        { ts: noon('2026-08-09'), kind: 'result', agentId: 'qa' },
        prompt('2026-08-09'),
        prompt('2026-08-09', { provider: '   ' }),
      ],
      now,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]!.provider).toBe('claude')
    expect(rows[0]!.turns).toBe(1)
  })

  it('distingue measuredTurns de turnos sin medicion de tokens', () => {
    const rows = aggregateProviders(
      [
        ...Array.from({ length: 5 }, () => prompt('2026-08-09', { provider: 'cursor' })),
        prompt('2026-08-09', { provider: 'claude', tokensIn: 10, tokensOut: 5 }),
      ],
      now,
    )
    const cursor = rows.find(r => r.provider === 'cursor')!
    const claude = rows.find(r => r.provider === 'claude')!
    expect(cursor).toMatchObject({ turns: 5, tokens: 0, measuredTurns: 0 })
    expect(claude).toMatchObject({ turns: 1, tokens: 15, measuredTurns: 1 })
  })

  it('ordena por tokens, luego turns y luego provider', () => {
    const rows = aggregateProviders(
      [
        prompt('2026-08-09', { provider: 'beta', tokensIn: 10 }),
        prompt('2026-08-09', { provider: 'alpha', tokensIn: 10 }),
        prompt('2026-08-09', { provider: 'gamma', tokensIn: 5, tokensOut: 5 }),
        prompt('2026-08-09', { provider: 'delta', tokensIn: 20 }),
        prompt('2026-08-09', { provider: 'epsilon', tokensIn: 20 }),
        prompt('2026-08-09', { provider: 'epsilon' }),
      ],
      now,
    )
    expect(rows.map(r => r.provider)).toEqual(['epsilon', 'delta', 'alpha', 'beta', 'gamma'])
  })

  it('cuenta activeDays distintos y lastTs como el mayor ts', () => {
    const early = noon('2026-08-07')
    const late = noon('2026-08-09') + 3_600_000
    const rows = aggregateProviders(
      [
        { ...prompt('2026-08-07', { provider: 'claude' }), ts: early },
        prompt('2026-08-08', { provider: 'claude' }),
        { ...prompt('2026-08-09', { provider: 'claude' }), ts: late },
      ],
      now,
    )
    expect(rows[0]).toMatchObject({ activeDays: 3, lastTs: late })
  })

  it('agents ordena por turnos y omite prompts sin agentId', () => {
    const rows = aggregateProviders(
      [
        prompt('2026-08-09', { provider: 'claude', agentId: 'qa' }),
        prompt('2026-08-09', { provider: 'claude', agentId: 'dev' }),
        prompt('2026-08-09', { provider: 'claude', agentId: 'dev' }),
        prompt('2026-08-09', { provider: 'claude', agentId: 'tl' }),
        prompt('2026-08-09', { provider: 'claude' }),
      ],
      now,
    )
    expect(rows[0]!.agents).toEqual([
      { agentId: 'dev', turns: 2 },
      { agentId: 'qa', turns: 1 },
      { agentId: 'tl', turns: 1 },
    ])
  })

  it('recorta espacios del provider al agrupar', () => {
    const rows = aggregateProviders(
      [prompt('2026-08-09', { provider: '  claude  ', tokensIn: 1 })],
      now,
    )
    expect(rows[0]!.provider).toBe('claude')
  })
})

describe('aggregatePulse providers', () => {
  it('expone providers y la suma de tokens coincide con totalTokens', () => {
    const events = [
      prompt('2026-08-09', { provider: 'claude', tokensIn: 100, tokensOut: 10 }),
      prompt('2026-08-09', { provider: 'codex', tokensIn: 200, tokensOut: 20 }),
      prompt('2026-08-09', { provider: 'cursor', tokensIn: 50, tokensOut: 5 }),
    ]
    const stats = aggregatePulse(events, now)
    expect(stats.providers).toHaveLength(3)
    const providerTokens = stats.providers.reduce((sum, r) => sum + r.tokens, 0)
    expect(providerTokens).toBe(stats.totalTokens)
    expect(providerTokens).toBe(385)
  })
})
