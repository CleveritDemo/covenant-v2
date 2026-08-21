import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const appSource = readFileSync(join(here, '../App.tsx'), 'utf8')
const agentPaneSource = readFileSync(join(here, '../agent/AgentPane.tsx'), 'utf8')

describe('offline wiring contract', () => {
  it('App.tsx consume useNetworkStatus y pasa offline al chrome y a los panes', () => {
    expect(appSource).toMatch(/import\s*\{[^}]*useNetworkStatus[^}]*\}\s*from\s*['"]\.\/useNetworkStatus['"]/)
    expect(appSource).toContain('const networkStatus = useNetworkStatus()')
    expect(appSource).toContain("const offline = networkStatus === 'offline'")
    expect(appSource).toContain('offline={offline}')
    expect(appSource).toMatch(/<Titlebar[\s\S]*offline=\{offline\}/)
    expect(appSource).toMatch(/<AgentPane[\s\S]*offline=\{offline\}/)
  })

  it('AgentPane.tsx declara offline y lo pasa a las guardas de cola', () => {
    expect(agentPaneSource).toMatch(/offline\?:\s*boolean/)
    expect(agentPaneSource).toMatch(/offline\s*=\s*false/)
    expect(agentPaneSource).toMatch(
      /computeCanStartHumanTurnNow\(\{[\s\S]*offline,[\s\S]*\}\)/,
    )
    expect(agentPaneSource).toMatch(
      /const drainGuard = \{[\s\S]*offline,[\s\S]*\}/,
    )
  })
})
