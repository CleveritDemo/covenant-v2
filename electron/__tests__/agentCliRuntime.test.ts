import { afterEach, describe, expect, it, vi } from 'vitest'
import { EventEmitter } from 'events'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type { AppConfig } from '../../src/shared/configSchema'
import type { AgentCliStartRequest, AgentCliUiEvent } from '../../src/shared/agentCliTypes'
import { buildRunKey } from '../../src/shared/agentRunKey'
import {
  buildContextContinuationPrompt,
  clearAgentContextDeliveryForSession,
  commandAndArgs,
  composePrompt,
  CONTEXT_FULL_REFRESH_INTERVAL_TURNS,
  isAgentRunActive,
  isAgentRunReservationCurrent,
  materializeClipboardImages,
  normalizeClaudeEvent,
  normalizeCursorEvent,
  normalizeCopilotEvent,
  closeAgentCliStdin,
  reserveAgentRun,
  resolveProjectCwd,
  runAgentCliSpawn,
  shouldFinishOnProcessClose,
  shouldForceFullContextRefresh,
  stopAgentRun,
} from '../agentCliRuntime'

const spawnMock = vi.hoisted(() => vi.fn())

vi.mock('cross-spawn', () => ({
  default: (...args: unknown[]) => spawnMock(...args),
}))
import { PROJECT_DIR } from '../../src/shared/projectDir'
import { upsertAiAgentResults } from '../aiAgentResults'
import { upsertProjectAgent } from '../projectAgentCatalogOps'

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

describe('resolveProjectCwd', () => {
  it('falls back to turn cwd when projectCwd is invalid, not home', () => {
    const home = mkdtempSync(join(tmpdir(), 'gravity-home-fb-'))
    const turnCwd = mkdtempSync(join(tmpdir(), 'gravity-turn-fb-'))
    try {
      expect(resolveProjectCwd({ cwd: turnCwd, projectCwd: '/no/existe/project' }, home)).toBe(turnCwd)
    } finally {
      rmSync(home, { recursive: true, force: true })
      rmSync(turnCwd, { recursive: true, force: true })
    }
  })

  it('falls back to home when projectCwd and cwd are invalid', () => {
    const home = mkdtempSync(join(tmpdir(), 'gravity-home-both-'))
    try {
      expect(resolveProjectCwd({ cwd: '/no/existe/turn', projectCwd: '/no/existe/project' }, home)).toBe(home)
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('prefers projectCwd over turn cwd for .gravity ops', () => {
    const home = mkdtempSync(join(tmpdir(), 'gravity-home-'))
    const project = mkdtempSync(join(tmpdir(), 'gravity-project-'))
    const worktree = mkdtempSync(join(tmpdir(), 'gravity-worktree-'))
    try {
      expect(resolveProjectCwd({ cwd: worktree, projectCwd: project }, home)).toBe(project)
      expect(resolveProjectCwd({ cwd: worktree }, home)).toBe(worktree)
    } finally {
      rmSync(home, { recursive: true, force: true })
      rmSync(project, { recursive: true, force: true })
      rmSync(worktree, { recursive: true, force: true })
    }
  })

  it('writes results under projectCwd when turn cwd is a worktree', () => {
    const project = mkdtempSync(join(tmpdir(), 'gravity-proj-'))
    const worktree = mkdtempSync(join(tmpdir(), 'gravity-wt-'))
    try {
      upsertProjectAgent(project, {
        id: 'scout',
        name: 'Scout',
        provider: 'claude',
        permissionMode: 'auto',
      })
      const projectCwd = resolveProjectCwd({ cwd: worktree, projectCwd: project }, project)
      upsertAiAgentResults(projectCwd, 'scout', {
        summary: 'From worktree turn',
        entries: ['entry'],
      }, { agentName: 'Scout' })
      const resultsPath = join(projectCwd, PROJECT_DIR, 'results', 'scout.md')
      expect(existsSync(resultsPath)).toBe(true)
      expect(readFileSync(resultsPath, 'utf8')).toContain('## Latest')
      expect(readFileSync(resultsPath, 'utf8')).toContain('From worktree turn')
      expect(existsSync(join(worktree, PROJECT_DIR, 'results', 'scout.md'))).toBe(false)
    } finally {
      rmSync(project, { recursive: true, force: true })
      rmSync(worktree, { recursive: true, force: true })
    }
  })

  it('materializeClipboardImages under projectCwd path', () => {
    const project = mkdtempSync(join(tmpdir(), 'gravity-clip-'))
    try {
      const tinyPng = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        'base64',
      ).toString('base64')
      const paths = materializeClipboardImages(project, [{
        name: 'paste.png',
        mimeType: 'image/png',
        base64: tinyPng,
      }])
      expect(paths.length).toBe(1)
      expect(paths[0].startsWith(join(project, PROJECT_DIR, 'clipboard-images'))).toBe(true)
    } finally {
      rmSync(project, { recursive: true, force: true })
    }
  })
})

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

describe('reserveAgentRun / isAgentRunReservationCurrent', () => {
  // Cubre el hueco de la Tarea 6, fix round 1: el handler de AGENT_CLI_START
  // reserva el pane con `reserveAgentRun` ANTES del refresco async de Jira, y
  // usa `isAgentRunReservationCurrent` tras el await para decidir si el turno
  // diferido todavía debe arrancar. Sin la reserva, un Stop durante la ventana
  // del refresco no encontraba nada que matar (`stopAgentRun` salía en
  // `if (!run) return`) y el spawn llegaba igual cuando el refresco terminaba.
  it('reservar marca el pane activo y la reserva como vigente', () => {
    const runKey = buildRunKey('pane-reserve-active')
    const generation = reserveAgentRun(runKey, null)
    try {
      expect(isAgentRunActive(runKey)).toBe(true)
      expect(isAgentRunReservationCurrent(runKey, generation)).toBe(true)
    } finally {
      stopAgentRun(runKey)
    }
  })

  it('Stop durante la ventana del refresco invalida la reserva: el turno diferido no debe arrancar', () => {
    const runKey = buildRunKey('pane-reserve-stopped')
    const generation = reserveAgentRun(runKey, null)

    // Simula el Stop del usuario mientras `refreshStaleJiraContexts` está en vuelo.
    stopAgentRun(runKey)

    expect(isAgentRunActive(runKey)).toBe(false)
    expect(isAgentRunReservationCurrent(runKey, generation)).toBe(false)
  })

  it('sin Stop, la reserva sigue vigente cuando el refresco termina: el turno normal debe arrancar', () => {
    const runKey = buildRunKey('pane-reserve-normal')
    const generation = reserveAgentRun(runKey, null)
    try {
      // Nada invalidó la reserva durante el "await" simulado del refresco.
      expect(isAgentRunReservationCurrent(runKey, generation)).toBe(true)
    } finally {
      stopAgentRun(runKey)
    }
  })

  it('una reserva más nueva para el mismo pane invalida la anterior', () => {
    const runKey = buildRunKey('pane-reserve-superseded')
    const first = reserveAgentRun(runKey, null)
    const second = reserveAgentRun(runKey, null)
    try {
      expect(isAgentRunReservationCurrent(runKey, first)).toBe(false)
      expect(isAgentRunReservationCurrent(runKey, second)).toBe(true)
    } finally {
      stopAgentRun(runKey)
    }
  })
})

describe('composePrompt identity', () => {
  it('prepends agent identity when name, role or objective are set', () => {
    const prompt = composePrompt(
      request({
        provider: 'claude',
        permissionMode: 'auto',
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
        permissionMode: 'auto',
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
        permissionMode: 'auto',
        prompt: 'hola',
      }),
      '/tmp',
      [],
      '',
    )
    expect(prompt).not.toContain('## Agent identity')
  })

  it('inserts MCP capability block after identity when mcpsAllowed is set', () => {
    const prompt = composePrompt(
      request({
        provider: 'copilot',
        permissionMode: 'auto',
        name: 'PO',
        mcpsAllowed: ['jira'],
        prompt: 'revisa CT-130',
      }),
      '/tmp',
      [],
      '',
    )
    expect(prompt).toContain('## MCP tools available')
    expect(prompt).toContain('- `jira`')
    expect(prompt).toContain('Do not claim you lack integrated Jira/Atlassian access')
    const identityIdx = prompt.indexOf('## Agent identity')
    const mcpIdx = prompt.indexOf('## MCP tools available')
    const userIdx = prompt.indexOf('## User request')
    expect(identityIdx).toBeGreaterThan(-1)
    expect(mcpIdx).toBeGreaterThan(identityIdx)
    expect(userIdx).toBeGreaterThan(mcpIdx)
  })

  it('omits MCP capability block without allowlist', () => {
    const prompt = composePrompt(
      request({
        provider: 'copilot',
        permissionMode: 'auto',
        prompt: 'hola',
      }),
      '/tmp',
      [],
      '',
    )
    expect(prompt).not.toContain('## MCP tools available')
  })

  it('omits jira issues from the attached-issues prompt when no snapshot exists on disk', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'gravity-jira-attached-'))
    try {
      const prompt = composePrompt(
        request({
          provider: 'claude',
          permissionMode: 'auto',
          prompt: 'revisa esto',
          contexts: [
            {
              id: 'iaterminal:jira:grav-412',
              name: 'GRAV-412',
              fileName: 'jira/GRAV-412.md',
              kind: 'jira',
              issueKey: 'GRAV-412',
            },
          ],
        }),
        cwd,
        [],
        '',
      )
      // Sin snapshot en disco, materializeTabContext devuelve ok:false ("No
      // snapshot for GRAV-412 yet."). Declarar la issue como adjunta y a la vez
      // prohibir el MCP dejaría al agente sin ninguna vía hacia el dato.
      expect(prompt).not.toContain('## Jira issues attached')
    } finally {
      rmSync(cwd, { recursive: true, force: true })
    }
  })

  it('omits jira issues whose snapshot on disk is only the placeholder (empty auto region)', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'gravity-jira-attached-'))
    try {
      mkdirSync(join(cwd, PROJECT_DIR, 'jira'), { recursive: true })
      // Exactamente lo que escribe `materializeTabContext` al alta cuando
      // todavía no hay snapshot (`write:true`): marcadores y nada más. El
      // archivo EXISTE, así que `materializeTabContext(...).ok` es `true` —
      // gatear por existencia dejaría pasar este caso y el preámbulo
      // afirmaría "fresh snapshot" con cero datos dentro.
      writeFileSync(
        join(cwd, PROJECT_DIR, 'jira', 'GRAV-412.md'),
        '<!-- iaterminal:auto -->\n\n<!-- /iaterminal:auto -->\n\n<!-- iaterminal:notes -->\n(no annotations yet)\n<!-- /iaterminal:notes -->\n',
        'utf8',
      )
      const prompt = composePrompt(
        request({
          provider: 'claude',
          permissionMode: 'auto',
          prompt: 'revisa esto',
          contexts: [
            {
              id: 'iaterminal:jira:grav-412',
              name: 'GRAV-412',
              fileName: 'jira/GRAV-412.md',
              kind: 'jira',
              issueKey: 'GRAV-412',
            },
          ],
        }),
        cwd,
        [],
        '',
      )
      expect(prompt).not.toContain('## Jira issues attached')
    } finally {
      rmSync(cwd, { recursive: true, force: true })
    }
  })

  it('resolves the issue key from the file name when the context has no explicit issueKey', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'gravity-jira-attached-'))
    try {
      mkdirSync(join(cwd, PROJECT_DIR, 'jira'), { recursive: true })
      writeFileSync(
        join(cwd, PROJECT_DIR, 'jira', 'GRAV-412.md'),
        '<!-- iaterminal:auto -->\n## Resumen\nGRAV-412 · algo\n<!-- /iaterminal:auto -->',
        'utf8',
      )
      const prompt = composePrompt(
        request({
          provider: 'claude',
          permissionMode: 'auto',
          prompt: 'revisa esto',
          cwd,
          // Un contexto recién descubierto en disco: `contextFilePath` y el
          // refresher ya caían al nombre de archivo; el preámbulo exigía
          // `issueKey` y por eso se callaba una issue que sí viajaba adjunta.
          contexts: [
            {
              id: 'iaterminal:jira:grav-412',
              name: 'GRAV-412',
              fileName: 'jira/GRAV-412.md',
              kind: 'jira',
            },
          ],
        }),
        cwd,
        [],
        '',
      )
      expect(prompt).toContain('## Jira issues attached')
      expect(prompt).toContain('GRAV-412')
    } finally {
      rmSync(cwd, { recursive: true, force: true })
    }
  })

  it('includes jira issues in the attached-issues prompt once a snapshot is materialized', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'gravity-jira-attached-'))
    try {
      mkdirSync(join(cwd, PROJECT_DIR, 'jira'), { recursive: true })
      writeFileSync(
        join(cwd, PROJECT_DIR, 'jira', 'GRAV-412.md'),
        '<!-- iaterminal:auto -->\n## Resumen\nGRAV-412 · algo\n<!-- /iaterminal:auto -->',
        'utf8',
      )
      const prompt = composePrompt(
        request({
          provider: 'claude',
          permissionMode: 'auto',
          prompt: 'revisa esto',
          cwd,
          contexts: [
            {
              id: 'iaterminal:jira:grav-412',
              name: 'GRAV-412',
              fileName: 'jira/GRAV-412.md',
              kind: 'jira',
              issueKey: 'GRAV-412',
            },
          ],
        }),
        cwd,
        [],
        '',
      )
      expect(prompt).toContain('## Jira issues attached')
      expect(prompt).toContain('GRAV-412')
      expect(prompt).toMatch(/do not/i)
    } finally {
      rmSync(cwd, { recursive: true, force: true })
    }
  })

  it('includes agent results registry on every turn', () => {
    const prompt = composePrompt(
      request({
        provider: 'claude',
        permissionMode: 'auto',
        name: 'Scout',
        prompt: 'hola',
      }),
      '/tmp',
      [],
      '',
    )
    expect(prompt).toContain('## Agent results registry')
    expect(prompt).toContain('You MUST append the results block on every turn')
    expect(prompt).toContain('"request"')
    expect(prompt).toContain('"changes"')
    expect(prompt).toContain('"summary"')
    expect(prompt).toContain('ia-terminal-results')
    expect(prompt).toContain('telling a teammate')
    expect(prompt).not.toContain('detailed summary')
    expect(prompt).not.toContain('brief summary')
  })

  it('omits agent results registry when emitResults is false', () => {
    const prompt = composePrompt(
      request({
        provider: 'claude',
        permissionMode: 'auto',
        name: 'Scout',
        prompt: 'hola',
        emitResults: false,
      }),
      '/tmp',
      [],
      '',
    )
    expect(prompt).not.toContain('## Agent results registry')
    expect(prompt).not.toContain('ia-terminal-results')
  })

  it('omits AI changelog instruction when emitChangelog is false', () => {
    const prompt = composePrompt(
      request({
        provider: 'claude',
        permissionMode: 'auto',
        name: 'Scout',
        prompt: 'hola',
        emitChangelog: false,
      }),
      '/tmp',
      [],
      '',
    )
    expect(prompt).not.toContain('## AI changelog')
    expect(prompt).not.toContain('ia-terminal-changelog')
  })

  it('includes AI changelog instruction by default', () => {
    const prompt = composePrompt(
      request({
        provider: 'claude',
        permissionMode: 'auto',
        prompt: 'hola',
      }),
      '/tmp',
      [],
      '',
    )
    expect(prompt).toContain('## AI changelog')
    expect(prompt).toContain('ia-terminal-changelog')
  })

  it('injects recent tab agent results before the user request', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'gravity-recent-results-'))
    try {
      upsertProjectAgent(cwd, {
        id: 'qa',
        name: 'QA',
        provider: 'cursor',
        permissionMode: 'auto',
      })
      upsertAiAgentResults(cwd, 'qa', {
        request: 'Correr tests',
        changes: ['auth.test.ts: edge case'],
        summary: 'Suite verde',
        entries: [],
      }, { agentName: 'QA', timestamp: '2026-03-01T00:00:00.000Z' })

      const prompt = composePrompt(
        request({
          provider: 'claude',
          permissionMode: 'auto',
          name: 'Scout',
          prompt: 'sigue',
          projectCwd: cwd,
          tabAgentIds: ['qa'],
        }),
        cwd,
        [],
        '',
      )
      expect(prompt).toContain('## Recent agent results')
      expect(prompt).toContain('### QA (`qa`)')
      expect(prompt).toContain('Suite verde')
      const recentIdx = prompt.indexOf('## Recent agent results')
      const userIdx = prompt.indexOf('## User request')
      expect(recentIdx).toBeGreaterThan(-1)
      expect(userIdx).toBeGreaterThan(recentIdx)
    } finally {
      rmSync(cwd, { recursive: true, force: true })
    }
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
      request({ provider: 'cursor', permissionMode: 'auto', prompt: 'hola' }),
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

  it('termina con instrucción de wiki ingest cuando el proyecto tiene wiki', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'gravity-wiki-ingest-'))
    try {
      mkdirSync(join(cwd, PROJECT_DIR, 'wiki', 'pages'), { recursive: true })
      writeFileSync(
        join(cwd, PROJECT_DIR, 'wiki', 'index.md'),
        '# Wiki index\n',
        'utf8',
      )

      const prompt = composePrompt(
        request({
          provider: 'claude',
          permissionMode: 'auto',
          prompt: 'hola',
          projectCwd: cwd,
        }),
        cwd,
        [],
        '',
      )
      expect(prompt).toContain('## Wiki ingest decision')
      expect(prompt.indexOf('## Wiki ingest decision')).toBeGreaterThan(prompt.indexOf('## User request'))
      expect(prompt.trimEnd().endsWith('```')).toBe(true)
    } finally {
      rmSync(cwd, { recursive: true, force: true })
    }
  })

  it('omite instrucción de wiki ingest cuando el proyecto no tiene wiki', () => {
    const prompt = composePrompt(
      request({ provider: 'claude', permissionMode: 'auto', prompt: 'hola' }),
      '/tmp',
      [],
      '',
    )
    expect(prompt).not.toContain('## Wiki ingest decision')
  })

  it('usa projectCwd explícito para wiki ingest, no el cwd del turno', () => {
    const turnCwd = mkdtempSync(join(tmpdir(), 'gravity-turn-wiki-'))
    const projectWithWiki = mkdtempSync(join(tmpdir(), 'gravity-project-wiki-'))
    const projectNoWiki = mkdtempSync(join(tmpdir(), 'gravity-project-nowiki-'))
    try {
      mkdirSync(join(projectWithWiki, PROJECT_DIR, 'wiki', 'pages'), { recursive: true })
      writeFileSync(join(projectWithWiki, PROJECT_DIR, 'wiki', 'index.md'), '# Wiki index\n', 'utf8')

      const caseA = composePrompt(
        request({
          provider: 'claude',
          permissionMode: 'auto',
          prompt: 'hola',
          cwd: turnCwd,
        }),
        turnCwd,
        [],
        '',
        projectWithWiki,
      )
      expect(caseA).toContain('## Wiki ingest decision')

      const caseB = composePrompt(
        request({
          provider: 'claude',
          permissionMode: 'auto',
          prompt: 'hola',
          cwd: turnCwd,
          projectCwd: projectWithWiki,
        }),
        turnCwd,
        [],
        '',
        projectNoWiki,
      )
      expect(caseB).not.toContain('## Wiki ingest decision')
    } finally {
      rmSync(turnCwd, { recursive: true, force: true })
      rmSync(projectWithWiki, { recursive: true, force: true })
      rmSync(projectNoWiki, { recursive: true, force: true })
    }
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

  it('maps plan mode for Cursor and Claude', () => {
    const cursor = commandAndArgs(
      request({ provider: 'cursor', permissionMode: 'plan' }),
      baseConfig,
      '/tmp',
      'prompt',
      undefined,
      testHome,
    )
    expect(cursor.args).toContain('--mode')
    expect(cursor.args[cursor.args.indexOf('--mode') + 1]).toBe('plan')
    expect(cursor.args).not.toContain('--force')

    const claude = commandAndArgs(
      request({ provider: 'claude', permissionMode: 'plan' }),
      baseConfig,
      '/tmp',
      'prompt',
      undefined,
      testHome,
    )
    expect(claude.args).toContain('--permission-mode')
    expect(claude.args[claude.args.indexOf('--permission-mode') + 1]).toBe('plan')
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
    // Sin nativeSkills, el default seguro deniega Skill en cualquier modo.
    expect(claudeAuto.args[claudeAuto.args.indexOf('--disallowedTools') + 1]).toBe('Skill')

    const cursorPlan = commandAndArgs(
      request({
        provider: 'cursor',
        permissionMode: 'plan',
        coordination: 'orchestrator',
      }),
      baseConfig,
      '/tmp',
      'prompt',
      undefined,
      testHome,
    )
    expect(cursorPlan.args).toContain('--mode')
    expect(cursorPlan.args[cursorPlan.args.indexOf('--mode') + 1]).toBe('plan')
    expect(cursorPlan.args).not.toContain('--force')

    const claudePlan = commandAndArgs(
      request({
        provider: 'claude',
        permissionMode: 'plan',
        coordination: 'orchestrator',
      }),
      baseConfig,
      '/tmp',
      'prompt',
      undefined,
      testHome,
    )
    expect(claudePlan.args).toContain('--permission-mode')
    expect(claudePlan.args[claudePlan.args.indexOf('--permission-mode') + 1]).toBe('plan')
    expect(claudePlan.args).not.toContain('bypassPermissions')
  })

  it('resumes both current CLI providers when a session exists', () => {
    const cursor = commandAndArgs(
      request({ provider: 'cursor', permissionMode: 'auto', cliSessionId: 'cursor-session' }),
      baseConfig,
      '/tmp',
      'prompt',
      undefined,
      testHome,
    )
    const claude = commandAndArgs(
      request({ provider: 'claude', permissionMode: 'auto', cliSessionId: 'claude-session' }),
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
    expect(prompt).toContain('## AI changelog')
  })

  it('skips changelog instruction when emitChangelog is false', () => {
    const prompt = buildContextContinuationPrompt(
      'INITIAL USER REQUEST',
      'REQUESTED CONTEXT',
      true,
      false,
    )
    expect(prompt).toContain('REQUESTED CONTEXT')
    expect(prompt).not.toContain('## AI changelog')
    expect(prompt).not.toContain('ia-terminal-changelog')
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

function fakeCliProc(opts: {
  stderr?: string
  stdout?: string
  code?: number
  error?: Error
}): EventEmitter & {
  stdin: { end: () => void }
  stdout: EventEmitter & { setEncoding: (enc: string) => void }
  stderr: EventEmitter & { setEncoding: (enc: string) => void }
  pid: number
} {
  const proc = new EventEmitter() as EventEmitter & {
    stdin: { end: () => void }
    stdout: EventEmitter & { setEncoding: (enc: string) => void }
    stderr: EventEmitter & { setEncoding: (enc: string) => void }
    pid: number
  }
  proc.stdin = { end: () => undefined }
  proc.stdout = Object.assign(new EventEmitter(), { setEncoding: () => undefined })
  proc.stderr = Object.assign(new EventEmitter(), { setEncoding: () => undefined })
  proc.pid = 4242
  queueMicrotask(() => {
    if (opts.error) proc.emit('error', opts.error)
    if (opts.stderr) proc.stderr.emit('data', opts.stderr)
    if (opts.stdout) proc.stdout.emit('data', opts.stdout)
    proc.emit('close', opts.code ?? 0)
  })
  return proc
}

function waitSpawn(req: AgentCliStartRequest, cwd: string): Promise<{
  events: AgentCliUiEvent[]
  code: number
}> {
  const events: AgentCliUiEvent[] = []
  return new Promise(resolve => {
    runAgentCliSpawn(
      { ...req, cwd },
      baseConfig,
      cwd,
      {
        onEvent: event => { events.push(event) },
        onDone: code => { resolve({ events, code }) },
      },
    )
  })
}

describe('runAgentCliSpawn harness fallback', () => {
  afterEach(() => {
    spawnMock.mockReset()
    stopAgentRun(buildRunKey('pane-fb', undefined))
  })

  it('respawnea en frío una vez ante 529 y no reenvía session del recambio', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'gravity-fb-'))
    spawnMock
      .mockImplementationOnce(() => fakeCliProc({ stderr: 'HTTP 529 overloaded', code: 1 }))
      .mockImplementationOnce(() => fakeCliProc({
        stdout: [
          '{"session_id":"fb-sess","type":"system"}',
          '{"type":"result","result":"ok"}',
        ].join('\n') + '\n',
        code: 0,
      }))
    try {
      const { events, code } = await waitSpawn(request({
        paneId: 'pane-fb',
        provider: 'claude',
        fallbackProvider: 'cursor',
        permissionMode: 'auto',
        cliSessionId: 'primary-sess',
        model: 'opus',
      }), cwd)
      expect(spawnMock).toHaveBeenCalledTimes(2)
      expect(spawnMock.mock.calls[0][0]).toBe('claude')
      expect(spawnMock.mock.calls[0][1]).toContain('--resume')
      expect(spawnMock.mock.calls[0][1]).toContain('opus')
      expect(spawnMock.mock.calls[1][0]).toBe('agent')
      expect(spawnMock.mock.calls[1][1]).not.toContain('--resume')
      expect(spawnMock.mock.calls[1][1]).not.toContain('opus')
      expect(events.filter(e => e.type === 'harness_fallback')).toEqual([
        { type: 'harness_fallback', from: 'claude', to: 'cursor' },
      ])
      expect(events.some(e => e.type === 'session')).toBe(false)
      expect(events.some(e => e.type === 'error')).toBe(false)
      expect(events.some(e => e.type === 'assistant_final' && e.text === 'ok')).toBe(true)
      expect(code).toBe(0)
    } finally {
      rmSync(cwd, { recursive: true, force: true })
    }
  })

  it('ENOENT del primario no dispara fallback', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'gravity-fb-enoent-'))
    spawnMock.mockImplementationOnce(() => fakeCliProc({
      error: new Error('spawn claude ENOENT'),
      stderr: 'spawn claude ENOENT',
      code: 1,
    }))
    try {
      const { events, code } = await waitSpawn(request({
        paneId: 'pane-fb',
        provider: 'claude',
        fallbackProvider: 'cursor',
        permissionMode: 'auto',
      }), cwd)
      expect(spawnMock).toHaveBeenCalledTimes(1)
      expect(events.some(e => e.type === 'harness_fallback')).toBe(false)
      expect(events.some(e => e.type === 'error')).toBe(true)
      expect(code).toBe(1)
    } finally {
      rmSync(cwd, { recursive: true, force: true })
    }
  })

  it('un intento: si el recambio también falla, error y onDone', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'gravity-fb-both-'))
    spawnMock
      .mockImplementationOnce(() => fakeCliProc({ stderr: '429 rate_limit', code: 1 }))
      .mockImplementationOnce(() => fakeCliProc({ stderr: '429 rate_limit', code: 1 }))
    try {
      const { events, code } = await waitSpawn(request({
        paneId: 'pane-fb',
        provider: 'claude',
        fallbackProvider: 'cursor',
        permissionMode: 'auto',
      }), cwd)
      expect(spawnMock).toHaveBeenCalledTimes(2)
      expect(events.filter(e => e.type === 'harness_fallback')).toHaveLength(1)
      expect(events.some(e => e.type === 'error')).toBe(true)
      expect(code).toBe(1)
    } finally {
      rmSync(cwd, { recursive: true, force: true })
    }
  })

  it('no intenta recambio en plan si el fallback no mapea plan', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'gravity-fb-plan-'))
    spawnMock.mockImplementationOnce(() => fakeCliProc({ stderr: 'overloaded', code: 1 }))
    try {
      const { events } = await waitSpawn(request({
        paneId: 'pane-fb',
        provider: 'claude',
        fallbackProvider: 'grok',
        permissionMode: 'plan',
      }), cwd)
      expect(spawnMock).toHaveBeenCalledTimes(1)
      expect(events.some(e => e.type === 'harness_fallback')).toBe(false)
      expect(events.some(e => e.type === 'error')).toBe(true)
    } finally {
      rmSync(cwd, { recursive: true, force: true })
    }
  })
})
