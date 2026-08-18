import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

describe('context preview meta gutter', () => {
  it('la franja de meta sangra con --context-preview-gutter y cada host la declara', () => {
    const previewCss = readFileSync(join(here, '../ContextContentPreviewModal.css'), 'utf8')
    const metaBlock =
      previewCss.match(/\.context-content-preview \.tab-contexts__preview-meta\s*\{[^}]+\}/)?.[0] ?? ''

    expect(metaBlock).toContain('margin-inline')
    expect(metaBlock).toContain('--context-preview-gutter')

    const assignCss = readFileSync(join(here, '../PlaneContextAssignModal.css'), 'utf8')
    const paneCss = readFileSync(join(here, '../../agent/AgentPane.css'), 'utf8')

    expect(assignCss).toContain('--context-preview-gutter')
    expect(paneCss).toContain('--context-preview-gutter')
  })
})
