import { describe, expect, it } from 'vitest'
import { ONBOARDING_VERSION } from '../onboarding'
import {
  canCompleteOnboarding,
  isOnboardingIncomplete,
  onboardingChromeHidden,
  onboardingLockedSurface,
  shouldWarnComposerMissingCli,
} from '../onboardingFlow'

describe('isOnboardingIncomplete', () => {
  it('is true when completed version differs from ONBOARDING_VERSION', () => {
    expect(isOnboardingIncomplete('')).toBe(true)
    expect(isOnboardingIncomplete('1')).toBe(true)
    expect(isOnboardingIncomplete('2')).toBe(true)
    expect(isOnboardingIncomplete(ONBOARDING_VERSION)).toBe(false)
    expect(isOnboardingIncomplete(`  ${ONBOARDING_VERSION}  `)).toBe(false)
  })
})

describe('canCompleteOnboarding', () => {
  it('returns false when onboarding is already complete', () => {
    expect(
      canCompleteOnboarding({
        incomplete: false,
        path: 'engineer',
        trigger: 'engineer_human_send',
        cliAllMissing: false,
      }),
    ).toBe(false)
  })

  it('org_workspace_tab completes even when path is empty', () => {
    expect(
      canCompleteOnboarding({
        incomplete: true,
        path: '',
        trigger: 'org_workspace_tab',
        cliAllMissing: true,
      }),
    ).toBe(true)
  })

  it('engineer_human_send requires engineer path and at least one CLI', () => {
    expect(
      canCompleteOnboarding({
        incomplete: true,
        path: 'engineer',
        trigger: 'engineer_human_send',
        cliAllMissing: true,
      }),
    ).toBe(false)
    expect(
      canCompleteOnboarding({
        incomplete: true,
        path: 'engineer',
        trigger: 'engineer_human_send',
        cliAllMissing: false,
      }),
    ).toBe(true)
    expect(
      canCompleteOnboarding({
        incomplete: true,
        path: 'business',
        trigger: 'engineer_human_send',
        cliAllMissing: false,
      }),
    ).toBe(false)
  })

  it('business_ceremony completes only on business path', () => {
    expect(
      canCompleteOnboarding({
        incomplete: true,
        path: 'business',
        trigger: 'business_ceremony',
        cliAllMissing: true,
      }),
    ).toBe(true)
    expect(
      canCompleteOnboarding({
        incomplete: true,
        path: 'engineer',
        trigger: 'business_ceremony',
        cliAllMissing: false,
      }),
    ).toBe(false)
  })
})

describe('onboardingChromeHidden', () => {
  it('hides all chrome while onboarding is incomplete', () => {
    expect(onboardingChromeHidden(true)).toEqual({
      hideTabAdd: true,
      hideOrganizations: true,
      hidePulse: true,
      hideWiki: true,
      hideLoops: true,
    })
    expect(onboardingChromeHidden(false)).toEqual({
      hideTabAdd: false,
      hideOrganizations: false,
      hidePulse: false,
      hideWiki: false,
      hideLoops: false,
    })
  })
})

describe('onboardingLockedSurface', () => {
  it('complete users get showComposer only from hasAgents', () => {
    expect(
      onboardingLockedSurface({
        incomplete: false,
        path: 'engineer',
        hasFolder: true,
        hasAgents: false,
      }),
    ).toEqual({
      showPathPicker: false,
      showFolderCta: false,
      showTeamFab: false,
      showInviteCta: false,
      showComposer: false,
      autoOpenCeremonyOverlay: false,
    })
    expect(
      onboardingLockedSurface({
        incomplete: false,
        path: 'business',
        hasFolder: true,
        hasAgents: true,
      }),
    ).toEqual({
      showPathPicker: false,
      showFolderCta: false,
      showTeamFab: false,
      showInviteCta: false,
      showComposer: true,
      autoOpenCeremonyOverlay: false,
    })
  })

  it('incomplete surfaces follow path, folder and agents', () => {
    expect(
      onboardingLockedSurface({
        incomplete: true,
        path: '',
        hasFolder: false,
        hasAgents: false,
      }),
    ).toEqual({
      showPathPicker: true,
      showFolderCta: false,
      showTeamFab: false,
      showInviteCta: true,
      showComposer: false,
      autoOpenCeremonyOverlay: false,
    })
    expect(
      onboardingLockedSurface({
        incomplete: true,
        path: 'engineer',
        hasFolder: false,
        hasAgents: false,
      }),
    ).toEqual({
      showPathPicker: false,
      showFolderCta: true,
      showTeamFab: false,
      showInviteCta: true,
      showComposer: false,
      autoOpenCeremonyOverlay: false,
    })
    expect(
      onboardingLockedSurface({
        incomplete: true,
        path: 'engineer',
        hasFolder: true,
        hasAgents: false,
      }),
    ).toEqual({
      showPathPicker: false,
      showFolderCta: false,
      showTeamFab: true,
      showInviteCta: true,
      showComposer: false,
      autoOpenCeremonyOverlay: false,
    })
  })

  it('autoOpenCeremonyOverlay only for incomplete business with agents', () => {
    expect(
      onboardingLockedSurface({
        incomplete: true,
        path: 'business',
        hasFolder: true,
        hasAgents: true,
      }),
    ).toEqual({
      showPathPicker: false,
      showFolderCta: false,
      showTeamFab: false,
      showInviteCta: true,
      showComposer: false,
      autoOpenCeremonyOverlay: true,
    })
    expect(
      onboardingLockedSurface({
        incomplete: true,
        path: 'business',
        hasFolder: true,
        hasAgents: false,
      }).autoOpenCeremonyOverlay,
    ).toBe(false)
    expect(
      onboardingLockedSurface({
        incomplete: false,
        path: 'business',
        hasFolder: true,
        hasAgents: true,
      }).autoOpenCeremonyOverlay,
    ).toBe(false)
  })
})

describe('shouldWarnComposerMissingCli', () => {
  it('warns only for incomplete engineer path with all CLIs missing', () => {
    expect(
      shouldWarnComposerMissingCli({
        incomplete: true,
        path: 'engineer',
        cliAllMissing: true,
      }),
    ).toBe(true)
    expect(
      shouldWarnComposerMissingCli({
        incomplete: true,
        path: 'engineer',
        cliAllMissing: false,
      }),
    ).toBe(false)
    expect(
      shouldWarnComposerMissingCli({
        incomplete: false,
        path: 'engineer',
        cliAllMissing: true,
      }),
    ).toBe(false)
    expect(
      shouldWarnComposerMissingCli({
        incomplete: true,
        path: 'business',
        cliAllMissing: true,
      }),
    ).toBe(false)
  })
})
