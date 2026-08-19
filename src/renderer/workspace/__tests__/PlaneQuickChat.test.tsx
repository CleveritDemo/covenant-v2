/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { OrchestrationAwaitingView } from '@shared/orchestrationAwaiting'
import { PlaneQuickChat } from '../PlaneQuickChat'

const translations: Record<string, string> = {
  'agentPane.delegatingTitle': 'Delegating…',
  'agentPane.delegatingSubtitle': 'Specialists are working on your request.',
  'agentPane.awaitingWaveSublabel': 'Wave in progress.',
  'agentPane.awaitingStatusDone': 'done',
  'agentPane.awaitingStatusDeferred': 'queued',
  'agentPane.awaitingStatusRunning': 'running',
  'agentPane.awaitingStopSpecialist': 'Stop this specialist',
}

vi.mock('@i18n/useT', () => ({
  useT: () => ({
    t: (key: string, params?: { done?: number; total?: number }) => {
      if (key === 'agentPane.awaitingWaveProgress' && params) {
        return `Waiting ${params.done}/${params.total}`
      }
      return translations[key] ?? key
    },
  }),
}))

vi.mock('../../agent/AgentChatBubbles', () => ({
  AgentChatBubbles: React.forwardRef(function AgentChatBubblesMock() {
    return null
  }),
}))

vi.mock('../../agent/Gravity', () => ({
  Gravity: () => <span data-testid="gravity" />,
}))

vi.mock('../../components/ui/Tooltip', () => ({
  Tooltip: ({
    content,
    children,
  }: {
    content: string
    children: React.ReactNode
  }) => <span data-tooltip={content}>{children}</span>,
}))

vi.mock('../../components/ui/Icon', () => ({
  Icon: () => <span data-testid="icon-stop" />,
}))

afterEach(cleanup)

const baseProps = {
  messages: [] as never[],
  busy: false,
  activeAssistantId: null as string | null,
}

function renderAwaiting(
  orchestrationAwaiting: OrchestrationAwaitingView | null,
  onAbortDelegation = vi.fn(),
) {
  return render(
    <PlaneQuickChat
      {...baseProps}
      awaitingDelegations
      orchestrationAwaiting={orchestrationAwaiting}
      onAbortDelegation={onAbortDelegation}
    />,
  )
}

function delegatingRoot(container: HTMLElement): HTMLElement {
  const root = container.querySelector('.plane-quick-chat__delegating')
  expect(root).not.toBeNull()
  return root as HTMLElement
}

describe('PlaneQuickChat awaiting delegations', () => {
  it('shows a single flat row without group headers', () => {
    const { container } = renderAwaiting({
      done: 0,
      total: 1,
      items: [
        {
          delegationId: 'd1',
          agentLabel: 'frontend',
          status: 'running',
        },
      ],
    })

    const root = delegatingRoot(container)
    expect(within(root).getByText('frontend')).toBeTruthy()
    expect(within(root).getByText('running')).toBeTruthy()
    expect(root.querySelector('.agent-delegating__list')?.children).toHaveLength(1)
    expect(root.querySelector('[class*="group"]')).toBeNull()
    expect(root.textContent).not.toMatch(/jobId|jobsMeta|humanTurnPreview/i)
  })

  it('renders three flat rows and reflects done/total in the wave label', () => {
    const { container } = renderAwaiting({
      done: 1,
      total: 3,
      items: [
        { delegationId: 'd1', agentLabel: 'frontend', status: 'done' },
        { delegationId: 'd2', agentLabel: 'backend', status: 'running' },
        { delegationId: 'd3', agentLabel: 'qa', status: 'deferred' },
      ],
    })

    const root = delegatingRoot(container)
    expect(within(root).getByText('Waiting 1/3')).toBeTruthy()
    expect(root.querySelectorAll('.agent-delegating__row')).toHaveLength(3)
    expect(within(root).getByText('frontend')).toBeTruthy()
    expect(within(root).getByText('backend')).toBeTruthy()
    expect(within(root).getByText('qa')).toBeTruthy()
  })

  it('shows translated status text for running, deferred and done rows', () => {
    const { container } = renderAwaiting({
      done: 1,
      total: 3,
      items: [
        { delegationId: 'd1', agentLabel: 'frontend', status: 'running' },
        { delegationId: 'd2', agentLabel: 'backend', status: 'deferred' },
        { delegationId: 'd3', agentLabel: 'qa', status: 'done' },
      ],
    })

    const root = delegatingRoot(container)
    expect(within(root).getByText('running')).toBeTruthy()
    expect(within(root).getByText('queued')).toBeTruthy()
    expect(within(root).getByText('done')).toBeTruthy()
  })

  it('exposes worktreeHint on the row tooltip only when present', () => {
    const withHint = renderAwaiting({
      done: 0,
      total: 1,
      items: [
        {
          delegationId: 'd1',
          agentLabel: 'frontend',
          status: 'running',
          worktreeHint: 'tab/dlg-id',
        },
      ],
    })
    const hintedRow = withHint.container.querySelector('.agent-delegating__row')
    const hintedItem = hintedRow?.querySelector('.agent-delegating__item')
    expect(hintedItem?.closest('[data-tooltip]')?.getAttribute('data-tooltip')).toBe('tab/dlg-id')

    withHint.unmount()

    const withoutHint = renderAwaiting({
      done: 0,
      total: 1,
      items: [
        {
          delegationId: 'd2',
          agentLabel: 'backend',
          status: 'running',
        },
      ],
    })
    const plainRow = withoutHint.container.querySelector('.agent-delegating__row')
    const plainItem = plainRow?.querySelector('.agent-delegating__item')
    expect(plainItem?.closest('[data-tooltip]')).toBeNull()
  })

  it('offers Stop only on the running row and calls onAbortDelegation with its id', () => {
    const onAbortDelegation = vi.fn()
    renderAwaiting(
      {
        done: 1,
        total: 2,
        items: [
          { delegationId: 'd-run', agentLabel: 'frontend', status: 'running' },
          { delegationId: 'd-done', agentLabel: 'backend', status: 'done' },
        ],
      },
      onAbortDelegation,
    )

    const stops = screen.getAllByRole('button', { name: 'Stop this specialist' })
    expect(stops).toHaveLength(1)
    fireEvent.click(stops[0]!)
    expect(onAbortDelegation).toHaveBeenCalledWith('d-run')
  })
})
