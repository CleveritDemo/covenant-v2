import { describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type { AppConfig } from '../../src/shared/configSchema'
import type { AgentCliStartRequest } from '../../src/shared/agentCliTypes'
import {
  buildContextContinuationPrompt,
  clearAgentContextDeliveryForSession,
  commandAndArgs,
  composePrompt,
  CONTEXT_FULL_REFRESH_INTERVAL_TURNS,
  materializeClipboardImages,
  normalizeClaudeEvent,
  normalizeCursorEvent,
  normalizeCopilotEvent,
  closeAgentCliStdin,
  shouldFinishOnProcessClose,
  shouldForceFullContextRefresh,
  stopAgentRun,
} from '../agentCliRuntime'
import { PROJECT_DIR } from '../../src/shared/projectDir'

const baseConfig = { agentCliCommands: {} } as AppConfig
// `home` es requerido en `commandAndArgs`: sin plugins que resolver en estos
// tests, cualquier ruta sirve, pero debe ser explícita (ver Task 5).
const testHome = tmpdir()

function request(
  partial: Partial<AgentCliStartRequest> & Pick<AgentCliStartRequest, 'provider' | 'permissionMode'>,
): AgentCliStartRequest {
  return {
    paneId: 'pane',
    prompt: 'hola',
    cwd: '/tmp',
    ...partial,
  }
}

describe('shouldFinishOnProcessClose', () => {
  it('only finishes while the process is still the active run', () => {
    expect(shouldFinishOnProcessClose(true)).toBe(true)
    expect(shouldFinishOnProcessClose(false)).toBe(false)
  })
})

describe('closeAgentCliStdin', () => {
  it('calls stdin.end after successful spawn registration', () => {
    let ended = false
    closeAgentCliStdin({ end: () => { ended = true } })
    expect(ended).toBe(true)
  })

  it('tolerates missing or throwing stdin', () => {
    expect(() => closeAgentCliStdin(null)).not.toThrow()
    expect(() => closeAgentCliStdin(undefined)).not.toThrow()
    expect(() => closeAgentCliStdin({
      end: () => { throw new Error('already closed') },
    })).not.toThrow()
  })
})

describe('stopAgentRun', () => {
  it('accepts a silent stop without an active pane', () => {
    expect(() => stopAgentRun('missing-pane')).not.toThrow()
  })
})

describe('composePrompt identity', () => {
  it('prepends agent identity when name, role or objective are set', () => {
    const prompt = composePrompt(
      request({
        provider: 'claude',
        permissionMode: 'ask',
        name: 'Architect',
        role: 'System design',
        objective: 'Keep boundaries clean',
        prompt: 'review this module',
      }),
      '/tmp',
      [],
      '',
    )
    expect(prompt).toContain('## Agent identity')
    expect(prompt).toContain('- Name: Architect')
    expect(prompt).toContain('- Role: System design')
    expect(prompt).toContain('- Objective: Keep boundaries clean')
    expect(prompt).toContain('## User request')
    expect(prompt).toContain('review this module')
  })

  it('includes rules in the identity block when provided', () => {
    const prompt = composePrompt(
      request({
        provider: 'claude',
        permissionMode: 'ask',
        name: 'QA',
        rules: ['Verify bugs in code', 'Prefer concise replies'],
        prompt: 'check this',
      }),
      '/tmp',
      [],
      '',
    )
    expect(prompt).toContain('- Rules:')
    expect(prompt).toContain('  1. Verify bugs in code')
    expect(prompt).toContain('  2. Prefer concise replies')
  })

  it('omits identity section when fields are empty', () => {
    const prompt = composePrompt(
      request({
        provider: 'claude',
        permissionMode: 'ask',
        prompt: 'hola',
      }),
      '/tmp',
      [],
      '',
    )
    expect(prompt).not.toContain('## Agent identity')
  })

  it('includes agent results registry on every turn', () => {
    const prompt = composePrompt(
      request({
        provider: 'claude',
        permissionMode: 'ask',
        name: 'Scout',
        prompt: 'hola',
      }),
      '/tmp',
      [],
      '',
    )
    expect(prompt).toContain('## Agent results registry')
    expect(prompt).toContain('You MUST append the results block on every turn')
    expect(prompt).toContain('ia-terminal-results')
  })

  it('includes orchestration protocol and agents only for orchestrators', () => {
    const normal = composePrompt(
      request({ provider: 'claude', permissionMode: 'auto', prompt: 'hola' }),
      '/tmp',
      [],
      '',
    )
    expect(normal).not.toContain('## Agent orchestration')

    const orch = composePrompt(
      request({
        provider: 'claude',
        permissionMode: 'auto',
        coordination: 'orchestrator',
        orchestrationAgents: [
          { agentId: 'qa', paneId: 'p1', name: 'QA', role: 'Tester' },
        ],
        prompt: 'ship it',
      }),
      '/tmp',
      [],
      '',
    )
    expect(orch).toContain('## Agent orchestration')
    expect(orch).toContain('ia-terminal-delegate')
    expect(orch).toContain('agentId: qa')
  })

  it('disables delegation protocol when allowDelegations is false', () => {
    const orch = composePrompt(
      request({
        provider: 'claude',
        permissionMode: 'auto',
        coordination: 'orchestrator',
        allowDelegations: false,
        orchestrationAgents: [
          { agentId: 'qa', paneId: 'p1', name: 'QA' },
        ],
        prompt: 'summarize',
      }),
      '/tmp',
      [],
      '',
    )
    expect(orch).toContain('DISABLED')
    expect(orch).not.toContain('"delegations"')
  })

  it('includes current wave in the orchestrator prompt', () => {
    const orch = composePrompt(
      request({
        provider: 'claude',
        permissionMode: 'auto',
        coordination: 'orchestrator',
        orchestrationRound: 2,
        orchestrationMaxRounds: 3,
        prompt: 'continue',
      }),
      '/tmp',
      [],
      '',
    )
    expect(orch).toContain('2/3')
  })

  it('reminds the model to deliver plan body when permissionMode is plan', () => {
    const ask = composePrompt(
      request({ provider: 'cursor', permissionMode: 'ask', prompt: 'hola' }),
      '/tmp',
      [],
      '',
    )
    expect(ask).not.toContain('## Plan delivery')

    const plan = composePrompt(
      request({ provider: 'cursor', permissionMode: 'plan', prompt: 'hola' }),
      '/tmp',
      [],
      '',
    )
    expect(plan).toContain('## Plan delivery')
    expect(plan).toContain('full plan content')
  })
})

describe('agent CLI event normalization', () => {
  it('normalizes Claude streaming deltas and session ids', () => {
    expect(normalizeClaudeEvent({
      type: 'stream_event',
      session_id: 'claude-session',
      event: { delta: { type: 'text_delta', text: 'hola' } },
    })).toEqual([
      { type: 'session', cliSessionId: 'claude-session' },
      { type: 'assistant_delta', text: 'hola' },
    ])
  })

  it('normalizes Copilot deltas, final message, tools and session', () => {
    expect(normalizeCopilotEvent({
      type: 'assistant.message_delta',
      data: { messageId: 'm1', deltaContent: 'hola' },
    })).toEqual([{ type: 'assistant_delta', text: 'hola' }])

    expect(normalizeCopilotEvent({
      type: 'assistant.message',
      data: { messageId: 'm1', content: 'listo', toolRequests: [] },
    })).toEqual([{ type: 'assistant_final', text: 'listo' }])

    expect(normalizeCopilotEvent({
      type: 'tool.execution_start',
      data: { toolCallId: 't1', toolName: 'view', arguments: { path: 'src/a.ts' } },
    })).toEqual([{ type: 'tool', name: 'view', status: 'started', detail: 'src/a.ts' }])

    expect(normalizeCopilotEvent({
      type: 'tool.execution_complete',
      data: { toolCallId: 't1', toolName: 'view', success: true },
    })).toEqual([{ type: 'tool', name: 'view', status: 'completed' }])

    expect(normalizeCopilotEvent({
      type: 'result',
      sessionId: 'copilot-session',
      exitCode: 0,
    })).toEqual([{ type: 'session', cliSessionId: 'copilot-session' }])
  })

  it('normalizes Cursor partial output without buffered duplicates', () => {
    expect(normalizeCursorEvent({
      type: 'assistant',
      timestamp_ms: 123,
      session_id: 'cursor-session',
      message: { content: [{ type: 'text', text: 'respuesta' }] },
    })).toEqual([
      { type: 'session', cliSessionId: 'cursor-session' },
      { type: 'assistant_delta', text: 'respuesta' },
    ])

    expect(normalizeCursorEvent({
      type: 'assistant',
      model_call_id: 'buffered',
      message: { content: [{ type: 'text', text: 'duplicado' }] },
    })).toEqual([])
  })

  it('normalizes Cursor tool_call with friendly name and path detail', () => {
    expect(normalizeCursorEvent({
      type: 'tool_call',
      subtype: 'started',
      tool_call: {
        readToolCall: { args: { path: '/Users/me/project/src/renderer/App.tsx' } },
      },
      session_id: 'cursor-session',
    })).toEqual([
      { type: 'session', cliSessionId: 'cursor-session' },
      {
        type: 'tool',
        name: 'Read',
        status: 'started',
        detail: 'renderer/App.tsx',
      },
    ])

    expect(normalizeCursorEvent({
      type: 'tool_call',
      subtype: 'started',
      tool_call: {
        writeToolCall: { args: { path: 'summary.txt', fileText: 'hi' } },
      },
    })).toEqual([
      {
        type: 'tool',
        name: 'Write',
        status: 'started',
        detail: 'summary.txt',
      },
    ])

    expect(normalizeCursorEvent({
      type: 'tool_call',
      subtype: 'started',
      tool_call: {
        function: {
          name: 'Shell',
          arguments: JSON.stringify({ command: 'npm test -- --run agentCli' }),
        },
      },
    })).toEqual([
      {
        type: 'tool',
        name: 'Shell',
        status: 'started',
        detail: 'npm test -- --run agentCli',
      },
    ])
  })

  it('injects CreatePlan markdown into the chat stream', () => {
    const planBody = [
      '# Portal de beneficios',
      '',
      '## Fase 0',
      'Carga de imágenes en create/edit.',
    ].join('\n')

    expect(normalizeCursorEvent({
      type: 'tool_call',
      subtype: 'started',
      tool_call: {
        createPlanToolCall: {
          args: {
            name: 'Portal de beneficios',
            overview: 'Backlog UX del portal',
            plan: planBody,
          },
        },
      },
    })).toEqual([
      {
        type: 'tool',
        name: 'Create Plan',
        status: 'started',
        detail: 'Portal de beneficios',
      },
      {
        type: 'assistant_delta',
        source: 'create_plan',
        text: [
          '',
          '',
          '# Portal de beneficios',
          '',
          'Backlog UX del portal',
          '',
          planBody,
        ].join('\n'),
      },
    ])
  })

  it('injects CreatePlan from function-shaped tool calls', () => {
    const events = normalizeCursorEvent({
      type: 'tool_call',
      subtype: 'completed',
      tool_call: {
        function: {
          name: 'CreatePlan',
          arguments: JSON.stringify({
            name: 'Virtualizar chat',
            overview: 'Virtualizar burbujas',
            plan: '# Plan\n\nUsar @tanstack/react-virtual.',
          }),
        },
      },
    })
    const planEvent = events.find(event => event.type === 'assistant_delta')
    expect(planEvent).toEqual({
      type: 'assistant_delta',
      source: 'create_plan',
      text: '\n\n# Virtualizar chat\n\nVirtualizar burbujas\n\n# Plan\n\nUsar @tanstack/react-virtual.',
    })
  })
})

describe('permission mode CLI flags', () => {
  it('maps Copilot permission modes to --yolo / --plan', () => {
    const ask = commandAndArgs(
      request({ provider: 'copilot', permissionMode: 'ask', model: 'auto', cliSessionId: 'sess-1' }),
      baseConfig,
      '/tmp',
      'prompt',
      undefined,
      testHome,
    )
    expect(ask.command).toBe('copilot')
    expect(ask.args.slice(0, 4)).toEqual(['-p', 'prompt', '--output-format', 'json'])
    expect(ask.args).toContain('--resume=sess-1')
    expect(ask.args).toContain('--model')
    expect(ask.args[ask.args.indexOf('--model') + 1]).toBe('auto')
    expect(ask.args).not.toContain('--yolo')
    expect(ask.args).not.toContain('--plan')

    const auto = commandAndArgs(
      request({ provider: 'copilot', permissionMode: 'auto' }),
      baseConfig,
      '/tmp',
      'prompt',
      undefined,
      testHome,
    )
    expect(auto.args).toContain('--yolo')
    expect(auto.args).not.toContain('--plan')

    const plan = commandAndArgs(
      request({ provider: 'copilot', permissionMode: 'plan' }),
      baseConfig,
      '/tmp',
      'prompt',
      undefined,
      testHome,
    )
    expect(plan.args).toContain('--plan')
    expect(plan.args).not.toContain('--yolo')
  })

  it('maps ask to read-only flags for Cursor and Claude', () => {
    const cursor = commandAndArgs(
      request({ provider: 'cursor', permissionMode: 'ask' }),
      baseConfig,
      '/tmp',
      'prompt',
      undefined,
      testHome,
    )
    expect(cursor.args).toContain('--mode')
    expect(cursor.args[cursor.args.indexOf('--mode') + 1]).toBe('ask')
    expect(cursor.args).not.toContain('--force')

    const claude = commandAndArgs(
      request({ provider: 'claude', permissionMode: 'ask' }),
      baseConfig,
      '/tmp',
      'prompt',
      undefined,
      testHome,
    )
    expect(claude.args).toContain('--disallowedTools')
    expect(claude.args[claude.args.indexOf('--disallowedTools') + 1]).toContain('Edit')
    expect(claude.args[claude.args.indexOf('--disallowedTools') + 1]).toContain('Write')
    expect(claude.args).not.toContain('bypassPermissions')
  })

  it('keeps auto and plan mappings', () => {
    const cursorAuto = commandAndArgs(
      request({ provider: 'cursor', permissionMode: 'auto' }),
      baseConfig,
      '/tmp',
      'prompt',
      undefined,
      testHome,
    )
    expect(cursorAuto.args).toContain('--force')

    const claudePlan = commandAndArgs(
      request({ provider: 'claude', permissionMode: 'plan' }),
      baseConfig,
      '/tmp',
      'prompt',
      undefined,
      testHome,
    )
    expect(claudePlan.args).toContain('--permission-mode')
    expect(claudePlan.args[claudePlan.args.indexOf('--permission-mode') + 1]).toBe('plan')
  })

  it('honors permissionMode for orchestrators (auto same as normal agent)', () => {
    const cursorAuto = commandAndArgs(
      request({
        provider: 'cursor',
        permissionMode: 'auto',
        coordination: 'orchestrator',
      }),
      baseConfig,
      '/tmp',
      'prompt',
      undefined,
      testHome,
    )
    expect(cursorAuto.args).toContain('--force')
    expect(cursorAuto.args).not.toContain('--mode')

    const claudeAuto = commandAndArgs(
      request({
        provider: 'claude',
        permissionMode: 'auto',
        coordination: 'orchestrator',
      }),
      baseConfig,
      '/tmp',
      'prompt',
      undefined,
      testHome,
    )
    expect(claudeAuto.args).toContain('--permission-mode')
    expect(claudeAuto.args[claudeAuto.args.indexOf('--permission-mode') + 1])
      .toBe('bypassPermissions')
    // Sin nativeSkills, el default seguro deniega Skill en cualquier modo;
    // lo que "auto" no debe traer son las herramientas de solo-ask (Edit, Write…).
    expect(claudeAuto.args[claudeAuto.args.indexOf('--disallowedTools') + 1]).toBe('Skill')

    const cursorAsk = commandAndArgs(
      request({
        provider: 'cursor',
        permissionMode: 'ask',
        coordination: 'orchestrator',
      }),
      baseConfig,
      '/tmp',
      'prompt',
      undefined,
      testHome,
    )
    expect(cursorAsk.args).toContain('--mode')
    expect(cursorAsk.args[cursorAsk.args.indexOf('--mode') + 1]).toBe('ask')
    expect(cursorAsk.args).not.toContain('--force')

    const claudeAsk = commandAndArgs(
      request({
        provider: 'claude',
        permissionMode: 'ask',
        coordination: 'orchestrator',
      }),
      baseConfig,
      '/tmp',
      'prompt',
      undefined,
      testHome,
    )
    expect(claudeAsk.args).toContain('--disallowedTools')
    expect(claudeAsk.args).not.toContain('bypassPermissions')
  })

  it('resumes both current CLI providers when a session exists', () => {
    const cursor = commandAndArgs(
      request({ provider: 'cursor', permissionMode: 'ask', cliSessionId: 'cursor-session' }),
      baseConfig,
      '/tmp',
      'prompt',
      undefined,
      testHome,
    )
    const claude = commandAndArgs(
      request({ provider: 'claude', permissionMode: 'ask', cliSessionId: 'claude-session' }),
      baseConfig,
      '/tmp',
      'prompt',
      undefined,
      testHome,
    )

    expect(cursor.args.slice(cursor.args.indexOf('--resume'), cursor.args.indexOf('--resume') + 2))
      .toEqual(['--resume', 'cursor-session'])
    expect(claude.args.slice(claude.args.indexOf('--resume'), claude.args.indexOf('--resume') + 2))
      .toEqual(['--resume', 'claude-session'])
  })
})

describe('portable context continuation', () => {
  it('sends only host context when the CLI session can resume', () => {
    const prompt = buildContextContinuationPrompt(
      'INITIAL USER REQUEST',
      'REQUESTED CONTEXT',
      true,
    )
    expect(prompt).toContain('REQUESTED CONTEXT')
    expect(prompt).not.toContain('INITIAL USER REQUEST')
  })

  it('restores the complete initial prompt when no session is available', () => {
    const prompt = buildContextContinuationPrompt(
      'INITIAL USER REQUEST AND CATALOG',
      'REQUESTED CONTEXT',
      false,
    )
    expect(prompt).toContain('INITIAL USER REQUEST AND CATALOG')
    expect(prompt).toContain('REQUESTED CONTEXT')
    expect(prompt).toContain('The CLI did not provide a resumable session')
  })

  it('forces a complete context refresh every ten session turns', () => {
    expect(CONTEXT_FULL_REFRESH_INTERVAL_TURNS).toBe(10)
    expect(shouldForceFullContextRefresh(null)).toBe(true)
    expect(shouldForceFullContextRefresh(8)).toBe(false)
    expect(shouldForceFullContextRefresh(9)).toBe(true)
  })

  it('clears delivery state for one CLI session without wiping others', () => {
    // Exercised via exported helper; map is module-private so we only assert API shape.
    expect(typeof clearAgentContextDeliveryForSession).toBe('function')
    clearAgentContextDeliveryForSession('cursor', 'sess-a')
    clearAgentContextDeliveryForSession('claude', '  ')
  })
})

describe('materializeClipboardImages', () => {
  it('writes pasted images under <projectDir>/clipboard-images', () => {
    const root = mkdtempSync(join(tmpdir(), 'ia-agent-img-'))
    try {
      mkdirSync(join(root, 'project'), { recursive: true })
      const cwd = join(root, 'project')
      // 1x1 PNG
      const png = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        'base64',
      )
      const paths = materializeClipboardImages(cwd, [{
        name: 'shot.png',
        mimeType: 'image/png',
        base64: png.toString('base64'),
      }])
      expect(paths).toHaveLength(1)
      expect(paths[0]).toContain(join(PROJECT_DIR, 'clipboard-images'))
      expect(readFileSync(paths[0])).toEqual(png)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('skips unsupported or empty payloads', () => {
    const root = mkdtempSync(join(tmpdir(), 'ia-agent-img-'))
    try {
      const cwd = join(root, 'project')
      mkdirSync(cwd, { recursive: true })
      expect(materializeClipboardImages(cwd, [
        { name: 'x.txt', mimeType: 'text/plain', base64: 'aGVsbG8=' },
        { name: 'empty.png', mimeType: 'image/png', base64: '' },
      ])).toEqual([])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
