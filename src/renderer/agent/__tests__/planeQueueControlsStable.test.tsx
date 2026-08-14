/**
 * @vitest-environment jsdom
 */
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { cleanup, act, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AgentPlaneQueueControls } from '../AgentPane'

type ReadyHandler = (controls: AgentPlaneQueueControls | null) => void

function StableQueueControlsProbe({
  onReady,
}: {
  onReady: ReadyHandler
}) {
  const [queuedIds, setQueuedIds] = useState<string[]>(['q1'])

  const removeQueuedTurn = useCallback((id: string): void => {
    setQueuedIds(previous => previous.filter(item => item !== id))
  }, [])

  const updateQueuedTurn = useCallback((_id: string, _text: string): void => {}, [])
  const handleMergeQueuedTurns = useCallback((): void => {}, [])
  const cancelDelegationsFrom = useCallback((_fromPaneId: string): void => {}, [])
  const cancelDelegation = useCallback((_delegationId: string): void => {}, [])

  const removeQueuedTurnRef = useRef(removeQueuedTurn)
  removeQueuedTurnRef.current = removeQueuedTurn
  const updateQueuedTurnRef = useRef(updateQueuedTurn)
  updateQueuedTurnRef.current = updateQueuedTurn
  const mergeQueuedTurnsRef = useRef(handleMergeQueuedTurns)
  mergeQueuedTurnsRef.current = handleMergeQueuedTurns
  const cancelDelegationsFromRef = useRef(cancelDelegationsFrom)
  cancelDelegationsFromRef.current = cancelDelegationsFrom
  const cancelDelegationRef = useRef(cancelDelegation)
  cancelDelegationRef.current = cancelDelegation

  useEffect(() => {
    onReady({
      remove: id => removeQueuedTurnRef.current(id),
      update: (id, text) => updateQueuedTurnRef.current(id, text),
      merge: () => mergeQueuedTurnsRef.current(),
      cancelDelegationsFrom: fromPaneId => cancelDelegationsFromRef.current(fromPaneId),
      cancelDelegation: delegationId => cancelDelegationRef.current(delegationId),
    })
    return () => onReady(null)
  }, [onReady])

  return <div data-testid="queue-count">{queuedIds.length}</div>
}

afterEach(() => {
  cleanup()
})

describe('plane queue controls registration', () => {
  it('keeps remove callable after queue mutation without re-registering controls', async () => {
    const ready = vi.fn<ReadyHandler>()
    let controls: AgentPlaneQueueControls | null = null
    ready.mockImplementation(next => {
      controls = next
    })

    const { rerender, getByTestId } = render(
      <StableQueueControlsProbe onReady={ready} />,
    )

    expect(ready).toHaveBeenCalledTimes(1)
    expect(controls).not.toBeNull()
    const registeredRemove = controls!.remove

    rerender(<StableQueueControlsProbe onReady={ready} />)
    expect(ready).toHaveBeenCalledTimes(1)
    expect(getByTestId('queue-count').textContent).toBe('1')

    await act(async () => {
      registeredRemove('q1')
    })
    expect(getByTestId('queue-count').textContent).toBe('0')
  })
})
