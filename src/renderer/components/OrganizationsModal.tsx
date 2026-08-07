import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useT } from '@i18n/useT'
import {
  getCovenantApi,
  hasCovenantMemberLoginsApi,
  hasCovenantOrgAdminsApi,
  hasCovenantWorkspaceReposApi,
  hasCovenantWorkspacesApi,
  slugifyOrgName,
  type CovenantAuthStatus,
  type CovenantDefault,
  type CovenantMember,
  type CovenantOrg,
  type CovenantWorkspace,
  type CovenantWorkspaceRepoRecord,
} from '../covenantApi'
import { TerminalModal } from './TerminalModal'
import { ConfirmTerminalModal } from './ConfirmTerminalModal'
import { SettingsField } from './SettingsSection'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Select } from './ui/Select'
import { SegmentedControl } from './ui/SegmentedControl'
import { Spinner } from './ui/Spinner'
import { Badge } from './ui/Badge'
import { Icon } from './ui/Icon'
import './SettingsModal.css'
import './OrganizationsModal.css'
import { normalizeRepoFullName, repoFullNameFromCloneUrl } from '../../shared/repoFullName'

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

type OrgDetailTab = 'workspaces' | 'members' | 'admins' | 'contexts'

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
      <p className="orgs-section-status" role="status" aria-live="polite">
        <Spinner aria-label={loadingLabel} />
        <span>{loadingLabel}</span>
      </p>
    )
  }
  if (error) {
    return (
      <p className="orgs-section-error" role="alert">
        {error}
      </p>
    )
  }
  return null
}

function AuthBar({
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
    <div className="orgs-stack">
      <SectionStatus loading={loading} error={error} loadingLabel={t('organizations.loading')} />
      {!available ? (
        <p className="orgs-empty">{t('organizations.unavailable')}</p>
      ) : signedIn ? (
        <div className="orgs-auth-bar" aria-label={t('organizations.authSection')}>
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
          <div className="orgs-auth-bar__meta">
            <p className="orgs-auth__login">{login || t('organizations.signedIn')}</p>
            {status?.name ? <p className="orgs-auth__hint">{status.name}</p> : null}
          </div>
          <Button variant="secondary" size="sm" disabled={busy} onClick={onSignOut}>
            {t('organizations.signOut')}
          </Button>
        </div>
      ) : (
        <div className="orgs-auth-bar" aria-label={t('organizations.authSection')}>
          <div className="orgs-auth-bar__meta">
            <p className="orgs-auth__login">{t('organizations.signInPrompt')}</p>
            <p className="orgs-auth__hint">{t('organizations.signInHint')}</p>
          </div>
          <Button variant="primary" size="sm" disabled={busy || loading} onClick={onSignIn}>
            {t('organizations.signIn')}
          </Button>
        </div>
      )}
    </div>
  )
}

function OrgsRail({
  available,
  signedIn,
  orgs,
  selectedSlug,
  loading,
  error,
  busy,
  createName,
  onCreateNameChange,
  onSelectOrg,
  onCreate,
}: {
  available: boolean
  signedIn: boolean
  orgs: CovenantOrg[]
  selectedSlug: string
  loading: boolean
  error: string | null
  busy: boolean
  createName: string
  onCreateNameChange: (value: string) => void
  onSelectOrg: (slug: string) => void
  onCreate: () => void
}): React.ReactElement {
  const { t } = useT()
  const slug = slugifyOrgName(createName)
  const canCreate = available && signedIn && slug.length > 0 && !busy

  return (
    <aside className="orgs-rail" aria-label={t('organizations.orgRailHeading')}>
      <h2 className="orgs-rail__heading">{t('organizations.orgRailHeading')}</h2>
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
            <ul className="orgs-list" role="listbox" aria-label={t('organizations.orgRailHeading')}>
              {orgs.map(org => {
                const selected = org.slug === selectedSlug
                return (
                  <li
                    key={org.slug}
                    className={[
                      'orgs-list__item',
                      'orgs-list__item--org',
                      selected ? 'is-selected' : '',
                    ].filter(Boolean).join(' ')}
                    role="option"
                    aria-selected={selected}
                  >
                    <button
                      type="button"
                      className="orgs-list__open"
                      disabled={busy}
                      onClick={() => onSelectOrg(org.slug)}
                      aria-label={`${t('organizations.openOrg')}: ${org.name}`}
                    >
                      <span className="orgs-list__main">
                        <span className="orgs-list__title">{org.name}</span>
                        <span className="orgs-list__meta">{org.slug}</span>
                      </span>
                      {org.role ? <Badge variant="muted">{org.role}</Badge> : null}
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : null}
          <div className="orgs-form-zone">
            <p className="orgs-form-zone__label">{t('organizations.formCreateOrg')}</p>
            <div className="orgs-form-row">
              <div className="orgs-form-row__grow">
                <SettingsField label={t('organizations.orgName')} compact>
                  <Input
                    type="text"
                    size="sm"
                    value={createName}
                    disabled={busy}
                    onChange={e => onCreateNameChange(e.target.value)}
                    placeholder={t('organizations.orgNamePlaceholder')}
                    spellCheck={false}
                    aria-label={t('organizations.orgName')}
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
          </div>
        </>
      )}
    </aside>
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
    <div className="orgs-stack" aria-label={t('organizations.membersSection')}>
      <h3 className="orgs-panel-heading">{t('organizations.membersSection')}</h3>
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
          <div className="orgs-form-zone">
            <p className="orgs-form-zone__label">{t('organizations.formAddMember')}</p>
            <div className="orgs-form-row">
              <div className="orgs-form-row__grow">
                <SettingsField label={t('organizations.memberLogin')} compact>
                  <Input
                    type="text"
                    size="sm"
                    value={loginDraft}
                    disabled={!canMutate}
                    onChange={e => onLoginDraftChange(e.target.value)}
                    placeholder={t('organizations.memberLoginPlaceholder')}
                    spellCheck={false}
                    aria-label={t('organizations.memberLogin')}
                  />
                </SettingsField>
              </div>
              <Button variant="primary" size="sm" disabled={!canAdd} onClick={onAdd}>
                {t('organizations.addMember')}
              </Button>
            </div>
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
    <div className="orgs-stack" aria-label={t('organizations.globalContexts')}>
      <h3 className="orgs-panel-heading">{t('organizations.globalContexts')}</h3>
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
            <div className="orgs-form-zone">
              <p className="orgs-form-zone__label">{t('organizations.formAddContext')}</p>
              <div className="orgs-form-row">
                <div className="orgs-form-row__grow">
                  <SettingsField label={t('organizations.defaultKind')} compact>
                    <Input
                      type="text"
                      size="sm"
                      value={kindDraft}
                      disabled={!canMutateCreate}
                      onChange={e => onKindDraftChange(e.target.value)}
                      placeholder={t('organizations.defaultKindPlaceholder')}
                      spellCheck={false}
                      aria-label={t('organizations.defaultKind')}
                    />
                  </SettingsField>
                </div>
                <div className="orgs-form-row__grow">
                  <SettingsField label={t('organizations.defaultName')} compact>
                    <Input
                      type="text"
                      size="sm"
                      value={nameDraft}
                      disabled={!canMutateCreate}
                      onChange={e => onNameDraftChange(e.target.value)}
                      placeholder={t('organizations.defaultNamePlaceholder')}
                      spellCheck={false}
                      aria-label={t('organizations.defaultName')}
                    />
                  </SettingsField>
                </div>
                <Button variant="primary" size="sm" disabled={!canSet} onClick={onSet}>
                  {t('organizations.setDefault')}
                </Button>
              </div>
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
    <div className="orgs-stack" aria-label={t('organizations.orgAdminsSection')}>
      <h3 className="orgs-panel-heading">{t('organizations.orgAdminsSection')}</h3>
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
          <div className="orgs-form-zone">
            <p className="orgs-form-zone__label">{t('organizations.formAddAdmin')}</p>
            <MemberPickRow
              options={options}
              busy={!canMutate}
              selectLabel={t('organizations.addAdmin')}
              addLabel={t('organizations.addAdmin')}
              onAdd={onAdd}
            />
          </div>
        </>
      )}
    </div>
  )
}

function WorkspacePeopleBlock({
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
  const canManageRole = role === 'user' ? canManageAssignees : canManageProjectAdmins
  const busy = parentBusy || !canManageRole
  const activeLogins = role === 'user' ? assignees : admins
  const taken = new Set(activeLogins)
  const options = memberLogins.filter(login => !taken.has(login))
  const addLabel = role === 'user' ? t('organizations.addAssignee') : t('organizations.addAdmin')

  return (
    <div className="orgs-people" aria-label={t('organizations.peopleSection')}>
      <p className="orgs-people__heading">{t('organizations.peopleSection')}</p>
      <div className="orgs-people__group">
        <p className="orgs-list__meta">{t('organizations.assignees')}</p>
        <LoginChips
          logins={assignees}
          busy={parentBusy || !canManageAssignees}
          emptyLabel={t('organizations.assignees')}
          removeLabel={t('organizations.unassign')}
          onRemove={onAssigneeRemove}
        />
      </div>
      <div className="orgs-people__group">
        <p className="orgs-list__meta">{t('organizations.workspaceAdmins')}</p>
        <LoginChips
          logins={admins}
          busy={parentBusy || !canManageProjectAdmins}
          emptyLabel={t('organizations.workspaceAdmins')}
          removeLabel={t('organizations.removeAdmin')}
          onRemove={onAdminRemove}
        />
      </div>
      {(canManageAssignees || canManageProjectAdmins) ? (
        <div className="orgs-people__add">
          <SegmentedControl
            size="sm"
            layout="equal"
            label={t('organizations.peopleSection')}
            value={role}
            disabled={parentBusy}
            onChange={setRole}
            options={[
              {
                value: 'user',
                label: t('organizations.roleUser'),
                disabled: !canManageAssignees,
              },
              {
                value: 'admin',
                label: t('organizations.roleAdmin'),
                disabled: !canManageProjectAdmins,
              },
            ]}
          />
          <MemberPickRow
            options={options}
            busy={busy}
            selectLabel={addLabel}
            addLabel={addLabel}
            onAdd={login => {
              if (role === 'user') onAssigneeAdd(login)
              else onAdminAdd(login)
            }}
          />
        </div>
      ) : null}
    </div>
  )
}

function WorkspaceReposBlock({
  slug,
  workspaceId,
  canManage,
  parentBusy,
}: {
  slug: string
  workspaceId: string
  canManage: boolean
  parentBusy: boolean
}): React.ReactElement {
  const { t } = useT()
  const covenant = useMemo(() => getCovenantApi(), [])
  const available = hasCovenantWorkspaceReposApi(covenant)
  const [repos, setRepos] = useState<CovenantWorkspaceRepoRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cloneUrlDraft, setCloneUrlDraft] = useState('')

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

  const canMutate = available && canManage && !busy && !parentBusy
  const cloneUrl = cloneUrlDraft.trim()
  const derivedFullName = repoFullNameFromCloneUrl(cloneUrl)
  const isDuplicate = Boolean(
    derivedFullName
    && repos.some(repo => normalizeRepoFullName(repo.repoFullName) === derivedFullName),
  )
  const canAdd = canMutate && cloneUrl.length > 0 && !isDuplicate

  async function handleAdd(): Promise<void> {
    if (!covenant || !canMutate || cloneUrl.length === 0) return
    const fullName = repoFullNameFromCloneUrl(cloneUrl)
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
    const result = await covenant.workspaceRepoAdd(slug, workspaceId, {
      repoFullName: fullName,
      cloneUrl,
    })
    setBusy(false)
    if (!result.ok) {
      const err = result.error.toLowerCase()
      if (err.includes('already linked') || err.includes('conflict')) {
        setError(t('organizations.repoDuplicate'))
      } else {
        setError(result.error)
      }
      return
    }
    setCloneUrlDraft('')
    await loadRepos()
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
    <div className="orgs-stack" aria-label={t('organizations.reposTab')}>
      <p className="orgs-list__meta">{t('organizations.reposTab')}</p>
      <SectionStatus loading={loading} error={error} loadingLabel={t('organizations.loading')} />
      {!available ? (
        <p className="orgs-empty">{t('organizations.unavailable')}</p>
      ) : (
        <>
          {canManage ? (
            <div className="orgs-form-zone">
              <p className="orgs-form-zone__label">{t('organizations.addRepo')}</p>
              <div className="orgs-form-row">
                <div className="orgs-form-row__grow">
                  <SettingsField label={t('organizations.addRepo')} compact>
                    <Input
                      type="text"
                      size="sm"
                      value={cloneUrlDraft}
                      disabled={!canMutate}
                      onChange={e => setCloneUrlDraft(e.target.value)}
                      placeholder={t('organizations.repoCloneUrlPlaceholder')}
                      spellCheck={false}
                      aria-label={t('organizations.repoCloneUrlPlaceholder')}
                    />
                  </SettingsField>
                </div>
                <Button variant="primary" size="sm" disabled={!canAdd} onClick={() => void handleAdd()}>
                  {t('organizations.addRepo')}
                </Button>
              </div>
            </div>
          ) : null}
          {repos.length === 0 && !loading ? (
            <p className="orgs-empty">{t('organizations.reposEmpty')}</p>
          ) : (
            <ul className="orgs-list">
              {repos.map(repo => (
                <li key={repo.id} className="orgs-list__item">
                  <div className="orgs-list__main">
                    <p className="orgs-list__title">{repo.repoFullName}</p>
                    <p className="orgs-list__meta">{repo.cloneUrl}</p>
                  </div>
                  {canManage ? (
                    <Button
                      variant="danger"
                      size="xs"
                      disabled={!canMutate}
                      onClick={() => void handleRemove(repo.id)}
                    >
                      {t('organizations.removeRepo')}
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
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
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('')
  const canMutate = available && signedIn && !!activeSlug && !busy
  const canMutateCreate = canMutate && canCreate
  const canCreateSubmit = canMutateCreate && nameDraft.trim().length > 0

  useEffect(() => {
    if (!selectedWorkspaceId) return
    if (workspaces.some(workspace => workspace.id === selectedWorkspaceId)) return
    setSelectedWorkspaceId('')
  }, [selectedWorkspaceId, workspaces])

  return (
    <div className="orgs-stack" aria-label={t('organizations.workspacesSection')}>
      <h3 className="orgs-panel-heading">{t('organizations.workspacesSection')}</h3>
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
            <div className="orgs-form-zone">
              <p className="orgs-form-zone__label">{t('organizations.formCreateWorkspace')}</p>
              <div className="orgs-form-row">
                <div className="orgs-form-row__grow">
                  <SettingsField label={t('organizations.workspaceName')} compact>
                    <Input
                      type="text"
                      size="sm"
                      value={nameDraft}
                      disabled={!canMutateCreate}
                      onChange={e => onNameDraftChange(e.target.value)}
                      placeholder={t('organizations.workspaceNamePlaceholder')}
                      spellCheck={false}
                      aria-label={t('organizations.workspaceName')}
                    />
                  </SettingsField>
                </div>
                <Button variant="primary" size="sm" disabled={!canCreateSubmit} onClick={onCreate}>
                  {t('organizations.createWorkspace')}
                </Button>
              </div>
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
                const selected = selectedWorkspaceId === project.id
                return (
                  <li
                    key={project.id}
                    className={[
                      'orgs-list__item',
                      'orgs-list__item--workspace',
                      selected ? 'is-selected' : '',
                    ].filter(Boolean).join(' ')}
                  >
                    <div className="orgs-workspace-row">
                      <button
                        type="button"
                        className="orgs-list__open"
                        onClick={() => setSelectedWorkspaceId(selected ? '' : project.id)}
                        aria-expanded={selected}
                        aria-label={project.name}
                      >
                        <Icon
                          name={selected ? 'chevron-down' : 'chevron-right'}
                          size={12}
                          aria-hidden
                        />
                        <span className="orgs-list__title">{project.name}</span>
                      </button>
                    </div>
                    {selected ? (
                      <div className="orgs-workspace-detail">
                        <WorkspacePeopleBlock
                          assignees={project.assignees}
                          admins={project.admins}
                          memberLogins={memberLogins}
                          canManageAssignees={canManageAssignees}
                          canManageProjectAdmins={canManageProjectAdmins}
                          parentBusy={busy}
                          onAssigneeAdd={login => onAssigneeAdd(project.id, login)}
                          onAssigneeRemove={login => onAssigneeRemove(project.id, login)}
                          onAdminAdd={login => onAdminAdd(project.id, login)}
                          onAdminRemove={login => onAdminRemove(project.id, login)}
                        />
                        <WorkspaceReposBlock
                          slug={activeSlug}
                          workspaceId={project.id}
                          canManage={canManageAssignees}
                          parentBusy={busy}
                        />
                        {showDelete ? (
                          <div className="orgs-workspace-detail__actions">
                            <Button
                              variant="danger"
                              size="xs"
                              disabled={!canMutate}
                              onClick={() => onDeleteRequest(project)}
                            >
                              {t('organizations.deleteWorkspace')}
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

function OrgDetailPanel({
  org,
  signedIn,
  isOrgAdmin,
  canLeave,
  leaveError,
  leaveBusy,
  activeTab,
  onTabChange,
  onLeaveClick,
  membersProps,
  orgAdminsProps,
  workspacesProps,
  defaultsProps,
}: {
  org: CovenantOrg
  signedIn: boolean
  isOrgAdmin: boolean
  canLeave: boolean
  leaveError: string | null
  leaveBusy: boolean
  activeTab: OrgDetailTab
  onTabChange: (tab: OrgDetailTab) => void
  onLeaveClick: () => void
  membersProps: React.ComponentProps<typeof MembersSection>
  orgAdminsProps: React.ComponentProps<typeof OrgAdminsSection>
  workspacesProps: React.ComponentProps<typeof WorkspacesSection>
  defaultsProps: React.ComponentProps<typeof DefaultsSection>
}): React.ReactElement {
  const { t } = useT()
  const tabs: { id: OrgDetailTab; label: string; visible: boolean }[] = [
    { id: 'workspaces', label: t('organizations.detailTabWorkspaces'), visible: true },
    { id: 'members', label: t('organizations.detailTabMembers'), visible: isOrgAdmin },
    { id: 'admins', label: t('organizations.detailTabAdmins'), visible: isOrgAdmin },
    { id: 'contexts', label: t('organizations.detailTabContexts'), visible: true },
  ]
  const visibleTabs = tabs.filter(tab => tab.visible)
  const resolvedTab = visibleTabs.some(tab => tab.id === activeTab)
    ? activeTab
    : (visibleTabs[0]?.id ?? 'workspaces')
  const panelId = `orgs-tab-panel-${resolvedTab}`

  return (
    <section className="orgs-detail" aria-label={org.name}>
      <div className="orgs-detail__header">
        <div className="orgs-detail__title-block">
          <h2 className="orgs-detail__title">{org.name}</h2>
          <p className="orgs-detail__meta">
            {org.slug}
            {org.role ? ` · ${org.role}` : ''}
          </p>
        </div>
        <div className="orgs-detail__actions">
          {signedIn ? (
            <Button
              variant="danger"
              size="sm"
              disabled={!canLeave || leaveBusy}
              onClick={onLeaveClick}
            >
              {t('organizations.leaveOrg')}
            </Button>
          ) : null}
        </div>
      </div>

      {leaveError ? <p className="orgs-section-error" role="alert">{leaveError}</p> : null}

      <div className="orgs-tabs" role="tablist" aria-label={t('organizations.detailTabsLabel')}>
        {visibleTabs.map(tab => {
          const selected = tab.id === resolvedTab
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`orgs-tab-${tab.id}`}
              className="orgs-tabs__tab"
              aria-selected={selected}
              aria-controls={panelId}
              tabIndex={selected ? 0 : -1}
              onClick={() => onTabChange(tab.id)}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      <div
        className="orgs-tab-panel"
        role="tabpanel"
        id={panelId}
        aria-labelledby={`orgs-tab-${resolvedTab}`}
      >
        {resolvedTab === 'workspaces' ? <WorkspacesSection {...workspacesProps} /> : null}
        {resolvedTab === 'members' && isOrgAdmin ? <MembersSection {...membersProps} /> : null}
        {resolvedTab === 'admins' && isOrgAdmin ? <OrgAdminsSection {...orgAdminsProps} /> : null}
        {resolvedTab === 'contexts' ? <DefaultsSection {...defaultsProps} /> : null}
      </div>
    </section>
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
  const [detailTab, setDetailTab] = useState<OrgDetailTab>('workspaces')

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

  useEffect(() => {
    if (isOrgAdmin) return
    if (detailTab === 'members' || detailTab === 'admins') {
      setDetailTab('workspaces')
    }
  }, [detailTab, isOrgAdmin])

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

  function openOrg(slug: string): void {
    setActiveSlug(slug)
    setDetailSlug(slug)
    setLeaveError(null)
    setDetailTab('workspaces')
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
    setDetailSlug(result.data.slug)
    setDetailTab('workspaces')
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
  const selectedSlug = detailSlug ?? activeSlug
  const leaveName = detailOrg?.name ?? t('organizations.orgDetailTitle')

  const membersProps = {
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
    onRemove: (login: string) => void handleRemoveMember(login),
  }
  const orgAdminsProps = {
    available: available && orgAdminsAvailable,
    signedIn,
    activeSlug: detailSlugValue,
    members,
    admins: orgAdmins,
    loading: orgAdminsLoading,
    error: orgAdminsError,
    busy: orgAdminsBusy,
    onAdd: (login: string) => void handleOrgAdminAdd(login),
    onRemove: (login: string) => void handleOrgAdminRemove(login),
  }
  const workspacesProps = {
    available: available && workspacesAvailable,
    signedIn,
    activeSlug: detailSlugValue,
    canCreate: isOrgAdmin,
    canDeleteWorkspace: (project: CovenantWorkspace) => canDeleteOwnedItem({
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
    onDeleteRequest: (project: CovenantWorkspace) => setDeleteWorkspace(project),
    onAssigneeAdd: (id: string, login: string) => void handleWorkspaceAssigneeAdd(id, login),
    onAssigneeRemove: (id: string, login: string) => void handleWorkspaceAssigneeRemove(id, login),
    onAdminAdd: (id: string, login: string) => void handleWorkspaceAdminAdd(id, login),
    onAdminRemove: (id: string, login: string) => void handleWorkspaceAdminRemove(id, login),
  }
  const defaultsProps = {
    available,
    signedIn,
    activeSlug: detailSlugValue,
    canCreate: isOrgAdmin,
    canDeleteItem: (item: CovenantDefault) => canDeleteOwnedItem({
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
    onUnset: (kind: string, name: string) => void handleUnsetDefault(kind, name),
  }

  return (
    <>
      <TerminalModal
        open={open}
        onClose={onClose}
        title={t('organizations.title')}
        size="xl"
        zIndex={720}
        bodyLayout="spacious"
        closeOnBackdrop
        footer={
          <Button variant="secondary" size="sm" onClick={onClose}>
            {t('common.cancel')}
          </Button>
        }
      >
        <div className="orgs-shell">
          {!available ? (
            <p className="orgs-disabled">{t('organizations.unavailable')}</p>
          ) : (
            <>
              <AuthBar
                available={available}
                status={auth}
                loading={authLoading}
                error={authError}
                busy={authBusy}
                onSignIn={() => void handleSignIn()}
                onSignOut={() => void handleSignOut()}
              />
              {signedIn ? (
                <div className="orgs-split">
                  <OrgsRail
                    available={available}
                    signedIn={signedIn}
                    orgs={orgs}
                    selectedSlug={selectedSlug}
                    loading={orgsLoading}
                    error={orgsError}
                    busy={orgsBusy}
                    createName={createName}
                    onCreateNameChange={setCreateName}
                    onSelectOrg={openOrg}
                    onCreate={() => void handleCreateOrg()}
                  />
                  {detailOrg ? (
                    <OrgDetailPanel
                      org={detailOrg}
                      signedIn={signedIn}
                      isOrgAdmin={isOrgAdmin}
                      canLeave={!!currentLogin}
                      leaveError={leaveError}
                      leaveBusy={leaveBusy}
                      activeTab={detailTab}
                      onTabChange={setDetailTab}
                      onLeaveClick={() => {
                        if (!currentLogin) return
                        setLeaveError(null)
                        setLeaveOpen(true)
                      }}
                      membersProps={membersProps}
                      orgAdminsProps={orgAdminsProps}
                      workspacesProps={workspacesProps}
                      defaultsProps={defaultsProps}
                    />
                  ) : (
                    <section className="orgs-detail" aria-label={t('organizations.orgDetailTitle')}>
                      <p className="orgs-empty orgs-empty--panel">
                        {t('organizations.detailSelectHint')}
                      </p>
                    </section>
                  )}
                </div>
              ) : null}
            </>
          )}
        </div>
      </TerminalModal>

      <ConfirmTerminalModal
        open={leaveOpen}
        zIndex={760}
        message={t('organizations.leaveConfirm', { name: leaveName })}
        detail={t('organizations.leaveConfirmDetail')}
        onConfirm={() => {
          if (!detailSlug) return
          void handleLeaveOrg(detailSlug)
        }}
        onCancel={() => {
          if (leaveBusy) return
          setLeaveOpen(false)
        }}
      />

      <ConfirmTerminalModal
        open={deleteWorkspace != null}
        zIndex={760}
        message={t('organizations.deleteWorkspaceConfirm', { name: deleteWorkspace?.name ?? '' })}
        onConfirm={() => {
          if (!deleteWorkspace || workspacesBusy) return
          void handleDeleteWorkspace(deleteWorkspace.id)
        }}
        onCancel={() => {
          if (workspacesBusy) return
          setDeleteWorkspace(null)
        }}
      />
    </>
  )
}
