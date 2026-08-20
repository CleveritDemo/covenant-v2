/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { PlaneChatComposerAgents } from '../PlaneChatComposerAgents'
import type { PlaneChatAgentOption } from '../PlaneChatComposer'

afterEach(cleanup)

const agents: PlaneChatAgentOption[] = [
  { paneId: 'p1', title: 'Tech Lead' },
  { paneId: 'p2', title: 'Frontend' },
]

function renderRail(list: PlaneChatAgentOption[]): void {
  render(
    <PlaneChatComposerAgents
      agents={list}
      selectedAgentId={null}
      emptyAgentsHint="Sin agentes"
      sendLabel="Enviar"
      onSelectAgent={() => {}}
    />,
  )
}

describe('ancla composer-agents del coach mark', () => {
  it('va en el primer chip, no en el riel completo', () => {
    renderRail(agents)

    const anchor = document.querySelector('[data-onboarding="composer-agents"]')
    const slots = document.querySelectorAll('.plane-chat-composer__agent-slot')
    expect(anchor).toBe(slots[0])
    expect(slots).toHaveLength(2)
    expect(
      document.querySelector('.plane-chat-composer__agents-wrap')
        ?.getAttribute('data-onboarding'),
    ).toBeNull()
  })

  it('sin chips cae en el riel para no quedar sin ancla', () => {
    renderRail([])

    expect(
      document.querySelector('.plane-chat-composer__agents-wrap')
        ?.getAttribute('data-onboarding'),
    ).toBe('composer-agents')
  })
})
