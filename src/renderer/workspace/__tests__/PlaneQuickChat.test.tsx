/**
 * @vitest-environment jsdom
 *
 * Con 2+ grupos, PlaneQuickChat resuelve títulos y se los pasa al indicador.
 * No aserto el DOM del hijo: mockeo AgentDelegatingIndicator y miro props.
 */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import type { OrchestrationAwaitingView } from '@shared/orchestrationAwaiting'
import type { AgentDelegatingIndicatorProps } from '../../agent/AgentDelegatingIndicator'
import { PlaneQuickChat } from '../PlaneQuickChat'

const indicator = vi.hoisted(() => ({
  last: null as AgentDelegatingIndicatorProps | null,
}))

vi.mock('@i18n/useT', () => ({
  useT: () => ({
    t: (key: string, vars?: Record<string, unknown>) => (
      vars ? `${key}:${Object.values(vars).join(',')}` : key
    ),
  }),
}))

vi.mock('../../agent/AgentChatBubbles', () => ({
  AgentChatBubbles: React.forwardRef(() => null),
}))

vi.mock('../../agent/AgentDelegatingIndicator', () => ({
  AgentDelegatingIndicator: (props: AgentDelegatingIndicatorProps) => {
    indicator.last = props
    return <div data-testid="delegating-indicator" />
  },
}))

afterEach(() => {
  indicator.last = null
  cleanup()
})

function makeAwaiting(): OrchestrationAwaitingView {
  const withPreview = {
    delegationId: 'd1',
    agentLabel: 'frontend',
    status: 'running' as const,
    jobId: 'job-1',
  }
  const withoutPreview = {
    delegationId: 'd2',
    agentLabel: 'backend',
    status: 'running' as const,
    jobId: 'job-2',
  }
  return {
    done: 0,
    total: 2,
    items: [withPreview, withoutPreview],
    groups: [
      {
        jobId: 'job-1',
        index: 1,
        title: 'Add login form',
        done: 0,
        total: 1,
        items: [withPreview],
      },
      {
        jobId: 'job-2',
        index: 2,
        done: 0,
        total: 1,
        items: [withoutPreview],
      },
    ],
  }
}

describe('PlaneQuickChat awaiting groups', () => {
  it('pasa al indicador dos grupos con títulos ya resueltos', () => {
    render(
      <PlaneQuickChat
        messages={[]}
        busy={false}
        awaitingDelegations
        orchestrationAwaiting={makeAwaiting()}
        activeAssistantId={null}
      />,
    )
    expect(indicator.last).not.toBeNull()
    expect(indicator.last?.groups).toEqual([
      {
        id: 'job-1',
        title: 'Add login form',
        items: [
          {
            id: 'd1',
            label: 'frontend',
            status: 'running',
            statusLabel: 'agentPane.awaitingStatusRunning',
          },
        ],
      },
      {
        id: 'job-2',
        title: 'agentPane.delegationGroup:2',
        items: [
          {
            id: 'd2',
            label: 'backend',
            status: 'running',
            statusLabel: 'agentPane.awaitingStatusRunning',
          },
        ],
      },
    ])
  })
})
