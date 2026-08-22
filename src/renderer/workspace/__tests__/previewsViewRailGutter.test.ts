import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const css = readFileSync(join(here, '../PreviewsView.css'), 'utf8')

function block(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return css.match(new RegExp(`${escaped}\\s*\\{[^}]+\\}`))?.[0] ?? ''
}

describe('previews view rail gutter', () => {
  it('reserva canalón del riel elevado y usa líneas sutiles al 40%', () => {
    const rootBlock = block('.previews-view')
    expect(rootBlock).toContain('--previews-rail-gutter')

    const bodyBlock = block('.previews-view__body')
    expect(bodyBlock).toContain('grid-template-columns')
    expect(bodyBlock).toContain('var(--previews-rail-gutter)')

    const listBlock = block('.previews-view__list')
    expect(listBlock).toContain('var(--previews-rail-gutter)')
    expect(listBlock).toMatch(/border-right:[^;]*color-mix/)
    expect(listBlock).not.toMatch(/border-right:\s*1px solid var\(--border\)/)

    const barBlock = block('.previews-view__bar')
    expect(barBlock).toMatch(/border-bottom:[^;]*color-mix/)
  })
})
