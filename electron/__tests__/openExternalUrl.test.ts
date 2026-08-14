import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  shell: { openExternal: vi.fn() },
}))

import { shell } from 'electron'
import { openExternalHttpUrl } from '../openExternalUrl'

const openExternal = vi.mocked(shell.openExternal)

beforeEach(() => {
  openExternal.mockReset()
  openExternal.mockResolvedValue(undefined)
})

describe('openExternalHttpUrl', () => {
  it('https llama openExternal una vez con la URL trimeada', async () => {
    const result = await openExternalHttpUrl('  https://example.com/path  ')
    expect(result).toEqual({ ok: true })
    expect(openExternal).toHaveBeenCalledOnce()
    expect(openExternal).toHaveBeenCalledWith('https://example.com/path')
  })

  it('http llama openExternal', async () => {
    const result = await openExternalHttpUrl('http://example.com')
    expect(result).toEqual({ ok: true })
    expect(openExternal).toHaveBeenCalledOnce()
    expect(openExternal).toHaveBeenCalledWith('http://example.com')
  })

  it('javascript: no llama openExternal', async () => {
    const result = await openExternalHttpUrl('javascript:alert(1)')
    expect(result).toEqual({ ok: false, error: 'Solo se permiten http(s)' })
    expect(openExternal).not.toHaveBeenCalled()
  })

  it('file: no llama openExternal', async () => {
    const result = await openExternalHttpUrl('file:///etc/passwd')
    expect(result).toEqual({ ok: false, error: 'Solo se permiten http(s)' })
    expect(openExternal).not.toHaveBeenCalled()
  })

  it('string vacío devuelve URL vacía', async () => {
    const result = await openExternalHttpUrl('')
    expect(result).toEqual({ ok: false, error: 'URL vacía' })
    expect(openExternal).not.toHaveBeenCalled()
  })

  it('si openExternal rechaza, devuelve el message', async () => {
    openExternal.mockRejectedValue(new Error('blocked by OS'))
    const result = await openExternalHttpUrl('https://example.com')
    expect(result).toEqual({ ok: false, error: 'blocked by OS' })
  })
})
