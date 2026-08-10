import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

describe('SettingsModal fixed chrome height', () => {
  it('locks lg panel height when hosting settings-layout; panes scroll inside', () => {
    const terminalCss = readFileSync(join(here, '../TerminalModal.css'), 'utf8')
    const settingsCss = readFileSync(join(here, '../SettingsModal.css'), 'utf8')

    expect(terminalCss).toMatch(
      /\.terminal-modal-panel--lg:has\(\.settings-layout\)\s*\{[^}]*height:\s*min\(/s,
    )
    expect(settingsCss).toMatch(/\.settings-layout\s*\{[^}]*height:\s*100%/s)
    expect(settingsCss).toMatch(/\.settings-nav\s*\{[^}]*min-height:\s*0/s)
    expect(settingsCss).toMatch(/\.settings-panel\s*\{[^}]*min-height:\s*0/s)
    expect(settingsCss).toMatch(/\.settings-panel\s*\{[^}]*overflow-y:\s*auto/s)
    expect(settingsCss).toMatch(/\.settings-status\s*\{[^}]*text-overflow:\s*ellipsis/s)
  })
})
