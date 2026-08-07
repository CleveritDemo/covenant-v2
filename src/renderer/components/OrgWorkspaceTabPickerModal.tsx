import React, { useEffect, useMemo, useState } from 'react'
import { useT } from '@i18n/useT'
import { TerminalModal } from './TerminalModal'
import { SettingsField } from './SettingsSection'
import { Button } from './ui/Button'
import { Select, type SelectOption } from './ui/Select'
import { Spinner } from './ui/Spinner'
import {
  getCovenantApi,
  hasCovenantWorkspacesApi,
  hasCovenantWorkspaceContentApi,
} from '../covenantApi'
import {
  covenantWorkspaceCatalogKey,
  type CovenantWorkspace,
} from '../../shared/covenantTypes'
import {
  projectAgentsFromWorkspaceAgents,
  tabContextsFromWorkspaceContexts,
} from '../../shared/orgWorkspaceContent'
import type { ProjectAgentDefinition } from '../../shared/projectAgentCatalog'
import type { TabContext } from '../../shared/tabContext'
import './OrganizationsModal.css'

const PERSONAL_VALUE = ''

export interface OrgWorkspaceSelection {
  /** Ausente = pestaña personal. */
  orgWorkspace?: { slug: string; workspaceId: string; name: string }
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
}

interface Props {
  open: boolean
  onClose: () => void
  onConfirm: (selection: OrgWorkspaceSelection) => void
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

/** True si hay al menos un workspace org accesible (signed-in + listados). */
export async function hasAccessibleOrgWorkspaces(): Promise<boolean> {
  const covenant = getCovenantApi()
  if (!covenant || !hasCovenantWorkspacesApi(covenant)) return false
  const status = await covenant.status()
  if (!status.ok || !status.data.signedIn) return false
  const orgsResult = await covenant.orgsList()
  if (!orgsResult.ok) return false
  for (const org of orgsResult.data) {
    const slug = org.slug?.trim()
    if (!slug) continue
    const list = await covenant.workspacesList(slug)
    if (list.ok && list.data.length > 0) return true
  }
  return false
}

export const OrgWorkspaceTabPickerModal: React.FC<Props> = ({
  open,
  onClose,
  onConfirm,
}) => {
  const { t } = useT()
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [options, setOptions] = useState<WorkspaceOption[]>([])
  const [value, setValue] = useState(PERSONAL_VALUE)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setBusy(false)
    setError(null)
    setValue(PERSONAL_VALUE)
    setOptions([])

    void (async () => {
      const covenant = getCovenantApi()
      if (!covenant || !hasCovenantWorkspacesApi(covenant)) {
        if (!cancelled) {
          setLoading(false)
          setOptions([])
        }
        return
      }
      const orgsResult = await covenant.orgsList()
      if (!orgsResult.ok) {
        if (!cancelled) {
          setLoading(false)
          setError(orgsResult.error || t('organizations.newTabWorkspaceError'))
        }
        return
      }
      const next: WorkspaceOption[] = []
      for (const org of orgsResult.data) {
        const slug = org.slug?.trim()
        if (!slug) continue
        const list = await covenant.workspacesList(slug)
        if (!list.ok) continue
        for (const workspace of list.data as CovenantWorkspace[]) {
          const workspaceId = workspace.id?.trim()
          const name = workspace.name?.trim()
          if (!workspaceId || !name) continue
          next.push({
            value: encodeWorkspaceValue(slug, workspaceId),
            slug,
            workspaceId,
            name,
            label: `${org.name || slug} · ${name}`,
          })
        }
      }
      if (cancelled) return
      setOptions(next)
      setLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [open, t])

  const selectOptions: SelectOption[] = useMemo(
    () => [
      { value: PERSONAL_VALUE, label: t('organizations.newTabWorkspacePersonal') },
      ...options.map(option => ({ value: option.value, label: option.label })),
    ],
    [options, t],
  )

  async function handleConfirm(): Promise<void> {
    if (busy || loading) return
    if (!value) {
      onConfirm({ agents: [], contexts: [], catalogKey: '' })
      return
    }
    const decoded = decodeWorkspaceValue(value)
    const option = options.find(item => item.value === value)
    if (!decoded || !option) {
      onConfirm({ agents: [], contexts: [], catalogKey: '' })
      return
    }
    const covenant = getCovenantApi()
    const catalogKey = covenantWorkspaceCatalogKey(decoded.slug, decoded.workspaceId)
    if (!covenant || !hasCovenantWorkspaceContentApi(covenant)) {
      onConfirm({
        orgWorkspace: {
          slug: decoded.slug,
          workspaceId: decoded.workspaceId,
          name: option.name,
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
      },
      agents: projectAgentsFromWorkspaceAgents(agentsResult.data),
      contexts: tabContextsFromWorkspaceContexts(contextsResult.data),
      catalogKey,
    })
  }

  return (
    <TerminalModal
      open={open}
      onClose={onClose}
      title={t('organizations.newTabWorkspaceTitle')}
      size="sm"
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
            disabled={loading || busy}
            onClick={() => void handleConfirm()}
          >
            {t('organizations.newTabWorkspaceConfirm')}
          </Button>
        </>
      }
    >
      <div className="orgs-stack">
        <p className="orgs-empty">{t('organizations.newTabWorkspaceHint')}</p>
        {loading ? (
          <div className="orgs-inline-status">
            <Spinner aria-label={t('organizations.newTabWorkspaceLoading')} />
            <span>{t('organizations.newTabWorkspaceLoading')}</span>
          </div>
        ) : (
          <SettingsField label={t('organizations.newTabWorkspaceLabel')}>
            <Select
              value={value}
              options={selectOptions}
              onChange={setValue}
              size="sm"
              disabled={busy}
              aria-label={t('organizations.newTabWorkspaceLabel')}
            />
          </SettingsField>
        )}
        {error ? <p className="orgs-section-error">{error}</p> : null}
      </div>
    </TerminalModal>
  )
}
