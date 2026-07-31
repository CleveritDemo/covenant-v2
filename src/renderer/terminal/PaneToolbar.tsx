import React from 'react'
import type { DragEvent } from 'react'
import type { IconName } from '../components/ui/Icon'
import { Icon } from '../components/ui/Icon'
import { useT } from '@i18n/useT'
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
  folderTitle: string
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
  folderTitle,
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
            title={folderTitle}
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
}) => (
  <span
    role="button"
    tabIndex={-1}
    draggable
    className="pane-toolbar-reorder-handle terminal-chrome-btn"
    title={reorderTitle}
    aria-label={reorderAriaLabel}
    aria-grabbed={isGrabbed}
    onMouseDown={e => { e.stopPropagation() }}
    onDragStart={onDragStart}
    onDragEnd={onDragEnd}
  >
    <Icon name="drag-handle" size={9} />
  </span>
)

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
    title={title}
    aria-label={ariaLabel ?? title}
    onMouseDown={onPointerDown}
    onClick={onClick}
  >
    <Icon name={icon} size={9} />
  </button>
)
