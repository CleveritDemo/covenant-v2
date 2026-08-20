/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import type { PlaneMapEntity } from '../PlaneMap'
import { TabAgenticPlane, type TabAgenticPlaneProps } from '../TabAgenticPlane'
import { PlaneFabStack } from '../PlaneFabStack'
import { PlaneOnboardingHome } from '../PlaneOnboardingHome'

vi.mock('@i18n/useT', () => ({
  useT: () => ({ t: (key: string) => key, i18n: { language: 'es' } }),
}))

vi.mock('../useWikiGraphScene', () => ({
  useWikiGraphScene: () => ({ webglAvailable: false }),
}))

vi.mock('../../reduceMotion', () => ({
  isReduceMotionActive: () => true,
}))

vi.mock('../PlaneMap', () => ({
  PlaneMap: () => <div data-testid="plane-map" />,
  planeFloorAuroraActive: () => false,
}))
vi.mock('../PlaneIdleGravity', () => ({ PlaneIdleGravity: () => null }))
vi.mock('../PlaneQuickChat', () => ({ PlaneQuickChat: () => null }))
vi.mock('../PlaneLoopsSection', () => ({ PlaneLoopsSection: () => null }))
vi.mock('../PlaneBrainstormTable', () => ({ PlaneBrainstormTable: () => null }))
vi.mock('../TabFileExplorerWindow', () => ({ TabFileExplorerWindow: () => null }))
vi.mock('../PulseView', () => ({ PulseView: () => null }))
vi.mock('../WikiGraphView', () => ({ WikiGraphView: () => null }))
vi.mock('../WikiCuratorComposer', () => ({ WikiCuratorComposer: () => null }))
vi.mock('../PlaneContextAssignmentLinks', () => ({ PlaneContextAssignmentLinks: () => null }))
vi.mock('../../components/ConfirmTerminalModal', () => ({ ConfirmTerminalModal: () => null }))

const ANCHOR_RECT = {
  x: 40,
  y: 40,
  top: 40,
  left: 40,
  right: 240,
  bottom: 80,
  width: 200,
  height: 40,
  toJSON: () => ({}),
}

function stubAnchorRects(): void {
  const original = Element.prototype.getBoundingClientRect
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: Element,
  ) {
    if (this.hasAttribute('data-onboarding')) return ANCHOR_RECT
    return original.call(this)
  })
}

const agentEntity: PlaneMapEntity = {
  paneId: 'agent-1',
  kind: 'agent',
  title: 'David',
  monogram: 'D',
  busy: false,
  window: { open: false, fullscreen: false, zIndex: 1 },
}

const teamEntities = [agentEntity]

const baseProps = {
  emptyTitle: '',
  emptyHint: '',
  agentFabTitle: 'Agregar agente',
  terminalFabTitle: 'Agregar terminal',
  idleAgentLabel: '',
  contextPoolTitle: 'Contextos',
  contextPoolConfigureLabel: 'Administrar',
  contextPoolCreateLabel: 'Nuevo',
  contextPoolAssignLabel: 'Asignar a agentes',
  contextPoolAssignEmptyHint: 'Crea un agente',
  contextPoolAssignedCountLabel: (count: number) => `Asignado a ${count}`,
  contextPoolEditLabel: 'Editar',
  contextPoolDeleteLabel: 'Eliminar',
  contextPoolDeleteConfirmMessage: (name: string) => `¿Eliminar «${name}»?`,
  contextPoolDeleteConfirmDetail: 'Se quitará del catálogo.',
  chatPlaceholder: 'Escribe al equipo',
  chatEmptyAgents: 'Sin agentes',
  chatSendLabel: 'Enviar',
  tabContexts: [],
  entities: teamEntities,
  agentStatuses: {},
  activePaneId: 'agent-1',
  openChatAgentId: null,
  openChatThreads: [],
  gitRepos: [],
  loopChains: [],
  loopsOpen: false,
  loopsButtonLabel: 'loops',
  projectFolder: '/tmp/project',
  projectFolderSelectLabel: 'Elegir carpeta',
  projectFolderChangeLabel: 'Cambiar carpeta',
  projectFolderEmptyHint: 'Elige una carpeta de proyecto',
  projectFolderRevealLabel: 'Mostrar en Finder',
  configLabel: 'Configurar',
  deleteLabel: 'Eliminar',
  maximizeLabel: 'Maximizar',
  restoreLabel: 'Restaurar',
  closeWindowLabel: 'Cerrar',
  canAdd: true,
  renderPane: () => null,
  onOpenChatAgentChange: vi.fn(),
  onLoopsOpenChange: vi.fn(),
  onLoopChainsChange: vi.fn(),
  onStartLoopChain: vi.fn(),
  onStopLoopChain: vi.fn(),
  onSelectProjectFolder: vi.fn(),
  onMinimizeAllWindows: vi.fn(),
  onSendChat: vi.fn(),
  onStopChat: vi.fn(),
  onAddAgent: vi.fn(),
  onAddTerminal: vi.fn(),
} as unknown as TabAgenticPlaneProps

function renderPlaneWithTeam(overrides: Partial<TabAgenticPlaneProps> = {}): ReturnType<typeof render> {
  return render(
    <TabAgenticPlane
      {...baseProps}
      onboardingLocked={false}
      {...overrides}
    />,
  )
}

function expectAnchor(id: string): void {
  expect(document.querySelector(`[data-onboarding="${id}"]`)).toBeTruthy()
}

beforeEach(() => {
  ;(window as unknown as { api: Record<string, unknown> }).api = {
    getWikiGraph: vi.fn(async () => ({ ok: true, data: { nodes: [], edges: [] } })),
    ensureWiki: vi.fn(async () => ({ ok: true })),
    onWikiCuratorEvent: vi.fn((_cwd: string, _cb: (event: unknown) => void) => () => undefined),
    startWikiCuratorTurn: vi.fn(),
    stopWikiCuratorTurn: vi.fn(),
    isWikiCuratorTurnActive: vi.fn(async () => false),
    getWikiCuratorConfig: vi.fn(async () => ({ ok: true as const, config: {} })),
    setWikiCuratorConfig: vi.fn(async () => ({ ok: true as const })),
    listAgentCliModels: vi.fn(async () => ({ models: [], source: 'fallback' as const })),
    resolveAgentCli: vi.fn(async (provider: string) => ({
      provider,
      command: provider,
      path: `/usr/local/bin/${provider}`,
      version: null,
    })),
    startWikiSweep: vi.fn(),
    stopWikiSweep: vi.fn(),
    onWikiSweepEvent: vi.fn((_cwd: string, _cb: (event: unknown) => void) => () => undefined),
    discoverTabContexts: vi.fn(async () => ({ ok: true, contexts: [] })),
  }
})

afterEach(cleanup)

describe('anclas de onboarding con equipo montado', () => {
  it('track Ejecutar: pool, composer y FAB de terminal siguen en el DOM', () => {
    renderPlaneWithTeam({ orchestratorPath: 'engineer' })

    expectAnchor('context-pool')
    expectAnchor('composer-agents')
    expectAnchor('composer-input')
    expectAnchor('plane-terminal-fab')
  })

  it('track Planear: el riel de brainstorm existe si App pasa onBrainstormViewChange', () => {
    renderPlaneWithTeam({
      orchestratorPath: 'business',
      onBrainstormViewChange: vi.fn(),
    })

    expectAnchor('brainstorm-rail')
  })

  it('OnboardingCoachMark se monta con guía activa aunque onboardingLocked sea false', () => {
    stubAnchorRects()

    renderPlaneWithTeam({
      orchestratorPath: 'engineer',
      openChatAgentId: 'agent-1',
      tabActive: true,
      onboardingGuideStep: {
        step: 'send_message',
        anchor: 'composer-input',
        messageKey: 'tabs.onboardingGuide.sendMessage',
      },
    })

    expect(document.querySelector('[data-onboarding="composer-input"]')).toBeTruthy()
    expect(document.querySelector('.onboarding-coach-mark')).toBeTruthy()
    expect(document.body.textContent).toContain('tabs.onboardingGuide.sendMessage')
  })

  it('OnboardingCoachMark solo se monta en la pestaña activa', () => {
    stubAnchorRects()

    const guideStep = {
      step: 'send_message' as const,
      anchor: 'composer-input' as const,
      messageKey: 'tabs.onboardingGuide.sendMessage',
    }

    const { unmount } = renderPlaneWithTeam({
      orchestratorPath: 'engineer',
      openChatAgentId: 'agent-1',
      tabActive: false,
      onboardingGuideStep: guideStep,
    })
    expect(document.querySelector('.onboarding-coach-mark')).toBeNull()

    unmount()
    renderPlaneWithTeam({
      orchestratorPath: 'engineer',
      openChatAgentId: 'agent-1',
      tabActive: true,
      onboardingGuideStep: guideStep,
    })
    expect(document.querySelector('.onboarding-coach-mark')).toBeTruthy()
  })

  it('el FAB bootstrap lleva data-onboarding create-team', () => {
    render(
      <PlaneFabStack
        canAdd
        agentTitle="Agregar agente"
        terminalTitle="Agregar terminal"
        onAddAgent={vi.fn()}
        onAddTerminal={vi.fn()}
        showBootstrapAgents
        bootstrapAgentsTitle="Crear equipo"
        onBootstrapAgents={vi.fn()}
      />,
    )

    expect(document.querySelector('[data-onboarding="create-team"]')).toBeTruthy()
  })

  it('path-picker contiene el botón de invitación cuando hay onInviteToOrg', () => {
    render(
      <PlaneOnboardingHome
        onSelectPath={vi.fn()}
        onInviteToOrg={vi.fn()}
      />,
    )

    const anchor = document.querySelector('[data-onboarding="path-picker"]')!
    const inviteBtn = anchor.querySelector('.plane-onboarding-home__invite button')!
    expect(anchor.contains(inviteBtn)).toBe(true)
    expect(anchor.querySelectorAll('.option-row').length).toBe(2)
  })

  it('path-picker sin onInviteToOrg solo contiene las dos OptionRow', () => {
    render(<PlaneOnboardingHome onSelectPath={vi.fn()} />)

    const anchor = document.querySelector('[data-onboarding="path-picker"]')!
    expect(anchor.querySelector('.plane-onboarding-home__invite')).toBeNull()
    expect(anchor.querySelectorAll('.option-row').length).toBe(2)
  })
})
