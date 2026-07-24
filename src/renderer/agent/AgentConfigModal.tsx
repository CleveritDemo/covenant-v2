import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { AgentCliProvider, AgentPaneMeta, AgentPermissionMode } from '@shared/tabSession'
import type { TabContext } from '@shared/tabContext'
import { modelsForProvider } from '@shared/agentCliModels'
import {
  AGENT_NAME_MAX_LENGTH,
  AGENT_OBJECTIVE_MAX_LENGTH,
  AGENT_ROLE_MAX_LENGTH,
  type AgentIdentityDraft,
} from '@shared/agentIdentity'
import type { AgentCoordination } from '@shared/agentOrchestration'
import { useT } from '@i18n/useT'
import { TerminalModal } from '../components/TerminalModal'
import {
  Button,
  ContextCheckOption,
  Icon,
  Input,
  SegmentedControl,
  Select,
  SettingToggle,
  TextArea,
} from '../components/ui'
import { AgentRulesEditor } from './AgentRulesEditor'
import './AgentConfigModal.css'

function folderLabel(cwd: string): string {
  const normalized = cwd.replace(/[\\/]+$/, '')
  return normalized.split(/[\\/]/).pop() || cwd || '—'
}

function identityDraftFromMeta(meta: AgentPaneMeta): AgentIdentityDraft {
  return {
    name: meta.name ?? '',
    role: meta.role ?? '',
    objective: meta.objective ?? '',
    rules: meta.rules ?? [],
  }
}

export interface AgentConfigModalProps {
  open: boolean
  meta: AgentPaneMeta
  /** Carpeta del proyecto (solo lectura; no configurable por agente). */
  cwd: string
  busy: boolean
  loopMode: boolean
  loopActive: boolean
  diskContexts: TabContext[]
  selectedContextIds: string[]
  contextNotice: string
  onClose: () => void
  /** Persistencia de identidad: blur de inputs o cierre del modal. */
  onCommitIdentity: (draft: AgentIdentityDraft) => void
  onChangeCoordination: (coordination: AgentCoordination) => void
  onAcceptDelegationsChange: (accept: boolean) => void
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
  cwd,
  busy,
  loopMode,
  loopActive,
  diskContexts,
  selectedContextIds,
  contextNotice,
  onClose,
  onCommitIdentity,
  onChangeCoordination,
  onAcceptDelegationsChange,
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
  const [draft, setDraft] = useState<AgentIdentityDraft>(() => identityDraftFromMeta(meta))
  const draftRef = useRef(draft)
  draftRef.current = draft

  useEffect(() => {
    if (!open) return
    const next = identityDraftFromMeta(meta)
    draftRef.current = next
    setDraft(next)
    // Solo al abrir: durante la edición el borrador es la fuente de verdad.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed on open
  }, [open])

  const updateDraft = useCallback((patch: Partial<AgentIdentityDraft>) => {
    setDraft(previous => {
      const next = { ...previous, ...patch }
      draftRef.current = next
      return next
    })
  }, [])

  const commitIdentity = useCallback(() => {
    onCommitIdentity(draftRef.current)
  }, [onCommitIdentity])

  const handleClose = useCallback(() => {
    onCommitIdentity(draftRef.current)
    onClose()
  }, [onClose, onCommitIdentity])

  const PERMISSION_MODES: Array<{ value: AgentPermissionMode; label: string; hint: string }> = [
    { value: 'ask', label: t('agentPane.permissionAsk'), hint: t('agentPane.permissionAskHint') },
    { value: 'auto', label: t('agentPane.permissionAuto'), hint: t('agentPane.permissionAutoHint') },
    { value: 'plan', label: t('agentPane.permissionPlan'), hint: t('agentPane.permissionPlanHint') },
  ]

  const modelOptions = modelsForProvider(meta.provider)
  const selectedModel = meta.model?.trim() ?? ''
  const modelIsCustom = Boolean(selectedModel && !modelOptions.some(option => option.id === selectedModel))
  const activePermission = PERMISSION_MODES.find(mode => mode.value === meta.permissionMode)
  const selectedCount = selectedContextIds.length
  const projectContexts = diskContexts.filter(context => context.kind !== 'agentResult')
  const agentResultContexts = diskContexts.filter(context => context.kind === 'agentResult')

  const renderContextItem = (context: TabContext) => (
    <li key={context.id}>
      <ContextCheckOption
        appearance="panel"
        name={context.name}
        kindLabel={t(`tabContexts.kind_${context.kind}`)}
        checked={selectedContextIds.includes(context.id)}
        disabled={locked}
        onChange={() => onToggleContext(context.id)}
      />
    </li>
  )

  return (
    <TerminalModal
      open={open}
      onClose={handleClose}
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
              <Input
                type="text"
                value={draft.name}
                maxLength={AGENT_NAME_MAX_LENGTH}
                disabled={busy}
                placeholder={t('agentPane.namePlaceholder')}
                onChange={event => updateDraft({ name: event.target.value })}
                onBlur={commitIdentity}
              />
            </label>
            <label className="agent-config-modal__field">
              <span className="agent-config-modal__field-label">{t('agentPane.roleLabel')}</span>
              <Input
                type="text"
                value={draft.role}
                maxLength={AGENT_ROLE_MAX_LENGTH}
                disabled={busy}
                placeholder={t('agentPane.rolePlaceholder')}
                onChange={event => updateDraft({ role: event.target.value })}
                onBlur={commitIdentity}
              />
            </label>
          </div>
          <label className="agent-config-modal__field agent-config-modal__field--stack">
            <span className="agent-config-modal__field-label">{t('agentPane.objectiveLabel')}</span>
            <TextArea
              rows={3}
              value={draft.objective}
              maxLength={AGENT_OBJECTIVE_MAX_LENGTH}
              disabled={busy}
              placeholder={t('agentPane.objectivePlaceholder')}
              onChange={event => updateDraft({ objective: event.target.value })}
              onBlur={commitIdentity}
            />
          </label>
          <AgentRulesEditor
            rules={draft.rules}
            disabled={busy}
            onChange={rules => updateDraft({ rules })}
            onCommit={commitIdentity}
          />

          <div className="agent-config-modal__field agent-config-modal__field--stack">
            <span className="agent-config-modal__field-label">{t('agentPane.coordinationLabel')}</span>
            <SegmentedControl
              label={t('agentPane.coordinationLabel')}
              value={meta.coordination ?? 'none'}
              disabled={busy || loopActive}
              options={[
                { value: 'none', label: t('agentPane.coordinationNone') },
                { value: 'orchestrator', label: t('agentPane.coordinationOrchestrator') },
              ]}
              onChange={onChangeCoordination}
            />
            <p className="agent-config-modal__inline-hint">{t('agentPane.coordinationHint')}</p>
          </div>

          {meta.coordination !== 'orchestrator' ? (
            <SettingToggle
              checked={meta.acceptDelegations !== false}
              disabled={locked}
              title={t('agentPane.acceptDelegationsLabel')}
              description={t('agentPane.acceptDelegationsHint')}
              hint={t('agentPane.acceptDelegationsHint')}
              onChange={onAcceptDelegationsChange}
            />
          ) : null}
        </section>

        <section className="agent-config-modal__block">
          <header className="agent-config-modal__block-head">
            <h3 className="agent-config-modal__block-title">{t('agentPane.runtimeLabel')}</h3>
            <p className="agent-config-modal__block-hint">{t('agentPane.runtimeHint')}</p>
          </header>

          <div className="agent-config-modal__field agent-config-modal__field--stack">
            <span className="agent-config-modal__field-label">{t('agentPane.providerLabel')}</span>
            <SegmentedControl
              label={t('agentPane.providerLabel')}
              value={meta.provider}
              disabled={busy || loopActive}
              options={[
                { value: 'claude', label: t('agentPane.claude') },
                { value: 'cursor', label: t('agentPane.cursor') },
              ]}
              onChange={onChangeProvider}
            />
          </div>

          <div className="agent-config-modal__grid">
            <label className="agent-config-modal__field agent-config-modal__field--stack">
              <span className="agent-config-modal__field-label">{t('agentPane.modelLabel')}</span>
              <Select
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
              </Select>
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
            <SegmentedControl
              label={t('agentPane.permissionLabel')}
              value={meta.permissionMode}
              disabled={busy}
              options={PERMISSION_MODES.map(mode => ({
                value: mode.value,
                label: mode.label,
                title: mode.hint,
              }))}
              onChange={onChangePermission}
            />
            {activePermission && (
              <p className="agent-config-modal__inline-hint">{activePermission.hint}</p>
            )}
          </div>

          <SettingToggle
            checked={loopMode}
            disabled={loopActive}
            title={t('agentPane.loopTitle')}
            description={t('agentPane.loopHint')}
            onChange={() => onToggleLoopMode()}
          />
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

          <SettingToggle
            checked={meta.autoImproveContexts === true}
            disabled={locked}
            title={t('tabContexts.autoImprove')}
            description={t('tabContexts.autoImproveHint')}
            hint={t('tabContexts.autoImproveHint')}
            onChange={onAutoImproveChange}
          />

          <SettingToggle
            checked={meta.emitResults === true}
            disabled={locked}
            title={t('tabContexts.emitResults')}
            description={t('tabContexts.emitResultsHint')}
            hint={t('tabContexts.emitResultsHint')}
            onChange={onEmitResultsChange}
          />

          {contextNotice && <p className="agent-config-modal__notice">{contextNotice}</p>}
        </section>
      </div>
    </TerminalModal>
  )
}
