import { describe, expect, it } from 'vitest'
import type { AppConfig } from '../../src/shared/configSchema'
import type { AgentCliStartRequest } from '../../src/shared/agentCliTypes'
import { AGENT_CLI_PROVIDER_IDS } from '../../src/shared/agentCliProviders'
import { commandAndArgs, createAgentCliParser, normalizeCodexEvent } from '../agentCliRuntime'

const config = { agentCliCommands: {} } as AppConfig

function request(
  partial: Partial<AgentCliStartRequest> & Pick<AgentCliStartRequest, 'provider' | 'permissionMode'>,
): AgentCliStartRequest {
  return { paneId: 'pane', prompt: 'hola', cwd: '/tmp', ...partial }
}

describe('commandAndArgs con el registro de proveedores', () => {
  it('usa el comando por defecto de cada CLI y siempre incluye el prompt', () => {
    for (const provider of AGENT_CLI_PROVIDER_IDS) {
      const { command, args } = commandAndArgs(
        request({ provider, permissionMode: 'auto' }),
        config,
        '/tmp',
        'prompt-x',
      )
      expect(command, provider).toBeTruthy()
      expect(args, provider).toContain('prompt-x')
    }
  })

  it('respeta el comando configurado por el usuario', () => {
    const { command } = commandAndArgs(
      request({ provider: 'codex', permissionMode: 'ask' }),
      { agentCliCommands: { codex: '/opt/homebrew/bin/codex' } } as AppConfig,
      '/tmp',
      'p',
    )
    expect(command).toBe('/opt/homebrew/bin/codex')
  })

  it('codex: exec + sandbox read-only en ask, bypass en auto y resume con sesión', () => {
    const ask = commandAndArgs(request({ provider: 'codex', permissionMode: 'ask' }), config, '/tmp', 'p')
    expect(ask.args.slice(0, 2)).toEqual(['exec', '--json'])
    expect(ask.args).toContain('read-only')

    const auto = commandAndArgs(request({ provider: 'codex', permissionMode: 'auto' }), config, '/tmp', 'p')
    expect(auto.args).toContain('--dangerously-bypass-approvals-and-sandbox')
    expect(auto.args).not.toContain('read-only')

    const resumed = commandAndArgs(
      request({ provider: 'codex', permissionMode: 'auto', cliSessionId: 'thread-1' }),
      config,
      '/tmp',
      'p',
    )
    expect(resumed.args.slice(0, 3)).toEqual(['exec', 'resume', 'thread-1'])
  })

  it('gemini / kimi / hermes mapean auto a su flag de yolo', () => {
    const flags = {
      gemini: '--yolo',
      kimi: '-y',
      hermes: '--yolo',
    } as const
    for (const [provider, flag] of Object.entries(flags)) {
      const { args } = commandAndArgs(
        request({ provider: provider as 'gemini', permissionMode: 'auto' }),
        config,
        '/tmp',
        'p',
      )
      expect(args, provider).toContain(flag)
    }
  })

  it('opencode usa el agente plan en modo plan', () => {
    const { args } = commandAndArgs(
      request({ provider: 'opencode', permissionMode: 'plan' }),
      config,
      '/tmp',
      'p',
    )
    expect(args.slice(0, 3)).toEqual(['run', '--agent', 'plan'])
  })
})

describe('createAgentCliParser', () => {
  it('proveedor de texto: cada línea es delta y el cierre emite el turno completo', () => {
    const parser = createAgentCliParser('hermes')
    expect(parser.line('hola')).toEqual([{ type: 'assistant_delta', text: 'hola\n' }])
    expect(parser.line('mundo')).toEqual([{ type: 'assistant_delta', text: 'mundo\n' }])
    expect(parser.end()).toEqual([{ type: 'assistant_final', text: 'hola\nmundo' }])
  })

  it('proveedor de texto sin salida no emite final', () => {
    expect(createAgentCliParser('pi').end()).toEqual([])
  })

  it('proveedor NDJSON lanza en líneas que no son JSON (van a stderr)', () => {
    const parser = createAgentCliParser('claude')
    expect(() => parser.line('command not found: claude')).toThrow()
  })
})

describe('normalizeCodexEvent', () => {
  it('thread.started es la sesión reanudable', () => {
    expect(normalizeCodexEvent({ type: 'thread.started', thread_id: 'abc' })).toEqual([
      { type: 'session', cliSessionId: 'abc' },
    ])
  })

  it('agent_message completado es el texto final', () => {
    expect(normalizeCodexEvent({
      type: 'item.completed',
      item: { id: 'item_0', type: 'agent_message', text: 'hi' },
    })).toEqual([{ type: 'assistant_final', text: 'hi' }])
  })

  it('los items de herramienta reportan estado y detalle', () => {
    expect(normalizeCodexEvent({
      type: 'item.started',
      item: { type: 'command_execution', command: 'npm test' },
    })).toEqual([{ type: 'tool', name: 'Command execution', status: 'started', detail: 'npm test' }])
  })

  it('turn.failed y el item error se muestran como error', () => {
    expect(normalizeCodexEvent({
      type: 'turn.failed',
      error: { message: 'usage limit' },
    })).toEqual([{ type: 'error', message: 'usage limit' }])
    expect(normalizeCodexEvent({
      type: 'item.completed',
      item: { type: 'error', message: 'skills truncated' },
    })).toEqual([{ type: 'error', message: 'skills truncated' }])
  })

  it('el razonamiento no ensucia el chat', () => {
    expect(normalizeCodexEvent({ type: 'item.completed', item: { type: 'reasoning' } })).toEqual([])
  })
})
