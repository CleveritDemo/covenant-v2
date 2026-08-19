import React, { useCallback, useState } from 'react'
import { Button } from '../components/ui'
import { TextArea } from '../components/ui/TextArea'
import { BrainstormWorkingSetField } from './BrainstormWorkingSetField'
import './BrainstormHumanComposer.css'

export interface BrainstormComposerTarget {
  agentId: string
  label: string
}

export interface BrainstormHumanComposerProps {
  placeholder: string
  sendLabel: string
  disabled?: boolean
  /** Destinos posibles además de la sala entera. */
  targets?: readonly BrainstormComposerTarget[]
  roomLabel: string
  /** «se lee antes del turno N». */
  timingHint: string
  cwd: string
  /** Añadir contexto/archivo en caliente; ausente = sin buscador. */
  onAddWorkingSet?: (working: { contextIds: string[]; filePaths: string[] }) => void
  addContextLabel: string
  onSend: (text: string, targetAgentId?: string) => void
}

/** Composer de interrupción humana: a la sala o a un agente, con contexto citable. */
export const BrainstormHumanComposer: React.FC<BrainstormHumanComposerProps> = ({
  placeholder,
  sendLabel,
  disabled = false,
  targets = [],
  roomLabel,
  timingHint,
  cwd,
  onAddWorkingSet,
  addContextLabel,
  onSend,
}) => {
  const [value, setValue] = useState('')
  const [target, setTarget] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const canSend = !disabled && value.trim().length > 0

  const submit = useCallback((): void => {
    const text = value.trim()
    if (!text || disabled) return
    setValue('')
    onSend(text, target || undefined)
  }, [disabled, onSend, target, value])

  return (
    <div className="brainstorm-human-composer" data-onboarding="brainstorm-human-composer">
      <div className="brainstorm-human-composer__row">
        <TextArea
          size="sm"
          autoGrow
          rows={1}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          aria-label={placeholder}
          onChange={event => setValue(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              submit()
            }
          }}
        />
        <Button
          variant="primary"
          size="sm"
          disabled={!canSend}
          onClick={submit}
        >
          {sendLabel}
        </Button>
      </div>

      <div className="brainstorm-human-composer__meta">
        {targets.length ? (
          <span className="brainstorm-human-composer__targets" role="radiogroup" aria-label={roomLabel}>
            <button
              type="button"
              role="radio"
              aria-checked={target === ''}
              className={target === ''
                ? 'brainstorm-human-composer__target brainstorm-human-composer__target--on'
                : 'brainstorm-human-composer__target'}
              onClick={() => setTarget('')}
            >
              {roomLabel}
            </button>
            {targets.map(item => (
              <button
                key={item.agentId}
                type="button"
                role="radio"
                aria-checked={target === item.agentId}
                className={target === item.agentId
                  ? 'brainstorm-human-composer__target brainstorm-human-composer__target--on'
                  : 'brainstorm-human-composer__target'}
                onClick={() => setTarget(item.agentId)}
              >
                {item.label}
              </button>
            ))}
          </span>
        ) : null}

        {onAddWorkingSet ? (
          <button
            type="button"
            className="brainstorm-human-composer__at"
            aria-expanded={pickerOpen}
            onClick={() => setPickerOpen(open => !open)}
          >
            {addContextLabel}
          </button>
        ) : null}

        <span className="brainstorm-human-composer__timing">{timingHint}</span>
      </div>

      {pickerOpen && onAddWorkingSet ? (
        <BrainstormWorkingSetField
          cwd={cwd}
          contextIds={[]}
          filePaths={[]}
          onChange={next => {
            if (!next.contextIds.length && !next.filePaths.length) return
            onAddWorkingSet(next)
            setPickerOpen(false)
          }}
        />
      ) : null}
    </div>
  )
}
