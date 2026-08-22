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
      if (key === 'previewMention.open') return 'View preview'
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
    expect(document.querySelector('.chat-bubble--assistant')).not.toBeNull()
    expect(document.querySelector('.chat-bubble--solid')).toBeNull()
  })

  it('wraps delegation result follow-up cards in solid ChatBubble', () => {
    renderBubbles([
      {
        id: 'u-del',
        role: 'user',
        content: [
          '## Delegation result',
          'id: d1',
          'status: ok',
          'summary: Login form validated.',
          'toAgentId: frontend',
        ].join('\n'),
      },
    ])
    expect(document.querySelector('.delegation-card')).not.toBeNull()
    const solid = document.querySelectorAll('.chat-bubble--solid')
    expect(solid.length).toBeGreaterThan(0)
    expect(solid[0]?.classList.contains('chat-bubble--assistant')).toBe(true)
  })

  it('pinta el encargo de una delegación como tarjeta, no como texto literal', () => {
    renderBubbles([
      {
        id: 'u-brief',
        role: 'user',
        content: [
          '## Delegation brief',
          'from: tl',
          'to: frontend',
          'round: 1/3',
          'worktree: qa-2',
          '',
          'Revisa el `login`.',
          '',
          'Preferred context ids: Front-Rules',
        ].join('\n'),
      },
    ])
    expect(document.querySelector('.delegation-brief')).not.toBeNull()
    expect(document.querySelector('.agent-pane__bubble-plain')).toBeNull()
    // Markdown, no literal: el backtick del objetivo se vuelve código.
    expect(document.querySelector('.delegation-brief__objective code')?.textContent).toBe('login')
    // La línea de contextos sale del cuerpo y baja al pie como chip.
    expect(document.querySelector('.delegation-brief__objective')?.textContent)
      .not.toContain('Preferred context ids')
    const chips = document.querySelectorAll('.delegation-brief__chip')
    expect(chips).toHaveLength(2)
    expect(chips[0]?.textContent).toBe('Front-Rules')
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

describe('AgentChatBubbles reference action', () => {
  it('shows the reference button on an assistant bubble with content', () => {
    const onReferenceMessage = vi.fn()
    render(
      <AgentChatBubbles
        messages={[{ id: 'a-ref', role: 'assistant', content: 'Full reply body.' }]}
        busy={false}
        activeAssistantId={null}
        onReferenceMessage={onReferenceMessage}
      />,
    )
    const button = screen.getByRole('button', { name: 'agentPane.referenceBubble' })
    expect(button).toBeTruthy()
    fireEvent.click(button)
    expect(onReferenceMessage).toHaveBeenCalledTimes(1)
    expect(onReferenceMessage).toHaveBeenCalledWith('Full reply body.')
  })

  it('does not show the reference button on a user bubble', () => {
    render(
      <AgentChatBubbles
        messages={[{ id: 'u-ref', role: 'user', content: 'Hello there.' }]}
        busy={false}
        activeAssistantId={null}
        onReferenceMessage={vi.fn()}
      />,
    )
    expect(screen.queryByRole('button', { name: 'agentPane.referenceBubble' })).toBeNull()
  })

  it('does not show the reference button on the live bubble', () => {
    render(
      <AgentChatBubbles
        messages={[{ id: 'a-live', role: 'assistant', content: 'Streaming…' }]}
        busy
        activeAssistantId="a-live"
        onReferenceMessage={vi.fn()}
      />,
    )
    expect(screen.queryByRole('button', { name: 'agentPane.referenceBubble' })).toBeNull()
  })

  it('does not show the reference button on an assistant bubble without content', () => {
    render(
      <AgentChatBubbles
        messages={[{ id: 'a-empty', role: 'assistant', content: '' }]}
        busy={false}
        activeAssistantId={null}
        onReferenceMessage={vi.fn()}
      />,
    )
    expect(screen.queryByRole('button', { name: 'agentPane.referenceBubble' })).toBeNull()
  })

  it('does not show the reference button on a delegation follow-up row', () => {
    render(
      <AgentChatBubbles
        messages={[
          {
            id: 'u-del',
            role: 'user',
            content: [
              '## Delegation result',
              'id: d1',
              'status: ok',
              'summary: Login form validated.',
              'toAgentId: frontend',
            ].join('\n'),
          },
        ]}
        busy={false}
        activeAssistantId={null}
        onReferenceMessage={vi.fn()}
      />,
    )
    expect(document.querySelector('.delegation-card')).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'agentPane.referenceBubble' })).toBeNull()
  })

  it('paints the reference button when onReferenceMessage arrives after the first render', () => {
    const messages = [{ id: 'a-late', role: 'assistant' as const, content: 'Late callback.' }]
    const { rerender } = render(
      <AgentChatBubbles
        messages={messages}
        busy={false}
        activeAssistantId={null}
      />,
    )
    expect(screen.queryByRole('button', { name: 'agentPane.referenceBubble' })).toBeNull()
    rerender(
      <AgentChatBubbles
        messages={messages}
        busy={false}
        activeAssistantId={null}
        onReferenceMessage={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: 'agentPane.referenceBubble' })).toBeTruthy()
  })
})

describe('AgentChatBubbles preview mention', () => {
  const previewContent = 'Listo. Revisa `.gravity/previews/x.html` antes de integrar.'

  it('paints the preview chip and click calls onOpenPreview with the basename', () => {
    const onOpenPreview = vi.fn()
    render(
      <AgentChatBubbles
        messages={[{ id: 'a-preview', role: 'assistant', content: previewContent }]}
        busy={false}
        activeAssistantId={null}
        onOpenPreview={onOpenPreview}
      />,
    )
    const chip = screen.getByRole('button', { name: 'View preview' })
    expect(chip).toBeTruthy()
    expect(screen.getByText('x.html')).toBeTruthy()
    fireEvent.click(chip)
    expect(onOpenPreview).toHaveBeenCalledTimes(1)
    expect(onOpenPreview).toHaveBeenCalledWith('x.html')
  })

  it('does not paint the preview chip without onOpenPreview', () => {
    render(
      <AgentChatBubbles
        messages={[{ id: 'a-preview', role: 'assistant', content: previewContent }]}
        busy={false}
        activeAssistantId={null}
      />,
    )
    expect(screen.queryByRole('button', { name: 'View preview' })).toBeNull()
    expect(document.querySelector('.assistant-formatted-body__preview-mentions')).toBeNull()
  })

  it('does not paint the preview chip on the live bubble', () => {
    render(
      <AgentChatBubbles
        messages={[{ id: 'a-live-preview', role: 'assistant', content: previewContent }]}
        busy
        activeAssistantId="a-live-preview"
        onOpenPreview={vi.fn()}
      />,
    )
    expect(screen.queryByRole('button', { name: 'View preview' })).toBeNull()
  })

  it('paints the preview chip when onOpenPreview arrives after the first render', () => {
    const messages = [{ id: 'a-late-preview', role: 'assistant' as const, content: previewContent }]
    const { rerender } = render(
      <AgentChatBubbles
        messages={messages}
        busy={false}
        activeAssistantId={null}
      />,
    )
    expect(screen.queryByRole('button', { name: 'View preview' })).toBeNull()
    rerender(
      <AgentChatBubbles
        messages={messages}
        busy={false}
        activeAssistantId={null}
        onOpenPreview={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: 'View preview' })).toBeTruthy()
  })
})
