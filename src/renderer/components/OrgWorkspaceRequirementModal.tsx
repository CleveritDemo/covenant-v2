import React, { useEffect, useState } from 'react'
import { useT } from '@i18n/useT'
import type { OrgWorkspaceCloneFailure } from '../../shared/orgWorkspaceCloneError'
import { HeroConfirmOverlay } from './HeroConfirmOverlay'
import { TerminalModal } from './TerminalModal'
import { Button } from './ui/Button'
import './OrgWorkspaceRequirementModal.css'

/** Por debajo de QUIT_CONFIRM_Z (990); mismo techo que el modal de requisitos. */
const ORG_WORKSPACE_BUSY_Z = 780

export type OrgWorkspaceRequirementState = {
  missingFolder?: boolean
  missingToken?: boolean
  cloneError?: string
  cloneFailure?: OrgWorkspaceCloneFailure
  cloning?: boolean
  syncing?: boolean
  uploading?: boolean
  agentDeleteError?: string
  agentUpdateError?: string
  workspaceRenameError?: string
  uploadError?: string
  wikiError?: string
}

interface Props {
  open: boolean
  missingFolder?: boolean
  missingToken?: boolean
  cloneError?: string
  cloneFailure?: OrgWorkspaceCloneFailure
  cloning?: boolean
  syncing?: boolean
  uploading?: boolean
  agentDeleteError?: string
  agentUpdateError?: string
  workspaceRenameError?: string
  uploadError?: string
  wikiError?: string
  onClose: () => void
  onOpenSettings: () => void
  /** Espacio cancela sync o publish en curso. */
  onCancelBusy?: () => void
}

type T = ReturnType<typeof useT>['t']

function cloneHeadline(failure: OrgWorkspaceCloneFailure, t: T): string {
  const org = failure.orgName?.trim() || t('organizations.reqCloneOrgFallback')
  const repo = failure.repoFullName?.trim() || t('organizations.reqCloneRepoFallback')
  switch (failure.kind) {
    case 'saml-sso':
      return t('organizations.reqCloneHeadlineSamlSso', { org })
    case 'unauthorized':
      return t('organizations.reqCloneHeadlineUnauthorized')
    case 'not-found':
      return t('organizations.reqCloneHeadlineNotFound', { repo })
    case 'network':
      return t('organizations.reqCloneHeadlineNetwork')
    case 'invalid-config':
      return t('organizations.reqCloneHeadlineInvalidConfig')
    case 'forbidden':
      return t('organizations.reqCloneHeadlineForbidden')
    default:
      return t('organizations.reqCloneHeadlineUnknown')
  }
}

function cloneHint(failure: OrgWorkspaceCloneFailure, t: T): string | null {
  switch (failure.kind) {
    case 'saml-sso':
      return t('organizations.reqCloneHintSamlSso')
    case 'unauthorized':
      return t('organizations.reqCloneHintUnauthorized')
    case 'forbidden':
      return t('organizations.reqCloneHintForbidden')
    default:
      return null
  }
}

/** Presentación tipada del fallo de clone (titular, hint, detalles). */
const CloneFailureView: React.FC<{
  failure: OrgWorkspaceCloneFailure
  ssoUrlFallback: string | null
}> = ({ failure, ssoUrlFallback }) => {
  const { t } = useT()
  const [copied, setCopied] = useState(false)
  const raw = failure.raw.trim()
  const repo = failure.repoFullName?.trim()
  const hint = cloneHint(failure, t)

  useEffect(() => {
    setCopied(false)
  }, [failure.raw])

  const onCopy = (): void => {
    void navigator.clipboard.writeText(raw).then(
      () => {
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1500)
      },
      // ponytail: el portapapeles puede negarse; sin feedback extra, solo no romper.
      () => {},
    )
  }

  return (
    <div className="org-ws-req__clone">
      <p className="org-ws-req__headline">{cloneHeadline(failure, t)}</p>
      {hint ? <p className="org-ws-req__hint">{hint}</p> : null}
      {repo ? (
        <p className="org-ws-req__repo">
          {t('organizations.reqCloneRepo', { repo })}
        </p>
      ) : null}
      {ssoUrlFallback ? (
        <p className="org-ws-req__sso-fallback">
          <span className="org-ws-req__sso-fallback-label">
            {t('organizations.reqCloneSsoUrlFallback')}
          </span>
          <code className="org-ws-req__sso-fallback-url">{ssoUrlFallback}</code>
        </p>
      ) : null}
      {raw ? (
        <details className="org-ws-req__details">
          <summary className="org-ws-req__details-summary">
            {t('organizations.reqCloneTechDetails')}
          </summary>
          <pre className="org-ws-req__raw">{raw}</pre>
          <div className="org-ws-req__details-actions">
            <Button variant="secondary" size="xs" onClick={onCopy}>
              {copied
                ? t('organizations.reqCloneCopied')
                : t('organizations.reqCloneCopyDetails')}
            </Button>
          </div>
        </details>
      ) : null}
    </div>
  )
}

export const OrgWorkspaceRequirementModal: React.FC<Props> = ({
  open,
  missingFolder = false,
  missingToken = false,
  cloneError,
  cloneFailure,
  cloning = false,
  syncing = false,
  uploading = false,
  agentDeleteError,
  agentUpdateError,
  workspaceRenameError,
  uploadError,
  wikiError,
  onClose,
  onOpenSettings,
  onCancelBusy,
}) => {
  const { t } = useT()
  const [ssoOpenFailedUrl, setSsoOpenFailedUrl] = useState<string | null>(null)
  const busy = cloning || syncing || uploading
  const statusLabel = uploading
    ? t('organizations.reqUploading')
    : syncing
      ? t('organizations.reqSyncing')
      : t('organizations.reqCloning')
  const legacyCloneRaw = !cloneFailure && cloneError?.trim() ? cloneError.trim() : null
  const agentErr = agentDeleteError?.trim()
    ? t('organizations.reqAgentDeleteFailed', { error: agentDeleteError.trim() })
    : agentUpdateError?.trim()
      ? t('organizations.reqAgentUpdateFailed', { error: agentUpdateError.trim() })
      : null
  const renameErr = workspaceRenameError?.trim()
    ? t('organizations.reqWorkspaceRenameFailed', { error: workspaceRenameError.trim() })
    : null
  const uploadErr = uploadError?.trim()
    ? t('organizations.reqUploadFailed', { error: uploadError.trim() })
    : null
  const wikiErr = wikiError?.trim()
    ? t('organizations.reqWikiFailed', { error: wikiError.trim() })
    : null

  const showAuthorize =
    cloneFailure?.kind === 'saml-sso' && Boolean(cloneFailure.ssoUrl?.trim())
  const showSettings =
    missingFolder
    || missingToken
    || cloneFailure?.kind === 'unauthorized'
    || cloneFailure?.kind === 'forbidden'

  useEffect(() => {
    setSsoOpenFailedUrl(null)
  }, [cloneFailure?.ssoUrl, open])

  const handleAuthorize = (): void => {
    const url = cloneFailure?.ssoUrl?.trim()
    if (!url) return
    void window.api.openExternalUrl(url).then(r => {
      if (!r.ok) setSsoOpenFailedUrl(url)
    })
  }

  const cancelableBusy = syncing || uploading

  if (busy) {
    return (
      <HeroConfirmOverlay
        variant="busy"
        open={open}
        meta={statusLabel}
        title={t('organizations.reqBusyTitle')}
        hint={cancelableBusy ? t('organizations.reqBusyCancelHint') : undefined}
        zIndex={ORG_WORKSPACE_BUSY_Z}
        onCancel={cancelableBusy ? onCancelBusy : undefined}
      />
    )
  }

  return (
    <TerminalModal
      open={open}
      onClose={onClose}
      title={t('organizations.reqTitle')}
      size="sm"
      zIndex={ORG_WORKSPACE_BUSY_Z}
      bodyLayout="spacious"
      closeOnBackdrop
      closeOnEscape
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          {showAuthorize ? (
            <Button variant="primary" size="sm" onClick={handleAuthorize}>
              {t('organizations.reqCloneAuthorizeGithub')}
            </Button>
          ) : null}
          {showSettings && !showAuthorize ? (
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
          ) : null}
        </>
      }
    >
      <div className="org-ws-req__body">
        {missingFolder ? (
          <p className="org-ws-req__line">{t('organizations.reqMissingFolder')}</p>
        ) : null}
        {missingToken ? (
          <p className="org-ws-req__line">{t('organizations.reqMissingToken')}</p>
        ) : null}
        {cloneFailure ? (
          <CloneFailureView
            failure={cloneFailure}
            ssoUrlFallback={ssoOpenFailedUrl}
          />
        ) : legacyCloneRaw ? (
          <pre className="org-ws-req__raw">
            {t('organizations.reqCloneFailed', { error: legacyCloneRaw })}
          </pre>
        ) : null}
        {agentErr ? <p className="org-ws-req__line">{agentErr}</p> : null}
        {renameErr ? <p className="org-ws-req__line">{renameErr}</p> : null}
        {uploadErr ? <p className="org-ws-req__line">{uploadErr}</p> : null}
        {wikiErr ? <p className="org-ws-req__line">{wikiErr}</p> : null}
      </div>
    </TerminalModal>
  )
}
