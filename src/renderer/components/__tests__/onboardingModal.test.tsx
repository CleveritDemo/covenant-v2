/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import {
  OnboardingModal,
  type OnboardingCliRow,
  type OnboardingModalProps,
} from '../onboarding'

vi.mock('@i18n/useT', () => ({
  useT: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${Object.values(params).join(',')}` : key,
  }),
}))

vi.mock('../TerminalModal', () => ({
  TerminalModal: ({
    children,
    footer,
    open,
  }: {
    children: React.ReactNode
    footer?: React.ReactNode
    open: boolean
  }) => (open ? <div data-testid="onboarding-shell">{children}<div data-testid="onboarding-footer">{footer}</div></div> : null),
}))

afterEach(cleanup)

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

function renderWizard(overrides: Partial<OnboardingModalProps> = {}) {
  const props: OnboardingModalProps = {
    open: true,
    stepIndex: 0,
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
    ...overrides,
  }
  render(<OnboardingModal {...props} />)
  return props
}

describe('OnboardingModal steps', () => {
  it('pinta bienvenida', () => {
    renderWizard({ stepIndex: 0 })
    expect(screen.getByText('onboarding.welcomeTitle')).toBeTruthy()
    expect(screen.getByText('onboarding.welcomeChain')).toBeTruthy()
  })

  it('pinta requisitos con instalado y faltante', () => {
    renderWizard({ stepIndex: 1 })
    expect(screen.getByText('onboarding.requirementsTitle')).toBeTruthy()
    expect(screen.getByText('Claude Code')).toBeTruthy()
    expect(screen.getByText('Codex')).toBeTruthy()
    expect(screen.getByText('onboarding.requirementsInstalled')).toBeTruthy()
    expect(screen.getByText('onboarding.requirementsMissing')).toBeTruthy()
    expect(screen.getByText('onboarding.requirementsVersion:1.2.3')).toBeTruthy()
  })

  it('avisa cuando ningún CLI está instalado', () => {
    renderWizard({
      stepIndex: 1,
      cliRows: [{ ...MISSING }, { ...MISSING, provider: 'gemini', label: 'Gemini', command: 'gemini' }],
    })
    expect(screen.getByText('onboarding.requirementsNone')).toBeTruthy()
  })

  it('con cliError muestra el error y no pinta filas de CLI', () => {
    renderWizard({
      stepIndex: 1,
      cliError: true,
      cliRows: [INSTALLED, MISSING],
    })
    expect(screen.getByText('onboarding.requirementsError')).toBeTruthy()
    expect(screen.queryByText('Claude Code')).toBeNull()
    expect(screen.queryByText('Codex')).toBeNull()
    expect(screen.queryByText('onboarding.requirementsNone')).toBeNull()
  })

  it('pinta carpeta', () => {
    renderWizard({ stepIndex: 2, folderPath: '/tmp/proj' })
    expect(screen.getByText('onboarding.folderTitle')).toBeTruthy()
    expect(screen.getByText('/tmp/proj')).toBeTruthy()
  })

  it('pinta equipo', () => {
    renderWizard({ stepIndex: 3, canCreateTeam: true })
    expect(screen.getByText('onboarding.teamTitle')).toBeTruthy()
    expect(screen.getByText('onboarding.teamRoleTl')).toBeTruthy()
    expect(screen.getByRole('button', { name: /onboarding\.teamCreate/ })).toBeTruthy()
  })

  it('pinta brainstorming con título y CTA', () => {
    renderWizard({ stepIndex: 4, canOpenBrainstorm: true })
    expect(screen.getByText('onboarding.brainstormTitle')).toBeTruthy()
    expect(screen.getByRole('button', { name: /onboarding\.brainstormOpen/ })).toBeTruthy()
  })

  it('pinta primer mensaje', () => {
    renderWizard({ stepIndex: 5 })
    expect(screen.getByText('onboarding.firstMessageTitle')).toBeTruthy()
    expect(screen.getByText('onboarding.firstMessageExample')).toBeTruthy()
  })
})

describe('OnboardingModal navigation', () => {
  it('siguiente dispara onNext', () => {
    const props = renderWizard({ stepIndex: 0 })
    const footer = screen.getByTestId('onboarding-footer')
    fireEvent.click(within(footer).getByRole('button', { name: 'onboarding.next' }))
    expect(props.onNext).toHaveBeenCalledTimes(1)
  })

  it('atrás dispara onBack', () => {
    const props = renderWizard({ stepIndex: 2 })
    const footer = screen.getByTestId('onboarding-footer')
    fireEvent.click(within(footer).getByRole('button', { name: 'onboarding.back' }))
    expect(props.onBack).toHaveBeenCalledTimes(1)
  })

  it('omitir dispara onSkip', () => {
    const props = renderWizard({ stepIndex: 1 })
    const footer = screen.getByTestId('onboarding-footer')
    fireEvent.click(within(footer).getByRole('button', { name: 'onboarding.skip' }))
    expect(props.onSkip).toHaveBeenCalledTimes(1)
  })

  it('en el último paso el CTA primario llama onFinish', () => {
    const props = renderWizard({ stepIndex: 5 })
    fireEvent.click(screen.getByRole('button', { name: 'onboarding.finish' }))
    expect(props.onFinish).toHaveBeenCalledTimes(1)
  })
})

describe('OnboardingModal team CTA', () => {
  it('deshabilita crear equipo sin carpeta', () => {
    renderWizard({ stepIndex: 3, canCreateTeam: false, folderPath: null })
    const btn = screen.getByRole('button', { name: /onboarding\.teamCreate/ })
    expect((btn as HTMLButtonElement).disabled).toBe(true)
  })

  it('habilita crear equipo con canCreateTeam', () => {
    const props = renderWizard({ stepIndex: 3, canCreateTeam: true, folderPath: '/tmp/p' })
    const btn = screen.getByRole('button', { name: /onboarding\.teamCreate/ })
    expect((btn as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(btn)
    expect(props.onCreateTeam).toHaveBeenCalledTimes(1)
  })
})

describe('OnboardingModal brainstorm CTA', () => {
  it('deshabilita abrir sala sin carpeta', () => {
    renderWizard({ stepIndex: 4, canOpenBrainstorm: false })
    const btn = screen.getByRole('button', { name: /onboarding\.brainstormOpen/ })
    expect((btn as HTMLButtonElement).disabled).toBe(true)
  })

  it('habilita abrir sala con canOpenBrainstorm', () => {
    const props = renderWizard({ stepIndex: 4, canOpenBrainstorm: true })
    const btn = screen.getByRole('button', { name: /onboarding\.brainstormOpen/ })
    expect((btn as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(btn)
    expect(props.onOpenBrainstorm).toHaveBeenCalledTimes(1)
  })
})

describe('OnboardingModal stepper', () => {
  it('muestra el nombre del paso actual', () => {
    renderWizard({ stepIndex: 0 })
    expect(screen.getByText('onboarding.stepWelcome')).toBeTruthy()
    expect(screen.getByText('onboarding.stepOf:1,6')).toBeTruthy()
  })

  it('nombra el paso de brainstorming', () => {
    renderWizard({ stepIndex: 4 })
    expect(screen.getByText('onboarding.stepBrainstorm')).toBeTruthy()
    expect(screen.getByText('onboarding.stepOf:5,6')).toBeTruthy()
  })

  it('nombra el paso de primer mensaje', () => {
    renderWizard({ stepIndex: 5 })
    expect(screen.getByText('onboarding.stepFirstMessage')).toBeTruthy()
    expect(screen.getByText('onboarding.stepOf:6,6')).toBeTruthy()
  })
})
