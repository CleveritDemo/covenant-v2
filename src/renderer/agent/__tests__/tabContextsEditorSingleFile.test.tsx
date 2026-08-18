/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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

const filesDraft = (overrides: Partial<TabContext> = {}): TabContext => ({
  id: 'iaterminal:files:Files',
  name: 'Files',
  fileName: 'context/Files.md',
  kind: 'files',
  ...overrides,
})

const singleFileDraft = (): TabContext => filesDraft({
  id: 'iaterminal:files:App-tsx',
  name: 'App.tsx',
  fileName: 'context/App.tsx.md',
  paths: ['src/App.tsx'],
  referenceOnly: true,
  rootPath: '',
})

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

function renderEditor(overrides: Partial<React.ComponentProps<typeof TabContextsEditor>> = {}) {
  const onUpdate = vi.fn()
  const onSelectKind = vi.fn()
  const onActionError = vi.fn()
  const view = render(
    <TabContextsEditor
      draft={filesDraft()}
      contexts={[]}
      preview={idlePreview}
      notesContent=""
      jiraKeyDraft=""
      resolvedCwdLabel=""
      projectCwd="/repo"
      duplicateMessage=""
      actionMessage=""
      readOnlyChangelog={false}
      onUpdate={onUpdate}
      onSelectKind={onSelectKind}
      onNotesContentChange={vi.fn()}
      onJiraKeyDraftChange={vi.fn()}
      onPreviewReset={vi.fn()}
      onActionError={onActionError}
      {...overrides}
    />,
  )
  return { ...view, onUpdate, onSelectKind, onActionError }
}

describe('TabContextsEditor — vista Un archivo', () => {
  it('pone el chip Un archivo justo después de File contents en el grupo host', () => {
    renderEditor()
    const radios = within(screen.getByRole('radiogroup')).getAllByRole('radio')
    const filesIndex = radios.findIndex(radio => radio.getAttribute('aria-label') === 'tabContexts.kind_files')
    expect(filesIndex).toBeGreaterThanOrEqual(0)
    expect(radios[filesIndex + 1]?.getAttribute('aria-label')).toBe('tabContexts.kind_singleFile')
  })

  it('con un draft de un archivo oculta raíz, rutas y referencia viva', () => {
    renderEditor({ draft: singleFileDraft() })
    expect(screen.getByRole('radio', { name: 'tabContexts.kind_singleFile' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('radio', { name: 'tabContexts.kind_files' }).getAttribute('aria-checked')).toBe('false')
    expect(screen.getByText('tabContexts.singleFileLabel')).toBeTruthy()
    expect(screen.getByText('src/App.tsx')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'tabContexts.singleFilePick' })).toBeTruthy()
    expect(screen.queryByText('tabContexts.rootPath')).toBeNull()
    expect(screen.queryByText('tabContexts.importFiles')).toBeNull()
    expect(screen.queryByText('tabContexts.referenceOnly')).toBeNull()
    expect(screen.getByText('tabContexts.name')).toBeTruthy()
  })

  it('sin cwd no abre el diálogo y avisa', async () => {
    const { onActionError } = renderEditor({ projectCwd: '  ' })
    fireEvent.click(screen.getByRole('radio', { name: 'tabContexts.kind_singleFile' }))
    await waitFor(() => {
      expect(onActionError).toHaveBeenCalledWith('tabContexts.missingCwd')
    })
    expect(selectProjectFiles).not.toHaveBeenCalled()
  })

  it('al elegir Un archivo abre el picker nativo y deja una sola ruta', async () => {
    selectProjectFiles.mockResolvedValue({
      ok: true,
      paths: ['src/App.tsx', 'src/main.ts'],
    })
    const { onSelectKind, onUpdate } = renderEditor()
    fireEvent.click(screen.getByRole('radio', { name: 'tabContexts.kind_singleFile' }))
    expect(onSelectKind).toHaveBeenCalledWith('files')
    await waitFor(() => {
      expect(selectProjectFiles).toHaveBeenCalledWith({
        cwd: '/repo',
        title: 'tabContexts.pickProjectFilesTitle',
      })
    })
    expect(onUpdate).toHaveBeenCalledWith({ referenceOnly: true, rootPath: '' })
    expect(onUpdate).toHaveBeenCalledWith({
      paths: ['src/App.tsx'],
      referenceOnly: true,
      rootPath: '',
      name: 'App.tsx',
      fileName: 'App.tsx.md',
    })
    expect(screen.getByRole('radio', { name: 'tabContexts.kind_singleFile' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.queryByText('tabContexts.importFiles')).toBeNull()
  })

  it('no pisa un nombre tecleado a mano', async () => {
    selectProjectFiles.mockResolvedValue({ ok: true, paths: ['src/App.tsx'] })
    const { onUpdate } = renderEditor({
      draft: filesDraft({ name: 'Mis archivos', fileName: 'context/Mis-archivos.md' }),
    })
    fireEvent.click(screen.getByRole('radio', { name: 'tabContexts.kind_singleFile' }))
    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith({
        paths: ['src/App.tsx'],
        referenceOnly: true,
        rootPath: '',
      })
    })
    expect(onUpdate).not.toHaveBeenCalledWith(expect.objectContaining({ name: 'App.tsx' }))
  })

  it('cancelar el diálogo no toca las rutas', async () => {
    selectProjectFiles.mockResolvedValue({ ok: false, cancelled: true })
    const { onUpdate, onActionError } = renderEditor()
    fireEvent.click(screen.getByRole('radio', { name: 'tabContexts.kind_singleFile' }))
    await waitFor(() => {
      expect(selectProjectFiles).toHaveBeenCalled()
    })
    expect(onUpdate).toHaveBeenCalledTimes(1)
    expect(onUpdate).toHaveBeenCalledWith({ referenceOnly: true, rootPath: '' })
    expect(onActionError).toHaveBeenCalledWith('')
    expect(onActionError).toHaveBeenCalledTimes(1)
  })

  it('fuera del proyecto avisa con pickOutsideProject', async () => {
    selectProjectFiles.mockResolvedValue({ ok: false, error: 'outside project folder' })
    const { onActionError } = renderEditor()
    fireEvent.click(screen.getByRole('radio', { name: 'tabContexts.kind_singleFile' }))
    await waitFor(() => {
      expect(onActionError).toHaveBeenCalledWith('tabContexts.pickOutsideProject')
    })
  })

  it('otro error del picker llega crudo o como previewError', async () => {
    selectProjectFiles.mockResolvedValue({ ok: false, error: 'nothing picked' })
    const { onActionError } = renderEditor()
    fireEvent.click(screen.getByRole('radio', { name: 'tabContexts.kind_singleFile' }))
    await waitFor(() => {
      expect(onActionError).toHaveBeenCalledWith('nothing picked')
    })
  })

  it('elegir File contents sale de la vista de un archivo', () => {
    renderEditor({ draft: singleFileDraft() })
    fireEvent.click(screen.getByRole('radio', { name: 'tabContexts.kind_files' }))
    expect(screen.getByRole('radio', { name: 'tabContexts.kind_files' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('radio', { name: 'tabContexts.kind_singleFile' }).getAttribute('aria-checked')).toBe('false')
    expect(screen.getByText('tabContexts.importFiles')).toBeTruthy()
    expect(screen.getByText('tabContexts.referenceOnly')).toBeTruthy()
  })

  it('al abrir otro contexto con el mismo editor, el modo se re-siembra del draft', () => {
    const { rerender, onUpdate, onSelectKind, onActionError } = renderEditor({
      draft: filesDraft({ paths: ['src/a.ts', 'src/b.ts'] }),
    })
    expect(screen.getByText('tabContexts.importFiles')).toBeTruthy()

    rerender(
      <TabContextsEditor
        draft={singleFileDraft()}
        contexts={[]}
        preview={idlePreview}
        notesContent=""
        jiraKeyDraft=""
        resolvedCwdLabel=""
        projectCwd="/repo"
        duplicateMessage=""
        actionMessage=""
        readOnlyChangelog={false}
        onUpdate={onUpdate}
        onSelectKind={onSelectKind}
        onNotesContentChange={vi.fn()}
        onJiraKeyDraftChange={vi.fn()}
        onPreviewReset={vi.fn()}
        onActionError={onActionError}
      />,
    )
    expect(screen.getByRole('radio', { name: 'tabContexts.kind_singleFile' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.queryByText('tabContexts.importFiles')).toBeNull()
    expect(screen.getByText('src/App.tsx')).toBeTruthy()
  })

  it('teclear el nombre no sale de la vista de un archivo', () => {
    const draft = singleFileDraft()
    const { rerender, onUpdate, onSelectKind, onActionError } = renderEditor({ draft })
    rerender(
      <TabContextsEditor
        draft={{ ...draft, name: 'Renombrado' }}
        contexts={[]}
        preview={idlePreview}
        notesContent=""
        jiraKeyDraft=""
        resolvedCwdLabel=""
        projectCwd="/repo"
        duplicateMessage=""
        actionMessage=""
        readOnlyChangelog={false}
        onUpdate={onUpdate}
        onSelectKind={onSelectKind}
        onNotesContentChange={vi.fn()}
        onJiraKeyDraftChange={vi.fn()}
        onPreviewReset={vi.fn()}
        onActionError={onActionError}
      />,
    )
    expect(screen.getByRole('radio', { name: 'tabContexts.kind_singleFile' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.queryByText('tabContexts.importFiles')).toBeNull()
  })
})
