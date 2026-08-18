import React, { useEffect, useMemo, useState } from 'react'
import { useT } from '@i18n/useT'
import { TerminalModal } from './TerminalModal'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import {
  getCovenantApi,
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
import type { OrgWorkspaceCatalogEntry } from '../../shared/orgWorkspaceCatalog'
import {
  canAccessOrgWorkspace,
  canRenameOrgWorkspace,
  matchesWorkspaceQuery,
  sameGithubLogin,
} from '../../shared/orgWorkspaceCatalog'
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
}

interface WorkspaceOption {
  value: string
  slug: string
  workspaceId: string
  label: string
  name: string
  orgName: string
  canPublish: boolean
}

interface Props {
  open: boolean
  onClose: () => void
  onConfirm: (selection: OrgWorkspaceSelection) => void
  /** Snapshot en memoria: opciones al instante sin bloquear. */
  catalog?: OrgWorkspaceCatalogEntry[]
  accountId?: string
}

function encodeWorkspaceValue(slug: string, workspaceId: string): string {
  return `${encodeURIComponent(slug)}/${encodeURIComponent(workspaceId)}`
}

function decodeWorkspaceValue(value: string): { slug: string; workspaceId: string } | null {
  const slash = value.indexOf('/')
  if (slash <= 0) return null
  try {
    const slug = decodeURIComponent(value.slice(0, slash))
    const workspaceId = decodeURIComponent(value.slice(slash + 1))
    if (!slug || !workspaceId) return null
    return { slug, workspaceId }
  } catch {
    return null
  }
}

function optionsFromCatalog(entries: OrgWorkspaceCatalogEntry[]): WorkspaceOption[] {
  return entries.map(entry => ({
    value: encodeWorkspaceValue(entry.slug, entry.workspaceId),
    slug: entry.slug,
    workspaceId: entry.workspaceId,
    name: entry.name,
    orgName: entry.orgName || entry.slug,
    label: `${entry.orgName || entry.slug} · ${entry.name}`,
    canPublish: entry.canRename === true,
  }))
}

export const OrgWorkspaceTabPickerModal: React.FC<Props> = ({
  open,
  onClose,
  onConfirm,
  catalog,
  accountId = '',
}) => {
  const { t } = useT()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [options, setOptions] = useState<WorkspaceOption[]>(() => optionsFromCatalog(catalog ?? []))
  const [value, setValue] = useState(PERSONAL_VALUE)
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!open) return
    setBusy(false)
    setError(null)
    setValue(PERSONAL_VALUE)
    setQuery('')
    setOptions(optionsFromCatalog(catalog ?? []))
  }, [open, catalog])

  // Refresh en segundo plano: no bloquea el Select.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    void (async () => {
      const covenant = getCovenantApi(accountId)
      if (!covenant || !hasCovenantWorkspacesApi(covenant)) return
      const status = await covenant.status()
      if (!status.ok || !status.data.signedIn || cancelled) return
      const login = status.data.login?.trim() ?? ''
      if (!login) return
      const orgsResult = await covenant.orgsList()
      if (!orgsResult.ok || cancelled) return
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
          if (cancelled) return
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
            value: encodeWorkspaceValue(slug, workspaceId),
            slug,
            workspaceId,
            name,
            orgName: org.name || slug,
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
      if (cancelled) return
      setOptions(prev => {
        const prevKey = prev.map(o => o.value).join('|')
        const nextKey = next.map(o => o.value).join('|')
        return prevKey === nextKey ? prev : next
      })
    })()
    return () => {
      cancelled = true
    }
  }, [open, accountId])

  // Agrupado por org y filtrado: con más de tres orgs una lista plana no se lee.
  const groups = useMemo(() => {
    const byOrg = new Map<string, WorkspaceOption[]>()
    for (const option of options) {
      if (!matchesWorkspaceQuery(option, query)) continue
      const bucket = byOrg.get(option.orgName)
      if (bucket) bucket.push(option)
      else byOrg.set(option.orgName, [option])
    }
    return [...byOrg.entries()].map(([orgName, items]) => ({ orgName, items }))
  }, [options, query])

  async function handleConfirm(target: string = value): Promise<void> {
    if (busy) return
    if (!target) {
      onConfirm({ agents: [], contexts: [], catalogKey: '' })
      return
    }
    const decoded = decodeWorkspaceValue(target)
    const option = options.find(item => item.value === target)
    if (!decoded || !option) {
      onConfirm({ agents: [], contexts: [], catalogKey: '' })
      return
    }
    const covenant = getCovenantApi(accountId)
    const catalogKey = covenantWorkspaceCatalogKey(decoded.slug, decoded.workspaceId)
    if (!covenant || !hasCovenantWorkspaceContentApi(covenant)) {
      onConfirm({
        orgWorkspace: {
          slug: decoded.slug,
          workspaceId: decoded.workspaceId,
          name: option.name,
          canPublish: option.canPublish,
        },
        agents: [],
        contexts: [],
        catalogKey,
      })
      return
    }
    setBusy(true)
    setError(null)
    const [agentsResult, contextsResult] = await Promise.all([
      covenant.workspaceAgentsList(decoded.slug, decoded.workspaceId),
      covenant.workspaceContextsList(decoded.slug, decoded.workspaceId),
    ])
    setBusy(false)
    if (!agentsResult.ok) {
      setError(agentsResult.error)
      return
    }
    if (!contextsResult.ok) {
      setError(contextsResult.error)
      return
    }
    onConfirm({
      orgWorkspace: {
        slug: decoded.slug,
        workspaceId: decoded.workspaceId,
        name: option.name,
        canPublish: option.canPublish,
      },
      agents: projectAgentsFromWorkspaceAgents(agentsResult.data),
      contexts: tabContextsFromWorkspaceContexts(contextsResult.data, {
        slug: decoded.slug,
        workspaceId: decoded.workspaceId,
      }),
      catalogKey,
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
        </ul>
        {error ? <p className="orgs-section-error">{error}</p> : null}
      </div>
    </TerminalModal>
  )
}
