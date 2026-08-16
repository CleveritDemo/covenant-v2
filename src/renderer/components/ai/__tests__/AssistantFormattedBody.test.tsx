/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AssistantFormattedBody } from '../AssistantFormattedBody'

vi.mock('@i18n/useT', () => ({
  useT: () => ({
    t: (key: string) =>
      key === 'agentPane.assemblingDelegation' ? 'Armando delegación…' : key,
  }),
}))

afterEach(() => {
  cleanup()
})

const OPEN_DELEGATE = [
  'Visible.',
  '```ia-terminal-delegate',
  '{"delegations":[{"agentId":"a1","prompt":"do it"}]}',
].join('\n')

describe('AssistantFormattedBody delegate fences', () => {
  it('shows assembling placeholder for open ia-terminal-delegate while live', () => {
    render(<AssistantFormattedBody content={OPEN_DELEGATE} live />)
    expect(screen.getByText('Visible.')).toBeTruthy()
    expect(document.querySelector('.ai-code-block')).toBeNull()
    expect(screen.queryByText(/"delegations"/)).toBeNull()
    expect(screen.queryByText(/"agentId"/)).toBeNull()
    expect(screen.getByRole('status')).toBeTruthy()
    expect(screen.getByText('Armando delegación…')).toBeTruthy()
    expect(document.querySelector('.delegation-assembling')).not.toBeNull()
    expect(document.querySelector('.chat-bubble--solid')).toBeNull()
  })

  it('hides ia-terminal-delegate when not live', () => {
    render(<AssistantFormattedBody content={OPEN_DELEGATE} live={false} />)
    expect(screen.getByText('Visible.')).toBeTruthy()
    expect(document.querySelector('.ai-code-block')).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.queryByText(/ia-terminal-delegate/)).toBeNull()
    expect(screen.queryByText(/"delegations"/)).toBeNull()
    expect(screen.queryByText('Armando delegación…')).toBeNull()
  })

  it('envuelve bloques de código en ChatBubble solid con resaltado', () => {
    const body = ['Texto previo.', '```typescript', 'const ready = true', '```'].join('\n')
    render(<AssistantFormattedBody content={body} live={false} />)
    expect(screen.getByText('Texto previo.')).toBeTruthy()
    const solid = document.querySelectorAll('.chat-bubble--solid')
    expect(solid.length).toBe(1)
    expect(document.querySelector('.chat-bubble--solid .ai-code-block')).not.toBeNull()
    expect(document.querySelector('.chat-bubble--solid .ai-tok-keyword')).not.toBeNull()
  })

  it('hides ia-terminal-results even while live; delegate shows placeholder', () => {
    const mixed = [
      'Hi',
      '```ia-terminal-results',
      '{"summary":"hidden"}',
      '```',
      '```ia-terminal-delegate',
      '{"delegations":[]}',
    ].join('\n')
    render(<AssistantFormattedBody content={mixed} live />)
    expect(screen.queryByText(/ia-terminal-results/)).toBeNull()
    expect(screen.queryByText(/"summary":"hidden"/)).toBeNull()
    expect(document.querySelector('.ai-code-block')).toBeNull()
    expect(screen.getByRole('status')).toBeTruthy()
    expect(screen.getByText('Armando delegación…')).toBeTruthy()
  })
})
