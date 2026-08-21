/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
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
vi.mock('../PlaneChatDock', () => ({ PlaneChatDock: () => null }))
vi.mock('../PlaneChatComposer', () => ({ PlaneChatComposer: () => null }))
vi.mock('../PlaneChatContextsBar', () => ({ PlaneChatContextsBar: () => null }))
vi.mock('../PlaneQuickChat', () => ({ PlaneQuickChat: () => null }))
vi.mock('../PlaneContextPool', () => ({ PlaneContextPool: () => null }))
vi.mock('../PlaneFabStack', () => ({ PlaneFabStack: () => null }))
vi.mock('../OnboardingCoachMark', () => ({ OnboardingCoachMark: () => null }))
vi.mock('../PlaneLoopsSection', () => ({
  PlaneLoopsSection: () => <div data-testid="plane-loops-section" />,
}))
vi.mock('../PlaneBrainstormTable', () => ({ PlaneBrainstormTable: () => null }))
vi.mock('../TabFileExplorerWindow', () => ({ TabFileExplorerWindow: () => null }))
vi.mock('../PulseView', () => ({ PulseView: () => null }))
vi.mock('../../components/ConfirmTerminalModal', () => ({ ConfirmTerminalModal: () => null }))

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
    startWikiSweep: vi.fn(),
    stopWikiSweep: vi.fn(),
    onWikiSweepEvent: vi.fn((_cwd: string, _cb: (event: unknown) => void) => () => undefined),
  }
})

afterEach(cleanup)

function hoverTooltip(el: HTMLElement): void {
  fireEvent.mouseEnter(el)
  act(() => { vi.advanceTimersByTime(400) })
}

const baseProps = {
  emptyTitle: '',
  emptyHint: '',
  agentFabTitle: '',
  terminalFabTitle: '',
  idleAgentLabel: '',
  chatPlaceholder: '',
  chatEmptyAgents: '',
  chatSendLabel: '',
  tabContexts: [],
  entities: [],
  agentStatuses: {},
  activePaneId: '',
  openChatAgentId: null,
  openChatThreads: [],
  gitRepos: [],
  loopChains: [],
  loopsOpen: false,
  loopsButtonLabel: 'loops',
  projectFolder: '/tmp/org-workspace',
  projectFolderSelectLabel: '',
  projectFolderChangeLabel: '',
  projectFolderEmptyHint: '',
  projectFolderRevealLabel: '',
  configLabel: '',
  deleteLabel: '',
  maximizeLabel: '',
  restoreLabel: '',
  closeWindowLabel: '',
  canAdd: false,
  renderPane: () => null,
  onOpenChatAgentChange: vi.fn(),
  onLoopsOpenChange: vi.fn(),
  onLoopChainsChange: vi.fn(),
  onStartLoopChain: vi.fn(),
  onStopLoopChain: vi.fn(),
  onSelectProjectFolder: vi.fn(),
  onMinimizeAllWindows: vi.fn(),
} as unknown as TabAgenticPlaneProps

describe('chrome org del plano', () => {
  it('muestra sincronizar y publicar cuando el tab es org-backed', () => {
    render(
      <TabAgenticPlane
        {...baseProps}
        canResyncWorkspace
        canUploadWorkspace
        resyncWorkspaceLabel="Sincronizar workspace"
        uploadWorkspaceLabel="Publicar cambios"
        onResyncWorkspace={vi.fn()}
        onUploadWorkspace={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'Sincronizar workspace' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Publicar cambios' })).toBeTruthy()
  })

  it('mantiene sincronizar visible junto a la barra de progreso de publicación', () => {
    const { container } = render(
      <TabAgenticPlane
        {...baseProps}
        canResyncWorkspace
        resyncWorkspaceLabel="Sincronizar workspace"
        onResyncWorkspace={vi.fn()}
        uploadWorkspaceProgress={42}
        onCancelUploadWorkspace={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'Sincronizar workspace' })).toBeTruthy()
    expect(screen.getByRole('progressbar')).toBeTruthy()
    expect(container.querySelector('.plane-top-left-workspace-actions')).toBeTruthy()
  })

  it('mantiene sincronizar visible al terminar la publicación', () => {
    const { rerender } = render(
      <TabAgenticPlane
        {...baseProps}
        canResyncWorkspace
        canUploadWorkspace
        resyncWorkspaceLabel="Sincronizar workspace"
        uploadWorkspaceLabel="Publicar cambios"
        onResyncWorkspace={vi.fn()}
        onUploadWorkspace={vi.fn()}
        uploadWorkspaceProgress={88}
        onCancelUploadWorkspace={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'Sincronizar workspace' })).toBeTruthy()

    rerender(
      <TabAgenticPlane
        {...baseProps}
        canResyncWorkspace
        canUploadWorkspace
        resyncWorkspaceLabel="Sincronizar workspace"
        uploadWorkspaceLabel="Publicar cambios"
        onResyncWorkspace={vi.fn()}
        onUploadWorkspace={vi.fn()}
        uploadWorkspaceProgress={null}
        onCancelUploadWorkspace={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'Sincronizar workspace' })).toBeTruthy()
    expect(screen.queryByRole('progressbar')).toBeNull()
  })

  it('muestra publicar a org en un tab local con carpeta', () => {
    const { container } = render(
      <TabAgenticPlane
        {...baseProps}
        canPromoteWorkspace
        promoteWorkspaceLabel="Publicar en organización"
        onPromoteWorkspace={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'Publicar en organización' })).toBeTruthy()
    expect(container.querySelector('.plane-top-left-workspace-actions')).toBeTruthy()
  })
})

describe('gate de publicación del plano', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('pinta publicar deshabilitado con hint de denegado cuando gate=denied', () => {
    render(
      <TabAgenticPlane
        {...baseProps}
        canUploadWorkspace={false}
        uploadWorkspaceGate="denied"
        uploadWorkspaceLabel="Publicar cambios"
        onUploadWorkspace={vi.fn()}
      />,
    )

    const upload = screen.getByRole('button', { name: 'Publicar cambios' }) as HTMLButtonElement
    expect(upload.disabled).toBe(true)
    hoverTooltip(upload)
    expect(screen.getByRole('tooltip').textContent).toContain('tabs.uploadWorkspaceDeniedHint')
  })

  it('sin uploadWorkspaceGate conserva el render de publicar de hoy', () => {
    const { rerender } = render(
      <TabAgenticPlane
        {...baseProps}
        canUploadWorkspace={false}
        uploadWorkspaceLabel="Publicar cambios"
        onUploadWorkspace={vi.fn()}
      />,
    )

    expect(screen.queryByRole('button', { name: 'Publicar cambios' })).toBeNull()

    rerender(
      <TabAgenticPlane
        {...baseProps}
        canUploadWorkspace
        uploadWorkspaceLabel="Publicar cambios"
        onUploadWorkspace={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'Publicar cambios' })).toBeTruthy()
  })

  it('el botón de actualizar permisos llama onRefreshPermissions', () => {
    const onRefreshPermissions = vi.fn()
    render(
      <TabAgenticPlane
        {...baseProps}
        canUploadWorkspace={false}
        uploadWorkspaceGate="denied"
        uploadWorkspaceLabel="Publicar cambios"
        onUploadWorkspace={vi.fn()}
        canRefreshPermissions
        onRefreshPermissions={onRefreshPermissions}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'tabs.refreshPermissionsButton' }))
    expect(onRefreshPermissions).toHaveBeenCalledTimes(1)
  })
})

/**
 * Organizations es una vista de la app entera, no del plano. Con la sala o el
 * mapa abiertos el chrome flotante sube a 675 para poder navegar por encima de
 * ellos, y quedaba flotando sobre Organizations. No se arregla con z-index —el
 * plano es su propio contexto de apilamiento por `container-type`—: se arregla
 * no dibujándolo mientras esa vista está encima.
 */
describe('chrome del plano bajo una vista de la app', () => {
  const floating = ['.plane-top-left-chrome', '.plane-tools-rail-shell']

  it('lo dibuja cuando el plano es la superficie visible', () => {
    const { container } = render(
      <TabAgenticPlane
        {...baseProps}
        canResyncWorkspace
        resyncWorkspaceLabel="Sincronizar workspace"
        onResyncWorkspace={vi.fn()}
      />,
    )

    for (const selector of floating) {
      expect(container.querySelector(selector), selector).toBeTruthy()
    }
  })

  it('lo retira con Organizations abierto', () => {
    const { container } = render(
      <TabAgenticPlane
        {...baseProps}
        appOverlayOpen
        canResyncWorkspace
        resyncWorkspaceLabel="Sincronizar workspace"
        onResyncWorkspace={vi.fn()}
      />,
    )

    for (const selector of floating) {
      expect(container.querySelector(selector), selector).toBeNull()
    }
  })
})

describe('chrome de onboarding in-plane', () => {
  it('oculta Pulse y wiki cuando hidePulse y hideWiki', () => {
    render(
      <TabAgenticPlane
        {...baseProps}
        hidePulse
        hideWiki
      />,
    )

    expect(screen.queryByRole('button', { name: 'pulse.button' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'tabs.wikiMapButton' })).toBeNull()
  })

  it('no monta Loops si hideLoops', () => {
    render(
      <TabAgenticPlane
        {...baseProps}
        hideLoops
        loopsOpen
      />,
    )

    expect(screen.queryByTestId('plane-loops-section')).toBeNull()
  })

  it('muestra el camino Planear con lock y business', () => {
    render(
      <TabAgenticPlane
        {...baseProps}
        onboardingLocked
        orchestratorPath="business"
      />,
    )

    expect(screen.getByText('tabs.pathPlan')).toBeTruthy()
    expect(screen.queryByText('tabs.pathExecute')).toBeNull()
  })

  it('muestra el camino Ejecutar con lock y engineer', () => {
    render(
      <TabAgenticPlane
        {...baseProps}
        onboardingLocked
        orchestratorPath="engineer"
      />,
    )

    expect(screen.getByText('tabs.pathExecute')).toBeTruthy()
    expect(screen.queryByText('tabs.pathPlan')).toBeNull()
  })

  it('no monta el badge de camino sin lock', () => {
    render(
      <TabAgenticPlane
        {...baseProps}
        orchestratorPath="business"
      />,
    )

    expect(screen.queryByText('tabs.pathPlan')).toBeNull()
    expect(screen.queryByText('tabs.pathExecute')).toBeNull()
  })
})
