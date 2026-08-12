import { describe, expect, it, vi } from 'vitest'
import type { AgentCliStartRequest } from '../../src/shared/agentCliTypes'
import type { ProjectAgentDefinition } from '../../src/shared/projectAgentCatalog'
import type { AppConfig } from '../../src/shared/configSchema'

const spawned: AgentCliStartRequest[] = []

vi.mock('../agentCliRuntime', () => ({
  runAgentCliSpawn: (
    request: AgentCliStartRequest,
    _config: AppConfig,
    _home: string,
    handlers: { onDone: (code: number) => void },
  ) => {
    spawned.push(request)
    handlers.onDone(0)
  },
  stopAgentRun: () => undefined,
}))

const { defaultRunBrainstormSpeakerTurn } = await import('../brainstormRoom')

describe('el turno de la sala hereda la config del agente', () => {
  it('pasa mcpsAllowed y nativeSkills al CLI', async () => {
    const agent: ProjectAgentDefinition = {
      id: 'tl',
      name: 'Tech Lead',
      provider: 'claude',
      permissionMode: 'auto',
      mcpsAllowed: ['jira'],
      nativeSkills: { namespaces: ['superpowers'] },
    }

    await defaultRunBrainstormSpeakerTurn(
      {
        paneId: 'brainstorm:r1:tl',
        agent,
        prompt: 'habla',
        cwd: '/tmp',
        isStale: () => false,
        onDelta: () => undefined,
      },
      { agentCliCommands: {} } as AppConfig,
      '/home',
    )

    expect(spawned).toHaveLength(1)
    expect(spawned[0]!.mcpsAllowed).toEqual(['jira'])
    expect(spawned[0]!.nativeSkills).toEqual({ namespaces: ['superpowers'] })
  })
})
