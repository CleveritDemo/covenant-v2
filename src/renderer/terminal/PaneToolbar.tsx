import React, { useRef } from 'react'
import type { DragEvent } from 'react'
import type { IconName } from '../components/ui/Icon'
import { Icon } from '../components/ui/Icon'
import { Tooltip } from '../components/ui/Tooltip'
import { useT } from '@i18n/useT'
import {
  allowArmedHtml5DragStart,
  armHtml5DragOnMouseDown,
  createHtml5DragArm,
  disarmHtml5Drag,
} from '../html5DragArm'
import { PaneToolbarQuickOpen } from './PaneToolbarQuickOpen'

export interface PaneToolbarProps {
  showReorderHandle: boolean
  isGrabbed: boolean
  showClosePane: boolean
  explorerOpen: boolean
  /** false = tab sin projectFolder; no se muestra el botón del explorador. */
  explorerEnabled: boolean
  /** Nombre de la carpeta actual (basename del cwd). */
  folderLabel: string
  /** Ruta completa para tooltip. */
  quickOpenOpen: boolean
  sessionId: string
  onQuickOpenClose: () => void
  onQuickOpenPick: (relPath: string) => void
  onDragHandleStart: (e: DragEvent) => void
  onDragHandleEnd: () => void
  onClosePane: () => void
  onOpenGitPanel: () => void
  onToggleExplorer: () => void
  onOpenFolderInFinder: () => void
  onPointerDown: (e: React.MouseEvent) => void
}

export const PaneToolbar: React.FC<PaneToolbarProps> = ({
  showReorderHandle,
  isGrabbed,
  showClosePane,
  onDragHandleStart,
  onDragHandleEnd,
  onClosePane,
  onOpenGitPanel,
  onToggleExplorer,
  explorerOpen,
  explorerEnabled,
  folderLabel,
  quickOpenOpen,
  sessionId,
  onQuickOpenClose,
  onQuickOpenPick,
  onOpenFolderInFinder,
  onPointerDown,
}) => {
  const { t } = useT()
  return (
    <div
      className={[
        'pane-toolbar-host',
        quickOpenOpen ? 'pane-toolbar-host--quick-open' : '',
      ].filter(Boolean).join(' ')}
    >
      <div
        className="pane-toolbar"
        onMouseDown={e => {
          if ((e.target as HTMLElement).closest('.pane-toolbar-quick-open')) return
          onPointerDown(e)
        }}
      >
        <div className="pane-toolbar__group pane-toolbar__group--start">
          {showReorderHandle && (
            <PaneReorderHandle
              isGrabbed={isGrabbed}
              reorderTitle={t('paneToolbar.reorderTitle')}
              reorderAriaLabel={t('paneToolbar.reorderAriaLabel')}
              onDragStart={onDragHandleStart}
              onDragEnd={onDragHandleEnd}
            />
          )}
          <PaneToolbarButton
            icon="git-branch"
            title={t('paneToolbar.gitTitle')}
            aria-label={t('paneToolbar.gitAriaLabel')}
            variant="git"
            onPointerDown={onPointerDown}
            onClick={onOpenGitPanel}
          />
          {explorerEnabled && (
            <PaneToolbarButton
              icon="files"
              title={t('paneToolbar.explorerTitle')}
              aria-label={t('paneToolbar.explorerAriaLabel')}
              variant="files"
              active={explorerOpen}
              onPointerDown={onPointerDown}
              onClick={onToggleExplorer}
            />
          )}
          <PaneToolbarButton
            icon="folder"
            title={t('paneToolbar.finderTitle')}
            aria-label={t('paneToolbar.finderAriaLabel')}
            variant="folder"
            onPointerDown={onPointerDown}
            onClick={onOpenFolderInFinder}
          />
        </div>
        <div className="pane-toolbar__trail">
          <span
            className="pane-toolbar__folder-label"
            aria-label={t('paneToolbar.currentFolderAriaLabel', { folder: folderLabel })}
          >
            {folderLabel}
          </span>
        </div>
        {showClosePane && (
          <div className="pane-toolbar__group pane-toolbar__group--end">
            <PaneToolbarButton
              icon="close"
              title={t('paneToolbar.closePaneTitle')}
              aria-label={t('paneToolbar.closePaneAriaLabel')}
              variant="close"
              onPointerDown={onPointerDown}
              onClick={onClosePane}
            />
          </div>
        )}
      </div>

      {quickOpenOpen && (
        <PaneToolbarQuickOpen
          open={quickOpenOpen}
          sessionId={sessionId}
          onClose={onQuickOpenClose}
          onPick={onQuickOpenPick}
        />
      )}
    </div>
  )
}

interface PaneReorderHandleProps {
  isGrabbed: boolean
  reorderTitle: string
  reorderAriaLabel: string
  onDragStart: (e: DragEvent) => void
  onDragEnd: () => void
}

const PaneReorderHandle: React.FC<PaneReorderHandleProps> = ({
  isGrabbed,
  reorderTitle,
  reorderAriaLabel,
  onDragStart,
  onDragEnd,
}) => {
  const dragArmRef = useRef(createHtml5DragArm())
  return (
    <Tooltip content={reorderTitle}>
      <span
        role="button"
        tabIndex={-1}
        draggable={false}
        className="pane-toolbar-reorder-handle terminal-chrome-btn"
        aria-label={reorderAriaLabel}
        aria-grabbed={isGrabbed}
        onMouseDown={e => {
          e.stopPropagation()
          armHtml5DragOnMouseDown(e.currentTarget, dragArmRef.current, e.button)
        }}
        onDragStart={e => {
          if (!allowArmedHtml5DragStart(
            e.currentTarget,
            dragArmRef.current,
            () => e.preventDefault(),
          )) {
            return
          }
          onDragStart(e)
        }}
        onDragEnd={e => {
          disarmHtml5Drag(e.currentTarget, dragArmRef.current)
          onDragEnd()
        }}
      >
        <Icon name="drag-handle" size={9} />
      </span>
    </Tooltip>
  )
}

export interface PaneToolbarButtonProps {
  icon: IconName
  title: string
  'aria-label'?: string
  variant: 'folder' | 'close' | 'git' | 'files'
  active?: boolean
  className?: string
  onPointerDown?: (e: React.MouseEvent) => void
  onClick: () => void
}

export const PaneToolbarButton: React.FC<PaneToolbarButtonProps> = ({
  icon,
  title,
  'aria-label': ariaLabel,
  variant,
  active = false,
  className,
  onPointerDown,
  onClick,
}) => (
  <button
    type="button"
    tabIndex={-1}
    className={[
      `pane-toolbar-btn pane-toolbar-btn--${variant} terminal-chrome-btn`,
      active ? 'pane-toolbar-btn--active' : '',
      className ?? '',
    ].filter(Boolean).join(' ')}
    aria-label={ariaLabel ?? title}
    onMouseDown={onPointerDown}
    onClick={onClick}
  >
    <Icon name={icon} size={9} />
  </button>
)
