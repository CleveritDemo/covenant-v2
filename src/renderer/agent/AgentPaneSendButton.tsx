import React, { useCallback } from 'react'
import { Icon } from '../components/ui/Icon'
import { DictationMicSpectrum } from '../components/DictationMicSpectrum'
import { dictationMicButtonStyle } from '../components/dictationMicButton'
import '../components/DictationMicButton.css'
import './AgentPane.css'

export type AgentPaneSendMode = 'send' | 'stop' | 'mic'

export interface AgentPaneSendButtonProps {
  mode: AgentPaneSendMode
  label: string
  disabled?: boolean
  listening?: boolean
  level?: number
  bands?: number[]
  onClick: () => void
  onMicStart?: () => void
  onMicStop?: () => void
}

/** Send / stop / mic (push-to-talk) del composer del AgentPane. */
export const AgentPaneSendButton: React.FC<AgentPaneSendButtonProps> = ({
  mode,
  label,
  disabled = false,
  listening = false,
  level = 0,
  bands = [],
  onClick,
  onMicStart,
  onMicStop,
}) => {
  const isMic = mode === 'mic'
  const showSpectrum = isMic && listening

  const endMic = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    if (!isMic) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    onMicStop?.()
  }, [isMic, onMicStop])

  const iconName = mode === 'stop'
    ? 'stop'
    : mode === 'mic'
      ? 'mic'
      : 'send'

  return (
    <button
      type="button"
      className={[
        'agent-pane__send',
        mode === 'stop' ? 'agent-pane__send--stop' : '',
        isMic ? 'agent-pane__send--mic' : '',
        listening ? 'agent-pane__send--listening' : '',
      ].filter(Boolean).join(' ')}
      disabled={disabled}
      aria-label={label}
      aria-pressed={isMic ? listening : undefined}
      style={isMic && listening ? dictationMicButtonStyle(level, bands) : undefined}
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
      {showSpectrum ? <DictationMicSpectrum bands={bands} level={level} /> : null}
      {!showSpectrum ? (
        <span className="dictation-mic-btn__icon">
          <Icon name={iconName} size={14} />
        </span>
      ) : null}
    </button>
  )
}
