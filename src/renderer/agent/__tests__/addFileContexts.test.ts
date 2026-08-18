/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TabContext } from '@shared/tabContext'
import { addFileContextsFromPicker } from '../addFileContexts'

const selectProjectFiles = vi.fn()
const materializeTabContext = vi.fn()

beforeEach(() => {
  selectProjectFiles.mockReset()
  materializeTabContext.mockReset()
  ;(window as unknown as { api: Record<string, unknown> }).api = {
    selectProjectFiles,
    materializeTabContext,
  }
})

const existingFile: TabContext = {
  id: 'iaterminal:files:App-tsx',
  name: 'App.tsx',
  fileName: 'context/App.tsx.md',
  kind: 'files',
  paths: ['src/App.tsx'],
  referenceOnly: true,
}

describe('addFileContextsFromPicker', () => {
  it('sin cwd no abre el picker', async () => {
    const result = await addFileContextsFromPicker({
      cwd: '   ',
      contexts: [],
      pickTitle: 'Elegí archivos',
    })
    expect(result).toEqual({ ok: false, error: 'no-cwd' })
    expect(selectProjectFiles).not.toHaveBeenCalled()
  })

  it('cancelar el diálogo no materializa', async () => {
    selectProjectFiles.mockResolvedValue({ ok: false, cancelled: true })
    const result = await addFileContextsFromPicker({
      cwd: '/repo',
      contexts: [],
      pickTitle: 'Elegí archivos',
    })
    expect(result).toEqual({ ok: false, cancelled: true })
    expect(materializeTabContext).not.toHaveBeenCalled()
  })

  it('archivo demasiado grande llega como too-large', async () => {
    selectProjectFiles.mockResolvedValue({
      ok: false,
      error: 'file too large',
    })
    const result = await addFileContextsFromPicker({
      cwd: '/repo',
      contexts: [],
      pickTitle: 'Elegí archivos',
    })
    expect(result).toEqual({ ok: false, error: 'too-large' })
    expect(materializeTabContext).not.toHaveBeenCalled()
  })

  it('otro error del picker llega como failed con el mensaje', async () => {
    selectProjectFiles.mockResolvedValue({ ok: false, error: 'nothing picked' })
    const result = await addFileContextsFromPicker({
      cwd: '/repo',
      contexts: [],
      pickTitle: 'Elegí archivos',
    })
    expect(result).toEqual({ ok: false, error: 'failed', message: 'nothing picked' })
  })

  it('materializa cada archivo creado en orden y omite duplicados', async () => {
    selectProjectFiles.mockResolvedValue({
      ok: true,
      paths: ['src/App.tsx', 'src/main.ts'],
    })
    materializeTabContext.mockResolvedValue({ ok: true })

    const result = await addFileContextsFromPicker({
      cwd: '/repo',
      contexts: [existingFile],
      pickTitle: 'Elegí archivos',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.skipped).toEqual([{ path: 'src/App.tsx', contextId: existingFile.id }])
    expect(result.created).toHaveLength(1)
    expect(result.created[0]).toMatchObject({
      kind: 'files',
      name: 'main.ts',
      paths: ['src/main.ts'],
      referenceOnly: true,
    })
    expect(materializeTabContext).toHaveBeenCalledTimes(1)
    expect(materializeTabContext).toHaveBeenCalledWith({
      context: result.created[0],
      cwd: '/repo',
    })
    expect(selectProjectFiles).toHaveBeenCalledWith({
      cwd: '/repo',
      title: 'Elegí archivos',
      importOutside: true,
    })
  })

  it('al primer materialize fallido corta y expone el error', async () => {
    selectProjectFiles.mockResolvedValue({
      ok: true,
      paths: ['a.ts', 'b.ts'],
    })
    materializeTabContext
      .mockResolvedValueOnce({ ok: false, error: 'disk full' })
      .mockResolvedValueOnce({ ok: true })

    const result = await addFileContextsFromPicker({
      cwd: '/repo',
      contexts: [],
      pickTitle: 'Elegí archivos',
    })
    expect(result).toEqual({ ok: false, error: 'failed', message: 'disk full' })
    expect(materializeTabContext).toHaveBeenCalledTimes(1)
  })

  it('una excepción del picker llega como failed', async () => {
    selectProjectFiles.mockRejectedValue(new Error('boom'))
    const result = await addFileContextsFromPicker({
      cwd: '/repo',
      contexts: [],
      pickTitle: 'Elegí archivos',
    })
    expect(result).toEqual({ ok: false, error: 'failed', message: 'boom' })
  })
})
