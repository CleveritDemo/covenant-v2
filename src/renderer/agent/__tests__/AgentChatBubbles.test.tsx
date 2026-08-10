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
  it('renders user content as plain text (no Markdown, no code blocks)', () => {
    renderBubbles([
      {
        id: 'u1',
        role: 'user',
        content: 'Look:\n```js\nconst x = 1\n```\n**hola**',
      },
    ])
    const plain = document.querySelector('.agent-pane__bubble-plain')
    expect(plain).not.toBeNull()
    expect(plain?.textContent).toBe('Look:\n```js\nconst x = 1\n```\n**hola**')
    expect(document.querySelector('.ai-code-block')).toBeNull()
    expect(document.querySelector('strong')).toBeNull()
    expect(document.querySelector('.ai-md')).toBeNull()
  })

  it('keeps Markdown for assistant messages', () => {
    renderBubbles([
      {
        id: 'a0',
        role: 'assistant',
        content: '**hola**',
      },
    ])
    expect(document.querySelector('strong')?.textContent).toBe('hola')
    expect(document.querySelector('.agent-pane__bubble-plain')).toBeNull()
  })

  it('keeps user sentence punctuation in one plain block (no AiMarkdown split)', () => {
    renderBubbles([
      {
        id: 'u-sentences',
        role: 'user',
        content: 'Uno. Dos. Tres.',
      },
    ])
    const plain = document.querySelector('.agent-pane__bubble-plain')
    expect(plain).not.toBeNull()
    expect(plain?.textContent).toBe('Uno. Dos. Tres.')
    expect(document.querySelector('.ai-md')).toBeNull()
    expect(document.querySelectorAll('.ai-md__p')).toHaveLength(0)
  })

  it('splits assistant sentences into separate markdown paragraphs', () => {
    renderBubbles([
      {
        id: 'a-sentences',
        role: 'assistant',
        content: 'Uno. Dos. Tres.',
      },
    ])
    expect(document.querySelector('.agent-pane__bubble-plain')).toBeNull()
    const paragraphs = document.querySelectorAll('.ai-md__p')
    expect(paragraphs).toHaveLength(3)
    expect(paragraphs[0]?.textContent).toBe('Uno.')
    expect(paragraphs[1]?.textContent).toBe('Dos.')
    expect(paragraphs[2]?.textContent).toBe('Tres.')
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

  it('does not show Show more for a single long latest message', () => {
    const long = Array.from({ length: 40 }, (_, i) => `Line ${i + 1} of the delegation objective.`).join('\n')
    renderBubbles([
      {
        id: 'u4',
        role: 'user',
        content: long,
      },
    ])
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull()
    expect(document.querySelector('.agent-pane__bubble-body--collapsed')).toBeNull()
    expect(screen.getByText(/Line 40 of the delegation objective/)).toBeTruthy()
  })

  it('shows Show more only on a long earlier message, not the latest', () => {
    const long = Array.from({ length: 40 }, (_, i) => `Line ${i + 1} of the delegation objective.`).join('\n')
    renderBubbles([
      {
        id: 'u4',
        role: 'user',
        content: long,
      },
      {
        id: 'a2',
        role: 'assistant',
        content: 'Short reply.',
      },
    ])
    const more = screen.getByRole('button', { name: 'Show more' })
    expect(more).toBeTruthy()
    expect(document.querySelector('.agent-pane__bubble-body--collapsed')).not.toBeNull()
    fireEvent.click(more)
    expect(screen.getByRole('button', { name: 'Show less' })).toBeTruthy()
    expect(document.querySelector('.agent-pane__bubble-body--collapsed')).toBeNull()
    expect(screen.getByText(/Line 40 of the delegation objective/)).toBeTruthy()
    expect(screen.getByText('Short reply.')).toBeTruthy()
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
