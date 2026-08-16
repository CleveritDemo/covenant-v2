/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import {
  OnboardingView,
  type OnboardingCliRow,
  type OnboardingViewProps,
} from '../onboarding'
import type { OnboardingStepId } from '@shared/onboardingSteps'
import type { CovenantApi } from '../../covenantApi'

vi.mock('@i18n/useT', () => ({
  useT: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${Object.values(params).join(',')}` : key,
  }),
}))

vi.mock('../GravityHeroCanvas', () => ({
  GravityHeroCanvas: ({
    children,
  }: {
    children: React.ReactNode
  }) => <div data-testid="onboarding-shell">{children}</div>,
}))

const getCovenantApi = vi.fn<() => CovenantApi | undefined>()

vi.mock('../../covenantApi', async importOriginal => {
  const actual = await importOriginal<typeof import('../../covenantApi')>()
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

beforeEach(() => {
  getCovenantApi.mockReturnValue(
    mockApi({
      status: vi.fn(() => ok({ signedIn: false })),
    }),
  )
})

const ENGINEER_STEPS: OnboardingStepId[] = [
  'welcome',
  'account',
  'requirements',
  'folder',
  'team',
  'brainstorm',
  'firstMessage',
]

const INSTALLED: OnboardingCliRow = {
  provider: 'claude',
  label: 'Claude Code',
  command: 'claude',
  installed: true,
  version: '1.2.3',
}

const MISSING: OnboardingCliRow = {
  provider: 'codex',
  label: 'Codex',
  command: 'codex',
  installed: false,
  version: null,
}

function renderWizard(overrides: Partial<OnboardingViewProps> = {}) {
  const props: OnboardingViewProps = {
    open: true,
    stepIndex: 0,
    steps: ENGINEER_STEPS,
    path: 'engineer',
    onSelectPath: vi.fn(),
    onNext: vi.fn(),
    onBack: vi.fn(),
    onSkip: vi.fn(),
    onFinish: vi.fn(),
    cliRows: [INSTALLED, MISSING],
    loading: false,
    cliError: false,
    onRecheck: vi.fn(),
    folderPath: null,
    onPickFolder: vi.fn(),
    canCreateTeam: false,
    teamCreated: false,
    onCreateTeam: vi.fn(),
    canOpenBrainstorm: false,
    onOpenBrainstorm: vi.fn(),
    onLoadOrgWorkspace: vi.fn(),
    ...overrides,
  }
  render(<OnboardingView {...props} />)
  return props
}

describe('OnboardingView steps', () => {
  it('pinta bienvenida y selector de path', () => {
    renderWizard({ stepIndex: 0 })
    expect(screen.getByText('onboarding.welcomeTitle')).toBeTruthy()
    expect(screen.getByText('onboarding.welcomeChain')).toBeTruthy()
    expect(screen.getByText('onboarding.pathTitle')).toBeTruthy()
    expect(screen.getByText('onboarding.pathBusiness')).toBeTruthy()
    expect(screen.getByText('onboarding.pathEngineer')).toBeTruthy()
  })

  it('pinta el paso de cuenta Covenant', async () => {
    renderWizard({ stepIndex: 1 })
    expect(await screen.findByText('onboarding.accountTitle')).toBeTruthy()
    expect(screen.getByText('onboarding.accountLead')).toBeTruthy()
    expect(screen.queryByText('onboarding.welcomeTitle')).toBeNull()
    expect(screen.queryByText('onboarding.requirementsTitle')).toBeNull()
  })

  it('pinta requisitos con instalado y faltante', () => {
    renderWizard({ stepIndex: 2 })
    expect(screen.getByText('onboarding.requirementsTitle')).toBeTruthy()
    expect(screen.getByText('Claude Code')).toBeTruthy()
    expect(screen.getByText('Codex')).toBeTruthy()
    expect(screen.getByText('onboarding.requirementsInstalled')).toBeTruthy()
    expect(screen.getByText('onboarding.requirementsMissing')).toBeTruthy()
    expect(screen.getByText('onboarding.requirementsVersion:1.2.3')).toBeTruthy()
  })

  it('avisa cuando ningún CLI está instalado', () => {
    renderWizard({
      stepIndex: 2,
      cliRows: [{ ...MISSING }, { ...MISSING, provider: 'gemini', label: 'Gemini', command: 'gemini' }],
    })
    expect(screen.getByText('onboarding.requirementsNone')).toBeTruthy()
  })

  it('con cliError muestra el error y no pinta filas de CLI', () => {
    renderWizard({
      stepIndex: 2,
      cliError: true,
      cliRows: [INSTALLED, MISSING],
    })
    expect(screen.getByText('onboarding.requirementsError')).toBeTruthy()
    expect(screen.queryByText('Claude Code')).toBeNull()
    expect(screen.queryByText('Codex')).toBeNull()
    expect(screen.queryByText('onboarding.requirementsNone')).toBeNull()
  })

  it('pinta carpeta', () => {
    renderWizard({ stepIndex: 3, folderPath: '/tmp/proj' })
    expect(screen.getByText('onboarding.folderTitle')).toBeTruthy()
    expect(screen.getByText('/tmp/proj')).toBeTruthy()
  })

  it('pinta equipo', () => {
    renderWizard({ stepIndex: 4, canCreateTeam: true })
    expect(screen.getByText('onboarding.teamTitle')).toBeTruthy()
    expect(screen.getByText('onboarding.teamRoleTl')).toBeTruthy()
    expect(screen.getByRole('button', { name: /onboarding\.teamCreate/ })).toBeTruthy()
  })

  it('pinta brainstorming con título y CTA', () => {
    renderWizard({ stepIndex: 5, canOpenBrainstorm: true })
    expect(screen.getByText('onboarding.brainstormTitle')).toBeTruthy()
    expect(screen.getByRole('button', { name: /onboarding\.brainstormOpen/ })).toBeTruthy()
  })

  it('pinta primer mensaje', () => {
    renderWizard({ stepIndex: 6 })
    expect(screen.getByText('onboarding.firstMessageTitle')).toBeTruthy()
    expect(screen.getByText('onboarding.firstMessageExample')).toBeTruthy()
  })
})

describe('OnboardingView navigation', () => {
  it('siguiente dispara onNext', () => {
    const props = renderWizard({ stepIndex: 0, path: 'engineer' })
    const footer = screen.getByTestId('onboarding-footer')
    fireEvent.click(within(footer).getByRole('button', { name: 'onboarding.next' }))
    expect(props.onNext).toHaveBeenCalledTimes(1)
  })

  it('sin path deshabilita Next', () => {
    renderWizard({ stepIndex: 0, path: '' })
    const footer = screen.getByTestId('onboarding-footer')
    const next = within(footer).getByRole('button', { name: 'onboarding.next' }) as HTMLButtonElement
    expect(next.disabled).toBe(true)
  })

  it('elige path dispara onSelectPath', () => {
    const props = renderWizard({ stepIndex: 0, path: '' })
    fireEvent.click(screen.getByText('onboarding.pathBusiness'))
    expect(props.onSelectPath).toHaveBeenCalledWith('business')
  })

  it('atrás dispara onBack', () => {
    const props = renderWizard({ stepIndex: 3 })
    const footer = screen.getByTestId('onboarding-footer')
    fireEvent.click(within(footer).getByRole('button', { name: 'onboarding.back' }))
    expect(props.onBack).toHaveBeenCalledTimes(1)
  })

  it('omitir dispara onSkip', () => {
    const props = renderWizard({ stepIndex: 2 })
    const footer = screen.getByTestId('onboarding-footer')
    fireEvent.click(within(footer).getByRole('button', { name: 'onboarding.skip' }))
    expect(props.onSkip).toHaveBeenCalledTimes(1)
  })

  it('Escape no llama a onSkip', () => {
    const props = renderWizard({ stepIndex: 0 })
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(props.onSkip).not.toHaveBeenCalled()
  })

  it('en el paso account el footer no muestra Next', () => {
    renderWizard({ stepIndex: 1 })
    const footer = screen.getByTestId('onboarding-footer')
    expect(within(footer).queryByRole('button', { name: 'onboarding.next' })).toBeNull()
  })

  it('en el último paso el CTA primario llama onFinish', () => {
    const props = renderWizard({ stepIndex: 6 })
    fireEvent.click(screen.getByRole('button', { name: 'onboarding.finish' }))
    expect(props.onFinish).toHaveBeenCalledTimes(1)
  })
})

describe('OnboardingView team CTA', () => {
  it('deshabilita crear equipo sin carpeta', () => {
    renderWizard({ stepIndex: 4, canCreateTeam: false, folderPath: null })
    const btn = screen.getByRole('button', { name: /onboarding\.teamCreate/ })
    expect((btn as HTMLButtonElement).disabled).toBe(true)
  })

  it('habilita crear equipo con canCreateTeam', () => {
    const props = renderWizard({ stepIndex: 4, canCreateTeam: true, folderPath: '/tmp/p' })
    const btn = screen.getByRole('button', { name: /onboarding\.teamCreate/ })
    expect((btn as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(btn)
    expect(props.onCreateTeam).toHaveBeenCalledTimes(1)
  })
})

describe('OnboardingView brainstorm CTA', () => {
  it('deshabilita abrir sala sin carpeta', () => {
    renderWizard({ stepIndex: 5, canOpenBrainstorm: false })
    const btn = screen.getByRole('button', { name: /onboarding\.brainstormOpen/ })
    expect((btn as HTMLButtonElement).disabled).toBe(true)
  })

  it('habilita abrir sala con canOpenBrainstorm', () => {
    const props = renderWizard({ stepIndex: 5, canOpenBrainstorm: true })
    const btn = screen.getByRole('button', { name: /onboarding\.brainstormOpen/ })
    expect((btn as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(btn)
    expect(props.onOpenBrainstorm).toHaveBeenCalledTimes(1)
  })
})

describe('OnboardingView stepper', () => {
  it('muestra el nombre del paso actual', () => {
    renderWizard({ stepIndex: 0 })
    expect(screen.getByText('onboarding.stepWelcome')).toBeTruthy()
    expect(screen.getByText('onboarding.stepOf:1,7')).toBeTruthy()
  })

  it('nombra el paso de brainstorming', () => {
    renderWizard({ stepIndex: 5 })
    expect(screen.getByText('onboarding.stepBrainstorm')).toBeTruthy()
    expect(screen.getByText('onboarding.stepOf:6,7')).toBeTruthy()
  })

  it('nombra el paso de primer mensaje', () => {
    renderWizard({ stepIndex: 6 })
    expect(screen.getByText('onboarding.stepFirstMessage')).toBeTruthy()
    expect(screen.getByText('onboarding.stepOf:7,7')).toBeTruthy()
  })
})
