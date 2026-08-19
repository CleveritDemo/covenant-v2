import React, { useEffect, useRef, useState } from 'react'
import { APP_CHROME_MODAL_Z } from '@shared/overlayZIndex'
import { useT } from '@i18n/useT'
import { TerminalModal } from './TerminalModal'
import { Button, ChoiceCard } from './ui'
import './OrgSyncScopeModal.css'

type SyncScope = 'all' | 'contexts'

interface Props {
  open: boolean
  onClose: () => void
  onConfirm: (includeAgents: boolean) => void
}

export const OrgSyncScopeModal: React.FC<Props> = ({ open, onClose, onConfirm }) => {
  const { t } = useT()
  const [scope, setScope] = useState<SyncScope>('all')
  const wasOpenRef = useRef(false)

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setScope('all')
    }
    wasOpenRef.current = open
  }, [open])

  return (
    <TerminalModal
      open={open}
      onClose={onClose}
      title={t('organizations.syncScopeTitle')}
      size="sm"
      zIndex={APP_CHROME_MODAL_Z}
      bodyLayout="spacious"
      closeOnBackdrop
      closeOnEscape
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            {t('organizations.syncScopeCancel')}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => onConfirm(scope === 'all')}
          >
            {t('organizations.syncScopeConfirm')}
          </Button>
        </>
      }
    >
      <div className="org-sync-scope">
        <p className="org-sync-scope__hint">{t('organizations.syncScopeHint')}</p>
        <div
          className="org-sync-scope__options"
          role="radiogroup"
          aria-label={t('organizations.syncScopeTitle')}
        >
          <ChoiceCard
            role="radio"
            selected={scope === 'all'}
            aria-checked={scope === 'all'}
            onClick={() => setScope('all')}
          >
            <strong>{t('organizations.syncScopeAllTitle')}</strong>
            <span className="org-sync-scope__option-hint">
              {t('organizations.syncScopeAllHint')}
            </span>
          </ChoiceCard>
          <ChoiceCard
            role="radio"
            selected={scope === 'contexts'}
            aria-checked={scope === 'contexts'}
            onClick={() => setScope('contexts')}
          >
            <strong>{t('organizations.syncScopeContextsTitle')}</strong>
            <span className="org-sync-scope__option-hint">
              {t('organizations.syncScopeContextsHint')}
            </span>
          </ChoiceCard>
        </div>
      </div>
    </TerminalModal>
  )
}
