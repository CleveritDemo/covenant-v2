import { describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type { AppConfig } from '../../src/shared/configSchema'
import type { AgentCliStartRequest } from '../../src/shared/agentCliTypes'
import {
  buildContextContinuationPrompt,
  commandAndArgs,
  CONTEXT_FULL_REFRESH_INTERVAL_TURNS,
  materializeClipboardImages,
  normalizeClaudeEvent,
  normalizeCursorEvent,
  shouldForceFullContextRefresh,
} from '../agentCliRuntime'

const baseConfig = {
  agentCliClaudeCommand: 'claude',
  agentCliCursorCommand: 'agent',
} as AppConfig

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

  it('uses terminal result events as the canonical final answer', () => {
    expect(normalizeClaudeEvent({ type: 'result', result: 'final' })).toEqual([
      { type: 'assistant_final', text: 'final' },
    ])
    expect(normalizeCursorEvent({ type: 'result', result: 'final' })).toEqual([
      { type: 'assistant_final', text: 'final' },
    ])
  })
})

describe('permission mode CLI flags', () => {
  it('maps ask to read-only flags for Cursor and Claude', () => {
    const cursor = commandAndArgs(
      request({ provider: 'cursor', permissionMode: 'ask' }),
      baseConfig,
      '/tmp',
      'prompt',
    )
    expect(cursor.args).toContain('--mode')
    expect(cursor.args[cursor.args.indexOf('--mode') + 1]).toBe('ask')
    expect(cursor.args).not.toContain('--force')

    const claude = commandAndArgs(
      request({ provider: 'claude', permissionMode: 'ask' }),
      baseConfig,
      '/tmp',
      'prompt',
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
    )
    expect(cursorAuto.args).toContain('--force')

    const claudePlan = commandAndArgs(
      request({ provider: 'claude', permissionMode: 'plan' }),
      baseConfig,
      '/tmp',
      'prompt',
    )
    expect(claudePlan.args).toContain('--permission-mode')
    expect(claudePlan.args[claudePlan.args.indexOf('--permission-mode') + 1]).toBe('plan')
  })

  it('resumes both current CLI providers when a session exists', () => {
    const cursor = commandAndArgs(
      request({ provider: 'cursor', permissionMode: 'ask', cliSessionId: 'cursor-session' }),
      baseConfig,
      '/tmp',
      'prompt',
    )
    const claude = commandAndArgs(
      request({ provider: 'claude', permissionMode: 'ask', cliSessionId: 'claude-session' }),
      baseConfig,
      '/tmp',
      'prompt',
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
})

describe('materializeClipboardImages', () => {
  it('writes pasted images under .iaterminal/clipboard-images', () => {
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
      expect(paths[0]).toContain(join('.iaterminal', 'clipboard-images'))
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
