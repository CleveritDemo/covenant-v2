import { describe, expect, it } from 'vitest'
import { isOnboardingActive, onboardingLockedSurface } from '../onboardingFlow'

const businessReady = {
  incomplete: true,
  path: 'business' as const,
  hasFolder: true,
  hasAgents: true,
  cliAllMissing: false,
}

describe('onboardingAutoOpenGate', () => {
  it('nunca abre la ceremonia sola: la enseña el coach open_brainstorm', () => {
    expect(onboardingLockedSurface(businessReady).autoOpenCeremonyOverlay).toBe(false)
  })

  it('does not open when all CLIs are missing', () => {
    expect(
      onboardingLockedSurface({ ...businessReady, cliAllMissing: true })
        .autoOpenCeremonyOverlay,
    ).toBe(false)
  })

  it('does not open on engineer path', () => {
    expect(
      onboardingLockedSurface({ ...businessReady, path: 'engineer' })
        .autoOpenCeremonyOverlay,
    ).toBe(false)
  })

  it('does not open without agents', () => {
    expect(
      onboardingLockedSurface({ ...businessReady, hasAgents: false })
        .autoOpenCeremonyOverlay,
    ).toBe(false)
  })

  it('never opens when complete, and showComposer mirrors hasAgents', () => {
    const withAgents = onboardingLockedSurface({
      ...businessReady,
      incomplete: false,
      hasAgents: true,
    })
    expect(withAgents.autoOpenCeremonyOverlay).toBe(false)
    expect(withAgents.showComposer).toBe(true)

    const withoutAgents = onboardingLockedSurface({
      ...businessReady,
      incomplete: false,
      hasAgents: false,
    })
    expect(withoutAgents.autoOpenCeremonyOverlay).toBe(false)
    expect(withoutAgents.showComposer).toBe(false)
  })

  it('tampoco abre sin carpeta (el gate no depende de la carpeta)', () => {
    // hasFolder only drives showFolderCta/showTeamFab; autoOpenCeremonyOverlay does not read it.
    expect(
      onboardingLockedSurface({ ...businessReady, hasFolder: false })
        .autoOpenCeremonyOverlay,
    ).toBe(false)
  })

  it('composition trap: isOnboardingActive false with agent panes kills the gate', () => {
    const active = isOnboardingActive({
      incomplete: true,
      tabs: [{ paneKinds: { p1: 'agent' } }],
    })
    expect(active).toBe(false)
    // por eso el auto-open no puede derivarse de un surface alimentado con isOnboardingActive.
    expect(
      onboardingLockedSurface({
        incomplete: active,
        path: 'business',
        hasFolder: true,
        hasAgents: true,
        cliAllMissing: false,
      }).autoOpenCeremonyOverlay,
    ).toBe(false)
  })

  it('composition trap: terminal panes also force isOnboardingActive false', () => {
    const active = isOnboardingActive({
      incomplete: true,
      tabs: [{ paneKinds: { p1: 'terminal' } }],
    })
    expect(active).toBe(false)
    // por eso el auto-open no puede derivarse de un surface alimentado con isOnboardingActive.
    expect(
      onboardingLockedSurface({
        incomplete: active,
        path: 'business',
        hasFolder: true,
        hasAgents: true,
        cliAllMissing: false,
      }).autoOpenCeremonyOverlay,
    ).toBe(false)
  })
})
