import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { AgentCliProvider, AgentPaneMeta, AgentPermissionMode } from '@shared/tabSession'
import type { TabContext } from '@shared/tabContext'
import { modelsForProvider } from '@shared/agentCliModels'
import { type AgentIdentityDraft } from '@shared/agentIdentity'
import { normalizeAgentSlug } from '@shared/projectAgentCatalog'
import type { AgentCoordination } from '@shared/agentOrchestration'
import { useT } from '@i18n/useT'
import { TerminalModal } from '../components/TerminalModal'
import { Button } from '../components/ui'
import { AgentConfigHero } from './AgentConfigHero'
import { AgentConfigIdentityColumn } from './AgentConfigIdentityColumn'
import { AgentConfigLockBanner } from './AgentConfigLockBanner'
import { AgentConfigSettingsPane } from './AgentConfigSettingsPane'
import './AgentConfigModal.css'

function identityDraftFromMeta(meta: AgentPaneMeta): AgentIdentityDraft {
  return {
    id: meta.id ?? '',
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
  awaitingDelegations?: boolean
  diskContexts: TabContext[]
  selectedContextIds: string[]
  contextNotice: string
  onClose: () => void
  /** Persistencia de identidad: blur de inputs o cierre del modal. */
  onCommitIdentity: (draft: AgentIdentityDraft) => void
  onChangeCoordination: (coordination: AgentCoordination) => void
  onAcceptDelegationsChange: (accept: boolean) => void
  onOrchestrationMaxRoundsChange: (maxRounds: number) => void
  onChangeProvider: (provider: AgentCliProvider) => void
  onChangeModel: (model: string) => void
  onChangePermission: (permissionMode: AgentPermissionMode) => void
  onToggleLoopMode: () => void
  onToggleContext: (contextId: string) => void
  onOpenContextsModal: () => void
  onAutoImproveChange: (checked: boolean) => void
  onContextsTabFocus?: () => void
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
  awaitingDelegations = false,
  diskContexts,
  selectedContextIds,
  contextNotice,
  onClose,
  onCommitIdentity,
  onChangeCoordination,
  onAcceptDelegationsChange,
  onOrchestrationMaxRoundsChange,
  onChangeProvider,
  onChangeModel,
  onChangePermission,
  onToggleLoopMode,
  onToggleContext,
  onOpenContextsModal,
  onAutoImproveChange,
  onContextsTabFocus,
  closeOnBackdrop = true,
}) => {
  const { t } = useT()
  const locked = busy || loopActive || awaitingDelegations
  const [draft, setDraft] = useState<AgentIdentityDraft>(() => identityDraftFromMeta(meta))
  const draftRef = useRef(draft)
  draftRef.current = draft
  const rulesKey = meta.rules?.join('\0') ?? ''

  useEffect(() => {
    if (!open) return
    const next = identityDraftFromMeta(meta)
    draftRef.current = next
    setDraft(next)
  }, [open, meta.id, meta.name, meta.role, meta.objective, rulesKey])

  const updateDraft = useCallback((patch: Partial<AgentIdentityDraft>) => {
    setDraft(previous => {
      const next = { ...previous, ...patch }
      draftRef.current = next
      return next
    })
  }, [])

  const commitIdentity = useCallback(() => {
    const current = draftRef.current
    const normalizedId = normalizeAgentSlug(current.id, meta.id) || meta.id
    const next = normalizedId === current.id ? current : { ...current, id: normalizedId }
    if (next !== current) {
      draftRef.current = next
      setDraft(next)
    }
    onCommitIdentity(next)
  }, [meta.id, onCommitIdentity])

  const handleClose = useCallback(() => {
    commitIdentity()
    onClose()
  }, [commitIdentity, onClose])

  const modelOptions = modelsForProvider(meta.provider)
  const selectedModel = meta.model?.trim() ?? ''
  const modelLabel = selectedModel
    ? (modelOptions.find(option => option.id === selectedModel)?.label ?? selectedModel)
    : t('agentPane.modelDefault')

  return (
    <TerminalModal
      open={open}
      onClose={handleClose}
      size="lg"
      zIndex={820}
      bodyLayout="flush"
      closeOnBackdrop={closeOnBackdrop}
      headerContent={(
        <AgentConfigHero
          name={draft.name}
          role={draft.role}
          provider={meta.provider}
          modelLabel={modelLabel}
          busy={busy}
          loopActive={loopActive}
          awaitingDelegations={awaitingDelegations}
        />
      )}
      footer={(
        <div className="agent-config-modal__footer">
          <p className="agent-config-modal__save-hint">{t('agentPane.configSaveHint')}</p>
          <Button variant="primary" size="sm" onClick={handleClose}>
            {t('agentPane.configDone')}
          </Button>
        </div>
      )}
    >
      <div className="agent-config-modal">
        <AgentConfigLockBanner
          busy={busy}
          loopActive={loopActive}
          awaitingDelegations={awaitingDelegations}
        />
        <AgentConfigIdentityColumn
          draft={draft}
          locked={locked}
          onChange={updateDraft}
          onCommit={commitIdentity}
        />
        <AgentConfigSettingsPane
          meta={meta}
          cwd={cwd}
          loopMode={loopMode}
          loopActive={loopActive}
          locked={locked}
          diskContexts={diskContexts}
          selectedContextIds={selectedContextIds}
          contextNotice={contextNotice}
          onChangeCoordination={onChangeCoordination}
          onAcceptDelegationsChange={onAcceptDelegationsChange}
          onOrchestrationMaxRoundsChange={onOrchestrationMaxRoundsChange}
          onChangeProvider={onChangeProvider}
          onChangeModel={onChangeModel}
          onChangePermission={onChangePermission}
          onToggleLoopMode={onToggleLoopMode}
          onToggleContext={onToggleContext}
          onOpenContextsModal={onOpenContextsModal}
          onAutoImproveChange={onAutoImproveChange}
          onContextsTabFocus={onContextsTabFocus}
        />
      </div>
    </TerminalModal>
  )
}
