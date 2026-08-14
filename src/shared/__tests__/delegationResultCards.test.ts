import { describe, expect, it } from 'vitest'
import {
  buildBatchedDelegationFollowUp,
  formatDelegationResultFollowUp,
} from '../agentOrchestration'
import {
  looksLikeDelegationResultFollowUp,
  parseDelegationResultCards,
} from '../delegationResultCards'

describe('looksLikeDelegationResultFollowUp', () => {
  it('detects host follow-ups without the presentation tag', () => {
    expect(looksLikeDelegationResultFollowUp('## Delegation result\nid: d1')).toBe(true)
    expect(looksLikeDelegationResultFollowUp('\n## Delegation result\nid: d1')).toBe(true)
  })

  it('does not claim ordinary user messages', () => {
    expect(looksLikeDelegationResultFollowUp('Fix the login form')).toBe(false)
    expect(looksLikeDelegationResultFollowUp('## Orchestration limit\nStop.')).toBe(false)
  })
})

describe('parseDelegationResultCards', () => {
  it('reads agent, status and summary from a real follow-up', () => {
    const text = formatDelegationResultFollowUp({
      id: 'd1',
      status: 'ok',
      summary: 'Login form validated on submit.',
      toAgentId: 'frontend',
      resultContextId: 'ctx-frontend',
    }, { round: 1, maxRounds: 3 })
    const [card] = parseDelegationResultCards(text)
    expect(card).toMatchObject({
      id: 'd1',
      status: 'ok',
      agentId: 'frontend',
      resultContextId: 'ctx-frontend',
      summary: 'Login form validated on submit.',
      round: '1/3',
    })
    expect(card.changelog).toEqual([])
  })

  it('keeps fail and aborted statuses', () => {
    const fail = parseDelegationResultCards(formatDelegationResultFollowUp({
      id: 'd2',
      status: 'fail',
      summary: 'Build broke.',
      toAgentId: 'backend',
    }))
    expect(fail[0].status).toBe('fail')
    const aborted = parseDelegationResultCards(formatDelegationResultFollowUp({
      id: 'd3',
      status: 'aborted',
      summary: 'Delegation cancelled',
    }))
    expect(aborted[0].status).toBe('aborted')
    expect(aborted[0].agentId).toBeUndefined()
  })

  it('drops the host boilerplate from the visible summary', () => {
    const text = formatDelegationResultFollowUp({
      id: 'd4',
      status: 'ok',
      summary: 'Done.',
      toAgentId: 'frontend',
    }, { round: 2, maxRounds: 3 })
    const [card] = parseDelegationResultCards(text)
    expect(card.summary).toBe('Done.')
    expect(card.summary).not.toContain('Stop condition')
    expect(card.summary).not.toContain('ia-terminal-delegate')
    expect(card.summary).not.toContain('delegation waves')
  })

  it('drops the batch wait line and keeps pendingInBatch', () => {
    const text = formatDelegationResultFollowUp({
      id: 'd5',
      status: 'ok',
      summary: 'Slice one done.',
      toAgentId: 'frontend',
    }, { batchRemaining: 2 })
    const [card] = parseDelegationResultCards(text)
    expect(card.pendingInBatch).toBe(2)
    expect(card.summary).toBe('Slice one done.')
    expect(card.summary).not.toContain('Wait for the remaining')
  })

  it('drops the continuous product owner boilerplate', () => {
    const text = formatDelegationResultFollowUp({
      id: 'd6',
      status: 'ok',
      summary: 'Slice done.',
    }, { continuousProductOwner: true, maxRounds: 4 })
    const [card] = parseDelegationResultCards(text)
    expect(card.summary).toBe('Slice done.')
    expect(card.summary).not.toContain('If the slice PASSED')
  })

  it('splits a "## What changed" section into the changelog', () => {
    const text = formatDelegationResultFollowUp({
      id: 'd7',
      status: 'ok',
      summary: [
        'Delegation card rendered as an artifact.',
        '',
        '## What changed',
        '- src/renderer/agent/DelegationResultCard.tsx — new card',
        '- src/renderer/agent/AgentChatBubbles.tsx — routes follow-ups',
      ].join('\n'),
      toAgentId: 'frontend',
    })
    const [card] = parseDelegationResultCards(text)
    expect(card.summary).toBe('Delegation card rendered as an artifact.')
    expect(card.changelog).toEqual([
      'src/renderer/agent/DelegationResultCard.tsx — new card',
      'src/renderer/agent/AgentChatBubbles.tsx — routes follow-ups',
    ])
  })

  it('pulls path-like bullets out of a summary without a heading', () => {
    const text = formatDelegationResultFollowUp({
      id: 'd8',
      status: 'ok',
      summary: [
        'Two files touched.',
        '- src/shared/agentLoop.ts: cap raised',
        '- Reviewed the wave policy with no code change',
      ].join('\n'),
    })
    const [card] = parseDelegationResultCards(text)
    expect(card.changelog).toEqual(['src/shared/agentLoop.ts: cap raised'])
    expect(card.summary).toBe([
      'Two files touched.',
      '- Reviewed the wave policy with no code change',
    ].join('\n'))
  })

  it('returns one card per result in a batched follow-up', () => {
    const text = buildBatchedDelegationFollowUp([
      { id: 'a', status: 'ok', summary: 'Frontend done.', toAgentId: 'frontend' },
      { id: 'b', status: 'fail', summary: 'Backend failed.', toAgentId: 'backend' },
    ], { round: 1, maxRounds: 3 })
    const cards = parseDelegationResultCards(text)
    expect(cards).toHaveLength(2)
    expect(cards.map(card => card.agentId)).toEqual(['frontend', 'backend'])
    expect(cards.map(card => card.status)).toEqual(['ok', 'fail'])
    expect(cards[0].summary).toBe('Frontend done.')
    expect(cards[1].summary).toBe('Backend failed.')
  })

  it('drops the turbo concurrent-jobs block from the last card', () => {
    const text = buildBatchedDelegationFollowUp([
      { id: 'a', status: 'ok', summary: 'Done.', toAgentId: 'frontend' },
    ], { workStyle: 'turbo', orchestrationJobId: 'job-1' })
    const cards = parseDelegationResultCards(text)
    expect(cards).toHaveLength(1)
    expect(cards[0].summary).toBe('Done.')
    expect(cards[0].summary).not.toContain('Concurrent jobs')
    expect(cards[0].summary).not.toContain('belong to job')
  })

  it('strips turbo round scope from orchestrationRound', () => {
    const text = formatDelegationResultFollowUp({
      id: 'd9',
      status: 'ok',
      summary: 'Slice done.',
      toAgentId: 'qa',
    }, { round: 2, maxRounds: 0, workStyle: 'turbo' })
    const [card] = parseDelegationResultCards(text)
    expect(card.round).toBe('2/∞')
    expect(card.round).not.toContain('per job')
  })

  it('returns nothing for text that is not a delegation follow-up', () => {
    expect(parseDelegationResultCards('Please refactor the composer')).toEqual([])
    expect(parseDelegationResultCards('## Orchestration limit\nStop now.')).toEqual([])
  })
})
