/**
 * @vitest-environment jsdom
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../AgentProviderCard.css'),
  'utf8',
)

describe('AgentProviderCard.css', () => {
  it('pinta primario y respaldo con tokens --engine-* del tema', () => {
    expect(css).toContain('.agent-provider-card--primary')
    expect(css).toContain('var(--engine-primary-border)')
    expect(css).toContain('var(--engine-primary-surface)')
    expect(css).toContain('var(--engine-primary-ring)')
    expect(css).toContain('.agent-provider-card--fallback')
    expect(css).toContain('var(--engine-fallback-border)')
    expect(css).toContain('var(--engine-fallback-surface)')
    expect(css).toContain('var(--engine-fallback-ring)')
  })
})
