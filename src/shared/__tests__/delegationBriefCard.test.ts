import { describe, expect, it } from 'vitest'
import {
  buildDelegationBriefBlock,
  looksLikeDelegationBrief,
  parseDelegationBrief,
} from '../delegationBriefCard'

describe('delegationBriefCard', () => {
  it('ida y vuelta con todos los metadatos', () => {
    const block = buildDelegationBriefBlock({
      objective: 'Revisa el login.\n\nPreferred context ids: Front-Rules, Orquestation-Logic',
      fromAgentId: 'tl',
      toAgentId: 'frontend',
      round: '1/3',
      cwd: '/Users/x/covenant-wt/qa-2',
      nested: true,
    })

    expect(looksLikeDelegationBrief(block)).toBe(true)
    expect(parseDelegationBrief(block)).toEqual({
      fromAgentId: 'tl',
      toAgentId: 'frontend',
      round: '1/3',
      worktree: 'qa-2',
      nested: true,
      contextIds: ['Front-Rules', 'Orquestation-Logic'],
      objective: 'Revisa el login.',
    })
  })

  it('sin metadatos deja el objetivo entero y el pie vacío', () => {
    const block = buildDelegationBriefBlock({ objective: 'Agrega el índice que falta.' })
    expect(parseDelegationBrief(block)).toEqual({
      nested: false,
      contextIds: [],
      objective: 'Agrega el índice que falta.',
    })
  })

  it('no toca la línea de contextos si no es la última: puede ser parte del objetivo', () => {
    const objective = [
      'El prompt que arma el host se ve así:',
      '',
      '```',
      'Preferred context ids: a, b',
      '```',
      '',
      'Documenta ese formato.',
    ].join('\n')
    const parsed = parseDelegationBrief(buildDelegationBriefBlock({ objective, fromAgentId: 'tl' }))
    expect(parsed?.contextIds).toEqual([])
    expect(parsed?.objective).toBe(objective)
  })

  it('un mensaje normal no es un encargo', () => {
    expect(looksLikeDelegationBrief('Revisa el login, por favor.')).toBe(false)
    expect(parseDelegationBrief('## Delegation result\nid: abc')).toBeNull()
  })
})
