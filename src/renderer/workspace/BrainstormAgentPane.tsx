import React, { useEffect } from 'react'
import { paletteColorForSeed } from '@shared/tabContextAppearance'
import { PANE_WINDOW_VIEWPORT_RATIO } from '@shared/paneWindows'
import { useT } from '@i18n/useT'
import { Icon } from '../components/ui/Icon'
import { Tooltip } from '../components/ui/Tooltip'
import { AiMarkdown } from '../components/AiMarkdown'
import { ChatBubble } from '../components/ai/ChatBubble'

export interface BrainstormAgentPaneTurn {
  round: number
  /** Índice del turno en la sala entera, 1-based: sitúa la intervención. */
  turn: number
  text: string
  live?: boolean
}

export interface BrainstormAgentPaneProps {
  agentId: string
  name: string
  role?: string
  turns: readonly BrainstormAgentPaneTurn[]
  /** Turnos de la sala completa: el pane dice cuántos de esos son suyos. */
  roomTurns: number
  speaking?: boolean
  onClose: () => void
  /** Composer: escribe en la sala, dirigido a este agente. */
  composer?: React.ReactNode
}

/**
 * Un asiento a pantalla: solo sus turnos, al 0.7 del plano — la misma
 * proporción y el mismo gesto que abrir un agente en el plano de codificación.
 *
 * Filtra lo que lees, no lo que la sala oye: escribir desde aquí publica en la
 * sala dirigido a este agente, como la fila de chips del composer. Una vía
 * privada dejaría el acta sin parte de lo que movió las respuestas.
 */
export const BrainstormAgentPane: React.FC<BrainstormAgentPaneProps> = ({
  agentId,
  name,
  role,
  turns,
  roomTurns,
  speaking = false,
  onClose,
  composer,
}) => {
  const { t } = useT()

  // Escape cierra el pane, no la sala: es la capa de encima.
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      if (document.querySelector('.terminal-modal-root')) return
      event.preventDefault()
      event.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  const size = `${Math.round(PANE_WINDOW_VIEWPORT_RATIO * 100)}%`

  return (
    <>
      <div className="brainstorm-pane__scrim" onClick={onClose} aria-hidden />
      <div
        className="brainstorm-pane"
        role="dialog"
        aria-label={t('tabs.brainstormPaneTitle', { name })}
        style={{
          width: size,
          height: size,
          '--brainstorm-seat-color': paletteColorForSeed(agentId),
        } as React.CSSProperties}
      >
        <header className="brainstorm-pane__head">
          {/*
            La identidad se agrupa para que todo lo que venga después caiga a la
            derecha: `Tooltip` envuelve a su hijo en un span, así que un
            `margin-left:auto` en el botón no llega al elemento flex.
          */}
          <span className="brainstorm-pane__id">
            <span className="brainstorm-pane__name">{name}</span>
            {role ? <span className="brainstorm-pane__role">{role}</span> : null}
            {speaking ? (
              <span className="brainstorm-overlay__chip brainstorm-overlay__chip--live">
                <i className="brainstorm-overlay__chip-dot" aria-hidden />
                {t('tabs.brainstormSeatSpeaking')}
              </span>
            ) : null}
          </span>
          <Tooltip content={t('tabs.brainstormPaneClose')}>
            <button
              type="button"
              className="brainstorm-overlay__icon brainstorm-pane__close"
              aria-label={t('tabs.brainstormPaneClose')}
              onClick={onClose}
            >
              <Icon name="close" size={12} />
            </button>
          </Tooltip>
        </header>

        <div className="brainstorm-pane__body">
          <p className="brainstorm-pane__scope">
            {t('tabs.brainstormPaneScope', {
              own: String(turns.length),
              total: String(roomTurns),
            })}
          </p>
          {turns.map(turn => (
            <article
              key={`${turn.round}-${turn.turn}`}
              className="brainstorm-pane__turn"
            >
              <span className="brainstorm-pane__turn-head">
                {t('tabs.brainstormPaneTurnHead', {
                  round: String(turn.round + 1),
                  turn: String(turn.turn),
                })}
              </span>
              <ChatBubble variant="assistant" live={turn.live}>
                <AiMarkdown content={turn.text} showCursor={turn.live} />
              </ChatBubble>
            </article>
          ))}
          {turns.length === 0 ? (
            <p className="brainstorm-pane__empty">{t('tabs.brainstormSeatSilent')}</p>
          ) : null}
        </div>

        {composer ? <div className="brainstorm-pane__foot">{composer}</div> : null}
      </div>
    </>
  )
}
