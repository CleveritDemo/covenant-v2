import { describe, expect, it } from 'vitest'
import { onboardingStepsForPath } from '../onboardingSteps'

describe('onboardingStepsForPath', () => {
  it('engineer ve la secuencia completa con requisitos', () => {
    expect(onboardingStepsForPath('engineer', { clisMissing: false })).toEqual([
      'welcome',
      'account',
      'requirements',
      'folder',
      'team',
      'brainstorm',
      'firstMessage',
    ])
  })

  it('business sin CLIs faltantes omite requisitos', () => {
    expect(onboardingStepsForPath('business', { clisMissing: false })).toEqual([
      'welcome',
      'account',
      'folder',
      'team',
      'brainstorm',
      'firstMessage',
    ])
  })

  it('business con clisMissing inserta requisitos tras cuenta', () => {
    expect(onboardingStepsForPath('business', { clisMissing: true })).toEqual([
      'welcome',
      'account',
      'requirements',
      'folder',
      'team',
      'brainstorm',
      'firstMessage',
    ])
  })

  it('path vacío usa la secuencia de engineer', () => {
    expect(onboardingStepsForPath('', { clisMissing: false })).toEqual([
      'welcome',
      'account',
      'requirements',
      'folder',
      'team',
      'brainstorm',
      'firstMessage',
    ])
  })
})
