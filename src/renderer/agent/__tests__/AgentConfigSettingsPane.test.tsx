/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { AgentCliProvider, AgentPaneMeta } from '@shared/tabSession'

vi.mock('@i18n/useT', () => ({
  useT: () => ({ t: (key: string) => key }),
}))

import { AgentConfigSettingsPane } from '../AgentConfigSettingsPane'

const baseMeta: AgentPaneMeta = {
  id: 'frontend',
  name: 'Frontend',
  role: 'frontend engineer',
  objective: 'Ship UI',
  rules: [],
  provider: 'cursor',
  permissionMode: 'auto',
}

const noop = () => {}

function renderSection(
  section: 'orchestration' | 'engine',
  meta: Partial<AgentPaneMeta> = {},
) {
  render(
    <AgentConfigSettingsPane
      section={section}
      meta={{ ...baseMeta, ...meta }}
      cwd="/tmp/project"
      locked={false}
      diskContexts={[]}
      selectedContextIds={[]}
      modelOptions={[]}
      onChangeCoordination={noop}
      onAcceptDelegationsChange={noop}
      onOrchestrationMaxRoundsChange={noop}
      onMaxDelegationsPerTurnChange={noop}
      onOrchestrationWorkStyleChange={noop}
      onChangeDelegateTo={noop}
      onChangeProvider={noop}
      onChangeFallbackProvider={noop}
      onChangeModel={noop}
      onChangeFallbackModel={noop}
      onChangePermission={noop}
      onChangeNativeSkills={noop}
      onChangeMcpsAllowed={noop}
      onToggleContext={noop}
      onOpenContextsModal={noop}
    />,
  )
}

function renderEngine(
  meta: Partial<AgentPaneMeta> = {},
  handlers: {
    onChangeProvider?: (provider: AgentCliProvider | undefined) => void
    onChangeFallbackProvider?: (provider: AgentCliProvider | undefined) => void
    onChangeFallbackModel?: (model: string) => void
    onChangeModel?: (model: string) => void
  } = {},
) {
  render(
    <AgentConfigSettingsPane
      section="engine"
      meta={{ ...baseMeta, ...meta }}
      cwd="/tmp/project"
      locked={false}
      diskContexts={[]}
      selectedContextIds={[]}
      modelOptions={[
        { id: 'gpt-4', label: 'GPT-4' },
      ]}
      onChangeCoordination={noop}
      onAcceptDelegationsChange={noop}
      onOrchestrationMaxRoundsChange={noop}
      onMaxDelegationsPerTurnChange={noop}
      onOrchestrationWorkStyleChange={noop}
      onChangeDelegateTo={noop}
      onChangeProvider={handlers.onChangeProvider ?? noop}
      onChangeFallbackProvider={handlers.onChangeFallbackProvider ?? noop}
      onChangeModel={handlers.onChangeModel ?? noop}
      onChangeFallbackModel={handlers.onChangeFallbackModel ?? noop}
      onChangePermission={noop}
      onChangeNativeSkills={noop}
      onChangeMcpsAllowed={noop}
      onToggleContext={noop}
      onOpenContextsModal={noop}
    />,
  )
}

beforeEach(() => {
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: {
      listAgentCliModels: vi.fn(async () => ({
        models: [{ id: 'claude-sonnet', label: 'Claude Sonnet' }],
        error: '',
      })),
    },
  })
})

afterEach(cleanup)

describe('AgentConfigSettingsPane orchestration caps', () => {
  it('oculta delegaciones por turno si el agente no coordina', () => {
    renderSection('orchestration', { coordination: 'none' })
    expect(screen.queryByText('agentPane.maxDelegationsPerTurnLabel')).toBeNull()
  })

  it('muestra delegaciones por turno para orquestador', () => {
    renderSection('orchestration', { coordination: 'orchestrator' })
    expect(screen.getByText('agentPane.maxDelegationsPerTurnLabel')).toBeTruthy()
  })
})

describe('AgentConfigSettingsPane engine fallback', () => {
  it('sin respaldo muestra fallbackNone y no el Select de modelo del respaldo', () => {
    renderEngine()
    expect(screen.getByText('agentPane.fallbackNone')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'agentPane.fallbackModelLabel' })).toBeNull()
  })

  it('con respaldo elegido renderiza el Select de modelo del respaldo', () => {
    renderEngine({ fallbackProvider: 'claude' })
    expect(screen.queryByText('agentPane.fallbackNone')).toBeNull()
    expect(screen.getByRole('button', { name: 'agentPane.fallbackModelLabel' })).toBeTruthy()
  })

  it('pulsar una card libre llama onChangeFallbackProvider con ese proveedor', () => {
    const onChangeFallbackProvider = vi.fn()
    const onChangeProvider = vi.fn()
    renderEngine({}, { onChangeFallbackProvider, onChangeProvider })
    fireEvent.click(screen.getByRole('button', { name: /Claude/i }))
    expect(onChangeFallbackProvider).toHaveBeenCalledWith('claude')
    expect(onChangeProvider).not.toHaveBeenCalled()
  })

  it('pulsar la card del respaldo llama onChangeFallbackProvider con undefined', () => {
    const onChangeFallbackProvider = vi.fn()
    renderEngine({ fallbackProvider: 'claude' }, { onChangeFallbackProvider })
    fireEvent.click(screen.getByRole('button', { name: /Claude/i }))
    expect(onChangeFallbackProvider).toHaveBeenCalledWith(undefined)
  })

  it('pulsar el primario sin respaldo lo quita', () => {
    const onChangeProvider = vi.fn()
    renderEngine({}, { onChangeProvider })
    fireEvent.click(screen.getByRole('button', { name: /Cursor/i }))
    expect(onChangeProvider).toHaveBeenCalledWith(undefined)
  })

  it('pulsar el primario con respaldo promueve el respaldo', () => {
    const onChangeProvider = vi.fn()
    const onChangeFallbackProvider = vi.fn()
    const onChangeModel = vi.fn()
    renderEngine(
      { fallbackProvider: 'claude', fallbackModel: 'sonnet', model: 'gpt-4' },
      { onChangeProvider, onChangeFallbackProvider, onChangeModel },
    )
    fireEvent.click(screen.getByRole('button', { name: /Cursor/i }))
    expect(onChangeProvider).toHaveBeenCalledWith('claude')
    expect(onChangeFallbackProvider).toHaveBeenCalledWith(undefined)
    expect(onChangeModel).toHaveBeenCalledWith('sonnet')
  })

  it('sin primario, la card libre llama onChangeProvider', () => {
    const onChangeProvider = vi.fn()
    const onChangeFallbackProvider = vi.fn()
    renderEngine({ provider: undefined }, { onChangeProvider, onChangeFallbackProvider })
    fireEvent.click(screen.getByRole('button', { name: /Claude/i }))
    expect(onChangeProvider).toHaveBeenCalledWith('claude')
    expect(onChangeFallbackProvider).not.toHaveBeenCalled()
  })
})
