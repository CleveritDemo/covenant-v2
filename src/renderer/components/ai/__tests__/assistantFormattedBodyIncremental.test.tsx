/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as assistantBodySegments from '../assistantBodySegments'
import * as aiMarkdown from '../../AiMarkdown'
import { AssistantFormattedBody } from '../AssistantFormattedBody'

vi.mock('@i18n/useT', () => ({
  useT: () => ({
    t: (key: string) =>
      key === 'agentPane.assemblingDelegation' ? 'Armando delegación…' : key,
  }),
}))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const OPEN_DELEGATE = [
  'Visible.',
  '```ia-terminal-delegate',
  '{"delegations":[{"agentId":"a1","prompt":"do it"}]}',
].join('\n')

describe('AssistantFormattedBody incremental streaming', () => {
  it('re-parses only the live suffix as content grows token by token', () => {
    const splitSpy = vi.spyOn(assistantBodySegments, 'splitAssistantBody')
    const parseSpy = vi.spyOn(aiMarkdown, 'parseAiMarkdownBlocks')

    const tokens = 'Hello world.\n\nSecond paragraph.'.split('')
    let content = ''
    let stableLength = 0

    for (const token of tokens) {
      splitSpy.mockClear()
      parseSpy.mockClear()
      content += token
      render(<AssistantFormattedBody content={content} live />)

      const liveStart = assistantBodySegments.findAssistantBodyLiveStart(
        assistantBodySegments.stripAgentControlFences(content, { keepDelegateFences: true }),
      )
      if (liveStart > stableLength) stableLength = liveStart

      for (const [arg] of splitSpy.mock.calls) {
        if (stableLength > 0) {
          expect(arg.length).toBeLessThanOrEqual(content.length - stableLength)
        }
      }

      if (content.includes('\n\nSecond')) {
        for (const [arg] of parseSpy.mock.calls) {
          expect(arg).not.toContain('Hello world.')
        }
      }
    }

    expect(content).toBe('Hello world.\n\nSecond paragraph.')
  })

  it('keeps DelegationAssemblingPlaceholder for open ia-terminal-delegate while live', () => {
    render(<AssistantFormattedBody content={OPEN_DELEGATE} live />)
    expect(screen.getByText('Visible.')).toBeTruthy()
    expect(document.querySelector('.ai-code-block')).toBeNull()
    expect(screen.queryByText(/"delegations"/)).toBeNull()
    expect(screen.getByRole('status')).toBeTruthy()
    expect(screen.getByText('Armando delegación…')).toBeTruthy()
    expect(document.querySelector('.delegation-assembling')).not.toBeNull()
  })
})
