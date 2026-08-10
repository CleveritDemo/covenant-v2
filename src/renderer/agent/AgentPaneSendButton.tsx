import React, { useCallback } from 'react'
import { Icon } from '../components/ui/Icon'
import './AgentPane.css'

export type AgentPaneSendMode = 'send' | 'stop' | 'play' | 'mic'

export interface AgentPaneSendButtonProps {
  mode: AgentPaneSendMode
  label: string
  disabled?: boolean
  listening?: boolean
  onClick: () => void
  onMicStart?: () => void
  onMicStop?: () => void
}

/** Send / stop / play / mic (push-to-talk) del composer del AgentPane. */
export const AgentPaneSendButton: React.FC<AgentPaneSendButtonProps> = ({
  mode,
  label,
  disabled = false,
  listening = false,
  onClick,
  onMicStart,
  onMicStop,
}) => {
  const isMic = mode === 'mic'

  const endMic = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    if (!isMic) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    onMicStop?.()
  }, [isMic, onMicStop])

  const iconName = mode === 'stop'
    ? 'stop'
    : mode === 'play'
      ? 'play'
      : mode === 'mic'
        ? 'mic'
        : 'send'

  return (
    <button
      type="button"
      className={[
        'agent-pane__send',
        mode === 'stop' ? 'agent-pane__send--stop' : '',
        mode === 'play' ? 'agent-pane__send--play' : '',
        isMic ? 'agent-pane__send--mic' : '',
        listening ? 'agent-pane__send--listening' : '',
      ].filter(Boolean).join(' ')}
      disabled={disabled}
      aria-label={label}
      aria-pressed={isMic ? listening : undefined}
      onClick={event => {
        if (isMic) {
          event.preventDefault()
          return
        }
        onClick()
      }}
      onPointerDown={event => {
        event.stopPropagation()
        if (!isMic || event.button !== 0) return
        event.preventDefault()
        event.currentTarget.setPointerCapture(event.pointerId)
        onMicStart?.()
      }}
      onPointerUp={endMic}
      onPointerCancel={endMic}
      onContextMenu={event => {
        if (isMic) event.preventDefault()
      }}
      onMouseDown={event => event.stopPropagation()}
    >
      <Icon name={iconName} size={14} />
    </button>
  )
}
