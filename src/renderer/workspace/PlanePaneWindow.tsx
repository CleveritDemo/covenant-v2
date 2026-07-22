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
  snippet?: string
  idleLabel: string
  window: PaneWindowState
  /** Caja fija (~70% viewport) compartida por todas las ventanas abiertas. */
  openGeometry: PaneWindowGeometry
  /** Ranura mini en el plano (misma div al expandir). */
  miniOrigin: PaneWindowGeometry
  activePaneId: string
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
}

export const PlanePaneWindow: React.FC<PlanePaneWindowProps> = ({
  paneId,
  kind,
  title,
  busy = false,
  provider,
  snippet,
  idleLabel,
  window,
  openGeometry,
  miniOrigin,
  activePaneId,
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
}) => {
  const { t } = useT()
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const isAgent = kind === 'agent'
  const isExpanded = window.open
  const display = isExpanded ? 'full' : 'mini'
  const statusLabel = busy
    ? (snippet?.trim() || idleLabel)
    : idleLabel

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
          x: miniOrigin.x,
          y: miniOrigin.y,
          width: miniOrigin.width,
          height: miniOrigin.height,
        }}
        focused={paneId === activePaneId && isExpanded}
        busy={busy}
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
            statusLabel={statusLabel}
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
