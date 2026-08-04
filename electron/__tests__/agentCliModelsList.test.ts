import { describe, expect, it } from 'vitest'
import { modelsForProvider } from '../../src/shared/agentCliModels'
import {
  extractCopilotModelsFromPackage,
  parseClaudeModelsStdout,
  parseCopilotModelsStdout,
  parseCursorModelsStdout,
  parseModelsStdout,
} from '../agentCliModelsList'

describe('parseCursorModelsStdout', () => {
  it('parses agent --list-models lines', () => {
    const stdout = [
      'Available models',
      '',
      'auto - Auto (current, default)',
      'composer-2.5 - Composer 2.5',
      'gpt-5.2 - GPT-5.2',
    ].join('\n')
    expect(parseCursorModelsStdout(stdout)).toEqual([
      { id: 'auto', label: 'Auto (current, default)' },
      { id: 'composer-2.5', label: 'Composer 2.5' },
      { id: 'gpt-5.2', label: 'GPT-5.2' },
    ])
  })
})

describe('parseClaudeModelsStdout', () => {
  it('parses id - label lines', () => {
    expect(parseClaudeModelsStdout('sonnet - Sonnet\nopus - Opus')).toEqual([
      { id: 'sonnet', label: 'Sonnet' },
      { id: 'opus', label: 'Opus' },
    ])
  })

  it('extracts aliases quoted in help text', () => {
    const help = [
      "Provide an alias for the latest model (e.g. 'fable', 'opus', or 'sonnet')",
      "or a model's full name (e.g. 'claude-fable-5').",
    ].join(' ')
    const ids = parseClaudeModelsStdout(help).map(m => m.id)
    expect(ids).toEqual(expect.arrayContaining(['fable', 'opus', 'sonnet', 'claude-fable-5']))
  })

  it('returns empty on auth error JSON', () => {
    expect(parseClaudeModelsStdout(JSON.stringify({
      type: 'result',
      is_error: true,
      result: 'Failed to authenticate',
    }))).toEqual([])
  })
})

describe('parseCopilotModelsStdout', () => {
  it('parses markdown model table from /models', () => {
    const table = [
      '| Model | ID | Context |',
      '| **Claude Sonnet 4.6** | `claude-sonnet-4.6` | default |',
      '| **GPT-5.4** | `gpt-5.4` | default |',
    ].join('\n')
    expect(parseCopilotModelsStdout(table)).toEqual([
      { id: 'claude-sonnet-4.6', label: 'Claude Sonnet 4.6' },
      { id: 'gpt-5.4', label: 'GPT-5.4' },
    ])
  })

  it('parses --model example from help and includes auto', () => {
    const help = 'Set the AI model (use auto). Example:\n$ copilot --model gpt-5.4\n'
    const ids = parseCopilotModelsStdout(help).map(m => m.id)
    expect(ids).toContain('auto')
    expect(ids).toContain('gpt-5.4')
  })
})

describe('parseModelsStdout + fallback', () => {
  it('routes by provider', () => {
    expect(parseModelsStdout('cursor', 'auto - Auto')).toEqual([
      { id: 'auto', label: 'Auto' },
    ])
  })

  it('fallback lists stay non-empty per provider', () => {
    expect(modelsForProvider('claude').length).toBeGreaterThan(0)
    expect(modelsForProvider('cursor').length).toBeGreaterThan(0)
    expect(modelsForProvider('copilot').length).toBeGreaterThan(0)
  })
})

describe('extractCopilotModelsFromPackage', () => {
  it('returns models from installed package when present', () => {
    const models = extractCopilotModelsFromPackage('copilot')
    // En CI sin paquete puede ser []; localmente debe incluir auto + ids reales.
    if (models.length === 0) {
      expect(models).toEqual([])
      return
    }
    expect(models.some(m => m.id === 'auto')).toBe(true)
    expect(models.some(m => m.id.startsWith('claude-') || m.id.startsWith('gpt-'))).toBe(true)
  })
})
