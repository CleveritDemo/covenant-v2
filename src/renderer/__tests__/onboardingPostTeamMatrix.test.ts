import { describe, expect, it } from 'vitest'
import { resolveOnboardingGuideStep } from '@shared/onboardingGuideFlow'
import {
  buildGuideResolveArgs,
  shouldCompleteByGuideExhausted,
  type OnboardingGuideTabSnapshot,
} from '../onboardingAppWiring'

type SnapshotOverrides = Partial<
  Pick<
    OnboardingGuideTabSnapshot,
    'brainstormView'
    | 'brainstormDraft'
    | 'brainstormRooms'
    | 'liveRoomIds'
    | 'paneKinds'
    | 'doneSteps'
  >
>

const SEVEN_AGENTS: Record<string, 'agent'> = {
  a1: 'agent',
  a2: 'agent',
  a3: 'agent',
  a4: 'agent',
  a5: 'agent',
  a6: 'agent',
  a7: 'agent',
}

/** Snapshot base: Planear justo después de crear el equipo (7 agentes). */
function postTeamSnapshot(overrides: SnapshotOverrides = {}): OnboardingGuideTabSnapshot {
  return {
    incomplete: true,
    path: 'business',
    projectFolder: '/repo',
    paneKinds: overrides.paneKinds ?? SEVEN_AGENTS,
    planeOpenChatAgentId: null,
    brainstormView: overrides.brainstormView ?? null,
    brainstormDraft: overrides.brainstormDraft,
    brainstormRooms: overrides.brainstormRooms,
    liveRoomIds: overrides.liveRoomIds,
    sentFirstMessage: false,
    assignedAnyContext: false,
    doneSteps: overrides.doneSteps ?? [],
  }
}

function resolvePostTeam(overrides: SnapshotOverrides = {}) {
  return resolveOnboardingGuideStep(buildGuideResolveArgs(postTeamSnapshot(overrides)))
}

describe('onboarding post-team matrix (Planear, App snapshot)', () => {
  it("1) brainstormView null sin salas → open_brainstorm / brainstorm-rail", () => {
    const step = resolvePostTeam({ brainstormView: null })
    expect(step?.step).toBe('open_brainstorm')
    expect(step?.anchor).toBe('brainstorm-rail')
    expect(step?.dismissible).toBeFalsy()
  })

  it("2) setup sin goal → write_goal / brainstorm-goal", () => {
    const step = resolvePostTeam({
      brainstormView: 'setup',
      brainstormDraft: { goalFilled: false, participantCount: 0 },
    })
    expect(step?.step).toBe('write_goal')
    expect(step?.anchor).toBe('brainstorm-goal')
  })

  it("3) setup con goal sin participantes → pick_participants / brainstorm-participants", () => {
    const step = resolvePostTeam({
      brainstormView: 'setup',
      brainstormDraft: { goalFilled: true, participantCount: 0 },
      doneSteps: ['write_goal'],
    })
    expect(step?.step).toBe('pick_participants')
    expect(step?.anchor).toBe('brainstorm-participants')
  })

  it("4) setup listo → start_ceremony / brainstorm-start", () => {
    const step = resolvePostTeam({
      brainstormView: 'setup',
      brainstormDraft: { goalFilled: true, participantCount: 2, ceremonyPicked: true },
      doneSteps: ['write_goal'],
    })
    expect(step?.step).toBe('start_ceremony')
    expect(step?.anchor).toBe('brainstorm-start')
  })

  it("5) rooms sin salas vivas → open_brainstorm / brainstorm-module-tabs", () => {
    const step = resolvePostTeam({ brainstormView: 'rooms' })
    expect(step?.step).toBe('open_brainstorm')
    expect(step?.anchor).toBe('brainstorm-module-tabs')
  })

  it("6) sin agentes (solo terminal) → create_team / create-team", () => {
    const step = resolvePostTeam({
      brainstormView: null,
      paneKinds: { t1: 'terminal' },
    })
    expect(step?.step).toBe('create_team')
    expect(step?.anchor).toBe('create-team')
  })

  it("7) siete agentes + terminal extra → open_brainstorm / brainstorm-rail", () => {
    const step = resolvePostTeam({
      brainstormView: null,
      paneKinds: { ...SEVEN_AGENTS, t1: 'terminal' },
    })
    expect(step?.step).toBe('open_brainstorm')
    expect(step?.anchor).toBe('brainstorm-rail')
  })

  it('8) shouldCompleteByGuideExhausted con snapshot (1) → false (cliAllMissing false|true)', () => {
    // Con equipo y sin brainstorm abierto la guía nunca está agotada.
    const resolveArgs = buildGuideResolveArgs(postTeamSnapshot({ brainstormView: null }))
    expect(shouldCompleteByGuideExhausted({ resolveArgs, cliAllMissing: false })).toBe(false)
    expect(shouldCompleteByGuideExhausted({ resolveArgs, cliAllMissing: true })).toBe(false)
  })

  it('9) shouldCompleteByGuideExhausted con snapshot (6) → false', () => {
    const resolveArgs = buildGuideResolveArgs(
      postTeamSnapshot({ brainstormView: null, paneKinds: { t1: 'terminal' } }),
    )
    expect(shouldCompleteByGuideExhausted({ resolveArgs, cliAllMissing: false })).toBe(false)
  })
})
