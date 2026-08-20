/** @vitest-environment jsdom */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { TabContext } from '@shared/tabContext'
import { TabContextFormModal } from '../TabContextFormModal'

vi.mock('@i18n/useT', () => ({
  useT: () => ({ t: (key: string) => key }),
}))

vi.mock('../../components/TerminalModal', () => ({
  TerminalModal: ({
    open,
    children,
    footer,
  }: {
    open: boolean
    children: React.ReactNode
    footer?: React.ReactNode
  }) => (open ? <div>{children}<div>{footer}</div></div> : null),
}))

// El cuerpo de skill aún no monta textarea en TabContextsEditor (otra lane).
// Capturamos onNotesContentChange para simular lo tecleado sin duplicar UI.
let mockOnNotesContentChange: ((value: string) => void) | null = null
vi.mock('../TabContextsEditor', () => ({
  TabContextsEditor: ({
    onNotesContentChange,
  }: {
    onNotesContentChange: (value: string) => void
  }) => {
    mockOnNotesContentChange = onNotesContentChange
    return <div data-testid="tab-contexts-editor" />
  },
}))

const previewTabContext = vi.fn()
const materializeTabContext = vi.fn()

beforeEach(() => {
  mockOnNotesContentChange = null
  previewTabContext.mockReset().mockResolvedValue({ ok: true, content: '' })
  materializeTabContext.mockReset().mockResolvedValue({ ok: true, content: '' })
  ;(window as unknown as { api: Record<string, unknown> }).api = {
    previewTabContext,
    materializeTabContext,
  }
})

afterEach(cleanup)

describe('TabContextFormModal — skill body via notesContent', () => {
  const skillContext: TabContext = {
    id: 'iaterminal:skill:deploy',
    name: 'deploy',
    fileName: 'context/deploy.md',
    kind: 'skill',
  }

  it('al editar skill: previewTabContext siembra el cuerpo en notesContent', async () => {
    previewTabContext.mockResolvedValue({
      ok: true,
      content: '# Deploy skill\nPaso 1',
      notesContent: '# Deploy skill\nPaso 1',
    })

    render(
      <TabContextFormModal
        open
        mode="edit"
        context={skillContext}
        contexts={[skillContext]}
        cwd="/repo"
        onRefresh={() => {}}
        onClose={() => {}}
      />,
    )

    await waitFor(() => expect(previewTabContext).toHaveBeenCalled())
    const [{ context, cwd }] = previewTabContext.mock.calls[0] as [{ context: TabContext; cwd: string }]
    expect(context.kind).toBe('skill')
    expect(cwd).toBe('/repo')

    fireEvent.click(screen.getByRole('button', { name: 'tabContexts.saveContext' }))

    await waitFor(() => expect(materializeTabContext).toHaveBeenCalledTimes(1))
    expect(materializeTabContext.mock.calls[0][0].content).toBe('# Deploy skill\nPaso 1')
  })

  it('al editar skill: teclear en el cuerpo y guardar pasa content a materializeTabContext', async () => {
    previewTabContext.mockResolvedValue({ ok: true, content: '', notesContent: '' })

    render(
      <TabContextFormModal
        open
        mode="edit"
        context={skillContext}
        contexts={[skillContext]}
        cwd="/repo"
        onRefresh={() => {}}
        onClose={() => {}}
      />,
    )

    await waitFor(() => expect(mockOnNotesContentChange).not.toBeNull())
    mockOnNotesContentChange!('Cuerpo de skill editado')

    fireEvent.click(screen.getByRole('button', { name: 'tabContexts.saveContext' }))

    await waitFor(() => expect(materializeTabContext).toHaveBeenCalledTimes(1))
    expect(materializeTabContext.mock.calls[0][0].content).toBe('Cuerpo de skill editado')
  })

  it('un kind sin cuerpo (folderTree) no pasa content al materializar', async () => {
    const folderContext: TabContext = {
      id: 'iaterminal:folderTree',
      name: 'folders',
      fileName: 'folders.md',
      kind: 'folderTree',
    }

    render(
      <TabContextFormModal
        open
        mode="edit"
        context={folderContext}
        contexts={[folderContext]}
        cwd="/repo"
        onRefresh={() => {}}
        onClose={() => {}}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'tabContexts.saveContext' }))

    await waitFor(() => expect(materializeTabContext).toHaveBeenCalledTimes(1))
    expect(materializeTabContext.mock.calls[0][0].content).toBeUndefined()
  })
})
