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
}

interface Props {
  open: boolean
  missingFolder?: boolean
  missingToken?: boolean
  cloneError?: string
  cloning?: boolean
  onClose: () => void
  onOpenSettings: () => void
}

export const OrgWorkspaceRequirementModal: React.FC<Props> = ({
  open,
  missingFolder = false,
  missingToken = false,
  cloneError,
  cloning = false,
  onClose,
  onOpenSettings,
}) => {
  const { t } = useT()
  const detail = cloneError?.trim()
    ? t('organizations.reqCloneFailed', { error: cloneError.trim() })
    : null

  return (
    <TerminalModal
      open={open}
      onClose={onClose}
      title={t('organizations.reqTitle')}
      size="sm"
      zIndex={780}
      bodyLayout="spacious"
      closeOnBackdrop={!cloning}
      closeOnEscape={!cloning}
      footer={
        cloning ? undefined : (
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
      {cloning ? (
        <div className="org-ws-req__status">
          <Spinner aria-label={t('organizations.loading')} />
          <span>{t('organizations.loading')}</span>
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
        </div>
      )}
    </TerminalModal>
  )
}
