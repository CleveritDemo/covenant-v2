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

    render(<OnboardingStepAccount onLoadOrgWorkspace={vi.fn()} />)

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

    render(<OnboardingStepAccount onLoadOrgWorkspace={onLoadOrgWorkspace} />)

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

    render(<OnboardingStepAccount onLoadOrgWorkspace={vi.fn()} />)

    expect(await screen.findByText('onboarding.accountNoOrgs')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'onboarding.accountLoadWorkspace' })).toBeNull()
  })

  it('no renderiza botón de avanzar/saltar dentro del paso', async () => {
    const api = mockApi({
      status: vi.fn(() => ok({ signedIn: false })),
    })
    getCovenantApi.mockReturnValue(api)

    render(<OnboardingStepAccount onLoadOrgWorkspace={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'onboarding.accountSignIn' })).toBeTruthy()
    })

    expect(screen.queryByRole('button', { name: 'onboarding.accountSkip' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'onboarding.accountContinue' })).toBeNull()
  })

  it('con sesión llama onSignedInChange(true)', async () => {
    const onSignedInChange = vi.fn()
    const api = mockApi({
      status: vi.fn(() => ok({ signedIn: true, login: 'gigi' })),
      orgsList: vi.fn(() => ok([])),
    })
    getCovenantApi.mockReturnValue(api)

    render(
      <OnboardingStepAccount
        onSignedInChange={onSignedInChange}
        onLoadOrgWorkspace={vi.fn()}
      />,
    )

    await waitFor(() => {
      expect(onSignedInChange).toHaveBeenCalledWith(true)
    })
  })

  it('con sesión muestra el lead signed-in y no el lead desconectado', async () => {
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

    render(<OnboardingStepAccount onLoadOrgWorkspace={vi.fn()} />)

    expect(await screen.findByText('onboarding.accountLeadSignedIn')).toBeTruthy()
    expect(screen.queryByText('onboarding.accountLead')).toBeNull()
  })

  it('con sesión muestra las etiquetas de usuario y organizaciones', async () => {
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

    render(<OnboardingStepAccount onLoadOrgWorkspace={vi.fn()} />)

    expect(await screen.findByText('onboarding.accountSignedInAs')).toBeTruthy()
    expect(screen.getByText('onboarding.accountOrgsLabel')).toBeTruthy()
  })
})
