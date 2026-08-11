import React from 'react'
import './ChatBubble.css'

export type ChatBubbleVariant = 'assistant' | 'user'
export type ChatBubbleWidth = 'default' | 'wide'

export interface ChatBubbleProps {
  children: React.ReactNode
  variant?: ChatBubbleVariant
  live?: boolean
  landing?: boolean
  gravity?: boolean
  materialize?: boolean
  /** Caja surface: tipografía chica (delegación); stream normal sin solid. */
  solid?: boolean
  width?: ChatBubbleWidth
}

/**
 * Shell de burbuja del chat: stream transparente; `solid` solo en tipografía chica.
 * Aplica también `agent-pane__bubble*` para selectores legacy (tests/layout).
 */
export const ChatBubble: React.FC<ChatBubbleProps> = ({
  children,
  variant = 'assistant',
  live = false,
  landing = false,
  gravity = false,
  materialize = false,
  solid = false,
  width,
}) => {
  const resolvedWidth = width ?? (variant === 'assistant' && !gravity ? 'wide' : 'default')

  const className = [
    'chat-bubble',
    `chat-bubble--${variant}`,
    live ? 'chat-bubble--live' : '',
    landing ? 'chat-bubble--landing' : '',
    gravity ? 'chat-bubble--gravity' : '',
    materialize ? 'chat-bubble--materialize' : '',
    solid ? 'chat-bubble--solid' : '',
    resolvedWidth === 'wide' ? 'chat-bubble--wide' : '',
    'agent-pane__bubble',
    `agent-pane__bubble--${variant}`,
    live ? 'agent-pane__bubble--live' : '',
    landing ? 'agent-pane__bubble--landing' : '',
    gravity ? 'agent-pane__bubble--gravity' : '',
    materialize ? 'agent-pane__bubble--materialize' : '',
    solid ? 'agent-pane__bubble--solid' : '',
  ].filter(Boolean).join(' ')

  return <div className={className}>{children}</div>
}
