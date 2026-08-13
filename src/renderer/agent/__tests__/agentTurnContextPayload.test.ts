import { describe, expect, it } from 'vitest'
import {
  clearWorkspaceContextBodies,
  forgetWorkspaceContextBody,
  rememberWorkspaceContextBody,
} from '@shared/orgWorkspaceContent'
import { buildAgentTurnContextPayload } from '../agentTurnContextPayload'

describe('buildAgentTurnContextPayload', () => {
  it('sends projectCwd and notes contextContents when org body is present', () => {
    rememberWorkspaceContextBody('iaterminal:notes:About', 'Real About text')
    const payload = buildAgentTurnContextPayload('/Users/me/proj', [
      {
        id: 'iaterminal:notes:About',
        name: 'About',
        fileName: 'About.md',
        kind: 'notes',
      },
      {
        id: 'iaterminal:result:pd',
        name: 'Results',
        fileName: 'results/pd.md',
        kind: 'agentResult',
      },
    ])
    expect(payload).toEqual({
      projectCwd: '/Users/me/proj',
      contextContents: {
        'iaterminal:notes:About': 'Real About text',
      },
    })
    forgetWorkspaceContextBody('iaterminal:notes:About')
  })

  it('omits contextContents when map is empty; still sends projectCwd', () => {
    expect(buildAgentTurnContextPayload('/repo', [
      {
        id: 'iaterminal:notes:X',
        name: 'X',
        fileName: 'X.md',
        kind: 'notes',
      },
    ])).toEqual({ projectCwd: '/repo' })
  })

  it('never puts agentResult bodies into contextContents', () => {
    rememberWorkspaceContextBody('iaterminal:result:fe', 'should not ship')
    rememberWorkspaceContextBody('iaterminal:notes:About', 'About only')
    const payload = buildAgentTurnContextPayload('/proj', [
      {
        id: 'iaterminal:notes:About',
        name: 'About',
        fileName: 'About.md',
        kind: 'notes',
      },
      {
        id: 'iaterminal:result:fe',
        name: 'FE',
        fileName: 'results/fe.md',
        kind: 'agentResult',
      },
    ])
    expect(payload.contextContents).toEqual({
      'iaterminal:notes:About': 'About only',
    })
    forgetWorkspaceContextBody('iaterminal:result:fe')
    forgetWorkspaceContextBody('iaterminal:notes:About')
  })

  it('uses the body from the requested scope when contextIds collide', () => {
    const contextId = 'iaterminal:notes:Design-Language'
    const scopeA = { slug: 'acme', workspaceId: 'ws-a' }
    const scopeB = { slug: 'acme', workspaceId: 'ws-b' }
    rememberWorkspaceContextBody(contextId, 'body from A', scopeA)
    rememberWorkspaceContextBody(contextId, 'body from B', scopeB)
    const assigned = [{
      id: contextId,
      name: 'Design Language',
      fileName: 'Design-Language.md',
      kind: 'notes' as const,
    }]
    expect(buildAgentTurnContextPayload('/a', assigned, scopeA).contextContents).toEqual({
      [contextId]: 'body from A',
    })
    expect(buildAgentTurnContextPayload('/b', assigned, scopeB).contextContents).toEqual({
      [contextId]: 'body from B',
    })
    clearWorkspaceContextBodies(scopeA)
    clearWorkspaceContextBodies(scopeB)
  })
})
