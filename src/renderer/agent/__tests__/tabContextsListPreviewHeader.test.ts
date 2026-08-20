/**
 * @vitest-environment jsdom
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

function block(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return css.match(new RegExp(`${escaped}\\s*\\{[^}]+\\}`))?.[0] ?? ''
}

describe('TabContextsListPreview header chrome', () => {
  const paneCss = readFileSync(join(here, '../AgentPane.css'), 'utf8')

  it('el título y el canalón del panel derecho tienen jerarquía de entidad', () => {
    const title = block(paneCss, '.tab-contexts__preview-header strong')
    const pane = block(paneCss, '.tab-contexts__preview-pane')

    expect(title).toMatch(/font-size:\s*15px/)
    expect(pane).toMatch(/--context-preview-gutter:\s*20px/)
  })
})
