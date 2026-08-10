import React, { useCallback, useState } from 'react'
import { Button } from '../components/ui'
import { TextArea } from '../components/ui/TextArea'
import './BrainstormHumanComposer.css'

export interface BrainstormHumanComposerProps {
  placeholder: string
  sendLabel: string
  disabled?: boolean
  onSend: (text: string) => void
}

/** Composer de interrupción humana en sala running/paused. */
export const BrainstormHumanComposer: React.FC<BrainstormHumanComposerProps> = ({
  placeholder,
  sendLabel,
  disabled = false,
  onSend,
}) => {
  const [value, setValue] = useState('')
  const canSend = !disabled && value.trim().length > 0

  const submit = useCallback((): void => {
    const text = value.trim()
    if (!text || disabled) return
    setValue('')
    onSend(text)
  }, [disabled, onSend, value])

  return (
    <div className="brainstorm-human-composer">
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
  )
}
