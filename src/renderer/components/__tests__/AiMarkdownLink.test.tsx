/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { AiMarkdown } from '../AiMarkdown'

vi.mock('@i18n/useT', () => ({
  useT: () => ({
    t: (key: string) => (key === 'aiCodeBlock.copyLinkLabel' ? 'Copy link' : key),
  }),
}))

describe('AiMarkdown · copy link', () => {
  const openExternalUrl = vi.fn()
  const writeText = vi.fn()

  beforeEach(() => {
    openExternalUrl.mockReset()
    openExternalUrl.mockResolvedValue({ ok: true })
    writeText.mockReset()
    writeText.mockResolvedValue(undefined)
    ;(window as unknown as { api: Record<string, unknown> }).api = { openExternalUrl }
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('copies the href without opening the URL', () => {
    render(<AiMarkdown content={'[PR listo](https://github.com/acme/repo/pull/3)'} />)
    const copy = screen.getByRole('button', { name: 'Copy link' })
    fireEvent.click(copy)
    expect(writeText).toHaveBeenCalledWith('https://github.com/acme/repo/pull/3')
    expect(openExternalUrl).not.toHaveBeenCalled()
  })
})
