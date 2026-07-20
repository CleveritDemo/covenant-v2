import React from 'react'
import type { AgentCliProvider } from '@shared/tabSession'
import { Icon } from '../components/ui/Icon'
import './PlaneQuickChatAvatar.css'

export interface PlaneQuickChatAvatarProps {
  name: string
  provider?: AgentCliProvider
  busy?: boolean
}

/** Avatar del agente incrustado en la parte superior del chat del plano. */
export const PlaneQuickChatAvatar: React.FC<PlaneQuickChatAvatarProps> = ({
  name,
  provider = 'claude',
  busy = false,
}) => (
  <div
    className={[
      'plane-quick-chat-avatar',
      busy ? 'plane-quick-chat-avatar--busy' : '',
      provider === 'cursor' ? 'plane-quick-chat-avatar--cursor' : 'plane-quick-chat-avatar--claude',
    ].filter(Boolean).join(' ')}
    title={name}
    aria-label={name}
  >
    <span className="plane-quick-chat-avatar__ring" aria-hidden="true" />
    <span className="plane-quick-chat-avatar__core">
      <Icon name={provider === 'cursor' ? 'sparkles' : 'bot'} size={22} aria-hidden />
    </span>
  </div>
)
