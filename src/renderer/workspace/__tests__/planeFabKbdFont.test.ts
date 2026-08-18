import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

describe('plane FAB kbd font', () => {
  it('usa --font-ui, no la mono del usuario', () => {
    const css = readFileSync(join(here, '../TabAgenticPlane.css'), 'utf8')
    const kbdBlock = css.match(/\.plane-fab__kbd\s*\{[^}]+\}/)?.[0] ?? ''

    expect(kbdBlock).toContain('var(--font-ui)')
    expect(kbdBlock).not.toContain('var(--font-mono)')
  })
})
