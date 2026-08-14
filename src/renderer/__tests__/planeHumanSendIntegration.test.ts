import { describe, expect, it } from 'vitest'
import type { AgentCliImageAttachment } from '@shared/agentCliTypes'
import {
  enqueueHumanSend,
  MAX_VISIBLE_QUEUED_TURNS,
  takeNextHumanSend,
} from '@shared/planeHumanSendFifo'
import {
  appendQueuedTurnIfRoom,
  type HumanQueuedTurnLike,
} from '../agent/queuedTurnDedup'

type PlaneSend = {
  text: string
  images: AgentCliImageAttachment[]
  focusPane?: boolean
  orchestrationFollowUp?: boolean
}

type VisibleQueuedTurn = HumanQueuedTurnLike & { id: string }

type VisibleQueueStatus = {
  queuedTurns?: VisibleQueuedTurn[]
}

function makeFullVisibleQueue(): VisibleQueuedTurn[] {
  return Array.from({ length: MAX_VISIBLE_QUEUED_TURNS }, (_, i) => ({
    id: `q-${i}`,
    text: `visible turn ${i + 1}`,
    images: [],
  }))
}

function drainHumanSendFifo(
  queues: Map<string, PlaneSend[]>,
  planeSendByPane: Record<string, PlaneSend>,
  agentPlaneStatus: Record<string, VisibleQueueStatus> = {},
): Record<string, PlaneSend> {
  let result = planeSendByPane
  for (const paneId of [...queues.keys()]) {
    if (result[paneId]) continue
    const visibleQueued = agentPlaneStatus[paneId]?.queuedTurns?.length ?? 0
    if (visibleQueued >= MAX_VISIBLE_QUEUED_TURNS) continue
    const queue = queues.get(paneId)
    if (!queue?.length) {
      queues.delete(paneId)
      continue
    }
    const { head, rest } = takeNextHumanSend(queue)
    if (!head) {
      if (!rest.length) queues.delete(paneId)
      else queues.set(paneId, rest)
      continue
    }
    if (!rest.length) queues.delete(paneId)
    else queues.set(paneId, rest)

    const prev = result
    let rollbackHead = false
    if (prev[paneId]) {
      rollbackHead = true
    } else {
      result = { ...prev, [paneId]: head }
    }
    // Rollback fuera del updater: StrictMode puede invocar el updater dos veces con el mismo prev.
    if (rollbackHead) {
      queues.set(paneId, [head, ...(queues.get(paneId) ?? [])])
    }
  }
  return result
}

function enqueueHumanPlaneSend(
  queues: Map<string, PlaneSend[]>,
  paneId: string,
  text: string,
): void {
  const queue = queues.get(paneId) ?? []
  const item: PlaneSend = { text, images: [], focusPane: true }
  const { queue: nextQueue, dropped } = enqueueHumanSend(queue, item)
  if (dropped) return
  queues.set(paneId, nextQueue)
}

function drainOrchestrationSendFifo(
  queues: Map<string, PlaneSend[]>,
  planeSendByPane: Record<string, PlaneSend>,
  agentPlaneStatus: Record<string, VisibleQueueStatus> = {},
): Record<string, PlaneSend> {
  let result = { ...planeSendByPane }
  for (const paneId of [...queues.keys()]) {
    if (result[paneId]) continue
    const visibleQueued = agentPlaneStatus[paneId]?.queuedTurns?.length ?? 0
    if (visibleQueued >= MAX_VISIBLE_QUEUED_TURNS) continue
    const queue = queues.get(paneId)
    if (!queue?.length) {
      queues.delete(paneId)
      continue
    }
    const head = queue.shift()
    if (!head) {
      if (!queue.length) queues.delete(paneId)
      continue
    }
    if (!queue.length) queues.delete(paneId)

    let rollbackHead = false
    if (result[paneId]) {
      rollbackHead = true
    } else {
      result = { ...result, [paneId]: head }
    }
    // Rollback fuera del updater: StrictMode puede invocar el updater dos veces con el mismo prev.
    if (rollbackHead) {
      queues.set(paneId, [head, ...(queues.get(paneId) ?? [])])
    }
  }
  return result
}

describe('plane human send FIFO integration', () => {
  it('delivers two consecutive human sends when the slot stays occupied between them', () => {
    const paneId = 'agent-1'
    const queues = new Map<string, PlaneSend[]>()
    let planeSendByPane: Record<string, PlaneSend> = {}

    enqueueHumanPlaneSend(queues, paneId, 'first')
    planeSendByPane = drainHumanSendFifo(queues, planeSendByPane)
    expect(planeSendByPane[paneId]?.text).toBe('first')

    enqueueHumanPlaneSend(queues, paneId, 'second')
    planeSendByPane = drainHumanSendFifo(queues, planeSendByPane)
    expect(planeSendByPane[paneId]?.text).toBe('first')
    expect(queues.get(paneId)?.map(item => item.text)).toEqual(['second'])

    const { [paneId]: _consumed, ...freed } = planeSendByPane
    planeSendByPane = freed
    planeSendByPane = drainHumanSendFifo(queues, planeSendByPane)
    expect(planeSendByPane[paneId]?.text).toBe('second')
    expect(queues.has(paneId)).toBe(false)
  })

  it('does not overwrite an orchestration follow-up already in the slot', () => {
    const paneId = 'agent-1'
    const queues = new Map<string, PlaneSend[]>()
    const followUp: PlaneSend = {
      text: 'orchestration follow-up',
      images: [],
      orchestrationFollowUp: true,
    }
    const planeSendByPane: Record<string, PlaneSend> = { [paneId]: followUp }

    enqueueHumanPlaneSend(queues, paneId, 'human message')
    const afterDrain = drainHumanSendFifo(queues, planeSendByPane)

    expect(afterDrain[paneId]).toEqual(followUp)
    expect(queues.get(paneId)?.map(item => item.text)).toEqual(['human message'])
  })

  it('preserves a message enqueued during rollback when the slot stays occupied', () => {
    const paneId = 'agent-1'
    const queues = new Map<string, PlaneSend[]>()
    const occupied: PlaneSend = { text: 'in-flight', images: [] }
    let planeSendByPane: Record<string, PlaneSend> = { [paneId]: occupied }

    enqueueHumanPlaneSend(queues, paneId, 'first')
    enqueueHumanPlaneSend(queues, paneId, 'second')

    const queue = queues.get(paneId)!
    const { head, rest } = takeNextHumanSend(queue)
    if (!rest.length) queues.delete(paneId)
    else queues.set(paneId, rest)

    enqueueHumanPlaneSend(queues, paneId, 'third')

    let rollbackHead = false
    if (planeSendByPane[paneId]) rollbackHead = true
    if (rollbackHead && head) {
      queues.set(paneId, [head, ...(queues.get(paneId) ?? [])])
    }

    expect(queues.get(paneId)?.map(item => item.text)).toEqual(['first', 'second', 'third'])

    const { [paneId]: _consumed, ...freed } = planeSendByPane
    planeSendByPane = freed

    const delivered: string[] = []
    for (let i = 0; i < 3; i += 1) {
      planeSendByPane = drainHumanSendFifo(queues, planeSendByPane)
      const send = planeSendByPane[paneId]
      expect(send?.text).toBe(['first', 'second', 'third'][i])
      delivered.push(send!.text)
      const { [paneId]: _slot, ...nextFree } = planeSendByPane
      planeSendByPane = nextFree
    }
    expect(delivered).toEqual(['first', 'second', 'third'])
    expect(queues.has(paneId)).toBe(false)
  })

  it('does not duplicate rolled-back head when the updater runs twice (StrictMode)', () => {
    const paneId = 'agent-1'
    const queues = new Map<string, PlaneSend[]>()
    const occupied: PlaneSend = { text: 'busy', images: [] }
    const planeSendByPane: Record<string, PlaneSend> = { [paneId]: occupied }

    enqueueHumanPlaneSend(queues, paneId, 'waiting')
    enqueueHumanPlaneSend(queues, paneId, 'also-waiting')

    const queue = queues.get(paneId)!
    const { head, rest } = takeNextHumanSend(queue)
    queues.set(paneId, rest)

    let rollbackHead = false
    const runUpdater = (): Record<string, PlaneSend> => {
      if (planeSendByPane[paneId]) {
        rollbackHead = true
        return planeSendByPane
      }
      return { ...planeSendByPane, [paneId]: head! }
    }
    runUpdater()
    runUpdater()

    expect(rollbackHead).toBe(true)
    if (rollbackHead && head) {
      queues.set(paneId, [head, ...(queues.get(paneId) ?? [])])
    }

    expect(queues.get(paneId)?.map(item => item.text)).toEqual(['waiting', 'also-waiting'])
  })

  it('keeps a new human send in the FIFO when the visible queue is full and leaves the slot free', () => {
    const paneId = 'agent-1'
    const queues = new Map<string, PlaneSend[]>()
    const agentPlaneStatus: Record<string, VisibleQueueStatus> = {
      [paneId]: { queuedTurns: makeFullVisibleQueue() },
    }
    let planeSendByPane: Record<string, PlaneSend> = {}

    enqueueHumanPlaneSend(queues, paneId, 'blocked-until-room')
    planeSendByPane = drainHumanSendFifo(queues, planeSendByPane, agentPlaneStatus)

    expect(planeSendByPane[paneId]).toBeUndefined()
    expect(queues.get(paneId)?.map(item => item.text)).toEqual(['blocked-until-room'])
  })

  it('delivers a deferred human send in order once the visible queue drops below the cap', () => {
    const paneId = 'agent-1'
    const queues = new Map<string, PlaneSend[]>()
    const fullQueue = makeFullVisibleQueue()
    const agentPlaneStatus: Record<string, VisibleQueueStatus> = {
      [paneId]: { queuedTurns: fullQueue },
    }
    let planeSendByPane: Record<string, PlaneSend> = {}

    enqueueHumanPlaneSend(queues, paneId, 'first-waiting')
    enqueueHumanPlaneSend(queues, paneId, 'second-waiting')
    planeSendByPane = drainHumanSendFifo(queues, planeSendByPane, agentPlaneStatus)
    expect(planeSendByPane[paneId]).toBeUndefined()
    expect(queues.get(paneId)?.map(item => item.text)).toEqual(['first-waiting', 'second-waiting'])

    agentPlaneStatus[paneId] = { queuedTurns: fullQueue.slice(0, MAX_VISIBLE_QUEUED_TURNS - 1) }
    planeSendByPane = drainHumanSendFifo(queues, planeSendByPane, agentPlaneStatus)
    expect(planeSendByPane[paneId]?.text).toBe('first-waiting')
    expect(queues.get(paneId)?.map(item => item.text)).toEqual(['second-waiting'])

    const { [paneId]: _consumed, ...freed } = planeSendByPane
    planeSendByPane = freed
    planeSendByPane = drainHumanSendFifo(queues, planeSendByPane, agentPlaneStatus)
    expect(planeSendByPane[paneId]?.text).toBe('second-waiting')
    expect(queues.has(paneId)).toBe(false)
  })

  it('delivers a single orchestration follow-up when the slot frees after rollback', () => {
    const paneId = 'agent-1'
    const queues = new Map<string, PlaneSend[]>()
    const occupied: PlaneSend = { text: 'busy', images: [] }
    let planeSendByPane: Record<string, PlaneSend> = { [paneId]: occupied }
    const followUp: PlaneSend = {
      text: 'orchestration follow-up',
      images: [],
      orchestrationFollowUp: true,
    }

    queues.set(paneId, [followUp])
    planeSendByPane = drainOrchestrationSendFifo(queues, planeSendByPane)

    expect(planeSendByPane[paneId]).toEqual(occupied)
    expect(queues.get(paneId)?.map(item => item.text)).toEqual(['orchestration follow-up'])

    const { [paneId]: _consumed, ...freed } = planeSendByPane
    planeSendByPane = freed
    planeSendByPane = drainOrchestrationSendFifo(queues, planeSendByPane)

    expect(planeSendByPane[paneId]?.text).toBe('orchestration follow-up')
    expect(queues.has(paneId)).toBe(false)
  })

  it('does not duplicate rolled-back orchestration head when the updater runs twice (StrictMode)', () => {
    const paneId = 'agent-1'
    const queues = new Map<string, PlaneSend[]>()
    const occupied: PlaneSend = { text: 'busy', images: [] }
    const planeSendByPane: Record<string, PlaneSend> = { [paneId]: occupied }
    const followUp: PlaneSend = {
      text: 'waiting follow-up',
      images: [],
      orchestrationFollowUp: true,
    }

    queues.set(paneId, [followUp])
    const queue = queues.get(paneId)!
    const head = queue.shift()
    if (!queue.length) queues.delete(paneId)

    let rollbackHead = false
    const runUpdater = (): Record<string, PlaneSend> => {
      if (planeSendByPane[paneId]) {
        rollbackHead = true
        return planeSendByPane
      }
      return { ...planeSendByPane, [paneId]: head! }
    }
    runUpdater()
    runUpdater()

    expect(rollbackHead).toBe(true)
    if (rollbackHead && head) {
      queues.set(paneId, [head, ...(queues.get(paneId) ?? [])])
    }

    expect(queues.get(paneId)?.map(item => item.text)).toEqual(['waiting follow-up'])
  })

  it('delivers two orchestration follow-ups in order when the slot frees after rollback', () => {
    const paneId = 'agent-1'
    const queues = new Map<string, PlaneSend[]>()
    const occupied: PlaneSend = { text: 'busy', images: [] }
    let planeSendByPane: Record<string, PlaneSend> = { [paneId]: occupied }
    const first: PlaneSend = {
      text: 'first follow-up',
      images: [],
      orchestrationFollowUp: true,
    }
    const second: PlaneSend = {
      text: 'second follow-up',
      images: [],
      orchestrationFollowUp: true,
    }

    queues.set(paneId, [first, second])
    planeSendByPane = drainOrchestrationSendFifo(queues, planeSendByPane)

    expect(planeSendByPane[paneId]).toEqual(occupied)
    expect(queues.get(paneId)?.map(item => item.text)).toEqual(['first follow-up', 'second follow-up'])

    const { [paneId]: _consumed, ...freed } = planeSendByPane
    planeSendByPane = freed
    planeSendByPane = drainOrchestrationSendFifo(queues, planeSendByPane)
    expect(planeSendByPane[paneId]?.text).toBe('first follow-up')
    expect(queues.get(paneId)?.map(item => item.text)).toEqual(['second follow-up'])

    const { [paneId]: _consumed2, ...freed2 } = planeSendByPane
    planeSendByPane = freed2
    planeSendByPane = drainOrchestrationSendFifo(queues, planeSendByPane)
    expect(planeSendByPane[paneId]?.text).toBe('second follow-up')
    expect(queues.has(paneId)).toBe(false)
  })

  it('does not strand an orchestration follow-up when the visible queue is full', () => {
    const paneId = 'agent-1'
    const queues = new Map<string, PlaneSend[]>()
    const followUp: PlaneSend = {
      text: 'orchestration follow-up',
      images: [],
      orchestrationFollowUp: true,
    }
    const agentPlaneStatus: Record<string, VisibleQueueStatus> = {
      [paneId]: { queuedTurns: makeFullVisibleQueue() },
    }
    let planeSendByPane: Record<string, PlaneSend> = {}

    queues.set(paneId, [followUp])
    planeSendByPane = drainOrchestrationSendFifo(queues, planeSendByPane, agentPlaneStatus)

    expect(planeSendByPane[paneId]).toBeUndefined()
    expect(queues.get(paneId)?.map(item => item.text)).toEqual(['orchestration follow-up'])

    agentPlaneStatus[paneId] = {
      queuedTurns: makeFullVisibleQueue().slice(0, MAX_VISIBLE_QUEUED_TURNS - 1),
    }
    planeSendByPane = drainOrchestrationSendFifo(queues, planeSendByPane, agentPlaneStatus)

    expect(planeSendByPane[paneId]?.text).toBe('orchestration follow-up')
    expect(queues.has(paneId)).toBe(false)
  })

  it('keeps three central-chat sends visible in order when the agent is busy, including duplicate text', () => {
    const paneId = 'agent-1'
    const humanFifo = new Map<string, PlaneSend[]>()
    const texts = ['first', 'repeat', 'repeat']
    let planeSendByPane: Record<string, PlaneSend> = {}
    let visibleQueue: VisibleQueuedTurn[] = []

    for (const text of texts) {
      enqueueHumanPlaneSend(humanFifo, paneId, text)
    }

    while (humanFifo.has(paneId) || planeSendByPane[paneId]) {
      planeSendByPane = drainHumanSendFifo(humanFifo, planeSendByPane, {
        [paneId]: { queuedTurns: visibleQueue },
      })
      const send = planeSendByPane[paneId]
      if (!send) continue
      const enqueueResult = appendQueuedTurnIfRoom(
        visibleQueue,
        { id: `q-${visibleQueue.length}`, text: send.text, images: [] },
        MAX_VISIBLE_QUEUED_TURNS,
      )
      if (!enqueueResult.didEnqueue) continue
      visibleQueue = enqueueResult.turns
      const { [paneId]: _consumed, ...freed } = planeSendByPane
      planeSendByPane = freed
    }

    expect(visibleQueue.map(item => item.text)).toEqual(texts)
    expect(humanFifo.has(paneId)).toBe(false)
    expect(planeSendByPane[paneId]).toBeUndefined()
  })
})
