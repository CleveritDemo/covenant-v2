import React from 'react'
import {
  isBrainstormHumanMessage,
  type BrainstormMessage,
  type BrainstormStatus,
} from '@shared/brainstormRoom'
import { brainstormTurnSnippet } from '@shared/brainstormListing'
import { useT } from '@i18n/useT'
import './BrainstormTurnsTimeline.css'

export interface BrainstormTurnsTimelineProps {
  maxRounds: number
  currentRound: number
  status: BrainstormStatus
  messages: readonly BrainstormMessage[]
  speakingName: string | null
  onJumpToTurn: (messageIndex: number) => void
}

/**
 * Riel de turnos de la sala: una ronda, sus intervenciones, clic al acta.
 * Bloque BEM propio — no reutiliza `.brainstorm-rounds` del slider de alta.
 */
export const BrainstormTurnsTimeline: React.FC<BrainstormTurnsTimelineProps> = ({
  maxRounds,
  currentRound,
  status,
  messages,
  speakingName,
  onJumpToTurn,
}) => {
  const { t } = useT()
  const speaker = speakingName?.trim() || null

  return (
    <ol className="brainstorm-turn-timeline">
      {Array.from({ length: maxRounds }, (_, roundIndex) => {
        const turns: { message: BrainstormMessage; index: number }[] = []
        messages.forEach((message, index) => {
          if (message.round !== roundIndex) return
          if (isBrainstormHumanMessage(message)) return
          turns.push({ message, index })
        })
        const isNow = roundIndex === currentRound && status === 'running'
        const isDone = roundIndex < currentRound
        const showSpeaking = roundIndex === currentRound && speaker !== null
        return (
          <li
            key={roundIndex}
            className={[
              'brainstorm-turn-timeline__round',
              isDone ? 'brainstorm-turn-timeline__round--done' : '',
              isNow ? 'brainstorm-turn-timeline__round--now' : '',
            ].filter(Boolean).join(' ')}
          >
            <div className="brainstorm-turn-timeline__head">
              <i className="brainstorm-turn-timeline__pip" aria-hidden />
              <span className="brainstorm-turn-timeline__num">{roundIndex + 1}</span>
            </div>
            {turns.length > 0 ? (
              <ul className="brainstorm-turn-timeline__turns">
                {turns.map(({ message, index }) => {
                  const snippet = brainstormTurnSnippet(message.text)
                  return (
                    <li key={index}>
                      <button
                        type="button"
                        className="brainstorm-turn-timeline__turn"
                        aria-label={t('tabs.brainstormTurnTimelineJump', {
                          name: message.agentName,
                        })}
                        onClick={() => onJumpToTurn(index)}
                      >
                        <span className="brainstorm-turn-timeline__name">
                          {message.agentName}
                        </span>
                        {snippet ? (
                          <span className="brainstorm-turn-timeline__snippet">
                            {snippet}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : null}
            {showSpeaking ? (
              <p className="brainstorm-turn-timeline__speaking" role="status">
                <span className="brainstorm-turn-timeline__name">{speaker}</span>
                <span className="brainstorm-turn-timeline__snippet">
                  {t('tabs.brainstormTurnTimelineSpeaking')}
                </span>
              </p>
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}
