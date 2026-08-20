import { describe, expect, it } from 'vitest'
import { resolveComposerSendBlock } from '../onboardingFlow'

describe('resolveComposerSendBlock', () => {
  it('returns none when onboarding is complete', () => {
    expect(
      resolveComposerSendBlock({
        incomplete: false,
        path: 'engineer',
        cliAllMissing: true,
        engineMissing: true,
      }),
    ).toBe('none')
  })

  it('returns none when path is empty', () => {
    expect(
      resolveComposerSendBlock({
        incomplete: true,
        path: '',
        cliAllMissing: false,
        engineMissing: false,
      }),
    ).toBe('none')
  })

  it('returns none for business path even when engine is missing', () => {
    expect(
      resolveComposerSendBlock({
        incomplete: true,
        path: 'business',
        cliAllMissing: false,
        engineMissing: true,
      }),
    ).toBe('none')
  })

  it('returns cli when engineer track and all CLIs are missing', () => {
    expect(
      resolveComposerSendBlock({
        incomplete: true,
        path: 'engineer',
        cliAllMissing: true,
        engineMissing: false,
      }),
    ).toBe('cli')
  })

  it('returns engine when engineer track and engine is missing', () => {
    expect(
      resolveComposerSendBlock({
        incomplete: true,
        path: 'engineer',
        cliAllMissing: false,
        engineMissing: true,
      }),
    ).toBe('engine')
  })

  it('returns cli when both cli and engine are missing', () => {
    expect(
      resolveComposerSendBlock({
        incomplete: true,
        path: 'engineer',
        cliAllMissing: true,
        engineMissing: true,
      }),
    ).toBe('cli')
  })

  it('returns none when engineer track has cli and engine', () => {
    expect(
      resolveComposerSendBlock({
        incomplete: true,
        path: 'engineer',
        cliAllMissing: false,
        engineMissing: false,
      }),
    ).toBe('none')
  })
})
