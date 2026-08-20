/**
 * @vitest-environment jsdom
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { Skeleton } from '../Skeleton'

afterEach(cleanup)

const here = dirname(fileURLToPath(import.meta.url))

function block(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return css.match(new RegExp(`${escaped}\\s*\\{[^}]+\\}`))?.[0] ?? ''
}

describe('Skeleton', () => {
  it('renderiza por defecto con sm, width 100% y height 12', () => {
    const { container } = render(<Skeleton />)
    const node = container.querySelector('.skeleton')
    expect(node).toBeTruthy()
    expect(node?.className).toBe('skeleton skeleton--sm')
    expect((node as HTMLElement).style.width).toBe('100%')
    expect((node as HTMLElement).style.height).toBe('12px')
    expect(node?.getAttribute('aria-hidden')).toBe('true')
  })

  it.each(['sm', 'md', 'pill', 'circle'] as const)(
    'aplica la clase skeleton--%s',
    (radius) => {
      const { container } = render(<Skeleton radius={radius} width={80} height={16} />)
      const node = container.querySelector('.skeleton')
      expect(node?.className).toBe(`skeleton skeleton--${radius}`)
      expect((node as HTMLElement).style.width).toBe('80px')
      expect((node as HTMLElement).style.height).toBe('16px')
    },
  )

  it('acepta width numérico y width en string', () => {
    const { container: numeric } = render(<Skeleton width={120} height={14} />)
    const numericNode = numeric.querySelector('.skeleton') as HTMLElement
    expect(numericNode.style.width).toBe('120px')

    const { container: percent } = render(<Skeleton width="62%" height={10} />)
    const percentNode = percent.querySelector('.skeleton') as HTMLElement
    expect(percentNode.style.width).toBe('62%')
    expect(percentNode.style.height).toBe('10px')
  })

  it('respeta reduce-motion en CSS: apaga el barrido', () => {
    const css = readFileSync(join(here, '../Skeleton.css'), 'utf8')
    const reduceMotion = block(css, 'html[data-reduce-motion="true"]')
    expect(reduceMotion).not.toBe('')
    expect(css).toMatch(/html\[data-reduce-motion="true"\][\s\S]*\.skeleton::after[\s\S]*animation:\s*none/)
  })
})
