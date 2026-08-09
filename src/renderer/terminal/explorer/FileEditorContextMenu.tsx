import React, { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '@i18n/useT'
import { FileExplorerMenuItem } from './FileExplorerMenuItem'

const MOD =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform) ? '⌘' : 'Ctrl+'
const ALT =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform) ? '⌥' : 'Alt+'

interface FileEditorContextMenuProps {
  x: number
  y: number
  hasSelection: boolean
  readOnly: boolean
  onCut: () => void
  onCopy: () => void
  onPaste: () => void
  onSelectAll: () => void
  onSelectOccurrences: () => void
  onFind: () => void
  onFoldAll: () => void
  onUnfoldAll: () => void
  onClose: () => void
}

/** Menú contextual del editor de código (click derecho sobre el área de texto). */
export const FileEditorContextMenu: React.FC<FileEditorContextMenuProps> = ({
  x,
  y,
  hasSelection,
  readOnly,
  onCut,
  onCopy,
  onPaste,
  onSelectAll,
  onSelectOccurrences,
  onFind,
  onFoldAll,
  onUnfoldAll,
  onClose,
}) => {
  const { t } = useT()
  const menuRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onCloseRef.current()
    }
    const onMouseDown = (e: MouseEvent): void => {
      if (menuRef.current?.contains(e.target as Node)) return
      onCloseRef.current()
    }
    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('mousedown', onMouseDown, true)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('mousedown', onMouseDown, true)
    }
  }, [])

  const left = Math.min(x, Math.max(8, window.innerWidth - 220))
  const top = Math.min(y, Math.max(8, window.innerHeight - 300))
  // Cada acción cierra el menú: ninguna de ellas tiene sentido repetida sobre un
  // menú que ya no coincide con la selección viva del editor.
  const run = (fn: () => void) => () => {
    fn()
    onClose()
  }

  return createPortal(
    <div
      ref={menuRef}
      className="file-explorer-context-menu"
      role="menu"
      style={{ '--menu-x': `${left}px`, '--menu-y': `${top}px` } as React.CSSProperties}
      onContextMenu={e => e.preventDefault()}
      onMouseDown={e => e.stopPropagation()}
    >
      <FileExplorerMenuItem
        label={t('fileExplorer.editor.menu.cut')}
        shortcut={`${MOD}X`}
        disabled={!hasSelection || readOnly}
        onClick={run(onCut)}
      />
      <FileExplorerMenuItem
        label={t('fileExplorer.editor.menu.copy')}
        shortcut={`${MOD}C`}
        disabled={!hasSelection}
        onClick={run(onCopy)}
      />
      <FileExplorerMenuItem
        label={t('fileExplorer.editor.menu.paste')}
        shortcut={`${MOD}V`}
        disabled={readOnly}
        onClick={run(onPaste)}
      />
      <div className="file-explorer-context-menu__sep" role="separator" />
      <FileExplorerMenuItem
        label={t('fileExplorer.editor.menu.selectAll')}
        shortcut={`${MOD}A`}
        onClick={run(onSelectAll)}
      />
      <FileExplorerMenuItem
        label={t('fileExplorer.editor.menu.selectOccurrences')}
        shortcut={`${MOD}⇧L`}
        disabled={!hasSelection}
        onClick={run(onSelectOccurrences)}
      />
      <div className="file-explorer-context-menu__sep" role="separator" />
      <FileExplorerMenuItem
        label={t('fileExplorer.editor.menu.find')}
        shortcut={`${MOD}F`}
        onClick={run(onFind)}
      />
      <div className="file-explorer-context-menu__sep" role="separator" />
      <FileExplorerMenuItem
        label={t('fileExplorer.editor.menu.foldAll')}
        shortcut={`${MOD}${ALT}[`}
        onClick={run(onFoldAll)}
      />
      <FileExplorerMenuItem
        label={t('fileExplorer.editor.menu.unfoldAll')}
        shortcut={`${MOD}${ALT}]`}
        onClick={run(onUnfoldAll)}
      />
    </div>,
    document.body,
  )
}
