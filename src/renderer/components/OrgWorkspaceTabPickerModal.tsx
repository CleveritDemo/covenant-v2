import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useT } from '@i18n/useT'
import { TerminalModal } from './TerminalModal'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import {
  getCovenantApi,
  hasCovenantStatusAllApi,
  hasCovenantWorkspacesApi,
  hasCovenantWorkspaceContentApi,
  hasCovenantOrgAdminsApi,
} from '../covenantApi'
import {
  covenantWorkspaceCatalogKey,
  type CovenantWorkspace,
} from '../../shared/covenantTypes'
import {
  projectAgentsFromWorkspaceAgents,
  tabContextsFromWorkspaceContexts,
} from '../../shared/orgWorkspaceContent'
import type { OrgWorkspaceCatalogMap, OrgWorkspaceCatalogOption } from '../../shared/orgWorkspaceCatalog'
import {
  canAccessOrgWorkspace,
  canRenameOrgWorkspace,
  matchesWorkspaceQuery,
  orgWorkspaceOptionsFromCatalogMap,
  sameGithubLogin,
} from '../../shared/orgWorkspaceCatalog'
import { COVENANT_REQUEST_LIMIT, mapWithConcurrency } from '../../shared/boundedMap'
import type { ProjectAgentDefinition } from '../../shared/projectAgentCatalog'
import type { TabContext } from '../../shared/tabContext'
import './OrganizationsModal.css'

const PERSONAL_VALUE = ''

export interface OrgWorkspaceSelection {
  /** Ausente = pestaña personal. */
  orgWorkspace?: { slug: string; workspaceId: string; name: string; canPublish?: boolean }
  agents: ProjectAgentDefinition[]
  contexts: TabContext[]
  catalogKey: string
  /** Cuenta Covenant de la superficie que abre; App cae al cwd del tab si falta. */
  accountId?: string
}

interface WorkspaceOption {
  value: string
  slug: string
  workspaceId: string
  label: string
  name: string
  orgName: string
  login: string
  accountId: string
  canPublish: boolean
}

interface Props {
  open: boolean
  onClose: () => void
  onConfirm: (selection: OrgWorkspaceSelection) => void
  /** Snapshot en memoria: opciones al instante sin bloquear. */
  catalogMap?: OrgWorkspaceCatalogMap
}

function encodeWorkspaceValue(slug: string, workspaceId: string): string {
  return `${encodeURIComponent(slug)}/${encodeURIComponent(workspaceId)}`
}

function encodeOptionValue(accountId: string, slug: string, workspaceId: string): string {
  return `${encodeURIComponent(accountId)}|${encodeWorkspaceValue(slug, workspaceId)}`
}

function optionsFromCatalogOptions(entries: OrgWorkspaceCatalogOption[]): WorkspaceOption[] {
  return entries.map(entry => ({
    value: encodeOptionValue(entry.accountId, entry.slug, entry.workspaceId),
    slug: entry.slug,
    workspaceId: entry.workspaceId,
    name: entry.name,
    orgName: entry.orgName || entry.slug,
    login: entry.login,
    accountId: entry.accountId,
    label: `${entry.orgName || entry.slug} · ${entry.name}`,
    canPublish: entry.canRename === true,
  }))
}

export const OrgWorkspaceTabPickerModal: React.FC<Props> = ({
  open,
  onClose,
  onConfirm,
  catalogMap,
}) => {
  const { t } = useT()
  const catalogMapRef = useRef(catalogMap)
  catalogMapRef.current = catalogMap
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [options, setOptions] = useState<WorkspaceOption[]>(() =>
    optionsFromCatalogOptions(orgWorkspaceOptionsFromCatalogMap(catalogMap)),
  )
  const [value, setValue] = useState(PERSONAL_VALUE)
  const [query, setQuery] = useState('')
  const [signedInAccountCount, setSignedInAccountCount] = useState<number | null>(null)

  useEffect(() => {
    if (!open) return
    setBusy(false)
    setError(null)
    setValue(PERSONAL_VALUE)
    setQuery('')
    setOptions(optionsFromCatalogOptions(orgWorkspaceOptionsFromCatalogMap(catalogMapRef.current)))
    setSignedInAccountCount(null)
  }, [open])

  useEffect(() => {
    if (signedInAccountCount === 0 && value !== PERSONAL_VALUE) {
      setValue(PERSONAL_VALUE)
    }
  }, [signedInAccountCount, value])

  // Refresh en segundo plano: no bloquea el Select.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    void (async () => {
      const defaultApi = getCovenantApi()
      if (!defaultApi) return
      const accountIds: string[] = []
      if (defaultApi && hasCovenantStatusAllApi(defaultApi)) {
        const allStatus = await defaultApi.statusAll()
        if (cancelled) return
        if (allStatus.ok) {
          for (const [id, statusRow] of Object.entries(allStatus.data)) {
            if (statusRow.signedIn) accountIds.push(id)
          }
        }
      }
      if (accountIds.length === 0) {
        accountIds.push('')
      }

      let signedInCount = 0
      const perAccount = await mapWithConcurrency(
        accountIds,
        COVENANT_REQUEST_LIMIT,
        async id => {
          const covenant = getCovenantApi(id)
          if (!covenant || !hasCovenantWorkspacesApi(covenant)) return [] as WorkspaceOption[]
          const status = await covenant.status()
          if (cancelled) return [] as WorkspaceOption[]
          if (!status.ok || !status.data.signedIn) return [] as WorkspaceOption[]
          const login = status.data.login?.trim() ?? ''
          if (!login) return [] as WorkspaceOption[]
          signedInCount += 1
          const orgsResult = await covenant.orgsList()
          if (!orgsResult.ok || cancelled) return [] as WorkspaceOption[]
          const next: WorkspaceOption[] = []
          for (const org of orgsResult.data) {
            const slug = org.slug?.trim()
            if (!slug) continue
            const list = await covenant.workspacesList(slug)
            if (!list.ok || cancelled) continue
            const orgRole = org.role?.trim() ?? ''
            let isOrgAdmin = orgRole === 'owner' || orgRole === 'admin'
            if (!isOrgAdmin && hasCovenantOrgAdminsApi(covenant)) {
              const admins = await covenant.orgAdminsList(slug)
              if (cancelled) return [] as WorkspaceOption[]
              if (admins.ok) isOrgAdmin = admins.data.some(a => sameGithubLogin(a, login))
            }
            for (const workspace of list.data as CovenantWorkspace[]) {
              const workspaceId = workspace.id?.trim()
              const name = workspace.name?.trim()
              if (!workspaceId || !name) continue
              if (!canAccessOrgWorkspace({
                login,
                orgRole: org.role ?? '',
                isOrgAdmin,
                createdBy: workspace.createdBy,
                admins: workspace.admins,
                assignees: workspace.assignees,
              })) continue
              next.push({
                value: encodeOptionValue(id, slug, workspaceId),
                slug,
                workspaceId,
                name,
                orgName: org.name || slug,
                login,
                accountId: id,
                label: `${org.name || slug} · ${name}`,
                canPublish: canRenameOrgWorkspace({
                  login,
                  orgRole,
                  isOrgAdmin,
                  createdBy: workspace.createdBy,
                  admins: workspace.admins,
                }),
              })
            }
          }
          return next
        },
      )
      if (cancelled) return
      const next = perAccount.flat()
      setSignedInAccountCount(signedInCount)
      setOptions(prev => {
        const prevKey = prev.map(o => o.value).join('|')
        const nextKey = next.map(o => o.value).join('|')
        return prevKey === nextKey ? prev : next
      })
    })()
    return () => {
      cancelled = true
    }
  }, [open])

  const multiAccount = useMemo(
    () => new Set(options.map(o => o.login)).size > 1,
    [options],
  )

  // Agrupado por org y filtrado: con más de tres orgs una lista plana no se lee.
  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const byOrg = new Map<string, WorkspaceOption[]>()
    for (const option of options) {
      const matches = matchesWorkspaceQuery(option, query)
        || (needle ? option.login.toLowerCase().includes(needle) : false)
      if (!matches) continue
      const groupKey = multiAccount ? `${option.login} · ${option.orgName}` : option.orgName
      const bucket = byOrg.get(groupKey)
      if (bucket) bucket.push(option)
      else byOrg.set(groupKey, [option])
    }
    return [...byOrg.entries()].map(([orgName, items]) => ({ orgName, items }))
  }, [options, query, multiAccount])

  function describeConfirmError(raw: string): string {
    // 'Not signed in' es el literal que lanza electron/covenantApi.ts en el 401; si cambia allá, cambiarlo acá.
    if (raw === 'Not signed in') return t('organizations.newTabWorkspaceSignedOut')
    return raw
  }

  async function handleConfirm(target: string = value): Promise<void> {
    if (busy) return
    if (!target) {
      onConfirm({ agents: [], contexts: [], catalogKey: '' })
      return
    }
    const option = options.find(item => item.value === target)
    if (!option) {
      onConfirm({ agents: [], contexts: [], catalogKey: '' })
      return
    }
    const covenant = getCovenantApi(option.accountId)
    const catalogKey = covenantWorkspaceCatalogKey(option.slug, option.workspaceId)
    if (!covenant || !hasCovenantWorkspaceContentApi(covenant)) {
      onConfirm({
        orgWorkspace: {
          slug: option.slug,
          workspaceId: option.workspaceId,
          name: option.name,
          canPublish: option.canPublish,
        },
        agents: [],
        contexts: [],
        catalogKey,
        accountId: option.accountId,
      })
      return
    }
    setBusy(true)
    setError(null)
    const [agentsResult, contextsResult] = await Promise.all([
      covenant.workspaceAgentsList(option.slug, option.workspaceId),
      covenant.workspaceContextsList(option.slug, option.workspaceId),
    ])
    setBusy(false)
    if (!agentsResult.ok) {
      setError(describeConfirmError(agentsResult.error))
      return
    }
    if (!contextsResult.ok) {
      setError(describeConfirmError(contextsResult.error))
      return
    }
    onConfirm({
      orgWorkspace: {
        slug: option.slug,
        workspaceId: option.workspaceId,
        name: option.name,
        canPublish: option.canPublish,
      },
      agents: projectAgentsFromWorkspaceAgents(agentsResult.data),
      contexts: tabContextsFromWorkspaceContexts(contextsResult.data, {
        slug: option.slug,
        workspaceId: option.workspaceId,
      }),
      catalogKey,
      accountId: option.accountId,
    })
  }

  return (
    <TerminalModal
      open={open}
      onClose={onClose}
      title={t('organizations.newTabWorkspaceTitle')}
      size="md"
      zIndex={760}
      bodyLayout="spacious"
      closeOnBackdrop={!busy}
      footer={
        <>
          <Button variant="secondary" size="sm" disabled={busy} onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={busy}
            onClick={() => void handleConfirm()}
          >
            {t('organizations.newTabWorkspaceConfirm')}
          </Button>
        </>
      }
    >
      <div className="orgs-picker">
        <p className="orgs-empty">{t('organizations.newTabWorkspaceHint')}</p>
        <Input
          type="text"
          size="sm"
          autoFocus
          value={query}
          disabled={busy}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !busy) void handleConfirm()
          }}
          placeholder={t('organizations.searchWorkspaces')}
          spellCheck={false}
          aria-label={t('organizations.searchWorkspaces')}
        />
        <ul className="orgs-picker__list" aria-label={t('organizations.newTabWorkspaceLabel')}>
          <li>
            <button
              type="button"
              className={`orgs-nav__item${value === PERSONAL_VALUE ? ' is-selected' : ''}`}
              disabled={busy}
              aria-current={value === PERSONAL_VALUE}
              onClick={() => setValue(PERSONAL_VALUE)}
            >
              <span className="orgs-nav__text">
                <span className="orgs-nav__title">{t('organizations.newTabWorkspacePersonal')}</span>
                <span className="orgs-nav__meta">{t('organizations.personalTabHint')}</span>
              </span>
            </button>
          </li>
          {signedInAccountCount === 0 ? (
            <li>
              <p className="orgs-empty">{t('organizations.newTabWorkspaceSignedOut')}</p>
            </li>
          ) : (
            <>
              {groups.map(group => (
                <React.Fragment key={group.orgName}>
                  <li>
                    <p className="orgs-picker__group">{group.orgName}</p>
                  </li>
                  {group.items.map(option => {
                    const selected = option.value === value
                    return (
                      <li key={option.value}>
                        <button
                          type="button"
                          className={`orgs-nav__item${selected ? ' is-selected' : ''}`}
                          disabled={busy}
                          aria-current={selected}
                          onClick={() => setValue(option.value)}
                          onDoubleClick={() => {
                            setValue(option.value)
                            if (!busy) void handleConfirm(option.value)
                          }}
                        >
                          <span className="orgs-nav__text">
                            <span className="orgs-nav__title">{option.name}</span>
                            <span className="orgs-nav__meta">{option.slug}</span>
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </React.Fragment>
              ))}
              {groups.length === 0 && query.trim() ? (
                <li>
                  <p className="orgs-empty">{t('organizations.noWorkspaceMatches')}</p>
                </li>
              ) : null}
            </>
          )}
        </ul>
        {error ? <p className="orgs-section-error">{error}</p> : null}
      </div>
    </TerminalModal>
  )
}
