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
import { SegmentedControl, Select, SettingToggle } from '../components/ui'
import { AgentConfigContextSummary } from './AgentConfigContextSummary'
import { AgentConfigFolderChip } from './AgentConfigFolderChip'
import {
  AgentDelegateToPolicyEditor,
  type DelegateToPeerAgent,
} from './AgentDelegateToPolicyEditor'
import './AgentConfigSettingsPane.css'

export type AgentConfigSettingsTab = 'runtime' | 'permissions' | 'contexts'

export interface AgentConfigSettingsPaneProps {
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
  /** Al abrir la pestaña Contextos: refrescar catálogo de disco. */
  onContextsTabFocus?: () => void
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
  onContextsTabFocus,
}) => {
  const { t } = useT()
  const [tab, setTab] = useState<AgentConfigSettingsTab>('runtime')
  const [localModels, setLocalModels] = useState<AgentModelOption[]>(() => modelsForProvider(meta.provider))
  const [localLoading, setLocalLoading] = useState(false)
  const [localError, setLocalError] = useState('')

  const selectTab = (next: AgentConfigSettingsTab): void => {
    setTab(next)
    if (next === 'contexts') onContextsTabFocus?.()
  }

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

  const PERMISSION_MODES: Array<{ value: AgentPermissionMode; label: string; hint: string }> = [
    { value: 'ask', label: t('agentPane.permissionAsk'), hint: t('agentPane.permissionAskHint') },
    { value: 'auto', label: t('agentPane.permissionAuto'), hint: t('agentPane.permissionAutoHint') },
    { value: 'plan', label: t('agentPane.permissionPlan'), hint: t('agentPane.permissionPlanHint') },
  ]

  const modelOptions = modelOptionsProp ?? localModels
  const loadingModels = modelOptionsProp ? modelsLoading : localLoading
  const modelsErrorText = modelOptionsProp ? modelsError : localError
  const selectedModel = meta.model?.trim() ?? ''
  const modelIsCustom = Boolean(selectedModel && !modelOptions.some(option => option.id === selectedModel))
  const activePermission = PERMISSION_MODES.find(mode => mode.value === meta.permissionMode)
  const selectedCount = selectedContextIds.length
  const maxRounds = resolveOrchestrationMaxRounds(meta.orchestrationMaxRounds)

  return (
    <section className="agent-config-settings" aria-label={t('agentPane.configHowLabel')}>
      <header className="agent-config-settings__head">
        <h3 className="agent-config-settings__eyebrow">{t('agentPane.configHowLabel')}</h3>
        <SegmentedControl
          size="sm"
          layout="scroll"
          label={t('agentPane.configHowLabel')}
          value={tab}
          options={[
            { value: 'runtime', label: t('agentPane.configTabRuntime'), title: t('agentPane.configTabRuntime') },
            {
              value: 'permissions',
              label: t('agentPane.configTabPermissions'),
              title: t('agentPane.configTabPermissions'),
            },
            {
              value: 'contexts',
              label: t('agentPane.configTabContexts'),
              title: t('agentPane.configTabContexts'),
              indicator: selectedCount > 0,
            },
          ]}
          onChange={selectTab}
        />
      </header>

      <div className="agent-config-settings__panel">
        {tab === 'runtime' && (
          <div className="agent-config-settings__stack">
            <div className="agent-config-settings__field">
              <span className="agent-config-settings__label">{t('agentPane.providerLabel')}</span>
              <SegmentedControl
                label={t('agentPane.providerLabel')}
                value={meta.provider}
                disabled={locked}
                options={[
                  { value: 'claude', label: t('agentPane.claude') },
                  { value: 'cursor', label: t('agentPane.cursor') },
                  { value: 'copilot', label: t('agentPane.copilot') },
                ]}
                onChange={onChangeProvider}
              />
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
              {!loadingModels && modelsErrorText ? (
                <p className="agent-config-settings__hint">
                  {t('agentPane.modelLoadErrorDetail', { detail: modelsErrorText.slice(0, 160) })}
                </p>
              ) : null}
            </label>
            <AgentConfigFolderChip
              label={cwd.trim() ? folderLabel(cwd) : t('agentPane.projectFolderUnset')}
              hint={t('agentPane.projectFolderHint')}
              title={cwd.trim() || t('agentPane.projectFolderUnset')}
            />
          </div>
        )}

        {tab === 'permissions' && (
          <div className="agent-config-settings__stack">
            <div className="agent-config-settings__field">
              <span className="agent-config-settings__label">{t('agentPane.permissionLabel')}</span>
              <SegmentedControl
                label={t('agentPane.permissionLabel')}
                value={meta.permissionMode}
                disabled={locked}
                options={PERMISSION_MODES.map(mode => ({
                  value: mode.value,
                  label: mode.label,
                  title: mode.hint,
                }))}
                onChange={onChangePermission}
              />
              {activePermission && (
                <p className="agent-config-settings__hint">{activePermission.hint}</p>
              )}
            </div>
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
        )}

        {tab === 'contexts' && (
          <AgentConfigContextSummary
            diskContexts={diskContexts}
            selectedContextIds={selectedContextIds}
            locked={locked}
            loopActive={loopActive}
            autoImprove={meta.autoImproveContexts === true}
            agentId={meta.id}
            contextNotice={contextNotice}
            onToggleContext={onToggleContext}
            onOpenContextsModal={onOpenContextsModal}
            onAutoImproveChange={onAutoImproveChange}
          />
        )}
      </div>
    </section>
  )
}
