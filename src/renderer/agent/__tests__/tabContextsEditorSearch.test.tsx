/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { TabContext } from '@shared/tabContext'
import { TabContextsEditor, type PreviewState } from '../TabContextsEditor'

vi.mock('@i18n/useT', () => ({
  useT: () => ({ t: (key: string) => key }),
}))

const selectProjectFiles = vi.fn()
const selectDirectory = vi.fn()
const searchProjectFiles = vi.fn()
const importContextFiles = vi.fn()
const revealTabContext = vi.fn()

const idlePreview: PreviewState = { status: 'idle' }

beforeEach(() => {
  selectProjectFiles.mockReset()
  selectDirectory.mockReset()
  searchProjectFiles.mockReset().mockResolvedValue({ ok: true, paths: [], hits: [] })
  importContextFiles.mockReset()
  revealTabContext.mockReset()
  ;(window as unknown as { api: Record<string, unknown> }).api = {
    selectProjectFiles,
    selectDirectory,
    searchProjectFiles,
    importContextFiles,
    revealTabContext,
  }
})

afterEach(cleanup)

function renderEditor(draft: TabContext) {
  return render(
    <TabContextsEditor
      draft={draft}
      contexts={[]}
      preview={idlePreview}
      notesContent="# body"
      jiraKeyDraft=""
      resolvedCwdLabel=""
      projectCwd="/repo"
      duplicateMessage=""
      actionMessage=""
      readOnlyChangelog={false}
      onUpdate={vi.fn()}
      onSelectKind={vi.fn()}
      onNotesContentChange={vi.fn()}
      onJiraKeyDraftChange={vi.fn()}
      onPreviewReset={vi.fn()}
    />,
  )
}

describe('TabContextsEditor — búsqueda en cuerpo markdown', () => {
  it('skill: monta el campo de cuerpo markdown y no el de carpeta raíz', () => {
    renderEditor({
      id: 'iaterminal:skill:deploy',
      name: 'deploy',
      fileName: 'context/deploy.md',
      kind: 'skill',
    })
    expect(screen.getByText('tabContexts.skillBody')).toBeTruthy()
    expect(screen.getByLabelText('tabContexts.bodySearchAria')).toBeTruthy()
    expect(screen.queryByText('tabContexts.rootPath')).toBeNull()
  })

  it('notes: monta el campo de cuerpo markdown', () => {
    renderEditor({
      id: 'iaterminal:notes:My-notes',
      name: 'My notes',
      fileName: 'context/My-notes.md',
      kind: 'notes',
    })
    expect(screen.getByText('tabContexts.notes')).toBeTruthy()
    expect(screen.getByLabelText('tabContexts.bodySearchAria')).toBeTruthy()
  })

  it('folderTree: no monta el campo de cuerpo markdown', () => {
    renderEditor({
      id: 'iaterminal:folderTree',
      name: 'folders',
      fileName: 'folders.md',
      kind: 'folderTree',
    })
    expect(screen.queryByLabelText('tabContexts.bodySearchAria')).toBeNull()
    expect(screen.queryByText('tabContexts.notes')).toBeNull()
    expect(screen.queryByText('tabContexts.skillBody')).toBeNull()
  })
})
