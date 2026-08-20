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

describe('OrganizationsView chrome', () => {
  const viewCss = readFileSync(join(here, '../OrganizationsView.css'), 'utf8')
  const modalCss = readFileSync(join(here, '../OrganizationsModal.css'), 'utf8')

  it('la barra y la miga alinean el ritmo de 40px con el head de columna', () => {
    const root = block(viewCss, '.organizations-view')
    const bar = block(viewCss, '.organizations-view__bar')
    const crumbs = block(viewCss, '.organizations-view__crumbs')
    const crumb = block(viewCss, '.organizations-view__crumb')
    const current = block(viewCss, '.organizations-view__crumb--current')
    const sep = block(viewCss, '.organizations-view__crumb-sep')
    const actions = block(viewCss, '.organizations-view__bar-actions')

    expect(root).toMatch(/grid-template-rows:\s*40px\s+minmax\(0,\s*1fr\)/)
    expect(bar).toMatch(/justify-content:\s*space-between/)
    expect(bar).toMatch(/padding:\s*7px\s+14px\s+0\s+14px/)
    expect(crumbs).toMatch(/display:\s*inline-flex/)
    expect(crumbs).toMatch(/height:\s*var\(--plane-top-bar-height,\s*26px\)/)
    expect(crumb).toMatch(/font-size:\s*12\.5px/)
    expect(crumb).toMatch(/font-weight:\s*560/)
    expect(current).toMatch(/font-weight:\s*620/)
    expect(sep).toMatch(/opacity:\s*0\.55/)
    expect(actions).toMatch(/flex:\s*0\s+0\s+auto/)
    expect(viewCss).not.toMatch(/\.organizations-view__title\s*\{/)
    expect(root).toMatch(/top:\s*var\(--titlebar-height\)/)
    expect(root).not.toMatch(/inset:\s*0/)
  })

  it('el selector de cuenta vive en el pie del rail, no en la barra', () => {
    const foot = block(modalCss, '.orgs-col__foot')
    const row = block(modalCss, '.orgs-account-row')
    const footAccount = block(modalCss, '.orgs-col__foot-account')

    expect(foot).toMatch(/flex-direction:\s*column/)
    expect(foot).toMatch(/align-items:\s*stretch/)
    expect(row).toMatch(/display:\s*inline-flex/)
    expect(footAccount).not.toBe('')
    expect(modalCss).not.toMatch(/\.orgs-col__label--strong\s*\{/)
  })

  it('no tapa el titlebar: sin inset de semáforos ni app-region propia', () => {
    expect(viewCss).not.toMatch(
      /:root\[data-platform="darwin"\]\s+\.organizations-view__bar/,
    )
    expect(viewCss).not.toMatch(
      /:root\[data-platform="win32"\]\s+\.organizations-view__bar/,
    )
    expect(viewCss).not.toMatch(/-webkit-app-region/)
  })

  it('pinta su propio separador superior porque tapa el TabBar', () => {
    const root = block(viewCss, '.organizations-view')
    expect(root).toMatch(/border-top:\s*1px solid color-mix\(in srgb, var\(--border\) 16%, transparent\)/)
  })
})
