/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AgentCliImageAttachment } from '@shared/agentCliTypes'
import {
  enqueueHumanSend,
  MAX_VISIBLE_QUEUED_TURNS,
  takeNextHumanSend,
} from '@shared/planeHumanSendFifo'
import {
  appendQueuedTurnIfRoom,
  type AppendQueuedTurnOutcome,
  type HumanQueuedTurnLike,
  queuedTurnSourceSendIds,
  shouldClearPlaneSendForRemovedQueuedTurn,
} from '../agent/queuedTurnDedup'
import { shouldPromoteHumanSendToVisibleQueue } from '../agent/agentInputGuards'
import { mergeQueuedTurns } from '../agent/mergeQueuedTurns'
import { attachmentsToPendingImages, type ComposerPendingImage } from '../agent/composerImages'

type PlaneSend = {
  text: string
  images: AgentCliImageAttachment[]
  sendId?: string
  focusPane?: boolean
  orchestrationFollowUp?: boolean
  extraContextIds?: string[]
}

type VisibleQueuedTurn = HumanQueuedTurnLike & { id: string }

type VisibleQueueStatus = {
  busy?: boolean
  awaitingDelegations?: boolean
  delegationWorkActive?: boolean
  systemFollowUpsPending?: boolean
  queuedTurns?: VisibleQueuedTurn[]
}

type PlaneQueueControls = {
  enqueueHuman: (item: {
    text: string
    images: AgentCliImageAttachment[]
    sendId?: string
    extraContextIds?: string[]
  }) => Promise<AppendQueuedTurnOutcome>
}

function makeAttachment(label: string): AgentCliImageAttachment {
  const bytes = new Uint8Array([label.charCodeAt(0), 1, 2])
  return {
    name: `${label}.png`,
    mimeType: 'image/png',
    base64: btoa(String.fromCharCode(...bytes)),
  }
}

function mockBitmap(width: number, height: number): ImageBitmap {
  return { width, height, close: vi.fn() } as unknown as ImageBitmap
}

function stubImageConversion(): void {
  vi.stubGlobal('crypto', { randomUUID: () => `img-${Math.random()}` })
  vi.stubGlobal('createImageBitmap', vi.fn(async () => mockBitmap(80, 60)))
  vi.stubGlobal('URL', {
    createObjectURL: vi.fn(() => `blob:${Math.random()}`),
    revokeObjectURL: vi.fn(),
  })
  const context = { drawImage: vi.fn(), imageSmoothingEnabled: false, imageSmoothingQuality: 'low' }
  const canvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => context),
    toDataURL: vi.fn(() => 'data:image/webp;base64,thumb'),
  }
  vi.stubGlobal('document', {
    createElement: vi.fn(() => canvas),
  })
}

function makeFullVisibleQueue(): VisibleQueuedTurn[] {
  return Array.from({ length: MAX_VISIBLE_QUEUED_TURNS }, (_, i) => ({
    id: `q-${i}`,
    text: `visible turn ${i + 1}`,
    images: [],
  }))
}

function isSendIdAlreadyVisible(
  queuedTurns: VisibleQueuedTurn[] | undefined,
  sendId: string | undefined,
): boolean {
  const id = sendId?.trim()
  if (!id) return false
  return (queuedTurns ?? []).some(turn => queuedTurnSourceSendIds(turn).includes(id))
}

async function drainHumanSendFifo(
  queues: Map<string, PlaneSend[]>,
  planeSendByPane: Record<string, PlaneSend>,
  agentPlaneStatus: Record<string, VisibleQueueStatus> = {},
  controlsByPane: Map<string, PlaneQueueControls> = new Map(),
  inFlight: Set<string> = new Set(),
): Promise<Record<string, PlaneSend>> {
  let result = planeSendByPane
  for (const paneId of [...queues.keys()]) {
    const controls = controlsByPane.get(paneId)
    if (agentPlaneStatus[paneId]?.busy === true && controls) {
      if (inFlight.has(paneId)) continue
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

      const promotedSendId = head.sendId?.trim()
      if (promotedSendId && isSendIdAlreadyVisible(agentPlaneStatus[paneId]?.queuedTurns, promotedSendId)) {
        continue
      }

      inFlight.add(paneId)
      const outcome = await controls.enqueueHuman({
        text: head.text,
        images: head.images,
        sendId: head.sendId,
        ...(head.extraContextIds?.length ? { extraContextIds: head.extraContextIds } : {}),
      })
      if (outcome === 'full') {
        queues.set(paneId, [head, ...(queues.get(paneId) ?? [])])
      }
      inFlight.delete(paneId)
      continue
    }
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

    const promotedSendId = head.sendId?.trim()
    if (promotedSendId && isSendIdAlreadyVisible(agentPlaneStatus[paneId]?.queuedTurns, promotedSendId)) {
      continue
    }

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
  images: AgentCliImageAttachment[] = [],
  extraContextIds?: string[],
  sendId?: string,
): string {
  const queue = queues.get(paneId) ?? []
  const resolvedSendId = sendId ?? crypto.randomUUID()
  const item: PlaneSend = {
    text,
    images,
    sendId: resolvedSendId,
    focusPane: true,
    ...(extraContextIds?.length ? { extraContextIds } : {}),
  }
  const { queue: nextQueue, dropped } = enqueueHumanSend(queue, item)
  if (dropped) return resolvedSendId
  queues.set(paneId, nextQueue)
  return resolvedSendId
}

async function promoteHumanSendSynchronously(
  queues: Map<string, PlaneSend[]>,
  paneId: string,
  sendId: string,
  agentPlaneStatus: Record<string, VisibleQueueStatus>,
  controlsByPane: Map<string, PlaneQueueControls>,
  orchestrationWorkStyle: 'linear' | 'turbo' = 'turbo',
): Promise<AppendQueuedTurnOutcome | 'skipped'> {
  const controls = controlsByPane.get(paneId)
  const planeStatus = agentPlaneStatus[paneId]
  const visibleQueued = planeStatus?.queuedTurns?.length ?? 0
  if (
    !shouldPromoteHumanSendToVisibleQueue({
      busy: planeStatus?.busy === true,
      awaitingDelegations: planeStatus?.awaitingDelegations,
      delegationWorkActive: planeStatus?.delegationWorkActive,
      systemFollowUpsPending: planeStatus?.systemFollowUpsPending,
    }, orchestrationWorkStyle)
    || !controls
    || visibleQueued >= MAX_VISIBLE_QUEUED_TURNS
  ) {
    return 'skipped'
  }
  const queue = queues.get(paneId) ?? []
  const head = queue.find(item => item.sendId === sendId)
  if (!head) return 'skipped'
  const outcome = await controls.enqueueHuman({
    text: head.text,
    images: head.images,
    sendId: head.sendId,
    ...(head.extraContextIds?.length ? { extraContextIds: head.extraContextIds } : {}),
  })
  if (outcome === 'enqueued' || outcome === 'duplicate') {
    const trimmed = queue.filter(item => item.sendId !== sendId)
    if (trimmed.length) queues.set(paneId, trimmed)
    else queues.delete(paneId)
  }
  return outcome
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
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('delivers two consecutive human sends when the slot stays occupied between them', async () => {
    const paneId = 'agent-1'
    const queues = new Map<string, PlaneSend[]>()
    let planeSendByPane: Record<string, PlaneSend> = {}

    enqueueHumanPlaneSend(queues, paneId, 'first')
    planeSendByPane = await drainHumanSendFifo(queues, planeSendByPane)
    expect(planeSendByPane[paneId]?.text).toBe('first')

    enqueueHumanPlaneSend(queues, paneId, 'second')
    planeSendByPane = await drainHumanSendFifo(queues, planeSendByPane)
    expect(planeSendByPane[paneId]?.text).toBe('first')
    expect(queues.get(paneId)?.map(item => item.text)).toEqual(['second'])

    const { [paneId]: _consumed, ...freed } = planeSendByPane
    planeSendByPane = freed
    planeSendByPane = await drainHumanSendFifo(queues, planeSendByPane)
    expect(planeSendByPane[paneId]?.text).toBe('second')
    expect(queues.has(paneId)).toBe(false)
  })

  it('does not overwrite an orchestration follow-up already in the slot', async () => {
    const paneId = 'agent-1'
    const queues = new Map<string, PlaneSend[]>()
    const followUp: PlaneSend = {
      text: 'orchestration follow-up',
      images: [],
      orchestrationFollowUp: true,
    }
    const planeSendByPane: Record<string, PlaneSend> = { [paneId]: followUp }

    enqueueHumanPlaneSend(queues, paneId, 'human message')
    const afterDrain = await drainHumanSendFifo(queues, planeSendByPane)

    expect(afterDrain[paneId]).toEqual(followUp)
    expect(queues.get(paneId)?.map(item => item.text)).toEqual(['human message'])
  })

  it('preserves a message enqueued during rollback when the slot stays occupied', async () => {
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
      planeSendByPane = await drainHumanSendFifo(queues, planeSendByPane)
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

  it('keeps a new human send in the FIFO when the visible queue is full and leaves the slot free', async () => {
    const paneId = 'agent-1'
    const queues = new Map<string, PlaneSend[]>()
    const agentPlaneStatus: Record<string, VisibleQueueStatus> = {
      [paneId]: { queuedTurns: makeFullVisibleQueue() },
    }
    let planeSendByPane: Record<string, PlaneSend> = {}

    enqueueHumanPlaneSend(queues, paneId, 'blocked-until-room')
    planeSendByPane = await drainHumanSendFifo(queues, planeSendByPane, agentPlaneStatus)

    expect(planeSendByPane[paneId]).toBeUndefined()
    expect(queues.get(paneId)?.map(item => item.text)).toEqual(['blocked-until-room'])
  })

  it('delivers a deferred human send in order once the visible queue drops below the cap', async () => {
    const paneId = 'agent-1'
    const queues = new Map<string, PlaneSend[]>()
    const fullQueue = makeFullVisibleQueue()
    const agentPlaneStatus: Record<string, VisibleQueueStatus> = {
      [paneId]: { queuedTurns: fullQueue },
    }
    let planeSendByPane: Record<string, PlaneSend> = {}

    enqueueHumanPlaneSend(queues, paneId, 'first-waiting')
    enqueueHumanPlaneSend(queues, paneId, 'second-waiting')
    planeSendByPane = await drainHumanSendFifo(queues, planeSendByPane, agentPlaneStatus)
    expect(planeSendByPane[paneId]).toBeUndefined()
    expect(queues.get(paneId)?.map(item => item.text)).toEqual(['first-waiting', 'second-waiting'])

    agentPlaneStatus[paneId] = { queuedTurns: fullQueue.slice(0, MAX_VISIBLE_QUEUED_TURNS - 1) }
    planeSendByPane = await drainHumanSendFifo(queues, planeSendByPane, agentPlaneStatus)
    expect(planeSendByPane[paneId]?.text).toBe('first-waiting')
    expect(queues.get(paneId)?.map(item => item.text)).toEqual(['second-waiting'])

    const { [paneId]: _consumed, ...freed } = planeSendByPane
    planeSendByPane = freed
    planeSendByPane = await drainHumanSendFifo(queues, planeSendByPane, agentPlaneStatus)
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

  it('keeps three central-chat sends visible in order when the agent is busy, including duplicate text', async () => {
    const paneId = 'agent-1'
    const humanFifo = new Map<string, PlaneSend[]>()
    const texts = ['first', 'repeat', 'repeat']
    let planeSendByPane: Record<string, PlaneSend> = {}
    let visibleQueue: VisibleQueuedTurn[] = []

    for (const text of texts) {
      enqueueHumanPlaneSend(humanFifo, paneId, text)
    }

    while (humanFifo.has(paneId) || planeSendByPane[paneId]) {
      planeSendByPane = await drainHumanSendFifo(humanFifo, planeSendByPane, {
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

  it('enqueues three human sends into the visible pane queue when busy and the slot is occupied', async () => {
    const paneId = 'agent-1'
    const humanFifo = new Map<string, PlaneSend[]>()
    const followUp: PlaneSend = {
      text: 'orchestration follow-up',
      images: [],
      orchestrationFollowUp: true,
    }
    const planeSendByPane: Record<string, PlaneSend> = { [paneId]: followUp }
    let visibleQueue: VisibleQueuedTurn[] = []
    const visibleQueuesByPane = new Map<string, VisibleQueuedTurn[]>([[paneId, visibleQueue]])
    const inFlight = new Set<string>()
    const controlsByPane = new Map<string, PlaneQueueControls>([[
      paneId,
      {
        enqueueHuman: async item => {
          const current = visibleQueuesByPane.get(paneId) ?? []
          const result = appendQueuedTurnIfRoom(
            current,
            {
              id: `q-${current.length}`,
              text: item.text,
              images: [],
              ...(item.sendId?.trim() ? { sourceSendId: item.sendId.trim() } : {}),
            },
            MAX_VISIBLE_QUEUED_TURNS,
          )
          if (result.outcome === 'enqueued') {
            visibleQueue = result.turns
            visibleQueuesByPane.set(paneId, visibleQueue)
          }
          return result.outcome
        },
      },
    ]])
    const agentPlaneStatus: Record<string, VisibleQueueStatus> = {
      [paneId]: {
        busy: true,
        get queuedTurns() {
          return visibleQueue
        },
      },
    }

    for (const text of ['first', 'second', 'third']) {
      enqueueHumanPlaneSend(humanFifo, paneId, text)
    }

    for (let i = 0; i < 3; i += 1) {
      await drainHumanSendFifo(
        humanFifo,
        planeSendByPane,
        agentPlaneStatus,
        controlsByPane,
        inFlight,
      )
    }

    expect(visibleQueue.map(item => item.text)).toEqual(['first', 'second', 'third'])
    expect(humanFifo.has(paneId)).toBe(false)
    expect(planeSendByPane[paneId]).toEqual(followUp)
  })

  it('enqueues three image human sends with converted previewUrl when busy', async () => {
    stubImageConversion()
    const paneId = 'agent-1'
    const humanFifo = new Map<string, PlaneSend[]>()
    const followUp: PlaneSend = {
      text: 'orchestration follow-up',
      images: [],
      orchestrationFollowUp: true,
    }
    const planeSendByPane: Record<string, PlaneSend> = { [paneId]: followUp }
    let visibleQueue: VisibleQueuedTurn[] = []
    const visibleQueuesByPane = new Map<string, VisibleQueuedTurn[]>([[paneId, visibleQueue]])
    const inFlight = new Set<string>()
    const controlsByPane = new Map<string, PlaneQueueControls>([[
      paneId,
      {
        enqueueHuman: async item => {
          const resolvedImages = await attachmentsToPendingImages(item.images ?? [])
          const current = visibleQueuesByPane.get(paneId) ?? []
          const result = appendQueuedTurnIfRoom(
            current,
            {
              id: `q-${current.length}`,
              text: item.text,
              images: resolvedImages,
              ...(item.sendId?.trim() ? { sourceSendId: item.sendId.trim() } : {}),
            },
            MAX_VISIBLE_QUEUED_TURNS,
          )
          if (result.outcome === 'enqueued') {
            visibleQueue = result.turns
            visibleQueuesByPane.set(paneId, visibleQueue)
          }
          return result.outcome
        },
      },
    ]])
    const agentPlaneStatus: Record<string, VisibleQueueStatus> = {
      [paneId]: {
        busy: true,
        get queuedTurns() {
          return visibleQueue
        },
      },
    }

    for (const label of ['first', 'second', 'third']) {
      enqueueHumanPlaneSend(humanFifo, paneId, label, [makeAttachment(label)])
    }

    for (let i = 0; i < 3; i += 1) {
      await drainHumanSendFifo(
        humanFifo,
        planeSendByPane,
        agentPlaneStatus,
        controlsByPane,
        inFlight,
      )
    }

    expect(visibleQueue.map(item => item.text)).toEqual(['first', 'second', 'third'])
    expect(visibleQueue).toHaveLength(3)
    for (const turn of visibleQueue) {
      const images = turn.images as ComposerPendingImage[] | undefined
      expect(images).toHaveLength(1)
      expect(images![0]?.previewUrl).toMatch(/^blob:/)
      expect(images![0]).not.toHaveProperty('base64')
    }
    expect(humanFifo.has(paneId)).toBe(false)
    expect(planeSendByPane[paneId]).toEqual(followUp)
  })

  it('keeps excess human sends in the App fifo when the visible queue is full', async () => {
    const paneId = 'agent-1'
    const humanFifo = new Map<string, PlaneSend[]>()
    const followUp: PlaneSend = {
      text: 'orchestration follow-up',
      images: [],
      orchestrationFollowUp: true,
    }
    const planeSendByPane: Record<string, PlaneSend> = { [paneId]: followUp }
    let visibleQueue = makeFullVisibleQueue()
    const visibleQueuesByPane = new Map<string, VisibleQueuedTurn[]>([[paneId, visibleQueue]])
    const controlsByPane = new Map<string, PlaneQueueControls>([[
      paneId,
      {
        enqueueHuman: async item => {
          const current = visibleQueuesByPane.get(paneId) ?? []
          const result = appendQueuedTurnIfRoom(
            current,
            {
              id: `q-${current.length}`,
              text: item.text,
              images: [],
              ...(item.sendId?.trim() ? { sourceSendId: item.sendId.trim() } : {}),
            },
            MAX_VISIBLE_QUEUED_TURNS,
          )
          if (result.outcome === 'enqueued') {
            visibleQueue = result.turns
            visibleQueuesByPane.set(paneId, visibleQueue)
          }
          return result.outcome
        },
      },
    ]])
    const agentPlaneStatus: Record<string, VisibleQueueStatus> = {
      [paneId]: {
        busy: true,
        get queuedTurns() {
          return visibleQueue
        },
      },
    }

    enqueueHumanPlaneSend(humanFifo, paneId, 'overflow')

    await drainHumanSendFifo(
      humanFifo,
      planeSendByPane,
      agentPlaneStatus,
      controlsByPane,
    )

    expect(visibleQueue).toHaveLength(MAX_VISIBLE_QUEUED_TURNS)
    expect(humanFifo.get(paneId)?.map(item => item.text)).toEqual(['overflow'])
    expect(planeSendByPane[paneId]).toEqual(followUp)
  })

  it('passes extraContextIds to enqueueHuman when busy and draining the human fifo', async () => {
    const paneId = 'agent-1'
    const humanFifo = new Map<string, PlaneSend[]>()
    const followUp: PlaneSend = {
      text: 'orchestration follow-up',
      images: [],
      orchestrationFollowUp: true,
    }
    const planeSendByPane: Record<string, PlaneSend> = { [paneId]: followUp }
    const contextIds = ['ctx-notes', 'ctx-rules']
    const enqueueHuman = vi.fn(async (_item: {
      text: string
      images: AgentCliImageAttachment[]
      sendId?: string
      extraContextIds?: string[]
    }) => 'enqueued' as AppendQueuedTurnOutcome)
    const controlsByPane = new Map<string, PlaneQueueControls>([[
      paneId,
      { enqueueHuman },
    ]])
    const agentPlaneStatus: Record<string, VisibleQueueStatus> = {
      [paneId]: { busy: true, queuedTurns: [] },
    }

    enqueueHumanPlaneSend(humanFifo, paneId, 'with-contexts', [], contextIds)

    await drainHumanSendFifo(
      humanFifo,
      planeSendByPane,
      agentPlaneStatus,
      controlsByPane,
    )

    expect(enqueueHuman).toHaveBeenCalledTimes(1)
    expect(enqueueHuman).toHaveBeenCalledWith(expect.objectContaining({
      text: 'with-contexts',
      extraContextIds: contextIds,
    }))
  })

  it('does not call enqueueHuman when visible queue is full and pane is busy', async () => {
    const paneId = 'agent-1'
    const humanFifo = new Map<string, PlaneSend[]>()
    const followUp: PlaneSend = {
      text: 'orchestration follow-up',
      images: [],
      orchestrationFollowUp: true,
    }
    const planeSendByPane: Record<string, PlaneSend> = { [paneId]: followUp }
    const enqueueHuman = vi.fn(async () => 'enqueued' as AppendQueuedTurnOutcome)
    const controlsByPane = new Map<string, PlaneQueueControls>([[
      paneId,
      { enqueueHuman },
    ]])
    const agentPlaneStatus: Record<string, VisibleQueueStatus> = {
      [paneId]: {
        busy: true,
        queuedTurns: makeFullVisibleQueue(),
      },
    }

    enqueueHumanPlaneSend(humanFifo, paneId, 'blocked-at-cap')

    for (let i = 0; i < 5; i += 1) {
      await drainHumanSendFifo(
        humanFifo,
        planeSendByPane,
        agentPlaneStatus,
        controlsByPane,
      )
    }

    expect(enqueueHuman).not.toHaveBeenCalled()
    expect(humanFifo.get(paneId)?.map(item => item.text)).toEqual(['blocked-at-cap'])
  })

  it('does not re-call enqueueHuman after full outcome when tick would re-enter the drain', async () => {
    const paneId = 'agent-1'
    const humanFifo = new Map<string, PlaneSend[]>()
    const followUp: PlaneSend = {
      text: 'orchestration follow-up',
      images: [],
      orchestrationFollowUp: true,
    }
    const planeSendByPane: Record<string, PlaneSend> = { [paneId]: followUp }
    let visibleQueue = makeFullVisibleQueue().slice(0, MAX_VISIBLE_QUEUED_TURNS - 1)
    const enqueueHuman = vi.fn(async () => 'full' as AppendQueuedTurnOutcome)
    const controlsByPane = new Map<string, PlaneQueueControls>([[
      paneId,
      { enqueueHuman },
    ]])
    const agentPlaneStatus: Record<string, VisibleQueueStatus> = {
      [paneId]: {
        busy: true,
        get queuedTurns() {
          return visibleQueue
        },
      },
    }

    enqueueHumanPlaneSend(humanFifo, paneId, 'overflow-on-enqueue')

    await drainHumanSendFifo(
      humanFifo,
      planeSendByPane,
      agentPlaneStatus,
      controlsByPane,
    )
    expect(enqueueHuman).toHaveBeenCalledTimes(1)
    expect(humanFifo.get(paneId)?.map(item => item.text)).toEqual(['overflow-on-enqueue'])

    visibleQueue = makeFullVisibleQueue()

    for (let i = 0; i < 5; i += 1) {
      await drainHumanSendFifo(
        humanFifo,
        planeSendByPane,
        agentPlaneStatus,
        controlsByPane,
      )
    }
    expect(enqueueHuman).toHaveBeenCalledTimes(1)
  })

  it('removing a second chip with identical text does not clear the first pending sendId slot', () => {
    const paneId = 'pane-a'
    const secondChip = {
      id: 'chip-2',
      text: 'mismo texto',
      images: [],
      sourceSendId: 'send-second',
    }
    let planeSendByPane: Record<string, PlaneSend> = {
      [paneId]: { text: 'mismo texto', images: [], sendId: 'send-first' },
    }

    const shouldClear = shouldClearPlaneSendForRemovedQueuedTurn(
      secondChip,
      planeSendByPane[paneId]?.sendId,
    )
    expect(shouldClear).toBe(false)

    if (shouldClear) {
      const { [paneId]: _removed, ...freed } = planeSendByPane
      planeSendByPane = freed
    }

    expect(planeSendByPane[paneId]).toEqual({
      text: 'mismo texto',
      images: [],
      sendId: 'send-first',
    })
  })

  it('shows two visible chips synchronously while busy without waiting for plane status stream', async () => {
    const paneId = 'agent-1'
    const humanFifo = new Map<string, PlaneSend[]>()
    let visibleQueue: VisibleQueuedTurn[] = []
    const visibleQueuesByPane = new Map<string, VisibleQueuedTurn[]>([[paneId, visibleQueue]])
    const enqueueHuman = vi.fn(async (item: {
      text: string
      images: AgentCliImageAttachment[]
      sendId?: string
    }) => {
      const current = visibleQueuesByPane.get(paneId) ?? []
      const result = appendQueuedTurnIfRoom(
        current,
        {
          id: `q-${current.length}`,
          text: item.text,
          images: [],
          ...(item.sendId?.trim() ? { sourceSendId: item.sendId.trim() } : {}),
        },
        MAX_VISIBLE_QUEUED_TURNS,
      )
      if (result.outcome === 'enqueued') {
        visibleQueue = result.turns
        visibleQueuesByPane.set(paneId, visibleQueue)
      }
      return result.outcome
    })
    const controlsByPane = new Map<string, PlaneQueueControls>([[paneId, { enqueueHuman }]])
    const agentPlaneStatus: Record<string, VisibleQueueStatus> = {
      [paneId]: {
        busy: true,
        get queuedTurns() {
          return visibleQueue
        },
      },
    }

    const firstSendId = enqueueHumanPlaneSend(humanFifo, paneId, 'first')
    await promoteHumanSendSynchronously(
      humanFifo,
      paneId,
      firstSendId,
      agentPlaneStatus,
      controlsByPane,
    )
    const secondSendId = enqueueHumanPlaneSend(humanFifo, paneId, 'second')
    await promoteHumanSendSynchronously(
      humanFifo,
      paneId,
      secondSendId,
      agentPlaneStatus,
      controlsByPane,
    )

    expect(enqueueHuman).toHaveBeenCalledTimes(2)
    expect(visibleQueue.map(item => item.text)).toEqual(['first', 'second'])
    expect(humanFifo.has(paneId)).toBe(false)
  })

  it('merges three synchronously promoted chips into one with all sourceSendIds', async () => {
    const paneId = 'agent-1'
    const humanFifo = new Map<string, PlaneSend[]>()
    let visibleQueue: VisibleQueuedTurn[] = []
    const sendIds: string[] = []
    const visibleQueuesByPane = new Map<string, VisibleQueuedTurn[]>([[paneId, visibleQueue]])
    const enqueueHuman = vi.fn(async (item: {
      text: string
      images: AgentCliImageAttachment[]
      sendId?: string
    }) => {
      const current = visibleQueuesByPane.get(paneId) ?? []
      const result = appendQueuedTurnIfRoom(
        current,
        {
          id: `q-${current.length}`,
          text: item.text,
          images: [],
          ...(item.sendId?.trim() ? { sourceSendId: item.sendId.trim() } : {}),
        },
        MAX_VISIBLE_QUEUED_TURNS,
      )
      if (result.outcome === 'enqueued') {
        visibleQueue = result.turns
        visibleQueuesByPane.set(paneId, visibleQueue)
      }
      return result.outcome
    })
    const controlsByPane = new Map<string, PlaneQueueControls>([[paneId, { enqueueHuman }]])
    const agentPlaneStatus: Record<string, VisibleQueueStatus> = {
      [paneId]: {
        busy: true,
        get queuedTurns() {
          return visibleQueue
        },
      },
    }

    for (const text of ['one', 'two', 'three']) {
      const sendId = enqueueHumanPlaneSend(humanFifo, paneId, text)
      sendIds.push(sendId)
      await promoteHumanSendSynchronously(
        humanFifo,
        paneId,
        sendId,
        agentPlaneStatus,
        controlsByPane,
      )
    }

    const merged = mergeQueuedTurns(visibleQueue)
    expect(merged).toHaveLength(1)
    expect(merged[0]?.sourceSendIds).toEqual(sendIds)
    expect(merged[0]?.text).toBe('one\ntwo\nthree')
  })

  it('does not synchronously promote when idle and can start a human turn; fifo dispatches preferSend', async () => {
    const paneId = 'agent-1'
    const humanFifo = new Map<string, PlaneSend[]>()
    let visibleQueue: VisibleQueuedTurn[] = []
    const enqueueHuman = vi.fn(async () => 'enqueued' as AppendQueuedTurnOutcome)
    const controlsByPane = new Map<string, PlaneQueueControls>([[paneId, { enqueueHuman }]])
    const agentPlaneStatus: Record<string, VisibleQueueStatus> = {
      [paneId]: { busy: false, queuedTurns: visibleQueue },
    }

    const sendId = enqueueHumanPlaneSend(humanFifo, paneId, 'idle-send')
    const outcome = await promoteHumanSendSynchronously(
      humanFifo,
      paneId,
      sendId,
      agentPlaneStatus,
      controlsByPane,
    )

    expect(outcome).toBe('skipped')
    expect(enqueueHuman).not.toHaveBeenCalled()
    expect(visibleQueue).toHaveLength(0)

    let planeSendByPane: Record<string, PlaneSend> = {}
    planeSendByPane = await drainHumanSendFifo(
      humanFifo,
      planeSendByPane,
      agentPlaneStatus,
      controlsByPane,
    )
    expect(planeSendByPane[paneId]?.text).toBe('idle-send')
    expect(enqueueHuman).not.toHaveBeenCalled()
    expect(humanFifo.has(paneId)).toBe(false)
  })

  it('does not duplicate a chip when synchronous promotion receives duplicate for the same sendId', async () => {
    const paneId = 'agent-1'
    const humanFifo = new Map<string, PlaneSend[]>()
    const sendId = 'fixed-send-id'
    let visibleQueue: VisibleQueuedTurn[] = [
      { id: 'q-0', text: 'already', images: [], sourceSendId: sendId },
    ]
    const visibleQueuesByPane = new Map<string, VisibleQueuedTurn[]>([[paneId, visibleQueue]])
    const enqueueHuman = vi.fn(async (item: {
      text: string
      images: AgentCliImageAttachment[]
      sendId?: string
    }) => {
      const current = visibleQueuesByPane.get(paneId) ?? []
      const result = appendQueuedTurnIfRoom(
        current,
        {
          id: `q-${current.length}`,
          text: item.text,
          images: [],
          ...(item.sendId?.trim() ? { sourceSendId: item.sendId.trim() } : {}),
        },
        MAX_VISIBLE_QUEUED_TURNS,
      )
      return result.outcome
    })
    const controlsByPane = new Map<string, PlaneQueueControls>([[paneId, { enqueueHuman }]])
    const agentPlaneStatus: Record<string, VisibleQueueStatus> = {
      [paneId]: {
        busy: true,
        get queuedTurns() {
          return visibleQueue
        },
      },
    }

    enqueueHumanPlaneSend(humanFifo, paneId, 'retry', [], undefined, sendId)
    const outcome = await promoteHumanSendSynchronously(
      humanFifo,
      paneId,
      sendId,
      agentPlaneStatus,
      controlsByPane,
    )

    expect(outcome).toBe('duplicate')
    expect(enqueueHuman).toHaveBeenCalledTimes(1)
    expect(visibleQueue).toHaveLength(1)
    expect(humanFifo.has(paneId)).toBe(false)
  })

  it('promotes a busy send synchronously so the visible chip appears before the fifo drainer', async () => {
    const paneId = 'agent-1'
    const humanFifo = new Map<string, PlaneSend[]>()
    const followUp: PlaneSend = {
      text: 'orchestration follow-up',
      images: [],
      orchestrationFollowUp: true,
    }
    const planeSendByPane: Record<string, PlaneSend> = { [paneId]: followUp }
    let visibleQueue: VisibleQueuedTurn[] = []
    const visibleQueuesByPane = new Map<string, VisibleQueuedTurn[]>([[paneId, visibleQueue]])
    const enqueueHuman = vi.fn(async (item: {
      text: string
      images: AgentCliImageAttachment[]
      sendId?: string
      extraContextIds?: string[]
    }) => {
      const current = visibleQueuesByPane.get(paneId) ?? []
      const result = appendQueuedTurnIfRoom(
        current,
        {
          id: `q-${current.length}`,
          text: item.text,
          images: [],
          ...(item.sendId?.trim() ? { sourceSendId: item.sendId.trim() } : {}),
        },
        MAX_VISIBLE_QUEUED_TURNS,
      )
      if (result.outcome === 'enqueued') {
        visibleQueue = result.turns
        visibleQueuesByPane.set(paneId, visibleQueue)
      }
      return result.outcome
    })
    const controlsByPane = new Map<string, PlaneQueueControls>([[paneId, { enqueueHuman }]])
    const agentPlaneStatus: Record<string, VisibleQueueStatus> = {
      [paneId]: {
        busy: true,
        get queuedTurns() {
          return visibleQueue
        },
      },
    }

    const sendId = enqueueHumanPlaneSend(humanFifo, paneId, 'sync-visible')
    await promoteHumanSendSynchronously(
      humanFifo,
      paneId,
      sendId,
      agentPlaneStatus,
      controlsByPane,
    )

    expect(enqueueHuman).toHaveBeenCalledTimes(1)
    expect(visibleQueue.map(item => item.text)).toEqual(['sync-visible'])
    expect(humanFifo.has(paneId)).toBe(false)

    await drainHumanSendFifo(
      humanFifo,
      planeSendByPane,
      agentPlaneStatus,
      controlsByPane,
    )

    expect(enqueueHuman).toHaveBeenCalledTimes(1)
    expect(humanFifo.has(paneId)).toBe(false)
    expect(planeSendByPane[paneId]).toEqual(followUp)
  })

  it('leaves fifo entry when synchronous promotion returns full', async () => {
    const paneId = 'agent-1'
    const humanFifo = new Map<string, PlaneSend[]>()
    const followUp: PlaneSend = {
      text: 'orchestration follow-up',
      images: [],
      orchestrationFollowUp: true,
    }
    const planeSendByPane: Record<string, PlaneSend> = { [paneId]: followUp }
    let visibleQueue = makeFullVisibleQueue().slice(0, MAX_VISIBLE_QUEUED_TURNS - 1)
    const visibleQueuesByPane = new Map<string, VisibleQueuedTurn[]>([[paneId, visibleQueue]])
    const enqueueHuman = vi.fn(async () => 'full' as AppendQueuedTurnOutcome)
    const controlsByPane = new Map<string, PlaneQueueControls>([[paneId, { enqueueHuman }]])
    const agentPlaneStatus: Record<string, VisibleQueueStatus> = {
      [paneId]: {
        busy: true,
        get queuedTurns() {
          return visibleQueue
        },
      },
    }
    const inFlight = new Set<string>()

    const sendId = enqueueHumanPlaneSend(humanFifo, paneId, 'overflow-sync')
    await promoteHumanSendSynchronously(
      humanFifo,
      paneId,
      sendId,
      agentPlaneStatus,
      controlsByPane,
    )

    expect(enqueueHuman).toHaveBeenCalledTimes(1)
    expect(humanFifo.get(paneId)?.map(item => item.text)).toEqual(['overflow-sync'])

    visibleQueue = makeFullVisibleQueue()

    await drainHumanSendFifo(
      humanFifo,
      planeSendByPane,
      agentPlaneStatus,
      controlsByPane,
      inFlight,
    )

    expect(enqueueHuman).toHaveBeenCalledTimes(1)
    expect(humanFifo.get(paneId)?.map(item => item.text)).toEqual(['overflow-sync'])
  })
})
