import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useT } from '@i18n/useT'
import {
  getCovenantApi,
  hasCovenantMemberLoginsApi,
  hasCovenantOrgAdminsApi,
  hasCovenantWorkspacesApi,
  slugifyOrgName,
  type CovenantAuthStatus,
  type CovenantDefault,
  type CovenantMember,
  type CovenantOrg,
  type CovenantWorkspace,
} from '../covenantApi'
import { TerminalModal } from './TerminalModal'
import { ConfirmTerminalModal } from './ConfirmTerminalModal'
import { SettingsSection, SettingsField } from './SettingsSection'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Select } from './ui/Select'
import { Spinner } from './ui/Spinner'
import { Badge } from './ui/Badge'
import { Icon } from './ui/Icon'
import './SettingsModal.css'
import './OrganizationsModal.css'

interface Props {
  open?: boolean
  onClose: () => void
}

function mapCovenantAuthError(error: string, translate: (key: 'organizations.errorNoGithubToken') => string): string {
  if (error === 'no-github-token') return translate('organizations.errorNoGithubToken')
  return error
}

function isForbiddenError(error: string): boolean {
  const normalized = error.toLowerCase()
  return (
    normalized.includes('403')
    || normalized.includes('forbidden')
    || normalized.includes('not allowed')
    || normalized.includes('permission denied')
    || normalized.includes('insufficient permission')
  )
}

function errorMessageFromUnknown(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'status' in err) {
    const status = (err as { status: unknown }).status
    if (typeof status === 'number') {
      const message = err instanceof Error ? err.message : fallback
      return `${status} ${message}`
    }
  }
  if (err instanceof Error) return err.message || fallback
  const asString = String(err)
  return asString || fallback
}

/** Captura rejects y conserva el shape {ok,data}|{ok,error} para loadOrgDetails. */
async function settleCovenantResult<T>(
  promise: Promise<{ ok: true; data: T } | { ok: false; error: string }>,
  fallbackError: string,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    return await promise
  } catch (err) {
    return { ok: false, error: errorMessageFromUnknown(err, fallbackError) }
  }
}

/** Owner desde org.role (orgsList); admin = owner, role admin, o login ∈ orgAdmins. */
function resolveOrgPermissions(opts: {
  orgRole: string | undefined
  currentLogin: string
  orgAdmins: string[]
}): { isOwner: boolean; isAdmin: boolean; canManageMembers: boolean } {
  const isOwner = opts.orgRole === 'owner'
  const isAdmin = isOwner
    || opts.orgRole === 'admin'
    || (opts.currentLogin.length > 0 && opts.orgAdmins.includes(opts.currentLogin))
  return { isOwner, isAdmin, canManageMembers: isAdmin }
}

/**
 * Borrado: owner o creador.
 * TODO(backend): devolver createdBy como login (JOIN users); createdById es fallback.
 */
function canDeleteOwnedItem(opts: {
  isOwner: boolean
  currentLogin: string
  currentGithubId?: string | number
  createdBy?: string
  createdById?: string | number
}): boolean {
  if (opts.isOwner) return true
  if (opts.createdBy && opts.currentLogin && opts.createdBy === opts.currentLogin) return true
  if (
    opts.createdById != null
    && opts.currentGithubId != null
    && String(opts.createdById) === String(opts.currentGithubId)
  ) {
    return true
  }
  return false
}

function SectionStatus({
  loading,
  error,
  loadingLabel,
}: {
  loading: boolean
  error: string | null
  loadingLabel: string
}): React.ReactElement | null {
  if (loading) {
    return (
      <p className="orgs-section-status">
        <Spinner aria-label={loadingLabel} /> {loadingLabel}
      </p>
    )
  }
  if (error) return <p className="orgs-section-error">{error}</p>
  return null
}

function AuthSection({
  available,
  status,
  loading,
  error,
  busy,
  onSignIn,
  onSignOut,
}: {
  available: boolean
  status: CovenantAuthStatus | null
  loading: boolean
  error: string | null
  busy: boolean
  onSignIn: () => void
  onSignOut: () => void
}): React.ReactElement {
  const { t } = useT()
  const signedIn = status?.signedIn === true
  const login = status?.login?.trim() || ''
  const initial = (login || '?').slice(0, 1).toUpperCase()

  return (
    <SettingsSection title={t('organizations.authSection')}>
      <div className="orgs-stack">
        <SectionStatus loading={loading} error={error} loadingLabel={t('organizations.loading')} />
        {!available ? (
          <p className="orgs-empty">{t('organizations.unavailable')}</p>
        ) : signedIn ? (
          <div className="orgs-auth">
            {status?.avatarUrl ? (
              <img
                className="orgs-auth__avatar"
                src={status.avatarUrl}
                alt=""
                width={32}
                height={32}
              />
            ) : (
              <span className="orgs-auth__avatar orgs-auth__avatar--placeholder" aria-hidden>
                {initial}
              </span>
            )}
            <div className="orgs-auth__meta">
              <p className="orgs-auth__login">{login || t('organizations.signedIn')}</p>
              {status?.name ? <p className="orgs-auth__hint">{status.name}</p> : null}
            </div>
            <Button variant="secondary" size="sm" disabled={busy} onClick={onSignOut}>
              {t('organizations.signOut')}
            </Button>
          </div>
        ) : (
          <div className="orgs-auth">
            <div className="orgs-auth__meta">
              <p className="orgs-auth__login">{t('organizations.signInPrompt')}</p>
              <p className="orgs-auth__hint">{t('organizations.signInHint')}</p>
            </div>
            <Button variant="primary" size="sm" disabled={busy || loading} onClick={onSignIn}>
              {t('organizations.signIn')}
            </Button>
          </div>
        )}
      </div>
    </SettingsSection>
  )
}

function OrgsSection({
  available,
  signedIn,
  orgs,
  loading,
  error,
  busy,
  createName,
  onCreateNameChange,
  onOpenOrg,
  onCreate,
}: {
  available: boolean
  signedIn: boolean
  orgs: CovenantOrg[]
  loading: boolean
  error: string | null
  busy: boolean
  createName: string
  onCreateNameChange: (value: string) => void
  onOpenOrg: (slug: string) => void
  onCreate: () => void
}): React.ReactElement {
  const { t } = useT()
  const slug = slugifyOrgName(createName)
  const canCreate = available && signedIn && slug.length > 0 && !busy

  return (
    <SettingsSection title={t('organizations.orgsSection')}>
      <div className="orgs-stack">
        <SectionStatus loading={loading} error={error} loadingLabel={t('organizations.loading')} />
        {!available ? (
          <p className="orgs-empty">{t('organizations.unavailable')}</p>
        ) : !signedIn ? (
          <p className="orgs-empty">{t('organizations.signInRequired')}</p>
        ) : (
          <>
            {orgs.length === 0 && !loading ? (
              <p className="orgs-empty">{t('organizations.noOrgs')}</p>
            ) : null}
            {orgs.length > 0 ? (
              <ul className="orgs-list">
                {orgs.map(org => (
                  <li key={org.slug} className="orgs-list__item orgs-list__item--org">
                    <button
                      type="button"
                      className="orgs-list__open"
                      disabled={busy}
                      onClick={() => onOpenOrg(org.slug)}
                      aria-label={t('organizations.openOrg')}
                    >
                      <span className="orgs-list__main">
                        <span className="orgs-list__title">
                          {org.name} ({org.slug})
                        </span>
                      </span>
                      {org.role ? <Badge variant="muted">{org.role}</Badge> : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="orgs-form-row">
              <div className="orgs-form-row__grow">
                <SettingsField label={t('organizations.orgName')}>
                  <Input
                    type="text"
                    size="sm"
                    value={createName}
                    disabled={busy}
                    onChange={e => onCreateNameChange(e.target.value)}
                    placeholder={t('organizations.orgNamePlaceholder')}
                    spellCheck={false}
                  />
                </SettingsField>
              </div>
              <Button variant="primary" size="sm" disabled={!canCreate} onClick={onCreate}>
                {t('organizations.createOrg')}
              </Button>
            </div>
            <p className="orgs-slug">
              {t('organizations.slugLabel')}: {slug || '—'}
            </p>
          </>
        )}
      </div>
    </SettingsSection>
  )
}

function MembersSection({
  available,
  signedIn,
  activeSlug,
  canManageMembers,
  membersForbidden,
  members,
  loading,
  error,
  busy,
  loginDraft,
  onLoginDraftChange,
  onAdd,
  onRemove,
}: {
  available: boolean
  signedIn: boolean
  activeSlug: string
  canManageMembers: boolean
  membersForbidden: boolean
  members: CovenantMember[]
  loading: boolean
  error: string | null
  busy: boolean
  loginDraft: string
  onLoginDraftChange: (value: string) => void
  onAdd: () => void
  onRemove: (login: string) => void
}): React.ReactElement {
  const { t } = useT()
  const canMutate = available && signedIn && !!activeSlug && canManageMembers && !busy
  const canAdd = canMutate && loginDraft.trim().length > 0
  const showError = error && !membersForbidden

  return (
    <SettingsSection title={t('organizations.membersSection')}>
      <div className="orgs-stack">
        <SectionStatus
          loading={loading}
          error={showError ? error : null}
          loadingLabel={t('organizations.loading')}
        />
        {!available ? (
          <p className="orgs-empty">{t('organizations.unavailable')}</p>
        ) : !signedIn ? (
          <p className="orgs-empty">{t('organizations.signInRequired')}</p>
        ) : !activeSlug ? (
          <p className="orgs-empty">{t('organizations.selectOrg')}</p>
        ) : membersForbidden || !canManageMembers ? (
          <p className="orgs-empty">{t('organizations.membersAdminsOnly')}</p>
        ) : (
          <>
            <div className="orgs-form-row">
              <div className="orgs-form-row__grow">
                <SettingsField label={t('organizations.memberLogin')}>
                  <Input
                    type="text"
                    size="sm"
                    value={loginDraft}
                    disabled={!canMutate}
                    onChange={e => onLoginDraftChange(e.target.value)}
                    placeholder={t('organizations.memberLoginPlaceholder')}
                    spellCheck={false}
                  />
                </SettingsField>
              </div>
              <Button variant="primary" size="sm" disabled={!canAdd} onClick={onAdd}>
                {t('organizations.addMember')}
              </Button>
            </div>
            {members.length === 0 && !loading ? (
              <p className="orgs-empty">{t('organizations.noMembers')}</p>
            ) : (
              <ul className="orgs-list">
                {members.map(member => (
                  <li key={member.login} className="orgs-list__item">
                    {member.avatarUrl ? (
                      <img
                        className="orgs-auth__avatar"
                        src={member.avatarUrl}
                        alt=""
                        width={32}
                        height={32}
                      />
                    ) : null}
                    <div className="orgs-list__main">
                      <p className="orgs-list__title">{member.login}</p>
                      {member.role ? (
                        <p className="orgs-list__meta">
                          <Badge variant="muted">{member.role}</Badge>
                        </p>
                      ) : null}
                    </div>
                    {canManageMembers ? (
                      <Button
                        variant="danger"
                        size="xs"
                        disabled={!canMutate}
                        onClick={() => onRemove(member.login)}
                      >
                        {t('organizations.removeMember')}
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </SettingsSection>
  )
}

function DefaultsSection({
  available,
  signedIn,
  activeSlug,
  canCreate,
  canDeleteItem,
  defaults,
  loading,
  error,
  busy,
  kindDraft,
  nameDraft,
  onKindDraftChange,
  onNameDraftChange,
  onSet,
  onUnset,
}: {
  available: boolean
  signedIn: boolean
  activeSlug: string
  canCreate: boolean
  canDeleteItem: (item: CovenantDefault) => boolean
  defaults: CovenantDefault[]
  loading: boolean
  error: string | null
  busy: boolean
  kindDraft: string
  nameDraft: string
  onKindDraftChange: (value: string) => void
  onNameDraftChange: (value: string) => void
  onSet: () => void
  onUnset: (kind: string, name: string) => void
}): React.ReactElement {
  const { t } = useT()
  const canMutateCreate = available && signedIn && !!activeSlug && canCreate && !busy
  const canSet = canMutateCreate && kindDraft.trim().length > 0 && nameDraft.trim().length > 0

  return (
    <SettingsSection title={t('organizations.globalContexts')}>
      <div className="orgs-stack">
        <SectionStatus loading={loading} error={error} loadingLabel={t('organizations.loading')} />
        {!available ? (
          <p className="orgs-empty">{t('organizations.unavailable')}</p>
        ) : !signedIn ? (
          <p className="orgs-empty">{t('organizations.signInRequired')}</p>
        ) : !activeSlug ? (
          <p className="orgs-empty">{t('organizations.selectOrg')}</p>
        ) : (
          <>
            {canCreate ? (
              <div className="orgs-form-row">
                <div className="orgs-form-row__grow">
                  <SettingsField label={t('organizations.defaultKind')}>
                    <Input
                      type="text"
                      size="sm"
                      value={kindDraft}
                      disabled={!canMutateCreate}
                      onChange={e => onKindDraftChange(e.target.value)}
                      placeholder={t('organizations.defaultKindPlaceholder')}
                      spellCheck={false}
                    />
                  </SettingsField>
                </div>
                <div className="orgs-form-row__grow">
                  <SettingsField label={t('organizations.defaultName')}>
                    <Input
                      type="text"
                      size="sm"
                      value={nameDraft}
                      disabled={!canMutateCreate}
                      onChange={e => onNameDraftChange(e.target.value)}
                      placeholder={t('organizations.defaultNamePlaceholder')}
                      spellCheck={false}
                    />
                  </SettingsField>
                </div>
                <Button variant="primary" size="sm" disabled={!canSet} onClick={onSet}>
                  {t('organizations.setDefault')}
                </Button>
              </div>
            ) : null}
            {defaults.length === 0 && !loading ? (
              <p className="orgs-empty">{t('organizations.noDefaults')}</p>
            ) : (
              <ul className="orgs-list">
                {defaults.map(item => {
                  const canDelete = canDeleteItem(item) && !busy
                  return (
                    <li key={`${item.kind}:${item.name}`} className="orgs-list__item">
                      <div className="orgs-list__main">
                        <p className="orgs-list__title">{item.name}</p>
                        <p className="orgs-list__meta">{item.kind}</p>
                      </div>
                      {canDelete ? (
                        <Button
                          variant="danger"
                          size="xs"
                          disabled={busy}
                          onClick={() => onUnset(item.kind, item.name)}
                        >
                          {t('organizations.unsetDefault')}
                        </Button>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            )}
          </>
        )}
      </div>
    </SettingsSection>
  )
}

function LoginChips({
  logins,
  busy,
  emptyLabel,
  removeLabel,
  onRemove,
}: {
  logins: string[]
  busy: boolean
  emptyLabel: string
  removeLabel: string
  onRemove: (login: string) => void
}): React.ReactElement {
  if (logins.length === 0) {
    return <p className="orgs-list__meta">{emptyLabel}: —</p>
  }
  return (
    <div className="orgs-assignees">
      {logins.map(login => (
        <span key={login} className="orgs-assignee">
          <Badge variant="muted">{login}</Badge>
          <Button
            variant="ghost"
            size="xs"
            disabled={busy}
            onClick={() => onRemove(login)}
            title={removeLabel}
            aria-label={removeLabel}
          >
            <Icon name="close" size={12} />
          </Button>
        </span>
      ))}
    </div>
  )
}

function MemberPickRow({
  options,
  busy,
  selectLabel,
  addLabel,
  onAdd,
}: {
  options: string[]
  busy: boolean
  selectLabel: string
  addLabel: string
  onAdd: (login: string) => void
}): React.ReactElement {
  const [login, setLogin] = useState('')
  const selected = options.includes(login) ? login : (options[0] ?? '')
  const canAdd = !busy && !!selected && options.length > 0

  return (
    <div className="orgs-form-row">
      <div className="orgs-form-row__grow">
        <Select
          size="sm"
          value={selected}
          disabled={busy || options.length === 0}
          onChange={setLogin}
          aria-label={selectLabel}
          placeholder={selectLabel}
          options={options.map(opt => ({ value: opt, label: opt }))}
        />
      </div>
      <Button
        variant="secondary"
        size="sm"
        disabled={!canAdd}
        onClick={() => {
          if (!selected) return
          onAdd(selected)
        }}
      >
        {addLabel}
      </Button>
    </div>
  )
}

function OrgAdminsSection({
  available,
  signedIn,
  activeSlug,
  members,
  admins,
  loading,
  error,
  busy,
  onAdd,
  onRemove,
}: {
  available: boolean
  signedIn: boolean
  activeSlug: string
  members: CovenantMember[]
  admins: string[]
  loading: boolean
  error: string | null
  busy: boolean
  onAdd: (login: string) => void
  onRemove: (login: string) => void
}): React.ReactElement {
  const { t } = useT()
  const canMutate = available && signedIn && !!activeSlug && !busy
  const adminSet = new Set(admins)
  const options = members.map(m => m.login).filter(login => !adminSet.has(login))

  return (
    <SettingsSection title={t('organizations.orgAdminsSection')}>
      <div className="orgs-stack">
        <SectionStatus loading={loading} error={error} loadingLabel={t('organizations.loading')} />
        {!available ? (
          <p className="orgs-empty">{t('organizations.unavailable')}</p>
        ) : !signedIn ? (
          <p className="orgs-empty">{t('organizations.signInRequired')}</p>
        ) : !activeSlug ? (
          <p className="orgs-empty">{t('organizations.selectOrg')}</p>
        ) : (
          <>
            <LoginChips
              logins={admins}
              busy={!canMutate}
              emptyLabel={t('organizations.orgAdminsSection')}
              removeLabel={t('organizations.removeAdmin')}
              onRemove={onRemove}
            />
            <MemberPickRow
              options={options}
              busy={!canMutate}
              selectLabel={t('organizations.addAdmin')}
              addLabel={t('organizations.addAdmin')}
              onAdd={onAdd}
            />
          </>
        )}
      </div>
    </SettingsSection>
  )
}

function ProjectPeopleBlock({
  title,
  logins,
  memberLogins,
  busy,
  addLabel,
  removeLabel,
  onAdd,
  onRemove,
}: {
  title: string
  logins: string[]
  memberLogins: string[]
  busy: boolean
  addLabel: string
  removeLabel: string
  onAdd: (login: string) => void
  onRemove: (login: string) => void
}): React.ReactElement {
  const taken = new Set(logins)
  const options = memberLogins.filter(login => !taken.has(login))
  return (
    <div className="orgs-stack">
      <p className="orgs-list__meta">{title}</p>
      <LoginChips
        logins={logins}
        busy={busy}
        emptyLabel={title}
        removeLabel={removeLabel}
        onRemove={onRemove}
      />
      <MemberPickRow
        options={options}
        busy={busy}
        selectLabel={addLabel}
        addLabel={addLabel}
        onAdd={onAdd}
      />
    </div>
  )
}

function WorkspacesSection({
  available,
  signedIn,
  activeSlug,
  canCreate,
  canDeleteWorkspace,
  isOrgAdmin,
  currentLogin,
  memberLogins,
  workspaces,
  loading,
  error,
  busy,
  nameDraft,
  onNameDraftChange,
  onCreate,
  onDeleteRequest,
  onAssigneeAdd,
  onAssigneeRemove,
  onAdminAdd,
  onAdminRemove,
}: {
  available: boolean
  signedIn: boolean
  activeSlug: string
  canCreate: boolean
  canDeleteWorkspace: (workspace: CovenantWorkspace) => boolean
  isOrgAdmin: boolean
  currentLogin: string
  memberLogins: string[]
  workspaces: CovenantWorkspace[]
  loading: boolean
  error: string | null
  busy: boolean
  nameDraft: string
  onNameDraftChange: (value: string) => void
  onCreate: () => void
  onDeleteRequest: (workspace: CovenantWorkspace) => void
  onAssigneeAdd: (workspaceId: string, login: string) => void
  onAssigneeRemove: (workspaceId: string, login: string) => void
  onAdminAdd: (workspaceId: string, login: string) => void
  onAdminRemove: (workspaceId: string, login: string) => void
}): React.ReactElement {
  const { t } = useT()
  const canMutate = available && signedIn && !!activeSlug && !busy
  const canMutateCreate = canMutate && canCreate
  const canCreateSubmit = canMutateCreate && nameDraft.trim().length > 0

  return (
    <SettingsSection title={t('organizations.workspacesSection')}>
      <div className="orgs-stack">
        <SectionStatus loading={loading} error={error} loadingLabel={t('organizations.loading')} />
        {!available ? (
          <p className="orgs-empty">{t('organizations.unavailable')}</p>
        ) : !signedIn ? (
          <p className="orgs-empty">{t('organizations.signInRequired')}</p>
        ) : !activeSlug ? (
          <p className="orgs-empty">{t('organizations.selectOrg')}</p>
        ) : (
          <>
            {canCreate ? (
              <div className="orgs-form-row">
                <div className="orgs-form-row__grow">
                  <SettingsField label={t('organizations.workspaceName')}>
                    <Input
                      type="text"
                      size="sm"
                      value={nameDraft}
                      disabled={!canMutateCreate}
                      onChange={e => onNameDraftChange(e.target.value)}
                      placeholder={t('organizations.workspaceNamePlaceholder')}
                      spellCheck={false}
                    />
                  </SettingsField>
                </div>
                <Button variant="primary" size="sm" disabled={!canCreateSubmit} onClick={onCreate}>
                  {t('organizations.createWorkspace')}
                </Button>
              </div>
            ) : null}
            {workspaces.length === 0 && !loading ? (
              <p className="orgs-empty">{t('organizations.noWorkspaces')}</p>
            ) : (
              <ul className="orgs-list">
                {workspaces.map(project => {
                  const showDelete = canDeleteWorkspace(project) && canMutate
                  const isCreator = !!currentLogin && project.createdBy === currentLogin
                  const isProjectAdmin = !!currentLogin && project.admins.includes(currentLogin)
                  const canManageAssignees = isOrgAdmin || isCreator || isProjectAdmin
                  const canManageProjectAdmins = isOrgAdmin || isCreator
                  return (
                    <li key={project.id} className="orgs-list__item orgs-list__item--workspace">
                      <div className="orgs-list__main">
                        <p className="orgs-list__title">{project.name}</p>
                        <ProjectPeopleBlock
                          title={t('organizations.assignees')}
                          logins={project.assignees}
                          memberLogins={memberLogins}
                          busy={!canMutate || !canManageAssignees}
                          addLabel={t('organizations.addAssignee')}
                          removeLabel={t('organizations.unassign')}
                          onAdd={login => onAssigneeAdd(project.id, login)}
                          onRemove={login => onAssigneeRemove(project.id, login)}
                        />
                        <ProjectPeopleBlock
                          title={t('organizations.workspaceAdmins')}
                          logins={project.admins}
                          memberLogins={memberLogins}
                          busy={!canMutate || !canManageProjectAdmins}
                          addLabel={t('organizations.addAdmin')}
                          removeLabel={t('organizations.removeAdmin')}
                          onAdd={login => onAdminAdd(project.id, login)}
                          onRemove={login => onAdminRemove(project.id, login)}
                        />
                      </div>
                      {showDelete ? (
                        <Button
                          variant="danger"
                          size="xs"
                          disabled={!canMutate}
                          onClick={() => onDeleteRequest(project)}
                        >
                          {t('organizations.deleteWorkspace')}
                        </Button>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            )}
          </>
        )}
      </div>
    </SettingsSection>
  )
}

function OrgDetailModal({
  open,
  org,
  signedIn,
  isOrgAdmin,
  canLeave,
  leaveError,
  leaveBusy,
  leaveOpen,
  onClose,
  onLeaveClick,
  onLeaveConfirm,
  onLeaveCancel,
  deleteWorkspace,
  onDeleteWorkspaceConfirm,
  onDeleteWorkspaceCancel,
  membersProps,
  orgAdminsProps,
  workspacesProps,
  defaultsProps,
}: {
  open: boolean
  org: CovenantOrg | null
  signedIn: boolean
  isOrgAdmin: boolean
  canLeave: boolean
  leaveError: string | null
  leaveBusy: boolean
  leaveOpen: boolean
  onClose: () => void
  onLeaveClick: () => void
  onLeaveConfirm: () => void
  onLeaveCancel: () => void
  deleteWorkspace: CovenantWorkspace | null
  onDeleteWorkspaceConfirm: () => void
  onDeleteWorkspaceCancel: () => void
  membersProps: React.ComponentProps<typeof MembersSection>
  orgAdminsProps: React.ComponentProps<typeof OrgAdminsSection>
  workspacesProps: React.ComponentProps<typeof WorkspacesSection>
  defaultsProps: React.ComponentProps<typeof DefaultsSection>
}): React.ReactElement {
  const { t } = useT()
  const name = org?.name ?? t('organizations.orgDetailTitle')

  return (
    <>
      <TerminalModal
        open={open}
        onClose={onClose}
        title={name}
        size="md"
        zIndex={740}
        bodyLayout="spacious"
        closeOnBackdrop
        footer={
          <>
            {signedIn && org ? (
              <Button
                variant="danger"
                size="sm"
                disabled={!canLeave || leaveBusy}
                onClick={onLeaveClick}
              >
                {t('organizations.leaveOrg')}
              </Button>
            ) : null}
            <Button variant="secondary" size="sm" onClick={onClose}>
              {t('common.cancel')}
            </Button>
          </>
        }
      >
        <div className="orgs-modal-body">
          {leaveError ? <p className="orgs-section-error">{leaveError}</p> : null}
          {isOrgAdmin ? <MembersSection {...membersProps} /> : null}
          {isOrgAdmin ? <OrgAdminsSection {...orgAdminsProps} /> : null}
          <WorkspacesSection {...workspacesProps} />
          <DefaultsSection {...defaultsProps} />
        </div>
      </TerminalModal>

      <ConfirmTerminalModal
        open={leaveOpen}
        zIndex={760}
        message={t('organizations.leaveConfirm', { name })}
        detail={t('organizations.leaveConfirmDetail')}
        onConfirm={onLeaveConfirm}
        onCancel={onLeaveCancel}
      />

      <ConfirmTerminalModal
        open={deleteWorkspace != null}
        zIndex={760}
        message={t('organizations.deleteWorkspaceConfirm', { name: deleteWorkspace?.name ?? '' })}
        onConfirm={onDeleteWorkspaceConfirm}
        onCancel={onDeleteWorkspaceCancel}
      />
    </>
  )
}

export const OrganizationsModal: React.FC<Props> = ({ open = true, onClose }) => {
  const { t } = useT()
  const covenant = useMemo(() => getCovenantApi(), [])
  const available = covenant != null

  const [auth, setAuth] = useState<CovenantAuthStatus | null>(null)
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [authBusy, setAuthBusy] = useState(false)

  const [orgs, setOrgs] = useState<CovenantOrg[]>([])
  const [orgsLoading, setOrgsLoading] = useState(false)
  const [orgsError, setOrgsError] = useState<string | null>(null)
  const [orgsBusy, setOrgsBusy] = useState(false)
  const [activeSlug, setActiveSlug] = useState('')
  const [detailSlug, setDetailSlug] = useState<string | null>(null)
  const [createName, setCreateName] = useState('')

  const [members, setMembers] = useState<CovenantMember[]>([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [membersError, setMembersError] = useState<string | null>(null)
  const [membersForbidden, setMembersForbidden] = useState(false)
  const [membersBusy, setMembersBusy] = useState(false)
  const [memberLogin, setMemberLogin] = useState('')

  const [defaults, setDefaults] = useState<CovenantDefault[]>([])
  const [defaultsLoading, setDefaultsLoading] = useState(false)
  const [defaultsError, setDefaultsError] = useState<string | null>(null)
  const [defaultsBusy, setDefaultsBusy] = useState(false)
  const [defaultKind, setDefaultKind] = useState('')
  const [defaultName, setDefaultName] = useState('')

  const [workspaces, setWorkspaces] = useState<CovenantWorkspace[]>([])
  const [workspacesLoading, setWorkspacesLoading] = useState(false)
  const [workspacesError, setWorkspacesError] = useState<string | null>(null)
  const [workspacesBusy, setWorkspacesBusy] = useState(false)
  const [workspaceName, setWorkspaceName] = useState('')
  const [deleteWorkspace, setDeleteWorkspace] = useState<CovenantWorkspace | null>(null)

  const [orgAdmins, setOrgAdmins] = useState<string[]>([])
  const [orgAdminsLoading, setOrgAdminsLoading] = useState(false)
  const [orgAdminsError, setOrgAdminsError] = useState<string | null>(null)
  const [orgAdminsBusy, setOrgAdminsBusy] = useState(false)
  const [memberLogins, setMemberLogins] = useState<string[]>([])

  const [leaveOpen, setLeaveOpen] = useState(false)
  const [leaveBusy, setLeaveBusy] = useState(false)
  const [leaveError, setLeaveError] = useState<string | null>(null)

  const signedIn = auth?.signedIn === true
  const currentLogin = auth?.login?.trim() || ''
  const currentGithubId = auth?.githubId
  const detailOrg = orgs.find(org => org.slug === detailSlug) ?? null
  const detailRole = detailOrg?.role
  const { isOwner, isAdmin, canManageMembers } = resolveOrgPermissions({
    orgRole: detailRole,
    currentLogin,
    orgAdmins,
  })
  const isOrgAdmin = isAdmin
  const personLogins = isOrgAdmin
    ? members.map(m => m.login)
    : memberLogins
  const workspacesAvailable = hasCovenantWorkspacesApi(covenant)
  const orgAdminsAvailable = hasCovenantOrgAdminsApi(covenant)

  const loadAuthAndOrgs = useCallback(async (): Promise<void> => {
    if (!covenant) {
      setAuth(null)
      setOrgs([])
      setActiveSlug('')
      setAuthError(null)
      setOrgsError(null)
      return
    }

    setAuthLoading(true)
    setOrgsLoading(true)
    setAuthError(null)
    setOrgsError(null)

    const statusResult = await covenant.status()
    setAuthLoading(false)

    if (!statusResult.ok) {
      setAuth(null)
      setAuthError(statusResult.error)
      setOrgs([])
      setActiveSlug('')
      setOrgsLoading(false)
      return
    }

    setAuth(statusResult.data)

    if (!statusResult.data.signedIn) {
      setOrgs([])
      setActiveSlug('')
      setDetailSlug(null)
      setMembers([])
      setDefaults([])
      setWorkspaces([])
      setOrgAdmins([])
      setMemberLogins([])
      setOrgsLoading(false)
      return
    }

    const orgsResult = await covenant.orgsList()
    setOrgsLoading(false)

    if (orgsResult.ok) {
      const list = orgsResult.data
      setOrgs(list)
      setActiveSlug(prev => {
        if (prev && list.some(org => org.slug === prev)) return prev
        return list[0]?.slug ?? ''
      })
      setDetailSlug(prev => {
        if (prev && list.some(org => org.slug === prev)) return prev
        return null
      })
    } else {
      setOrgs([])
      setActiveSlug('')
      setOrgsError(orgsResult.error)
    }
  }, [covenant])

  const loadOrgDetails = useCallback(async (slug: string): Promise<void> => {
    if (!covenant || !slug) {
      setMembers([])
      setDefaults([])
      setWorkspaces([])
      setOrgAdmins([])
      setMemberLogins([])
      setMembersError(null)
      setMembersForbidden(false)
      setDefaultsError(null)
      setWorkspacesError(null)
      setOrgAdminsError(null)
      return
    }

    const orgRole = orgs.find(org => org.slug === slug)?.role
    const isOrgAdminHint = orgRole === 'owner' || orgRole === 'admin'

    setMembersLoading(isOrgAdminHint)
    setDefaultsLoading(true)
    setWorkspacesLoading(true)
    setOrgAdminsLoading(isOrgAdminHint)
    setMembersError(null)
    setMembersForbidden(false)
    setDefaultsError(null)
    setWorkspacesError(null)
    setOrgAdminsError(null)

    const workspacesPromise = hasCovenantWorkspacesApi(covenant)
      ? covenant.workspacesList(slug)
      : Promise.resolve({ ok: true as const, data: [] as CovenantWorkspace[] })

    const memberLoginsPromise = hasCovenantMemberLoginsApi(covenant)
      ? covenant.memberLoginsList(slug)
      : Promise.resolve({ ok: true as const, data: [] as string[] })

    const membersPromise = isOrgAdminHint
      ? settleCovenantResult(covenant.membersList(slug), 'membersList failed')
      : Promise.resolve({ ok: true as const, data: [] as CovenantMember[] })

    const orgAdminsPromise = isOrgAdminHint && hasCovenantOrgAdminsApi(covenant)
      ? settleCovenantResult(covenant.orgAdminsList(slug), 'orgAdminsList failed')
      : Promise.resolve({ ok: true as const, data: [] as string[] })

    const [membersResult, defaultsResult, workspacesResult, orgAdminsResult, memberLoginsResult] =
      await Promise.all([
        membersPromise,
        settleCovenantResult(covenant.defaultsList(slug), 'defaultsList failed'),
        settleCovenantResult(workspacesPromise, 'workspacesList failed'),
        orgAdminsPromise,
        settleCovenantResult(memberLoginsPromise, 'memberLoginsList failed'),
      ])

    setMembersLoading(false)
    setDefaultsLoading(false)
    setWorkspacesLoading(false)
    setOrgAdminsLoading(false)

    if (!isOrgAdminHint) {
      setMembers([])
      setMembersError(null)
      setMembersForbidden(false)
      setOrgAdmins([])
      setOrgAdminsError(null)
    } else if (membersResult.ok) {
      setMembers(membersResult.data)
      setMembersError(null)
      setMembersForbidden(false)
    } else if (isForbiddenError(membersResult.error)) {
      setMembers([])
      setMembersError(null)
      setMembersForbidden(true)
    } else {
      setMembers([])
      setMembersError(membersResult.error)
      setMembersForbidden(false)
    }

    if (defaultsResult.ok) setDefaults(defaultsResult.data)
    else {
      setDefaults([])
      setDefaultsError(defaultsResult.error)
    }

    if (!hasCovenantWorkspacesApi(covenant)) {
      setWorkspaces([])
      setWorkspacesError(null)
    } else if (workspacesResult.ok) {
      setWorkspaces(workspacesResult.data)
    } else {
      setWorkspaces([])
      setWorkspacesError(workspacesResult.error)
    }

    if (isOrgAdminHint) {
      if (!hasCovenantOrgAdminsApi(covenant)) {
        setOrgAdmins([])
        setOrgAdminsError(null)
      } else if (orgAdminsResult.ok) {
        setOrgAdmins(orgAdminsResult.data)
      } else {
        setOrgAdmins([])
        setOrgAdminsError(orgAdminsResult.error)
      }
    }

    if (memberLoginsResult.ok) setMemberLogins(memberLoginsResult.data)
    else setMemberLogins([])
  }, [covenant, orgs])

  useEffect(() => {
    if (!open) return
    void loadAuthAndOrgs()
  }, [open, loadAuthAndOrgs])

  useEffect(() => {
    if (!open) return
    if (!detailSlug) {
      setMembers([])
      setDefaults([])
      setWorkspaces([])
      setOrgAdmins([])
      setMemberLogins([])
      setMembersError(null)
      setMembersForbidden(false)
      setDefaultsError(null)
      setWorkspacesError(null)
      setOrgAdminsError(null)
      setDeleteWorkspace(null)
      return
    }
    void loadOrgDetails(detailSlug)
  }, [open, detailSlug, loadOrgDetails])

  function closeDetail(): void {
    setDetailSlug(null)
    setLeaveOpen(false)
    setLeaveError(null)
    setLeaveBusy(false)
    setDeleteWorkspace(null)
  }

  function openOrg(slug: string): void {
    setActiveSlug(slug)
    setDetailSlug(slug)
    setLeaveError(null)
  }

  async function handleSignIn(): Promise<void> {
    if (!covenant) return
    setAuthBusy(true)
    setAuthError(null)
    const result = await covenant.signIn()
    setAuthBusy(false)
    if (!result.ok) {
      setAuthError(mapCovenantAuthError(result.error, t))
      return
    }
    setAuth(result.data)
    await loadAuthAndOrgs()
  }

  async function handleSignOut(): Promise<void> {
    if (!covenant) return
    setAuthBusy(true)
    setAuthError(null)
    const result = await covenant.signOut()
    setAuthBusy(false)
    if (!result.ok) {
      setAuthError(result.error)
      return
    }
    setAuth({ signedIn: false })
    setOrgs([])
    setActiveSlug('')
    setDetailSlug(null)
    setMembers([])
    setDefaults([])
    setWorkspaces([])
    setOrgAdmins([])
    setMemberLogins([])
    await loadAuthAndOrgs()
  }

  async function handleCreateOrg(): Promise<void> {
    if (!covenant) return
    const name = createName.trim()
    const slug = slugifyOrgName(name)
    if (!slug) return
    setOrgsBusy(true)
    setOrgsError(null)
    const result = await covenant.orgCreate(slug, name)
    setOrgsBusy(false)
    if (!result.ok) {
      setOrgsError(result.error)
      return
    }
    setCreateName('')
    setActiveSlug(result.data.slug)
    await loadAuthAndOrgs()
  }

  async function handleAddMember(): Promise<void> {
    if (!covenant || !detailSlug) return
    const login = memberLogin.trim()
    if (!login) return
    setMembersBusy(true)
    setMembersError(null)
    const result = await covenant.memberAdd(detailSlug, login)
    setMembersBusy(false)
    if (!result.ok) {
      setMembersError(result.error)
      return
    }
    setMemberLogin('')
    await loadOrgDetails(detailSlug)
  }

  async function handleRemoveMember(login: string): Promise<void> {
    if (!covenant || !detailSlug) return
    setMembersBusy(true)
    setMembersError(null)
    const result = await covenant.memberRemove(detailSlug, login)
    setMembersBusy(false)
    if (!result.ok) {
      setMembersError(result.error)
      return
    }
    await loadOrgDetails(detailSlug)
  }

  async function handleSetDefault(): Promise<void> {
    if (!covenant || !detailSlug) return
    const kind = defaultKind.trim()
    const name = defaultName.trim()
    if (!kind || !name) return
    setDefaultsBusy(true)
    setDefaultsError(null)
    const result = await covenant.defaultSet(detailSlug, kind, name)
    setDefaultsBusy(false)
    if (!result.ok) {
      setDefaultsError(result.error)
      return
    }
    setDefaultKind('')
    setDefaultName('')
    await loadOrgDetails(detailSlug)
  }

  async function handleUnsetDefault(kind: string, name: string): Promise<void> {
    if (!covenant || !detailSlug) return
    setDefaultsBusy(true)
    setDefaultsError(null)
    const result = await covenant.defaultUnset(detailSlug, kind, name)
    setDefaultsBusy(false)
    if (!result.ok) {
      setDefaultsError(result.error)
      return
    }
    await loadOrgDetails(detailSlug)
  }

  async function handleCreateWorkspace(): Promise<void> {
    if (!covenant || !detailSlug || !hasCovenantWorkspacesApi(covenant)) return
    const name = workspaceName.trim()
    if (!name) return
    setWorkspacesBusy(true)
    setWorkspacesError(null)
    const result = await covenant.workspaceCreate(detailSlug, name)
    setWorkspacesBusy(false)
    if (!result.ok) {
      setWorkspacesError(result.error)
      return
    }
    setWorkspaceName('')
    await loadOrgDetails(detailSlug)
  }

  async function handleDeleteWorkspace(projectId: string): Promise<void> {
    if (!covenant || !detailSlug || !hasCovenantWorkspacesApi(covenant)) return
    setWorkspacesBusy(true)
    setWorkspacesError(null)
    const result = await covenant.workspaceDelete(detailSlug, projectId)
    setWorkspacesBusy(false)
    if (!result.ok) {
      setWorkspacesError(result.error)
      return
    }
    setDeleteWorkspace(null)
    await loadOrgDetails(detailSlug)
  }

  async function handleWorkspaceAssigneeAdd(projectId: string, login: string): Promise<void> {
    if (!covenant || !detailSlug || !hasCovenantWorkspacesApi(covenant)) return
    const target = login.trim()
    if (!target) return
    const existing = workspaces.find(p => p.id === projectId)
    if (existing?.assignees.includes(target)) return
    setWorkspacesBusy(true)
    setWorkspacesError(null)
    const result = await covenant.workspaceAssigneeAdd(detailSlug, projectId, target)
    setWorkspacesBusy(false)
    if (!result.ok) {
      setWorkspacesError(result.error)
      return
    }
    await loadOrgDetails(detailSlug)
  }

  async function handleWorkspaceAssigneeRemove(projectId: string, login: string): Promise<void> {
    if (!covenant || !detailSlug || !hasCovenantWorkspacesApi(covenant)) return
    setWorkspacesBusy(true)
    setWorkspacesError(null)
    const result = await covenant.workspaceAssigneeRemove(detailSlug, projectId, login)
    setWorkspacesBusy(false)
    if (!result.ok) {
      setWorkspacesError(result.error)
      return
    }
    await loadOrgDetails(detailSlug)
  }

  async function handleWorkspaceAdminAdd(projectId: string, login: string): Promise<void> {
    if (!covenant || !detailSlug || !hasCovenantWorkspacesApi(covenant)) return
    const target = login.trim()
    if (!target) return
    const existing = workspaces.find(p => p.id === projectId)
    if (existing?.admins.includes(target)) return
    setWorkspacesBusy(true)
    setWorkspacesError(null)
    const result = await covenant.workspaceAdminAdd(detailSlug, projectId, target)
    setWorkspacesBusy(false)
    if (!result.ok) {
      setWorkspacesError(result.error)
      return
    }
    await loadOrgDetails(detailSlug)
  }

  async function handleWorkspaceAdminRemove(projectId: string, login: string): Promise<void> {
    if (!covenant || !detailSlug || !hasCovenantWorkspacesApi(covenant)) return
    setWorkspacesBusy(true)
    setWorkspacesError(null)
    const result = await covenant.workspaceAdminRemove(detailSlug, projectId, login)
    setWorkspacesBusy(false)
    if (!result.ok) {
      setWorkspacesError(result.error)
      return
    }
    await loadOrgDetails(detailSlug)
  }

  async function handleOrgAdminAdd(login: string): Promise<void> {
    if (!covenant || !detailSlug || !hasCovenantOrgAdminsApi(covenant)) return
    const target = login.trim()
    if (!target || orgAdmins.includes(target)) return
    setOrgAdminsBusy(true)
    setOrgAdminsError(null)
    const result = await covenant.orgAdminAdd(detailSlug, target)
    setOrgAdminsBusy(false)
    if (!result.ok) {
      setOrgAdminsError(result.error)
      return
    }
    await loadOrgDetails(detailSlug)
  }

  async function handleOrgAdminRemove(login: string): Promise<void> {
    if (!covenant || !detailSlug || !hasCovenantOrgAdminsApi(covenant)) return
    setOrgAdminsBusy(true)
    setOrgAdminsError(null)
    const result = await covenant.orgAdminRemove(detailSlug, login)
    setOrgAdminsBusy(false)
    if (!result.ok) {
      setOrgAdminsError(result.error)
      return
    }
    await loadOrgDetails(detailSlug)
  }

  async function handleLeaveOrg(slug: string): Promise<void> {
    if (!covenant || !currentLogin) return
    setLeaveBusy(true)
    setLeaveError(null)
    const result = await covenant.memberRemove(slug, currentLogin)
    setLeaveBusy(false)
    if (!result.ok) {
      setLeaveError(result.error)
      return
    }
    setLeaveOpen(false)
    setDetailSlug(null)
    await loadAuthAndOrgs()
  }

  const detailSlugValue = detailSlug ?? ''

  return (
    <>
      <TerminalModal
        open={open}
        onClose={onClose}
        title={t('organizations.title')}
        size="lg"
        zIndex={720}
        bodyLayout="spacious"
        closeOnBackdrop
        footer={
          <Button variant="secondary" size="sm" onClick={onClose}>
            {t('common.cancel')}
          </Button>
        }
      >
        <div className="orgs-modal-body">
          {!available ? (
            <p className="orgs-disabled">{t('organizations.unavailable')}</p>
          ) : (
            <>
              <AuthSection
                available={available}
                status={auth}
                loading={authLoading}
                error={authError}
                busy={authBusy}
                onSignIn={() => void handleSignIn()}
                onSignOut={() => void handleSignOut()}
              />
              <OrgsSection
                available={available}
                signedIn={signedIn}
                orgs={orgs}
                loading={orgsLoading}
                error={orgsError}
                busy={orgsBusy}
                createName={createName}
                onCreateNameChange={setCreateName}
                onOpenOrg={openOrg}
                onCreate={() => void handleCreateOrg()}
              />
            </>
          )}
        </div>
      </TerminalModal>

      <OrgDetailModal
        open={detailSlug != null}
        org={detailOrg}
        signedIn={signedIn}
        isOrgAdmin={isOrgAdmin}
        canLeave={!!currentLogin}
        leaveError={leaveError}
        leaveBusy={leaveBusy}
        leaveOpen={leaveOpen}
        onClose={closeDetail}
        onLeaveClick={() => {
          if (!currentLogin) return
          setLeaveError(null)
          setLeaveOpen(true)
        }}
        onLeaveConfirm={() => {
          if (!detailSlug) return
          void handleLeaveOrg(detailSlug)
        }}
        onLeaveCancel={() => {
          if (leaveBusy) return
          setLeaveOpen(false)
        }}
        deleteWorkspace={deleteWorkspace}
        onDeleteWorkspaceConfirm={() => {
          if (!deleteWorkspace || workspacesBusy) return
          void handleDeleteWorkspace(deleteWorkspace.id)
        }}
        onDeleteWorkspaceCancel={() => {
          if (workspacesBusy) return
          setDeleteWorkspace(null)
        }}
        membersProps={{
          available,
          signedIn,
          activeSlug: detailSlugValue,
          canManageMembers,
          membersForbidden,
          members,
          loading: membersLoading,
          error: membersError,
          busy: membersBusy,
          loginDraft: memberLogin,
          onLoginDraftChange: setMemberLogin,
          onAdd: () => void handleAddMember(),
          onRemove: login => void handleRemoveMember(login),
        }}
        orgAdminsProps={{
          available: available && orgAdminsAvailable,
          signedIn,
          activeSlug: detailSlugValue,
          members,
          admins: orgAdmins,
          loading: orgAdminsLoading,
          error: orgAdminsError,
          busy: orgAdminsBusy,
          onAdd: login => void handleOrgAdminAdd(login),
          onRemove: login => void handleOrgAdminRemove(login),
        }}
        workspacesProps={{
          available: available && workspacesAvailable,
          signedIn,
          activeSlug: detailSlugValue,
          canCreate: isOrgAdmin,
          canDeleteWorkspace: project => canDeleteOwnedItem({
            isOwner,
            currentLogin,
            currentGithubId,
            createdBy: project.createdBy,
            createdById: project.createdById,
          }),
          isOrgAdmin,
          currentLogin,
          memberLogins: personLogins,
          workspaces,
          loading: workspacesLoading,
          error: workspacesError,
          busy: workspacesBusy,
          nameDraft: workspaceName,
          onNameDraftChange: setWorkspaceName,
          onCreate: () => void handleCreateWorkspace(),
          onDeleteRequest: project => setDeleteWorkspace(project),
          onAssigneeAdd: (id, login) => void handleWorkspaceAssigneeAdd(id, login),
          onAssigneeRemove: (id, login) => void handleWorkspaceAssigneeRemove(id, login),
          onAdminAdd: (id, login) => void handleWorkspaceAdminAdd(id, login),
          onAdminRemove: (id, login) => void handleWorkspaceAdminRemove(id, login),
        }}
        defaultsProps={{
          available,
          signedIn,
          activeSlug: detailSlugValue,
          canCreate: isOrgAdmin,
          canDeleteItem: item => canDeleteOwnedItem({
            isOwner,
            currentLogin,
            currentGithubId,
            createdBy: item.createdBy,
            createdById: item.createdById,
          }),
          defaults,
          loading: defaultsLoading,
          error: defaultsError,
          busy: defaultsBusy,
          kindDraft: defaultKind,
          nameDraft: defaultName,
          onKindDraftChange: setDefaultKind,
          onNameDraftChange: setDefaultName,
          onSet: () => void handleSetDefault(),
          onUnset: (kind, name) => void handleUnsetDefault(kind, name),
        }}
      />
    </>
  )
}
