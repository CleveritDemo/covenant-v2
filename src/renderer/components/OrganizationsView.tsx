import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useT } from '@i18n/useT'
import {
  getCovenantApi,
  hasCovenantMemberLoginsApi,
  hasCovenantOrgAdminsApi,
  hasCovenantOrgDeleteApi,
  hasCovenantWorkspacesApi,
  hasCovenantWorkspaceContentApi,
  slugifyOrgName,
  type CovenantAuthStatus,
  type CovenantMember,
  type CovenantOrg,
  type CovenantWorkspace,
} from '../covenantApi'
import { ConfirmTerminalModal } from './ConfirmTerminalModal'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Badge } from './ui/Badge'
import { Icon } from './ui/Icon'
import { Select } from './ui/Select'
import { Tooltip } from './ui/Tooltip'
import { PersonAvatarStack } from './ui/PersonAvatarStack'
import { SectionStatus } from './OrgSectionStatus'
import { OrgsDetailSkeleton, OrgsNavSkeleton } from './OrgsSkeleton'
import { WorkspaceDetailPanel } from './WorkspaceDetailPanel'
import { OrgSettingsPanel } from './OrgSettingsPanel'
import { APP_OVERLAY_MODAL_Z } from '@shared/overlayZIndex'
import './SettingsModal.css'
import './OrganizationsModal.css'
import './OrganizationsView.css'
import { canAccessOrgWorkspace } from '../../shared/orgWorkspaceCatalog'
import { filterOrgsByQuery, filterWorkspacesByQuery } from '../../shared/orgListFilter'
import { workspacePeopleRows } from '../../shared/orgPeople'
import { covenantWorkspaceCatalogKey } from '../../shared/covenantTypes'
import {
  projectAgentsFromWorkspaceAgents,
  tabContextsFromWorkspaceContexts,
} from '../../shared/orgWorkspaceContent'
import { mapCovenantAuthError } from '../covenantAuthErrorLabel'
import { type OrgWorkspaceSelection } from './OrgWorkspaceTabPickerModal'

interface Props {
  open?: boolean
  onClose: () => void
  /** Refresca el snapshot Cmd+T tras mutaciones de orgs/workspaces. */
  onOrgWorkspacesMutated?: () => void
  onOpenWorkspace?: (selection: OrgWorkspaceSelection) => void
}

type GithubAccount = { id: string; label: string }

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

/** Vista de la tercera columna. */
type OrgDetailView = 'workspace' | 'settings'
/** Fila de composición inline abierta (sustituye a los formularios permanentes). */
type ComposeTarget = 'org' | 'workspace' | null

function SignInPanel({
  status,
  loading,
  error,
  busy,
  onSignIn,
}: {
  status: CovenantAuthStatus | null
  loading: boolean
  error: string | null
  busy: boolean
  onSignIn: () => void
}): React.ReactElement {
  const { t } = useT()
  return (
    <div className="orgs-signin">
      <SectionStatus loading={loading} error={error} loadingLabel={t('organizations.loading')} />
      <p className="orgs-signin__title">{t('organizations.signInPrompt')}</p>
      <p className="orgs-signin__hint">{t('organizations.signInHint')}</p>
      <Button variant="primary" size="sm" disabled={busy || loading || !status} onClick={onSignIn}>
        {t('organizations.signIn')}
      </Button>
    </div>
  )
}

function OrgsPanelEmpty({
  label,
  title,
  hint,
  actionLabel,
  onAction,
}: {
  label: string
  title: string
  hint?: string
  actionLabel?: string
  onAction?: () => void
}): React.ReactElement {
  return (
    <section className="orgs-panel" aria-label={label}>
      <div className="orgs-panel-empty">
        <p className="orgs-panel-empty__title">{title}</p>
        {hint ? <p className="orgs-panel-empty__hint">{hint}</p> : null}
        {actionLabel && onAction ? (
          <Button variant="primary" size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
        ) : null}
      </div>
    </section>
  )
}

function OrgsColFilter({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
}): React.ReactElement {
  return (
    <div className="orgs-col__filter">
      <Input
        type="search"
        size="sm"
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
    </div>
  )
}

function OrgsColumn({
  orgs,
  selectedSlug,
  loading,
  error,
  busy,
  composing,
  createName,
  query,
  onQueryChange,
  status,
  authBusy,
  accounts,
  activeAccountId,
  onAccountChange,
  onCreateNameChange,
  onComposeToggle,
  onSelectOrg,
  onCreate,
  onSignOut,
}: {
  orgs: CovenantOrg[]
  selectedSlug: string
  loading: boolean
  error: string | null
  busy: boolean
  composing: boolean
  createName: string
  query: string
  onQueryChange: (value: string) => void
  status: CovenantAuthStatus | null
  authBusy: boolean
  accounts: GithubAccount[]
  activeAccountId: string
  onAccountChange: (id: string) => void
  onCreateNameChange: (value: string) => void
  onComposeToggle: () => void
  onSelectOrg: (slug: string) => void
  onCreate: () => void
  onSignOut: () => void
}): React.ReactElement {
  const { t } = useT()
  const slug = slugifyOrgName(createName)
  const canCreate = slug.length > 0 && !busy
  const login = status?.login?.trim() || ''
  const visibleOrgs = filterOrgsByQuery(orgs, query)
  const firstLoad = loading && orgs.length === 0

  return (
    <aside className="orgs-col orgs-col--rail" aria-label={t('organizations.orgRailHeading')}>
      <div className="orgs-col__head">
        <h2 className="orgs-col__label">{t('organizations.orgRailHeading')}</h2>
        <span className="orgs-col__spacer" />
        <Tooltip content={t('organizations.formCreateOrg')}>
          <Button
            variant="icon"
            size="xs"
            pressed={composing}
            disabled={busy}
            onClick={onComposeToggle}
            aria-label={t('organizations.formCreateOrg')}
          >
            <Icon name="plus" size={14} />
          </Button>
        </Tooltip>
      </div>
      <div className="orgs-col__body">
        {orgs.length > 6 ? (
          <OrgsColFilter
            value={query}
            onChange={onQueryChange}
            placeholder={t('organizations.filterOrgs')}
          />
        ) : null}
        <SectionStatus
          loading={firstLoad}
          error={error}
          loadingLabel={t('organizations.loading')}
          skeleton={<OrgsNavSkeleton rows={5} withAvatar label={t('organizations.loading')} />}
        />
        {composing ? (
          <div className="orgs-compose">
            <Input
              type="text"
              size="sm"
              autoFocus
              value={createName}
              disabled={busy}
              onChange={e => onCreateNameChange(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && canCreate) onCreate()
                if (e.key === 'Escape') onComposeToggle()
              }}
              placeholder={t('organizations.orgNamePlaceholder')}
              spellCheck={false}
              aria-label={t('organizations.orgName')}
            />
            <p className="orgs-row__meta">{t('organizations.slugLabel')}: {slug || '—'}</p>
          </div>
        ) : null}
        {orgs.length === 0 && !loading ? (
          <p className="orgs-empty">{t('organizations.noOrgs')}</p>
        ) : visibleOrgs.length === 0 && !loading ? (
          <p className="orgs-empty">{t('organizations.filterNoMatch')}</p>
        ) : (
          <ul className="orgs-nav" aria-label={t('organizations.orgRailHeading')}>
            {visibleOrgs.map(org => {
              const selected = org.slug === selectedSlug
              const role = (org.role ?? '').trim().toLowerCase()
              const roleBadge = org.personal
                ? null
                : role === 'owner'
                  ? <Badge variant="accent">{t('organizations.roleOwner')}</Badge>
                  : role === 'admin'
                    ? <Badge variant="muted">{t('organizations.roleAdmin')}</Badge>
                    : role === 'member'
                      ? <Badge variant="muted">{t('organizations.roleMember')}</Badge>
                      : null
              return (
                <li key={org.slug}>
                  <button
                    type="button"
                    className={`orgs-nav__item${selected ? ' is-selected' : ''}`}
                    disabled={busy}
                    aria-current={selected}
                    onClick={() => onSelectOrg(org.slug)}
                  >
                    <span
                      className={`orgs-nav__avatar${org.personal ? ' orgs-nav__avatar--personal' : ''}`}
                      aria-hidden
                    >
                      {org.personal ? <Icon name="user" size={13} /> : org.name.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="orgs-nav__text">
                      <span className="orgs-nav__title">{org.name}</span>
                      {org.personal ? (
                        <span className="orgs-nav__meta">{t('organizations.personalOrgHint')}</span>
                      ) : null}
                    </span>
                    {roleBadge}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
      <div className="orgs-col__foot">
        <div className="orgs-account-row">
          <span className="orgs-account">
            {status?.avatarUrl ? (
              <img className="orgs-account__avatar" src={status.avatarUrl} alt="" width={26} height={26} />
            ) : (
              <span className="orgs-account__avatar orgs-account__avatar--letter" aria-hidden>
                {(login || '?').slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="orgs-account__login">{login || t('organizations.signedIn')}</span>
          </span>
          <Button variant="ghost" size="xs" disabled={authBusy} onClick={onSignOut}>
            {t('organizations.signOut')}
          </Button>
        </div>
        {accounts.length > 1 ? (
          <div className="orgs-col__foot-account">
            <Select
              size="sm"
              variant="ghost"
              value={activeAccountId}
              options={accounts.map(account => ({ value: account.id, label: account.label }))}
              onChange={onAccountChange}
              aria-label={t('organizations.accountSelector')}
            />
          </div>
        ) : null}
      </div>
    </aside>
  )
}

function WorkspacesColumn({
  org: _org,
  workspaces,
  selectedWorkspaceId,
  settingsOpen,
  loading,
  error,
  busy,
  canCreate,
  composing,
  nameDraft,
  query,
  onQueryChange,
  onNameDraftChange,
  onComposeToggle,
  onCreate,
  onSelect,
  onOpenSettings,
}: {
  org: CovenantOrg
  workspaces: CovenantWorkspace[]
  selectedWorkspaceId: string
  settingsOpen: boolean
  loading: boolean
  error: string | null
  busy: boolean
  canCreate: boolean
  composing: boolean
  nameDraft: string
  query: string
  onQueryChange: (value: string) => void
  onNameDraftChange: (value: string) => void
  onComposeToggle: () => void
  onCreate: () => void
  onSelect: (workspaceId: string) => void
  onOpenSettings: () => void
}): React.ReactElement {
  const { t } = useT()
  const canSubmit = !busy && nameDraft.trim().length > 0
  const visibleWorkspaces = filterWorkspacesByQuery(workspaces, query)
  const firstLoad = loading && workspaces.length === 0

  return (
    <div className="orgs-col orgs-col--mid" aria-label={t('organizations.workspacesSection')}>
      <div className="orgs-col__head">
        <h2 className="orgs-col__label">{t('organizations.workspacesSection')}</h2>
        <span className="orgs-col__spacer" />
        <Tooltip content={t('organizations.orgSettings')}>
          <Button
            variant="icon"
            size="xs"
            pressed={settingsOpen}
            onClick={onOpenSettings}
            aria-label={t('organizations.orgSettings')}
          >
            <Icon name="settings" size={14} />
          </Button>
        </Tooltip>
        {canCreate ? (
          <Tooltip content={t('organizations.formCreateWorkspace')}>
            <Button
              variant="icon"
              size="xs"
              pressed={composing}
              disabled={busy}
              onClick={onComposeToggle}
              aria-label={t('organizations.formCreateWorkspace')}
            >
              <Icon name="plus" size={14} />
            </Button>
          </Tooltip>
        ) : null}
      </div>
      <div className="orgs-col__body">
        {workspaces.length > 6 ? (
          <OrgsColFilter
            value={query}
            onChange={onQueryChange}
            placeholder={t('organizations.filterWorkspaces')}
          />
        ) : null}
        <SectionStatus
          loading={firstLoad}
          error={error}
          loadingLabel={t('organizations.loading')}
          skeleton={<OrgsNavSkeleton rows={4} label={t('organizations.loading')} />}
        />
        {composing ? (
          <div className="orgs-compose">
            <Input
              type="text"
              size="sm"
              autoFocus
              value={nameDraft}
              disabled={busy}
              onChange={e => onNameDraftChange(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && canSubmit) onCreate()
                if (e.key === 'Escape') onComposeToggle()
              }}
              placeholder={t('organizations.workspaceNamePlaceholder')}
              spellCheck={false}
              aria-label={t('organizations.workspaceName')}
            />
          </div>
        ) : null}
        {workspaces.length === 0 && !loading ? (
          <p className="orgs-empty">{t('organizations.noWorkspaces')}</p>
        ) : visibleWorkspaces.length === 0 && !loading ? (
          <p className="orgs-empty">{t('organizations.filterNoMatch')}</p>
        ) : (
          <ul className="orgs-nav" aria-label={t('organizations.workspacesSection')}>
            {visibleWorkspaces.map(workspace => {
              const selected = !settingsOpen && workspace.id === selectedWorkspaceId
              const people = workspacePeopleRows(workspace.assignees, workspace.admins)
              return (
                <li key={workspace.id}>
                  <button
                    type="button"
                    className={`orgs-nav__item${selected ? ' is-selected' : ''}`}
                    aria-current={selected}
                    onClick={() => onSelect(workspace.id)}
                  >
                    <span className="orgs-nav__text">
                      <span className="orgs-nav__title">{workspace.name}</span>
                      {people.length === 0 ? (
                        <span className="orgs-nav__meta">{t('organizations.workspaceNoPeople')}</span>
                      ) : (
                        <PersonAvatarStack
                          logins={people.map(p => p.login)}
                          size="sm"
                          label={t('organizations.workspacePeopleCount', { count: people.length })}
                        />
                      )}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

export const OrganizationsView: React.FC<Props> = ({
  open = true,
  onClose,
  onOrgWorkspacesMutated,
  onOpenWorkspace,
}) => {
  const { t } = useT()
  const [accounts, setAccounts] = useState<GithubAccount[]>([])
  const [activeAccountId, setActiveAccountId] = useState('')
  const covenant = useMemo(() => getCovenantApi(activeAccountId), [activeAccountId])
  const available = covenant != null

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

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

  const [workspaces, setWorkspaces] = useState<CovenantWorkspace[]>([])
  const [workspacesLoading, setWorkspacesLoading] = useState(false)
  const [workspacesError, setWorkspacesError] = useState<string | null>(null)
  const [workspacesBusy, setWorkspacesBusy] = useState(false)
  const [workspaceName, setWorkspaceName] = useState('')
  const [deleteWorkspace, setDeleteWorkspace] = useState<CovenantWorkspace | null>(null)
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('')
  const [orgQuery, setOrgQuery] = useState('')
  const [workspaceQuery, setWorkspaceQuery] = useState('')

  const [orgAdmins, setOrgAdmins] = useState<string[]>([])
  const [orgAdminsLoading, setOrgAdminsLoading] = useState(false)
  const [orgAdminsError, setOrgAdminsError] = useState<string | null>(null)
  const [orgAdminsBusy, setOrgAdminsBusy] = useState(false)
  const [memberLogins, setMemberLogins] = useState<string[]>([])

  const [leaveOpen, setLeaveOpen] = useState(false)
  const [leaveBusy, setLeaveBusy] = useState(false)
  const [leaveError, setLeaveError] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [detailView, setDetailView] = useState<OrgDetailView>('workspace')
  const [composing, setComposing] = useState<ComposeTarget>(null)
  const [openBusy, setOpenBusy] = useState(false)
  const [openError, setOpenError] = useState<string | null>(null)
  const authRunRef = useRef(0)
  const detailsRunRef = useRef(0)

  const signedIn = auth?.signedIn === true
  const bootstrapping = orgs.length === 0 && (authLoading || orgsLoading)
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
  const personLogins = isOrgAdmin ? members.map(m => m.login) : memberLogins
  const workspacesAvailable = hasCovenantWorkspacesApi(covenant)
  const orgAdminsAvailable = hasCovenantOrgAdminsApi(covenant)
  const selectedWorkspace = workspaces.find(w => w.id === selectedWorkspaceId) ?? null
  const settingsOpen = detailView === 'settings'
  const canDeleteOrg = isOwner
    && !!detailOrg
    && !detailOrg.personal
    && hasCovenantOrgDeleteApi(covenant)

  const loadAuthAndOrgs = useCallback(async (): Promise<void> => {
    const runId = ++authRunRef.current
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
    if (authRunRef.current !== runId) return
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
      setWorkspaces([])
      setOrgAdmins([])
      setMemberLogins([])
      setOrgsLoading(false)
      return
    }

    const orgsResult = await covenant.orgsList()
    if (authRunRef.current !== runId) return
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
        // Sin tabs, la tercera columna necesita una org desde el primer render.
        return list[0]?.slug ?? null
      })
    } else {
      setOrgs([])
      setActiveSlug('')
      setOrgsError(orgsResult.error)
    }
  }, [covenant])

  const loadOrgDetails = useCallback(async (slug: string): Promise<void> => {
    if (!covenant || !slug) {
      detailsRunRef.current += 1
      setMembers([])
      setWorkspaces([])
      setOrgAdmins([])
      setMemberLogins([])
      setMembersError(null)
      setMembersForbidden(false)
      setWorkspacesError(null)
      setOrgAdminsError(null)
      return
    }

    const runId = ++detailsRunRef.current
    const orgRole = orgs.find(org => org.slug === slug)?.role
    const isOrgAdminHint = orgRole === 'owner' || orgRole === 'admin'

    setMembersLoading(isOrgAdminHint)
    setWorkspacesLoading(true)
    setOrgAdminsLoading(isOrgAdminHint)
    setMembersError(null)
    setMembersForbidden(false)
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

    const [membersResult, workspacesResult, orgAdminsResult, memberLoginsResult] =
      await Promise.all([
        membersPromise,
        settleCovenantResult(workspacesPromise, 'workspacesList failed'),
        orgAdminsPromise,
        settleCovenantResult(memberLoginsPromise, 'memberLoginsList failed'),
      ])

    if (detailsRunRef.current !== runId) return
    setMembersLoading(false)
    setWorkspacesLoading(false)
    setOrgAdminsLoading(false)

    if (!isOrgAdminHint) {
      setMembers([])
      setMembersError(null)
      setMembersForbidden(true)
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

    if (!hasCovenantWorkspacesApi(covenant)) {
      setWorkspaces([])
      setWorkspacesError(null)
    } else if (workspacesResult.ok) {
      setWorkspacesError(null)
      setWorkspaces(workspacesResult.data.filter(workspace => canAccessOrgWorkspace({
        login: currentLogin,
        orgRole: orgRole ?? '',
        isOrgAdmin: isOrgAdminHint,
        createdBy: workspace.createdBy,
        admins: workspace.admins,
        assignees: workspace.assignees,
      })))
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
        setOrgAdminsError(null)
      } else {
        setOrgAdmins([])
        setOrgAdminsError(orgAdminsResult.error)
      }
    }

    if (memberLoginsResult.ok) setMemberLogins(memberLoginsResult.data)
    else setMemberLogins([])
  }, [covenant, currentLogin, orgs])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void (async () => {
      const listFn = window.api?.githubAccountsList
      if (typeof listFn !== 'function') return
      const result = await listFn()
      if (cancelled || !result.ok) return
      setAccounts(result.accounts)
      setActiveAccountId(prev => {
        if (prev && result.accounts.some(account => account.id === prev)) return prev
        return result.defaultAccountId || result.accounts[0]?.id || ''
      })
    })()
    return () => {
      cancelled = true
    }
  }, [open])

  useEffect(() => {
    // Al cambiar de cuenta, el detalle de la cuenta anterior no puede seguir pintado ni consultado.
    detailsRunRef.current += 1
    setDetailSlug(null); setActiveSlug(''); setOrgs([])
    setWorkspaces([]); setMembers([]); setOrgAdmins([]); setMemberLogins([])
    setSelectedWorkspaceId(''); setDetailView('workspace'); setComposing(null); setDeleteWorkspace(null)
    setOrgQuery(''); setWorkspaceQuery('')
    setOrgsError(null); setAuthError(null); setMembersError(null); setMembersForbidden(false)
    setWorkspacesError(null); setOrgAdminsError(null); setLeaveError(null)
    setOpenError(null); setOpenBusy(false)
  }, [activeAccountId])

  useEffect(() => {
    if (!open) return
    void loadAuthAndOrgs()
  }, [open, loadAuthAndOrgs])

  useEffect(() => {
    if (!open) return
    if (!detailSlug) {
      setMembers([])
      setWorkspaces([])
      setOrgAdmins([])
      setMemberLogins([])
      setMembersError(null)
      setMembersForbidden(false)
      setWorkspacesError(null)
      setOrgAdminsError(null)
      setDeleteWorkspace(null)
      setOpenError(null)
      setOpenBusy(false)
      return
    }
    void loadOrgDetails(detailSlug)
  }, [open, detailSlug, loadOrgDetails])

  // La selección de la columna 2 sigue viva mientras el workspace exista.
  useEffect(() => {
    if (!selectedWorkspaceId) return
    if (workspaces.some(workspace => workspace.id === selectedWorkspaceId)) return
    setSelectedWorkspaceId('')
    setOpenError(null)
  }, [selectedWorkspaceId, workspaces])

  useEffect(() => {
    if (!detailSlug) return
    if (detailView !== 'workspace') return
    if (settingsOpen) return
    if (workspacesLoading) return
    if (selectedWorkspaceId !== '') return
    if (workspaces.length === 0) return
    setSelectedWorkspaceId(workspaces[0].id)
  }, [
    detailSlug,
    detailView,
    settingsOpen,
    workspacesLoading,
    selectedWorkspaceId,
    workspaces,
  ])

  function openOrg(slug: string): void {
    setActiveSlug(slug)
    setDetailSlug(slug)
    setLeaveError(null)
    setDetailView('workspace')
    setSelectedWorkspaceId('')
    setWorkspaceQuery('')
    setComposing(null)
    setOpenError(null)
    setOpenBusy(false)
  }

  function toggleCompose(target: Exclude<ComposeTarget, null>): void {
    setComposing(prev => (prev === target ? null : target))
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
    onOrgWorkspacesMutated?.()
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
    setWorkspaces([])
    setOrgAdmins([])
    setMemberLogins([])
    await loadAuthAndOrgs()
    onOrgWorkspacesMutated?.()
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
    setComposing(null)
    setActiveSlug(result.data.slug)
    setDetailSlug(result.data.slug)
    setDetailView('workspace')
    setSelectedWorkspaceId('')
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
    setComposing(null)
    // El workspace recién creado pasa a ser el detalle: es lo que el usuario va a tocar.
    setSelectedWorkspaceId(result.data.id)
    setDetailView('workspace')
    await loadOrgDetails(detailSlug)
    onOrgWorkspacesMutated?.()
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
    setSelectedWorkspaceId('')
    await loadOrgDetails(detailSlug)
    onOrgWorkspacesMutated?.()
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
    onOrgWorkspacesMutated?.()
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
    onOrgWorkspacesMutated?.()
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
    onOrgWorkspacesMutated?.()
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
    onOrgWorkspacesMutated?.()
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

  /** El rol de la tabla se compone de las dos rutas de admins que expone la API. */
  function handleOrgRoleChange(login: string, role: 'admin' | 'member'): void {
    if (role === 'admin') void handleOrgAdminAdd(login)
    else void handleOrgAdminRemove(login)
  }

  async function handleLeaveOrg(slug: string): Promise<void> {
    if (!covenant || !currentLogin) return
    setLeaveBusy(true)
    setLeaveError(null)
    const result = await covenant.memberRemove(slug, currentLogin)
    setLeaveBusy(false)
    if (!result.ok) {
      // Red de seguridad: el backend es la autoridad sobre quién puede salir
      // (hoy el owner, mañana quizá el último admin).
      setLeaveError(
        isForbiddenError(result.error)
          ? t('organizations.leaveErrorForbidden')
          : result.error,
      )
      return
    }
    setLeaveOpen(false)
    setDetailSlug(null)
    await loadAuthAndOrgs()
  }

  async function handleDeleteOrg(slug: string): Promise<void> {
    if (!covenant) return
    setDeleteBusy(true)
    setLeaveError(null)
    const result = await covenant.orgDelete(slug)
    setDeleteBusy(false)
    if (!result.ok) {
      setLeaveError(result.error)
      return
    }
    setDeleteOpen(false)
    setDetailView('workspace')
    setDetailSlug(null)
    setActiveSlug('')
    setSelectedWorkspaceId('')
    await loadAuthAndOrgs()
    onOrgWorkspacesMutated?.()
  }

  const leaveName = detailOrg?.name ?? t('organizations.orgDetailTitle')
  const canManageSelected = selectedWorkspace
    ? isOrgAdmin
      || (!!currentLogin && selectedWorkspace.createdBy === currentLogin)
      || (!!currentLogin && selectedWorkspace.admins.includes(currentLogin))
    : false
  const canManageSelectedAdmins = selectedWorkspace
    ? isOrgAdmin || (!!currentLogin && selectedWorkspace.createdBy === currentLogin)
    : false

  async function handleOpenWorkspace(workspace: CovenantWorkspace): Promise<void> {
    if (!covenant || !detailOrg || !onOpenWorkspace) return
    const catalogKey = covenantWorkspaceCatalogKey(detailOrg.slug, workspace.id)
    if (!hasCovenantWorkspaceContentApi(covenant)) {
      onOpenWorkspace({
        orgWorkspace: { slug: detailOrg.slug, workspaceId: workspace.id, name: workspace.name },
        agents: [],
        contexts: [],
        catalogKey,
        accountId: activeAccountId,
      })
      onClose()
      return
    }
    setOpenBusy(true)
    setOpenError(null)
    const [agentsResult, contextsResult] = await Promise.all([
      covenant.workspaceAgentsList(detailOrg.slug, workspace.id),
      covenant.workspaceContextsList(detailOrg.slug, workspace.id),
    ])
    setOpenBusy(false)
    if (!agentsResult.ok) {
      setOpenError(agentsResult.error)
      return
    }
    if (!contextsResult.ok) {
      setOpenError(contextsResult.error)
      return
    }
    onOpenWorkspace({
      orgWorkspace: { slug: detailOrg.slug, workspaceId: workspace.id, name: workspace.name },
      agents: projectAgentsFromWorkspaceAgents(agentsResult.data),
      contexts: tabContextsFromWorkspaceContexts(contextsResult.data, {
        slug: detailOrg.slug,
        workspaceId: workspace.id,
      }),
      catalogKey,
      accountId: activeAccountId,
    })
    onClose()
  }

  function renderDetail(): React.ReactElement {
    if (!detailOrg) {
      if (bootstrapping) {
        return <OrgsDetailSkeleton label={t('organizations.loading')} />
      }
      return (
        <OrgsPanelEmpty
          label={t('organizations.orgDetailTitle')}
          title={t('organizations.detailSelectHint')}
        />
      )
    }
    if (settingsOpen) {
      return (
        <OrgSettingsPanel
          org={detailOrg}
          isOwner={isOwner}
          // El backend responde 403 al owner: no se sale de la propia
          // organización, se transfiere.
          canLeave={!!currentLogin && !isOwner}
          canDelete={canDeleteOrg}
          leaveError={leaveError}
          leaveBusy={leaveBusy}
          deleteBusy={deleteBusy}
          onBack={() => setDetailView('workspace')}
          onLeaveClick={() => {
            if (!currentLogin) return
            setLeaveError(null)
            setLeaveOpen(true)
          }}
          onDeleteClick={() => {
            setLeaveError(null)
            setDeleteOpen(true)
          }}
          peopleProps={{
            members,
            orgAdmins,
            canManageMembers,
            canManageRoles: orgAdminsAvailable,
            membersForbidden,
            loading: membersLoading || orgAdminsLoading,
            error: membersError ?? orgAdminsError,
            busy: membersBusy || orgAdminsBusy,
            loginDraft: memberLogin,
            onLoginDraftChange: setMemberLogin,
            onAdd: () => void handleAddMember(),
            onRemove: (login: string) => void handleRemoveMember(login),
            onRoleChange: handleOrgRoleChange,
          }}
        />
      )
    }
    if (!selectedWorkspace) {
      if (workspacesLoading) {
        return <OrgsDetailSkeleton label={t('organizations.loading')} />
      }
      if (workspaces.length === 0) {
        const canCreateWorkspace = isOrgAdmin && workspacesAvailable
        return (
          <OrgsPanelEmpty
            label={t('organizations.workspacesSection')}
            title={t('organizations.emptyWorkspacesTitle')}
            hint={t('organizations.emptyWorkspacesHint')}
            actionLabel={canCreateWorkspace ? t('organizations.formCreateWorkspace') : undefined}
            onAction={canCreateWorkspace ? () => toggleCompose('workspace') : undefined}
          />
        )
      }
      return (
        <OrgsPanelEmpty
          label={t('organizations.workspacesSection')}
          title={t('organizations.selectWorkspace')}
        />
      )
    }
    return (
      <WorkspaceDetailPanel
        slug={detailOrg.slug}
        workspace={selectedWorkspace}
        accountId={activeAccountId}
        memberLogins={personLogins}
        canManageAssignees={canManageSelected}
        canManageProjectAdmins={canManageSelectedAdmins}
        canDelete={canDeleteOwnedItem({
          isOwner,
          currentLogin,
          currentGithubId,
          createdBy: selectedWorkspace.createdBy,
          createdById: selectedWorkspace.createdById,
        })}
        busy={workspacesBusy}
        openBusy={openBusy}
        openError={openError}
        onOpenRequest={() => void handleOpenWorkspace(selectedWorkspace)}
        onDeleteRequest={workspace => setDeleteWorkspace(workspace)}
        onAssigneeAdd={login => void handleWorkspaceAssigneeAdd(selectedWorkspace.id, login)}
        onAssigneeRemove={login => void handleWorkspaceAssigneeRemove(selectedWorkspace.id, login)}
        onAdminAdd={login => void handleWorkspaceAdminAdd(selectedWorkspace.id, login)}
        onAdminRemove={login => void handleWorkspaceAdminRemove(selectedWorkspace.id, login)}
      />
    )
  }

  return (
    <>
      {open ? (
      <div
        className="organizations-view"
        role="region"
        aria-label={t('organizations.title')}
        style={{ zIndex: APP_OVERLAY_MODAL_Z }}
      >
        <header className="organizations-view__bar">
          <nav className="organizations-view__crumbs" aria-label={t('organizations.title')}>
            <span className="organizations-view__crumb">{t('organizations.title')}</span>
            {detailOrg ? (
              <>
                <span className="organizations-view__crumb-sep" aria-hidden>/</span>
                <span
                  className={`organizations-view__crumb${settingsOpen ? '' : ' organizations-view__crumb--current'}`}
                >
                  {detailOrg.name}
                </span>
              </>
            ) : null}
            {detailOrg && settingsOpen ? (
              <>
                <span className="organizations-view__crumb-sep" aria-hidden>/</span>
                <span className="organizations-view__crumb organizations-view__crumb--current">
                  {t('organizations.orgSettings')}
                </span>
              </>
            ) : null}
          </nav>
          <div className="organizations-view__bar-actions">
            <Tooltip content={t('organizations.closeView')}>
              <button
                type="button"
                className="organizations-view__icon"
                aria-label={t('organizations.closeView')}
                onClick={onClose}
              >
                <Icon name="close" size={12} />
              </button>
            </Tooltip>
          </div>
        </header>
        <div className="organizations-view__body">
          {!available ? (
            <p className="orgs-disabled">{t('organizations.unavailable')}</p>
          ) : !signedIn && !bootstrapping ? (
            <SignInPanel
              status={auth}
              loading={authLoading || orgsLoading}
              error={authError}
              busy={authBusy}
              onSignIn={() => void handleSignIn()}
            />
          ) : (
            <div className="orgs-shell">
              <OrgsColumn
                orgs={orgs}
                selectedSlug={detailSlug ?? activeSlug}
                loading={orgsLoading}
                error={orgsError ?? authError}
                busy={orgsBusy}
                composing={composing === 'org'}
                createName={createName}
                query={orgQuery}
                onQueryChange={setOrgQuery}
                status={auth}
                authBusy={authBusy}
                accounts={accounts}
                activeAccountId={activeAccountId}
                onAccountChange={setActiveAccountId}
                onCreateNameChange={setCreateName}
                onComposeToggle={() => toggleCompose('org')}
                onSelectOrg={openOrg}
                onCreate={() => void handleCreateOrg()}
                onSignOut={() => void handleSignOut()}
              />
              {detailOrg ? (
                <WorkspacesColumn
                  org={detailOrg}
                  workspaces={workspaces}
                  selectedWorkspaceId={selectedWorkspaceId}
                  settingsOpen={settingsOpen}
                  loading={workspacesLoading}
                  error={workspacesAvailable ? workspacesError : null}
                  busy={workspacesBusy}
                  canCreate={isOrgAdmin && workspacesAvailable}
                  composing={composing === 'workspace'}
                  nameDraft={workspaceName}
                  query={workspaceQuery}
                  onQueryChange={setWorkspaceQuery}
                  onNameDraftChange={setWorkspaceName}
                  onComposeToggle={() => toggleCompose('workspace')}
                  onCreate={() => void handleCreateWorkspace()}
                  onSelect={id => {
                    setSelectedWorkspaceId(id)
                    setDetailView('workspace')
                    setComposing(null)
                    setOpenError(null)
                  }}
                  onOpenSettings={() => {
                    setLeaveError(null)
                    setDetailView(prev => (prev === 'settings' ? 'workspace' : 'settings'))
                  }}
                />
              ) : (
                <div className="orgs-col">
                  <div className="orgs-col__head" />
                  <div className="orgs-col__body">
                    <OrgsNavSkeleton rows={4} label={t('organizations.loading')} />
                  </div>
                </div>
              )}
              {renderDetail()}
            </div>
          )}
        </div>
      </div>
      ) : null}

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
        open={deleteOpen}
        zIndex={760}
        message={t('organizations.deleteOrgConfirm', { name: detailOrg?.name ?? '' })}
        detail={t('organizations.deleteOrgConfirmDetail')}
        onConfirm={() => {
          if (!detailSlug) return
          void handleDeleteOrg(detailSlug)
        }}
        onCancel={() => {
          if (deleteBusy) return
          setDeleteOpen(false)
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
