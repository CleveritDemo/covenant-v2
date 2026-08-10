import { describe, expect, it } from 'vitest'
import {
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
})
