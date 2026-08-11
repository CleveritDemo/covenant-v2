import React from 'react'
import { useT } from '@i18n/useT'
import type { BrainstormLiveSummary } from './brainstormLiveState'
import { isBrainstormLive } from './brainstormViewClose'
import './PlaneBrainstormDock.css'

export interface PlaneBrainstormDockProps {
  live: BrainstormLiveSummary
  onOpen: () => void
  /** Detener el runner (sala viva) o descartarla del plano (ya terminada). */
  onStop: () => void
  onDiscard: () => void
}

/** Flyout anclado al botón de brainstorms: sala minimizada que sigue corriendo. */
export const PlaneBrainstormDock: React.FC<PlaneBrainstormDockProps> = ({
  live,
  onOpen,
  onStop,
  onDiscard,
}) => {
  const { t } = useT()
  const running = live.status === 'running'
  const alive = isBrainstormLive(live.status)

  return (
    <div className="plane-brainstorm-dock" role="dialog" aria-label={live.topic}>
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
      </span>
      <button
        type="button"
        className="plane-brainstorm-dock__action"
        onClick={onOpen}
      >
        {t('tabs.brainstormDockOpen')}
      </button>
      <button
        type="button"
        className="plane-brainstorm-dock__action"
        onClick={alive ? onStop : onDiscard}
      >
        {alive
          ? t('tabs.brainstormDockStop')
          : t('tabs.brainstormDockDiscard')}
      </button>
    </div>
  )
}
