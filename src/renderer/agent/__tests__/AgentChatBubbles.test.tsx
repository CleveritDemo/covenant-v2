/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AgentChatBubbles } from '../AgentChatBubbles'
import type { AgentChatEntry } from '@shared/agentCliTypes'

vi.mock('@i18n/useT', () => ({
  useT: () => ({
    t: (key: string) => {
      if (key === 'agentPane.showMore') return 'Show more'
      if (key === 'agentPane.showLess') return 'Show less'
      return key
    },
  }),
}))

vi.mock('../Gravity', () => ({
  Gravity: () => <span data-testid="gravity" />,
}))

afterEach(() => {
  cleanup()
})

function renderBubbles(messages: AgentChatEntry[], busy = false, activeAssistantId: string | null = null) {
  return render(
    <AgentChatBubbles
      messages={messages}
      busy={busy}
      activeAssistantId={activeAssistantId}
    />,
  )
}

describe('AgentChatBubbles markdown + collapse', () => {
  it('renders a user ```ts fence as a code block, not literal backticks', () => {
    renderBubbles([
      {
        id: 'u1',
        role: 'user',
        content: 'Look:\n```ts\nconst x = 1\n```\nDone.',
      },
    ])
    expect(document.querySelector('.ai-code-block')).not.toBeNull()
    expect(document.querySelector('.ai-code-lang')?.textContent).toBe('ts')
    expect(document.querySelector('.ai-code-pre')?.textContent).toContain('const x = 1')
    expect(screen.queryByText(/```ts/)).toBeNull()
  })

  it('renders a user numbered list as <ol>', () => {
    renderBubbles([
      {
        id: 'u2',
        role: 'user',
        content: '1. First\n2. Second\n3. Third',
      },
    ])
    const list = document.querySelector('ol.ai-md__ol')
    expect(list).not.toBeNull()
    expect(list?.querySelectorAll('li')).toHaveLength(3)
  })

  it('does not show Show more for a short user message', () => {
    renderBubbles([
      {
        id: 'u3',
        role: 'user',
        content: 'Short objective.',
      },
    ])
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull()
  })

  it('shows Show more for a long user message and reveals all on expand', () => {
    const long = Array.from({ length: 40 }, (_, i) => `Line ${i + 1} of the delegation objective.`).join('\n')
    renderBubbles([
      {
        id: 'u4',
        role: 'user',
        content: long,
      },
    ])
    const more = screen.getByRole('button', { name: 'Show more' })
    expect(more).toBeTruthy()
    expect(document.querySelector('.agent-pane__bubble-body--collapsed')).not.toBeNull()
    fireEvent.click(more)
    expect(screen.getByRole('button', { name: 'Show less' })).toBeTruthy()
    expect(document.querySelector('.agent-pane__bubble-body--collapsed')).toBeNull()
    expect(screen.getByText(/Line 40 of the delegation objective/)).toBeTruthy()
  })

  it('hides agent control fences in assistant messages', () => {
    renderBubbles([
      {
        id: 'a1',
        role: 'assistant',
        content: [
          'Visible reply.',
          '```ia-terminal-results',
          '{"summary":"hidden"}',
          '```',
          'After.',
        ].join('\n'),
      },
    ])
    expect(screen.getByText('Visible reply.')).toBeTruthy()
    expect(screen.getByText('After.')).toBeTruthy()
    expect(screen.queryByText(/ia-terminal-results/)).toBeNull()
    expect(screen.queryByText(/"summary":"hidden"/)).toBeNull()
  })
})
