import React, { useCallback } from 'react'
import { Icon } from '../components/ui/Icon'
import './PlaneChatComposer.css'

export type PlaneChatSendMode = 'send' | 'stop' | 'mic'

export interface PlaneChatSendButtonProps {
  mode: PlaneChatSendMode
  label: string
  disabled?: boolean
  listening?: boolean
  onClick: () => void
  onMicStart?: () => void
  onMicStop?: () => void
}

/** Enviar / stop / mic (push-to-talk) del composer del plano. */
export const PlaneChatSendButton: React.FC<PlaneChatSendButtonProps> = ({
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

  return (
    <button
      type="button"
      className={[
        'plane-chat-composer__send',
        mode === 'stop' ? 'plane-chat-composer__send--stop' : '',
        isMic ? 'plane-chat-composer__send--mic' : '',
        listening ? 'plane-chat-composer__send--listening' : '',
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
    >
      <Icon
        name={mode === 'stop' ? 'stop' : mode === 'mic' ? 'mic' : 'send'}
        size={14}
      />
    </button>
  )
}
