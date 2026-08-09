import React from 'react'
import { useT } from '@i18n/useT'
import { TerminalModal } from './TerminalModal'
import { Button } from './ui/Button'
import { Spinner } from './ui/Spinner'
import './OrgWorkspaceRequirementModal.css'

export type OrgWorkspaceRequirementState = {
  missingFolder?: boolean
  missingToken?: boolean
  cloneError?: string
  cloning?: boolean
  syncing?: boolean
  agentDeleteError?: string
  agentUpdateError?: string
  workspaceRenameError?: string
}

interface Props {
  open: boolean
  missingFolder?: boolean
  missingToken?: boolean
  cloneError?: string
  cloning?: boolean
  syncing?: boolean
  agentDeleteError?: string
  agentUpdateError?: string
  workspaceRenameError?: string
  onClose: () => void
  onOpenSettings: () => void
}

export const OrgWorkspaceRequirementModal: React.FC<Props> = ({
  open,
  missingFolder = false,
  missingToken = false,
  cloneError,
  cloning = false,
  syncing = false,
  agentDeleteError,
  agentUpdateError,
  workspaceRenameError,
  onClose,
  onOpenSettings,
}) => {
  const { t } = useT()
  const busy = cloning || syncing
  const statusLabel = syncing
    ? t('organizations.reqSyncing')
    : t('organizations.loading')
  const detail = cloneError?.trim()
    ? t('organizations.reqCloneFailed', { error: cloneError.trim() })
    : null
  const agentErr = agentDeleteError?.trim()
    ? t('organizations.reqAgentDeleteFailed', { error: agentDeleteError.trim() })
    : agentUpdateError?.trim()
      ? t('organizations.reqAgentUpdateFailed', { error: agentUpdateError.trim() })
      : null
  const renameErr = workspaceRenameError?.trim()
    ? t('organizations.reqWorkspaceRenameFailed', { error: workspaceRenameError.trim() })
    : null

  return (
    <TerminalModal
      open={open}
      onClose={onClose}
      title={t('organizations.reqTitle')}
      size="sm"
      zIndex={780}
      bodyLayout="spacious"
      closeOnBackdrop={!busy}
      closeOnEscape={!busy}
      footer={
        busy ? undefined : (
          <>
            <Button variant="secondary" size="sm" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            {(missingFolder || missingToken) && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  onClose()
                  onOpenSettings()
                }}
              >
                {t('organizations.openSettings')}
              </Button>
            )}
          </>
        )
      }
    >
      {busy ? (
        <div className="org-ws-req__status">
          <Spinner aria-label={statusLabel} />
          <span>{statusLabel}</span>
        </div>
      ) : (
        <div className="org-ws-req__body">
          {missingFolder ? (
            <p className="org-ws-req__line">{t('organizations.reqMissingFolder')}</p>
          ) : null}
          {missingToken ? (
            <p className="org-ws-req__line">{t('organizations.reqMissingToken')}</p>
          ) : null}
          {detail ? <p className="org-ws-req__line">{detail}</p> : null}
          {agentErr ? <p className="org-ws-req__line">{agentErr}</p> : null}
          {renameErr ? <p className="org-ws-req__line">{renameErr}</p> : null}
        </div>
      )}
    </TerminalModal>
  )
}
