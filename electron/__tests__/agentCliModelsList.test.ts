import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
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

  it('ignores quoted words outside the --model block', () => {
    const help = [
      "  --agents <json>   Define agentes; equivale a la opción 'agent'.",
      "  --model <model>   Provide an alias (e.g. 'fable', 'opus', or 'sonnet').",
    ].join('\n')
    expect(parseClaudeModelsStdout(help).map(m => m.id)).toEqual(['fable', 'opus', 'sonnet'])
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

  it('does not treat auto-only help output as a full Copilot model list', () => {
    const ids = parseCopilotModelsStdout('use auto').map(m => m.id)
    expect(ids).toEqual(['auto'])
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

function writeCopilotFixture(prefix: string): string {
  const root = mkdtempSync(join(tmpdir(), 'copilot-models-'))
  const pkgDir = join(root, 'lib', 'node_modules', '@github', 'copilot')
  mkdirSync(pkgDir, { recursive: true })
  const catalog = `${prefix}={"sweagent-capi":{"claude-sonnet-4.6":{},"gpt-5.4":{},"claude-haiku-4.5":{}}}`
  writeFileSync(join(pkgDir, 'app.js'), `/* minified */${catalog}/* end */`, 'utf8')
  writeFileSync(join(pkgDir, 'npm-loader.js'), 'module.exports = {}', 'utf8')
  return join(pkgDir, 'npm-loader.js')
}

describe('extractCopilotModelsFromPackage', () => {
  it('extracts models via sweagent-capi needle with Hut= prefix', () => {
    const command = writeCopilotFixture('Hut')
    const models = extractCopilotModelsFromPackage(command)
    const ids = models.map(m => m.id)
    expect(models.length).toBeGreaterThan(1)
    expect(ids).toContain('auto')
    expect(ids).toContain('claude-sonnet-4.6')
    expect(ids).toContain('gpt-5.4')
  })

  it('extracts models via sweagent-capi needle with JEt= prefix (no hardcoded marker)', () => {
    const command = writeCopilotFixture('JEt')
    const models = extractCopilotModelsFromPackage(command)
    const ids = models.map(m => m.id)
    expect(models.length).toBeGreaterThan(1)
    expect(ids).toContain('auto')
    expect(ids).toContain('claude-sonnet-4.6')
    expect(ids).toContain('gpt-5.4')
  })

  it('live smoke: bare copilot finds package when installed locally', () => {
    const home = process.env.HOME || ''
    const platformArch = `${process.platform}-${process.arch}`
    const cacheApp = join(home, 'Library/Caches/copilot/pkg', platformArch)
    const universal = join(home, 'Library/Caches/copilot/pkg/universal')
    let hasLocalPackage = existsSync(cacheApp) || existsSync(universal)
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require.resolve('@github/copilot/package.json')
      hasLocalPackage = true
    } catch {
      /* optional */
    }
    if (!hasLocalPackage) {
      // CI / máquina sin Copilot: no ocultar fallo con expect([]).
      return
    }
    const models = extractCopilotModelsFromPackage('copilot')
    expect(models.length).toBeGreaterThanOrEqual(8)
    expect(models.some(m => m.id === 'auto')).toBe(true)
  })
})
