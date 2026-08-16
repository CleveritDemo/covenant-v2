import React, { useCallback } from 'react'
import { Icon } from '../components/ui/Icon'
import { DictationMicSpectrum } from '../components/DictationMicSpectrum'
import { dictationMicButtonStyle } from '../components/dictationMicButton'
import '../components/DictationMicButton.css'
import './PlaneChatComposer.css'

export type PlaneChatSendMode = 'send' | 'stop' | 'mic'

export interface PlaneChatSendButtonProps {
  mode: PlaneChatSendMode
  label: string
  disabled?: boolean
  listening?: boolean
  /** Nivel de mic 0–1 mientras escucha; anima el botón mic. */
  level?: number
  /** Bandas espectrales 0–1 para barras del botón mic. */
  bands?: number[]
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
      style={isMic && listening ? dictationMicButtonStyle(level, bands) : undefined}
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
      {showSpectrum ? <DictationMicSpectrum bands={bands} level={level} /> : null}
      {!showSpectrum ? (
        <span className="dictation-mic-btn__icon">
          <Icon
            name={mode === 'stop' ? 'stop' : mode === 'mic' ? 'mic' : 'send'}
            size={14}
          />
        </span>
      ) : null}
    </button>
  )
}
