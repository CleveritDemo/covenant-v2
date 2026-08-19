/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { AgentDelegatingIndicator } from '../AgentDelegatingIndicator'

vi.mock('../../components/ui/Tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('../../components/ui/Icon', () => ({
  Icon: () => <span data-testid="icon-stop" />,
}))

describe('AgentDelegatingIndicator per-row Stop', () => {
  it('shows PlaneBusyDot on all rows with the right variant', () => {
    const { container } = render(
      <AgentDelegatingIndicator
        label="Waiting 0/2"
        items={[
          {
            id: 'd1',
            label: 'frontend',
            status: 'running',
            statusLabel: 'running',
          },
          {
            id: 'd2',
            label: 'backend',
            status: 'deferred',
            statusLabel: 'queued',
          },
          {
            id: 'd3',
            label: 'qa',
            status: 'done',
            statusLabel: 'done',
          },
        ]}
      />,
    )
    const runningRow = container.querySelector('.agent-delegating__item--running')
    expect(runningRow?.querySelector('.plane-busy-dot--delegating')).not.toBeNull()

    const deferredRow = container.querySelector('.agent-delegating__item--deferred')
    expect(deferredRow?.querySelector('.plane-busy-dot--deferred')).not.toBeNull()

    const doneRow = container.querySelector('.agent-delegating__item--done')
    expect(doneRow?.querySelector('.plane-busy-dot--done')).not.toBeNull()
  })

  it('calls onStopItem only for the running row', () => {
    const onStopItem = vi.fn()
    render(
      <AgentDelegatingIndicator
        label="Waiting 0/2"
        stopItemLabel="Stop this specialist"
        onStopItem={onStopItem}
        items={[
          {
            id: 'd1',
            label: 'frontend',
            status: 'running',
            statusLabel: 'running',
          },
          {
            id: 'd2',
            label: 'backend',
            status: 'done',
            statusLabel: 'done',
          },
        ]}
      />,
    )
    const stops = screen.getAllByRole('button', { name: 'Stop this specialist' })
    expect(stops).toHaveLength(1)
    fireEvent.click(stops[0]!)
    expect(onStopItem).toHaveBeenCalledWith('d1')
  })
})

describe('AgentDelegatingIndicator groups', () => {
  it('two groups paint two headers with their rows inside', () => {
    const { container } = render(
      <AgentDelegatingIndicator
        label="Waiting 1/3"
        items={[
          { id: 'd1', label: 'frontend', status: 'running', statusLabel: 'running' },
          { id: 'd2', label: 'backend', status: 'deferred', statusLabel: 'queued' },
          { id: 'd3', label: 'qa', status: 'done', statusLabel: 'done' },
        ]}
        groups={[
          {
            id: 'job-1',
            title: 'Add login',
            items: [
              { id: 'd1', label: 'frontend', status: 'running', statusLabel: 'running' },
            ],
          },
          {
            id: 'job-2',
            title: 'Fix tests',
            items: [
              { id: 'd2', label: 'backend', status: 'deferred', statusLabel: 'queued' },
              { id: 'd3', label: 'qa', status: 'done', statusLabel: 'done' },
            ],
          },
        ]}
      />,
    )
    const groups = container.querySelectorAll('.agent-delegating__group')
    expect(groups).toHaveLength(2)
    expect(groups[0]?.querySelector('.agent-delegating__group-title')?.textContent).toBe('Add login')
    expect(groups[0]?.querySelector('.agent-delegating__agent')?.textContent).toBe('frontend')
    expect(groups[1]?.querySelector('.agent-delegating__group-title')?.textContent).toBe('Fix tests')
    expect(
      [...groups[1]!.querySelectorAll('.agent-delegating__agent')].map(node => node.textContent),
    ).toEqual(['backend', 'qa'])
  })

  it('a single group paints no header', () => {
    const { container } = render(
      <AgentDelegatingIndicator
        label="Waiting 0/1"
        items={[
          { id: 'd1', label: 'frontend', status: 'running', statusLabel: 'running' },
        ]}
        groups={[
          {
            id: 'job-1',
            title: 'Add login',
            items: [
              { id: 'd1', label: 'frontend', status: 'running', statusLabel: 'running' },
            ],
          },
        ]}
      />,
    )
    expect(container.querySelector('.agent-delegating__group')).toBeNull()
    expect(container.querySelector('.agent-delegating__group-title')).toBeNull()
    expect(container.querySelectorAll('.agent-delegating__row')).toHaveLength(1)
    expect(container.querySelector('.agent-delegating__agent')?.textContent).toBe('frontend')
  })
})
