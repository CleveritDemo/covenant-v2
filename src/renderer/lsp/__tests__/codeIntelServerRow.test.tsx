/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { LspInstalledServer, LspRuntimeMissing } from '@shared/lspTypes'
import { CodeIntelServerRow } from '../CodeIntelServerRow'

vi.mock('@i18n/useT', () => ({
  useT: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${Object.values(params).join(',')}` : key,
  }),
}))

afterEach(cleanup)

const jdtls: LspInstalledServer = {
  language: 'java',
  name: 'jdtls',
  version: '1.40',
  sizeBytes: 0,
  installed: false,
}

const runtimeMissing: LspRuntimeMissing = {
  name: 'Java',
  min: '21',
  found: '17.0.18',
  suggestion: null,
}

describe('CodeIntelServerRow', () => {
  it('sin runtime: Instalar dispara onInstall', () => {
    const onInstall = vi.fn()
    render(
      <CodeIntelServerRow
        server={jdtls}
        runtimeMissing={null}
        busy={false}
        disabled={false}
        percent={null}
        error={null}
        onInstall={onInstall}
        onDelete={() => {}}
        onRecheck={() => {}}
      />,
    )
    fireEvent.click(screen.getByText('lsp.settings.install'))
    expect(onInstall).toHaveBeenCalledTimes(1)
  })

  it('con runtime faltante: Recheck, hint visible, no Instalar', () => {
    const onRecheck = vi.fn()
    const onInstall = vi.fn()
    render(
      <CodeIntelServerRow
        server={jdtls}
        runtimeMissing={runtimeMissing}
        busy={false}
        disabled={false}
        percent={null}
        error={null}
        onInstall={onInstall}
        onDelete={() => {}}
        onRecheck={onRecheck}
      />,
    )
    expect(screen.queryByText('lsp.settings.install')).toBeNull()
    expect(screen.getByText('lsp.runtime.tooOld:Java,21,17.0.18')).toBeTruthy()
    fireEvent.click(screen.getByText('lsp.recheck'))
    expect(onRecheck).toHaveBeenCalledTimes(1)
    expect(onInstall).not.toHaveBeenCalled()
  })

  it('muestra el error de instalación en el campo', () => {
    render(
      <CodeIntelServerRow
        server={jdtls}
        runtimeMissing={null}
        busy={false}
        disabled={false}
        percent={null}
        error="runtime java not found or too old (need >= 21, found 17.0.18)"
        onInstall={() => {}}
        onDelete={() => {}}
        onRecheck={() => {}}
      />,
    )
    expect(screen.getByRole('alert').textContent).toBe(
      'runtime java not found or too old (need >= 21, found 17.0.18)',
    )
  })

  it('busy con percent usa installingPercent y deshabilita', () => {
    render(
      <CodeIntelServerRow
        server={jdtls}
        runtimeMissing={null}
        busy
        disabled={false}
        percent={40}
        error={null}
        onInstall={() => {}}
        onDelete={() => {}}
        onRecheck={() => {}}
      />,
    )
    const btn = screen.getByText('lsp.installingPercent:40')
    expect(btn).toHaveProperty('disabled', true)
  })
})
