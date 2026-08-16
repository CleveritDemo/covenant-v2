import React from 'react'
import { Tooltip } from '../components/ui'
import { useT } from '@i18n/useT'
import { PlaneBusyDot, type PlaneBusyDotVariant } from './PlaneBusyDot'
import './PlaneChatBackgroundThreadDots.css'

export interface PlaneChatBackgroundThreadDot {
  threadId: string
  variant: PlaneBusyDotVariant
  title: string
  activity: string
}

export interface PlaneChatBackgroundThreadDotsProps {
  dots: readonly PlaneChatBackgroundThreadDot[]
  selectionLocked?: boolean
  onSelectThread: (threadId: string) => void
}

/** Hilos en segundo plano: dots junto al chip activo en la barra del composer. */
export const PlaneChatBackgroundThreadDots: React.FC<PlaneChatBackgroundThreadDotsProps> = ({
  dots,
  selectionLocked = false,
  onSelectThread,
}) => {
  const { t } = useT()

  if (dots.length === 0) return null

  return (
    <div
      className="plane-chat-background-thread-dots"
      role="group"
      aria-label={t('agentPane.threadBusyDotsAria', { count: dots.length })}
    >
      {dots.map(dot => {
        const title = dot.title.trim() || t('agentPane.threadUntitled')
        const activity = dot.activity.trim()
          || (dot.variant === 'delegating'
            ? t('agentPane.delegatingTitle')
            : t('agentPane.awaitingStatusRunning'))
        const hint = selectionLocked
          ? activity
          : `${activity} · ${t('agentPane.threadBackgroundDotHint')}`

        return (
          <Tooltip key={dot.threadId} content={title} hint={hint}>
            <button
              type="button"
              className="plane-chat-background-thread-dots__dot"
              disabled={selectionLocked}
              aria-label={t('agentPane.threadBackgroundDotAria', { title, activity })}
              onClick={event => {
                event.stopPropagation()
                if (!selectionLocked) onSelectThread(dot.threadId)
              }}
            >
              <PlaneBusyDot size="sm" variant={dot.variant} />
            </button>
          </Tooltip>
        )
      })}
    </div>
  )
}
