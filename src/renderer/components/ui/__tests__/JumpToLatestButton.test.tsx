/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { JumpToLatestButton } from '../JumpToLatestButton'

afterEach(cleanup)

describe('JumpToLatestButton', () => {
  it('shape pill muestra el texto del label', () => {
    render(
      <JumpToLatestButton shape="pill" label="Jump to latest" onClick={() => {}} />,
    )
    const btn = screen.getByRole('button', { name: 'Jump to latest' })
    expect(btn.textContent).toContain('Jump to latest')
  })

  it('shape icon no pinta el texto y expone aria-label', () => {
    render(
      <JumpToLatestButton label="Jump to latest" onClick={() => {}} />,
    )
    const btn = screen.getByRole('button', { name: 'Jump to latest' })
    expect(btn.getAttribute('aria-label')).toBe('Jump to latest')
    expect(btn.textContent).not.toContain('Jump to latest')
  })

  it('dispara onClick', () => {
    const onClick = vi.fn()
    render(<JumpToLatestButton label="Jump to latest" onClick={onClick} />)
    fireEvent.click(screen.getByRole('button', { name: 'Jump to latest' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
