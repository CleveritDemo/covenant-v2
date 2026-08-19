import { describe, expect, it } from 'vitest'
import {
  DUPLICATE_OBJECTIVE_THRESHOLD,
  buildDuplicateDelegationFollowUp,
  buildRepeatedDispatchFollowUp,
  extractObjectivePathTokens,
  extractObjectiveShortTokens,
  findDuplicateDelegation,
  normalizeObjective,
  objectiveSimilarity,
} from '../delegationDuplicateGuard'
import {
  registerDelegationRuntime,
  type DelegationRuntimeRegistry,
} from '../delegationRuntimeRegistry'

function registryWith(
  partial: {
    delegationId?: string
    toAgentId?: string
    objective?: string
    status?: 'pending' | 'awaiting_merge' | 'completed' | 'orphaned' | 'superseded'
    registeredAt?: number
  } = {},
): DelegationRuntimeRegistry {
  const reg: DelegationRuntimeRegistry = new Map()
  const entry = registerDelegationRuntime(reg, {
    delegationId: partial.delegationId ?? 'd-live',
    fromPaneId: 'p-orq',
    toPaneId: 'p-fe',
    toAgentId: partial.toAgentId ?? 'frontend',
    jobId: 'job-1',
    objective: partial.objective ?? 'añade JumpToLatest button al acta del pane',
  }, partial.registeredAt ?? 1_000)
  if (partial.status && partial.status !== 'pending') {
    entry.status = partial.status
  }
  return reg
}

describe('normalizeObjective', () => {
  it('minúsculas, colapsa espacios, quita acentos y puntuación', () => {
    expect(normalizeObjective('  Implementá\nel botón, Jump-To-Latest!  ')).toBe(
      'implementa el boton jumptolatest',
    )
  })
})

describe('objectiveSimilarity', () => {
  it('devuelve 1 para el mismo conjunto de tokens largos', () => {
    expect(objectiveSimilarity(
      'añade JumpToLatest button al acta del pane',
      'Añade JumpToLatest button al acta del pane.',
    )).toBe(1)
  })

  it('descarta tokens de 2 caracteres o menos', () => {
    expect(objectiveSimilarity('do it now', 'do it')).toBe(0)
  })
})

describe('findDuplicateDelegation', () => {
  const objective = 'añade JumpToLatest button al acta del pane'

  it('objetivos idénticos → duplicado', () => {
    const registry = registryWith({ objective })
    expect(findDuplicateDelegation({
      toAgentId: 'frontend',
      objective,
      registry,
    })?.delegationId).toBe('d-live')
  })

  it('el mismo objetivo con una frase reescrita → duplicado', () => {
    const registry = registryWith({ objective })
    const hit = findDuplicateDelegation({
      toAgentId: 'frontend',
      objective: 'añade JumpToLatest button al acta pane',
      registry,
    })
    expect(hit?.delegationId).toBe('d-live')
    expect(objectiveSimilarity(objective, 'añade JumpToLatest button al acta pane'))
      .toBeGreaterThanOrEqual(DUPLICATE_OBJECTIVE_THRESHOLD)
  })

  it('dos objetivos distintos del mismo agente → undefined', () => {
    const registry = registryWith({ objective })
    expect(findDuplicateDelegation({
      toAgentId: 'frontend',
      objective: 'escribe tests del composer de texto pegado',
      registry,
    })).toBeUndefined()
  })

  it('mismo objetivo pero entrada completed → undefined', () => {
    const registry = registryWith({ objective, status: 'completed' })
    expect(findDuplicateDelegation({
      toAgentId: 'frontend',
      objective,
      registry,
    })).toBeUndefined()
  })

  it('entrada awaiting_merge con el mismo objetivo → duplicado', () => {
    const registry = registryWith({ objective, status: 'awaiting_merge' })
    expect(findDuplicateDelegation({
      toAgentId: 'frontend',
      objective,
      registry,
    })?.delegationId).toBe('d-live')
  })

  it('mismo objetivo a otro agente → undefined', () => {
    const registry = registryWith({ objective, toAgentId: 'frontend' })
    expect(findDuplicateDelegation({
      toAgentId: 'qa',
      objective,
      registry,
    })).toBeUndefined()
  })

  it('acepta alias agentId#2 / agentId-2 como el mismo agente base', () => {
    const registry = registryWith({ objective, toAgentId: 'frontend#2' })
    expect(findDuplicateDelegation({
      toAgentId: 'frontend-2',
      objective,
      registry,
    })?.delegationId).toBe('d-live')
  })

  it('mismo texto largo cambiando solo el archivo objetivo → no duplicado', () => {
    const sharedPrefix = [
      'implementa el componente JumpToLatest con accesibilidad teclado focus visible aria labels',
      'pruebas unitarias cobertura completa del acta del pane agente composer scroll follow y mensajes en',
    ].join(' ')
    const liveObjective = `${sharedPrefix} src/shared/delegationDuplicateGuard.ts`
    const nextObjective = `${sharedPrefix} src/renderer/App.tsx`
    const registry = registryWith({ objective: liveObjective })
    expect(objectiveSimilarity(liveObjective, nextObjective)).toBeGreaterThanOrEqual(
      DUPLICATE_OBJECTIVE_THRESHOLD,
    )
    expect(findDuplicateDelegation({
      toAgentId: 'frontend',
      objective: nextObjective,
      registry,
    })).toBeUndefined()
  })

  it('mismo texto cambiando solo un token de un carácter → no duplicado', () => {
    const liveObjective = 'ajusta la vista A del composer para alinear el botón de citar'
    const nextObjective = 'ajusta la vista B del composer para alinear el botón de citar'
    const registry = registryWith({ objective: liveObjective })
    expect(objectiveSimilarity(liveObjective, nextObjective)).toBe(1)
    expect(findDuplicateDelegation({
      toAgentId: 'frontend',
      objective: nextObjective,
      registry,
    })).toBeUndefined()
  })

  it('objetivos idénticos siguen siendo duplicados tras los pre-chequeos', () => {
    const registry = registryWith({ objective })
    expect(findDuplicateDelegation({
      toAgentId: 'frontend',
      objective: `${objective} `,
      registry,
    })?.delegationId).toBe('d-live')
  })

  it('paráfrasis sin rutas ni tokens cortos distintos sigue bloqueando por similitud', () => {
    const registry = registryWith({ objective })
    const paraphrase = 'añade JumpToLatest button al acta pane'
    expect(extractObjectivePathTokens(objective).size).toBe(0)
    expect(extractObjectivePathTokens(paraphrase).size).toBe(0)
    expect([...extractObjectiveShortTokens(objective)].sort()).toEqual(
      [...extractObjectiveShortTokens(paraphrase)].sort(),
    )
    expect(findDuplicateDelegation({
      toAgentId: 'frontend',
      objective: paraphrase,
      registry,
    })?.delegationId).toBe('d-live')
  })
})

describe('buildRepeatedDispatchFollowUp', () => {
  it('incluye el título y el agentId', () => {
    const text = buildRepeatedDispatchFollowUp({ toAgentId: 'qa' })
    expect(text).toContain('## Delegación duplicada')
    expect(text).toContain('qa')
    expect(text).toContain('ese mismo objetivo ya se despachó antes en este pedido')
  })
})

describe('fence: duplicada viva + nueva al mismo agente', () => {
  it('solo despacha la nueva y emite el follow-up de la duplicada', () => {
    const liveObjective = 'añade JumpToLatest button al acta del pane'
    const registry = registryWith({
      delegationId: 'd-live',
      objective: liveObjective,
      registeredAt: 0,
    })
    const fence = [
      {
        id: 'd-dup',
        toAgentId: 'frontend',
        objective: liveObjective,
      },
      {
        id: 'd-new',
        toAgentId: 'frontend',
        objective: 'escribe tests del composer de texto pegado',
      },
    ]
    const now = 5 * 60_000
    const dispatched: string[] = []
    const followUps: string[] = []
    for (const delegation of fence) {
      const duplicate = findDuplicateDelegation({
        toAgentId: delegation.toAgentId,
        objective: delegation.objective,
        registry,
      })
      if (duplicate) {
        followUps.push(buildDuplicateDelegationFollowUp({
          toAgentId: delegation.toAgentId,
          duplicate,
          now,
        }))
        continue
      }
      dispatched.push(delegation.id)
      registerDelegationRuntime(registry, {
        delegationId: delegation.id,
        fromPaneId: 'p-orq',
        toPaneId: 'p-fe',
        toAgentId: delegation.toAgentId,
        jobId: 'job-2',
        objective: delegation.objective,
      }, now)
    }
    expect(dispatched).toEqual(['d-new'])
    expect(followUps).toHaveLength(1)
    expect(followUps[0]).toContain('La delegación a frontend no se despachó')
    expect(followUps[0]).toContain('d-live')
    expect(followUps[0]).toContain('hace 5 min')
    expect(registry.has('d-dup')).toBe(false)
    expect(registry.get('d-new')?.objective).toBe('escribe tests del composer de texto pegado')
  })
})
