import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useT } from '@i18n/useT'
import { PlaneBusyDot } from './PlaneBusyDot'
import './PlaneAgentThreadNodes.css'

export interface PlaneAgentThreadNode {
  id: string
  title: string
  running: boolean
  active: boolean
  /** Petición del usuario por hilo busy (card mini / selector). */
  activity?: string
}

export interface PlaneAgentThreadNodesProps {
  threads: PlaneAgentThreadNode[]
  onOpenThread: (threadId: string) => void
}

const THREAD_ENTER_MS = 300
const THREAD_HEIGHT_MS = 340

/** Hilos activos del agente: dot + petición del usuario bajo la card mini. */
export const PlaneAgentThreadNodes: React.FC<PlaneAgentThreadNodesProps> = ({
  threads,
  onOpenThread,
}) => {
  const { t } = useT()
  const runningThreads = threads.filter(thread => thread.running)
  const innerRef = useRef<HTMLUListElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const seenIdsRef = useRef<Set<string>>(new Set())
  const prevCountRef = useRef(0)
  const [enteringIds, setEnteringIds] = useState<Set<string>>(() => new Set())
  const [wrapHeight, setWrapHeight] = useState<number | undefined>(undefined)

  useEffect(() => {
    const currentIds = new Set(runningThreads.map(thread => thread.id))
    const newIds = runningThreads
      .filter(thread => !seenIdsRef.current.has(thread.id))
      .map(thread => thread.id)

    if (newIds.length > 0) {
      setEnteringIds(prev => {
        const next = new Set(prev)
        for (const id of newIds) next.add(id)
        return next
      })
      const timer = window.setTimeout(() => {
        setEnteringIds(prev => {
          const next = new Set(prev)
          for (const id of newIds) next.delete(id)
          return next
        })
      }, THREAD_ENTER_MS)
      seenIdsRef.current = currentIds
      return () => window.clearTimeout(timer)
    }

    seenIdsRef.current = currentIds
    return undefined
  }, [runningThreads])

  useLayoutEffect(() => {
    const inner = innerRef.current
    if (!inner) return

    const applyHeight = (next: number): void => {
      if (next <= 0) {
        setWrapHeight(0)
        return
      }
      setWrapHeight(next)
    }

    const measure = (): void => {
      const next = Math.ceil(inner.getBoundingClientRect().height)
      applyHeight(next)
    }

    if (prevCountRef.current === 0 && runningThreads.length > 0) {
      setWrapHeight(0)
      requestAnimationFrame(() => {
        requestAnimationFrame(measure)
      })
    } else {
      measure()
    }

    prevCountRef.current = runningThreads.length

    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(inner)
    return () => observer.disconnect()
  }, [runningThreads])

  if (runningThreads.length === 0) return null

  return (
    <div
      ref={wrapRef}
      className="plane-agent-thread-nodes-wrap"
      style={{
        height: wrapHeight,
        ['--plane-thread-height-ms' as string]: `${THREAD_HEIGHT_MS}ms`,
      }}
    >
      <ul
        ref={innerRef}
        className="plane-agent-thread-nodes plane-agent-thread-nodes--running"
        role="list"
      >
        {runningThreads.map(thread => {
          const label = thread.activity?.trim() || t('agentPane.awaitingStatusRunning')
          return (
            <li
              key={thread.id}
              className={[
                'plane-agent-thread-nodes__item',
                enteringIds.has(thread.id) ? 'plane-agent-thread-nodes__item--enter' : '',
              ].filter(Boolean).join(' ')}
              role="listitem"
            >
              <button
                type="button"
                className="plane-agent-thread-nodes__row"
                aria-label={[thread.title.trim() || t('tabs.planeAgentThreadUntitled'), label]
                  .filter(Boolean)
                  .join(' · ')}
                onClick={event => {
                  event.stopPropagation()
                  onOpenThread(thread.id)
                }}
              >
                <PlaneBusyDot size="sm" />
                <span className="plane-agent-thread-nodes__row-text">{label}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
