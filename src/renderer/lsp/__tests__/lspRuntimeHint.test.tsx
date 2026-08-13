/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { LspRuntimeHint } from '../LspRuntimeHint'

vi.mock('@i18n/useT', () => ({
  useT: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${Object.values(params).join(',')}` : key,
  }),
}))

afterEach(cleanup)

describe('LspRuntimeHint', () => {
  it('muestra tooOld cuando hay found y el comando PATH si está en disco', () => {
    render(
      <LspRuntimeHint
        name="Java"
        min="21"
        found="17.0.18"
        suggestion={{ kind: 'onDiskNotOnPath', version: '26', dir: '/opt/homebrew/opt/openjdk/bin' }}
      />,
    )
    expect(screen.getByText('lsp.runtime.tooOld:Java,21,17.0.18')).toBeTruthy()
    expect(screen.getByText(
      'lsp.runtime.onDiskNotOnPath:26,/opt/homebrew/opt/openjdk/bin',
    )).toBeTruthy()
    expect(screen.getByText('export PATH="/opt/homebrew/opt/openjdk/bin:$PATH"')).toBeTruthy()
  })

  it('muestra missing sin found y el hint de install', () => {
    render(
      <LspRuntimeHint
        name="Java"
        min="21"
        found={null}
        suggestion={{ kind: 'install', hint: 'brew install openjdk' }}
      />,
    )
    expect(screen.getByText('lsp.runtime.missing:Java,21')).toBeTruthy()
    expect(screen.getByText('lsp.runtime.install')).toBeTruthy()
    expect(screen.getByText('brew install openjdk')).toBeTruthy()
  })
})
