/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { AgentPaneMeta } from '@shared/tabSession'

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

function renderOrchestration(meta: Partial<AgentPaneMeta> = {}) {
  render(
    <AgentConfigSettingsPane
      section="orchestration"
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
      onChangeModel={noop}
      onChangePermission={noop}
      onChangeNativeSkills={noop}
      onChangeMcpsAllowed={noop}
      onToggleContext={noop}
      onOpenContextsModal={noop}
    />,
  )
}

afterEach(cleanup)

describe('AgentConfigSettingsPane orchestration caps', () => {
  it('oculta delegaciones por turno si el agente no coordina', () => {
    renderOrchestration({ coordination: 'none' })
    expect(screen.queryByText('agentPane.maxDelegationsPerTurnLabel')).toBeNull()
  })

  it('muestra delegaciones por turno para orquestador', () => {
    renderOrchestration({ coordination: 'orchestrator' })
    expect(screen.getByText('agentPane.maxDelegationsPerTurnLabel')).toBeTruthy()
  })
})
