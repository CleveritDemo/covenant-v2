import React, { useEffect, useRef, useState } from 'react'
import { normalizeContextFileName } from '@shared/tabContext'
import { PROJECT_DIR } from '@shared/projectDir'
import { useT } from '@i18n/useT'
import { TerminalModal } from '../components/TerminalModal'
import { Button, Input } from '../components/ui'
import { TabContextAppearancePopup } from '../agent/TabContextAppearancePopup'
import './BrainstormSaveContextModal.css'

/** Encima del overlay del plano (670) y debajo del popup de aspecto (940). */
const SAVE_CONTEXT_MODAL_Z = 900

export interface BrainstormSaveContextModalProps {
  open: boolean
  active?: boolean
  defaultName: string
  onCancel: () => void
  onConfirm: (draft: { name: string; icon?: string; color?: string }) => void
}

/** Confirma nombre + icono + color antes de materializar un brainstorm como notes. */
export const BrainstormSaveContextModal: React.FC<BrainstormSaveContextModalProps> = ({
  open,
  active,
  defaultName,
  onCancel,
  onConfirm,
}) => {
  const { t } = useT()
  const [name, setName] = useState(defaultName)
  const [icon, setIcon] = useState('messages')
  const [color, setColor] = useState('#c084fc')
  const wasOpenRef = useRef(false)

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setName(defaultName)
      setIcon('messages')
      setColor('#c084fc')
    }
    wasOpenRef.current = open
  }, [open, defaultName])

  const trimmed = name.trim()
  const canConfirm = trimmed.length > 0
  const destPath = `${PROJECT_DIR}/${normalizeContextFileName(trimmed || 'context', 'context')}`

  return (
    <TerminalModal
      open={open}
      active={active}
      onClose={onCancel}
      title={t('tabs.brainstormSaveContextTitle')}
      size="sm"
      zIndex={SAVE_CONTEXT_MODAL_Z}
      closeOnEscape
      footer={(
        <>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            {t('tabs.brainstormSaveContextCancel')}
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={!canConfirm}
            onClick={() => {
              if (!canConfirm) return
              onConfirm({ name: trimmed, icon, color })
            }}
          >
            {t('tabs.brainstormSaveContextConfirm')}
          </Button>
        </>
      )}
    >
      <div className="brainstorm-save-context">
        <label className="brainstorm-save-context__field">
          <span className="brainstorm-save-context__label">
            {t('tabs.brainstormSaveContextName')}
          </span>
          <Input
            type="text"
            value={name}
            autoFocus
            onChange={event => setName(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter' && canConfirm) {
                event.preventDefault()
                onConfirm({ name: trimmed, icon, color })
              }
            }}
          />
        </label>
        <TabContextAppearancePopup
          draft={{ name, kind: 'notes', icon, color }}
          onUpdate={patch => {
            if (patch.icon !== undefined) setIcon(patch.icon)
            if (patch.color !== undefined) setColor(patch.color)
          }}
        />
        <p className="brainstorm-save-context__path">{destPath}</p>
      </div>
    </TerminalModal>
  )
}
