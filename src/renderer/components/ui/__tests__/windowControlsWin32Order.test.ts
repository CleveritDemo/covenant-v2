/**
 * @vitest-environment jsdom
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const css = readFileSync(join(here, '../WindowControls.css'), 'utf8')

function win32BtnOrder(modifier: 'min' | 'zoom' | 'close'): number | null {
  const re = new RegExp(
    `:root\\[data-platform="win32"\\]\\s*\\.window-controls__btn--${modifier}\\s*\\{[^}]*order:\\s*(-?\\d+)`,
  )
  const match = css.match(re)
  return match ? Number(match[1]) : null
}

function win32RuleBody(selector: string): string | null {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`)
  const match = css.match(re)
  return match ? match[1] : null
}

describe('WindowControls win32 caption order', () => {
  it('en el bloque win32 min/zoom/close tienen order y close es el mayor', () => {
    const min = win32BtnOrder('min')
    const zoom = win32BtnOrder('zoom')
    const close = win32BtnOrder('close')

    expect(min).not.toBeNull()
    expect(zoom).not.toBeNull()
    expect(close).not.toBeNull()
    expect(close!).toBeGreaterThan(min!)
    expect(close!).toBeGreaterThan(zoom!)
  })

  it('en win32 los caption buttons deshabilitados no se pintan', () => {
    const body = win32RuleBody(':root[data-platform="win32"] .window-controls__btn:disabled')
    expect(body).not.toBeNull()
    expect(body).toMatch(/display:\s*none/)
    expect(body).not.toMatch(/opacity/)
  })

  it('en win32 el caption button cabe en una titlebar de 26px', () => {
    const body = win32RuleBody(':root[data-platform="win32"] .window-controls__btn')
    expect(body).not.toBeNull()
    expect(body).toMatch(/height:\s*26px/)
    expect(body).toMatch(/width:\s*36px/)
  })
})
