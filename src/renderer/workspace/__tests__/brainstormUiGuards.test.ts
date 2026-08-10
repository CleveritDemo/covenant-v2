import { describe, expect, it } from 'vitest'
import type { ProjectAgentDefinition } from '@shared/projectAgentCatalog'
import {
  canAdvanceBrainstormInviteStep,
  tryCreateBrainstormSession,
} from '../brainstormUiGuards'

function agent(
  id: string,
  overrides: Partial<ProjectAgentDefinition> = {},
): ProjectAgentDefinition {
  return {
    id,
    provider: 'claude',
    permissionMode: 'auto',
    ...overrides,
  }
}

describe('BrainstormRoomModal guards', () => {
  it('does not advance invite step with fewer than 2 agents', () => {
    expect(canAdvanceBrainstormInviteStep([])).toBe(false)
    expect(canAdvanceBrainstormInviteStep(['a'])).toBe(false)
    expect(canAdvanceBrainstormInviteStep(['a', 'b'])).toBe(true)
  })

  it('does not start with empty topic or fewer than 2 agents', () => {
    expect(tryCreateBrainstormSession('', ['a', 'b'])).toBeNull()
    expect(tryCreateBrainstormSession('   ', ['a', 'b'])).toBeNull()
    expect(tryCreateBrainstormSession('topic', ['a'])).toBeNull()
    const room = tryCreateBrainstormSession('Ship UX', ['a', 'b'], 3)
    expect(room).not.toBeNull()
    expect(room?.topic).toBe('Ship UX')
    expect(room?.participantAgentIds).toEqual(['a', 'b'])
  })

  it('hides replicas from invite progress: normal + replica cannot advance or start', () => {
    const catalog = [
      agent('frontend', { name: 'Frontend' }),
      agent('frontend-2', { name: 'Frontend (replica)', localOnly: true }),
      agent('qa', { name: 'QA' }),
    ]
    expect(canAdvanceBrainstormInviteStep(
      ['frontend', 'frontend-2'],
      catalog,
    )).toBe(false)
    expect(tryCreateBrainstormSession(
      'Ship UX',
      ['frontend', 'frontend-2'],
      3,
      catalog,
    )).toBeNull()

    expect(canAdvanceBrainstormInviteStep(
      ['frontend', 'frontend-2', 'qa'],
      catalog,
    )).toBe(true)
    const room = tryCreateBrainstormSession(
      'Ship UX',
      ['frontend', 'frontend-2', 'qa'],
      3,
      catalog,
    )
    expect(room?.participantAgentIds).toEqual(['frontend', 'qa'])
  })

  it('drops technical orphan ids that are not in the catalog', () => {
    const catalog = [
      agent('david', { name: 'David' }),
      agent('qa', { name: 'QA' }),
    ]
    expect(canAdvanceBrainstormInviteStep(
      ['frontend', 'qa'],
      catalog,
    )).toBe(false)
    expect(tryCreateBrainstormSession(
      'Ship UX',
      ['frontend', 'david', 'qa'],
      3,
      catalog,
    )?.participantAgentIds).toEqual(['david', 'qa'])
  })
})
