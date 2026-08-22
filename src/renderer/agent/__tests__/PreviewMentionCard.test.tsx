/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PreviewMentionCard } from '../PreviewMentionCard'

vi.mock('../../components/ui/Icon', () => ({
  Icon: () => <span data-testid="icon-eye" />,
}))

vi.mock('../../components/ui/Tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

afterEach(() => cleanup())

describe('PreviewMentionCard', () => {
  it('pinta label y fileName', () => {
    render(
      <PreviewMentionCard
        fileName="a.html"
        label="View preview"
        onOpen={vi.fn()}
      />,
    )
    expect(screen.getByText('View preview')).toBeTruthy()
    expect(screen.getByText('a.html')).toBeTruthy()
  })

  it('click llama onOpen con el fileName', () => {
    const onOpen = vi.fn()
    render(
      <PreviewMentionCard
        fileName="a.html"
        label="View preview"
        onOpen={onOpen}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'View preview' }))
    expect(onOpen).toHaveBeenCalledWith('a.html')
  })

  it('disabled no dispara onOpen', () => {
    const onOpen = vi.fn()
    render(
      <PreviewMentionCard
        fileName="a.html"
        label="View preview"
        onOpen={onOpen}
        disabled
        disabledTitle="Choose a folder"
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'View preview' }))
    expect(onOpen).not.toHaveBeenCalled()
  })
})
