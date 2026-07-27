import React, { useCallback, useEffect } from 'react'
import { useT } from '@i18n/useT'
import { TerminalModal } from './TerminalModal'
import { Button } from './ui/Button'
import './ConfirmTerminalModal.css'

interface Props {
  open: boolean
  message: string
  detail?: string
  zIndex?: number
  /** Tab/pane activo: oculta el portal sin cerrar el confirm del padre. */
  active?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export const ConfirmTerminalModal: React.FC<Props> = ({
  open, message, detail, zIndex = 600, active = true, onConfirm, onCancel,
}) => {
  const { t } = useT()
  const confirm = useCallback(() => { onConfirm() }, [onConfirm])
  const visible = open && active

  useEffect(() => {
    if (!visible) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); confirm() }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [visible, confirm])

  return (
    <TerminalModal
      open={open}
      active={active}
      onClose={onCancel}
      size="sm"
      zIndex={zIndex}
      closeOnEscape
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onCancel}>
            {t('ui.confirmNo')}
          </Button>
          <Button variant="primary" size="sm" onClick={confirm} autoFocus>
            {t('ui.confirmOk')}
          </Button>
        </>
      }
    >
      <p className="confirm-terminal-message">{message}</p>
      {detail && <p className="confirm-terminal-detail">{detail}</p>}
    </TerminalModal>
  )
}
