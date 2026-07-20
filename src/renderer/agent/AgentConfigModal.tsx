import React from 'react'
import type { AgentCliProvider, AgentPaneMeta, AgentPermissionMode } from '@shared/tabSession'
import type { TabContext } from '@shared/tabContext'
import { modelsForProvider } from '@shared/agentCliModels'
import {
  AGENT_NAME_MAX_LENGTH,
  AGENT_OBJECTIVE_MAX_LENGTH,
  AGENT_ROLE_MAX_LENGTH,
} from '@shared/agentIdentity'
import { useT } from '@i18n/useT'
import { TerminalModal } from '../components/TerminalModal'
import { Button } from '../components/ui/Button'
import { Icon } from '../components/ui/Icon'
import {
  PLANE_AGENT_COLORS,
  resolveAgentColor,
} from '../workspace/planeAgentColor'
import './AgentConfigModal.css'

function folderLabel(cwd: string): string {
  const normalized = cwd.replace(/[\\/]+$/, '')
  return normalized.split(/[\\/]/).pop() || cwd || '—'
}

export interface AgentConfigModalProps {
  open: boolean
  meta: AgentPaneMeta
  /** paneId del agente (para el color por defecto derivado del id). */
  paneId: string
  /** Carpeta del proyecto (solo lectura; no configurable por agente). */
  cwd: string
  busy: boolean
  loopMode: boolean
  loopActive: boolean
  diskContexts: TabContext[]
  selectedContextIds: string[]
  contextNotice: string
  onClose: () => void
  onChangeName: (name: string) => void
  onChangeRole: (role: string) => void
  onChangeObjective: (objective: string) => void
  onChangeColor: (color: string) => void
  onChangeProvider: (provider: AgentCliProvider) => void
  onChangeModel: (model: string) => void
  onChangePermission: (permissionMode: AgentPermissionMode) => void
  onToggleLoopMode: () => void
  onToggleContext: (contextId: string) => void
  onOpenContextsModal: () => void
  onAutoImproveChange: (checked: boolean) => void
  onEmitResultsChange: (checked: boolean) => void
  /** Cerrar al pulsar el fondo (por defecto sí para este modal). */
  closeOnBackdrop?: boolean
}

export const AgentConfigModal: React.FC<AgentConfigModalProps> = ({
  open,
  meta,
  paneId,
  cwd,
  busy,
  loopMode,
  loopActive,
  diskContexts,
  selectedContextIds,
  contextNotice,
  onClose,
  onChangeName,
  onChangeRole,
  onChangeObjective,
  onChangeColor,
  onChangeProvider,
  onChangeModel,
  onChangePermission,
  onToggleLoopMode,
  onToggleContext,
  onOpenContextsModal,
  onAutoImproveChange,
  onEmitResultsChange,
  closeOnBackdrop = true,
}) => {
  const { t } = useT()
  const locked = busy || loopActive
  const activeColor = resolveAgentColor(paneId, meta.color)

  const PERMISSION_MODES: Array<{ value: AgentPermissionMode; label: string; hint: string }> = [
    { value: 'ask', label: t('agentPane.permissionAsk'), hint: t('agentPane.permissionAskHint') },
    { value: 'auto', label: t('agentPane.permissionAuto'), hint: t('agentPane.permissionAutoHint') },
    { value: 'plan', label: t('agentPane.permissionPlan'), hint: t('agentPane.permissionPlanHint') },
  ]

  const PROVIDERS: Array<{ value: AgentCliProvider; label: string }> = [
    { value: 'claude', label: t('agentPane.claude') },
    { value: 'cursor', label: t('agentPane.cursor') },
  ]

  const modelOptions = modelsForProvider(meta.provider)
  const selectedModel = meta.model?.trim() ?? ''
  const modelIsCustom = Boolean(selectedModel && !modelOptions.some(option => option.id === selectedModel))
  const activePermission = PERMISSION_MODES.find(mode => mode.value === meta.permissionMode)
  const selectedCount = selectedContextIds.length
  const projectContexts = diskContexts.filter(context => context.kind !== 'agentResult')
  const agentResultContexts = diskContexts.filter(context => context.kind === 'agentResult')

  const renderContextItem = (context: (typeof diskContexts)[number]) => {
    const checked = selectedContextIds.includes(context.id)
    return (
      <li key={context.id}>
        <label
          className={[
            'agent-config-modal__context-item',
            checked ? 'agent-config-modal__context-item--on' : '',
          ].filter(Boolean).join(' ')}
        >
          <input
            type="checkbox"
            role="option"
            aria-selected={checked}
            checked={checked}
            disabled={locked}
            onChange={() => onToggleContext(context.id)}
          />
          <span className="agent-config-modal__context-name">{context.name}</span>
          <span className="agent-config-modal__context-kind">
            {t(`tabContexts.kind_${context.kind}`)}
          </span>
        </label>
      </li>
    )
  }

  return (
    <TerminalModal
      open={open}
      onClose={onClose}
      title={t('agentPane.configTitle')}
      size="lg"
      zIndex={820}
      bodyLayout="spacious"
      closeOnBackdrop={closeOnBackdrop}
    >
      <div className="agent-config-modal">
        <section className="agent-config-modal__block">
          <header className="agent-config-modal__block-head">
            <h3 className="agent-config-modal__block-title">{t('agentPane.identityLabel')}</h3>
            <p className="agent-config-modal__block-hint">{t('agentPane.identityHint')}</p>
          </header>
          <div className="agent-config-modal__grid">
            <label className="agent-config-modal__field">
              <span className="agent-config-modal__field-label">{t('agentPane.nameLabel')}</span>
              <input
                type="text"
                value={meta.name ?? ''}
                maxLength={AGENT_NAME_MAX_LENGTH}
                disabled={busy}
                placeholder={t('agentPane.namePlaceholder')}
                onChange={event => onChangeName(event.target.value)}
              />
            </label>
            <label className="agent-config-modal__field">
              <span className="agent-config-modal__field-label">{t('agentPane.roleLabel')}</span>
              <input
                type="text"
                value={meta.role ?? ''}
                maxLength={AGENT_ROLE_MAX_LENGTH}
                disabled={busy}
                placeholder={t('agentPane.rolePlaceholder')}
                onChange={event => onChangeRole(event.target.value)}
              />
            </label>
          </div>
          <label className="agent-config-modal__field agent-config-modal__field--stack">
            <span className="agent-config-modal__field-label">{t('agentPane.objectiveLabel')}</span>
            <textarea
              rows={3}
              value={meta.objective ?? ''}
              maxLength={AGENT_OBJECTIVE_MAX_LENGTH}
              disabled={busy}
              placeholder={t('agentPane.objectivePlaceholder')}
              onChange={event => onChangeObjective(event.target.value)}
            />
          </label>
          <div className="agent-config-modal__field agent-config-modal__field--stack">
            <span className="agent-config-modal__field-label">{t('agentPane.colorLabel')}</span>
            <div
              className="agent-config-modal__color-grid"
              role="radiogroup"
              aria-label={t('agentPane.colorLabel')}
            >
              {PLANE_AGENT_COLORS.map(color => {
                const active = activeColor.toLowerCase() === color.toLowerCase()
                return (
                  <button
                    key={color}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    title={color}
                    disabled={busy}
                    className={[
                      'agent-config-modal__color-swatch',
                      active ? 'agent-config-modal__color-swatch--active' : '',
                    ].filter(Boolean).join(' ')}
                    style={{ background: color }}
                    onClick={() => onChangeColor(color)}
                  />
                )
              })}
            </div>
            <p className="agent-config-modal__inline-hint">{t('agentPane.colorHint')}</p>
          </div>
        </section>

        <section className="agent-config-modal__block">
          <header className="agent-config-modal__block-head">
            <h3 className="agent-config-modal__block-title">{t('agentPane.runtimeLabel')}</h3>
            <p className="agent-config-modal__block-hint">{t('agentPane.runtimeHint')}</p>
          </header>

          <div className="agent-config-modal__field agent-config-modal__field--stack">
            <span className="agent-config-modal__field-label">{t('agentPane.providerLabel')}</span>
            <div className="agent-config-modal__segment" role="radiogroup" aria-label={t('agentPane.providerLabel')}>
              {PROVIDERS.map(provider => (
                <button
                  key={provider.value}
                  type="button"
                  role="radio"
                  aria-checked={meta.provider === provider.value}
                  className={[
                    'agent-config-modal__segment-btn',
                    meta.provider === provider.value ? 'agent-config-modal__segment-btn--active' : '',
                  ].filter(Boolean).join(' ')}
                  disabled={busy || loopActive}
                  onClick={() => onChangeProvider(provider.value)}
                >
                  {provider.label}
                </button>
              ))}
            </div>
          </div>

          <div className="agent-config-modal__grid">
            <label className="agent-config-modal__field agent-config-modal__field--stack">
              <span className="agent-config-modal__field-label">{t('agentPane.modelLabel')}</span>
              <select
                value={selectedModel}
                disabled={busy}
                title={t('agentPane.modelHint')}
                onChange={event => onChangeModel(event.target.value)}
              >
                <option value="">{t('agentPane.modelDefault')}</option>
                {modelOptions.map(option => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
                {modelIsCustom && (
                  <option value={selectedModel}>{selectedModel}</option>
                )}
              </select>
            </label>

            <div className="agent-config-modal__field agent-config-modal__field--stack">
              <span className="agent-config-modal__field-label">{t('agentPane.workingDirectory')}</span>
              <div className="agent-config-modal__cwd">
                <span
                  className="agent-config-modal__cwd-path"
                  title={cwd.trim() || t('agentPane.projectFolderUnset')}
                >
                  <Icon name="folder" size={14} aria-hidden />
                  {cwd.trim() ? folderLabel(cwd) : t('agentPane.projectFolderUnset')}
                </span>
                <small className="agent-config-modal__cwd-hint">
                  {t('agentPane.projectFolderHint')}
                </small>
              </div>
            </div>
          </div>
        </section>

        <section className="agent-config-modal__block">
          <header className="agent-config-modal__block-head">
            <h3 className="agent-config-modal__block-title">{t('agentPane.behaviorLabel')}</h3>
          </header>

          <div className="agent-config-modal__field agent-config-modal__field--stack">
            <span className="agent-config-modal__field-label">{t('agentPane.permissionLabel')}</span>
            <div className="agent-config-modal__segment" role="radiogroup" aria-label={t('agentPane.permissionLabel')}>
              {PERMISSION_MODES.map(mode => (
                <button
                  key={mode.value}
                  type="button"
                  role="radio"
                  aria-checked={meta.permissionMode === mode.value}
                  className={[
                    'agent-config-modal__segment-btn',
                    meta.permissionMode === mode.value ? 'agent-config-modal__segment-btn--active' : '',
                  ].filter(Boolean).join(' ')}
                  title={mode.hint}
                  disabled={busy}
                  onClick={() => onChangePermission(mode.value)}
                >
                  {mode.label}
                </button>
              ))}
            </div>
            {activePermission && (
              <p className="agent-config-modal__inline-hint">{activePermission.hint}</p>
            )}
          </div>

          <button
            type="button"
            className={[
              'agent-config-modal__toggle',
              loopMode ? 'agent-config-modal__toggle--on' : '',
            ].filter(Boolean).join(' ')}
            disabled={loopActive}
            aria-pressed={loopMode}
            onClick={onToggleLoopMode}
          >
            <span className="agent-config-modal__toggle-copy">
              <strong>{t('agentPane.loopTitle')}</strong>
              <span>{t('agentPane.loopHint')}</span>
            </span>
            <span className="agent-config-modal__switch" aria-hidden="true">
              <span className="agent-config-modal__switch-knob" />
            </span>
          </button>
        </section>

        <section className="agent-config-modal__block">
          <header className="agent-config-modal__block-head agent-config-modal__block-head--row">
            <div>
              <h3 className="agent-config-modal__block-title">{t('tabContexts.barTitle')}</h3>
              <p className="agent-config-modal__block-hint">
                {selectedCount === 0
                  ? t('tabContexts.pickerNone')
                  : t('tabContexts.pickerSelected', { n: selectedCount })}
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              disabled={loopActive}
              onClick={onOpenContextsModal}
            >
              {t('tabContexts.manage')}
            </Button>
          </header>

          {diskContexts.length === 0 ? (
            <p className="agent-config-modal__empty">{t('tabContexts.empty')}</p>
          ) : (
            <div className="agent-config-modal__context-groups">
              {projectContexts.length > 0 && (
                <div className="agent-config-modal__context-group">
                  <h4 className="agent-config-modal__context-group-title">
                    {t('tabContexts.groupProject')}
                  </h4>
                  <ul className="agent-config-modal__context-list" role="listbox" aria-multiselectable="true">
                    {projectContexts.map(renderContextItem)}
                  </ul>
                </div>
              )}
              {agentResultContexts.length > 0 && (
                <div className="agent-config-modal__context-group">
                  <h4 className="agent-config-modal__context-group-title">
                    {t('tabContexts.groupAgentResults')}
                  </h4>
                  <ul className="agent-config-modal__context-list" role="listbox" aria-multiselectable="true">
                    {agentResultContexts.map(renderContextItem)}
                  </ul>
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            className={[
              'agent-config-modal__toggle',
              meta.autoImproveContexts === true ? 'agent-config-modal__toggle--on' : '',
            ].filter(Boolean).join(' ')}
            disabled={locked}
            aria-pressed={meta.autoImproveContexts === true}
            title={t('tabContexts.autoImproveHint')}
            onClick={() => onAutoImproveChange(!(meta.autoImproveContexts === true))}
          >
            <span className="agent-config-modal__toggle-copy">
              <strong>{t('tabContexts.autoImprove')}</strong>
              <span>{t('tabContexts.autoImproveHint')}</span>
            </span>
            <span className="agent-config-modal__switch" aria-hidden="true">
              <span className="agent-config-modal__switch-knob" />
            </span>
          </button>

          <button
            type="button"
            className={[
              'agent-config-modal__toggle',
              meta.emitResults === true ? 'agent-config-modal__toggle--on' : '',
            ].filter(Boolean).join(' ')}
            disabled={locked}
            aria-pressed={meta.emitResults === true}
            title={t('tabContexts.emitResultsHint')}
            onClick={() => onEmitResultsChange(!(meta.emitResults === true))}
          >
            <span className="agent-config-modal__toggle-copy">
              <strong>{t('tabContexts.emitResults')}</strong>
              <span>{t('tabContexts.emitResultsHint')}</span>
            </span>
            <span className="agent-config-modal__switch" aria-hidden="true">
              <span className="agent-config-modal__switch-knob" />
            </span>
          </button>

          {contextNotice && <p className="agent-config-modal__notice">{contextNotice}</p>}
        </section>
      </div>
    </TerminalModal>
  )
}
