import { describe, expect, it } from 'vitest'
import { ONBOARDING_VERSION } from '../onboarding'
import {
  canCompleteOnboarding,
  isOnboardingActive,
  isOnboardingGuideActive,
  isOnboardingIncomplete,
  onboardingChromeHidden,
  onboardingGuideExhausted,
  onboardingLockedSurface,
  sessionHasOrchestrationPanes,
  shouldAutoCompleteFromPanes,
  tabHasOrchestrationPanes,
  shouldWarnComposerMissingCli,
} from '../onboardingFlow'

const engineerGuideReady = {
  incomplete: true,
  path: 'engineer' as const,
  hasFolder: true,
  hasAgents: true,
  openChatAgentId: 'agent-1',
  brainstormOverlayOpen: false,
  sentFirstMessage: true,
  assignedAnyContext: true,
  doneSteps: ['open_terminal'],
}

describe('isOnboardingIncomplete', () => {
  it('is true when completed version differs from ONBOARDING_VERSION', () => {
    expect(isOnboardingIncomplete('')).toBe(true)
    expect(isOnboardingIncomplete('1')).toBe(true)
    expect(isOnboardingIncomplete('2')).toBe(true)
    expect(isOnboardingIncomplete(ONBOARDING_VERSION)).toBe(false)
    expect(isOnboardingIncomplete(`  ${ONBOARDING_VERSION}  `)).toBe(false)
  })
})

describe('tabHasOrchestrationPanes', () => {
  it('detects agent or terminal panes', () => {
    expect(tabHasOrchestrationPanes(undefined)).toBe(false)
    expect(tabHasOrchestrationPanes({})).toBe(false)
    expect(tabHasOrchestrationPanes({ a: 'agent' })).toBe(true)
    expect(tabHasOrchestrationPanes({ t: 'terminal' })).toBe(true)
    expect(tabHasOrchestrationPanes({ a: 'agent', t: 'terminal' })).toBe(true)
    expect(tabHasOrchestrationPanes({ x: 'other' })).toBe(false)
  })
})

describe('sessionHasOrchestrationPanes', () => {
  it('is true when any tab has agent or terminal panes', () => {
    expect(sessionHasOrchestrationPanes([])).toBe(false)
    expect(sessionHasOrchestrationPanes([{ paneKinds: {} }])).toBe(false)
    expect(sessionHasOrchestrationPanes([
      { paneKinds: {} },
      { paneKinds: { t: 'terminal' } },
    ])).toBe(true)
  })
})

describe('isOnboardingActive', () => {
  it('is false for existing workspaces even if onboarding is incomplete', () => {
    expect(isOnboardingActive({
      incomplete: true,
      tabs: [{ paneKinds: { a: 'agent' } }],
    })).toBe(false)
    expect(isOnboardingActive({
      incomplete: true,
      tabs: [{ paneKinds: { t: 'terminal' } }],
    })).toBe(false)
  })

  it('is true only for incomplete sessions without orchestration panes', () => {
    expect(isOnboardingActive({ incomplete: false, tabs: [] })).toBe(false)
    expect(isOnboardingActive({ incomplete: true, tabs: [] })).toBe(true)
    expect(isOnboardingActive({ incomplete: true, tabs: [{ paneKinds: {} }] })).toBe(true)
  })
})

describe('isOnboardingGuideActive', () => {
  it('is true when incomplete even with orchestration panes', () => {
    expect(isOnboardingGuideActive({ incomplete: true })).toBe(true)
  })

  it('is false when onboarding is complete', () => {
    expect(isOnboardingGuideActive({ incomplete: false })).toBe(false)
  })
})

describe('shouldAutoCompleteFromPanes', () => {
  const withPanes = [{ paneKinds: { a: 'agent' } }]

  it('is true with incomplete, empty path and orchestration panes', () => {
    expect(shouldAutoCompleteFromPanes({
      incomplete: true,
      path: '',
      tabs: withPanes,
    })).toBe(true)
  })

  it('is false with engineer or business path even when panes exist', () => {
    expect(shouldAutoCompleteFromPanes({
      incomplete: true,
      path: 'engineer',
      tabs: withPanes,
    })).toBe(false)
    expect(shouldAutoCompleteFromPanes({
      incomplete: true,
      path: 'business',
      tabs: withPanes,
    })).toBe(false)
  })

  it('is false without orchestration panes', () => {
    expect(shouldAutoCompleteFromPanes({
      incomplete: true,
      path: '',
      tabs: [],
    })).toBe(false)
    expect(shouldAutoCompleteFromPanes({
      incomplete: true,
      path: '',
      tabs: [{ paneKinds: {} }],
    })).toBe(false)
  })

  it('is false when onboarding is complete', () => {
    expect(shouldAutoCompleteFromPanes({
      incomplete: false,
      path: '',
      tabs: withPanes,
    })).toBe(false)
  })
})

describe('onboardingGuideExhausted', () => {
  it('is true when the resolver returns null', () => {
    expect(onboardingGuideExhausted(engineerGuideReady)).toBe(true)
    expect(
      onboardingGuideExhausted({
        ...engineerGuideReady,
        sentFirstMessage: false,
        doneSteps: [],
      }),
    ).toBe(false)
  })
})

describe('canCompleteOnboarding', () => {
  it('returns false when onboarding is already complete', () => {
    expect(
      canCompleteOnboarding({
        incomplete: false,
        path: 'engineer',
        trigger: 'guide_exhausted',
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

  it('guide_exhausted requires a chosen path and at least one CLI on both paths', () => {
    expect(
      canCompleteOnboarding({
        incomplete: true,
        path: 'engineer',
        trigger: 'guide_exhausted',
        cliAllMissing: true,
      }),
    ).toBe(false)
    expect(
      canCompleteOnboarding({
        incomplete: true,
        path: 'engineer',
        trigger: 'guide_exhausted',
        cliAllMissing: false,
      }),
    ).toBe(true)
    expect(
      canCompleteOnboarding({
        incomplete: true,
        path: 'business',
        trigger: 'guide_exhausted',
        cliAllMissing: false,
      }),
    ).toBe(true)
    expect(
      canCompleteOnboarding({
        incomplete: true,
        path: 'business',
        trigger: 'guide_exhausted',
        cliAllMissing: true,
      }),
    ).toBe(false)
    expect(
      canCompleteOnboarding({
        incomplete: true,
        path: '',
        trigger: 'guide_exhausted',
        cliAllMissing: false,
      }),
    ).toBe(false)
  })
})

describe('onboardingChromeHidden', () => {
  const allHidden = {
    hideTabAdd: true,
    hideOrganizations: true,
    hidePulse: true,
    hideWiki: true,
    hideLoops: true,
  }
  const allVisible = {
    hideTabAdd: false,
    hideOrganizations: false,
    hidePulse: false,
    hideWiki: false,
    hideLoops: false,
  }

  it('incomplete + empty path hides all chrome', () => {
    expect(onboardingChromeHidden({ incomplete: true, path: '' })).toEqual(allHidden)
  })

  it('incomplete + engineer path shows all chrome', () => {
    expect(onboardingChromeHidden({ incomplete: true, path: 'engineer' })).toEqual(allVisible)
  })

  it('incomplete + business path shows all chrome', () => {
    expect(onboardingChromeHidden({ incomplete: true, path: 'business' })).toEqual(allVisible)
  })

  it('complete + empty path shows all chrome', () => {
    expect(onboardingChromeHidden({ incomplete: false, path: '' })).toEqual(allVisible)
  })

  it('complete + engineer path shows all chrome', () => {
    expect(onboardingChromeHidden({ incomplete: false, path: 'engineer' })).toEqual(allVisible)
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
        cliAllMissing: false,
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
        cliAllMissing: false,
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
        cliAllMissing: false,
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
        cliAllMissing: false,
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
        cliAllMissing: false,
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

  it('autoOpenCeremonyOverlay only for incomplete business with agents and a CLI', () => {
    expect(
      onboardingLockedSurface({
        incomplete: true,
        path: 'business',
        hasFolder: true,
        hasAgents: true,
        cliAllMissing: false,
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
        cliAllMissing: false,
      }).autoOpenCeremonyOverlay,
    ).toBe(false)
    expect(
      onboardingLockedSurface({
        incomplete: false,
        path: 'business',
        hasFolder: true,
        hasAgents: true,
        cliAllMissing: false,
      }).autoOpenCeremonyOverlay,
    ).toBe(false)
    expect(
      onboardingLockedSurface({
        incomplete: true,
        path: 'business',
        hasFolder: true,
        hasAgents: true,
        cliAllMissing: true,
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
