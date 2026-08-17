import React, { useEffect, useMemo, useState } from 'react'
import { useT } from '@i18n/useT'
import { defaultPromotedWorkspaceName, type PromotePhase } from '../orgWorkspacePromote'
import { TerminalModal } from './TerminalModal'
import { Button, ContextCheckOption, Input, Select } from './ui'
import './PromoteWorkspaceModal.css'

export type PromoteWorkspaceOrgOption = { slug: string; name: string }
export type PromoteWorkspaceRepoOption = {
  path: string
  name: string
  repoFullName: string
  hasRemote: boolean
}
export type PromoteWorkspaceConfirmPayload = {
  orgSlug: string
  workspaceName: string
  repoPaths: string[]
}

interface Props {
  open: boolean
  folderPath: string
  orgs: PromoteWorkspaceOrgOption[]
  repos: PromoteWorkspaceRepoOption[]
  busy: boolean
  phase?: PromotePhase
  error?: string
  onClose: () => void
  onConfirm: (payload: PromoteWorkspaceConfirmPayload) => void
}

export const PromoteWorkspaceModal: React.FC<Props> = ({
  open,
  folderPath,
  orgs,
  repos,
  busy,
  phase,
  error,
  onClose,
  onConfirm,
}) => {
  const { t } = useT()
  const [orgSlug, setOrgSlug] = useState('')
  const [workspaceName, setWorkspaceName] = useState('')
  const [selectedPaths, setSelectedPaths] = useState<string[]>([])

  useEffect(() => {
    if (!open) return
    setWorkspaceName(defaultPromotedWorkspaceName(folderPath))
  }, [open, folderPath])

  useEffect(() => {
    if (!open) return
    setOrgSlug(current => {
      if (current && orgs.some(org => org.slug === current)) return current
      return orgs.length === 1 ? orgs[0]!.slug : ''
    })
  }, [open, orgs])

  useEffect(() => {
    if (!open) return
    setSelectedPaths(repos.filter(repo => repo.hasRemote).map(repo => repo.path))
  }, [open, repos])

  const orgOptions = useMemo(
    () => orgs.map(org => ({ value: org.slug, label: org.name, hint: org.slug })),
    [orgs],
  )

  const phaseLabel = (value: PromotePhase): string => {
    switch (value) {
      case 'create': return t('organizations.promotePhaseCreate')
      case 'repos': return t('organizations.promotePhaseRepos')
      case 'upload': return t('organizations.promotePhaseUpload')
      case 'wiki': return t('organizations.promotePhaseWiki')
    }
  }

  const canSubmit = Boolean(orgSlug.trim() && workspaceName.trim()) && !busy

  function toggleRepo(path: string): void {
    setSelectedPaths(current => (
      current.includes(path)
        ? current.filter(item => item !== path)
        : [...current, path]
    ))
  }

  return (
    <TerminalModal
      open={open}
      onClose={onClose}
      title={t('organizations.promoteTitle')}
      size="md"
      zIndex={760}
      bodyLayout="spacious"
      closeOnBackdrop={!busy}
      closeOnEscape={!busy}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={!canSubmit}
            onClick={() => onConfirm({
              orgSlug: orgSlug.trim(),
              workspaceName: workspaceName.trim(),
              repoPaths: selectedPaths,
            })}
          >
            {t('organizations.promoteConfirm')}
          </Button>
        </>
      }
    >
      <div className="promote-workspace">
        <div className="promote-workspace__field">
          <p className="promote-workspace__label">
            {t('organizations.promoteOrgLabel')}
          </p>
          {orgs.length === 0 ? (
            <p className="promote-workspace__empty">{t('organizations.promoteNoOrgs')}</p>
          ) : (
            <Select
              size="sm"
              value={orgSlug}
              options={orgOptions}
              disabled={busy}
              placeholder={t('organizations.promoteOrgPlaceholder')}
              aria-label={t('organizations.promoteOrgLabel')}
              onChange={setOrgSlug}
            />
          )}
        </div>

        <div className="promote-workspace__field">
          <label className="promote-workspace__label" htmlFor="promote-workspace-name">
            {t('organizations.promoteNameLabel')}
          </label>
          <Input
            id="promote-workspace-name"
            type="text"
            size="sm"
            value={workspaceName}
            disabled={busy}
            spellCheck={false}
            placeholder={t('organizations.workspaceNamePlaceholder')}
            aria-label={t('organizations.promoteNameLabel')}
            onChange={event => setWorkspaceName(event.target.value)}
          />
        </div>

        <div className="promote-workspace__field">
          <p className="promote-workspace__label" id="promote-workspace-repos-label">
            {t('organizations.promoteReposLabel')}
          </p>
          {repos.length === 0 ? (
            <p className="promote-workspace__empty">{t('organizations.promoteReposEmpty')}</p>
          ) : (
            <div
              className="promote-workspace__repos"
              role="group"
              aria-labelledby="promote-workspace-repos-label"
            >
              {repos.map(repo => {
                const checked = selectedPaths.includes(repo.path)
                return (
                  <ContextCheckOption
                    key={repo.path}
                    name={repo.name}
                    kindLabel={repo.repoFullName || undefined}
                    icon="git-branch"
                    appearance="panel"
                    checked={checked}
                    disabled={busy || !repo.hasRemote}
                    flag={repo.hasRemote ? undefined : t('organizations.promoteRepoNoRemote')}
                    title={repo.hasRemote
                      ? repo.name
                      : t('organizations.promoteRepoNoRemote')}
                    onChange={() => {
                      if (!repo.hasRemote) return
                      toggleRepo(repo.path)
                    }}
                  />
                )
              })}
            </div>
          )}
        </div>

        <div className="promote-workspace__notice">
          <p>{t('organizations.promoteNoticeStay')}</p>
          <p>{t('organizations.promoteNoticeSkip')}</p>
        </div>

        {busy && phase ? (
          <p className="promote-workspace__phase">{phaseLabel(phase)}</p>
        ) : null}
        {error ? <p className="promote-workspace__error">{error}</p> : null}
      </div>
    </TerminalModal>
  )
}
