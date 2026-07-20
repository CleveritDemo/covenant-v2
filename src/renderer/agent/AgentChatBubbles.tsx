import React from 'react'
import type { AgentChatEntry } from '@shared/agentCliTypes'
import { useT } from '@i18n/useT'
import { AiMarkdown } from '../components/AiMarkdown'
import { AiCodeBlock } from '../components/AiCodeBlock'
import { ThinkingOrbits } from './ThinkingOrbits'

type AgentBodySegment =
  | { type: 'text'; content: string }
  | { type: 'code'; lang: string; content: string }

function splitAgentBody(raw: string): AgentBodySegment[] {
  const segments: AgentBodySegment[] = []
  const pushText = (chunk: string): void => {
    if (chunk.trim()) segments.push({ type: 'text', content: chunk.replace(/\s+$/, '') })
  }
  let i = 0
  while (i < raw.length) {
    const fence = raw.indexOf('```', i)
    if (fence === -1) {
      pushText(raw.slice(i))
      break
    }
    if (fence > i) pushText(raw.slice(i, fence))
    const langEnd = raw.indexOf('\n', fence + 3)
    if (langEnd === -1) {
      segments.push({ type: 'code', lang: raw.slice(fence + 3).trim(), content: '' })
      break
    }
    const lang = raw.slice(fence + 3, langEnd).trim()
    const contentStart = langEnd + 1
    const close = raw.indexOf('\n```', contentStart)
    if (close === -1) {
      segments.push({ type: 'code', lang, content: raw.slice(contentStart) })
      break
    }
    segments.push({ type: 'code', lang, content: raw.slice(contentStart, close).replace(/\s+$/, '') })
    i = close + 4
  }
  return segments
}

const AssistantBody: React.FC<{ content: string; live: boolean }> = ({ content, live }) => {
  const segments = splitAgentBody(content)
  return (
    <div className={live ? 'agent-pane__stream' : undefined}>
      {segments.map((segment, index) =>
        segment.type === 'code' ? (
          <AiCodeBlock
            key={index}
            lang={segment.lang}
            content={segment.content}
            isStreaming={live}
            isLastSegment={index === segments.length - 1}
            onInsert={() => undefined}
          />
        ) : (
          <AiMarkdown
            key={index}
            content={segment.content}
            showCursor={live && index === segments.length - 1}
          />
        ),
      )}
    </div>
  )
}

const EMPTY_IDS = new Set<string>()

export interface AgentChatBubblesProps {
  messages: AgentChatEntry[]
  busy: boolean
  activeAssistantId: string | null
  enteringIds?: ReadonlySet<string>
  materializingIds?: ReadonlySet<string>
  settlingId?: string | null
  onEnteringAnimationEnd?: (id: string) => void
  onMaterializingAnimationEnd?: (id: string) => void
  /** `plane`: burbujas sueltas en el plano, sin marco de panel. */
  surface?: 'pane' | 'plane'
}

/** Lista de burbujas user/assistant + thinking (compartida panel / plano). */
export const AgentChatBubbles: React.FC<AgentChatBubblesProps> = ({
  messages,
  busy,
  activeAssistantId,
  enteringIds = EMPTY_IDS,
  materializingIds = EMPTY_IDS,
  settlingId = null,
  onEnteringAnimationEnd,
  onMaterializingAnimationEnd,
  surface = 'pane',
}) => {
  const { t } = useT()

  return (
    <div
      className={[
        'agent-chat-bubbles',
        surface === 'plane' ? 'agent-chat-bubbles--plane' : '',
      ].filter(Boolean).join(' ')}
    >
      {messages.map(message => {
        if (message.role === 'system') return null
        const live = busy &&
          message.role === 'assistant' &&
          message.id === activeAssistantId
        const landing = !live && settlingId === message.id
        const entering = enteringIds.has(message.id)
        const materializing = materializingIds.has(message.id)
        const thinkingOnly = live && !message.content
        if (message.role === 'assistant' && !message.content && !live) return null
        return (
          <div
            key={message.id}
            className={[
              'agent-pane__row',
              `agent-pane__row--${message.role}`,
              entering ? 'agent-pane__row--enter' : '',
              live ? 'agent-pane__row--live' : '',
              landing ? 'agent-pane__row--landing' : '',
            ].filter(Boolean).join(' ')}
            onAnimationEnd={entering
              ? event => {
                  if (event.target !== event.currentTarget) return
                  onEnteringAnimationEnd?.(message.id)
                }
              : undefined}
          >
            <div
              className={[
                `agent-pane__bubble agent-pane__bubble--${message.role}`,
                live ? 'agent-pane__bubble--live' : '',
                landing ? 'agent-pane__bubble--landing' : '',
                thinkingOnly ? 'agent-pane__bubble--thinking' : '',
                materializing ? 'agent-pane__bubble--materialize' : '',
              ].filter(Boolean).join(' ')}
              onAnimationEnd={materializing
                ? event => {
                    if (event.target !== event.currentTarget) return
                    if (!event.animationName.includes('materialize')) return
                    onMaterializingAnimationEnd?.(message.id)
                  }
                : undefined}
            >
              {message.role === 'user' && message.images && message.images.length > 0 && (
                <div className="agent-pane__bubble-images">
                  {message.images.map((image, index) => (
                    <img
                      key={`${message.id}-img-${index}`}
                      className="agent-pane__bubble-image"
                      src={image.dataUrl}
                      alt={image.name}
                      title={image.name}
                    />
                  ))}
                </div>
              )}
              {message.content
                ? (
                    message.role === 'assistant'
                      ? <AssistantBody content={message.content} live={live} />
                      : (
                          <span className={live ? 'agent-pane__stream' : undefined}>
                            {message.content}
                            {live && <span className="agent-pane__caret" aria-hidden="true" />}
                          </span>
                        )
                  )
                : live
                  ? (
                      <span className="agent-pane__thinking">
                        <ThinkingOrbits size="solo" />
                        <span className="agent-pane__thinking-text">{t('agentPane.thinking')}</span>
                      </span>
                    )
                  : ''}
            </div>
          </div>
        )
      })}
    </div>
  )
}
