/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest'
import {
  evaluateOnboardingPlaneSendPersistGuard,
  resolveOnboardingSendGuardCliRows,
} from '../App'
import type { OnboardingCliRow } from '../onboardingGate'

const agentPaneId = 'pane-agent'

const cachedPresent: OnboardingCliRow[] = [
  {
    provider: 'cursor',
    label: 'Cursor',
    command: 'cursor',
    installed: true,
    version: '1.0.0',
  },
]

const cachedStalePresent: OnboardingCliRow[] = [
  {
    provider: 'cursor',
    label: 'Cursor',
    command: 'cursor',
    installed: true,
    version: '0.9.0',
  },
]

const refreshedAllMissing: OnboardingCliRow[] = [
  {
    provider: 'cursor',
    label: 'Cursor',
    command: 'cursor',
    installed: false,
    version: null,
  },
]

const refreshedPresent: OnboardingCliRow[] = [
  {
    provider: 'claude',
    label: 'Claude',
    command: 'claude',
    installed: true,
    version: '2.0.0',
  },
]

function guardArgs(overrides: {
  guideLocked: boolean
  cachedClis: OnboardingCliRow[]
  refreshOnboardingClis: () => Promise<OnboardingCliRow[]>
  provider?: string
}) {
  return {
    guideLocked: overrides.guideLocked,
    cachedClis: overrides.cachedClis,
    refreshOnboardingClis: overrides.refreshOnboardingClis,
    orchestratorPath: 'engineer' as const,
    paneId: agentPaneId,
    paneKinds: { [agentPaneId]: 'agent' },
    resolveProvider: () => overrides.provider ?? 'claude',
  }
}

describe('resolveOnboardingSendGuardCliRows', () => {
  it('refreshes when guideLocked is true even with a populated cache', async () => {
    const refresh = vi.fn(async () => refreshedPresent)

    const rows = await resolveOnboardingSendGuardCliRows(
      true,
      cachedStalePresent,
      refresh,
    )

    expect(refresh).toHaveBeenCalledOnce()
    expect(rows).toBe(refreshedPresent)
    expect(rows).not.toBe(cachedStalePresent)
  })

  it('reuses the cache when guideLocked is false and the cache is populated', async () => {
    const refresh = vi.fn(async () => refreshedPresent)

    const rows = await resolveOnboardingSendGuardCliRows(
      false,
      cachedPresent,
      refresh,
    )

    expect(refresh).not.toHaveBeenCalled()
    expect(rows).toBe(cachedPresent)
  })
})

describe('evaluateOnboardingPlaneSendPersistGuard', () => {
  it('decides with refreshed rows when guideLocked is true and cache is populated', async () => {
    const refresh = vi.fn(async () => refreshedAllMissing)

    const shouldPersist = await evaluateOnboardingPlaneSendPersistGuard(
      guardArgs({
        guideLocked: true,
        cachedClis: cachedStalePresent,
        refreshOnboardingClis: refresh,
        provider: 'claude',
      }),
    )

    expect(refresh).toHaveBeenCalledOnce()
    expect(shouldPersist).toBe(false)
  })

  it('does not persist when guideLocked is true and refresh reports all CLIs missing', async () => {
    const refresh = vi.fn(async () => refreshedAllMissing)

    const shouldPersist = await evaluateOnboardingPlaneSendPersistGuard(
      guardArgs({
        guideLocked: true,
        cachedClis: [],
        refreshOnboardingClis: refresh,
        provider: 'claude',
      }),
    )

    expect(shouldPersist).toBe(false)
  })

  it('persists when guideLocked is true, refresh finds a CLI and provider is configured', async () => {
    const refresh = vi.fn(async () => refreshedPresent)

    const shouldPersist = await evaluateOnboardingPlaneSendPersistGuard(
      guardArgs({
        guideLocked: true,
        cachedClis: cachedStalePresent,
        refreshOnboardingClis: refresh,
        provider: 'claude',
      }),
    )

    expect(refresh).toHaveBeenCalledOnce()
    expect(shouldPersist).toBe(true)
  })

  it('does not refresh when guideLocked is false and cache is populated', async () => {
    const refresh = vi.fn(async () => refreshedAllMissing)

    const shouldPersist = await evaluateOnboardingPlaneSendPersistGuard(
      guardArgs({
        guideLocked: false,
        cachedClis: cachedPresent,
        refreshOnboardingClis: refresh,
        provider: 'claude',
      }),
    )

    expect(refresh).not.toHaveBeenCalled()
    expect(shouldPersist).toBe(true)
  })
})
