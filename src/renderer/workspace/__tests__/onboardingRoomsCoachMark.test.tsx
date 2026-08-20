/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { BrainstormRoom } from '@shared/brainstormRoom'
import type { PlaneMapEntity } from '../PlaneMap'
import { BrainstormRoomsView } from '../BrainstormRoomsView'
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
vi.mock('../BrainstormEditRoomModal', () => ({ BrainstormEditRoomModal: () => null }))

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

function sampleRoom(partial: Partial<BrainstormRoom> = {}): BrainstormRoom {
  return {
    id: 'room-live',
    topic: 'Sala en curso',
    participantAgentIds: ['a'],
    maxRounds: 3,
    status: 'running',
    round: 0,
    cursor: 0,
    messages: [],
    ...partial,
  }
}

function brainstormRoomsOverlay(): React.ReactNode {
  return (
    <BrainstormRoomsView
      open
      active
      cwd="/tmp/project"
      agents={[]}
      contexts={[]}
      onClose={vi.fn()}
      onCreate={vi.fn()}
      onOpenRoom={vi.fn()}
      onContextSaved={vi.fn()}
      onAssignContext={vi.fn()}
    />
  )
}

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
      orchestratorPath="business"
      tabActive
      brainstormOverlayOpen
      brainstormView="rooms"
      onBrainstormViewChange={vi.fn()}
      brainstormOverlays={brainstormRoomsOverlay()}
      {...overrides}
    />,
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
    listBrainstorms: vi.fn(async () => [sampleRoom()]),
    saveBrainstorm: vi.fn(),
    deleteBrainstorm: vi.fn(),
    pruneBrainstorms: vi.fn(),
    exportBrainstormMarkdown: vi.fn(),
    materializeTabContext: vi.fn(),
    openFolder: vi.fn(),
  }
})

afterEach(() => {
  cleanup()
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

describe('coach mark sobre BrainstormRoomsView real', () => {
  it('open_brainstorm en brainstorm-module-tabs: ancla y coach mark', () => {
    stubAnchorRects()

    renderPlaneWithTeam({
      onboardingGuideStep: {
        step: 'open_brainstorm',
        anchor: 'brainstorm-module-tabs',
        messageKey: 'tabs.onboardingGuide.newRoom',
      },
    })

    expect(document.querySelector('[data-onboarding="brainstorm-module-tabs"]')).toBeTruthy()
    expect(document.querySelector('.onboarding-coach-mark')).toBeTruthy()
    expect(document.body.textContent).toContain('tabs.onboardingGuide.newRoom')
  })

  it('open_brainstorm en brainstorm-rooms-list: ancla y coach mark', () => {
    stubAnchorRects()

    renderPlaneWithTeam({
      onboardingGuideStep: {
        step: 'open_brainstorm',
        anchor: 'brainstorm-rooms-list',
        messageKey: 'tabs.onboardingGuide.openLiveRoom',
      },
    })

    expect(document.querySelector('[data-onboarding="brainstorm-rooms-list"]')).toBeTruthy()
    expect(document.querySelector('.onboarding-coach-mark')).toBeTruthy()
    expect(document.body.textContent).toContain('tabs.onboardingGuide.openLiveRoom')
  })

  it('saved_rooms dismissible: coach mark y botón Entendido', () => {
    stubAnchorRects()

    renderPlaneWithTeam({
      onboardingGuideStep: {
        step: 'saved_rooms',
        anchor: 'brainstorm-module-tabs',
        messageKey: 'tabs.onboardingGuide.savedRooms',
        dismissible: true,
      },
      onboardingGuideDismissLabel: DISMISS_LABEL,
      onOnboardingGuideDismiss: vi.fn(),
    })

    expect(document.querySelector('[data-onboarding="brainstorm-module-tabs"]')).toBeTruthy()
    expect(document.querySelector('.onboarding-coach-mark')).toBeTruthy()
    expect(screen.getByRole('button', { name: DISMISS_LABEL })).toBeTruthy()
  })

  it('tabActive false: no monta coach mark', () => {
    stubAnchorRects()

    renderPlaneWithTeam({
      tabActive: false,
      onboardingGuideStep: {
        step: 'open_brainstorm',
        anchor: 'brainstorm-module-tabs',
        messageKey: 'tabs.onboardingGuide.newRoom',
      },
    })

    expect(document.querySelector('.onboarding-coach-mark')).toBeNull()
  })
})
