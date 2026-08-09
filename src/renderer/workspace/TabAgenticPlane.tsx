import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useT } from '@i18n/useT'
import type { AgentCliImageAttachment } from '@shared/agentCliTypes'
import type { GitListedRepo } from '@shared/gitSessionTypes'
import type { PlaneLoopChain } from '@shared/planeLoopChain'
import {
  computePlaneChatColumnWidth,
  PLANE_CHAT_BASE_WIDTH,
} from '@shared/paneWindows'
import type { AgentPlaneStatus } from '../agent/AgentPane'
import { PlaneChatComposer } from './PlaneChatComposer'
import { PlaneChatContextsBar } from './PlaneChatContextsBar'
import { PlaneChatDock } from './PlaneChatDock'
import { PlaneFabStack } from './PlaneFabStack'
import { PlaneMap, type PlaneMapEntity } from './PlaneMap'
import { PlaneIdleGravity } from './PlaneIdleGravity'
import { PlaneProjectFolder } from './PlaneProjectFolder'
import { PlaneRevealFolderButton } from './PlaneRevealFolderButton'
import { PlaneLoopsButton } from './PlaneLoopsButton'
import { PlaneResyncButton } from './PlaneResyncButton'
import { PlaneBrainstormsListButton } from './PlaneBrainstormsListButton'
import { PlaneExplorerButton } from './PlaneExplorerButton'
import { PlaneGitButton } from './PlaneGitButton'
import { PlanePulseButton } from './PlanePulseButton'
import { PulseModal } from './PulseModal'
import { PlaneLoopsSection, type PlaneLoopsAgent } from './PlaneLoopsSection'
import { PlaneQuickChat } from './PlaneQuickChat'
import {
  PlaneContextPool,
  type PlaneContextPoolAgent,
  type PlaneContextPoolItem,
} from './PlaneContextPool'
import {
  TabFileExplorerWindow,
  type TabFileExplorerWindowHandle,
} from './TabFileExplorerWindow'
import type { FileExplorerPersistedState } from '@shared/fileExplorerPersistedState'
import { APP_OVERLAY_MODAL_Z } from '@shared/overlayZIndex'
import './TabAgenticPlane.css'

export type { PlaneMapEntity }

export interface TabAgenticPlaneProps {
  emptyTitle: string
  emptyHint: string
  /** Tab activa (modales portaled solo visibles aquí). */
  tabActive?: boolean
  agentFabTitle: string
  terminalFabTitle: string
  idleAgentLabel: string
  contextPoolTitle: string
  contextPoolConfigureLabel: string
  contextPoolCreateLabel: string
  contextPoolChipHint?: string
  contextPoolAssignLabel: string
  contextPoolAssignEmptyHint: string
  /** Aria del contador del chip; recibe el nº de agentes. */
  contextPoolAssignedCountLabel: (count: number) => string
  contextPoolEditLabel: string
  chatPlaceholder: string
  chatEmptyAgents: string
  chatSendLabel: string
  tabContexts: PlaneContextPoolItem[]
  onToggleAgentContext: (paneId: string, contextId: string) => void
  onAutoImproveChange: (paneId: string, enabled: boolean) => void
  onToggleLoop: (paneId: string) => void
  onRemoveQueuedTurn: (paneId: string, id: string) => void
  onUpdateQueuedTurn: (paneId: string, id: string, text: string) => void
  onMergeQueuedTurns: (paneId: string) => void
  canAdd: boolean
  /** Si false, el FAB de agente queda deshabilitado (p. ej. sin carpeta de proyecto). */
  canAddAgent?: boolean
  /** Si false, el FAB de terminal queda deshabilitado (p. ej. sin carpeta de proyecto). */
  canAddTerminal?: boolean
  bootstrapAgentsLabel?: string
  bootstrapAgentsTitle?: string
  bootstrapAgentsDisabledTitle?: string
  showBootstrapAgents?: boolean
  canBootstrapAgents?: boolean
  onBootstrapAgents?: () => void
  activePaneId: string
  entities: PlaneMapEntity[]
  onAddAgent: () => void
  onAddTerminal: () => void
  onExpandEntity: (paneId: string) => void
  onCloseWindow: (paneId: string) => void
  onMinimizeAllWindows: () => void
  onFocusWindow: (paneId: string) => void
  onConfigureContexts: () => void
  onCreateContext: () => void
  /** Clic en chip del pool → editar ese contexto (sin DnD). */
  onOpenContext?: (contextId: string) => void
  /** Asigna un contexto arrastrado del pool a un agente. */
  onAssignContext: (paneId: string, contextId: string) => void
  /** Clic en icono results → vista previa del Markdown del contexto. */
  onOpenResultsPreview?: (contextId: string) => void
  onSendChat: (paneId: string, text: string, images: AgentCliImageAttachment[]) => void
  /** Detiene el turno activo del agente desde el composer del plano. */
  onStopChat: (paneId: string) => void
  /** Pide limpiar la conversación del agente (confirmación en AgentPane). */
  onClearConversation: (paneId: string) => void
  /** Agente cuyo chat está abierto en el plano (`null` = ninguno). Persistido en la sesión. */
  openChatAgentId: string | null
  /** Abre/cambia el chat, o lo cierra con `null`. */
  onOpenChatAgentChange: (paneId: string | null) => void
  /** Estados de chat por agente (para el chat centrado del plano). */
  agentStatuses?: Record<string, AgentPlaneStatus>
  chatFontSize?: number
  configLabel: string
  deleteLabel: string
  maximizeLabel: string
  restoreLabel: string
  closeWindowLabel: string
  projectFolder: string
  projectFolderSelectLabel: string
  projectFolderChangeLabel: string
  projectFolderEmptyHint: string
  projectFolderRevealLabel: string
  onSelectProjectFolder: () => void
  onRevealProjectFolder?: () => void
  /** Re-sincroniza repos/agentes/contextos de un workspace org. */
  onResyncWorkspace?: () => void
  resyncWorkspaceLabel?: string
  resyncWorkspaceBusy?: boolean
  canResyncWorkspace?: boolean
  loopsOpen: boolean
  onLoopsOpenChange: (open: boolean) => void
  loopsButtonLabel: string
  brainstormNeedFolderHint?: string
  canOpenBrainstorm?: boolean
  brainstormsListOpen?: boolean
  onBrainstormsListOpenChange?: (open: boolean) => void
  brainstormsListButtonLabel?: string
  loopsTitle: string
  loopsSubtitle: string
  loopsEmptyTitle: string
  loopsEmptyHint: string
  loopsChainsTitle: string
  loopsChainsEmpty: string
  loopsCreateChainLabel: string
  loopsAppendStepLabel: string
  loopsStartChainLabel: string
  loopsStopChainLabel: string
  loopsDeleteChainLabel: string
  loopsChainModalTitle: string
  loopsChainModalDescription: string
  loopsAppendModalTitle: string
  loopsAppendModalDescription: string
  loopsAgentLabel: string
  loopsObjectiveLabel: string
  loopsObjectivePlaceholder: string
  loopsNoAgentsHint: string
  loopsNoAppendAgentsHint: string
  loopsBlockNeedObjectiveHint: string
  loopsChainConfirmLabel: string
  loopsAppendConfirmLabel: string
  loopsCancelLabel: string
  loopsStatusIdle: string
  loopsStatusBusy: string
  loopsStatusLooping: string
  loopsChainStatusIdle: string
  loopsChainStatusRunning: string
  loopsChainStatusWaiting: string
  loopsChainStatusStopped: string
  loopChains: PlaneLoopChain[]
  onLoopChainsChange: (chains: PlaneLoopChain[]) => void
  onStartLoopChain: (chainId: string) => void
  onStopLoopChain: (chainId: string) => void
  canStartLoopChains?: boolean
  startLoopChainsBlockedHint?: string
  onOpenConfig: (paneId: string) => void
  onDeletePane: (paneId: string) => void
  onRenamePane?: (paneId: string, title: string) => void
  onToggleFullscreen: (paneId: string) => void
  renderPane: (paneId: string) => React.ReactNode
  /** Persiste el orden de minis en una columna del plano. */
  onReorderPanes?: (kind: 'terminal' | 'agent', orderedPaneIds: string[]) => void
  reorderAriaLabel?: string
  /** Explorador como ventana del plano (solo si hay terminal en la tab). */
  explorerSessionId?: string | null
  explorerState?: FileExplorerPersistedState
  explorerTitle?: string
  explorerButtonLabel?: string
  explorerZIndex?: number
  explorerThemeId?: string
  explorerCwd?: string
  onExplorerStateChange?: (patch: Partial<FileExplorerPersistedState>) => void
  onToggleExplorer?: () => void
  explorerHostRef?: React.Ref<TabFileExplorerWindowHandle>
  /** Botón Git en la barra del plano (visible si hay projectFolder). */
  canOpenGitPanel?: boolean
  gitButtonDisabled?: boolean
  gitButtonLabel?: string
  gitButtonDisabledTitle?: string
  gitPickerOpen?: boolean
  onGitButtonClick?: () => void
  /** Repos git del root folder del tab, listados bajo el composer del plano. */
  gitRepos: GitListedRepo[]
  /** Clic en un repo de la lista → abre su modal git. */
  onOpenRepoGit: (path: string) => void
  /** Revalida la lista de repos contra el disco. */
  onRefreshRepos?: () => void
}

export const TabAgenticPlane: React.FC<TabAgenticPlaneProps> = ({
  emptyTitle,
  emptyHint,
  tabActive = true,
  agentFabTitle,
  terminalFabTitle,
  idleAgentLabel,
  contextPoolTitle,
  contextPoolConfigureLabel,
  contextPoolCreateLabel,
  contextPoolChipHint,
  contextPoolAssignLabel,
  contextPoolAssignEmptyHint,
  contextPoolAssignedCountLabel,
  contextPoolEditLabel,
  chatPlaceholder,
  chatEmptyAgents,
  chatSendLabel,
  tabContexts,
  onToggleAgentContext,
  onAutoImproveChange,
  onToggleLoop,
  onRemoveQueuedTurn,
  onUpdateQueuedTurn,
  onMergeQueuedTurns,
  canAdd,
  canAddAgent = true,
  canAddTerminal = true,
  bootstrapAgentsLabel,
  bootstrapAgentsTitle,
  bootstrapAgentsDisabledTitle,
  showBootstrapAgents = false,
  canBootstrapAgents = false,
  onBootstrapAgents,
  activePaneId,
  entities,
  onAddAgent,
  onAddTerminal,
  onExpandEntity,
  onCloseWindow,
  onMinimizeAllWindows,
  onFocusWindow,
  onConfigureContexts,
  onCreateContext,
  onOpenContext,
  onAssignContext,
  onOpenResultsPreview,
  onSendChat,
  onStopChat,
  onClearConversation,
  openChatAgentId,
  onOpenChatAgentChange,
  agentStatuses = {},
  chatFontSize = 13,
  configLabel,
  deleteLabel,
  maximizeLabel,
  restoreLabel,
  closeWindowLabel,
  projectFolder,
  projectFolderSelectLabel,
  projectFolderChangeLabel,
  projectFolderEmptyHint,
  projectFolderRevealLabel,
  onSelectProjectFolder,
  onRevealProjectFolder,
  onResyncWorkspace,
  resyncWorkspaceLabel = '',
  resyncWorkspaceBusy = false,
  canResyncWorkspace = false,
  loopsOpen,
  onLoopsOpenChange,
  loopsButtonLabel,
  brainstormNeedFolderHint,
  canOpenBrainstorm = false,
  brainstormsListOpen = false,
  onBrainstormsListOpenChange,
  brainstormsListButtonLabel = 'Brainstorms',
  loopsTitle,
  loopsSubtitle,
  loopsEmptyTitle,
  loopsEmptyHint,
  loopsChainsTitle,
  loopsChainsEmpty,
  loopsCreateChainLabel,
  loopsAppendStepLabel,
  loopsStartChainLabel,
  loopsStopChainLabel,
  loopsDeleteChainLabel,
  loopsChainModalTitle,
  loopsChainModalDescription,
  loopsAppendModalTitle,
  loopsAppendModalDescription,
  loopsAgentLabel,
  loopsObjectiveLabel,
  loopsObjectivePlaceholder,
  loopsNoAgentsHint,
  loopsNoAppendAgentsHint,
  loopsBlockNeedObjectiveHint,
  loopsChainConfirmLabel,
  loopsAppendConfirmLabel,
  loopsCancelLabel,
  loopsStatusIdle,
  loopsStatusBusy,
  loopsStatusLooping,
  loopsChainStatusIdle,
  loopsChainStatusRunning,
  loopsChainStatusWaiting,
  loopsChainStatusStopped,
  loopChains,
  onLoopChainsChange,
  onStartLoopChain,
  onStopLoopChain,
  canStartLoopChains = true,
  startLoopChainsBlockedHint = '',
  onOpenConfig,
  onDeletePane,
  onRenamePane,
  onToggleFullscreen,
  renderPane,
  onReorderPanes,
  reorderAriaLabel,
  explorerSessionId = null,
  explorerState,
  explorerTitle = '',
  explorerButtonLabel,
  explorerZIndex = APP_OVERLAY_MODAL_Z,
  explorerThemeId = '',
  explorerCwd = '',
  onExplorerStateChange,
  onToggleExplorer,
  explorerHostRef,
  canOpenGitPanel = false,
  gitButtonDisabled = false,
  gitButtonLabel = '',
  gitButtonDisabledTitle = '',
  gitPickerOpen = false,
  onGitButtonClick,
  gitRepos,
  onOpenRepoGit,
  onRefreshRepos,
}) => {
  const { t } = useT()
  const planeRef = useRef<HTMLDivElement>(null)
  const [viewport, setViewport] = useState({ width: 0, height: 0 })
  // Pulse solo lee del store por IPC: no necesita nada del padre, así que su
  // estado se queda acá en vez de engordar las props de App.tsx.
  const [pulseOpen, setPulseOpen] = useState(false)

  useLayoutEffect(() => {
    const el = planeRef.current
    if (!el) return
    const measure = (): void => {
      const width = el.clientWidth
      const height = el.clientHeight
      if (width <= 0 || height <= 0) return
      setViewport(prev => (
        prev.width === width && prev.height === height ? prev : { width, height }
      ))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const agents = useMemo(
    () => entities
      .filter(entity => entity.kind === 'agent')
      .map(entity => {
        const status = agentStatuses[entity.paneId]
        return {
          paneId: entity.paneId,
          title: entity.title,
          busy: Boolean(status?.busy ?? entity.busy),
          loopActive: Boolean(status?.loopActive),
          awaitingDelegations: Boolean(status?.awaitingDelegations),
          delegationWorkActive: Boolean(status?.delegationWorkActive),
          orchestratorBusy: Boolean(status?.orchestratorBusy),
        }
      }),
    [agentStatuses, entities],
  )

  const loopAgents = useMemo<PlaneLoopsAgent[]>(
    () => entities
      .filter(entity => entity.kind === 'agent')
      .map(entity => {
        const status = agentStatuses[entity.paneId]
        return {
          paneId: entity.paneId,
          title: entity.title,
          busy: Boolean(status?.busy ?? entity.busy),
          loopActive: Boolean(status?.loopActive),
          loopMode: Boolean(status?.loopMode),
          provider: entity.provider,
        }
      }),
    [agentStatuses, entities],
  )

  /** Agentes asignables desde el pool de contextos. */
  const contextPoolAgents = useMemo<PlaneContextPoolAgent[]>(
    () => entities
      .filter(entity => entity.kind === 'agent')
      .map(entity => ({
        paneId: entity.paneId,
        title: entity.title,
        contextIds: entity.contextIds ?? [],
      })),
    [entities],
  )

  const terminalCount = useMemo(
    () => entities.filter(entity => entity.kind !== 'agent').length,
    [entities],
  )

  const chatColumnWidth = useMemo(() => {
    const vp = viewport.width > 0 && viewport.height > 0
      ? viewport
      : { width: 960, height: 640 }
    return computePlaneChatColumnWidth(
      vp,
      Math.max(agents.length, terminalCount, 1),
    )
  }, [agents.length, terminalCount, viewport])

  /** Burbujas realmente montadas en el plano (no solo elegibles). */
  const [quickChatShowing, setQuickChatShowing] = useState(false)

  // Si el agente abierto desaparece, cierra el chat persistido.
  useEffect(() => {
    if (!openChatAgentId) return
    if (agents.some(agent => agent.paneId === openChatAgentId)) return
    onOpenChatAgentChange(null)
  }, [agents, openChatAgentId, onOpenChatAgentChange])

  useEffect(() => {
    if (!openChatAgentId) setQuickChatShowing(false)
  }, [openChatAgentId])

  /** Badge / card: abrir o cambiar chat (no cierra al repetir). */
  const openChatAgent = (paneId: string): void => {
    onOpenChatAgentChange(paneId)
  }

  const closeChatAgent = (): void => {
    onOpenChatAgentChange(null)
  }

  const selectedContextIds = useMemo(() => {
    const agent = entities.find(entity => entity.paneId === openChatAgentId)
    if (!agent || agent.kind !== 'agent') return []
    if (agent.contextIds?.length) return agent.contextIds
    return (agent.contexts ?? []).map(context => context.id)
  }, [entities, openChatAgentId])

  const autoImprove = Boolean(
    entities.find(entity => entity.paneId === openChatAgentId)?.autoImproveContexts,
  )

  const quickChatStatus = openChatAgentId
    ? agentStatuses[openChatAgentId] ?? null
    : null

  // Agentes no expanden ventana; el chat del plano no compite con window.open.
  const quickChatVisible = Boolean(
    openChatAgentId
    && quickChatStatus
    && (quickChatStatus.busy || quickChatStatus.messages.length > 0),
  )

  const anyFullscreen = entities.some(
    entity => entity.window.open && entity.window.fullscreen,
  )

  const anyWindowOpen = entities.some(entity => entity.window.open)
    || Boolean(explorerState?.open)

  const showIdleGravity = !anyFullscreen && !quickChatShowing
  const canToggleExplorer = Boolean(explorerSessionId && onToggleExplorer)

  return (
    <div
      ref={planeRef}
      className="tab-agentic-plane"
      style={{
        ['--plane-chat-column-width' as string]: `${chatColumnWidth || PLANE_CHAT_BASE_WIDTH}px`,
      }}
      onPointerDown={event => {
        if (event.button !== 0) return
        if (!anyWindowOpen) return
        const target = event.target as HTMLElement | null
        if (!target) return
        // Clic fuera de la ventana abierta (y fuera de FABs/composer/modales) → minimizar.
        if (target.closest([
          '.pane-window',
          '.plane-fab-stack',
          '.plane-fab',
          '.plane-project-folder',
          '.plane-top-left-bar',
          '.plane-chat-composer',
          '.plane-chat-dock__composer-shell',
          '.plane-chat-dock__toolbar',
          '.plane-context-pool',
          '[role="dialog"]',
          'button',
          'a',
          'input',
          'textarea',
          'select',
        ].join(', '))) {
          return
        }
        onMinimizeAllWindows()
      }}
    >
      {!anyFullscreen && (
        <div className="plane-top-left-bar">
          <PlaneProjectFolder
            folderPath={projectFolder}
            selectLabel={projectFolderSelectLabel}
            changeLabel={projectFolderChangeLabel}
            emptyHint={projectFolderEmptyHint}
            onSelect={onSelectProjectFolder}
          />
          {canResyncWorkspace && onResyncWorkspace ? (
            <PlaneResyncButton
              label={resyncWorkspaceLabel || ''}
              busy={Boolean(resyncWorkspaceBusy)}
              onClick={() => onResyncWorkspace()}
            />
          ) : null}
          {canToggleExplorer ? (
            <PlaneExplorerButton
              label={explorerButtonLabel || explorerTitle || loopsButtonLabel}
              pressed={Boolean(explorerState?.open)}
              onClick={() => onToggleExplorer?.()}
            />
          ) : null}
          {canOpenGitPanel && onGitButtonClick ? (
            <PlaneGitButton
              label={gitButtonLabel}
              disabled={gitButtonDisabled}
              disabledTitle={gitButtonDisabledTitle}
              pressed={gitPickerOpen}
              onClick={() => onGitButtonClick()}
            />
          ) : null}
          <PlaneLoopsButton
            label={loopsButtonLabel}
            pressed={loopsOpen}
            onClick={() => onLoopsOpenChange(!loopsOpen)}
          />
          <PlanePulseButton
            label={t('pulse.button')}
            pressed={pulseOpen}
            onClick={() => setPulseOpen(open => !open)}
          />
          {onBrainstormsListOpenChange ? (
            <PlaneBrainstormsListButton
              label={brainstormsListButtonLabel}
              pressed={brainstormsListOpen}
              disabled={!canOpenBrainstorm}
              disabledTitle={brainstormNeedFolderHint}
              onClick={() => onBrainstormsListOpenChange(!brainstormsListOpen)}
            />
          ) : null}
          {projectFolder.trim() && onRevealProjectFolder ? (
            <PlaneRevealFolderButton
              folderPath={projectFolder}
              label={projectFolderRevealLabel}
              onReveal={onRevealProjectFolder}
            />
          ) : null}
        </div>
      )}
      <PlaneLoopsSection
        open={loopsOpen && !anyFullscreen && tabActive}
        title={loopsTitle}
        subtitle={loopsSubtitle}
        emptyTitle={loopsEmptyTitle}
        emptyHint={loopsEmptyHint}
        chainsTitle={loopsChainsTitle}
        chainsEmpty={loopsChainsEmpty}
        createChainLabel={loopsCreateChainLabel}
        appendStepLabel={loopsAppendStepLabel}
        startChainLabel={loopsStartChainLabel}
        stopChainLabel={loopsStopChainLabel}
        deleteChainLabel={loopsDeleteChainLabel}
        chainModalTitle={loopsChainModalTitle}
        chainModalDescription={loopsChainModalDescription}
        appendModalTitle={loopsAppendModalTitle}
        appendModalDescription={loopsAppendModalDescription}
        agentLabel={loopsAgentLabel}
        objectiveLabel={loopsObjectiveLabel}
        objectivePlaceholder={loopsObjectivePlaceholder}
        noAgentsHint={loopsNoAgentsHint}
        noAppendAgentsHint={loopsNoAppendAgentsHint}
        blockNeedObjectiveHint={loopsBlockNeedObjectiveHint}
        chainConfirmLabel={loopsChainConfirmLabel}
        appendConfirmLabel={loopsAppendConfirmLabel}
        cancelLabel={loopsCancelLabel}
        statusIdle={loopsStatusIdle}
        statusBusy={loopsStatusBusy}
        statusLooping={loopsStatusLooping}
        chainStatusIdle={loopsChainStatusIdle}
        chainStatusRunning={loopsChainStatusRunning}
        chainStatusWaiting={loopsChainStatusWaiting}
        chainStatusStopped={loopsChainStatusStopped}
        agents={loopAgents}
        chains={loopChains}
        canStartChains={canStartLoopChains}
        startBlockedHint={startLoopChainsBlockedHint}
        onClose={() => onLoopsOpenChange(false)}
        onChainsChange={onLoopChainsChange}
        onStartChain={onStartLoopChain}
        onStopChain={onStopLoopChain}
      />
      <PlaneMap
        idleAgentLabel={idleAgentLabel}
        entities={entities}
        activePaneId={activePaneId}
        chatActiveAgentId={openChatAgentId}
        tabActive={tabActive}
        configLabel={configLabel}
        deleteLabel={deleteLabel}
        maximizeLabel={maximizeLabel}
        restoreLabel={restoreLabel}
        closeWindowLabel={closeWindowLabel}
        renderPane={renderPane}
        onExpandEntity={onExpandEntity}
        onCloseWindow={onCloseWindow}
        onFocusWindow={onFocusWindow}
        onToggleFullscreen={onToggleFullscreen}
        onOpenConfig={onOpenConfig}
        onOpenChat={openChatAgent}
        onDeletePane={onDeletePane}
        onRenamePane={onRenamePane}
        onAssignContext={onAssignContext}
        onOpenResultsPreview={onOpenResultsPreview}
        onReorderPanes={onReorderPanes}
        reorderAriaLabel={reorderAriaLabel}
      />

      {explorerSessionId && explorerState?.open && onExplorerStateChange ? (
        <TabFileExplorerWindow
          ref={explorerHostRef}
          sessionId={explorerSessionId}
          themeId={explorerThemeId}
          cwd={explorerCwd}
          explorerState={explorerState}
          onExplorerStateChange={onExplorerStateChange}
          onClose={() => {
            onExplorerStateChange({ open: false, fullscreen: false })
          }}
          title={explorerTitle}
          zIndex={explorerZIndex}
          tabActive={tabActive}
        />
      ) : null}

      {showIdleGravity && (
        <PlaneIdleGravity
          emptyHint={entities.length === 0 ? emptyHint : undefined}
          bootstrapAgentsLabel={bootstrapAgentsLabel}
          bootstrapAgentsTitle={bootstrapAgentsTitle}
          bootstrapAgentsDisabledTitle={bootstrapAgentsDisabledTitle}
          showBootstrapAgents={showBootstrapAgents && entities.length === 0}
          canBootstrapAgents={canBootstrapAgents}
          onBootstrapAgents={onBootstrapAgents}
        />
      )}

      {!anyFullscreen && (
        <PlaneContextPool
          title={contextPoolTitle}
          configureLabel={contextPoolConfigureLabel}
          createLabel={contextPoolCreateLabel}
          chipActionHint={contextPoolChipHint}
          assignLabel={contextPoolAssignLabel}
          assignEmptyHint={contextPoolAssignEmptyHint}
          assignedCountLabel={contextPoolAssignedCountLabel}
          editLabel={contextPoolEditLabel}
          contexts={tabContexts}
          agents={contextPoolAgents}
          onConfigure={onConfigureContexts}
          onCreate={onCreateContext}
          onOpenContext={onOpenContext}
          onToggleAssign={onToggleAgentContext}
        />
      )}

      {!anyFullscreen && (
        <PlaneChatDock
          toolbar={openChatAgentId ? (
            <PlaneChatContextsBar
              assignedContextCount={selectedContextIds.length}
              autoImprove={autoImprove}
              loopMode={Boolean(quickChatStatus?.loopMode)}
              loopActive={Boolean(quickChatStatus?.loopActive)}
              canClearConversation={Boolean(quickChatStatus?.canClearConversation)}
              onAutoImproveChange={enabled => {
                onAutoImproveChange(openChatAgentId, enabled)
              }}
              onToggleLoop={() => onToggleLoop(openChatAgentId)}
              onClearConversation={() => onClearConversation(openChatAgentId)}
            />
          ) : null}
          chat={quickChatVisible && openChatAgentId ? (
            <PlaneQuickChat
              key={openChatAgentId}
              messages={quickChatStatus?.messages ?? []}
              busy={Boolean(quickChatStatus?.busy)}
              activity={quickChatStatus?.activity ?? ''}
              awaitingDelegations={Boolean(quickChatStatus?.awaitingDelegations)}
              orchestrationAwaiting={quickChatStatus?.orchestrationAwaiting ?? null}
              activeAssistantId={quickChatStatus?.activeAssistantId ?? null}
              enteringIds={quickChatStatus?.enteringIds}
              materializingIds={quickChatStatus?.materializingIds}
              settlingId={quickChatStatus?.settlingId ?? null}
              fontSize={chatFontSize}
              onShowingChange={setQuickChatShowing}
            />
          ) : null}
          composer={(
            <PlaneChatComposer
              agents={agents}
              selectedAgentId={openChatAgentId}
              placeholder={chatPlaceholder}
              emptyAgentsHint={chatEmptyAgents}
              sendLabel={chatSendLabel}
              queuedTurns={quickChatStatus?.queuedTurns ?? []}
              onSelectAgent={openChatAgent}
              onCloseChat={closeChatAgent}
              onStop={onStopChat}
              onSend={onSendChat}
              onRemoveQueuedTurn={onRemoveQueuedTurn}
              onUpdateQueuedTurn={onUpdateQueuedTurn}
              onMergeQueuedTurns={onMergeQueuedTurns}
              gitRepos={gitRepos}
              onOpenRepoGit={onOpenRepoGit}
              onRefreshRepos={onRefreshRepos}
            />
          )}
        />
      )}

      {!anyFullscreen && (
        <PlaneFabStack
          canAdd={canAdd}
          canAddAgent={canAddAgent}
          canAddTerminal={canAddTerminal}
          agentTitle={agentFabTitle}
          terminalTitle={terminalFabTitle}
          onAddAgent={onAddAgent}
          onAddTerminal={onAddTerminal}
          bootstrapAgentsTitle={bootstrapAgentsTitle || bootstrapAgentsLabel}
          bootstrapAgentsDisabledTitle={bootstrapAgentsDisabledTitle}
          showBootstrapAgents={showBootstrapAgents && entities.length > 0}
          canBootstrapAgents={canBootstrapAgents}
          onBootstrapAgents={onBootstrapAgents}
        />
      )}

      <PulseModal open={pulseOpen} onClose={() => setPulseOpen(false)} />
    </div>
  )
}
