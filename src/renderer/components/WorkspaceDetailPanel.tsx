import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useT } from '@i18n/useT'
import {
  getCovenantApi,
  hasCovenantWorkspaceReposApi,
  type CovenantWorkspace,
  type CovenantWorkspaceRepoRecord,
} from '../covenantApi'
import { SettingsField } from './SettingsSection'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Icon } from './ui/Icon'
import { SegmentedControl } from './ui/SegmentedControl'
import { MemberPickRow, SectionStatus } from './OrgSectionStatus'
import { GithubRepoPicker } from './GithubRepoPicker'
import type { GithubRepoOption } from '../../shared/githubRepoPicker'
import { normalizeRepoFullName, repoFullNameFromCloneUrl } from '../../shared/repoFullName'
import { workspacePeopleRows } from '../../shared/orgPeople'

/**
 * Columna de detalle de un workspace: cabecera + People + Repos, hermanas.
 * Sustituye al acordeón que anidaba estos bloques dentro de la lista.
 */

function WorkspacePeopleSection({
  assignees,
  admins,
  memberLogins,
  canManageAssignees,
  canManageProjectAdmins,
  parentBusy,
  onAssigneeAdd,
  onAssigneeRemove,
  onAdminAdd,
  onAdminRemove,
}: {
  assignees: string[]
  admins: string[]
  memberLogins: string[]
  canManageAssignees: boolean
  canManageProjectAdmins: boolean
  parentBusy: boolean
  onAssigneeAdd: (login: string) => void
  onAssigneeRemove: (login: string) => void
  onAdminAdd: (login: string) => void
  onAdminRemove: (login: string) => void
}): React.ReactElement {
  const { t } = useT()
  const [role, setRole] = useState<'user' | 'admin'>('user')
  const rows = useMemo(() => workspacePeopleRows(assignees, admins), [assignees, admins])
  const canManageRole = role === 'user' ? canManageAssignees : canManageProjectAdmins
  const taken = new Set(rows.map(row => row.login))
  const options = memberLogins.filter(login => !taken.has(login))
  const addLabel = role === 'user' ? t('organizations.addAssignee') : t('organizations.addAdmin')

  return (
    <section className="orgs-section" aria-label={t('organizations.peopleSection')}>
      <h3 className="orgs-section__title">{t('organizations.peopleSection')}</h3>
      {rows.length === 0 ? (
        <p className="orgs-empty">{t('organizations.noWorkspacePeople')}</p>
      ) : (
        <ul className="orgs-chips">
          {rows.map(row => {
            const isAdmin = row.role === 'admin'
            const canRemove = isAdmin ? canManageProjectAdmins : canManageAssignees
            return (
              <li key={row.login} className="orgs-chip">
                <span className="orgs-chip__avatar" aria-hidden>
                  {row.login.slice(0, 1).toUpperCase()}
                </span>
                <span className="orgs-chip__text">
                  <span className="orgs-chip__name">{row.login}</span>
                  <span className="orgs-chip__role">
                    {isAdmin ? t('organizations.roleAdmin') : t('organizations.assignee')}
                  </span>
                </span>
                {canRemove && !parentBusy ? (
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => (isAdmin ? onAdminRemove(row.login) : onAssigneeRemove(row.login))}
                    aria-label={`${t('organizations.unassign')}: ${row.login}`}
                  >
                    <Icon name="close" size={12} />
                  </Button>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
      {canManageAssignees || canManageProjectAdmins ? (
        <div className="orgs-add-people">
          <SegmentedControl
            size="sm"
            layout="hug"
            label={t('organizations.peopleSection')}
            value={role}
            disabled={parentBusy}
            onChange={setRole}
            options={[
              { value: 'user', label: t('organizations.roleUser'), disabled: !canManageAssignees },
              { value: 'admin', label: t('organizations.roleAdmin'), disabled: !canManageProjectAdmins },
            ]}
          />
          <MemberPickRow
            options={options}
            busy={parentBusy || !canManageRole}
            selectLabel={addLabel}
            addLabel={addLabel}
            onAdd={login => {
              if (role === 'user') onAssigneeAdd(login)
              else onAdminAdd(login)
            }}
          />
        </div>
      ) : null}
    </section>
  )
}

/** Meta de carpeta local en modo lectura (solo si hay folderName). */
function WorkspaceRepoFolderMeta({ folder }: { folder: string }): React.ReactElement {
  const { t } = useT()
  return (
    <p className="orgs-row__meta">{t('organizations.repoFolderNameMeta', { folder })}</p>
  )
}

/** Fila de repo vinculado: ver / editar folderName (solo gestores). */
function WorkspaceRepoRow({
  repo,
  canManage,
  canMutate,
  onSaveFolder,
  onRemove,
}: {
  repo: CovenantWorkspaceRepoRecord
  canManage: boolean
  canMutate: boolean
  onSaveFolder: (repoId: string, folderName: string) => Promise<boolean>
  onRemove: (repoId: string) => void
}): React.ReactElement {
  const { t } = useT()
  const [editing, setEditing] = useState(false)
  const folderName = repo.folderName?.trim() ?? ''
  const [folderDraft, setFolderDraft] = useState(folderName)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!editing) setFolderDraft(folderName)
  }, [editing, folderName])

  async function saveEdit(): Promise<void> {
    if (!canMutate || saving) return
    setSaving(true)
    const ok = await onSaveFolder(repo.id, folderDraft.trim())
    setSaving(false)
    if (ok) setEditing(false)
  }

  const actionsDisabled = !canMutate || saving

  return (
    <li className="orgs-row">
      <span className="orgs-row__icon" aria-hidden>
        <Icon name="git-branch" size={15} />
      </span>
      <div className="orgs-row__main">
        <p className="orgs-row__title">{repo.repoFullName}</p>
        {editing ? (
          <SettingsField label={t('organizations.repoFolderNameLabel')} compact>
            <Input
              type="text"
              size="sm"
              value={folderDraft}
              disabled={actionsDisabled}
              onChange={e => setFolderDraft(e.target.value)}
              placeholder={t('organizations.repoFolderNamePlaceholder')}
              spellCheck={false}
              aria-label={t('organizations.repoFolderNameLabel')}
            />
          </SettingsField>
        ) : folderName ? (
          <WorkspaceRepoFolderMeta folder={folderName} />
        ) : null}
      </div>
      {canManage ? (
        <div className="orgs-row__actions">
          {editing ? (
            <>
              <Button variant="primary" size="xs" disabled={actionsDisabled} onClick={() => void saveEdit()}>
                {t('common.save')}
              </Button>
              <Button
                variant="ghost"
                size="xs"
                disabled={actionsDisabled}
                onClick={() => {
                  setFolderDraft(folderName)
                  setEditing(false)
                }}
              >
                {t('common.cancel')}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="xs"
                disabled={actionsDisabled}
                onClick={() => {
                  setFolderDraft(folderName)
                  setEditing(true)
                }}
              >
                {t('organizations.editRepoFolder')}
              </Button>
              <Button
                variant="ghost"
                size="xs"
                disabled={actionsDisabled}
                onClick={() => onRemove(repo.id)}
              >
                <span className="orgs-danger-text">{t('organizations.removeRepo')}</span>
              </Button>
            </>
          )}
        </div>
      ) : null}
    </li>
  )
}

function WorkspaceReposSection({
  slug,
  workspaceId,
  canManage,
  parentBusy,
  accountId = '',
}: {
  slug: string
  workspaceId: string
  canManage: boolean
  parentBusy: boolean
  accountId?: string
}): React.ReactElement {
  const { t } = useT()
  const folderHintId = useId()
  const folderNameRef = useRef<HTMLInputElement>(null)
  const covenant = useMemo(() => getCovenantApi(accountId), [accountId])
  const available = hasCovenantWorkspaceReposApi(covenant)
  const [repos, setRepos] = useState<CovenantWorkspaceRepoRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [cloneUrlDraft, setCloneUrlDraft] = useState('')
  const [folderNameDraft, setFolderNameDraft] = useState('')
  const [pickedFullName, setPickedFullName] = useState('')
  const [manualOpen, setManualOpen] = useState(false)

  const loadRepos = useCallback(async (): Promise<void> => {
    if (!covenant || !available || !slug || !workspaceId) {
      setRepos([])
      return
    }
    setLoading(true)
    setError(null)
    const result = await covenant.workspaceReposList(slug, workspaceId)
    setLoading(false)
    if (!result.ok) {
      setRepos([])
      setError(result.error)
      return
    }
    setRepos(result.data)
  }, [available, covenant, slug, workspaceId])

  useEffect(() => {
    void loadRepos()
  }, [loadRepos])

  // El formulario se colapsa al cambiar de workspace: su borrador no aplica al siguiente.
  useEffect(() => {
    setAdding(false)
    setCloneUrlDraft('')
    setFolderNameDraft('')
    setPickedFullName('')
    setManualOpen(false)
  }, [workspaceId])

  const canMutate = available && canManage && !busy && !parentBusy
  const cloneUrl = cloneUrlDraft.trim()
  const derivedFullName = pickedFullName
    ? normalizeRepoFullName(pickedFullName)
    : repoFullNameFromCloneUrl(cloneUrl)
  const isDuplicate = Boolean(
    derivedFullName
    && repos.some(repo => normalizeRepoFullName(repo.repoFullName) === derivedFullName),
  )
  const canAdd = canMutate && cloneUrl.length > 0 && !isDuplicate

  function handlePick(repo: GithubRepoOption): void {
    setCloneUrlDraft(repo.cloneUrl)
    setPickedFullName(repo.fullName)
    setManualOpen(true)
    setError(null)
    window.requestAnimationFrame(() => folderNameRef.current?.focus())
  }

  async function handleAdd(): Promise<void> {
    if (!covenant || !canMutate || cloneUrl.length === 0) return
    const fullName = pickedFullName
      ? normalizeRepoFullName(pickedFullName)
      : repoFullNameFromCloneUrl(cloneUrl)
    if (!fullName) {
      setError(t('organizations.repoUrlInvalid'))
      return
    }
    if (isDuplicate || repos.some(repo => normalizeRepoFullName(repo.repoFullName) === fullName)) {
      setError(t('organizations.repoDuplicate'))
      return
    }
    setBusy(true)
    setError(null)
    const folderName = folderNameDraft.trim()
    const result = await covenant.workspaceRepoAdd(slug, workspaceId, {
      repoFullName: fullName,
      cloneUrl,
      ...(folderName ? { folderName } : {}),
    })
    setBusy(false)
    if (!result.ok) {
      const err = result.error.toLowerCase()
      setError(
        err.includes('already linked') || err.includes('conflict')
          ? t('organizations.repoDuplicate')
          : result.error,
      )
      return
    }
    setCloneUrlDraft('')
    setFolderNameDraft('')
    setPickedFullName('')
    setManualOpen(false)
    setAdding(false)
    await loadRepos()
  }

  async function handleUpdateFolder(repoId: string, folderName: string): Promise<boolean> {
    if (!covenant || !canMutate) return false
    setBusy(true)
    setError(null)
    const result = await covenant.workspaceRepoUpdate(slug, workspaceId, repoId, { folderName })
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return false
    }
    // Refleja la carpeta guardada de inmediato; loadRepos confirma contra el listado.
    setRepos(prev => prev.map(repo => (repo.id === repoId ? result.data : repo)))
    await loadRepos()
    return true
  }

  async function handleRemove(repoId: string): Promise<void> {
    if (!covenant || !canMutate) return
    setBusy(true)
    setError(null)
    const result = await covenant.workspaceRepoDelete(slug, workspaceId, repoId)
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    await loadRepos()
  }

  return (
    <section className="orgs-section" aria-label={t('organizations.reposTab')}>
      <div className="orgs-section__head">
        <h3 className="orgs-section__title">{t('organizations.reposTab')}</h3>
        {available && canManage ? (
          <Button
            variant="secondary"
            size="xs"
            pressed={adding}
            disabled={busy || parentBusy}
            onClick={() => setAdding(prev => !prev)}
          >
            {t('organizations.addRepo')}
          </Button>
        ) : null}
      </div>
      <SectionStatus loading={loading} error={error} loadingLabel={t('organizations.loading')} />
      {!available ? (
        <p className="orgs-empty">{t('organizations.unavailable')}</p>
      ) : (
        <>
          {adding && canManage ? (
            <div className="orgs-inline-form">
              <GithubRepoPicker
                accountId={accountId}
                disabled={!canMutate}
                excludeFullNames={repos.map(repo => repo.repoFullName)}
                onPick={handlePick}
              />
              <details
                className="orgs-inline-form__manual"
                open={manualOpen}
                onToggle={event => setManualOpen((event.currentTarget as HTMLDetailsElement).open)}
              >
                <summary className="orgs-inline-form__manual-summary">
                  {t('organizations.repoPickerManual')}
                </summary>
                <div className="orgs-inline-form__row">
                  <div className="orgs-inline-form__grow">
                    <SettingsField label={t('organizations.addRepo')} compact>
                      <Input
                        type="text"
                        size="sm"
                        value={cloneUrlDraft}
                        disabled={!canMutate}
                        onChange={e => {
                          setCloneUrlDraft(e.target.value)
                          setPickedFullName('')
                        }}
                        placeholder={t('organizations.repoCloneUrlPlaceholder')}
                        spellCheck={false}
                        aria-label={t('organizations.repoCloneUrlPlaceholder')}
                      />
                    </SettingsField>
                  </div>
                </div>
              </details>
              <div className="orgs-inline-form__row">
                <div className="orgs-inline-form__grow">
                  <SettingsField label={t('organizations.repoFolderNameLabel')} compact>
                    <Input
                      ref={folderNameRef}
                      type="text"
                      size="sm"
                      value={folderNameDraft}
                      disabled={!canMutate}
                      onChange={e => setFolderNameDraft(e.target.value)}
                      placeholder={t('organizations.repoFolderNamePlaceholder')}
                      spellCheck={false}
                      aria-label={t('organizations.repoFolderNameLabel')}
                      aria-describedby={folderHintId}
                    />
                  </SettingsField>
                </div>
                <Button variant="primary" size="sm" disabled={!canAdd} onClick={() => void handleAdd()}>
                  {t('organizations.addRepo')}
                </Button>
              </div>
              <p id={folderHintId} className="orgs-row__meta">
                {t('organizations.repoFolderNameHint')}
              </p>
            </div>
          ) : null}
          {repos.length === 0 && !loading ? (
            <p className="orgs-empty">{t('organizations.reposEmpty')}</p>
          ) : (
            <ul className="orgs-rows">
              {repos.map(repo => (
                <WorkspaceRepoRow
                  key={repo.id}
                  repo={repo}
                  canManage={canManage}
                  canMutate={canMutate}
                  onSaveFolder={handleUpdateFolder}
                  onRemove={repoId => void handleRemove(repoId)}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}

export function WorkspaceDetailPanel({
  slug,
  workspace,
  accountId = '',
  memberLogins,
  canManageAssignees,
  canManageProjectAdmins,
  canDelete,
  busy,
  openBusy,
  openError,
  onOpenRequest,
  onDeleteRequest,
  onAssigneeAdd,
  onAssigneeRemove,
  onAdminAdd,
  onAdminRemove,
}: {
  slug: string
  workspace: CovenantWorkspace
  accountId?: string
  memberLogins: string[]
  canManageAssignees: boolean
  canManageProjectAdmins: boolean
  canDelete: boolean
  busy: boolean
  openBusy: boolean
  openError: string | null
  onOpenRequest: () => void
  onDeleteRequest: (workspace: CovenantWorkspace) => void
  onAssigneeAdd: (login: string) => void
  onAssigneeRemove: (login: string) => void
  onAdminAdd: (login: string) => void
  onAdminRemove: (login: string) => void
}): React.ReactElement {
  const { t } = useT()
  const peopleCount = workspacePeopleRows(workspace.assignees, workspace.admins).length

  return (
    <section className="orgs-panel" aria-label={workspace.name}>
      <header className="orgs-panel__head">
        <div className="orgs-panel__title-block">
          <h2 className="orgs-panel__title">{workspace.name}</h2>
          <p className="orgs-panel__meta">
            {`${slug} / ${workspace.name} · ${t('organizations.workspacePeopleCount', { count: peopleCount })}`}
          </p>
        </div>
        <Button variant="primary" size="xs" disabled={openBusy || busy} onClick={onOpenRequest}>
          {t('organizations.openAsTab')}
        </Button>
        {canDelete ? (
          <Button variant="ghost" size="xs" disabled={busy} onClick={() => onDeleteRequest(workspace)}>
            <span className="orgs-danger-text">{t('organizations.deleteWorkspace')}</span>
          </Button>
        ) : null}
      </header>
      <div className="orgs-panel__body">
        <SectionStatus loading={false} error={openError} loadingLabel={t('organizations.loading')} />
        <WorkspacePeopleSection
          assignees={workspace.assignees}
          admins={workspace.admins}
          memberLogins={memberLogins}
          canManageAssignees={canManageAssignees}
          canManageProjectAdmins={canManageProjectAdmins}
          parentBusy={busy}
          onAssigneeAdd={onAssigneeAdd}
          onAssigneeRemove={onAssigneeRemove}
          onAdminAdd={onAdminAdd}
          onAdminRemove={onAdminRemove}
        />
        <WorkspaceReposSection
          slug={slug}
          workspaceId={workspace.id}
          canManage={canManageAssignees}
          parentBusy={busy}
          accountId={accountId}
        />
      </div>
    </section>
  )
}
