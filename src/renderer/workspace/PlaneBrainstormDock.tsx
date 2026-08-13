import React from 'react'
import { useT } from '@i18n/useT'
import type { BrainstormLiveSummary } from './brainstormLiveState'
import { isBrainstormLive } from './brainstormViewClose'
import './PlaneBrainstormDock.css'

export interface PlaneBrainstormDockProps {
  /**
   * Salas del workspace, vivas o ya terminadas y sin soltar. Son varias: se
   * pueden convocar en paralelo y cada una corre su propio runner en main.
   */
  rooms: readonly BrainstormLiveSummary[]
  onOpen: (roomId: string) => void
  /** Detener el runner de una sala viva. */
  onStop: (roomId: string) => void
  /** Soltar del plano una sala ya terminada (su acta queda en disco). */
  onDiscard: (roomId: string) => void
  /** Convocar otra sala sin cerrar el flyout. */
  onCreate?: () => void
}

/**
 * Flyout anclado al botón de la barra: qué salas hay corriendo mientras no las
 * mires. Es una lista porque las salas van en paralelo; el botón lleva el
 * número y este panel dice de cada una en qué ronda va y quién habla.
 *
 * Una sala terminada sale de aquí en cuanto se suelta: su cierre se busca en
 * «Salas guardadas», que es donde queda el acta.
 */
export const PlaneBrainstormDock: React.FC<PlaneBrainstormDockProps> = ({
  rooms,
  onOpen,
  onStop,
  onDiscard,
  onCreate,
}) => {
  const { t } = useT()

  return (
    <div className="plane-brainstorm-dock" role="dialog" aria-label={t('tabs.brainstormRoomsRunning')}>
      <div className="plane-brainstorm-dock__head">
        <span className="plane-brainstorm-dock__title">
          {t('tabs.brainstormRoomsRunning')}
        </span>
        <span className="plane-brainstorm-dock__count">{rooms.length}</span>
      </div>

      {rooms.length === 0 ? (
        <p className="plane-brainstorm-dock__empty">
          {t('tabs.brainstormRoomsRunningNone')}
        </p>
      ) : null}

      {rooms.map(live => {
        const running = live.status === 'running'
        const alive = isBrainstormLive(live.status)
        return (
          <div
            key={live.roomId}
            className={[
              'plane-brainstorm-dock__row',
              alive ? '' : 'plane-brainstorm-dock__row--done',
            ].filter(Boolean).join(' ')}
          >
            <span
              className={[
                'plane-brainstorm-dock__dot',
                running ? 'plane-brainstorm-dock__dot--pulse' : '',
              ].filter(Boolean).join(' ')}
              aria-hidden
            />
            <span className="plane-brainstorm-dock__body">
              <span className="plane-brainstorm-dock__topic">{live.topic}</span>
              <span className="plane-brainstorm-dock__meta">
                {t('tabs.brainstormRoundLabel')}
                {' '}
                {t('tabs.brainstormRoundValue', {
                  current: live.round,
                  max: live.maxRounds,
                })}
                {' · '}
                {t('tabs.brainstormTurnProgress', {
                  current: live.turnsDone,
                  total: live.totalTurns,
                })}
                {' · '}
                {live.speakerName
                  ? t('tabs.brainstormDockSpeaking', { name: live.speakerName })
                  : t('tabs.brainstormDockLive')}
              </span>
              <span className="plane-brainstorm-dock__actions">
                <button
                  type="button"
                  className="plane-brainstorm-dock__action plane-brainstorm-dock__action--go"
                  onClick={() => onOpen(live.roomId)}
                >
                  {t('tabs.brainstormDockOpen')}
                </button>
                <button
                  type="button"
                  className="plane-brainstorm-dock__action"
                  onClick={() => (alive ? onStop(live.roomId) : onDiscard(live.roomId))}
                >
                  {alive
                    ? t('tabs.brainstormDockStop')
                    : t('tabs.brainstormDockDiscard')}
                </button>
              </span>
            </span>
          </div>
        )
      })}

      <div className="plane-brainstorm-dock__foot">
        <span className="plane-brainstorm-dock__hint">
          {t('tabs.brainstormDockFinishedHint')}
        </span>
        {onCreate ? (
          <button
            type="button"
            className="plane-brainstorm-dock__action"
            onClick={onCreate}
          >
            {t('tabs.brainstormDockNew')}
          </button>
        ) : null}
      </div>
    </div>
  )
}
