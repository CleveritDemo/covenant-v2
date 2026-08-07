import React, { useEffect, useState } from 'react'
import type { AgentCliProvider, AgentPaneMeta, AgentPermissionMode } from '@shared/tabSession'
import type { TabContext } from '@shared/tabContext'
import type { AgentModelOption } from '@shared/agentCliModels'
import { modelsForProvider } from '@shared/agentCliModels'
import {
  ORCHESTRATION_MAX_ROUNDS_CAP,
  coordinationCanDelegate,
  resolveOrchestrationMaxRounds,
  type AgentCoordination,
  type DelegateToPolicy,
} from '@shared/agentOrchestration'
import { useT } from '@i18n/useT'
import type { AgentCliStatusMap } from '@shared/agentCliStatus'
import { Button, ChoiceCard, Icon, SegmentedControl, Select, SettingToggle } from '../components/ui'
import { AgentConfigContextSummary } from './AgentConfigContextSummary'
import { AgentProviderGrid } from './AgentProviderGrid'
import { AgentConfigFolderChip } from './AgentConfigFolderChip'
import {
  AgentDelegateToPolicyEditor,
  type DelegateToPeerAgent,
} from './AgentDelegateToPolicyEditor'
import './AgentConfigSettingsPane.css'

/** Secciones de ejecución que renderiza este bloque. */
export type AgentConfigSettingsSection = 'engine' | 'permissions' | 'contexts' | 'orchestration'

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
  /** CLIs detectados en el PATH; vacío mientras se comprueba. */
  cliStatuses?: AgentCliStatusMap
  onChangeCoordination: (coordination: AgentCoordination) => void
  onAcceptDelegationsChange: (accept: boolean) => void
  onOrchestrationMaxRoundsChange: (maxRounds: number) => void
  onChangeDelegateTo: (policy: DelegateToPolicy | undefined) => void
  onChangeProvider: (provider: AgentCliProvider) => void
  onChangeModel: (model: string) => void
  onChangePermission: (permissionMode: AgentPermissionMode) => void
  onToggleLoopMode: () => void
  onToggleContext: (contextId: string) => void
  onOpenContextsModal: () => void
  onAutoImproveChange: (checked: boolean) => void
}

function folderLabel(cwd: string): string {
  const normalized = cwd.replace(/[\\/]+$/, '')
  return normalized.split(/[\\/]/).pop() || cwd || '—'
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
  onOrchestrationMaxRoundsChange,
  onChangeDelegateTo,
  onChangeProvider,
  onChangeModel,
  onChangePermission,
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
    const providerMissing = cliStatuses[meta.provider]?.found === false
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
            onChange={event => onChangeModel(event.target.value)}
          >
            <option value="">{t('agentPane.modelDefault')}</option>
            {modelOptions.map(option => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
            {modelIsCustom && <option value={selectedModel}>{selectedModel}</option>}
          </Select>
          {loadingModels ? (
            <p className="agent-config-settings__hint">{t('agentPane.modelLoading')}</p>
          ) : null}
          {!loadingModels && !selectedModel ? (
            <p className="agent-config-settings__hint">{t('agentPane.modelDefaultHint')}</p>
          ) : null}
          {!loadingModels && modelsErrorText ? (
            <div className="agent-config-settings__error">
              <span title={modelsErrorText}>
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
        <AgentConfigFolderChip
          label={cwd.trim() ? folderLabel(cwd) : t('agentPane.projectFolderUnset')}
          hint={t('agentPane.projectFolderHint')}
          title={cwd.trim() || t('agentPane.projectFolderUnset')}
        />
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
                onChange={event => onOrchestrationMaxRoundsChange(Number(event.target.value))}
              >
                {MAX_ROUNDS_OPTIONS.map(value => (
                  <option key={value} value={value}>
                    {value === 0
                      ? t('agentPane.orchestrationMaxRoundsUnlimited')
                      : value}
                  </option>
                ))}
              </Select>
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
