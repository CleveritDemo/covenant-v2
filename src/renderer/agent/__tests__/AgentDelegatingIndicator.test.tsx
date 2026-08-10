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
