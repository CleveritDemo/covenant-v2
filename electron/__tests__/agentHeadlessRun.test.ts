import { describe, expect, it, vi } from 'vitest'
import type { AgentCliStartRequest } from '../../src/shared/agentCliTypes'
import type { ProjectAgentDefinition } from '../../src/shared/projectAgentCatalog'
import type { AppConfig } from '../../src/shared/configSchema'

const spawned: AgentCliStartRequest[] = []
const stopped: string[] = []
const prefixStopped: string[] = []

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
  stopAgentRunsForPane: (paneId: string) => {
    stopped.push(paneId)
  },
  stopAgentRunsForPaneIdPrefix: (prefix: string) => {
    prefixStopped.push(prefix)
  },
}))

const {
  headlessRunKey,
  runHeadlessAgentTurn,
  stopHeadlessAgentRuns,
} = await import('../agentHeadlessRun')

describe('agentHeadlessRun', () => {
  const agent: ProjectAgentDefinition = {
    id: 'tl',
    name: 'Tech Lead',
    provider: 'claude',
    permissionMode: 'auto',
    mcpsAllowed: ['jira'],
    nativeSkills: { enabled: true, namespaces: ['superpowers'] },
  }

  it('arma el request con la clave headless y sin sesión de panel', async () => {
    spawned.length = 0
    await runHeadlessAgentTurn(
      {
        runnerKind: 'brainstorm',
        runnerId: 'r1',
        agent,
        prompt: 'habla',
        cwd: '/tmp',
        emitResults: false,
        emitChangelog: false,
        isStale: () => false,
        onDelta: () => undefined,
      },
      { agentCliCommands: {} } as AppConfig,
      '/home',
    )

    expect(spawned).toHaveLength(1)
    expect(spawned[0]).toMatchObject({
      paneId: 'brainstorm:r1:tl',
      provider: 'claude',
      permissionMode: 'auto',
      coordination: 'none',
      allowDelegations: false,
      emitResults: false,
      emitChangelog: false,
      agentId: 'tl',
      mcpsAllowed: ['jira'],
      nativeSkills: { enabled: true, namespaces: ['superpowers'] },
    })
    expect(spawned[0]!.cliSessionId).toBeUndefined()
    expect(spawned[0]!.paneId).not.toMatch(/^pane-/)
  })

  it('reusa la sesión CLI del runner, no la del panel', async () => {
    spawned.length = 0
    await runHeadlessAgentTurn(
      {
        runnerKind: 'loop',
        runnerId: 'chain-1',
        agent,
        prompt: 'loop',
        cwd: '/tmp',
        cliSessionId: 'runner-session',
        emitResults: true,
        isStale: () => false,
        onDelta: () => undefined,
      },
      { agentCliCommands: {} } as AppConfig,
      '/home',
    )

    expect(spawned[0]!.paneId).toBe('loop:chain-1:tl')
    expect(spawned[0]!.cliSessionId).toBe('runner-session')
    expect(spawned[0]!.emitResults).toBe(true)
    expect(spawned[0]!.emitChangelog).toBeUndefined()
  })

  it('propaga emitChangelog al AgentCliStartRequest', async () => {
    spawned.length = 0
    await runHeadlessAgentTurn(
      {
        runnerKind: 'loop',
        runnerId: 'chain-2',
        agent,
        prompt: 'loop',
        cwd: '/tmp',
        emitResults: true,
        emitChangelog: false,
        isStale: () => false,
        onDelta: () => undefined,
      },
      { agentCliCommands: {} } as AppConfig,
      '/home',
    )

    expect(spawned[0]!.emitResults).toBe(true)
    expect(spawned[0]!.emitChangelog).toBe(false)
  })

  it('headlessRunKey reproduce el formato brainstorm histórico', () => {
    expect(headlessRunKey('brainstorm', 'room-42', 'qa')).toBe('brainstorm:room-42:qa')
  })

  it('stopHeadlessAgentRuns apunta solo al runner indicado', () => {
    stopped.length = 0
    stopHeadlessAgentRuns('brainstorm', 'r1', 'tl')
    expect(stopped).toEqual(['brainstorm:r1:tl'])
    stopHeadlessAgentRuns('loop', 'c1', 'dev')
    expect(stopped).toEqual(['brainstorm:r1:tl', 'loop:c1:dev'])
  })

  it('stopHeadlessAgentRuns sin agentId detiene por prefijo del runner', () => {
    prefixStopped.length = 0
    stopHeadlessAgentRuns('loop', 'chain-9')
    expect(prefixStopped).toEqual(['loop:chain-9:'])
  })
})
