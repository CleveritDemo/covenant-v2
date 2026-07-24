import React, { useState } from 'react'
import type { AgentCliProvider, PaneKind, PaneWindowState } from '@shared/tabSession'
import type { PaneWindowGeometry } from '@shared/paneWindows'
import { useT } from '@i18n/useT'
import { ConfirmTerminalModal } from '../components/ConfirmTerminalModal'
import { PaneWindow } from './PaneWindow'
import { PlaneAgentContextNodes, type PlaneAgentContextChip } from './PlaneAgentContextNodes'
import { PlaneMiniActions } from './PlaneMiniActions'
import { PlaneMiniFace } from './PlaneMiniFace'
import { PlaneMiniFolderBadge } from './PlaneMiniFolderBadge'
import { armMiniExpandSuppress } from './miniExpandSuppress'
import './PlaneMiniActions.css'

export type { PlaneAgentContextChip }

export interface PlanePaneWindowProps {
  paneId: string
  kind: PaneKind
  title: string
  busy?: boolean
  provider?: AgentCliProvider
  coordination?: 'none' | 'orchestrator'
  snippet?: string
  idleLabel: string
  window: PaneWindowState
  /** Caja fija (~70% viewport) compartida por todas las ventanas abiertas. */
  openGeometry: PaneWindowGeometry
  /** Ranura mini en el plano (misma div al expandir). */
  miniOrigin: PaneWindowGeometry
  activePaneId: string
  /** Chat del plano abierto para este agente (señal estática de selección). */
  chatActive?: boolean
  contexts?: PlaneAgentContextChip[]
  configLabel: string
  deleteLabel: string
  maximizeLabel: string
  restoreLabel: string
  closeWindowLabel: string
  /** Basename de la carpeta actual (solo terminales). */
  folderName?: string
  /** Path completo para tooltip del badge. */
  folderPath?: string
  children: React.ReactNode
  onExpand: () => void
  onClose: () => void
  onFocus: () => void
  onToggleFullscreen: () => void
  onOpenConfig: () => void
  /** Mini agente: clic en la card abre el chat del plano. */
  onOpenChat: () => void
  onDelete: () => void
  /** Asigna un contexto soltado sobre este agente. */
  onDropContext?: (contextId: string) => void
  /** Altura real del mini (agentes) para apilar sin huecos. */
  onMiniContentHeightChange?: (height: number) => void
  reorderEnabled?: boolean
  reorderState?: 'idle' | 'jiggle' | 'dragging' | 'previewMoving'
  reorderJiggleDelayMs?: number
  slotMotion?: boolean
  dragPosition?: { x: number; y: number } | null
  onReorderPointerDown?: (event: React.PointerEvent) => void
  /** Handle de agentes: reorder inmediato (sin long-press). */
  onReorderHandlePointerDown?: (event: React.PointerEvent) => void
  /** Slug del agente para drag del contexto results. */
  agentId?: string
}

export const PlanePaneWindow: React.FC<PlanePaneWindowProps> = ({
  paneId,
  kind,
  title,
  busy = false,
  provider,
  coordination,
  snippet,
  idleLabel,
  window,
  openGeometry,
  miniOrigin,
  activePaneId,
  chatActive = false,
  contexts = [],
  configLabel,
  deleteLabel,
  maximizeLabel,
  restoreLabel,
  closeWindowLabel,
  folderName,
  folderPath,
  children,
  onExpand,
  onClose,
  onFocus,
  onToggleFullscreen,
  onOpenConfig,
  onOpenChat,
  onDelete,
  onDropContext,
  onMiniContentHeightChange,
  reorderEnabled = false,
  reorderState = 'idle',
  reorderJiggleDelayMs = 0,
  slotMotion = false,
  dragPosition = null,
  onReorderPointerDown,
  onReorderHandlePointerDown,
  agentId,
}) => {
  const { t } = useT()
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const isAgent = kind === 'agent'
  const isExpanded = window.open
  const display = isExpanded ? 'full' : 'mini'
  const statusLabel = busy
    ? (snippet?.trim() || idleLabel)
    : idleLabel
  const origin = dragPosition && !isExpanded
    ? {
        x: dragPosition.x,
        y: dragPosition.y,
        width: miniOrigin.width,
        height: miniOrigin.height,
      }
    : miniOrigin

  return (
    <>
      <PaneWindow
        title={title}
        display={display}
        geometry={{
          ...openGeometry,
          zIndex: window.zIndex,
          fullscreen: window.fullscreen,
        }}
        miniOrigin={{
          x: origin.x,
          y: origin.y,
          width: origin.width,
          height: origin.height,
        }}
        focused={paneId === activePaneId && isExpanded}
        busy={busy}
        chatActive={isAgent && chatActive}
        maximizeLabel={maximizeLabel}
        restoreLabel={restoreLabel}
        closeLabel={closeWindowLabel}
        configureLabel={isAgent ? configLabel : undefined}
        onConfigure={isAgent ? onOpenConfig : undefined}
        miniLivePreview={!isAgent}
        miniAgentCard={isAgent}
        // Terminales: siempre titlebar macOS (mini y expandida). Agentes: solo expandida.
        showTitlebar={!isAgent || isExpanded}
        miniFolderBadge={!isAgent && folderName ? (
          <PlaneMiniFolderBadge folder={folderName} title={folderPath} />
        ) : undefined}
        miniFace={isAgent ? (
          <PlaneMiniFace
            name={title}
            busy={busy}
            provider={provider}
            coordination={coordination}
            statusLabel={statusLabel}
            agentId={agentId}
            reorderEnabled={reorderEnabled && !isExpanded}
            reorderLabel={t('tabs.planeDragHandle')}
            resultsDragLabel={t('tabs.planeAgentResultsDrag')}
            onReorderPointerDown={
              reorderEnabled && !isExpanded && onReorderHandlePointerDown
                ? onReorderHandlePointerDown
                : undefined
            }
          >
            {contexts.length > 0 ? (
              <PlaneAgentContextNodes
                contexts={contexts}
                onOpenAgent={onOpenChat}
              />
            ) : null}
          </PlaneMiniFace>
        ) : undefined}
        miniActions={(
          <PlaneMiniActions
            showConfig={isAgent}
            configLabel={configLabel}
            deleteLabel={deleteLabel}
            onConfigure={isAgent ? onOpenConfig : undefined}
            onDelete={() => {
              armMiniExpandSuppress()
              setConfirmDeleteOpen(true)
            }}
          />
        )}
        onExpand={isAgent ? onOpenChat : onExpand}
        onToggleFullscreen={onToggleFullscreen}
        onClose={onClose}
        onFocus={onFocus}
        onDropContext={isAgent ? onDropContext : undefined}
        onMiniContentHeightChange={isAgent ? onMiniContentHeightChange : undefined}
        reorderEnabled={reorderEnabled && !isExpanded}
        reorderState={isExpanded ? 'idle' : reorderState}
        reorderJiggleDelayMs={reorderJiggleDelayMs}
        slotMotion={slotMotion && !isExpanded}
        onReorderPointerDown={
          !isAgent && reorderEnabled && !isExpanded ? onReorderPointerDown : undefined
        }
      >
        {children}
      </PaneWindow>
      <ConfirmTerminalModal
        open={confirmDeleteOpen}
        message={isAgent
          ? t('tabs.planeConfirmDeleteAgentMessage', { title })
          : t('tabs.planeConfirmDeleteTerminalMessage', { title })}
        detail={isAgent
          ? t('tabs.planeConfirmDeleteAgentDetail')
          : t('tabs.planeConfirmDeleteTerminalDetail')}
        onConfirm={() => {
          setConfirmDeleteOpen(false)
          armMiniExpandSuppress()
          onDelete()
        }}
        onCancel={() => {
          setConfirmDeleteOpen(false)
          armMiniExpandSuppress()
        }}
      />
    </>
  )
}
