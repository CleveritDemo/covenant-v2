import React, { useEffect, useMemo, useState } from 'react'
import type { AgentCliProvider, AgentPaneMeta, AgentPermissionMode } from '@shared/tabSession'
import type { AgentCliResolution } from '@shared/agentCliProviders'
import { agentCliSpec, providerCapabilities } from '@shared/agentCliProviders'
import type { AgentNativeSkills } from '@shared/projectAgentCatalog'
import type { TabContext } from '@shared/tabContext'
import type { AgentModelOption } from '@shared/agentCliModels'
import type { McpServerSummary } from '@shared/mcpContext'
import { mcpConfigLabelFor } from '@shared/mcpContext'
import { modelsForProvider } from '@shared/agentCliModels'
import {
  ORCHESTRATION_MAX_ROUNDS_CAP,
  coordinationCanDelegate,
  resolveOrchestrationMaxRounds,
  type AgentCoordination,
  type DelegateToPolicy,
} from '@shared/agentOrchestration'
import { useT } from '@i18n/useT'
import { Button, ChoiceCard, ContextCheckOption, Icon, SegmentedControl, Select, SettingToggle, TextArea } from '../components/ui'
import { AgentConfigContextSummary } from './AgentConfigContextSummary'
import { AgentProviderGrid } from './AgentProviderGrid'
import { AgentConfigFolderChip } from './AgentConfigFolderChip'
import {
  AgentDelegateToPolicyEditor,
  type DelegateToPeerAgent,
} from './AgentDelegateToPolicyEditor'
import './AgentConfigSettingsPane.css'

/** Secciones de ejecución que renderiza este bloque. */
export type AgentConfigSettingsSection =
  | 'engine'
  | 'permissions'
  | 'contexts'
  | 'orchestration'
  | 'capabilities'

export interface AgentConfigSettingsPaneProps {
  section: AgentConfigSettingsSection
  meta: AgentPaneMeta
  cwd: string
  loopMode: boolean
  loopActive: boolean
  locked: boolean
  diskContexts: TabContext[]
  selectedContextIds: string[]
  contextNotice: string
  /** Otros agentes del tab (exclusiones delegateTo). */
  peerAgents?: DelegateToPeerAgent[]
  /** Modelos del CLI (si el modal ya los cargó). */
  modelOptions?: AgentModelOption[]
  modelsLoading?: boolean
  modelsError?: string
  /** Reintento del listado de modelos del CLI. */
  onReloadModels?: () => void
  /** CLIs resueltos en el PATH; vacío mientras se comprueba. */
  cliStatuses?: Partial<Record<AgentCliProvider, AgentCliResolution>>
  onChangeCoordination: (coordination: AgentCoordination) => void
  onAcceptDelegationsChange: (accept: boolean) => void
  onAllowExpertReplicasChange: (allow: boolean) => void
  onOrchestrationMaxRoundsChange: (maxRounds: number) => void
  onChangeDelegateTo: (policy: DelegateToPolicy | undefined) => void
  onChangeProvider: (provider: AgentCliProvider) => void
  onChangeModel: (model: string) => void
  onChangePermission: (permissionMode: AgentPermissionMode) => void
  onChangeNativeSkills: (nativeSkills: AgentNativeSkills | undefined) => void
  onChangeMcpsAllowed: (mcpsAllowed: string[]) => void
  onToggleLoopMode: () => void
  onToggleContext: (contextId: string) => void
  onOpenContextsModal: () => void
  onAutoImproveChange: (checked: boolean) => void
}

function folderLabel(cwd: string): string {
  const normalized = cwd.replace(/[\\/]+$/, '')
  return normalized.split(/[\\/]/).pop() || cwd || '—'
}

/** `/Users/x/Sources/app` → `~/Sources/app`; el home completo no aporta nada. */
export function shortenHome(cwd: string): string {
  const path = cwd.trim().replace(/[\\/]+$/, '')
  if (!path) return ''
  const home = path.match(/^(?:\/Users\/|\/home\/|[A-Za-z]:\\Users\\)[^\\/]+/)
  return home ? `~${path.slice(home[0].length)}` : path
}

/**
 * Lista de identificadores, uno por línea. El estado es local y se entrega en
 * el blur: partir por líneas en cada tecla se comería el salto recién escrito.
 */
const LineListField: React.FC<{
  label: string
  hint?: string
  value: string[]
  disabled: boolean
  placeholder?: string
  onCommit: (lines: string[]) => void
}> = ({ label, hint, value, disabled, placeholder, onCommit }) => {
  const joined = value.join('\n')
  const [text, setText] = useState(joined)
  useEffect(() => { setText(joined) }, [joined])
  return (
    <label className="agent-config-settings__field">
      <span className="agent-config-settings__label">{label}</span>
      <TextArea
        value={text}
        rows={4}
        spellCheck={false}
        disabled={disabled}
        placeholder={placeholder}
        onChange={event => setText(event.target.value)}
        onBlur={() => onCommit(
          text.split('\n').map(line => line.trim()).filter(Boolean),
        )}
      />
      {hint ? <p className="agent-config-settings__hint">{hint}</p> : null}
    </label>
  )
}

/**
 * Allowlist de MCP por casillas, leyendo los servidores que ese CLI ve de
 * verdad. Un nombre guardado que ya no está en la config sigue apareciendo
 * marcado: borrarlo en silencio cambiaría lo que el agente puede usar sin que
 * nadie lo pida.
 */
const McpAllowlistField: React.FC<{
  provider: AgentCliProvider
  cwd: string
  value: string[]
  disabled: boolean
  onChange: (mcpsAllowed: string[]) => void
}> = ({ provider, cwd, value, disabled, onChange }) => {
  const { t } = useT()
  const [servers, setServers] = useState<McpServerSummary[] | null>(null)

  useEffect(() => {
    let alive = true
    setServers(null)
    window.api.listMcpServers({ provider, cwd })
      .then(list => { if (alive) setServers(list) })
      .catch(() => { if (alive) setServers([]) })
    return () => { alive = false }
  }, [provider, cwd])

  const options = useMemo(() => {
    const found = servers ?? []
    const known = new Set(found.map(server => server.name))
    return [
      ...found,
      ...value.filter(name => !known.has(name))
        .map(name => ({ name, transport: t('agentPane.mcpsMissing') })),
    ]
  }, [servers, value, t])

  const toggle = (name: string): void => onChange(
    value.includes(name) ? value.filter(item => item !== name) : [...value, name],
  )

  return (
    <div className="agent-config-settings__field">
      <span className="agent-config-settings__label">{t('agentPane.mcpsAllowedLabel')}</span>
      {servers === null ? (
        <p className="agent-config-settings__hint">{t('agentPane.mcpsLoading')}</p>
      ) : options.length === 0 ? (
        <p className="agent-config-settings__hint">
          {t('agentPane.mcpsEmpty', { file: mcpConfigLabelFor(provider) })}
        </p>
      ) : (
        <div role="listbox" aria-label={t('agentPane.mcpsAllowedLabel')}>
          {options.map(server => (
            <ContextCheckOption
              key={server.name}
              name={server.name}
              kindLabel={server.transport}
              checked={value.includes(server.name)}
              disabled={disabled}
              onChange={() => toggle(server.name)}
            />
          ))}
        </div>
      )}
      <p className="agent-config-settings__hint">{t('agentPane.mcpsAllowedHint')}</p>
    </div>
  )
}

const MAX_ROUNDS_OPTIONS = [
  0,
  ...Array.from(
    { length: ORCHESTRATION_MAX_ROUNDS_CAP },
    (_, index) => index + 1,
  ),
]

export const AgentConfigSettingsPane: React.FC<AgentConfigSettingsPaneProps> = ({
  section,
  meta,
  cwd,
  loopMode,
  loopActive,
  locked,
  diskContexts,
  selectedContextIds,
  contextNotice,
  peerAgents = [],
  modelOptions: modelOptionsProp,
  modelsLoading = false,
  modelsError = '',
  onReloadModels,
  cliStatuses = {},
  onChangeCoordination,
  onAcceptDelegationsChange,
  onAllowExpertReplicasChange,
  onOrchestrationMaxRoundsChange,
  onChangeDelegateTo,
  onChangeProvider,
  onChangeModel,
  onChangePermission,
  onChangeNativeSkills,
  onChangeMcpsAllowed,
  onToggleLoopMode,
  onToggleContext,
  onOpenContextsModal,
  onAutoImproveChange,
}) => {
  const { t } = useT()
  const [localModels, setLocalModels] = useState<AgentModelOption[]>(() => modelsForProvider(meta.provider))
  const [localLoading, setLocalLoading] = useState(false)
  const [localError, setLocalError] = useState('')

  useEffect(() => {
    if (modelOptionsProp) return
    let cancelled = false
    setLocalLoading(true)
    setLocalError('')
    setLocalModels(modelsForProvider(meta.provider))
    void window.api.listAgentCliModels(meta.provider).then(result => {
      if (cancelled) return
      if (result.models.length > 0) setLocalModels(result.models)
      setLocalError(result.error ?? '')
      setLocalLoading(false)
    }).catch(error => {
      if (cancelled) return
      setLocalModels(modelsForProvider(meta.provider))
      setLocalError(error instanceof Error ? error.message : String(error))
      setLocalLoading(false)
    })
    return () => { cancelled = true }
  }, [meta.provider, modelOptionsProp])

  const PERMISSION_MODES: Array<{
    value: AgentPermissionMode
    label: string
    hint: string
    icon: 'shield-question' | 'shield-off' | 'shield-check'
  }> = [
    { value: 'ask', label: t('agentPane.permissionAsk'), hint: t('agentPane.permissionAskHint'), icon: 'shield-question' },
    { value: 'auto', label: t('agentPane.permissionAuto'), hint: t('agentPane.permissionAutoHint'), icon: 'shield-off' },
    { value: 'plan', label: t('agentPane.permissionPlan'), hint: t('agentPane.permissionPlanHint'), icon: 'shield-check' },
  ]

  const modelOptions = modelOptionsProp ?? localModels
  const loadingModels = modelOptionsProp ? modelsLoading : localLoading
  const modelsErrorText = modelOptionsProp ? modelsError : localError
  const selectedModel = meta.model?.trim() ?? ''
  const modelIsCustom = Boolean(selectedModel && !modelOptions.some(option => option.id === selectedModel))
  const maxRounds = resolveOrchestrationMaxRounds(meta.orchestrationMaxRounds)

  if (section === 'engine') {
    const providerMissing = cliStatuses[meta.provider]?.path === null
    return (
      <div className="agent-config-settings__stack">
        <div className="agent-config-settings__field">
          <span className="agent-config-settings__label">{t('agentPane.providerLabel')}</span>
          <AgentProviderGrid
            value={meta.provider}
            statuses={cliStatuses}
            disabled={locked}
            onChange={onChangeProvider}
          />
          {providerMissing ? (
            <p className="agent-config-settings__hint agent-config-settings__hint--warn">
              {t('agentPane.providerMissingHint', {
                command: cliStatuses[meta.provider]?.command ?? '',
              })}
            </p>
          ) : null}
        </div>
        <label className="agent-config-settings__field">
          <span className="agent-config-settings__label">{t('agentPane.modelLabel')}</span>
          <Select
            value={selectedModel}
            disabled={locked || loadingModels}
            title={t('agentPane.modelHint')}
            onChange={onChangeModel}
            options={[
              { value: '', label: t('agentPane.modelDefault') },
              ...modelOptions.map(option => ({
                value: option.id,
                // El id sólo se repite si aporta algo sobre la etiqueta.
                hint: option.label === option.id ? undefined : option.id,
                label: option.label,
              })),
              ...(modelIsCustom ? [{ value: selectedModel, label: selectedModel }] : []),
            ]}
          />
          {loadingModels ? (
            <p className="agent-config-settings__hint">{t('agentPane.modelLoading')}</p>
          ) : null}
          {!loadingModels && !selectedModel ? (
            <p className="agent-config-settings__hint">{t('agentPane.modelDefaultHint')}</p>
          ) : null}
          {!loadingModels && modelsErrorText ? (
            <div className="agent-config-settings__error">
              <span>
                {t('agentPane.modelLoadErrorDetail', { detail: modelsErrorText.slice(0, 160) })}
              </span>
              {onReloadModels ? (
                <Button size="sm" onClick={onReloadModels} disabled={locked}>
                  {t('agentPane.modelRetry')}
                </Button>
              ) : null}
            </div>
          ) : null}
        </label>
        <div className="agent-config-settings__field">
          <span className="agent-config-settings__label">{t('agentPane.workingDirectory')}</span>
          <AgentConfigFolderChip
            label={cwd.trim() ? folderLabel(cwd) : t('agentPane.projectFolderUnset')}
            path={shortenHome(cwd)}
          />
          <p className="agent-config-settings__hint">{t('agentPane.projectFolderHint')}</p>
        </div>
      </div>
    )
  }

  if (section === 'permissions') {
    return (
      <div className="agent-config-settings__stack">
        <div
          className="agent-config-settings__cards"
          role="radiogroup"
          aria-label={t('agentPane.permissionLabel')}
        >
          {PERMISSION_MODES.map(mode => (
            <ChoiceCard
              key={mode.value}
              role="radio"
              aria-checked={mode.value === meta.permissionMode}
              selected={mode.value === meta.permissionMode}
              tone={mode.value === 'auto' ? 'warn' : 'default'}
              disabled={locked}
              icon={<Icon name={mode.icon} size={16} aria-hidden />}
              onClick={() => onChangePermission(mode.value)}
            >
              <strong>{mode.label}</strong>
              <span className="agent-config-settings__card-hint">{mode.hint}</span>
            </ChoiceCard>
          ))}
        </div>
      </div>
    )
  }

  if (section === 'capabilities') {
    const caps = providerCapabilities(meta.provider)
    const providerLabel = agentCliSpec(meta.provider).label
    const skillsOn = meta.nativeSkills?.enabled === true
    return (
      <div className="agent-config-settings__stack">
        <SettingToggle
          checked={skillsOn}
          disabled={locked || !caps.nativeSkills}
          title={t('agentPane.nativeSkillsLabel')}
          description={t('agentPane.nativeSkillsHint')}
          onChange={checked => onChangeNativeSkills(
            checked
              ? { enabled: true, ...(meta.nativeSkills?.namespaces ? { namespaces: meta.nativeSkills.namespaces } : {}) }
              : undefined,
          )}
        />
        {!caps.nativeSkills ? (
          <p className="agent-config-settings__hint agent-config-settings__hint--warn">
            {t('agentPane.nativeSkillsUnsupported', { provider: providerLabel })}
          </p>
        ) : null}
        {caps.nativeSkills && !caps.nativeSkillNamespaces ? (
          <p className="agent-config-settings__hint">
            {t('agentPane.nativeSkillsGateOnly', { provider: providerLabel })}
          </p>
        ) : null}
        {caps.nativeSkillNamespaces && skillsOn ? (
          <LineListField
            label={t('agentPane.nativeSkillsNamespacesLabel')}
            value={meta.nativeSkills?.namespaces ?? []}
            disabled={locked}
            placeholder="superpowers"
            onCommit={namespaces => onChangeNativeSkills({
              enabled: true,
              ...(namespaces.length ? { namespaces } : {}),
            })}
          />
        ) : null}
        <McpAllowlistField
          provider={meta.provider}
          cwd={cwd}
          value={meta.mcpsAllowed ?? []}
          disabled={locked || !caps.mcpAllowlist}
          onChange={onChangeMcpsAllowed}
        />
        {!caps.mcpAllowlist ? (
          <p className="agent-config-settings__hint agent-config-settings__hint--warn">
            {t('agentPane.mcpsUnsupported', { provider: providerLabel })}
          </p>
        ) : null}
      </div>
    )
  }

  if (section === 'orchestration') {
    return (
      <div className="agent-config-settings__stack">
        <div className="agent-config-settings__field">
          <span className="agent-config-settings__label">{t('agentPane.coordinationLabel')}</span>
          <SegmentedControl
            label={t('agentPane.coordinationLabel')}
            value={meta.coordination ?? 'none'}
            disabled={locked}
            options={[
              { value: 'none', label: t('agentPane.coordinationNone') },
              { value: 'orchestrator', label: t('agentPane.coordinationOrchestrator') },
              { value: 'productOwner', label: t('agentPane.coordinationProductOwner') },
            ]}
            onChange={onChangeCoordination}
          />
          <p className="agent-config-settings__hint">{t('agentPane.coordinationHint')}</p>
        </div>
        {coordinationCanDelegate(meta.coordination) ? (
          <>
            <label className="agent-config-settings__field">
              <span className="agent-config-settings__label">{t('agentPane.orchestrationMaxRoundsLabel')}</span>
              <Select
                value={String(maxRounds)}
                disabled={locked}
                title={t('agentPane.orchestrationMaxRoundsHint')}
                onChange={value => onOrchestrationMaxRoundsChange(Number(value))}
                options={MAX_ROUNDS_OPTIONS.map(value => ({
                  value: String(value),
                  label: value === 0
                    ? t('agentPane.orchestrationMaxRoundsUnlimited')
                    : String(value),
                }))}
              />
              <p className="agent-config-settings__hint">{t('agentPane.orchestrationMaxRoundsHint')}</p>
            </label>
            {meta.coordination === 'productOwner' ? (
              <div className="agent-config-settings__field">
                <span className="agent-config-settings__label">{t('agentPane.delegateToLabel')}</span>
                <p className="agent-config-settings__hint">{t('agentPane.delegateToProductOwnerFixed')}</p>
              </div>
            ) : (
              <AgentDelegateToPolicyEditor
                value={meta.delegateTo}
                agents={peerAgents}
                disabled={locked}
                onChange={onChangeDelegateTo}
              />
            )}
            <SettingToggle
              checked={meta.allowExpertReplicas === true}
              disabled={locked}
              title={t('agentPane.allowExpertReplicasLabel')}
              description={t('agentPane.allowExpertReplicasHint')}
              hint={t('agentPane.allowExpertReplicasHint')}
              onChange={onAllowExpertReplicasChange}
            />
          </>
        ) : (
          <SettingToggle
            checked={meta.acceptDelegations !== false}
            disabled={locked}
            title={t('agentPane.acceptDelegationsLabel')}
            description={t('agentPane.acceptDelegationsHint')}
            hint={t('agentPane.acceptDelegationsHint')}
            onChange={onAcceptDelegationsChange}
          />
        )}
        <SettingToggle
          checked={loopMode}
          disabled={locked}
          title={t('agentPane.loopTitle')}
          description={t('agentPane.loopHint')}
          onChange={() => onToggleLoopMode()}
        />
      </div>
    )
  }

  return (
    <AgentConfigContextSummary
      diskContexts={diskContexts}
      selectedContextIds={selectedContextIds}
      // Los contextos se materializan al enviar: cambiarlos en caliente solo
      // afecta al turno siguiente, así que no se bloquean.
      locked={false}
      loopActive={loopActive}
      autoImprove={meta.autoImproveContexts === true}
      agentId={meta.id}
      contextNotice={contextNotice}
      onToggleContext={onToggleContext}
      onOpenContextsModal={onOpenContextsModal}
      onAutoImproveChange={onAutoImproveChange}
    />
  )
}
