import React, { useEffect, useRef } from 'react'
import { Tooltip } from '../components/ui/Tooltip'
import { PlaneChatSendButton, type PlaneChatSendMode } from './PlaneChatSendButton'
import './PlaneChatComposer.css'

const MAX_COMPOSER_ROWS = 8

/** Ajusta la altura del textarea al contenido, con tope de filas. */
export function resizeComposerTextarea(el: HTMLTextAreaElement): void {
  el.style.height = 'auto'
  const styles = getComputedStyle(el)
  const lineHeight = parseFloat(styles.lineHeight) || 18
  const padY = (parseFloat(styles.paddingTop) || 0) + (parseFloat(styles.paddingBottom) || 0)
  const maxH = lineHeight * MAX_COMPOSER_ROWS + padY
  el.style.height = `${Math.min(el.scrollHeight, maxH)}px`
}

export interface PlaneChatComposerShellProps {
  value: string
  onChange: (value: string) => void
  placeholder: string
  inputLabel: string
  sendLabel: string
  sendMode: PlaneChatSendMode
  sendDisabled?: boolean
  listening?: boolean
  /** Nivel de mic 0–1 mientras escucha. */
  level?: number
  /** Bandas espectrales 0–1 para barras del botón mic. */
  bands?: number[]
  disabled?: boolean
  /** Tooltip sobre el campo cuando `disabled` (p. ej. hay agentes sin selección). */
  disabledHint?: string
  recalling?: boolean
  onSendClick: () => void
  onMicStart?: () => void
  onMicStop?: () => void
  /** Controles a la izquierda del campo (sketch, settings…). */
  leading?: React.ReactNode
  /** Dentro del shell, a la derecha del textarea (thumbs). */
  shellAside?: React.ReactNode
  /** Overlay del textarea (p. ej. picker de mención Jira). */
  inputOverlay?: React.ReactNode
  /** Junto al field (p. ej. badge de historial). */
  fieldAside?: React.ReactNode
  /** Carril de agentes sobre el textarea, acotado al ancho del campo. */
  fieldHeader?: React.ReactNode
  onPaste?: (event: React.ClipboardEvent<HTMLTextAreaElement>) => void
  /** Tras cambiar el texto: caret/mención (Jira). */
  onInputChange?: (el: HTMLTextAreaElement) => void
  /** Al mover el caret sin teclear. */
  onInputSelect?: (el: HTMLTextAreaElement) => void
  /**
   * Teclas extra del textarea (↑/↓ historial). Enter sin Shift siempre envía/
   * detiene y no llega aquí.
   */
  onExtraKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void
  inputRef?: React.RefObject<HTMLTextAreaElement | null>
}

/**
 * Fila reutilizable del composer: textarea multiline + send/stop/mic.
 * Sin badges de agentes, cola ni listbox — eso queda en PlaneChatComposer.
 */
export const PlaneChatComposerShell: React.FC<PlaneChatComposerShellProps> = ({
  value,
  onChange,
  placeholder,
  inputLabel,
  sendLabel,
  sendMode,
  sendDisabled = false,
  listening = false,
  level = 0,
  bands = [],
  disabled = false,
  disabledHint,
  recalling = false,
  onSendClick,
  onMicStart,
  onMicStop,
  leading,
  shellAside,
  inputOverlay,
  fieldAside,
  fieldHeader,
  onPaste,
  onInputChange,
  onInputSelect,
  onExtraKeyDown,
  inputRef,
}) => {
  const localRef = useRef<HTMLTextAreaElement | null>(null)
  const textareaRef = inputRef ?? localRef

  useEffect(() => {
    const el = textareaRef.current
    if (el) resizeComposerTextarea(el)
  }, [value, textareaRef])

  const field = (
    <span className="plane-chat-composer__field">
      {fieldHeader}
      <div
        className={[
          'plane-chat-composer__input-shell',
          recalling ? 'plane-chat-composer__input-shell--recalling' : '',
        ].filter(Boolean).join(' ')}
      >
        <textarea
          ref={textareaRef as React.Ref<HTMLTextAreaElement>}
          className={`plane-chat-composer__input${recalling ? ' plane-chat-composer__input--recalling' : ''}`}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          aria-label={inputLabel}
          rows={1}
          onChange={event => {
            onChange(event.target.value)
            onInputChange?.(event.target)
          }}
          onSelect={event => onInputSelect?.(event.currentTarget)}
          onPaste={onPaste}
          onKeyDown={event => {
            // Con resultados visibles, `IssueMentionPicker` intercepta
            // ArrowUp/Down/Enter/Escape en captura y hace stopPropagation —
            // este handler ni los ve. Sin resultados, Enter/Escape siguen.
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              onSendClick()
              return
            }
            onExtraKeyDown?.(event)
          }}
        />
        {inputOverlay}
        {shellAside}
      </div>
      {fieldAside}
    </span>
  )

  /* El coach de «habla con un agente» señala la fila entera, no el input suelto:
     dentro viven el riel de agentes, el sketch y el mic. Con el ancla en el
     input, el velo apagaba esos botones y el globo caía sobre el riel. */
  return (
    <div
      className="plane-chat-composer__row"
      data-plane-composer-shell=""
      data-onboarding="composer-input"
    >
      {leading}
      {disabled && disabledHint ? (
        <Tooltip content={disabledHint}>{field}</Tooltip>
      ) : field}
      <PlaneChatSendButton
        mode={sendMode}
        label={sendLabel}
        listening={listening}
        level={level}
        bands={bands}
        disabled={sendDisabled}
        onClick={onSendClick}
        onMicStart={onMicStart}
        onMicStop={onMicStop}
      />
    </div>
  )
}
