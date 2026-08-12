import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useT } from '@i18n/useT'
import {
  canStartBrainstormTable,
  moveSeat,
  seatAgent,
  unseatAgent,
  BRAINSTORM_TABLE_MIN_SEATS,
} from '@shared/brainstormTable'
import { agentMonogram } from '@shared/tabContextAppearance'
import { Icon } from '../components/ui/Icon'
import { Button } from '../components/ui'
import { isReduceMotionActive } from '../reduceMotion'
import { hasPlaneAgentDrag, readPlaneAgentDragData } from './planeAgentDrag'
import './PlaneBrainstormTable.css'

/** Curva del aterrizaje: llega con un rebote corto, no con un frenazo. */
const SEAT_SPRING = 'cubic-bezier(.2,.9,.25,1.1)'
const SEAT_MS = 220

export interface PlaneBrainstormTableAgent {
  agentId: string
  name: string
  monogram?: string
}

export interface PlaneBrainstormTableProps {
  /** Catálogo del plano (los que se pueden sentar). */
  agents: readonly PlaneBrainstormTableAgent[]
  /** Ids sentados, en orden de habla. */
  seated: readonly string[]
  onSeatedChange: (next: string[]) => void
  onClose: () => void
  onContinue: () => void
}

/**
 * Mesa del plano: se arrastran agentes desde su columna y el orden en que se
 * sientan es el orden en que hablan. Sustituye al paso de invitados del modal.
 */
export const PlaneBrainstormTable: React.FC<PlaneBrainstormTableProps> = ({
  agents,
  seated,
  onSeatedChange,
  onClose,
  onContinue,
}) => {
  const { t } = useT()
  const tableRef = useRef<HTMLDivElement>(null)
  const [armed, setArmed] = useState(false)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  /** Rects previos de cada asiento: alimentan el FLIP del siguiente render. */
  const rectsRef = useRef<Map<string, DOMRect>>(new Map())

  const byId = useCallback(
    (agentId: string) => agents.find(agent => agent.agentId === agentId),
    [agents],
  )

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  /** FLIP: cada asiento viaja desde donde estaba hasta donde queda. */
  useLayoutEffect(() => {
    const table = tableRef.current
    if (!table) return
    const previous = rectsRef.current
    const next = new Map<string, DOMRect>()
    const reduced = isReduceMotionActive()
    table.querySelectorAll<HTMLElement>('[data-seat]').forEach(el => {
      const id = el.dataset.seat!
      const now = el.getBoundingClientRect()
      next.set(id, now)
      if (reduced) return
      const before = previous.get(id)
      if (!before) {
        el.animate(
          [{ transform: 'scale(.86)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }],
          { duration: SEAT_MS, easing: SEAT_SPRING },
        )
        return
      }
      const dx = before.left - now.left
      const dy = before.top - now.top
      if (!dx && !dy) return
      el.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }],
        { duration: SEAT_MS, easing: SEAT_SPRING },
      )
    })
    rectsRef.current = next
  }, [seated])

  /** Índice de inserción: la mitad izquierda de un asiento significa "antes". */
  const indexFromPoint = useCallback((clientX: number, clientY: number): number => {
    const table = tableRef.current
    if (!table) return seated.length
    const seats = [...table.querySelectorAll<HTMLElement>('[data-seat]')]
    for (let i = 0; i < seats.length; i += 1) {
      const box = seats[i]!.getBoundingClientRect()
      if (clientY < box.bottom && clientX < box.left + box.width / 2) return i
    }
    return seats.length
  }, [seated.length])

  const handleDragOver = useCallback((event: React.DragEvent): void => {
    if (!hasPlaneAgentDrag(event.dataTransfer)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    setArmed(true)
    setDropIndex(indexFromPoint(event.clientX, event.clientY))
  }, [indexFromPoint])

  const handleDragLeave = useCallback((event: React.DragEvent): void => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
    setArmed(false)
    setDropIndex(null)
  }, [])

  const handleDrop = useCallback((event: React.DragEvent): void => {
    if (!hasPlaneAgentDrag(event.dataTransfer)) return
    event.preventDefault()
    const index = dropIndex ?? indexFromPoint(event.clientX, event.clientY)
    setArmed(false)
    setDropIndex(null)
    const agentId = readPlaneAgentDragData(event.dataTransfer)
    if (!agentId || !byId(agentId)) return
    onSeatedChange(seatAgent(seated, agentId, index))
  }, [byId, dropIndex, indexFromPoint, onSeatedChange, seated])

  const handleSeatKeyDown = useCallback((
    event: React.KeyboardEvent,
    agentId: string,
  ): void => {
    // ⌘/Ctrl + flechas mueve el asiento; las flechas solas siguen siendo del foco.
    if (!event.metaKey && !event.ctrlKey) return
    const delta = event.key === 'ArrowUp' || event.key === 'ArrowLeft'
      ? -1
      : event.key === 'ArrowDown' || event.key === 'ArrowRight'
        ? 1
        : 0
    if (!delta) return
    event.preventDefault()
    onSeatedChange(moveSeat(seated, agentId, delta))
  }, [onSeatedChange, seated])

  const available = agents.filter(agent => !seated.includes(agent.agentId))
  const canStart = canStartBrainstormTable(seated)
  const missing = Math.max(0, BRAINSTORM_TABLE_MIN_SEATS - seated.length)

  return (
    <section className="plane-bs-table" aria-label={t('tabs.brainstormTableTitle')}>
      <header className="plane-bs-table__bar">
        <div className="plane-bs-table__traffic" role="group" aria-label={t('common.cancel')}>
          <button
            type="button"
            className="plane-bs-table__light plane-bs-table__light--close"
            aria-label={t('common.cancel')}
            onClick={onClose}
          />
          <span className="plane-bs-table__light plane-bs-table__light--min" aria-hidden="true" />
          <span className="plane-bs-table__light plane-bs-table__light--zoom" aria-hidden="true" />
        </div>
        <h2 className="plane-bs-table__title">{t('tabs.brainstormTableTitle')}</h2>
      </header>
      <div className="plane-bs-table__body">
      <p className="plane-bs-table__hint">{t('tabs.brainstormTableHint')}</p>

      <div
        ref={tableRef}
        className={[
          'plane-bs-table__seats',
          armed ? 'plane-bs-table__seats--armed' : '',
        ].filter(Boolean).join(' ')}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {seated.length === 0 ? (
          <p className="plane-bs-table__empty">{t('tabs.brainstormTableEmpty')}</p>
        ) : null}
        {seated.map((agentId, index) => {
          const agent = byId(agentId)
          const label = agent?.name ?? agentId
          return (
            <React.Fragment key={agentId}>
              {armed && dropIndex === index ? (
                <span className="plane-bs-table__gap" aria-hidden="true" />
              ) : null}
              <span
                className="plane-bs-table__seat"
                data-seat={agentId}
                tabIndex={0}
                role="listitem"
                aria-label={t('tabs.brainstormTableSeatAria', { n: index + 1, name: label })}
                onKeyDown={event => handleSeatKeyDown(event, agentId)}
              >
                <span className="plane-bs-table__n">{index + 1}</span>
                <span className="plane-bs-table__mono">
                  {(agent?.monogram?.trim() || agentMonogram(label)).toUpperCase()}
                </span>
                <span className="plane-bs-table__name">{label}</span>
                <button
                  type="button"
                  className="plane-bs-table__unseat"
                  aria-label={t('tabs.brainstormTableUnseat', { name: label })}
                  onClick={() => onSeatedChange(unseatAgent(seated, agentId))}
                >
                  <Icon name="close" size={10} />
                </button>
              </span>
            </React.Fragment>
          )
        })}
        {armed && dropIndex !== null && dropIndex >= seated.length ? (
          <span className="plane-bs-table__gap" aria-hidden="true" />
        ) : null}
      </div>

      {available.length > 0 ? (
        <div className="plane-bs-table__available">
          <span className="plane-bs-table__available-label">
            {t('tabs.brainstormTableAvailable')}
          </span>
          {available.map(agent => (
            <button
              key={agent.agentId}
              type="button"
              className="plane-bs-table__chip"
              onClick={() => onSeatedChange(seatAgent(seated, agent.agentId))}
            >
              {agent.name}
            </button>
          ))}
        </div>
      ) : null}

      <footer className="plane-bs-table__foot">
        <span className="plane-bs-table__step">{t('tabs.ceremonySeatsBadge')}</span>
        <span
          className={[
            'plane-bs-table__counter',
            canStart ? 'plane-bs-table__counter--ready' : '',
          ].filter(Boolean).join(' ')}
        >
          {canStart
            ? t('tabs.brainstormTableSeatedCount', { n: seated.length })
            : t('tabs.brainstormTableMissing', { n: missing })}
        </span>
        <Button variant="primary" size="sm" disabled={!canStart} onClick={onContinue}>
          {t('tabs.brainstormTableContinue')}
        </Button>
      </footer>
      </div>
    </section>
  )
}
