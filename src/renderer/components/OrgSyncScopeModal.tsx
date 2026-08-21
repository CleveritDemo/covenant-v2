import React, { useEffect, useRef, useState } from 'react'
import { APP_CHROME_MODAL_Z } from '@shared/overlayZIndex'
import { useT } from '@i18n/useT'
import { TerminalModal } from './TerminalModal'
import { Button, ChoiceCard, ContextCheckOption, Skeleton } from './ui'
import './OrgSyncScopeModal.css'

type SyncScope = 'all' | 'contexts'

export type OrgSyncScopePlan = {
  agentIdsToDelete: string[]
  contextIdsToDelete: string[]
}

export type OrgSyncScopeConfirm = {
  includeAgents: boolean
  dropLocalStale: boolean
}

interface Props {
  open: boolean
  onClose: () => void
  onConfirm: (result: OrgSyncScopeConfirm) => void
  mode?: 'download' | 'upload'
  plan?: OrgSyncScopePlan | null
  planLoading?: boolean
  onScopeChange?: (includeAgents: boolean) => void
}

export const OrgSyncScopeModal: React.FC<Props> = ({
  open,
  onClose,
  onConfirm,
  mode = 'download',
  plan = null,
  planLoading = false,
  onScopeChange,
}) => {
  const { t } = useT()
  const [scope, setScope] = useState<SyncScope>('all')
  const [dropLocalStale, setDropLocalStale] = useState(false)
  const wasOpenRef = useRef(false)

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setScope('all')
      setDropLocalStale(false)
    }
    wasOpenRef.current = open
  }, [open])

  const titleKey = mode === 'upload'
    ? 'organizations.uploadScopeTitle'
    : 'organizations.syncScopeTitle'
  const hintKey = mode === 'upload'
    ? 'organizations.uploadScopeHint'
    : 'organizations.syncScopeHint'
  const allTitleKey = mode === 'upload'
    ? 'organizations.uploadScopeAllTitle'
    : 'organizations.syncScopeAllTitle'
  const allHintKey = mode === 'upload'
    ? 'organizations.uploadScopeAllHint'
    : 'organizations.syncScopeAllHint'
  const contextsTitleKey = mode === 'upload'
    ? 'organizations.uploadScopeContextsTitle'
    : 'organizations.syncScopeContextsTitle'
  const contextsHintKey = mode === 'upload'
    ? 'organizations.uploadScopeContextsHint'
    : 'organizations.syncScopeContextsHint'

  const pickScope = (next: SyncScope) => {
    setScope(next)
    onScopeChange?.(next === 'all')
  }

  const deleteContextCount = plan?.contextIdsToDelete.length ?? 0
  const deleteAgentCount = scope === 'all' ? (plan?.agentIdsToDelete.length ?? 0) : 0
  const hasDeletes = deleteContextCount > 0 || deleteAgentCount > 0

  return (
    <TerminalModal
      open={open}
      onClose={onClose}
      title={t(titleKey)}
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
            onClick={() => onConfirm({
              includeAgents: scope === 'all',
              dropLocalStale: mode === 'download' ? dropLocalStale : false,
            })}
          >
            {t('organizations.syncScopeConfirm')}
          </Button>
        </>
      }
    >
      <div className="org-sync-scope">
        <p className="org-sync-scope__hint">{t(hintKey)}</p>
        <div
          className="org-sync-scope__options"
          role="radiogroup"
          aria-label={t(titleKey)}
        >
          <ChoiceCard
            role="radio"
            selected={scope === 'all'}
            aria-checked={scope === 'all'}
            onClick={() => pickScope('all')}
          >
            <strong>{t(allTitleKey)}</strong>
            <span className="org-sync-scope__option-hint">
              {t(allHintKey)}
            </span>
          </ChoiceCard>
          <ChoiceCard
            role="radio"
            selected={scope === 'contexts'}
            aria-checked={scope === 'contexts'}
            onClick={() => pickScope('contexts')}
          >
            <strong>{t(contextsTitleKey)}</strong>
            <span className="org-sync-scope__option-hint">
              {t(contextsHintKey)}
            </span>
          </ChoiceCard>
        </div>
        {mode === 'download' && (
          <ContextCheckOption
            name={t('organizations.syncDropLocalStale')}
            checked={dropLocalStale}
            onChange={() => setDropLocalStale(v => !v)}
          />
        )}
        {mode === 'upload' && (
          <div className="org-sync-scope__upload-notice" aria-live="polite">
            {planLoading ? (
              <Skeleton width="100%" height={14} radius="sm" />
            ) : plan ? (
              hasDeletes ? (
                <p className="org-sync-scope__upload-warning">
                  {t('organizations.uploadDeleteWarning', {
                    contexts: deleteContextCount,
                    agents: deleteAgentCount,
                  })}
                </p>
              ) : (
                <p className="org-sync-scope__upload-none">
                  {t('organizations.uploadDeleteNone')}
                </p>
              )
            ) : null}
          </div>
        )}
      </div>
    </TerminalModal>
  )
}
