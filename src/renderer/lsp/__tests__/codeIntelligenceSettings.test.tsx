/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { CodeIntelligenceSettings } from '../CodeIntelligenceSettings'

const download = vi.fn()
const grantConsentFor = vi.fn()

vi.mock('@i18n/useT', () => ({
  useT: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${Object.values(params).join(',')}` : key,
  }),
}))

vi.mock('../manager', () => ({
  codeIntelEnabled: () => true,
  setCodeIntelEnabled: vi.fn(),
  grantConsentFor: (...args: unknown[]) => grantConsentFor(...args),
  lspManager: { download: (...args: unknown[]) => download(...args) },
}))

const jdtls = {
  language: 'java',
  name: 'jdtls',
  version: '1.40',
  sizeBytes: 0,
  installed: false,
}

const lspListInstalled = vi.fn()
const lspServerStatus = vi.fn()
const lspDeleteServer = vi.fn()
const lspRecheckRuntimes = vi.fn()

beforeEach(() => {
  download.mockReset()
  grantConsentFor.mockReset()
  lspListInstalled.mockReset()
  lspServerStatus.mockReset()
  lspDeleteServer.mockReset()
  lspRecheckRuntimes.mockReset()
  lspListInstalled.mockResolvedValue([jdtls])
  lspServerStatus.mockResolvedValue({
    language: 'java',
    name: 'jdtls',
    version: '1.40',
    installed: false,
    approxSizeMb: 80,
    runtimeMissing: {
      name: 'Java',
      min: '21',
      found: '17.0.18',
      suggestion: null,
    },
  })
  lspRecheckRuntimes.mockResolvedValue(undefined)
  vi.stubGlobal('window', Object.assign(window, {
    api: {
      lspListInstalled,
      lspServerStatus,
      lspDeleteServer,
      lspRecheckRuntimes,
    },
  }))
})

afterEach(cleanup)

describe('CodeIntelligenceSettings', () => {
  it('al fallar la descarga muestra el error y no lo traga', async () => {
    lspServerStatus.mockResolvedValue({
      language: 'java',
      name: 'jdtls',
      version: '1.40',
      installed: false,
      approxSizeMb: 80,
      runtimeMissing: null,
    })
    download.mockRejectedValue(new Error(
      'runtime java not found or too old (need >= 21, found 17.0.18)',
    ))
    render(<CodeIntelligenceSettings />)
    fireEvent.click(await screen.findByText('lsp.settings.install'))
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe(
        'lsp.settings.installError:runtime java not found or too old (need >= 21, found 17.0.18)',
      )
    })
  })

  it('con runtime faltante muestra el aviso y Recheck llama lspRecheckRuntimes', async () => {
    render(<CodeIntelligenceSettings />)
    fireEvent.click(await screen.findByText('lsp.recheck'))
    expect(screen.getByText('lsp.runtime.tooOld:Java,21,17.0.18')).toBeTruthy()
    await waitFor(() => expect(lspRecheckRuntimes).toHaveBeenCalledTimes(1))
    expect(download).not.toHaveBeenCalled()
  })

  it('si borrar falla guarda deleteError', async () => {
    lspListInstalled.mockResolvedValue([{ ...jdtls, installed: true, sizeBytes: 2048 }])
    lspServerStatus.mockResolvedValue({
      language: 'java',
      name: 'jdtls',
      version: '1.40',
      installed: true,
      approxSizeMb: 80,
      runtimeMissing: null,
    })
    lspDeleteServer.mockResolvedValue({ ok: false, error: 'busy' })
    render(<CodeIntelligenceSettings />)
    fireEvent.click(await screen.findByText('lsp.settings.delete'))
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe(
        'lsp.settings.deleteError:busy',
      )
    })
  })
})
