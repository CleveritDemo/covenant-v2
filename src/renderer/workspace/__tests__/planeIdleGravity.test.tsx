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

vi.mock('../PlaneOnboardingHome', () => ({
  PlaneOnboardingHome: ({
    onSelectPath,
    onInviteToOrg,
  }: {
    onSelectPath: (path: 'business' | 'engineer') => void
    onInviteToOrg?: () => void
  }) => (
    <div data-onboarding="path-picker">
      <button type="button" onClick={() => onSelectPath('business')}>tabs.pathPlan</button>
      <button type="button" onClick={() => onSelectPath('engineer')}>tabs.pathExecute</button>
      {onInviteToOrg ? (
        <button type="button" onClick={onInviteToOrg}>tabs.inviteTeam</button>
      ) : null}
    </div>
  ),
}))

afterEach(cleanup)

describe('PlaneIdleGravity — onboarding in-plane', () => {
  it('con lock y showPathPicker muestra Planear, Ejecutar e invitación', () => {
    render(
      <PlaneIdleGravity
        onboardingLocked
        showPathPicker
        showInviteCta
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
        showPathPicker
        orchestratorPath=""
        onSelectOrchestratorPath={onSelectOrchestratorPath}
        onInviteToOrg={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /tabs\.pathPlan/ }))
    expect(onSelectOrchestratorPath).toHaveBeenCalledTimes(1)
    expect(onSelectOrchestratorPath).toHaveBeenCalledWith('business')
  })

  it('la invitación llama onInviteToOrg solo si showInviteCta', () => {
    const onInviteToOrg = vi.fn()
    render(
      <PlaneIdleGravity
        onboardingLocked
        showPathPicker
        showInviteCta
        orchestratorPath=""
        onSelectOrchestratorPath={vi.fn()}
        onInviteToOrg={onInviteToOrg}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'tabs.inviteTeam' }))
    expect(onInviteToOrg).toHaveBeenCalledTimes(1)
  })

  it('con lock no re-deriva el picker si App no pasa showPathPicker', () => {
    render(
      <PlaneIdleGravity
        onboardingLocked
        orchestratorPath=""
        onSelectOrchestratorPath={vi.fn()}
        onInviteToOrg={vi.fn()}
      />,
    )

    expect(screen.queryByRole('button', { name: /tabs\.pathPlan/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /tabs\.pathExecute/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'tabs.inviteTeam' })).toBeNull()
  })

  it('crear equipo con lock obedece showTeamFab, no el bootstrap de main', () => {
    const { rerender } = render(
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

    expect(document.querySelector('[data-onboarding="create-team"]')).toBeNull()

    rerender(
      <PlaneIdleGravity
        onboardingLocked
        showTeamFab
        orchestratorPath="engineer"
        bootstrapAgentsLabel="tabs.bootstrapAgents"
        onBootstrapAgents={vi.fn()}
        onSelectOrchestratorPath={vi.fn()}
      />,
    )

    expect(document.querySelector('[data-onboarding="create-team"]')).toBeTruthy()
  })

  it('sin lock el CTA de equipo sigue saliendo de showBootstrapAgents', () => {
    render(
      <PlaneIdleGravity
        showBootstrapAgents
        canBootstrapAgents
        bootstrapAgentsLabel="tabs.bootstrapAgents"
        onBootstrapAgents={vi.fn()}
      />,
    )

    expect(document.querySelector('[data-onboarding="create-team"]')).toBeTruthy()
  })

  it('con lock el folder sale de showFolderCta', () => {
    render(
      <PlaneIdleGravity
        onboardingLocked
        showFolderCta
        selectFolderLabel="Elegir carpeta"
        onSelectProjectFolder={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'Elegir carpeta' })).toBeTruthy()
  })
})
