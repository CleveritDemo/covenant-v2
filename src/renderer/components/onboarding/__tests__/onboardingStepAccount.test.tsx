/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { OnboardingStepAccount } from '../OnboardingStepAccount'
import type { CovenantApi } from '../../../covenantApi'

vi.mock('@i18n/useT', () => ({
  useT: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${Object.values(params).join(',')}` : key,
  }),
}))

const getCovenantApi = vi.fn<() => CovenantApi | undefined>()

vi.mock('../../../covenantApi', async importOriginal => {
  const actual = await importOriginal<typeof import('../../../covenantApi')>()
  return {
    ...actual,
    getCovenantApi: () => getCovenantApi(),
  }
})

const ok = <T,>(data: T) => Promise.resolve({ ok: true as const, data })

function mockApi(partial: Partial<CovenantApi>): CovenantApi {
  return {
    status: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
    orgsList: vi.fn(),
    ...partial,
  } as CovenantApi
}

afterEach(() => {
  cleanup()
  getCovenantApi.mockReset()
})

describe('OnboardingStepAccount', () => {
  beforeEach(() => {
    getCovenantApi.mockReturnValue(undefined)
  })

  it('sin sesión muestra el botón de iniciar sesión', async () => {
    const api = mockApi({
      status: vi.fn(() => ok({ signedIn: false })),
    })
    getCovenantApi.mockReturnValue(api)

    render(
      <OnboardingStepAccount onSkipAccount={vi.fn()} onLoadOrgWorkspace={vi.fn()} />,
    )

    expect(await screen.findByRole('button', { name: 'onboarding.accountSignIn' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'onboarding.accountLoadWorkspace' })).toBeNull()
  })

  it('con sesión y orgs muestra nombres y el CTA de cargar workspace', async () => {
    const onLoadOrgWorkspace = vi.fn()
    const api = mockApi({
      status: vi.fn(() => ok({ signedIn: true, login: 'gigi', name: 'Gigi' })),
      orgsList: vi.fn(() =>
        ok([
          { slug: 'acme', name: 'Acme Corp' },
          { slug: 'beta', name: 'Beta Labs' },
        ]),
      ),
    })
    getCovenantApi.mockReturnValue(api)

    render(
      <OnboardingStepAccount onSkipAccount={vi.fn()} onLoadOrgWorkspace={onLoadOrgWorkspace} />,
    )

    expect(await screen.findByText('Acme Corp')).toBeTruthy()
    expect(screen.getByText('Beta Labs')).toBeTruthy()

    const loadBtn = screen.getByRole('button', { name: 'onboarding.accountLoadWorkspace' })
    fireEvent.click(loadBtn)
    expect(onLoadOrgWorkspace).toHaveBeenCalledTimes(1)
  })

  it('con sesión sin orgs muestra el texto y no el CTA', async () => {
    const api = mockApi({
      status: vi.fn(() => ok({ signedIn: true, login: 'gigi' })),
      orgsList: vi.fn(() => ok([])),
    })
    getCovenantApi.mockReturnValue(api)

    render(
      <OnboardingStepAccount onSkipAccount={vi.fn()} onLoadOrgWorkspace={vi.fn()} />,
    )

    expect(await screen.findByText('onboarding.accountNoOrgs')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'onboarding.accountLoadWorkspace' })).toBeNull()
  })

  it('el botón de seguir sin cuenta llama onSkipAccount', async () => {
    const onSkipAccount = vi.fn()
    const api = mockApi({
      status: vi.fn(() => ok({ signedIn: false })),
    })
    getCovenantApi.mockReturnValue(api)

    render(
      <OnboardingStepAccount onSkipAccount={onSkipAccount} onLoadOrgWorkspace={vi.fn()} />,
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'onboarding.accountSkip' })).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: 'onboarding.accountSkip' }))
    expect(onSkipAccount).toHaveBeenCalledTimes(1)
  })

  it('con sesión el botón de avance muestra accountContinue', async () => {
    const api = mockApi({
      status: vi.fn(() => ok({ signedIn: true, login: 'gigi' })),
      orgsList: vi.fn(() => ok([])),
    })
    getCovenantApi.mockReturnValue(api)

    render(
      <OnboardingStepAccount onSkipAccount={vi.fn()} onLoadOrgWorkspace={vi.fn()} />,
    )

    expect(await screen.findByRole('button', { name: 'onboarding.accountContinue' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'onboarding.accountSkip' })).toBeNull()
  })
})
