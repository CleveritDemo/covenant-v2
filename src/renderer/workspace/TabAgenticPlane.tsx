import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { AgentCliImageAttachment } from '@shared/agentCliTypes'
import type { AgentPlaneStatus } from '../agent/AgentPane'
import { PlaneChatComposer, type PlaneChatContextOption } from './PlaneChatComposer'
import { PlaneChatDock } from './PlaneChatDock'
import { PlaneFabStack } from './PlaneFabStack'
import { PlaneMap, type PlaneMapEntity } from './PlaneMap'
import { PlaneIdleThinking } from './PlaneIdleThinking'
import { PlaneProjectFolder } from './PlaneProjectFolder'
import { PlaneQuickChat } from './PlaneQuickChat'
import type { PlaneContextPoolItem } from './PlaneContextPool'
import { planeAgentColor } from './planeAgentColor'
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
  onSendChat: (paneId: string, text: string, images: AgentCliImageAttachment[]) => void
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
  onOpenConfig: (paneId: string) => void
  onDeletePane: (paneId: string) => void
  onToggleFullscreen: (paneId: string) => void
  renderPane: (paneId: string) => React.ReactNode
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
  onSendChat,
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
  onOpenConfig,
  onDeletePane,
  onToggleFullscreen,
  renderPane,
}) => {
  const agents = useMemo(
    () => entities
      .filter(entity => entity.kind === 'agent')
      .map(entity => ({
        paneId: entity.paneId,
        title: entity.title,
        busy: entity.busy,
        color: planeAgentColor(entity.paneId),
      })),
    [entities],
  )

  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  /** Tras ocultar el chat del plano, no auto-seleccionar de nuevo el primer agente. */
  const allowEmptyAgentSelectionRef = useRef(false)
  /** Burbujas realmente montadas en el plano (no solo elegibles). */
  const [quickChatShowing, setQuickChatShowing] = useState(false)

  useEffect(() => {
    if (agents.length === 0) {
      allowEmptyAgentSelectionRef.current = false
      setSelectedAgentId(null)
      return
    }
    setSelectedAgentId(current => {
      if (current && agents.some(agent => agent.paneId === current)) return current
      if (current === null && allowEmptyAgentSelectionRef.current) return null
      allowEmptyAgentSelectionRef.current = false
      const activeAgent = agents.find(agent => agent.paneId === activePaneId)
      return activeAgent?.paneId ?? agents[0].paneId
    })
  }, [activePaneId, agents])

  useEffect(() => {
    if (!selectedAgentId) setQuickChatShowing(false)
  }, [selectedAgentId])

  const selectAgent = (paneId: string): void => {
    allowEmptyAgentSelectionRef.current = false
    setSelectedAgentId(paneId)
  }

  const dismissQuickChat = (): void => {
    allowEmptyAgentSelectionRef.current = true
    setSelectedAgentId(null)
  }

  const selectedContextIds = useMemo(() => {
    const agent = entities.find(entity => entity.paneId === selectedAgentId)
    return (agent?.contexts ?? []).map(context => context.id)
  }, [entities, selectedAgentId])

  const autoImprove = Boolean(
    entities.find(entity => entity.paneId === selectedAgentId)?.autoImproveContexts,
  )

  const composerContexts = useMemo<PlaneChatContextOption[]>(
    () => tabContexts.map(context => ({
      id: context.id,
      name: context.name,
      kindLabel: context.kindLabel,
      icon: context.icon,
      color: context.color,
    })),
    [tabContexts],
  )

  const quickChatAgent = useMemo(
    () => entities.find(entity => entity.paneId === selectedAgentId) ?? null,
    [entities, selectedAgentId],
  )

  const quickChatStatus = selectedAgentId
    ? agentStatuses[selectedAgentId] ?? null
    : null

  const quickChatWindowOpen = Boolean(quickChatAgent?.window.open)

  const quickChatVisible = Boolean(
    selectedAgentId
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

  const showIdleThinking = !anyFullscreen && !quickChatShowing && !agentWindowOpen

  return (
    <div
      className="tab-agentic-plane"
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
          '.plane-chat-composer',
          '.plane-chat-dock__composer-shell',
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
        <PlaneProjectFolder
          folderPath={projectFolder}
          selectLabel={projectFolderSelectLabel}
          changeLabel={projectFolderChangeLabel}
          emptyHint={projectFolderEmptyHint}
          onSelect={onSelectProjectFolder}
          onReveal={onRevealProjectFolder}
        />
      )}
      <PlaneMap
        emptyTitle={emptyTitle}
        emptyHint={emptyHint}
        idleAgentLabel={idleAgentLabel}
        contextPoolTitle={contextPoolTitle}
        contextPoolConfigureLabel={contextPoolConfigureLabel}
        tabContexts={tabContexts}
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
        onMinimizeAllWindows={onMinimizeAllWindows}
        onConfigureContexts={onConfigureContexts}
        onOpenConfig={onOpenConfig}
        onDeletePane={onDeletePane}
      />

      {showIdleThinking && (
        <PlaneIdleThinking />
      )}

      {!anyFullscreen && (
        <PlaneChatDock
          chat={(
            <PlaneQuickChat
              visible={quickChatVisible}
              messages={quickChatStatus?.messages ?? []}
              busy={Boolean(quickChatStatus?.busy)}
              activity={quickChatStatus?.activity ?? ''}
              activeAssistantId={quickChatStatus?.activeAssistantId ?? null}
              agentColor={selectedAgentId ? planeAgentColor(selectedAgentId) : planeAgentColor('default')}
              enteringIds={quickChatStatus?.enteringIds}
              materializingIds={quickChatStatus?.materializingIds}
              settlingId={quickChatStatus?.settlingId ?? null}
              fontSize={chatFontSize}
              onShowingChange={setQuickChatShowing}
              onDismiss={dismissQuickChat}
            />
          )}
          composer={(
            <PlaneChatComposer
              agents={agents}
              selectedAgentId={selectedAgentId}
              placeholder={chatPlaceholder}
              emptyAgentsHint={chatEmptyAgents}
              sendLabel={chatSendLabel}
              contexts={composerContexts}
              selectedContextIds={selectedContextIds}
              contextsEmptyHint={chatContextsEmpty}
              autoImprove={autoImprove}
              onSelectAgent={selectAgent}
              onToggleContext={contextId => {
                if (!selectedAgentId) return
                onToggleAgentContext(selectedAgentId, contextId)
              }}
              onAutoImproveChange={enabled => {
                if (!selectedAgentId) return
                onAutoImproveChange(selectedAgentId, enabled)
              }}
              onStop={paneId => {
                window.api.stopAgentTurn(paneId)
              }}
              onSend={onSendChat}
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
