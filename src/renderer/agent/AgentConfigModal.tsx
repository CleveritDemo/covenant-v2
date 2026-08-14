import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AgentCliProvider, AgentPaneMeta, AgentPermissionMode } from '@shared/tabSession'
import { agentCliSpec } from '@shared/agentCliProviders'
import type { TabContext } from '@shared/tabContext'
import type { AgentModelOption } from '@shared/agentCliModels'
import { modelsForProvider } from '@shared/agentCliModels'
import { type AgentIdentityDraft, sanitizeAgentRulesEnabledDraft } from '@shared/agentIdentity'
import { normalizeAgentSlug } from '@shared/projectAgentCatalog'
import type { AgentNativeSkills } from '@shared/projectAgentCatalog'
import type { AgentCoordination, DelegateToPolicy, OrchestrationWorkStyle } from '@shared/agentOrchestration'
import { candidateCeremonyRoles } from '@shared/agileCeremonies'
import { PROJECT_DIR } from '@shared/projectDir'
import { useT } from '@i18n/useT'
import { TerminalModal } from '../components/TerminalModal'
import { Button } from '../components/ui'
import { AgentConfigHero, type AgentConfigHeroChip } from './AgentConfigHero'
import { AgentConfigIdentityColumn } from './AgentConfigIdentityColumn'
import { AgentConfigLockBanner } from './AgentConfigLockBanner'
import { AgentConfigSettingsPane } from './AgentConfigSettingsPane'
import { useAgentCliStatuses } from './useAgentCliStatuses'
import {
  AgentConfigSectionRail,
  type AgentConfigSection,
  type AgentConfigSectionItem,
} from './AgentConfigSectionRail'
import type { DelegateToPeerAgent } from './AgentDelegateToPolicyEditor'
import './AgentConfigModal.css'

/**
 * Secciones que siguen editables con el agente en marcha: no son flags del
 * proceso ya lanzado, se leen al componer el turno siguiente.
 */
const EDITABLE_WHILE_RUNNING = new Set<AgentConfigSection>([
  'identity',
  'objective',
  'rules',
  'contexts',
])

function identityDraftFromMeta(meta: AgentPaneMeta): AgentIdentityDraft {
  return {
    id: meta.id ?? '',
    name: meta.name ?? '',
    monogram: meta.monogram ?? '',
    role: meta.role ?? '',
    ceremonyRoles: candidateCeremonyRoles(meta),
    objective: meta.objective ?? '',
    rules: meta.rules ?? [],
    rulesEnabled: sanitizeAgentRulesEnabledDraft(meta.rules ?? [], meta.rulesEnabled),
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
  onClose: () => void
  /**
   * Persistencia de identidad: blur de inputs o cierre del modal.
   * Debe devolver `false` si falló (el modal no cierra / muestra error).
   */
  onCommitIdentity: (draft: AgentIdentityDraft) => void | boolean | Promise<void | boolean>
  onChangeCoordination: (coordination: AgentCoordination) => void
  onAcceptDelegationsChange: (accept: boolean) => void
  onAllowExpertReplicasChange: (allow: boolean) => void
  onOrchestrationMaxRoundsChange: (maxRounds: number) => void
  onOrchestrationWorkStyleChange: (workStyle: OrchestrationWorkStyle) => void
  onChangeDelegateTo: (policy: DelegateToPolicy | undefined) => void
  onChangeProvider: (provider: AgentCliProvider) => void
  onChangeModel: (model: string) => void
  onChangePermission: (permissionMode: AgentPermissionMode) => void
  onChangeNativeSkills: (nativeSkills: AgentNativeSkills | undefined) => void
  onChangeMcpsAllowed: (mcpsAllowed: string[]) => void
  onToggleLoopMode: () => void
  onToggleContext: (contextId: string) => void
  onOpenContextsModal: () => void
  onContextsTabFocus?: () => void
  /** Otros agentes del tab (exclusiones delegateTo). */
  peerAgents?: DelegateToPeerAgent[]
  /** Cerrar al pulsar el fondo (por defecto sí para este modal). */
  closeOnBackdrop?: boolean
  /** Tab activa: oculta el portal sin cerrar configOpen del padre. */
  active?: boolean
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
  onClose,
  onCommitIdentity,
  onChangeCoordination,
  onAcceptDelegationsChange,
  onAllowExpertReplicasChange,
  onOrchestrationMaxRoundsChange,
  onOrchestrationWorkStyleChange,
  onChangeDelegateTo,
  onChangeProvider,
  onChangeModel,
  onChangePermission,
  onChangeNativeSkills,
  onChangeMcpsAllowed,
  onToggleLoopMode,
  onToggleContext,
  onOpenContextsModal,
  onContextsTabFocus,
  peerAgents = [],
  closeOnBackdrop = true,
  active = true,
}) => {
  const { t } = useT()
  const locked = busy || loopActive || awaitingDelegations
  const [draft, setDraft] = useState<AgentIdentityDraft>(() => identityDraftFromMeta(meta))
  const draftRef = useRef(draft)
  draftRef.current = draft
  const rulesKey = meta.rules?.join('\0') ?? ''
  const [section, setSection] = useState<AgentConfigSection>('identity')
  const [modelOptions, setModelOptions] = useState<AgentModelOption[]>(() => modelsForProvider(meta.provider))
  const [modelsLoading, setModelsLoading] = useState(false)
  const [modelsError, setModelsError] = useState('')
  const [modelsReload, setModelsReload] = useState(0)
  const cliStatuses = useAgentCliStatuses(open)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const savingRef = useRef(false)

  useEffect(() => {
    if (!open) return
    const next = identityDraftFromMeta(meta)
    draftRef.current = next
    setDraft(next)
    setSection('identity')
    setSaveError('')
    // Solo al abrir: si un PUT falla y revierte `meta`, no queremos pisar el
    // borrador ni borrar el mensaje de error.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- meta al open
  }, [open])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setModelsLoading(true)
    setModelsError('')
    setModelOptions(modelsForProvider(meta.provider))
    void window.api.listAgentCliModels(meta.provider).then(result => {
      if (cancelled) return
      if (result.models.length > 0) setModelOptions(result.models)
      setModelsError(result.error ?? '')
      setModelsLoading(false)
    }).catch(error => {
      if (cancelled) return
      setModelOptions(modelsForProvider(meta.provider))
      setModelsError(error instanceof Error ? error.message : String(error))
      setModelsLoading(false)
    })
    return () => { cancelled = true }
  }, [open, meta.provider, modelsReload])

  const updateDraft = useCallback((patch: Partial<AgentIdentityDraft>) => {
    // La ref se actualiza ya, no dentro del updater: `commitIdentity` la lee de
    // forma síncrona, y un control que cambia y guarda en el mismo gesto (un
    // Select, sin blur de por medio) guardaba el valor anterior.
    const next = { ...draftRef.current, ...patch }
    draftRef.current = next
    setDraft(next)
  }, [])

  const commitIdentity = useCallback(async (): Promise<boolean> => {
    const current = draftRef.current
    const normalizedId = normalizeAgentSlug(current.id, meta.id) || meta.id
    const next = normalizedId === current.id ? current : { ...current, id: normalizedId }
    if (next !== current) {
      draftRef.current = next
      setDraft(next)
    }
    try {
      const result = await Promise.resolve(onCommitIdentity(next))
      if (result === false) {
        setSaveError(prev => prev.trim() || 'persist failed')
        return false
      }
      setSaveError('')
      return true
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : String(error))
      return false
    }
  }, [meta.id, onCommitIdentity])

  const handleClose = useCallback(() => {
    if (savingRef.current) return
    savingRef.current = true
    setSaving(true)
    setSaveError('')
    void commitIdentity().then(ok => {
      savingRef.current = false
      setSaving(false)
      if (!ok) return
      onClose()
    })
  }, [commitIdentity, onClose])

  /** Vuelve el borrador a lo último persistido (no toca disco: meta ya es eso). */
  const discardDraft = useCallback(() => {
    const next = identityDraftFromMeta(meta)
    draftRef.current = next
    setDraft(next)
    setSaveError('')
  }, [meta])

  const selectSection = useCallback((next: AgentConfigSection) => {
    setSection(next)
    if (next === 'contexts') onContextsTabFocus?.()
  }, [onContextsTabFocus])

  /** ⌘↵ / Ctrl+↵ cierra igual que el botón del pie. */
  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' || !(event.metaKey || event.ctrlKey)) return
    if (savingRef.current) return
    event.preventDefault()
    handleClose()
  }, [handleClose])

  const selectedModel = meta.model?.trim() ?? ''
  const modelLabel = selectedModel
    ? (modelOptions.find(option => option.id === selectedModel)?.label ?? selectedModel)
    : t('agentPane.modelDefault')

  // Estado de guardado: flash al persistir cualquier campo del agente.
  const savedSnapshot = JSON.stringify([
    meta.id, meta.name, meta.role, meta.ceremonyRoles, meta.objective, meta.rules,
    meta.provider, meta.model, meta.permissionMode,
    meta.coordination, meta.orchestrationMaxRounds, meta.orchestrationWorkStyle, meta.delegateTo,
    meta.acceptDelegations, meta.allowExpertReplicas,
    selectedContextIds,
  ])
  const lastSnapshot = useRef(savedSnapshot)
  const [savedFlash, setSavedFlash] = useState(false)

  useEffect(() => {
    if (!open || lastSnapshot.current === savedSnapshot) {
      lastSnapshot.current = savedSnapshot
      return
    }
    lastSnapshot.current = savedSnapshot
    setSavedFlash(true)
    const timer = window.setTimeout(() => setSavedFlash(false), 1800)
    return () => window.clearTimeout(timer)
  }, [open, savedSnapshot])

  const permissionLabel = meta.permissionMode === 'plan'
    ? t('agentPane.permissionPlan')
    : t('agentPane.permissionAuto')

  const sectionLabels: Record<AgentConfigSection, string> = {
    identity: t('agentPane.identityLabel'),
    objective: t('agentPane.objectiveLabel'),
    rules: t('agentPane.rulesLabel'),
    engine: t('agentPane.configTabRuntime'),
    permissions: t('agentPane.configTabPermissions'),
    contexts: t('agentPane.configTabContexts'),
    orchestration: t('agentPane.configTabOrchestration'),
    capabilities: t('agentPane.configTabCapabilities'),
  }

  const identityDirty = draft.name !== (meta.name ?? '')
    || draft.role !== (meta.role ?? '')
    || draft.ceremonyRoles?.join(',') !== candidateCeremonyRoles(meta).join(',')
    || draft.id !== (meta.id ?? '')
  const objectiveDirty = draft.objective !== (meta.objective ?? '')
  const rulesDirty = draft.rules.join('\0') !== rulesKey
  const dirty = identityDirty || objectiveDirty || rulesDirty

  const railItems: AgentConfigSectionItem[] = [
    {
      id: 'identity',
      group: t('agentPane.configGroupWho'),
      label: sectionLabels.identity,
      dirty: identityDirty,
    },
    {
      id: 'objective',
      group: t('agentPane.configGroupWho'),
      label: sectionLabels.objective,
      dirty: objectiveDirty,
    },
    {
      id: 'rules',
      group: t('agentPane.configGroupWho'),
      label: sectionLabels.rules,
      count: draft.rules.length,
      dirty: rulesDirty,
    },
    { id: 'engine', group: t('agentPane.configGroupHow'), label: sectionLabels.engine },
    {
      id: 'permissions',
      group: t('agentPane.configGroupHow'),
      label: sectionLabels.permissions,
      badge: permissionLabel,
      warn: meta.permissionMode === 'auto',
    },
    {
      id: 'contexts',
      group: t('agentPane.configGroupHow'),
      label: sectionLabels.contexts,
      count: selectedContextIds.length,
    },
    { id: 'orchestration', group: t('agentPane.configGroupHow'), label: sectionLabels.orchestration },
    {
      id: 'capabilities',
      group: t('agentPane.configGroupHow'),
      label: sectionLabels.capabilities,
      count: (meta.nativeSkills?.namespaces?.length ?? 0) + (meta.mcpsAllowed?.length ?? 0),
    },
  ]

  const heroChips: AgentConfigHeroChip[] = useMemo(() => {
    const chips: AgentConfigHeroChip[] = [
      {
        key: 'provider',
        label: agentCliSpec(meta.provider).label,
        tone: cliStatuses[meta.provider]?.path === null ? 'warn' : 'default',
        section: 'engine',
      },
      { key: 'model', label: modelLabel, section: 'engine' },
      {
        key: 'permission',
        label: meta.permissionMode === 'auto'
          ? t('agentPane.configChipPermissionAuto')
          : permissionLabel,
        tone: meta.permissionMode === 'auto' ? 'warn' : 'default',
        section: 'permissions',
      },
    ]
    if (meta.coordination === 'orchestrator' || meta.coordination === 'productOwner') {
      chips.push({
        key: 'coordination',
        label: meta.coordination === 'orchestrator'
          ? t('agentPane.coordinationOrchestrator')
          : t('agentPane.coordinationProductOwner'),
        section: 'orchestration',
      })
    }
    if (selectedContextIds.length > 0) {
      chips.push({
        key: 'contexts',
        label: t('agentPane.configChipContexts', { n: selectedContextIds.length }),
        section: 'contexts',
      })
    }
    return chips
  }, [meta.provider, meta.permissionMode, meta.coordination, modelLabel, permissionLabel, selectedContextIds.length, cliStatuses, t])

  const catalogFile = `${PROJECT_DIR}/agents/${draft.id.trim() || 'agent'}.json`

  return (
    <TerminalModal
      open={open}
      active={active}
      onClose={handleClose}
      size="xl"
      zIndex={820}
      bodyLayout="flush"
      closeOnBackdrop={closeOnBackdrop && !saving}
      closeOnEscape={!saving}
      headerContent={(
        <AgentConfigHero
          name={draft.name}
          monogram={draft.monogram}
          role={draft.role}
          chips={heroChips}
          busy={busy}
          loopActive={loopActive}
          awaitingDelegations={awaitingDelegations}
          onChipClick={selectSection}
        />
      )}
      footer={(
        <div className="agent-config-modal__footer">
          <p className="agent-config-modal__save-hint">
            {saving ? (
              <span className="agent-config-modal__saved-flash">{t('agentPane.configSaving')}</span>
            ) : null}
            {!saving && savedFlash ? (
              <span className="agent-config-modal__saved-flash">{t('agentPane.configSaved')}</span>
            ) : null}
            {saveError ? (
              <span className="agent-config-modal__save-error">
                {t('agentPane.configSaveFailed', { error: saveError })}
              </span>
            ) : (
              <>
                {t('agentPane.configSaveAuto')}
                {' '}
                <span className="agent-config-modal__save-file">{catalogFile}</span>
              </>
            )}
          </p>
          <div className="agent-config-modal__actions">
            {dirty ? (
              <Button variant="secondary" size="sm" onClick={discardDraft} disabled={saving}>
                {t('agentPane.discardDraft')}
              </Button>
            ) : null}
            <Button variant="primary" size="sm" onClick={handleClose} disabled={saving}>
              {saving ? t('agentPane.configSaving') : t('agentPane.configDone')}
            </Button>
          </div>
        </div>
      )}
    >
      <div className="agent-config-modal" onKeyDown={handleKeyDown}>
        <AgentConfigLockBanner
          busy={busy}
          loopActive={loopActive}
          awaitingDelegations={awaitingDelegations}
        />
        <div className="agent-config-modal__body">
          <AgentConfigSectionRail
            items={railItems}
            value={section}
            label={t('agentPane.configSectionsLabel')}
            onChange={selectSection}
          />
          <section className="agent-config-modal__panel" aria-label={sectionLabels[section]}>
            <h3 className="agent-config-modal__panel-title">{sectionLabels[section]}</h3>
            {locked && EDITABLE_WHILE_RUNNING.has(section) ? (
              <p className="agent-config-modal__next-turn">{t('agentPane.appliesNextTurn')}</p>
            ) : null}
            {section === 'identity' || section === 'objective' || section === 'rules' ? (
              <AgentConfigIdentityColumn
                section={section}
                draft={draft}
                locked={locked}
                onChange={updateDraft}
                onCommit={commitIdentity}
              />
            ) : (
              <AgentConfigSettingsPane
                section={section}
                meta={meta}
                cwd={cwd}
                loopMode={loopMode}
                loopActive={loopActive}
                locked={locked}
                diskContexts={diskContexts}
                selectedContextIds={selectedContextIds}
                modelOptions={modelOptions}
                modelsLoading={modelsLoading}
                modelsError={modelsError}
                onReloadModels={() => setModelsReload(n => n + 1)}
                cliStatuses={cliStatuses}
                onChangeCoordination={onChangeCoordination}
                onAcceptDelegationsChange={onAcceptDelegationsChange}
                onAllowExpertReplicasChange={onAllowExpertReplicasChange}
                onOrchestrationMaxRoundsChange={onOrchestrationMaxRoundsChange}
                onOrchestrationWorkStyleChange={onOrchestrationWorkStyleChange}
                onChangeDelegateTo={onChangeDelegateTo}
                onChangeProvider={onChangeProvider}
                onChangeModel={onChangeModel}
                onChangePermission={onChangePermission}
                onChangeNativeSkills={onChangeNativeSkills}
                onChangeMcpsAllowed={onChangeMcpsAllowed}
                onToggleLoopMode={onToggleLoopMode}
                onToggleContext={onToggleContext}
                onOpenContextsModal={onOpenContextsModal}
                peerAgents={peerAgents}
              />
            )}
          </section>
        </div>
      </div>
    </TerminalModal>
  )
}
