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
  it('a) business+folder+agents+!cliAllMissing+view null+!already → true', () => {
    expect(shouldAutoOpenCeremonyOverlay(openBase)).toBe(true)
  })

  it('b) alreadyAutoOpened → false', () => {
    expect(shouldAutoOpenCeremonyOverlay({ ...openBase, alreadyAutoOpened: true })).toBe(false)
  })

  it('c) view setup → false', () => {
    expect(shouldAutoOpenCeremonyOverlay({ ...openBase, brainstormView: 'setup' })).toBe(false)
  })

  it('d) view rooms → false', () => {
    expect(shouldAutoOpenCeremonyOverlay({ ...openBase, brainstormView: 'rooms' })).toBe(false)
  })

  it('e) brainstormRoomLive → false', () => {
    expect(shouldAutoOpenCeremonyOverlay({ ...openBase, brainstormRoomLive: true })).toBe(false)
  })

  it('f) cliAllMissing → false', () => {
    expect(shouldAutoOpenCeremonyOverlay({ ...openBase, cliAllMissing: true })).toBe(false)
  })

  it('g) path engineer → false', () => {
    expect(shouldAutoOpenCeremonyOverlay({ ...openBase, path: 'engineer' })).toBe(false)
  })

  it('h) hasAgents false → false', () => {
    expect(shouldAutoOpenCeremonyOverlay({ ...openBase, hasAgents: false })).toBe(false)
  })

  it('i) incomplete false → false', () => {
    expect(shouldAutoOpenCeremonyOverlay({ ...openBase, incomplete: false })).toBe(false)
  })

  it('j) clisProbed false → false (espera sonda)', () => {
    expect(shouldAutoOpenCeremonyOverlay({ ...openBase, clisProbed: false })).toBe(false)
  })

  it('k) clisProbed true + filas vacías (cliAllMissing false) → true', () => {
    expect(shouldAutoOpenCeremonyOverlay({
      ...openBase,
      clisProbed: true,
      cliAllMissing: false,
    })).toBe(true)
  })
})
