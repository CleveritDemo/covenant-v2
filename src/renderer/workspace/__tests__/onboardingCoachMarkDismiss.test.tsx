/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { PlaneMapEntity } from '../PlaneMap'
import type { ProjectAgentDefinition } from '@shared/projectAgentCatalog'
import { BrainstormModuleTabs } from '../BrainstormModuleTabs'
import { BrainstormStartModal } from '../BrainstormStartModal'
import { TabAgenticPlane, type TabAgenticPlaneProps } from '../TabAgenticPlane'

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

const DISMISS_LABEL = 'Entendido'

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

function brainstormAgent(id: string, role: string): ProjectAgentDefinition {
  return { id, name: id, role, provider: 'claude', permissionMode: 'plan' }
}

const brainstormAgents = [
  brainstormAgent('rodrigo', 'Product Owner'),
  brainstormAgent('ana', 'QA'),
  brainstormAgent('nico', 'Dev'),
]

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

function dismissButton(): HTMLElement | null {
  return screen.queryByRole('button', { name: DISMISS_LABEL })
}

function brainstormRoomsOverlay(): React.ReactNode {
  return (
    <BrainstormModuleTabs
      tab="rooms"
      roomsCount={1}
      onRooms={vi.fn()}
      onNew={vi.fn()}
    />
  )
}

function brainstormSetupOverlay(): React.ReactNode {
  return (
    <BrainstormStartModal
      open
      cwd="/tmp/project"
      agents={brainstormAgents}
      onClose={() => {}}
      onStarted={() => {}}
    />
  )
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
    startBrainstorm: vi.fn(),
  }
})

afterEach(cleanup)

describe('coach mark dismiss en TabAgenticPlane', () => {
  describe('pasos informativos dismissibles', () => {
    it('assign_context: botón Entendido y handler con el step', () => {
      stubAnchorRects()
      const onDismiss = vi.fn()

      renderPlaneWithTeam({
        orchestratorPath: 'engineer',
        onboardingGuideStep: {
          step: 'assign_context',
          anchor: 'context-pool',
          messageKey: 'tabs.onboardingGuide.assignContext',
          dismissible: true,
        },
        onboardingGuideDismissLabel: DISMISS_LABEL,
        onOnboardingGuideDismiss: onDismiss,
      })

      expect(document.querySelector('[data-onboarding="context-pool"]')).toBeTruthy()
      const button = dismissButton()
      expect(button).toBeTruthy()

      fireEvent.click(button!)
      expect(onDismiss).toHaveBeenCalledTimes(1)
      expect(onDismiss).toHaveBeenCalledWith('assign_context')
    })

    it('open_terminal: botón Entendido existe', () => {
      stubAnchorRects()
      const onDismiss = vi.fn()

      renderPlaneWithTeam({
        orchestratorPath: 'engineer',
        onboardingGuideStep: {
          step: 'open_terminal',
          anchor: 'plane-terminal-fab',
          messageKey: 'tabs.onboardingGuide.openTerminal',
          dismissible: true,
        },
        onboardingGuideDismissLabel: DISMISS_LABEL,
        onOnboardingGuideDismiss: onDismiss,
      })

      expect(document.querySelector('[data-onboarding="plane-terminal-fab"]')).toBeTruthy()
      expect(dismissButton()).toBeTruthy()
    })

    it('saved_rooms: botón Entendido existe', () => {
      stubAnchorRects()
      const onDismiss = vi.fn()

      renderPlaneWithTeam({
        orchestratorPath: 'business',
        onBrainstormViewChange: vi.fn(),
        brainstormOverlayOpen: true,
        brainstormOverlays: brainstormRoomsOverlay(),
        onboardingGuideStep: {
          step: 'saved_rooms',
          anchor: 'brainstorm-module-tabs',
          messageKey: 'tabs.onboardingGuide.savedRooms',
          dismissible: true,
        },
        onboardingGuideDismissLabel: DISMISS_LABEL,
        onOnboardingGuideDismiss: onDismiss,
      })

      expect(document.querySelector('[data-onboarding="brainstorm-module-tabs"]')).toBeTruthy()
      expect(dismissButton()).toBeTruthy()
    })
  })

  describe('pasos de acción sin dismiss', () => {
    it('send_message: sin botón Entendido ni llamada al handler', () => {
      stubAnchorRects()
      const onDismiss = vi.fn()

      renderPlaneWithTeam({
        orchestratorPath: 'engineer',
        openChatAgentId: 'agent-1',
        onboardingGuideStep: {
          step: 'send_message',
          anchor: 'composer-input',
          messageKey: 'tabs.onboardingGuide.sendMessage',
        },
        onboardingGuideDismissLabel: DISMISS_LABEL,
        onOnboardingGuideDismiss: onDismiss,
      })

      expect(document.querySelector('[data-onboarding="composer-input"]')).toBeTruthy()
      expect(dismissButton()).toBeNull()
      expect(onDismiss).not.toHaveBeenCalled()
    })

    it('select_agent: sin botón Entendido ni llamada al handler', () => {
      stubAnchorRects()
      const onDismiss = vi.fn()

      renderPlaneWithTeam({
        orchestratorPath: 'engineer',
        openChatAgentId: 'agent-1',
        onboardingGuideStep: {
          step: 'select_agent',
          anchor: 'composer-agents',
          messageKey: 'tabs.onboardingGuide.selectAgent',
        },
        onboardingGuideDismissLabel: DISMISS_LABEL,
        onOnboardingGuideDismiss: onDismiss,
      })

      expect(document.querySelector('[data-onboarding="composer-agents"]')).toBeTruthy()
      expect(dismissButton()).toBeNull()
      expect(onDismiss).not.toHaveBeenCalled()
    })

    it('write_goal: sin botón Entendido ni llamada al handler', () => {
      stubAnchorRects()
      const onDismiss = vi.fn()

      renderPlaneWithTeam({
        orchestratorPath: 'business',
        onBrainstormViewChange: vi.fn(),
        brainstormOverlayOpen: true,
        brainstormOverlays: brainstormSetupOverlay(),
        onboardingGuideStep: {
          step: 'write_goal',
          anchor: 'brainstorm-goal',
          messageKey: 'tabs.onboardingGuide.writeGoal',
        },
        onboardingGuideDismissLabel: DISMISS_LABEL,
        onOnboardingGuideDismiss: onDismiss,
      })

      expect(document.querySelector('[data-onboarding="brainstorm-goal"]')).toBeTruthy()
      expect(dismissButton()).toBeNull()
      expect(onDismiss).not.toHaveBeenCalled()
    })
  })

  it('paso dismissible sin handler: sin botón y sin error', () => {
    stubAnchorRects()

    renderPlaneWithTeam({
      orchestratorPath: 'engineer',
      onboardingGuideStep: {
        step: 'assign_context',
        anchor: 'context-pool',
        messageKey: 'tabs.onboardingGuide.assignContext',
        dismissible: true,
      },
      onboardingGuideDismissLabel: DISMISS_LABEL,
    })

    expect(document.querySelector('.onboarding-coach-mark')).toBeTruthy()
    expect(dismissButton()).toBeNull()
  })
})
