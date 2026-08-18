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

// CodeMirror gira en su bucle de medición bajo jsdom (no hay layout). Lo que
// aquí se prueba es el cableado del cajón —leer, sembrar, guardar, recargar—,
// no el editor, que ya se usa en producción en el explorador.
vi.mock('../../terminal/explorer/FileCodeEditor', () => ({
  FileCodeEditor: ({ content, onChange }: {
    content: string
    onChange: (text: string) => void
  }) => (
    <textarea
      aria-label="mcp-config"
      value={content}
      onChange={event => onChange(event.target.value)}
    />
  ),
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
      diskContexts={[]}
      selectedContextIds={['ctx-a', 'ctx-b']}
      onClose={() => {}}
      onCommitIdentity={() => {}}
      onChangeCoordination={() => {}}
      onAcceptDelegationsChange={() => {}}
      onOrchestrationMaxRoundsChange={() => {}}
      onMaxDelegationsPerTurnChange={() => {}}
      onOrchestrationWorkStyleChange={() => {}}
      onChangeDelegateTo={() => {}}
      onChangeProvider={() => {}}
      onChangeFallbackProvider={() => {}}
      onChangeModel={() => {}}
      onChangePermission={() => {}}
      onChangeNativeSkills={() => {}}
      onChangeMcpsAllowed={() => {}}
      onToggleContext={() => {}}
      onOpenContextsModal={() => {}}
    />,
  )
}

beforeAll(() => {
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: {
      listAgentCliModels: vi.fn().mockResolvedValue({ models: [] }),
      listMcpServers: vi.fn().mockResolvedValue({
        servers: [
          { name: 'jira', transport: 'stdio' },
          { name: 'context7', transport: 'http' },
        ],
        file: '.mcp.json',
        unreadProjectServers: [],
      }),
      getConfig: vi.fn().mockResolvedValue({ themeId: 'tokyoNight' }),
      readMcpConfig: vi.fn().mockResolvedValue({
        ok: true,
        path: '/tmp/gravity-test/.mcp.json',
        exists: false,
        text: '',
      }),
      writeMcpConfig: vi.fn().mockResolvedValue({ ok: true, path: '/tmp/gravity-test/.mcp.json' }),
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

  it('un proveedor sin capacidades muestra los controles bloqueados con el motivo', async () => {
    // `cursor`: ninguno de los dos flags está verificado, así que la UI no
    // promete un acotado que no se aplicaría.
    renderModal()
    fireEvent.click(screen.getByRole('button', { name: /configTabCapabilities/ }))
    expect(screen.getByRole('button', { name: /nativeSkillsHint/ }).hasAttribute('disabled')).toBe(true)
    const reasons = [...document.querySelectorAll('.agent-config-settings__hint--warn')]
      .map(node => node.textContent).join(' ')
    expect(reasons).toContain('nativeSkillsUnsupported')
    // El motivo de MCP vive pegado a su control, no suelto entre párrafos.
    await waitFor(() => {
      expect(document.querySelector('.mcp-shelf__why')?.textContent).toContain('mcpUnsupported')
    })
    expect(document.querySelector('.mcp-shelf__mode-opt')?.hasAttribute('disabled')).toBe(true)
  })

  it('claude admite las dos: sin motivos y con las casillas de MCP activas', async () => {
    renderModal({ provider: 'claude' })
    fireEvent.click(screen.getByRole('button', { name: /configTabCapabilities/ }))
    expect(document.querySelector('.agent-config-settings__hint--warn')).toBeNull()
    // Las filas salen de la config real del CLI, no de escribir el nombre.
    expect(await screen.findByText('jira')).toBeTruthy()
    expect(screen.getByText('context7')).toBeTruthy()
    // Modo «solo estas» → aparecen las casillas, activas.
    fireEvent.click(screen.getByRole('radio', { name: /mcpModePick/ }))
    const boxes = await screen.findAllByRole('checkbox')
    expect(boxes.map(node => node.getAttribute('disabled'))).toEqual([null, null])
  })

  it('un proveedor sin la capacidad no ofrece elegir, pero dice qué usará', async () => {
    renderModal()
    fireEvent.click(screen.getByRole('button', { name: /configTabCapabilities/ }))
    const modes = await screen.findAllByRole('radio')
    expect(modes.every(node => node.hasAttribute('disabled'))).toBe(true)
    // Sin acotado no hay casillas que marcar: las filas son informativas.
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
  })

  it('el archivo de MCP se edita y se guarda sin salir de la app', async () => {
    renderModal({ provider: 'claude' })
    fireEvent.click(screen.getByRole('button', { name: /configTabCapabilities/ }))
    fireEvent.click(await screen.findByRole('button', { name: /mcpEditAction/ }))

    // Sin archivo en disco arranca con el esqueleto, ya válido y ya sucio.
    const editor = await screen.findByLabelText('mcp-config')
    expect((editor as HTMLTextAreaElement).value).toContain('mcpServers')
    expect(document.querySelector('.mcp-editor__status')?.textContent).toContain('mcpEditValid')

    const listsBefore = (window.api.listMcpServers as ReturnType<typeof vi.fn>).mock.calls.length
    fireEvent.click(screen.getByRole('button', { name: /mcpEditSave/ }))
    await waitFor(() => {
      expect(window.api.writeMcpConfig).toHaveBeenCalledWith(
        expect.objectContaining({ provider: 'claude', expected: '' }),
      )
    })
    // Guardar recarga las filas: la lista y el archivo no pueden divergir.
    await waitFor(() => {
      const calls = (window.api.listMcpServers as ReturnType<typeof vi.fn>).mock.calls.length
      expect(calls).toBe(listsBefore + 1)
    })
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

  it('el pie nombra el archivo del catálogo del proyecto también en workspace org', () => {
    render(
      <AgentConfigModal
        open
        meta={meta}
        cwd="/tmp/project"
        busy={false}
        diskContexts={[]}
        selectedContextIds={[]}
        onClose={() => {}}
        onCommitIdentity={() => true}
        onChangeCoordination={() => {}}
        onAcceptDelegationsChange={() => {}}
        onOrchestrationMaxRoundsChange={() => {}}
        onMaxDelegationsPerTurnChange={() => {}}
        onOrchestrationWorkStyleChange={() => {}}
        onChangeDelegateTo={() => {}}
        onChangeProvider={() => {}}
        onChangeFallbackProvider={() => {}}
        onChangeModel={() => {}}
        onChangePermission={() => {}}
        onChangeNativeSkills={() => {}}
        onChangeMcpsAllowed={() => {}}
        onToggleContext={() => {}}
        onOpenContextsModal={() => {}}
      />,
    )
    expect(screen.getByText(`${PROJECT_DIR}/agents/tech-lead.json`)).toBeTruthy()
    expect(screen.queryByText('agentPane.configSaveOrg')).toBeNull()
  })
})
