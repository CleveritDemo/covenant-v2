import React, { useMemo, useState } from 'react'
import type { AgentCliProvider, PaneKind, PaneWindowState } from '@shared/tabSession'
import type { PaneWindowGeometry } from '@shared/paneWindows'
import { useT } from '@i18n/useT'
import { ConfirmTerminalModal } from '../components/ConfirmTerminalModal'
import { PaneWindow } from './PaneWindow'
import { PlaneAgentContextNodes, type PlaneAgentContextChip } from './PlaneAgentContextNodes'
import {
  PlaneAgentThreadNodes,
  type PlaneAgentThreadNode,
} from './PlaneAgentThreadNodes'
import { PlaneMiniActions } from './PlaneMiniActions'
import type { PlaneActivityDotKind } from '../agent/paneWorkActive'
import { PlaneMiniFace } from './PlaneMiniFace'
import { PlaneMiniFolderBadge } from './PlaneMiniFolderBadge'
import { armMiniExpandSuppress } from './miniExpandSuppress'
import './PlaneMiniActions.css'

export type { PlaneAgentContextChip, PlaneAgentThreadNode }

export interface PlanePaneWindowProps {
  paneId: string
  kind: PaneKind
  title: string
  /** Mesa de brainstorm abierta: la card se arrastra a ella. */
  seatDragEnabled?: boolean
  monogram?: string
  busy?: boolean
  /** Orquestador esperando resultados de especialistas. */
  awaitingDelegations?: boolean
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
  /** Sin transición de ranura durante el settle de arranque. */
  deferPositionMotion?: boolean
  /** Card fuera de la banda visible del plano: oculta sin desmontar. */
  outOfBand?: boolean
  /** Progreso de fade/escala continuo al acercarse al borde de la banda (1 = plena). */
  fadeProgress?: number
  /** Escala por proximidad al centro vertical de la banda (solo agentes). */
  centerScale?: number
  dragPosition?: { x: number; y: number } | null
  onReorderPointerDown?: (event: React.PointerEvent) => void
  /** Handle de agentes: reorder inmediato (sin long-press). */
  onReorderHandlePointerDown?: (event: React.PointerEvent) => void
  /** Slug del agente para drag del contexto results. */
  agentId?: string
  /** Clic en icono results (sin drag) → vista previa del contexto. */
  onOpenResultsPreview?: (contextId: string) => void
  /** Carpeta del proyecto: la usa el chip jira anidado para pedir su preview vía IPC. */
  cwd?: string
  /** Sube cuando los contextos se remateralizan; el chip jira relee su snapshot. */
  contextsRevision?: number
  threadNodes?: PlaneAgentThreadNode[]
  onOpenThread?: (threadId: string) => void
}

export const PlanePaneWindow: React.FC<PlanePaneWindowProps> = ({
  paneId,
  kind,
  title,
  seatDragEnabled = false,
  monogram,
  busy = false,
  awaitingDelegations = false,
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
  deferPositionMotion = false,
  outOfBand = false,
  fadeProgress = 1,
  centerScale = 1,
  dragPosition = null,
  onReorderPointerDown,
  onReorderHandlePointerDown,
  agentId,
  onOpenResultsPreview,
  cwd = '',
  contextsRevision = 0,
  threadNodes = [],
  onOpenThread,
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
  const showThreadNodes = isAgent
    && threadNodes.some(thread => thread.running)
    && Boolean(onOpenThread)
  const openAgentFromCard = onOpenChat
  const origin = dragPosition && !isExpanded
    ? {
        x: dragPosition.x,
        y: dragPosition.y,
        width: miniOrigin.width,
        height: miniOrigin.height,
      }
    : miniOrigin
  const effectiveFadeProgress = fadeProgress
  /**
   * Reparto de señales en la card mini, y son independientes:
   * - Esquina superior derecha: **solo** la ola del orquestador (delegaciones
   *   enviadas, esperando resultados).
   * - Listado bajo el nombre: **todo** hilo activo, sea turno humano o carril
   *   de delegación. Cada fila lleva su propio dot; un busy nunca sube a la
   *   esquina.
   */
  const miniCornerActivityDot: PlaneActivityDotKind | null =
    awaitingDelegations ? 'delegating' : null
  const paneWindowClassName = [
    effectiveFadeProgress <= 0 || outOfBand ? 'pane-window--out-of-band' : '',
    effectiveFadeProgress < 1 ? 'pane-window--fading' : '',
  ].filter(Boolean).join(' ') || undefined
  const paneWindowStyle = isAgent
    ? {
      ...(effectiveFadeProgress < 1
        ? { ['--plane-card-progress' as string]: effectiveFadeProgress }
        : {}),
      ['--plane-card-center-scale' as string]: centerScale,
    }
    : (effectiveFadeProgress < 1
      ? { ['--plane-card-progress' as string]: effectiveFadeProgress }
      : undefined)

  return (
    <>
      <PaneWindow
        title={title}
        paneId={paneId}
        display={display}
        className={paneWindowClassName}
        style={paneWindowStyle}
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
        miniActive={!isAgent && paneId === activePaneId && !isExpanded}
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
            seatDragEnabled={seatDragEnabled}
            monogram={monogram}
            busy={busy}
            activityDot={miniCornerActivityDot}
            provider={provider}
            coordination={coordination}
            statusLabel={statusLabel}
            onOpen={openAgentFromCard}
            statusSlot={showThreadNodes ? (
              <PlaneAgentThreadNodes
                threads={threadNodes}
                onOpenThread={onOpenThread!}
              />
            ) : undefined}
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
                cwd={cwd}
                contextsRevision={contextsRevision}
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
        onExpand={isAgent ? openAgentFromCard : onExpand}
        onToggleFullscreen={onToggleFullscreen}
        onClose={onClose}
        onFocus={onFocus}
        onDropContext={isAgent ? onDropContext : undefined}
        onMiniContentHeightChange={isAgent ? onMiniContentHeightChange : undefined}
        miniContentRevision={contexts.length}
        reorderEnabled={reorderEnabled && !isExpanded}
        reorderState={isExpanded ? 'idle' : reorderState}
        reorderJiggleDelayMs={reorderJiggleDelayMs}
        slotMotion={slotMotion && !isExpanded}
        deferPositionMotion={deferPositionMotion}
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
