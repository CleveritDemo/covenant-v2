/**
 * @vitest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PreviewEntry } from '@shared/previews'
import { usePreviews } from '../usePreviews'

const sampleEntries: PreviewEntry[] = [
  {
    fileName: 'newer.html',
    stem: 'newer',
    title: 'Newer preview',
    mtimeMs: Date.now() - 60_000,
    sizeBytes: 100,
    filePath: '/proj/.gravity/previews/newer.html',
  },
  {
    fileName: 'older.html',
    stem: 'older',
    title: 'Older preview',
    mtimeMs: Date.now() - 3_600_000,
    sizeBytes: 200,
    filePath: '/proj/.gravity/previews/older.html',
  },
]

describe('usePreviews', () => {
  beforeEach(() => {
    Object.assign(window, {
      api: {
        previewsList: vi.fn().mockResolvedValue({
          ok: true,
          previews: sampleEntries,
        }),
        previewsRead: vi.fn().mockResolvedValue({
          ok: true,
          fileName: 'newer.html',
          html: '<html><body>newer</body></html>',
          filePath: '/proj/.gravity/previews/newer.html',
        }),
        previewsDelete: vi.fn().mockResolvedValue({ ok: true }),
      },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('no llama al IPC cuando open es false', () => {
    renderHook(() => usePreviews('/proj', false))
    expect(window.api.previewsList).not.toHaveBeenCalled()
    expect(window.api.previewsRead).not.toHaveBeenCalled()
  })

  it('auto-selecciona la primera entrada al abrir', async () => {
    const { result } = renderHook(() => usePreviews('/proj', true))

    await waitFor(() => {
      expect(result.current.entries).toHaveLength(2)
      expect(result.current.selectedFileName).toBe('newer.html')
      expect(result.current.html).toBe('<html><body>newer</body></html>')
    })

    expect(window.api.previewsList).toHaveBeenCalledWith('/proj')
    expect(window.api.previewsRead).toHaveBeenCalledWith('/proj', 'newer.html')
  })

  it('remove borra, refresca la lista y limpia la selección borrada', async () => {
    const { result } = renderHook(() => usePreviews('/proj', true))

    await waitFor(() => {
      expect(result.current.selectedFileName).toBe('newer.html')
    })

    vi.mocked(window.api.previewsList).mockResolvedValueOnce({
      ok: true,
      previews: [sampleEntries[1]],
    })

    await act(async () => {
      result.current.remove('newer.html')
    })

    await waitFor(() => {
      expect(window.api.previewsDelete).toHaveBeenCalledWith('/proj', 'newer.html')
      expect(result.current.entries).toHaveLength(1)
      expect(result.current.selectedFileName).toBeNull()
      expect(result.current.html).toBeNull()
    })
  })

  it('errores del IPC llegan a error sin lanzar', async () => {
    vi.mocked(window.api.previewsList).mockResolvedValueOnce({
      ok: false,
      error: 'read failed',
    })

    const { result } = renderHook(() => usePreviews('/proj', true))

    await waitFor(() => {
      expect(result.current.error).toBe('read failed')
      expect(result.current.entries).toEqual([])
    })
  })
})
