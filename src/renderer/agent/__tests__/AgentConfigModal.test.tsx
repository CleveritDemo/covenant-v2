/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { AgentPaneMeta } from '@shared/tabSession'

vi.mock('@i18n/useT', () => ({
  useT: () => ({
    t: (key: string, vars?: Record<string, unknown>) => (
      vars ? `${key}:${Object.values(vars).join(',')}` : key
    ),
  }),
}))

vi.mock('../../components/TerminalModal', () => ({
  TerminalModal: ({
    open,
    children,
    headerContent,
    footer,
  }: {
    open: boolean
    children: React.ReactNode
    headerContent?: React.ReactNode
    footer?: React.ReactNode
  }) => (open ? (
    <div>
      <div>{headerContent}</div>
      {children}
      <div>{footer}</div>
    </div>
  ) : null),
}))

import { AgentConfigModal } from '../AgentConfigModal'
import { PROJECT_DIR } from '@shared/projectDir'

const meta: AgentPaneMeta = {
  id: 'tech-lead',
  name: 'Tech Lead',
  role: 'technical leader',
  objective: 'Coordinate the plane',
  rules: ['no commits without tests'],
  provider: 'cursor',
  permissionMode: 'auto',
}

function renderModal(
  overrides: Partial<AgentPaneMeta> = {},
  { busy = false }: { busy?: boolean } = {},
): void {
  render(
    <AgentConfigModal
      open
      meta={{ ...meta, ...overrides }}
      cwd="/tmp/project"
      busy={busy}
      loopMode={false}
      loopActive={false}
      diskContexts={[]}
      selectedContextIds={['ctx-a', 'ctx-b']}
      contextNotice=""
      onClose={() => {}}
      onCommitIdentity={() => {}}
      onChangeCoordination={() => {}}
      onAcceptDelegationsChange={() => {}}
      onAllowExpertReplicasChange={() => {}}
      onOrchestrationMaxRoundsChange={() => {}}
      onChangeDelegateTo={() => {}}
      onChangeProvider={() => {}}
      onChangeModel={() => {}}
      onChangePermission={() => {}}
      onChangeNativeSkills={() => {}}
      onChangeMcpsAllowed={() => {}}
      onToggleLoopMode={() => {}}
      onToggleContext={() => {}}
      onOpenContextsModal={() => {}}
      onAutoImproveChange={() => {}}
    />,
  )
}

beforeAll(() => {
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: {
      listAgentCliModels: vi.fn().mockResolvedValue({ models: [] }),
      listMcpServers: vi.fn().mockResolvedValue([
        { name: 'jira', transport: 'stdio' },
        { name: 'context7', transport: 'http' },
      ]),
      resolveAgentCli: vi.fn().mockImplementation((provider: string) => Promise.resolve(
        provider === 'gemini'
          ? { provider, command: 'gemini', path: null, version: null }
          : { provider, command: provider, path: `/usr/local/bin/${provider}`, version: '1.2.3' },
      )),
    },
  })
})

afterEach(cleanup)

describe('AgentConfigModal', () => {
  it('lista las ocho secciones y arranca en Identidad', () => {
    renderModal()
    const rail = screen.getByRole('navigation')
    expect(rail.querySelectorAll('button')).toHaveLength(8)
    expect(screen.getByRole('button', { name: /identityLabel/ }).getAttribute('aria-current')).toBe('true')
    // La sección de identidad, no el motor.
    expect(screen.getByText('agentPane.nameLabel')).toBeTruthy()
    expect(screen.queryByText('agentPane.providerLabel')).toBeNull()
  })

  it('marca permisos Auto en el índice y en la cabecera', () => {
    renderModal()
    expect(screen.getByRole('button', { name: /configTabPermissions/ })
      .querySelector('.agent-config-rail__badge--warn')).toBeTruthy()
    expect(document.querySelector('.agent-config-hero__chip--warn')?.textContent)
      .toBe('agentPane.configChipPermissionAuto')
  })

  it('el chip de la cabecera navega a su sección', () => {
    renderModal()
    fireEvent.click(document.querySelector('.agent-config-hero__chip--warn') as HTMLElement)
    expect(screen.getByRole('radio', { name: /permissionAuto/ }).getAttribute('aria-checked')).toBe('true')
    expect(screen.queryByText('agentPane.nameLabel')).toBeNull()
  })

  it('un proveedor sin capacidades muestra los controles bloqueados con el motivo', () => {
    // `cursor`: ninguno de los dos flags está verificado, así que la UI no
    // promete un acotado que no se aplicaría.
    renderModal()
    fireEvent.click(screen.getByRole('button', { name: /configTabCapabilities/ }))
    expect(screen.getByRole('button', { name: /nativeSkillsHint/ }).hasAttribute('disabled')).toBe(true)
    const reasons = [...document.querySelectorAll('.agent-config-settings__hint--warn')]
      .map(node => node.textContent).join(' ')
    expect(reasons).toContain('nativeSkillsUnsupported')
    expect(reasons).toContain('mcpsUnsupported')
  })

  it('claude admite las dos: sin motivos y con las casillas de MCP activas', async () => {
    renderModal({ provider: 'claude' })
    fireEvent.click(screen.getByRole('button', { name: /configTabCapabilities/ }))
    expect(document.querySelector('.agent-config-settings__hint--warn')).toBeNull()
    // Las casillas salen de la config real del CLI, no de escribir el nombre.
    const options = await screen.findAllByRole('option')
    expect(options.map(node => node.getAttribute('disabled'))).toEqual([null, null])
    expect(screen.getByText('jira')).toBeTruthy()
    expect(screen.getByText('context7')).toBeTruthy()
  })

  it('un proveedor sin la capacidad enseña las casillas deshabilitadas', async () => {
    renderModal()
    fireEvent.click(screen.getByRole('button', { name: /configTabCapabilities/ }))
    const options = await screen.findAllByRole('option')
    expect(options.every(node => node.hasAttribute('disabled'))).toBe(true)
  })

  it('cuenta reglas y contextos seleccionados en el índice', () => {
    renderModal()
    const rules = screen.getByRole('button', { name: /rulesLabel/ })
    expect(rules.querySelector('.agent-config-rail__count')?.textContent).toBe('1')
    const contexts = screen.getByRole('button', { name: /configTabContexts/ })
    expect(contexts.querySelector('.agent-config-rail__count')?.textContent).toBe('2')
  })

  it('avisa cuando el CLI del proveedor no está en el PATH', async () => {
    renderModal({ provider: 'gemini' })
    fireEvent.click(screen.getByRole('button', { name: /configTabRuntime/ }))
    await waitFor(() => {
      expect(document.querySelector('.agent-config-settings__hint--warn')?.textContent)
        .toContain('providerMissingHint')
    })
    expect(document.querySelector('.agent-config-hero__chip--warn')).toBeTruthy()
  })

  it('en ejecución solo bloquea el slug; nombre y rol siguen editables', () => {
    renderModal({}, { busy: true })
    expect(screen.getByLabelText('agentPane.nameLabel').hasAttribute('disabled')).toBe(false)
    expect(screen.getByLabelText(/agentPane.slugLabel/).hasAttribute('disabled')).toBe(true)
    expect(screen.getByText('agentPane.appliesNextTurn')).toBeTruthy()
  })

  it('el monograma es editable y sugiere el derivado del nombre', () => {
    renderModal()
    const mono = screen.getByLabelText('agentPane.monogramLabel') as HTMLInputElement
    expect(mono.value).toBe('')
    expect(mono.placeholder).toBe('TL')
    expect(mono.maxLength).toBe(2)
    fireEvent.change(mono, { target: { value: 'be' } })
    expect((screen.getByLabelText('agentPane.monogramLabel') as HTMLInputElement).value).toBe('be')
  })

  it('descartar devuelve el borrador a lo guardado', () => {
    renderModal()
    const name = screen.getByLabelText('agentPane.nameLabel') as HTMLInputElement
    fireEvent.change(name, { target: { value: 'Otro' } })
    fireEvent.click(screen.getByRole('button', { name: 'agentPane.discardDraft' }))
    expect((screen.getByLabelText('agentPane.nameLabel') as HTMLInputElement).value).toBe('Tech Lead')
    expect(screen.queryByRole('button', { name: 'agentPane.discardDraft' })).toBeNull()
  })

  it('una plantilla rellena objetivo y reglas cuando están vacíos', () => {
    renderModal({ objective: '', rules: [] })
    fireEvent.click(screen.getByRole('button', { name: /objectiveLabel/ }))
    fireEvent.click(screen.getByRole('button', { name: 'agentPane.templateReviewerLabel' }))
    expect(document.querySelector('textarea')?.value)
      .toBe('agentPane.templateReviewerObjective')
    expect(screen.getByRole('button', { name: /rulesLabel/ })
      .querySelector('.agent-config-rail__count')?.textContent).toBe('3')
  })

  it('el pie nombra el archivo del catálogo del proyecto', () => {
    renderModal()
    expect(screen.getByText(`${PROJECT_DIR}/agents/tech-lead.json`)).toBeTruthy()
  })

  it('en workspace org el pie apunta a Covenant, no al JSON local', () => {
    render(
      <AgentConfigModal
        open
        meta={meta}
        cwd="/tmp/project"
        busy={false}
        loopMode={false}
        loopActive={false}
        diskContexts={[]}
        selectedContextIds={[]}
        contextNotice=""
        orgWorkspace={{ slug: 'rodrigoanti', workspaceId: 'ws-1' }}
        onClose={() => {}}
        onCommitIdentity={() => true}
        onChangeCoordination={() => {}}
        onAcceptDelegationsChange={() => {}}
        onAllowExpertReplicasChange={() => {}}
        onOrchestrationMaxRoundsChange={() => {}}
        onChangeDelegateTo={() => {}}
        onChangeProvider={() => {}}
        onChangeModel={() => {}}
        onChangePermission={() => {}}
        onChangeNativeSkills={() => {}}
        onChangeMcpsAllowed={() => {}}
        onToggleLoopMode={() => {}}
        onToggleContext={() => {}}
        onOpenContextsModal={() => {}}
        onAutoImproveChange={() => {}}
      />,
    )
    expect(screen.getByText('agentPane.configSaveOrg')).toBeTruthy()
    expect(screen.queryByText(`${PROJECT_DIR}/agents/tech-lead.json`)).toBeNull()
  })
})
