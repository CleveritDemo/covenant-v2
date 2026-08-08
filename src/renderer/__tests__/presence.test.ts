import { describe, expect, it } from 'vitest'
import { composePresence } from '../presence'

describe('composePresence', () => {
  it('usa el workspace en details', () => {
    const r = composePresence({ workspace: 'gravity', tabs: 3, agentLive: false })
    expect(r.details).toBe('In gravity')
    expect(r.state).toBe('3 sessions')
  })

  it('cae al nombre del producto sin workspace', () => {
    const r = composePresence({ workspace: null, tabs: 1, agentLive: false })
    expect(r.details).toBe('In Covenant Gravity')
  })

  it('singulariza una sola sesión', () => {
    expect(composePresence({ workspace: null, tabs: 1, agentLive: false }).state).toBe('1 session')
    expect(composePresence({ workspace: null, tabs: 0, agentLive: false }).state).toBe('0 sessions')
  })

  it('marca el agente activo', () => {
    const r = composePresence({ workspace: 'gravity', tabs: 2, agentLive: true })
    expect(r.state).toBe('2 sessions · agent running')
  })
})
