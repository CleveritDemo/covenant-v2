import React from 'react'
import type { DragEvent } from 'react'
import type { AgentPaneMeta, AgentPermissionMode } from '@shared/tabSession'
import { modelsForProvider } from '@shared/agentCliModels'
import { useT } from '@i18n/useT'
import { Button } from '../components/ui/Button'
import { Icon } from '../components/ui/Icon'
import type { AgentCwdSource } from './AgentPane'

function folderLabel(cwd: string): string {
  const normalized = cwd.replace(/[\\/]+$/, '')
  return normalized.split(/[\\/]/).pop() || cwd || '—'
}

export interface AgentPaneHeaderProps {
  meta: AgentPaneMeta
  cwd: string
  cwdSources: AgentCwdSource[]
  cwdChoices: Record<string, string>
  busy: boolean
  loopMode: boolean
  loopActive: boolean
  onClosePane?: () => void
  onRequestClose: () => void
  onLoadCwdChoices: () => void
  onSelectCwdSource: (sourcePaneId: string) => void
  onChangeModel: (model: string) => void
  onChangePermission: (permissionMode: AgentPermissionMode) => void
  onToggleLoopMode: () => void
  paneReorder?: {
    enabled: boolean
    isGrabbed: boolean
    onDragHandleStart: (event: DragEvent) => void
    onDragHandleEnd: () => void
  }
}

export const AgentPaneHeader: React.FC<AgentPaneHeaderProps> = ({
  meta,
  cwd,
  cwdSources,
  cwdChoices,
  busy,
  loopMode,
  loopActive,
  onClosePane,
  onRequestClose,
  onLoadCwdChoices,
  onSelectCwdSource,
  onChangeModel,
  onChangePermission,
  onToggleLoopMode,
  paneReorder,
}) => {
  const { t } = useT()

  const PERMISSION_MODES: Array<{ value: AgentPermissionMode; label: string; hint: string }> = [
    { value: 'ask', label: t('agentPane.permissionAsk'), hint: t('agentPane.permissionAskHint') },
    { value: 'auto', label: t('agentPane.permissionAuto'), hint: t('agentPane.permissionAutoHint') },
    { value: 'plan', label: t('agentPane.permissionPlan'), hint: t('agentPane.permissionPlanHint') },
  ]

  const modelOptions = modelsForProvider(meta.provider)
  const selectedModel = meta.model?.trim() ?? ''
  const modelIsCustom = Boolean(selectedModel && !modelOptions.some(option => option.id === selectedModel))
  const providerLabel = meta.provider === 'claude' ? t('agentPane.claude') : t('agentPane.cursor')

  return (
    <div className="agent-pane__header">
      <div className="agent-pane__header-left">
        {paneReorder?.enabled && (
          <Button
            variant="icon"
            size="xs"
            draggable
            pressed={paneReorder.isGrabbed}
            aria-label="Reordenar panel"
            onDragStart={paneReorder.onDragHandleStart}
            onDragEnd={paneReorder.onDragHandleEnd}
            onMouseDown={event => event.stopPropagation()}
          >
            <Icon name="drag-handle" size={13} />
          </Button>
        )}
        <span className="agent-pane__avatar" aria-hidden="true">
          <Icon name="sparkles" size={13} />
        </span>
        <div className="agent-pane__identity">
          <span className="agent-pane__provider">{providerLabel}</span>
          <span className="agent-pane__cwd">
            <span className="agent-pane__cwd-icon" aria-hidden="true">
              <Icon name="folder" size={11} />
            </span>
            <select
              className="agent-pane__cwd-select"
              value=""
              disabled={busy || cwdSources.length === 0}
              title={cwdSources.length ? t('agentPane.changeDirectory') : t('agentPane.noTerminals')}
              onFocus={() => { onLoadCwdChoices() }}
              onChange={event => {
                const selected = event.target.value
                if (selected) onSelectCwdSource(selected)
                event.target.value = ''
              }}
              onMouseDown={event => event.stopPropagation()}
            >
              <option value="">{folderLabel(cwd)}</option>
              {cwdSources.map(source => (
                <option key={source.paneId} value={source.paneId}>
                  {cwdChoices[source.paneId] || source.label}
                </option>
              ))}
            </select>
          </span>
        </div>
      </div>

      <label className="agent-pane__model">
        <span className="agent-pane__model-icon" aria-hidden="true">
          <Icon name="brain" size={13} />
        </span>
        <select
          value={selectedModel}
          disabled={busy}
          aria-label={t('agentPane.modelLabel')}
          title={t('agentPane.modelHint')}
          onChange={event => onChangeModel(event.target.value)}
          onMouseDown={event => event.stopPropagation()}
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

      <div
        className="agent-pane__modes"
        role="radiogroup"
        aria-label={t('agentPane.permissionLabel')}
      >
        {PERMISSION_MODES.map(mode => (
          <button
            key={mode.value}
            role="radio"
            aria-checked={meta.permissionMode === mode.value}
            className={[
              'agent-pane__mode',
              meta.permissionMode === mode.value ? 'agent-pane__mode--active' : '',
            ].filter(Boolean).join(' ')}
            title={mode.hint}
            disabled={busy}
            onClick={() => onChangePermission(mode.value)}
            onMouseDown={event => event.stopPropagation()}
          >
            {mode.label}
          </button>
        ))}
      </div>

      <span className="agent-pane__loop-mode">
        <Button
          variant="icon"
          size="xs"
          pressed={loopMode}
          title={t('agentPane.loopTitle')}
          disabled={loopActive}
          onClick={onToggleLoopMode}
          onMouseDown={event => event.stopPropagation()}
        >
          <Icon name="refresh" size={13} />
        </Button>
      </span>

      {onClosePane && (
        <Button
          variant="icon"
          size="xs"
          title={t('common.cancel')}
          onClick={onRequestClose}
          onMouseDown={event => event.stopPropagation()}
        >
          <Icon name="close" size={12} />
        </Button>
      )}
    </div>
  )
}
