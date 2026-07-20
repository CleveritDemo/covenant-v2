import React, { useEffect, useMemo, useState } from 'react'
import type { AgentCliImageAttachment } from '@shared/agentCliTypes'
import type { AgentPlaneStatus } from '../agent/AgentPane'
import { PlaneChatComposer, type PlaneChatContextOption } from './PlaneChatComposer'
import { PlaneChatContextsBar } from './PlaneChatContextsBar'
import { PlaneChatDock } from './PlaneChatDock'
import { PlaneFabStack } from './PlaneFabStack'
import { PlaneMap, type PlaneMapEntity } from './PlaneMap'
import { PlaneIdleThinking } from './PlaneIdleThinking'
import { PlaneProjectFolder } from './PlaneProjectFolder'
import { PlaneQuickChat } from './PlaneQuickChat'
import type { PlaneContextPoolItem } from './PlaneContextPool'
import { planeAgentColor, resolveAgentColor } from './planeAgentColor'
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
        color: resolveAgentColor(entity.paneId, entity.color),
      })),
    [entities],
  )

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

  /** Badge: abrir / cambiar; si ya está abierto, ocultar. */
  const toggleChatAgent = (paneId: string): void => {
    onOpenChatAgentChange(openChatAgentId === paneId ? null : paneId)
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

  const showIdleThinking = !anyFullscreen && !quickChatShowing && !agentWindowOpen

  const idleThinkingColor = openChatAgentId
    ? resolveAgentColor(
      openChatAgentId,
      entities.find(entity => entity.paneId === openChatAgentId)?.color,
    )
    : undefined

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
        <PlaneIdleThinking color={idleThinkingColor} />
      )}

      {!anyFullscreen && (
        <PlaneChatDock
          toolbar={openChatAgentId ? (
            <PlaneChatContextsBar
              accent={resolveAgentColor(
                openChatAgentId,
                entities.find(entity => entity.paneId === openChatAgentId)?.color,
              )}
              contexts={composerContexts}
              selectedContextIds={selectedContextIds}
              contextsEmptyHint={chatContextsEmpty}
              autoImprove={autoImprove}
              onToggleContext={contextId => {
                onToggleAgentContext(openChatAgentId, contextId)
              }}
              onAutoImproveChange={enabled => {
                onAutoImproveChange(openChatAgentId, enabled)
              }}
            />
          ) : null}
          chat={quickChatVisible && openChatAgentId ? (
            <PlaneQuickChat
              key={openChatAgentId}
              messages={quickChatStatus?.messages ?? []}
              busy={Boolean(quickChatStatus?.busy)}
              activity={quickChatStatus?.activity ?? ''}
              activeAssistantId={quickChatStatus?.activeAssistantId ?? null}
              agentColor={openChatAgentId
                ? resolveAgentColor(
                  openChatAgentId,
                  entities.find(entity => entity.paneId === openChatAgentId)?.color,
                )
                : planeAgentColor('default')}
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
              onSelectAgent={toggleChatAgent}
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
