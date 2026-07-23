import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { AgentCliImageAttachment } from '@shared/agentCliTypes'
import type { PlaneLoopChain } from '@shared/planeLoopChain'
import {
  computePlaneChatColumnWidth,
  PLANE_CHAT_BASE_WIDTH,
} from '@shared/paneWindows'
import type { AgentPlaneStatus } from '../agent/AgentPane'
import { PlaneChatComposer, type PlaneChatContextOption } from './PlaneChatComposer'
import { PlaneChatContextsBar } from './PlaneChatContextsBar'
import { PlaneChatDock } from './PlaneChatDock'
import { PlaneFabStack } from './PlaneFabStack'
import { PlaneMap, type PlaneMapEntity } from './PlaneMap'
import { PlaneIdleNucleus } from './PlaneIdleNucleus'
import { PlaneProjectFolder } from './PlaneProjectFolder'
import { PlaneLoopsButton } from './PlaneLoopsButton'
import { PlaneLoopsSection, type PlaneLoopsAgent } from './PlaneLoopsSection'
import { PlaneQuickChat } from './PlaneQuickChat'
import { PlaneContextPool, type PlaneContextPoolItem } from './PlaneContextPool'
import { resolveAgentColor } from './planeAgentColor'
import './TabAgenticPlane.css'

export type { PlaneMapEntity }

export interface TabAgenticPlaneProps {
  emptyTitle: string
  emptyHint: string
  agentFabTitle: string
  terminalFabTitle: string
  idleAgentLabel: string
  contextPoolTitle: string
  contextPoolConfigureLabel: string
  chatPlaceholder: string
  chatEmptyAgents: string
  chatSendLabel: string
  chatContextsEmpty: string
  tabContexts: PlaneContextPoolItem[]
  onToggleAgentContext: (paneId: string, contextId: string) => void
  onAutoImproveChange: (paneId: string, enabled: boolean) => void
  onToggleLoop: (paneId: string) => void
  onRemoveQueuedTurn: (paneId: string, id: string) => void
  onUpdateQueuedTurn: (paneId: string, id: string, text: string) => void
  canAdd: boolean
  /** Si false, el FAB de agente queda deshabilitado (p. ej. sin carpeta de proyecto). */
  canAddAgent?: boolean
  /** Si false, el FAB de terminal queda deshabilitado (p. ej. sin carpeta de proyecto). */
  canAddTerminal?: boolean
  activePaneId: string
  entities: PlaneMapEntity[]
  onAddAgent: () => void
  onAddTerminal: () => void
  onExpandEntity: (paneId: string) => void
  onCloseWindow: (paneId: string) => void
  onMinimizeAllWindows: () => void
  onFocusWindow: (paneId: string) => void
  onConfigureContexts: () => void
  /** Asigna un contexto arrastrado del pool a un agente. */
  onAssignContext: (paneId: string, contextId: string) => void
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
  onSelectProjectFolder: () => void
  onRevealProjectFolder?: () => void
  loopsOpen: boolean
  onLoopsOpenChange: (open: boolean) => void
  loopsButtonLabel: string
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
  onToggleFullscreen: (paneId: string) => void
  renderPane: (paneId: string) => React.ReactNode
  /** Persiste el orden de minis en una columna del plano. */
  onReorderPanes?: (kind: 'terminal' | 'agent', orderedPaneIds: string[]) => void
  reorderAriaLabel?: string
}

export const TabAgenticPlane: React.FC<TabAgenticPlaneProps> = ({
  emptyTitle,
  emptyHint,
  agentFabTitle,
  terminalFabTitle,
  idleAgentLabel,
  contextPoolTitle,
  contextPoolConfigureLabel,
  chatPlaceholder,
  chatEmptyAgents,
  chatSendLabel,
  chatContextsEmpty,
  tabContexts,
  onToggleAgentContext,
  onAutoImproveChange,
  onToggleLoop,
  onRemoveQueuedTurn,
  onUpdateQueuedTurn,
  canAdd,
  canAddAgent = true,
  canAddTerminal = true,
  activePaneId,
  entities,
  onAddAgent,
  onAddTerminal,
  onExpandEntity,
  onCloseWindow,
  onMinimizeAllWindows,
  onFocusWindow,
  onConfigureContexts,
  onAssignContext,
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
  onSelectProjectFolder,
  onRevealProjectFolder,
  loopsOpen,
  onLoopsOpenChange,
  loopsButtonLabel,
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
  onToggleFullscreen,
  renderPane,
  onReorderPanes,
  reorderAriaLabel,
}) => {
  const planeRef = useRef<HTMLDivElement>(null)
  const [viewport, setViewport] = useState({ width: 0, height: 0 })

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
          color: resolveAgentColor(entity.paneId, entity.color),
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
          color: resolveAgentColor(entity.paneId, entity.color),
          busy: Boolean(status?.busy ?? entity.busy),
          loopActive: Boolean(status?.loopActive),
          loopMode: Boolean(status?.loopMode),
          provider: entity.provider,
        }
      }),
    [agentStatuses, entities],
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
    return (agent?.contexts ?? []).map(context => context.id)
  }, [entities, openChatAgentId])

  const autoImprove = Boolean(
    entities.find(entity => entity.paneId === openChatAgentId)?.autoImproveContexts,
  )

  const composerContexts = useMemo<PlaneChatContextOption[]>(
    () => tabContexts.map(context => ({
      id: context.id,
      name: context.name,
      kind: context.kind,
      kindLabel: context.kindLabel,
      icon: context.icon,
      color: context.color,
    })),
    [tabContexts],
  )

  const quickChatAgent = useMemo(
    () => entities.find(entity => entity.paneId === openChatAgentId) ?? null,
    [entities, openChatAgentId],
  )

  const quickChatStatus = openChatAgentId
    ? agentStatuses[openChatAgentId] ?? null
    : null

  const quickChatWindowOpen = Boolean(quickChatAgent?.window.open)

  const quickChatVisible = Boolean(
    openChatAgentId
    && !quickChatWindowOpen
    && quickChatStatus
    && (quickChatStatus.busy || quickChatStatus.messages.length > 0),
  )

  const anyFullscreen = entities.some(
    entity => entity.window.open && entity.window.fullscreen,
  )

  const agentWindowOpen = entities.some(
    entity => entity.kind === 'agent' && entity.window.open,
  )

  const anyWindowOpen = entities.some(entity => entity.window.open)

  const showIdleNucleus = !anyFullscreen && !quickChatShowing && !agentWindowOpen

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
            onReveal={onRevealProjectFolder}
          />
          <PlaneLoopsButton
            label={loopsButtonLabel}
            pressed={loopsOpen}
            onClick={() => onLoopsOpenChange(!loopsOpen)}
          />
        </div>
      )}
      <PlaneLoopsSection
        open={loopsOpen && !anyFullscreen}
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
        emptyTitle={emptyTitle}
        emptyHint={emptyHint}
        idleAgentLabel={idleAgentLabel}
        entities={entities}
        activePaneId={activePaneId}
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
        onAssignContext={onAssignContext}
        onReorderPanes={onReorderPanes}
        reorderAriaLabel={reorderAriaLabel}
      />

      {showIdleNucleus && (
        <PlaneIdleNucleus />
      )}

      {!anyFullscreen && (
        <PlaneContextPool
          title={contextPoolTitle}
          configureLabel={contextPoolConfigureLabel}
          contexts={tabContexts}
          onConfigure={onConfigureContexts}
        />
      )}

      {!anyFullscreen && (
        <PlaneChatDock
          toolbar={openChatAgentId ? (
            <PlaneChatContextsBar
              contexts={composerContexts}
              selectedContextIds={selectedContextIds}
              contextsEmptyHint={chatContextsEmpty}
              autoImprove={autoImprove}
              loopMode={Boolean(quickChatStatus?.loopMode)}
              loopActive={Boolean(quickChatStatus?.loopActive)}
              canClearConversation={Boolean(quickChatStatus?.canClearConversation)}
              onToggleContext={contextId => {
                onToggleAgentContext(openChatAgentId, contextId)
              }}
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
        />
      )}
    </div>
  )
}
