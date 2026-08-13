/**
 * End-to-end de correlación PO → Orquestador → Especialista → PO.
 *
 * Slice 4: no toca React ni electron. Modela el ciclo completo sobre las
 * primitivas puras que ya usan AgentPane y App:
 *   - orchestrationJobs (registro por pane de jobs vivos).
 *   - delegationRuntimeRegistry (mapa central de delegaciones vivas).
 *   - resolveOrchestrationJobIdForTurn (correlación follow-up ↔ job).
 *
 * Verifica los invariantes del retorno:
 *   1. PO delega al Orquestador → hay pending sin parentDelegationId.
 *   2. Orquestador emite nested al Especialista con parentDelegationId.
 *   3. Resultado del Especialista vuelve al Orquestador; nested se limpia.
 *   4. Follow-up al Orquestador mantiene su orchestrationJobId (no del PO).
 *   5. Orquestador cierra → PO recibe summary con su job intacto.
 *   6. Registry queda vacío tras el cierre.
 *   7. Cero réplicas colgadas (replicaDisposed idempotente).
 */

import { describe, expect, it } from 'vitest'
import {
  createOrchestrationJob,
  findJobByDelegation,
  resolveOrchestrationJobIdForTurn,
  type OrchestrationJob,
} from '../orchestrationJobs'
import {
  claimReplicaDispose,
  deleteDelegationRuntime,
  getDelegationRuntime,
  listNestedDelegations,
  registerDelegationRuntime,
  type DelegationRuntimeRegistry,
} from '../delegationRuntimeRegistry'

type JobsByPane = Map<string, Map<string, OrchestrationJob>>

function ensureJobsMap(byPane: JobsByPane, paneId: string): Map<string, OrchestrationJob> {
  let map = byPane.get(paneId)
  if (!map) {
    map = new Map()
    byPane.set(paneId, map)
  }
  return map
}

describe('flujo PO → Orquestador → Especialista → PO', () => {
  it('correlaciona parentDelegationId, orchestrationJobId y cierra registry limpio', () => {
    const registry: DelegationRuntimeRegistry = new Map()
    const jobsByPane: JobsByPane = new Map()

    const poPane = 'p-po'
    const orqPane = 'p-orq'
    const specPane = 'p-spec'

    // 1) PO delega al Orquestador. Se abre un job del PO con jobId propio.
    const poJob = createOrchestrationJob(poPane, 'job-po')
    ensureJobsMap(jobsByPane, poPane).set(poJob.jobId, poJob)
    const poDelegationId = 'd-po-to-orq'
    poJob.pending.set(poDelegationId, { toPaneId: orqPane, toAgentId: 'orchestrator' })
    poJob.hasDelegated = true
    poJob.round = 1
    registerDelegationRuntime(registry, {
      delegationId: poDelegationId,
      fromPaneId: poPane,
      toPaneId: orqPane,
      toAgentId: 'orchestrator',
      jobId: poJob.jobId,
      disposeReplica: false,
    })

    expect(getDelegationRuntime(registry, poDelegationId)?.parentDelegationId).toBeUndefined()
    expect(findJobByDelegation(ensureJobsMap(jobsByPane, poPane).values(), poDelegationId)?.jobId)
      .toBe('job-po')

    // 2) Orquestador arranca su turno y emite delegación anidada al Especialista.
    //    AgentPane tageó la request con parentDelegationId del padre vivo.
    const orqJob = createOrchestrationJob(orqPane, 'job-orq')
    ensureJobsMap(jobsByPane, orqPane).set(orqJob.jobId, orqJob)
    orqJob.round = 1
    orqJob.hasDelegated = true
    const nestedId = 'd-orq-to-spec'
    orqJob.pending.set(nestedId, { toPaneId: specPane, toAgentId: 'frontend' })
    registerDelegationRuntime(registry, {
      delegationId: nestedId,
      fromPaneId: orqPane,
      toPaneId: specPane,
      toAgentId: 'frontend',
      jobId: orqJob.jobId,
      parentDelegationId: poDelegationId,
      disposeReplica: true,
    })

    // Correlación: la nested "vive" en el job del orquestador, no del PO.
    expect(findJobByDelegation(ensureJobsMap(jobsByPane, orqPane).values(), nestedId)?.jobId)
      .toBe('job-orq')
    expect(findJobByDelegation(ensureJobsMap(jobsByPane, poPane).values(), nestedId))
      .toBeUndefined()

    // listNestedDelegations agrupa por parentDelegationId (útil para tracing).
    expect(listNestedDelegations(registry, poDelegationId).map(item => item.delegationId))
      .toEqual([nestedId])

    // 3) Especialista termina. Su resultado vuelve al Orquestador: se remueve el
    //    pending y el registry marca terminal + réplica disponible una vez.
    orqJob.pending.delete(nestedId)
    orqJob.completedResults.push({
      id: nestedId,
      status: 'ok',
      summary: 'work done',
      toAgentId: 'frontend',
      toPaneId: specPane,
    })
    const claimed = claimReplicaDispose(registry, nestedId)
    expect(claimed?.replicaDisposed).toBe(true)
    // Segunda reclamación (p. ej. evento tardío) es no-op → sin doble cierre.
    expect(claimReplicaDispose(registry, nestedId)).toBeUndefined()
    deleteDelegationRuntime(registry, nestedId)
    expect(getDelegationRuntime(registry, nestedId)).toBeUndefined()

    // 4) Follow-up agregado por el orquestador: el jobId del turno explícito
    //    (job-orq) gana sobre el "activo" del pane, incluso si el pane cambió
    //    de activo a otro job (turbo). Nunca cae al job del PO.
    const followUpJobId = resolveOrchestrationJobIdForTurn(orqJob.jobId, 'job-otro-turbo')
    expect(followUpJobId).toBe('job-orq')
    // Regresión: si la request perdiera su jobId, el fallback usa el active
    // del orquestador (que puede ser el mismo), pero jamás el del PO.
    const fallback = resolveOrchestrationJobIdForTurn(undefined, orqJob.jobId)
    expect(fallback).toBe('job-orq')
    expect(fallback).not.toBe(poJob.jobId)

    // 5) Orquestador cierra su ola. Su job queda sin pending → puede completar
    //    la delegación del PO con summary.
    expect(orqJob.pending.size).toBe(0)
    poJob.pending.delete(poDelegationId)
    poJob.completedResults.push({
      id: poDelegationId,
      status: 'ok',
      summary: 'orchestrator returned findings',
      toAgentId: 'orchestrator',
      toPaneId: orqPane,
    })
    deleteDelegationRuntime(registry, poDelegationId)

    // Follow-up al PO: su jobId sigue siendo job-po, jamás el del orquestador.
    const poFollowUpJobId = resolveOrchestrationJobIdForTurn(poJob.jobId, 'job-po')
    expect(poFollowUpJobId).toBe('job-po')

    // 6) Registry termina vacío: no quedaron réplicas ni entries huérfanos.
    expect(registry.size).toBe(0)

    // 7) PO y Orquestador quedan sin pending; el PO recibió el resultado.
    expect(poJob.pending.size).toBe(0)
    expect(orqJob.pending.size).toBe(0)
    expect(poJob.completedResults.map(item => item.id)).toEqual([poDelegationId])
    expect(orqJob.completedResults.map(item => item.id)).toEqual([nestedId])
  })

  it('follow-up de ronda anterior en turbo no cae al último request humano', () => {
    // Regresión: en turbo el orquestador puede tener dos jobs vivos. Un
    // follow-up tardío de la ronda 1 debe respetar su jobId explícito, no
    // heredar el jobId activo del último mensaje humano (ronda 2).
    const jobRound1 = createOrchestrationJob('p-orq', 'job-r1')
    const jobRound2 = createOrchestrationJob('p-orq', 'job-r2')
    const activeAfterHumanTurn = jobRound2.jobId

    // El follow-up trae orchestrationJobId del turno original.
    const resolvedForFollowUp = resolveOrchestrationJobIdForTurn(
      jobRound1.jobId,
      activeAfterHumanTurn,
    )
    expect(resolvedForFollowUp).toBe('job-r1')

    // Sin jobId explícito, cae al activo (comportamiento heredado).
    const resolvedWithoutExplicit = resolveOrchestrationJobIdForTurn(undefined, activeAfterHumanTurn)
    expect(resolvedWithoutExplicit).toBe('job-r2')

    // findJobByDelegation resuelve por delegationId sin ambigüedad entre jobs.
    const nestedInR1 = 'd-r1-nested'
    jobRound1.pending.set(nestedInR1, { toPaneId: 'p-spec', toAgentId: 'qa' })
    const jobs = new Map<string, OrchestrationJob>([
      [jobRound1.jobId, jobRound1],
      [jobRound2.jobId, jobRound2],
    ])
    expect(findJobByDelegation(jobs.values(), nestedInR1)?.jobId).toBe('job-r1')
  })

  it('resultado huérfano (job desaparecido) sigue rescatable por registry', () => {
    // Job "oficial" borrado por remount/supersede: el registry preserva la
    // entry para que App cierre la réplica y borre el worktree sin colgarse.
    const registry: DelegationRuntimeRegistry = new Map()
    registerDelegationRuntime(registry, {
      delegationId: 'd-nested',
      fromPaneId: 'p-orq',
      toPaneId: 'p-spec',
      toAgentId: 'frontend',
      jobId: 'job-orq',
      parentDelegationId: 'd-parent',
      disposeReplica: true,
    })
    const entry = getDelegationRuntime(registry, 'd-nested')
    expect(entry?.parentDelegationId).toBe('d-parent')
    expect(entry?.jobId).toBe('job-orq')
    const claimed = claimReplicaDispose(registry, 'd-nested')
    expect(claimed?.status).toBe('replica_disposed')
    deleteDelegationRuntime(registry, 'd-nested')
    expect(registry.size).toBe(0)
  })
})
