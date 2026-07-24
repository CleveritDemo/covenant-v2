import React, { useEffect, useRef, useState } from 'react'
import { AGENT_NAME_MAX_LENGTH } from '@shared/agentIdentity'
import { useT } from '@i18n/useT'
import { TerminalModal } from '../components/TerminalModal'
import { Button, Input } from '../components/ui'
import './AgentCreateNameModal.css'

export interface AgentCreateNameModalProps {
  open: boolean
  onConfirm: (name: string) => void
  onClose: () => void
}

/** Nombre del agente tras elegir proveedor; Confirm exige texto no vacío. */
export const AgentCreateNameModal: React.FC<AgentCreateNameModalProps> = ({
  open,
  onConfirm,
  onClose,
}) => {
  const { t } = useT()
  const [name, setName] = useState('')
  const wasOpenRef = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setName('')
      window.requestAnimationFrame(() => inputRef.current?.focus())
    }
    wasOpenRef.current = open
  }, [open])

  const trimmed = name.trim()
  const canConfirm = trimmed.length > 0

  const submit = (): void => {
    if (!canConfirm) return
    onConfirm(trimmed)
  }

  return (
    <TerminalModal
      open={open}
      onClose={onClose}
      title={t('agentPane.createNameTitle')}
      size="sm"
      zIndex={870}
      footer={(
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" size="sm" disabled={!canConfirm} onClick={submit}>
            {t('agentPane.createNameConfirm')}
          </Button>
        </>
      )}
    >
      <div className="agent-create-name">
        <p className="agent-create-name__description">
          {t('agentPane.createNameDescription')}
        </p>
        <label className="agent-create-name__field">
          <span className="agent-create-name__label">{t('agentPane.nameLabel')}</span>
          <Input
            ref={inputRef}
            type="text"
            value={name}
            maxLength={AGENT_NAME_MAX_LENGTH}
            placeholder={t('agentPane.createNamePlaceholder')}
            onChange={event => setName(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') {
                event.preventDefault()
                submit()
              }
            }}
          />
        </label>
      </div>
    </TerminalModal>
  )
}
