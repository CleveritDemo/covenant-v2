/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import type { FileExplorerEntry } from '@shared/fileExplorerTypes'
import { FileExplorerTreeNode } from '../FileExplorerTreeNode'

vi.mock('@i18n/useT', () => ({
  useT: () => ({ t: (key: string) => key, i18n: { language: 'es' } }),
}))

afterEach(cleanup)

const noop = (): void => {}

function nodeProps(entry: FileExplorerEntry) {
  return {
    entry,
    depth: 0,
    expanded: false,
    loading: false,
    selected: false,
    multiSelected: false,
    isRenaming: false,
    renameValue: '',
    onRenameChange: noop,
    onRenameSubmit: noop,
    onRenameCancel: noop,
    onToggleDir: noop,
    onSelectEntry: noop,
    onDoubleClickEntry: noop,
  }
}

describe('FileExplorerTreeNode drag', () => {
  it('una fila de archivo no deja pasar drop al contenedor', () => {
    const parentDrop = vi.fn()
    const { container } = render(
      <div onDrop={parentDrop}>
        <FileExplorerTreeNode
          {...nodeProps({ name: 'foo.ts', relPath: 'src/foo.ts', isDirectory: false })}
        />
      </div>,
    )
    const row = container.querySelector('.file-explorer-tree-node') as HTMLElement
    fireEvent.dragOver(row)
    fireEvent.drop(row)
    expect(parentDrop).not.toHaveBeenCalled()
  })

  it('una fila de carpeta sí llama onDropOnDir', () => {
    const onDropOnDir = vi.fn()
    const { container } = render(
      <FileExplorerTreeNode
        {...nodeProps({ name: 'src', relPath: 'src', isDirectory: true })}
        onDropOnDir={onDropOnDir}
      />,
    )
    const row = container.querySelector('.file-explorer-tree-node') as HTMLElement
    fireEvent.drop(row)
    expect(onDropOnDir).toHaveBeenCalledTimes(1)
    expect(onDropOnDir.mock.calls[0][0]).toBe('src')
  })
})
