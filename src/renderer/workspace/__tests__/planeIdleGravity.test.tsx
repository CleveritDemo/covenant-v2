/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PlaneIdleGravity } from '../PlaneIdleGravity'

vi.mock('@i18n/useT', () => ({
  useT: () => ({ t: (key: string) => key, i18n: { language: 'es' } }),
}))

afterEach(cleanup)

describe('PlaneIdleGravity — onboarding in-plane', () => {
  it('con lock y path vacío muestra Planear, Ejecutar e invitación', () => {
    render(
      <PlaneIdleGravity
        onboardingLocked
        orchestratorPath=""
        onSelectOrchestratorPath={vi.fn()}
        onInviteToOrg={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: /tabs\.pathPlan/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /tabs\.pathExecute/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'tabs.inviteTeam' })).toBeTruthy()
    expect(document.querySelector('[data-onboarding="path-picker"]')).toBeTruthy()
  })

  it('Planear llama onSelectOrchestratorPath con business', () => {
    const onSelectOrchestratorPath = vi.fn()
    render(
      <PlaneIdleGravity
        onboardingLocked
        orchestratorPath=""
        onSelectOrchestratorPath={onSelectOrchestratorPath}
        onInviteToOrg={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /tabs\.pathPlan/ }))
    expect(onSelectOrchestratorPath).toHaveBeenCalledTimes(1)
    expect(onSelectOrchestratorPath).toHaveBeenCalledWith('business')
  })

  it('la invitación llama onInviteToOrg', () => {
    const onInviteToOrg = vi.fn()
    render(
      <PlaneIdleGravity
        onboardingLocked
        orchestratorPath=""
        onSelectOrchestratorPath={vi.fn()}
        onInviteToOrg={onInviteToOrg}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'tabs.inviteTeam' }))
    expect(onInviteToOrg).toHaveBeenCalledTimes(1)
  })

  it('con path engineer no muestra las cards ni la invitación', () => {
    render(
      <PlaneIdleGravity
        onboardingLocked
        orchestratorPath="engineer"
        onSelectOrchestratorPath={vi.fn()}
        onInviteToOrg={vi.fn()}
      />,
    )

    expect(screen.queryByRole('button', { name: /tabs\.pathPlan/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /tabs\.pathExecute/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'tabs.inviteTeam' })).toBeNull()
  })

  it('crear equipo expone ancla create-team', () => {
    render(
      <PlaneIdleGravity
        onboardingLocked
        orchestratorPath="engineer"
        showBootstrapAgents
        canBootstrapAgents
        bootstrapAgentsLabel="tabs.bootstrapAgents"
        onBootstrapAgents={vi.fn()}
        onSelectOrchestratorPath={vi.fn()}
      />,
    )

    expect(document.querySelector('[data-onboarding="create-team"]')).toBeTruthy()
  })
})
