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
  monogram?: string
  busy?: boolean
  provider?: AgentCliProvider
  coordination?: 'none' | 'orchestrator' | 'productOwner'
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
  /** Tab activa: oculta confirms portaled sin perder estado. */
  tabActive?: boolean
  contexts?: PlaneAgentContextChip[]
  configLabel: string
  deleteLabel: string
  maximizeLabel: string
  restoreLabel: string
  closeWindowLabel: string
  /** Nombre puesto a mano: manda sobre la carpeta en la pastilla del mini. */
  customTitle?: string
  /** Basename de la carpeta actual (solo terminales). */
  folderName?: string
  children: React.ReactNode
  onExpand: () => void
  onClose: () => void
  onFocus: () => void
  onToggleFullscreen: () => void
  onOpenConfig: () => void
  /** Mini agente: clic en la card abre el chat del plano. */
  onOpenChat: () => void
  onDelete: () => void
  /** Renombra la terminal (doble clic en el título de la ventana expandida). */
  onRename?: (next: string) => void
  /** Asigna un contexto soltado sobre este agente. */
  onDropContext?: (contextId: string) => void
  /** Altura real del mini (agentes) para apilar sin huecos. */
  onMiniContentHeightChange?: (paneId: string, height: number) => void
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
  /** Clic en icono results (sin drag) → vista previa del contexto. */
  onOpenResultsPreview?: (contextId: string) => void
}

export const PlanePaneWindow: React.FC<PlanePaneWindowProps> = ({
  paneId,
  kind,
  title,
  monogram,
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
  tabActive = true,
  contexts = [],
  configLabel,
  deleteLabel,
  maximizeLabel,
  restoreLabel,
  closeWindowLabel,
  customTitle,
  folderName,
  children,
  onExpand,
  onClose,
  onFocus,
  onToggleFullscreen,
  onOpenConfig,
  onOpenChat,
  onDelete,
  onRename,
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
  onOpenResultsPreview,
}) => {
  const { t } = useT()
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const isAgent = kind === 'agent'
  // Agente nunca expande PaneWindow (clic → onOpenChat); solo terminales usan open.
  const isExpanded = !isAgent && window.open
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
        paneId={paneId}
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
        onRename={isAgent ? undefined : onRename}
        renameLabel={t('tabs.planeRenameTerminal')}
        miniLivePreview={!isAgent}
        miniAgentCard={isAgent}
        // Terminales: titlebar macOS. Agentes: mini card sin chrome.
        showTitlebar={!isAgent}
        miniFolderBadge={!isAgent && (customTitle || folderName) ? (
          <PlaneMiniFolderBadge
            folder={customTitle || folderName!}
            named={Boolean(customTitle)}
          />
        ) : undefined}
        miniFace={isAgent ? (
          <PlaneMiniFace
            name={title}
            monogram={monogram}
            busy={busy}
            provider={provider}
            coordination={coordination}
            statusLabel={statusLabel}
            agentId={agentId}
            reorderEnabled={reorderEnabled}
            reorderLabel={t('tabs.planeDragHandle')}
            resultsDragLabel={t('tabs.planeAgentResultsDrag')}
            onReorderPointerDown={
              reorderEnabled && onReorderHandlePointerDown
                ? onReorderHandlePointerDown
                : undefined
            }
            onOpenResultsPreview={onOpenResultsPreview}
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
        active={tabActive}
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
