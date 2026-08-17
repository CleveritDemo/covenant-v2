/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
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
vi.mock('../PlaneLoopsSection', () => ({ PlaneLoopsSection: () => null }))
vi.mock('../PlaneBrainstormTable', () => ({ PlaneBrainstormTable: () => null }))
vi.mock('../TabFileExplorerWindow', () => ({ TabFileExplorerWindow: () => null }))
vi.mock('../PulseView', () => ({ PulseView: () => null }))
vi.mock('../../components/ConfirmTerminalModal', () => ({ ConfirmTerminalModal: () => null }))

afterEach(cleanup)

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
