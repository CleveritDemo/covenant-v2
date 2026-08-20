import React, { useEffect, useState } from 'react'
import type { AgentCliProvider, AgentPaneMeta, AgentPermissionMode } from '@shared/tabSession'
import type { AgentCliResolution } from '@shared/agentCliProviders'
import { agentCliSpec, providerCapabilities, AGENT_CLI_PROVIDER_IDS } from '@shared/agentCliProviders'
import { pickProviderChoice, providerMapsPlanMode, type ProviderPair } from '@shared/agentHarnessFallback'
import type { AgentNativeSkills } from '@shared/projectAgentCatalog'
import type { TabContext } from '@shared/tabContext'
import type { AgentModelOption } from '@shared/agentCliModels'
import { modelsForProvider } from '@shared/agentCliModels'
import {
  DELEGATIONS_PER_TURN_CAP,
  ORCHESTRATION_MAX_ROUNDS_CAP,
  coordinationCanDelegate,
  resolveOrchestrationMaxRounds,
  resolveOrchestrationWorkStyle,
  sanitizeMaxDelegationsPerTurn,
  type AgentCoordination,
  type DelegateToPolicy,
  type OrchestrationWorkStyle,
} from '@shared/agentOrchestration'
import { useT } from '@i18n/useT'
import { Button, ChoiceCard, ContextCheckOption, COORDINATION_ICON, Icon, SegmentedControl, Select, SettingToggle, TextArea } from '../components/ui'
import { AgentConfigContextSummary } from './AgentConfigContextSummary'
import type { ContextPickerAgent } from '@shared/agentContextPicker'
import { AgentProviderGrid } from './AgentProviderGrid'
import { McpToolShelf } from './McpToolShelf'
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
  locked: boolean
  diskContexts: TabContext[]
  selectedContextIds: string[]
  /** Otros agentes del tab (exclusiones delegateTo). */
  peerAgents?: DelegateToPeerAgent[]
  /** Catálogo del proyecto: uso de contextos por agente. */
  projectAgents?: ContextPickerAgent[]
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
  onOrchestrationMaxRoundsChange: (maxRounds: number) => void
  onMaxDelegationsPerTurnChange: (maxDelegations: number) => void
  onOrchestrationWorkStyleChange: (workStyle: OrchestrationWorkStyle) => void
  onChangeDelegateTo: (policy: DelegateToPolicy | undefined) => void
  onChangeProvider: (provider: AgentCliProvider | undefined) => void
  /** Un solo write del par primario/respaldo (evita pisar meta entre handlers). */
  onChangeProviderPair: (pair: ProviderPair) => void
  onChangeFallbackProvider: (next?: AgentCliProvider) => void
  onChangeModel: (model: string) => void
  onChangeFallbackModel: (model: string) => void
  onChangePermission: (permissionMode: AgentPermissionMode) => void
  onChangeNativeSkills: (nativeSkills: AgentNativeSkills | undefined) => void
  onChangeMcpsAllowed: (mcpsAllowed: string[]) => void
  onToggleContext: (contextId: string) => void
  onOpenContextsModal: () => void
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

const MAX_ROUNDS_OPTIONS = [
  0,
  ...Array.from(
    { length: ORCHESTRATION_MAX_ROUNDS_CAP },
    (_, index) => index + 1,
  ),
]

const MAX_DELEGATIONS_PER_TURN_OPTIONS = [
  0,
  ...Array.from(
    { length: DELEGATIONS_PER_TURN_CAP },
    (_, index) => index + 1,
  ),
]

export const AgentConfigSettingsPane: React.FC<AgentConfigSettingsPaneProps> = ({
  section,
  meta,
  cwd,
  locked,
  diskContexts,
  selectedContextIds,
  peerAgents = [],
  projectAgents = [],
  modelOptions: modelOptionsProp,
  modelsLoading = false,
  modelsError = '',
  onReloadModels,
  cliStatuses = {},
  onChangeCoordination,
  onAcceptDelegationsChange,
  onOrchestrationMaxRoundsChange,
  onMaxDelegationsPerTurnChange,
  onOrchestrationWorkStyleChange,
  onChangeDelegateTo,
  onChangeProvider,
  onChangeProviderPair,
  onChangeFallbackProvider,
  onChangeModel,
  onChangeFallbackModel,
  onChangePermission,
  onChangeNativeSkills,
  onChangeMcpsAllowed,
  onToggleContext,
  onOpenContextsModal,
}) => {
  const { t } = useT()
  const [localModels, setLocalModels] = useState<AgentModelOption[]>(() => (
    meta.provider ? modelsForProvider(meta.provider) : []
  ))
  const [localLoading, setLocalLoading] = useState(false)
  const [localError, setLocalError] = useState('')
  const fallbackProvider = meta.fallbackProvider
  const [fallbackModels, setFallbackModels] = useState<AgentModelOption[]>(() => (
    fallbackProvider ? modelsForProvider(fallbackProvider) : []
  ))
  const [fallbackModelsLoading, setFallbackModelsLoading] = useState(false)
  const [fallbackModelsError, setFallbackModelsError] = useState('')

  useEffect(() => {
    if (modelOptionsProp) return
    if (!meta.provider) {
      setLocalModels([])
      setLocalLoading(false)
      setLocalError('')
      return
    }
    const provider = meta.provider
    let cancelled = false
    setLocalLoading(true)
    setLocalError('')
    setLocalModels(modelsForProvider(provider))
    void window.api.listAgentCliModels(provider).then(result => {
      if (cancelled) return
      if (result.models.length > 0) setLocalModels(result.models)
      setLocalError(result.error ?? '')
      setLocalLoading(false)
    }).catch(error => {
      if (cancelled) return
      setLocalModels(modelsForProvider(provider))
      setLocalError(error instanceof Error ? error.message : String(error))
      setLocalLoading(false)
    })
    return () => { cancelled = true }
  }, [meta.provider, modelOptionsProp])

  useEffect(() => {
    if (!fallbackProvider) return
    let cancelled = false
    setFallbackModelsLoading(true)
    setFallbackModelsError('')
    setFallbackModels(modelsForProvider(fallbackProvider))
    void window.api.listAgentCliModels(fallbackProvider).then(result => {
      if (cancelled) return
      if (result.models.length > 0) setFallbackModels(result.models)
      setFallbackModelsError(result.error ?? '')
      setFallbackModelsLoading(false)
    }).catch(error => {
      if (cancelled) return
      setFallbackModels(modelsForProvider(fallbackProvider))
      setFallbackModelsError(error instanceof Error ? error.message : String(error))
      setFallbackModelsLoading(false)
    })
    return () => { cancelled = true }
  }, [fallbackProvider])

  const PERMISSION_MODES: Array<{
    value: AgentPermissionMode
    label: string
    hint: string
    icon: 'shield-off' | 'shield-check'
  }> = [
    { value: 'auto', label: t('agentPane.permissionAuto'), hint: t('agentPane.permissionAutoHint'), icon: 'shield-off' },
    { value: 'plan', label: t('agentPane.permissionPlan'), hint: t('agentPane.permissionPlanHint'), icon: 'shield-check' },
  ]

  const modelOptions = modelOptionsProp ?? localModels
  const loadingModels = modelOptionsProp ? modelsLoading : localLoading
  const modelsErrorText = modelOptionsProp ? modelsError : localError
  const selectedModel = meta.model?.trim() ?? ''
  const maxRounds = resolveOrchestrationMaxRounds(meta.orchestrationMaxRounds)
  const maxDelegationsPerTurn = sanitizeMaxDelegationsPerTurn(meta.maxDelegationsPerTurn)
  const workStyle = resolveOrchestrationWorkStyle(meta.coordination, meta.orchestrationWorkStyle)

  if (section === 'engine') {
    const providerMissing = meta.provider
      ? cliStatuses[meta.provider]?.path === null
      : false
    const fallbackId = meta.fallbackProvider
    const fallbackMissing = fallbackId ? cliStatuses[fallbackId]?.path === null : false
    const fallbackDisabledIds = meta.permissionMode === 'plan'
      ? AGENT_CLI_PROVIDER_IDS.filter(
        id => id !== meta.provider && !providerMapsPlanMode(id),
      )
      : []
    const selectedFallbackModel = (meta as { fallbackModel?: string }).fallbackModel?.trim() ?? ''
    return (
      <div className="agent-config-settings__stack">
        <div className="agent-config-settings__field">
          <span className="agent-config-settings__label">{t('agentPane.providerLabel')}</span>
          <AgentProviderGrid
            value={meta.provider}
            fallbackValue={meta.fallbackProvider}
            statuses={cliStatuses}
            disabled={locked}
            fallbackDisabledIds={fallbackDisabledIds}
            primaryModel={meta.provider ? {
              value: selectedModel,
              options: modelOptions,
              loading: loadingModels,
              disabled: locked,
            } : undefined}
            fallbackModel={fallbackId ? {
              value: selectedFallbackModel,
              options: fallbackModels,
              loading: fallbackModelsLoading,
              disabled: locked,
            } : undefined}
            onChangeModel={onChangeModel}
            onChangeFallbackModel={onChangeFallbackModel}
            onPick={picked => {
              onChangeProviderPair(pickProviderChoice(
                {
                  provider: meta.provider,
                  fallbackProvider: fallbackId,
                  model: meta.model,
                  fallbackModel: meta.fallbackModel,
                },
                picked,
              ))
            }}
          />
          <p className="agent-config-settings__hint">{t('agentPane.fallbackProviderHint')}</p>
          {!fallbackId ? (
            <p className="agent-config-settings__hint">{t('agentPane.fallbackNone')}</p>
          ) : null}
          {providerMissing && meta.provider ? (
            <p className="agent-config-settings__hint agent-config-settings__hint--warn">
              {t('agentPane.providerMissingHint', {
                command: cliStatuses[meta.provider]?.command ?? '',
              })}
            </p>
          ) : null}
          {fallbackMissing ? (
            <p className="agent-config-settings__hint agent-config-settings__hint--warn">
              {t('agentPane.providerMissingHint', {
                command: cliStatuses[fallbackId]?.command ?? '',
              })}
            </p>
          ) : null}
          {meta.provider && loadingModels ? (
            <p className="agent-config-settings__hint">{t('agentPane.modelLoading')}</p>
          ) : null}
          {meta.provider && !loadingModels && !selectedModel ? (
            <p className="agent-config-settings__hint">{t('agentPane.modelDefaultHint')}</p>
          ) : null}
          {meta.provider && !loadingModels && modelsErrorText ? (
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
          {fallbackId ? (
            <p className="agent-config-settings__hint">{t('agentPane.fallbackModelHint')}</p>
          ) : null}
          {fallbackId && !fallbackModelsLoading && fallbackModelsError ? (
            <p className="agent-config-settings__hint agent-config-settings__hint--warn">
              {t('agentPane.modelLoadErrorDetail', { detail: fallbackModelsError.slice(0, 160) })}
            </p>
          ) : null}
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
    const caps = meta.provider
      ? providerCapabilities(meta.provider)
      : { nativeSkills: false, nativeSkillNamespaces: false, mcpAllowlist: false }
    const providerLabel = meta.provider
      ? agentCliSpec(meta.provider).label
      : t('agentPane.providerLabel')
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
        {meta.provider ? (
          <McpToolShelf
            provider={meta.provider}
            cwd={cwd}
            value={meta.mcpsAllowed ?? []}
            locked={locked}
            canScope={caps.mcpAllowlist}
            onChange={onChangeMcpsAllowed}
          />
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
              { value: 'orchestrator', label: t('agentPane.coordinationOrchestrator'), icon: COORDINATION_ICON.orchestrator },
              { value: 'productOwner', label: t('agentPane.coordinationProductOwner'), icon: COORDINATION_ICON.productOwner },
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
            <label className="agent-config-settings__field">
              <span className="agent-config-settings__label">{t('agentPane.maxDelegationsPerTurnLabel')}</span>
              <Select
                value={String(maxDelegationsPerTurn)}
                disabled={locked}
                title={t('agentPane.maxDelegationsPerTurnHint')}
                onChange={value => onMaxDelegationsPerTurnChange(Number(value))}
                options={MAX_DELEGATIONS_PER_TURN_OPTIONS.map(value => ({
                  value: String(value),
                  label: value === 0
                    ? t('agentPane.orchestrationMaxRoundsUnlimited')
                    : String(value),
                }))}
              />
              <p className="agent-config-settings__hint">{t('agentPane.maxDelegationsPerTurnHint')}</p>
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
            {meta.coordination === 'orchestrator' ? (
              <SettingToggle
                checked={workStyle === 'turbo'}
                disabled={locked}
                title={t('agentPane.orchestrationWorkStyleLabel')}
                description={t('agentPane.orchestrationWorkStyleHint')}
                hint={t('agentPane.orchestrationWorkStyleHint')}
                onChange={checked => onOrchestrationWorkStyleChange(checked ? 'turbo' : 'linear')}
              />
            ) : null}
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
      agentId={meta.id}
      projectAgents={projectAgents}
      onToggleContext={onToggleContext}
      onOpenContextsModal={onOpenContextsModal}
    />
  )
}
