import { describe, expect, it } from 'vitest'
import {
  buildBatchedDelegationFollowUp,
  formatDelegationResultFollowUp,
  type DelegateResult,
} from '../agentOrchestration'
import type { ProjectAgentDefinition } from '../projectAgentCatalog'
import { resolveQueuedTurnPreview, type QueuedTurnDelegationLike } from '../queuedTurnPreview'

function stubResult(
  partial: Partial<DelegateResult> & Pick<DelegateResult, 'id' | 'status' | 'summary'>,
): DelegateResult {
  return {
    fromPaneId: 'p-orq',
    orchestrationJobId: 'job-1',
    ...partial,
  }
}

const catalog: ProjectAgentDefinition[] = [
  {
    id: 'frontend',
    name: 'David',
    role: 'frontend engineer',
    provider: 'cursor',
    permissionMode: 'auto',
  },
  {
    id: 'qa',
    name: 'Vanesa',
    role: 'qa',
    provider: 'cursor',
    permissionMode: 'auto',
  },
]

describe('resolveQueuedTurnPreview', () => {
  it('human — sin follow-up ni delegation', () => {
    expect(resolveQueuedTurnPreview({ text: 'Fix login' })).toEqual({ kind: 'human' })
  })

  it('delegation_result ok con nombre de catálogo y resumen corto', () => {
    const text = formatDelegationResultFollowUp(stubResult({
      id: 'd1',
      status: 'ok',
      summary: 'Login form validated on submit.',
      toAgentId: 'frontend',
    }))
    expect(resolveQueuedTurnPreview({ text, orchestrationFollowUp: true }, catalog)).toEqual({
      kind: 'delegation_result',
      agentLabel: 'David · frontend engineer',
      status: 'ok',
      summarySnippet: 'Login form validated on submit.',
    })
  })

  it('delegation_result fail conserva status', () => {
    const text = formatDelegationResultFollowUp(stubResult({
      id: 'd2',
      status: 'fail',
      summary: 'Build broke.',
      toAgentId: 'qa',
    }))
    expect(resolveQueuedTurnPreview({ text, orchestrationFollowUp: true }, catalog)).toMatchObject({
      kind: 'delegation_result',
      agentLabel: 'Vanesa · qa',
      status: 'fail',
      summarySnippet: 'Build broke.',
    })
  })

  it('delegation_results_batch con dos cards', () => {
    const text = buildBatchedDelegationFollowUp([
      stubResult({
        id: 'd1',
        status: 'ok',
        summary: 'Frontend done.',
        toAgentId: 'frontend',
      }),
      stubResult({
        id: 'd2',
        status: 'fail',
        summary: 'QA blocked.',
        toAgentId: 'qa',
      }),
    ])
    expect(resolveQueuedTurnPreview({ text, orchestrationFollowUp: true }, catalog)).toEqual({
      kind: 'delegation_results_batch',
      items: [
        {
          agentLabel: 'David · frontend engineer',
          status: 'ok',
          summarySnippet: 'Frontend done.',
        },
        {
          agentLabel: 'Vanesa · qa',
          status: 'fail',
          summarySnippet: 'QA blocked.',
        },
      ],
    })
  })

  it('delegation_task usa slug cuando el agent id no está en catálogo', () => {
    const delegation = {
      id: 'dlg-1',
      fromPaneId: 'orch',
      toAgentId: 'frontend-2',
      orchestrationJobId: 'job-deleg-1',
    } satisfies QueuedTurnDelegationLike
    expect(resolveQueuedTurnPreview({
      text: 'Implement UI',
      delegation,
    }, catalog)).toEqual({
      kind: 'delegation_task',
      agentLabel: 'frontend-2',
    })
  })

  it('fallback human cuando follow-up no parsea cards', () => {
    const text = '## Delegation result\nSome raw host text without id/status lines'
    const preview = resolveQueuedTurnPreview({ text, orchestrationFollowUp: true }, catalog)
    expect(preview.kind).toBe('human')
    if (preview.kind === 'human') {
      expect(preview.fallbackText).toBe('Some raw host text without id/status lines')
      expect(preview.fallbackText).not.toContain('##')
    }
  })

  it('human con brief trae fallbackText con el objetivo', () => {
    const text = [
      '## Delegation brief',
      'from: tech-lead-copy',
      'to: frontend',
      '',
      'Añade un flag offline a las guardas',
    ].join('\n')
    const preview = resolveQueuedTurnPreview({ text })
    expect(preview).toEqual({
      kind: 'human',
      fallbackText: 'Añade un flag offline a las guardas',
    })
    expect(preview.fallbackText).not.toContain('##')
  })

  it('human normal sigue sin fallbackText', () => {
    expect(resolveQueuedTurnPreview({ text: 'Fix login' })).toEqual({ kind: 'human' })
  })
})
