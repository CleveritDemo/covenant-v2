/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PendingImageThumb } from '../PendingImageThumb'

vi.mock('@i18n/useT', () => ({
  useT: () => ({
    t: (key: string, vars?: { name?: string }) => {
      if (key === 'agentPane.imagePreviewOpen') return `Open ${vars?.name ?? ''}`
      if (key === 'agentPane.imageSketch') return 'Annotate'
      if (key === 'agentPane.removeImage') return 'Remove image'
      return key
    },
  }),
}))

afterEach(cleanup)

describe('PendingImageThumb', () => {
  it('with onSketch: preview shows Annotate, click calls once and closes modal', () => {
    const onSketch = vi.fn()
    render(
      <PendingImageThumb
        src="blob:test"
        name="shot.png"
        onSketch={onSketch}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Open shot.png' }))
    const annotate = screen.getByRole('button', { name: 'Annotate' })
    expect(annotate).toBeTruthy()

    fireEvent.click(annotate)
    expect(onSketch).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: 'Annotate' })).toBeNull()
  })

  it('without onSketch: preview has no Annotate button', () => {
    render(<PendingImageThumb src="blob:test" name="shot.png" />)

    fireEvent.click(screen.getByRole('button', { name: 'Open shot.png' }))
    expect(screen.queryByRole('button', { name: 'Annotate' })).toBeNull()
  })

  it('remove button works with and without onSketch', () => {
    const onRemove = vi.fn()
    const onSketch = vi.fn()

    const { rerender } = render(
      <PendingImageThumb
        src="blob:test"
        name="a.png"
        onRemove={onRemove}
        onSketch={onSketch}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Remove image' }))
    expect(onRemove).toHaveBeenCalledTimes(1)

    onRemove.mockClear()
    rerender(
      <PendingImageThumb
        src="blob:test"
        name="a.png"
        onRemove={onRemove}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Remove image' }))
    expect(onRemove).toHaveBeenCalledTimes(1)
  })
})
