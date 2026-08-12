import React, { useEffect, useState } from 'react'
import { DEFAULT_CEREMONY_ID, type CeremonyId } from '@shared/agileCeremonies'
import { useT } from '@i18n/useT'
import { TerminalModal } from '../components/TerminalModal'
import { Button } from '../components/ui'
import { CeremonyPicker } from './CeremonyPicker'
import './BrainstormCeremonyModal.css'

export interface BrainstormCeremonyModalProps {
  open: boolean
  active?: boolean
  onClose: () => void
  /** Ceremonia elegida; el llamador sigue al paso de invitados. */
  onContinue: (ceremony: CeremonyId) => void
}

/**
 * Paso 1 de una sala: la ceremonia. Va antes de los invitados porque de ella
 * salen los roles que conviene sentar, además del objetivo y el gate.
 *
 * Ancho `xl` (900px): a `md` (520) la rejilla daba dos columnas estrechas y
 * las once ceremonias obligaban a scrollear casi todo el catálogo.
 */
export const BrainstormCeremonyModal: React.FC<BrainstormCeremonyModalProps> = ({
  open,
  active = true,
  onClose,
  onContinue,
}) => {
  const { t } = useT()
  const [ceremony, setCeremony] = useState<CeremonyId>(DEFAULT_CEREMONY_ID)

  useEffect(() => {
    if (open) setCeremony(DEFAULT_CEREMONY_ID)
  }, [open])

  return (
    <TerminalModal
      open={open}
      active={active}
      onClose={onClose}
      title={t('tabs.ceremonyStepTitle')}
      size="xl"
      zIndex={845}
      footer={(
        <div className="brainstorm-ceremony-modal__footer">
          <span className="brainstorm-ceremony-modal__step">{t('tabs.ceremonyStepBadge')}</span>
          <Button variant="secondary" size="sm" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" size="sm" onClick={() => onContinue(ceremony)}>
            {t('tabs.ceremonyContinue')}
          </Button>
        </div>
      )}
    >
      <div
        onKeyDown={event => {
          if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
            event.preventDefault()
            onContinue(ceremony)
          }
        }}
      >
        <CeremonyPicker value={ceremony} onChange={setCeremony} autoFocus />
      </div>
    </TerminalModal>
  )
}
