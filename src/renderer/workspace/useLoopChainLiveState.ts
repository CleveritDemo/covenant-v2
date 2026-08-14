import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { LoopChainEvent, LoopChainRunStateSnapshot } from '@shared/loopChainEvents'
import type { PlaneLoopChain, PlaneLoopChainStatus } from '@shared/planeLoopChain'

export interface LoopChainLiveSlice {
  status: LoopChainRunStateSnapshot['status']
  cycle: number
  stepIndex: number
  agentId: string
  lastText: string
}

function sliceFromSnapshot(snapshot: LoopChainRunStateSnapshot): LoopChainLiveSlice {
  return {
    status: snapshot.status,
    cycle: snapshot.cycle,
    stepIndex: snapshot.stepIndex,
    agentId: snapshot.activeAgentId ?? '',
    lastText: '',
  }
}

function persistedStatusFromRunStatus(
  status: LoopChainRunStateSnapshot['status'],
): PlaneLoopChainStatus | null {
  if (status === 'running') return 'running'
  if (status === 'waiting') return 'waiting'
  if (status === 'stopped') return 'stopped'
  return null
}

function patchChainStatus(
  chains: PlaneLoopChain[],
  chainId: string,
  status: PlaneLoopChainStatus,
  cursor?: number,
): PlaneLoopChain[] {
  return chains.map(chain => {
    if (chain.id !== chainId) return chain
    return {
      ...chain,
      status,
      ...(cursor !== undefined ? { cursor } : {}),
    }
  })
}

export function useLoopChainLiveState(
  chains: readonly PlaneLoopChain[],
  onChainsChange: (chains: PlaneLoopChain[]) => void,
): {
  liveByChainId: Readonly<Record<string, LoopChainLiveSlice>>
  liveCount: number
  livePulse: boolean
} {
  const [liveByChainId, setLiveByChainId] = useState<Record<string, LoopChainLiveSlice>>({})
  const chainsRef = useRef(chains)
  chainsRef.current = chains

  const syncPersistedStatus = useCallback((
    chainId: string,
    status: PlaneLoopChainStatus,
    cursor?: number,
  ) => {
    const current = chainsRef.current
    const chain = current.find(item => item.id === chainId)
    if (!chain) return
    const nextCursor = cursor ?? chain.cursor
    if (chain.status === status && chain.cursor === nextCursor) return
    onChainsChange(patchChainStatus([...current], chainId, status, nextCursor))
  }, [onChainsChange])

  const applyEvent = useCallback((chainId: string, event: LoopChainEvent) => {
    switch (event.type) {
      case 'run_start':
        setLiveByChainId(prev => ({
          ...prev,
          [chainId]: {
            status: 'running',
            cycle: 0,
            stepIndex: 0,
            agentId: '',
            lastText: '',
          },
        }))
        syncPersistedStatus(chainId, 'running', 0)
        return
      case 'step_start':
        setLiveByChainId(prev => ({
          ...prev,
          [chainId]: {
            status: 'running',
            cycle: event.cycle,
            stepIndex: event.stepIndex,
            agentId: event.agentId,
            lastText: '',
          },
        }))
        syncPersistedStatus(chainId, 'running', event.stepIndex)
        return
      case 'step_delta':
        setLiveByChainId(prev => {
          const current = prev[chainId]
          return {
            ...prev,
            [chainId]: {
              status: 'running',
              cycle: event.cycle,
              stepIndex: event.stepIndex,
              agentId: event.agentId,
              lastText: `${current?.lastText ?? ''}${event.text}`,
            },
          }
        })
        return
      case 'step_final':
        setLiveByChainId(prev => ({
          ...prev,
          [chainId]: {
            status: 'running',
            cycle: event.cycle,
            stepIndex: event.stepIndex,
            agentId: event.agentId,
            lastText: event.text,
          },
        }))
        return
      case 'cycle_end':
        setLiveByChainId(prev => ({
          ...prev,
          [chainId]: {
            ...(prev[chainId] ?? {
              cycle: event.cycle,
              stepIndex: 0,
              agentId: '',
              lastText: '',
            }),
            status: 'waiting',
            cycle: event.cycle,
            stepIndex: 0,
            agentId: '',
          },
        }))
        syncPersistedStatus(chainId, 'waiting', 0)
        return
      case 'run_end':
        setLiveByChainId(prev => {
          const next = { ...prev }
          delete next[chainId]
          return next
        })
        syncPersistedStatus(chainId, 'stopped', 0)
        return
      default:
        return
    }
  }, [syncPersistedStatus])

  const chainIdsKey = useMemo(
    () => chains.map(chain => chain.id).join('\0'),
    [chains],
  )

  useEffect(() => {
    const unsubs: Array<() => void> = []

    for (const chain of chains) {
      void window.api.getLoopChainState(chain.id).then(snapshot => {
        if (!snapshot) return
        const persisted = persistedStatusFromRunStatus(snapshot.status)
        if (persisted && persisted !== chain.status) {
          syncPersistedStatus(chain.id, persisted, snapshot.stepIndex)
        }
        if (snapshot.status === 'running' || snapshot.status === 'waiting') {
          setLiveByChainId(prev => ({
            ...prev,
            [chain.id]: sliceFromSnapshot(snapshot),
          }))
        }
      })

      unsubs.push(window.api.onLoopChainEvent(chain.id, event => {
        applyEvent(chain.id, event)
      }))
    }

    return () => {
      for (const unsub of unsubs) unsub()
    }
  }, [applyEvent, chainIdsKey, chains, syncPersistedStatus])

  const liveCount = useMemo(
    () => Object.values(liveByChainId).filter(
      slice => slice.status === 'running' || slice.status === 'waiting',
    ).length,
    [liveByChainId],
  )

  const livePulse = useMemo(
    () => Object.values(liveByChainId).some(slice => slice.status === 'running'),
    [liveByChainId],
  )

  return { liveByChainId, liveCount, livePulse }
}
