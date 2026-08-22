import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const agentPaneSource = readFileSync(join(here, '../AgentPane.tsx'), 'utf8')

function controlKeyBlock(source: string): string {
  const start = source.indexOf('const controlKey = [')
  const end = source.indexOf('].join(', start)
  expect(start).toBeGreaterThan(-1)
  expect(end).toBeGreaterThan(start)
  return source.slice(start, end)
}

describe('AgentPane activity heartbeat wiring', () => {
  it('declares lastEventAtMs and activityCanGoStale on AgentPlaneStatus and status', () => {
    expect(agentPaneSource).toMatch(/export interface AgentPlaneStatus[\s\S]*lastEventAtMs:\s*number/)
    expect(agentPaneSource).toMatch(/export interface AgentPlaneStatus[\s\S]*activityCanGoStale:\s*boolean/)
    expect(agentPaneSource).toMatch(/const status: AgentPlaneStatus = \{[\s\S]*lastEventAtMs,/)
    expect(agentPaneSource).toMatch(
      /activityCanGoStale:\s*turnActivity\.phase\s*!==\s*'writing'/,
    )
  })

  it('keeps lastEventAtMs and activityCanGoStale out of controlKey', () => {
    const block = controlKeyBlock(agentPaneSource)
    expect(block).not.toContain('lastEventAtMs')
    expect(block).not.toContain('activityCanGoStale')
  })

  it('includes lastEventAtMs in the plane status effect dependencies', () => {
    const effectStart = agentPaneSource.indexOf('planeStatusThrottlerRef.current.schedule({')
    const depsStart = agentPaneSource.indexOf('}, [', effectStart)
    const depsEnd = agentPaneSource.indexOf('])', depsStart)
    const depsBlock = agentPaneSource.slice(depsStart, depsEnd)
    expect(depsBlock).toContain('lastEventAtMs')
  })
})
