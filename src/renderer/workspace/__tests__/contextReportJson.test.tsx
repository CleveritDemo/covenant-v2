/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { TabContext } from '@shared/tabContext'

vi.mock('@i18n/useT', () => ({
  useT: () => ({ t: (key: string) => key }),
}))

import { ContextReport } from '../ContextReport'

const MANIFEST = JSON.stringify({ name: 'covenant', scripts: { dev: 'vite' } }, null, 2)

function doc(auto: string): string {
  return `# MCP\n\n<!-- iaterminal:auto -->\n${auto}\n<!-- /iaterminal:auto -->\n`
}

const context: TabContext = { id: 'mcp', name: 'MCP', fileName: 'MCP.md', kind: 'mcp' }

afterEach(cleanup)

describe('ContextReport con cuerpo JSON', () => {
  it('lo pinta como árbol plegable, no como párrafos', () => {
    const { container } = render(<ContextReport context={context} content={doc(MANIFEST)} />)

    // Hoja de primer nivel: clave y valor en la misma fila.
    expect(screen.getByText('name')).toBeTruthy()
    expect(screen.getByText('"covenant"')).toBeTruthy()
    // El objeto anidado es un <details> cerrado hasta que se pincha.
    const details = container.querySelectorAll('details')
    expect(details.length).toBe(1)
    expect(details[0].open).toBe(false)
    expect(screen.getByText('scripts')).toBeTruthy()
  })

  it('también pinta el árbol para deps (package.json)', () => {
    const deps: TabContext = { id: 'deps', name: 'Deps', fileName: 'Deps.md', kind: 'deps' }
    const { container } = render(<ContextReport context={deps} content={doc(MANIFEST)} />)

    expect(container.querySelector('.json-tree')).toBeTruthy()
    expect(screen.getByText('scripts')).toBeTruthy()
  })

  it('deja el texto que no es JSON en el render markdown', () => {
    render(<ContextReport context={context} content={doc('No MCP servers configured.')} />)
    expect(screen.getByText('No MCP servers configured.')).toBeTruthy()
  })
})
