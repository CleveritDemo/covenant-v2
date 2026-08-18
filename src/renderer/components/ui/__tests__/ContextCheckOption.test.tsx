/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ContextCheckOption } from '../ContextCheckOption'

afterEach(cleanup)

const namedUsers = (names: readonly string[], withColor: boolean) =>
  names.map((name, i) => ({
    id: `u-${i}`,
    monogram: name.slice(0, 2).toUpperCase(),
    name,
    ...(withColor ? { color: '#6b8afd' } : {}),
  }))

const fiveNames = ['Alice', 'Bruno', 'Carla', 'Diego', 'Elena'] as const
const fiveLabel = fiveNames.join(', ')

describe('ContextCheckOption usedBy stack', () => {
  it('con 5 caras pinta 3 y +2; el aria-label nombra a los cinco', () => {
    const { container } = render(
      <ContextCheckOption
        name="Notes"
        checked={false}
        onChange={vi.fn()}
        usedBy={namedUsers(fiveNames, true)}
        usedByLabel={fiveLabel}
      />,
    )

    expect(container.querySelectorAll('.context-check-option__face')).toHaveLength(3)
    expect(container.querySelectorAll('.agent-face')).toHaveLength(3)
    expect(screen.getByText('+2')).toBeTruthy()
    expect(screen.getByLabelText(fiveLabel)).toBeTruthy()
  })

  it('con 3 caras no pinta +N', () => {
    const three = fiveNames.slice(0, 3)
    const { container } = render(
      <ContextCheckOption
        name="Notes"
        checked={false}
        onChange={vi.fn()}
        usedBy={namedUsers(three, true)}
        usedByLabel={three.join(', ')}
      />,
    )

    expect(container.querySelectorAll('.context-check-option__face')).toHaveLength(3)
    expect(container.querySelector('.context-check-option__stack-more')).toBeNull()
    expect(screen.queryByText('+0')).toBeNull()
  })

  it('el corte también aplica al fallback de monograma', () => {
    const { container } = render(
      <ContextCheckOption
        name="Notes"
        checked={false}
        onChange={vi.fn()}
        usedBy={namedUsers(fiveNames, false)}
        usedByLabel={fiveLabel}
      />,
    )

    expect(container.querySelectorAll('.context-check-option__monogram')).toHaveLength(3)
    expect(container.querySelectorAll('.context-check-option__face')).toHaveLength(0)
    expect(screen.getByText('+2')).toBeTruthy()
    expect(screen.getByLabelText(fiveLabel)).toBeTruthy()
  })

  it('con 5 usedBy con color las 3 caras van stacked y muestran +2', () => {
    const { container } = render(
      <ContextCheckOption
        name="Notes"
        checked={false}
        onChange={vi.fn()}
        usedBy={namedUsers(fiveNames, true)}
        usedByLabel={fiveLabel}
      />,
    )

    const faces = container.querySelectorAll('.agent-face')
    expect(faces).toHaveLength(3)
    for (const face of faces) {
      expect(face.classList.contains('agent-face--stacked')).toBe(true)
    }
    expect(screen.getByText('+2')).toBeTruthy()
  })
})

describe('ContextCheckOption stacked face ring', () => {
  it('la cara apilada declara el anillo de --bg-secondary', () => {
    const css = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '../AgentFace.css'),
      'utf8',
    )
    const stackedBlock = css.match(/\.agent-face--stacked\s*\{[^}]+\}/)?.[0] ?? ''

    expect(stackedBlock).toContain('0 0 0 1.5px var(--bg-secondary)')
  })
})

describe('AgentFace stacked brand hidden', () => {
  it('el modificador stacked apaga el badge del CLI', () => {
    const agentFaceCss = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '../AgentFace.css'),
      'utf8',
    )
    const brandBlock =
      agentFaceCss.match(/\.agent-face--stacked \.agent-face__brand\s*\{[^}]+\}/)?.[0] ?? ''

    expect(brandBlock).toMatch(/display:\s*none/)
  })
})
