/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { TabContext } from '@shared/tabContext'

vi.mock('@i18n/useT', () => ({
  useT: () => ({ t: (key: string) => key }),
}))

import { ContextReport } from '../ContextReport'

const filesContext: TabContext = {
  id: 'iaterminal:files:src',
  name: 'src',
  fileName: 'src.md',
  kind: 'files',
}

function filesDoc(auto: string): string {
  return [
    '# src',
    '<!-- iaterminal:auto -->',
    auto,
    '<!-- /iaterminal:auto -->',
  ].join('\n')
}

afterEach(cleanup)

const reportCss = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../ContextReport.css'),
  'utf8',
)

describe('ContextReport files/spreadsheet/symbols por pestañas', () => {
  it('con dos o más secciones monta tablist y el cuerpo de la activa', () => {
    render(
      <ContextReport
        context={filesContext}
        content={filesDoc('### src/a.ts\nhola a\n### lib/a.ts\nhola b')}
      />,
    )
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(2)
    expect(tabs[0].textContent).toBe('src/a.ts')
    expect(tabs[1].textContent).toBe('lib/a.ts')
    expect(screen.getByText('hola a')).toBeTruthy()
    expect(screen.queryByText('hola b')).toBeNull()
    fireEvent.click(tabs[1])
    expect(screen.getByText('hola b')).toBeTruthy()
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowLeft' })
    expect(screen.getByText('hola a')).toBeTruthy()
  })

  it('con una sección no monta el tablist', () => {
    render(
      <ContextReport
        context={filesContext}
        content={filesDoc('### README.md\nsolo uno')}
      />,
    )
    expect(screen.queryByRole('tablist')).toBeNull()
    expect(screen.getByText('solo uno')).toBeTruthy()
  })

  it('declara flex:none en el bloque de código para que no lo encoga el reporte', () => {
    expect(reportCss).toMatch(/\.context-report__code\s*\{[^}]*flex:\s*none;/)
  })
})
