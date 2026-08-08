import React, { useEffect } from 'react'
import { useT } from '@i18n/useT'
import { Gravity } from '../agent/Gravity'
import { TerminalModal } from './TerminalModal'
import { Button } from './ui/Button'
import './QuitConfirmModal.css'

interface Props {
  open: boolean
  /** Terminales vivas; 0 oculta la línea de recuento. */
  terminals?: number
  /** Agentes con turno en curso. */
  agents?: number
  onConfirm: () => void
  onCancel: () => void
}

/** Confirmación de salida, con la misma masa central que el plano y el splash. */
export const QuitConfirmModal: React.FC<Props> = ({
  open, terminals = 0, agents = 0, onConfirm, onCancel,
}) => {
  const { t } = useT()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Enter') return
      e.preventDefault()
      e.stopPropagation()
      onConfirm()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, onConfirm])

  const running = [
    terminals > 0 ? t('quit.runningTerminals', { count: terminals }) : '',
    agents > 0 ? t('quit.runningAgents', { count: agents }) : '',
  ].filter(Boolean).join(' · ')

  return (
    <TerminalModal
      open={open}
      onClose={onCancel}
      size="sm"
      zIndex={900}
      closeOnEscape
      headerContent={
        <div className="quit-confirm__hero">
          <Gravity size="compact" />
          <h2 className="quit-confirm__title">{t('quit.title')}</h2>
        </div>
      }
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onCancel}>
            {t('quit.cancel')}
          </Button>
          <Button variant="danger" size="sm" onClick={onConfirm} autoFocus>
            {t('quit.confirm')}
          </Button>
        </>
      }
    >
      <p className="quit-confirm__detail">{t('quit.detail')}</p>
      {running && <p className="quit-confirm__running">{running}</p>}
    </TerminalModal>
  )
}
