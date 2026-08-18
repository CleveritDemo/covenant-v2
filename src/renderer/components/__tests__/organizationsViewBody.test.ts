/**
 * @vitest-environment jsdom
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

describe('OrganizationsView body flush', () => {
  it('el cuerpo no lleva canalón ni columna de lectura', () => {
    const css = readFileSync(join(here, '../OrganizationsView.css'), 'utf8')
    const bodyBlock = css.match(/\.organizations-view__body\s*\{[^}]+\}/)?.[0] ?? ''
    const childBlock = css.match(/\.organizations-view__body\s*>\s*\*\s*\{[^}]+\}/)?.[0] ?? ''

    expect(bodyBlock).not.toBe('')
    expect(bodyBlock).not.toMatch(/max-width/)
    expect(bodyBlock).toMatch(/padding:\s*8px\s+0\s+0\s*;/)
    expect(bodyBlock).not.toMatch(/padding-(left|right)\s*:/)

    expect(childBlock).not.toBe('')
    expect(childBlock).not.toMatch(/max-width/)
    expect(childBlock).not.toMatch(/margin:\s*0\s+auto/)
  })
})
