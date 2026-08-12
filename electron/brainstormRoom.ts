import { readFileSync, realpathSync } from 'node:fs'
import { resolve, sep } from 'node:path'
import type { BrowserWindow } from 'electron'
import type { AppConfig } from '../src/shared/configSchema'
import type { AgentCliStartRequest, AgentCliUiEvent } from '../src/shared/agentCliTypes'
import type { ProjectAgentDefinition } from '../src/shared/projectAgentCatalog'
import type { TabContext } from '../src/shared/tabContext'
import {
  advanceBrainstormCursor,
  appendBrainstormHumanMessage,
  buildBrainstormTurnPrompt,
  createBrainstormRoom,
  isBrainstormComplete,
  nextSpeakerAgentId,
  resolveBrainstormParticipantIds,
  sanitizeBrainstormMaxRounds,
  sanitizeBrainstormOutcome,
  sanitizeBrainstormWorkingSet,
  shouldSendWorkingSetBodies,
  stripBrainstormProtocolFences,
  type BrainstormEvent,
  type BrainstormMessage,
  type BrainstormRoom,
  type BrainstormWorkingSet,
} from '../src/shared/brainstormRoom'
import { IPC } from '../src/shared/ipcChannels'
import { listProjectAgents } from './projectAgentCatalogOps'
import { listBrainstormRooms, upsertBrainstormRoom } from './brainstormCatalogOps'
import { discoverTabContexts } from './tabContextBuild'
import { runAgentCliSpawn, stopAgentRun } from './agentCliRuntime'

/** Nota humana en cola, con destino opcional. */
interface PendingHumanMessage {
  text: string
  targetAgentId?: string
}

/** Tope por archivo del working set; los contextos van por su propio presupuesto. */
const BRAINSTORM_FILE_CHARS = 6_000

export type { BrainstormEvent }

export interface BrainstormStartConfig {
  roomId: string
  topic: string
  participantAgentIds: string[]
  maxRounds: number
  cwd: string
  /** Working set: ids de contextos del proyecto. */
  contextIds?: string[]
  /** Working set: rutas relativas al cwd. */
  filePaths?: string[]
  outcome?: string
  /** Reanudar desde estado persistido / snapshot (no resetea round/cursor/messages). */
  resume?: boolean
  round?: number
  cursor?: number
  messages?: BrainstormMessage[]
}

export interface BrainstormSpeakerTurnInput {
  paneId: string
  agent: ProjectAgentDefinition
  prompt: string
  cwd: string
  cliSessionId?: string
  /** Contextos del working set; el runtime ya sabe entregarlos (catálogo + need-sections). */
  contexts?: TabContext[]
  isStale: () => boolean
  onDelta: (text: string) => void
  onSession?: (cliSessionId: string) => void
}

export type BrainstormSpeakerTurnResult =
  | { ok: true; text: string }
  | { ok: false; aborted?: boolean; error?: string }

export type RunBrainstormSpeakerTurn = (
  input: BrainstormSpeakerTurnInput,
  config: AppConfig,
  home: string,
) => Promise<BrainstormSpeakerTurnResult>

interface RoomRunState {
  generation: number
  windowId: number
  room: BrainstormRoom
  cwd: string
  cliSessions: Map<string, string>
  activePaneId: string | null
  /** Mensajes humanos en cola hasta el próximo speaker_final (status running). */
  pendingHumanMessages: PendingHumanMessage[]
}

const roomRuns = new Map<string, RoomRunState>()
let nextRoomGeneration = 1

function emitBrainstorm(
  win: BrowserWindow,
  roomId: string,
  event: BrainstormEvent,
): void {
  if (!win.isDestroyed()) {
    win.webContents.send(IPC.BRAINSTORM_EVENT, roomId, event)
  }
}

function brainstormPaneId(roomId: string, agentId: string): string {
  return `brainstorm:${roomId}:${agentId}`
}

/** Ejecuta un turno single-shot vía `runAgentCliSpawn`. */
export function defaultRunBrainstormSpeakerTurn(
  input: BrainstormSpeakerTurnInput,
  config: AppConfig,
  home: string,
): Promise<BrainstormSpeakerTurnResult> {
  return new Promise(resolve => {
    if (input.isStale()) {
      resolve({ ok: false, aborted: true })
      return
    }

    let finalText = ''
    let lastError: string | undefined
    let settled = false

    const settle = (result: BrainstormSpeakerTurnResult): void => {
      if (settled) return
      settled = true
      resolve(result)
    }

    const request: AgentCliStartRequest = {
      paneId: input.paneId,
      provider: input.agent.provider,
      // Brainstorm: auto (no plan) — camino más corto; sin tools ni delegación.
      permissionMode: 'auto',
      prompt: input.prompt,
      cwd: input.cwd,
      name: input.agent.name,
      role: input.agent.role,
      objective: input.agent.objective,
      rules: input.agent.rules,
      model: input.agent.model,
      agentId: input.agent.id,
      cliSessionId: input.cliSessionId,
      coordination: 'none',
      allowDelegations: false,
      emitResults: false,
      autoImproveContexts: false,
      // La sala hereda skills y MCP del agente: sin esto el turno arranca sin
      // su `.mcp.json` acotado y sin el preámbulo, y el modelo dice que no
      // tiene Jira.
      nativeSkills: input.agent.nativeSkills,
      mcpsAllowed: input.agent.mcpsAllowed ?? [],
      contexts: input.contexts ?? [],
    }

    runAgentCliSpawn(request, config, home, {
      onEvent: (event: AgentCliUiEvent) => {
        if (input.isStale()) return
        if (event.type === 'session') {
          input.onSession?.(event.cliSessionId)
          return
        }
        if (event.type === 'assistant_delta') {
          input.onDelta(event.text)
          return
        }
        if (event.type === 'assistant_final') {
          finalText = event.text
          return
        }
        if (event.type === 'error') {
          lastError = event.message
        }
      },
      onDone: code => {
        if (input.isStale()) {
          settle({ ok: false, aborted: true })
          return
        }
        if (code !== 0 && !finalText.trim()) {
          settle({
            ok: false,
            error: lastError || `El CLI terminó con código ${code}.`,
          })
          return
        }
        settle({ ok: true, text: finalText })
      },
    })
  })
}

/** Contextos del proyecto que están en el working set, en el orden elegido. */
export function resolveWorkingSetContexts(cwd: string, contextIds: string[]): TabContext[] {
  if (!contextIds.length) return []
  const byId = new Map(discoverTabContexts(cwd).contexts.map(item => [item.id, item]))
  return contextIds
    .map(id => byId.get(id))
    .filter((item): item is TabContext => Boolean(item))
}

/** Lee los archivos del working set; descarta lo que caiga fuera del proyecto. */
export function readWorkingSetFiles(cwd: string, filePaths: string[]): string[] {
  if (!filePaths.length) return []
  let root: string
  try {
    root = realpathSync(resolve(cwd))
  } catch {
    return []
  }
  const blocks: string[] = []
  for (const rel of filePaths) {
    let target = resolve(root, rel)
    try {
      target = realpathSync(target)
    } catch {
      blocks.push(`### ${rel}\n(no existe)`)
      continue
    }
    if (target !== root && !target.startsWith(root + sep)) continue
    try {
      blocks.push(`### ${rel}\n${readFileSync(target, 'utf8').slice(0, BRAINSTORM_FILE_CHARS)}`)
    } catch {
      blocks.push(`### ${rel}\n(no se pudo leer)`)
    }
  }
  return blocks
}

export function brainstormWorkingSetLabels(
  contexts: TabContext[],
  filePaths: string[],
): string[] {
  return [
    ...contexts.map(context => `${context.kind} ${context.name}`),
    ...filePaths.map(path => `file ${path}`),
  ]
}

/**
 * Secuencia round-robin pura (inyectable para tests).
 * Emite eventos y muta `room` vía el estado del caller.
 */
export async function runBrainstormSequence(
  initial: BrainstormRoom,
  deps: {
    resolveAgent: (agentId: string) => ProjectAgentDefinition | null
    /** Working set del turno (labels + cuerpos según ronda). */
    buildWorkingSet?: (room: BrainstormRoom) => BrainstormWorkingSet
    /** Contextos del proyecto asignados a la sala (se relee por turno). */
    contextsFor?: (room: BrainstormRoom) => TabContext[]
    runSpeakerTurn: (
      input: Omit<BrainstormSpeakerTurnInput, 'isStale'> & { isStale: () => boolean },
    ) => Promise<BrainstormSpeakerTurnResult>
    emit: (event: BrainstormEvent) => void
    /** Tras speaker_final (mensaje) o cambio de status: sincroniza/persiste. */
    onRoomChange?: (room: BrainstormRoom) => void
    isStale: () => boolean
    roomId: string
    /** Drena y limpia la cola de voz humana pendiente (tras speaker_final / entre turnos). */
    drainPendingHumanMessages?: () => PendingHumanMessage[]
    /** Working set de la sala viva; puede haber crecido fuera de la secuencia. */
    readExternalWorkingSet?: () => { contextIds: string[]; filePaths: string[] } | null
  },
): Promise<BrainstormRoom> {
  let room: BrainstormRoom = {
    ...initial,
    status: 'running',
    messages: [...initial.messages],
  }

  const commit = (next: BrainstormRoom): void => {
    room = next
    deps.onRoomChange?.(room)
  }

  const flushPendingHumans = (): void => {
    const pending = deps.drainPendingHumanMessages?.() ?? []
    for (const item of pending) {
      const trimmed = item.text.trim()
      if (!trimmed) continue
      const already = room.messages.some(message => (
        (message.role === 'human' || message.agentId === 'human')
        && message.text === trimmed
        && message.round === room.round
      ))
      if (already) continue
      const next = appendBrainstormHumanMessage(room, trimmed, item.targetAgentId)
      if (!next) continue
      commit(next)
      // Emit solo si aún no se avisó al encolar (p. ej. tests sin inject).
      const msg = next.messages[next.messages.length - 1]!
      deps.emit({
        type: 'human_message',
        text: msg.text,
        round: msg.round,
      })
    }
  }

  commit(room)
  deps.emit({ type: 'status', status: 'running' })
  deps.emit({ type: 'round', round: room.round })

  while (!deps.isStale() && !isBrainstormComplete(room)) {
    flushPendingHumans()
    if (deps.isStale()) return room

    const agentId = nextSpeakerAgentId(room)
    if (!agentId) {
      deps.emit({ type: 'error', message: 'No hay orador disponible.' })
      commit({ ...room, status: 'stopped' })
      deps.emit({ type: 'status', status: 'stopped' })
      return room
    }

    const external = deps.readExternalWorkingSet?.()
    if (external) {
      const sameContexts = (room.contextIds ?? []).join('\u0000') === external.contextIds.join('\u0000')
      const samePaths = (room.filePaths ?? []).join('\u0000') === external.filePaths.join('\u0000')
      if (!sameContexts || !samePaths) {
        commit({ ...room, contextIds: external.contextIds, filePaths: external.filePaths })
      }
    }

    const agent = deps.resolveAgent(agentId)
    if (!agent) {
      deps.emit({
        type: 'error',
        agentId,
        message: `Agente no encontrado en el catálogo: ${agentId}`,
      })
      commit({ ...room, status: 'stopped' })
      deps.emit({ type: 'status', status: 'stopped' })
      return room
    }

    const agentName = agent.name?.trim() || agent.id
    const speakRound = room.round
    const paneId = brainstormPaneId(deps.roomId, agent.id)
    const prompt = buildBrainstormTurnPrompt(
      room,
      agent.id,
      agentName,
      agent.role,
      deps.buildWorkingSet?.(room),
    )

    deps.emit({ type: 'speaker_start', agentId: agent.id, round: speakRound })

    const result = await deps.runSpeakerTurn({
      paneId,
      agent,
      prompt,
      cwd: '',
      contexts: deps.contextsFor?.(room),
      onDelta: text => {
        if (deps.isStale()) return
        deps.emit({
          type: 'speaker_delta',
          agentId: agent.id,
          round: speakRound,
          text,
        })
      },
      isStale: deps.isStale,
    })

    if (deps.isStale()) {
      // pause/stop ya fijaron status + emit; no sobrescribir con stopped.
      return room
    }

    if (!result.ok) {
      if (result.aborted) {
        if (deps.isStale()) return room
        commit({ ...room, status: 'stopped' })
        deps.emit({ type: 'status', status: 'stopped' })
        return room
      }
      deps.emit({
        type: 'error',
        agentId: agent.id,
        message: result.error || 'Turno de brainstorm fallido.',
      })
      commit({ ...room, status: 'stopped' })
      deps.emit({ type: 'status', status: 'stopped' })
      return room
    }

    const text = stripBrainstormProtocolFences(result.text.trim())
    const withMessage: BrainstormRoom = {
      ...room,
      messages: [
        ...room.messages,
        {
          agentId: agent.id,
          agentName,
          round: speakRound,
          text,
        },
      ],
    }
    commit(withMessage)
    deps.emit({
      type: 'speaker_final',
      agentId: agent.id,
      agentName,
      round: speakRound,
      text,
    })

    flushPendingHumans()
    if (deps.isStale()) return room

    const prevRound = room.round
    commit(advanceBrainstormCursor(room))
    if (room.round !== prevRound) {
      deps.emit({ type: 'round', round: room.round })
    }
  }

  if (deps.isStale()) {
    return room
  }

  commit({ ...room, status: 'done' })
  deps.emit({ type: 'status', status: 'done' })
  return room
}

function invalidateBrainstormGeneration(run: RoomRunState): void {
  run.generation = nextRoomGeneration++
  if (run.activePaneId) {
    stopAgentRun(run.activePaneId)
    run.activePaneId = null
  }
}

function briefFromConfig(config: BrainstormStartConfig): {
  contextIds: string[]
  filePaths: string[]
  outcome: BrainstormRoom['outcome']
} {
  return {
    contextIds: sanitizeBrainstormWorkingSet(config.contextIds),
    filePaths: sanitizeBrainstormWorkingSet(config.filePaths),
    outcome: sanitizeBrainstormOutcome(config.outcome),
  }
}

function resolveResumeRoom(
  config: BrainstormStartConfig,
  cwd: string,
  topic: string,
  participants: string[],
  maxRounds: number,
): BrainstormRoom | null {
  const roomId = config.roomId.trim()
  const fromDisk = listBrainstormRooms(cwd).find(item => item.id === roomId)
  const fromMemory = roomRuns.get(roomId)?.room
  const base = fromDisk ?? fromMemory
  const brief = briefFromConfig(config)
  if (base) {
    return {
      ...base,
      id: roomId,
      topic: topic || base.topic,
      contextIds: config.contextIds ? brief.contextIds : base.contextIds,
      filePaths: config.filePaths ? brief.filePaths : base.filePaths,
      outcome: config.outcome ? brief.outcome : base.outcome,
      participantAgentIds: participants.length >= 2 ? participants : base.participantAgentIds,
      maxRounds: sanitizeBrainstormMaxRounds(config.maxRounds ?? base.maxRounds),
      round: typeof config.round === 'number' ? Math.max(0, Math.floor(config.round)) : base.round,
      cursor: typeof config.cursor === 'number' ? Math.max(0, Math.floor(config.cursor)) : base.cursor,
      messages: Array.isArray(config.messages) ? config.messages : base.messages,
    }
  }
  if (
    typeof config.round !== 'number'
    && typeof config.cursor !== 'number'
    && !Array.isArray(config.messages)
  ) {
    return null
  }
  const template = createBrainstormRoom(topic, participants, maxRounds, brief)
  if (!template) return null
  return {
    ...template,
    id: roomId,
    round: typeof config.round === 'number' ? Math.max(0, Math.floor(config.round)) : 0,
    cursor: typeof config.cursor === 'number' ? Math.max(0, Math.floor(config.cursor)) : 0,
    messages: Array.isArray(config.messages) ? [...config.messages] : [],
  }
}

export function startBrainstormRoom(
  win: BrowserWindow,
  config: BrainstormStartConfig,
  appConfig: AppConfig,
  home: string,
  options?: {
    listAgents?: (cwd: string) => ProjectAgentDefinition[]
    runSpeakerTurn?: RunBrainstormSpeakerTurn
  },
): { ok: true } | { ok: false; error: string } {
  const topic = typeof config.topic === 'string' ? config.topic.trim() : ''
  const cwd = typeof config.cwd === 'string' ? config.cwd.trim() : ''
  const roomId = typeof config.roomId === 'string' ? config.roomId.trim() : ''
  if (!roomId) return { ok: false, error: 'roomId inválido' }
  if (!topic) return { ok: false, error: 'topic vacío' }
  if (!cwd) return { ok: false, error: 'cwd inválido' }

  const listAgents = options?.listAgents ?? listProjectAgents
  const agents = listAgents(cwd)
  const byId = new Map(agents.map(agent => [agent.id, agent]))
  const rawParticipants = (Array.isArray(config.participantAgentIds) ? config.participantAgentIds : [])
    .map(id => (typeof id === 'string' ? id.trim() : ''))
    .filter(Boolean)

  const { resolvedIds: unique, orphanIds } = resolveBrainstormParticipantIds(
    rawParticipants,
    agents,
  )
  if (unique.length < 2) {
    if (orphanIds.length) {
      return {
        ok: false,
        error: `Participantes no están en el catálogo: ${orphanIds.join(', ')}`,
      }
    }
    return { ok: false, error: 'Se requieren al menos 2 participantes' }
  }

  const maxRounds = sanitizeBrainstormMaxRounds(config.maxRounds)
  const resume = config.resume === true
  let room: BrainstormRoom
  if (resume) {
    const resumed = resolveResumeRoom(config, cwd, topic, unique, maxRounds)
    if (!resumed) return { ok: false, error: 'No se pudo reanudar la sala' }
    const resumedResolved = resolveBrainstormParticipantIds(
      resumed.participantAgentIds,
      agents,
    )
    if (resumedResolved.resolvedIds.length < 2) {
      if (resumedResolved.orphanIds.length) {
        return {
          ok: false,
          error: `Participantes no están en el catálogo: ${resumedResolved.orphanIds.join(', ')}`,
        }
      }
      return { ok: false, error: 'Se requieren al menos 2 participantes' }
    }
    room = {
      ...resumed,
      participantAgentIds: resumedResolved.resolvedIds,
    }
    const existing = roomRuns.get(roomId)
    if (existing) invalidateBrainstormGeneration(existing)
  } else {
    const template = createBrainstormRoom(topic, unique, maxRounds, briefFromConfig(config))
    if (!template) return { ok: false, error: 'No se pudo crear la sala' }
    room = { ...template, id: roomId }
    stopBrainstormRoom(roomId)
  }

  const previous = resume ? roomRuns.get(roomId) : undefined
  const previousSessions = previous?.cliSessions
  const previousPending = previous?.pendingHumanMessages ?? []
  const generation = nextRoomGeneration++
  const state: RoomRunState = {
    generation,
    windowId: win.id,
    room,
    cwd,
    cliSessions: previousSessions ? new Map(previousSessions) : new Map(),
    activePaneId: null,
    pendingHumanMessages: [...previousPending],
  }
  roomRuns.set(roomId, state)

  const isStale = (): boolean => roomRuns.get(roomId)?.generation !== generation
  const runSpeakerTurn = options?.runSpeakerTurn ?? defaultRunBrainstormSpeakerTurn

  void (async () => {
    const persistRoom = (next: BrainstormRoom): void => {
      const run = roomRuns.get(roomId)
      if (!run || run.generation !== generation) return
      run.room = next
      upsertBrainstormRoom(run.cwd, next)
    }

    // Recalcular por ronda: el working set puede crecer a mitad de sala.
    let cachedKey = ''
    let cachedContexts: TabContext[] = []
    const contextsFor = (current: BrainstormRoom): TabContext[] => {
      const ids = current.contextIds ?? []
      const key = ids.join('\u0000')
      if (key !== cachedKey) {
        cachedKey = key
        cachedContexts = resolveWorkingSetContexts(cwd, ids)
      }
      return cachedContexts
    }

    const finalRoom = await runBrainstormSequence(room, {
      roomId,
      isStale,
      resolveAgent: id => byId.get(id) ?? null,
      contextsFor,
      buildWorkingSet: current => ({
        labels: brainstormWorkingSetLabels(contextsFor(current), current.filePaths ?? []),
        // Cuerpos solo en la ronda 1; después el transcript ya carga el turno.
        fileBlocks: shouldSendWorkingSetBodies(current)
          ? readWorkingSetFiles(cwd, current.filePaths ?? [])
          : undefined,
      }),
      emit: event => emitBrainstorm(win, roomId, event),
      onRoomChange: persistRoom,
      readExternalWorkingSet: () => {
        const run = roomRuns.get(roomId)
        if (!run || run.generation !== generation) return null
        return {
          contextIds: run.room.contextIds ?? [],
          filePaths: run.room.filePaths ?? [],
        }
      },
      drainPendingHumanMessages: () => {
        const run = roomRuns.get(roomId)
        if (!run || run.generation !== generation) return []
        return run.pendingHumanMessages.splice(0)
      },
      runSpeakerTurn: async input => {
        if (isStale()) return { ok: false, aborted: true }
        const paneId = input.paneId
        const current = roomRuns.get(roomId)
        if (!current || current.generation !== generation) {
          return { ok: false, aborted: true }
        }
        current.activePaneId = paneId
        const result = await runSpeakerTurn(
          {
            ...input,
            cwd,
            cliSessionId: current.cliSessions.get(input.agent.id),
            onSession: cliSessionId => {
              const run = roomRuns.get(roomId)
              if (run?.generation === generation) {
                run.cliSessions.set(input.agent.id, cliSessionId)
              }
            },
            isStale,
          },
          appConfig,
          home,
        )
        const run = roomRuns.get(roomId)
        if (run?.generation === generation && run.activePaneId === paneId) {
          run.activePaneId = null
        }
        return result
      },
    })

    const run = roomRuns.get(roomId)
    if (run?.generation === generation) {
      run.room = finalRoom
      if (finalRoom.status === 'done' || finalRoom.status === 'stopped') {
        roomRuns.delete(roomId)
      }
    }
  })()

  return { ok: true }
}

function commitPendingHumansToRoom(
  run: RoomRunState,
  roomId: string,
  win?: BrowserWindow,
): void {
  if (!run.pendingHumanMessages.length) return
  const pending = run.pendingHumanMessages.splice(0)
  let room = run.room
  for (const item of pending) {
    const next = appendBrainstormHumanMessage(room, item.text, item.targetAgentId)
    if (!next) continue
    room = next
    const msg = next.messages[next.messages.length - 1]!
    if (win) {
      emitBrainstorm(win, roomId, {
        type: 'human_message',
        text: msg.text,
        round: msg.round,
      })
    }
  }
  run.room = room
  upsertBrainstormRoom(run.cwd, room)
}

export function pauseBrainstormRoom(
  roomId: string,
  options?: { win?: BrowserWindow; notify?: boolean },
): void {
  const id = typeof roomId === 'string' ? roomId.trim() : ''
  if (!id) return
  const run = roomRuns.get(id)
  if (!run) return
  if (run.room.status !== 'running' && run.room.status !== 'idle') return

  commitPendingHumansToRoom(run, id, options?.win)
  const pausedRoom: BrainstormRoom = { ...run.room, status: 'paused' }
  run.room = pausedRoom
  upsertBrainstormRoom(run.cwd, pausedRoom)
  invalidateBrainstormGeneration(run)
  if (options?.notify && options.win) {
    emitBrainstorm(options.win, id, { type: 'status', status: 'paused' })
  }
}

/**
 * Inyecta voz humana en el transcript.
 * - `running`: encola hasta el próximo `speaker_final`, luego continúa.
 * - `paused`: persiste ya y espera resume.
 */
export function injectBrainstormHumanMessage(
  roomId: string,
  text: string,
  options?: { win?: BrowserWindow; targetAgentId?: string },
): { ok: true } | { ok: false; error: string } {
  const id = typeof roomId === 'string' ? roomId.trim() : ''
  const trimmed = typeof text === 'string' ? text.trim() : ''
  if (!id) return { ok: false, error: 'roomId inválido' }
  if (!trimmed) return { ok: false, error: 'mensaje vacío' }

  const run = roomRuns.get(id)
  if (!run) return { ok: false, error: 'sala no activa' }

  const target = typeof options?.targetAgentId === 'string'
    ? options.targetAgentId.trim()
    : ''
  const targetAgentId = target && run.room.participantAgentIds.includes(target)
    ? target
    : undefined

  if (run.room.status === 'paused') {
    const next = appendBrainstormHumanMessage(run.room, trimmed, targetAgentId)
    if (!next) return { ok: false, error: 'mensaje vacío' }
    run.room = next
    upsertBrainstormRoom(run.cwd, next)
    const msg = next.messages[next.messages.length - 1]!
    if (options?.win) {
      emitBrainstorm(options.win, id, {
        type: 'human_message',
        text: msg.text,
        round: msg.round,
        ...(msg.targetAgentId ? { targetAgentId: msg.targetAgentId } : {}),
      })
    }
    return { ok: true }
  }

  if (run.room.status === 'running' || run.room.status === 'idle') {
    run.pendingHumanMessages.push({ text: trimmed, ...(targetAgentId ? { targetAgentId } : {}) })
    // Preview live; el transcript se confirma tras speaker_final (reduce dedupea re-emit).
    if (options?.win) {
      emitBrainstorm(options.win, id, {
        type: 'human_message',
        text: trimmed,
        round: run.room.round,
        ...(targetAgentId ? { targetAgentId } : {}),
      })
    }
    return { ok: true }
  }

  return { ok: false, error: `no se puede inyectar en status ${run.room.status}` }
}

/**
 * Añade contextos/archivos al working set de una sala activa. La ronda en curso
 * ya está pedida: entra en el próximo turno.
 */
export function addBrainstormWorkingSet(
  roomId: string,
  working: { contextIds?: unknown; filePaths?: unknown; cwd?: unknown },
): { ok: true; contextIds: string[]; filePaths: string[] } | { ok: false; error: string } {
  const id = typeof roomId === 'string' ? roomId.trim() : ''
  if (!id) return { ok: false, error: 'roomId inválido' }

  // Sala viva: entra en el próximo turno. Sala en disco (pausada, sin corrida):
  // se edita el JSON, que es lo que leerá el resume.
  const run = roomRuns.get(id)
  const cwd = run?.cwd ?? (typeof working.cwd === 'string' ? working.cwd.trim() : '')
  if (!cwd) return { ok: false, error: 'cwd inválido' }
  const base = run?.room ?? listBrainstormRooms(cwd).find(item => item.id === id)
  if (!base) return { ok: false, error: 'sala no encontrada' }

  const contextIds = sanitizeBrainstormWorkingSet([
    ...(base.contextIds ?? []),
    ...sanitizeBrainstormWorkingSet(working.contextIds),
  ])
  const filePaths = sanitizeBrainstormWorkingSet([
    ...(base.filePaths ?? []),
    ...sanitizeBrainstormWorkingSet(working.filePaths),
  ])
  const next: BrainstormRoom = { ...base, contextIds, filePaths }
  if (run) run.room = next
  const written = upsertBrainstormRoom(cwd, next)
  if (!written.ok) return { ok: false, error: written.error }
  return { ok: true, contextIds, filePaths }
}

export function stopBrainstormRoom(
  roomId: string,
  options?: { win?: BrowserWindow; notify?: boolean },
): void {
  const id = typeof roomId === 'string' ? roomId.trim() : ''
  if (!id) return
  const run = roomRuns.get(id)
  if (!run) return
  commitPendingHumansToRoom(run, id, options?.win)
  const stoppedRoom: BrainstormRoom = { ...run.room, status: 'stopped' }
  run.room = stoppedRoom
  upsertBrainstormRoom(run.cwd, stoppedRoom)
  invalidateBrainstormGeneration(run)
  roomRuns.delete(id)
  if (options?.notify && options.win) {
    emitBrainstorm(options.win, id, { type: 'status', status: 'stopped' })
  }
}

export function stopBrainstormRoomsForWindow(windowId: number): void {
  for (const [roomId, run] of [...roomRuns.entries()]) {
    if (run.windowId === windowId) stopBrainstormRoom(roomId)
  }
}

export function stopAllBrainstormRooms(): void {
  for (const roomId of [...roomRuns.keys()]) {
    stopBrainstormRoom(roomId)
  }
}

export function isBrainstormRoomActive(roomId: string): boolean {
  return roomRuns.has(roomId)
}

/** Solo tests: limpia el mapa de salas. */
export function clearBrainstormRoomsForTests(): void {
  stopAllBrainstormRooms()
}
