import { describe, expect, it } from 'vitest'
import { shouldAutoOpenCeremonyOverlay } from '../onboardingAppWiring'

const openBase = {
  incomplete: true as const,
  path: 'business' as const,
  hasFolder: true,
  hasAgents: true,
  cliAllMissing: false,
  brainstormView: null as string | null,
  brainstormRoomLive: false,
  alreadyAutoOpened: false,
  clisProbed: true,
}

describe('shouldAutoOpenCeremonyOverlay', () => {
  it('never auto-opens: Planear uses open_brainstorm coach on the rail', () => {
    expect(shouldAutoOpenCeremonyOverlay(openBase)).toBe(false)
  })

  it('alreadyAutoOpened → false', () => {
    expect(shouldAutoOpenCeremonyOverlay({ ...openBase, alreadyAutoOpened: true })).toBe(false)
  })

  it('view setup → false', () => {
    expect(shouldAutoOpenCeremonyOverlay({ ...openBase, brainstormView: 'setup' })).toBe(false)
  })

  it('clisProbed false → false', () => {
    expect(shouldAutoOpenCeremonyOverlay({ ...openBase, clisProbed: false })).toBe(false)
  })

  it('path engineer → false', () => {
    expect(shouldAutoOpenCeremonyOverlay({ ...openBase, path: 'engineer' })).toBe(false)
  })
})
