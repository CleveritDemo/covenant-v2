/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { TabContextFilePicker } from '../TabContextFilePicker'

vi.mock('@i18n/useT', () => ({
  useT: () => ({ t: (key: string) => key }),
}))

const searchProjectFiles = vi.fn()
const selectProjectFiles = vi.fn()
const onAdd = vi.fn()

beforeEach(() => {
  searchProjectFiles.mockReset()
  selectProjectFiles.mockReset()
  onAdd.mockReset()
  ;(window as unknown as { api: Record<string, unknown> }).api = {
    searchProjectFiles,
    selectProjectFiles,
  }
})

afterEach(cleanup)

describe('TabContextFilePicker', () => {
  it('al escribir 3 letras lista solo archivos nuevos y Enter agrega la ruta relativa', async () => {
    searchProjectFiles.mockResolvedValue({
      ok: true,
      paths: [],
      hits: [
        { relPath: 'src/App.tsx', isDirectory: false },
        { relPath: 'src/components', isDirectory: true },
        { relPath: 'src/already.ts', isDirectory: false },
      ],
    })

    render(
      <TabContextFilePicker
        cwd="/repo"
        paths={['src/already.ts']}
        onAdd={onAdd}
      />,
    )

    fireEvent.change(screen.getByPlaceholderText('tabContexts.addFileSearch'), {
      target: { value: 'src' },
    })

    expect(await screen.findByRole('option', { name: 'src/App.tsx' })).toBeTruthy()
    expect(screen.queryByRole('option', { name: 'src/components' })).toBeNull()
    expect(screen.queryByRole('option', { name: 'src/already.ts' })).toBeNull()
    await waitFor(() => {
      expect(searchProjectFiles).toHaveBeenCalledWith('/repo', 'src')
    })

    fireEvent.keyDown(screen.getByPlaceholderText('tabContexts.addFileSearch'), { key: 'Enter' })
    expect(onAdd).toHaveBeenCalledWith(['src/App.tsx'])
  })
})
