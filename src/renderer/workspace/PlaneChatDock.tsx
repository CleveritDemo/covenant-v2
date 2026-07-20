import React from 'react'
import './PlaneChatDock.css'

export interface PlaneChatDockProps {
  chat: React.ReactNode
  composer: React.ReactNode
  /** Controles encima del chat (por encima del fade superior). */
  toolbar?: React.ReactNode
}

/**
 * Chat bajo las ventanas del plano; composer en capa superior.
 */
export const PlaneChatDock: React.FC<PlaneChatDockProps> = ({ chat, composer, toolbar }) => (
  <>
    <div className="plane-chat-dock">
      {toolbar ? (
        <div className="plane-chat-dock__toolbar">{toolbar}</div>
      ) : null}
      <div className="plane-chat-dock__chat">{chat}</div>
    </div>
    <div className="plane-chat-dock__composer-shell">{composer}</div>
  </>
)
