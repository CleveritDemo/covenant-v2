/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PlaneColumnOverflowPill } from '../PlaneColumnOverflowPill'

vi.mock('@i18n/useT', () => ({
  useT: () => ({ t: (key: string) => key, i18n: { language: 'es' } }),
}))

afterEach(cleanup)

describe('PlaneColumnOverflowPill', () => {
  it('count=0 no renderiza nada', () => {
    const { container } = render(
      <PlaneColumnOverflowPill count={0} direction="down" onClick={vi.fn()} />,
    )

    expect(container.firstChild).toBeNull()
  })

  it("count=3 direction 'down' renderiza el botón con --down y dispara onClick", () => {
    const onClick = vi.fn()
    const { container } = render(
      <PlaneColumnOverflowPill count={3} direction="down" onClick={onClick} />,
    )

    const button = container.querySelector('.plane-column-overflow-pill--down')
    expect(button).toBeTruthy()
    expect(screen.getByText('tabs.planeColumnOverflowHidden')).toBeTruthy()

    fireEvent.click(button!, { bubbles: true })

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it("direction 'up' aplica la clase modificadora --up", () => {
    const { container } = render(
      <PlaneColumnOverflowPill count={2} direction="up" onClick={vi.fn()} />,
    )

    expect(container.querySelector('.plane-column-overflow-pill--up')).toBeTruthy()
    expect(container.querySelector('.plane-column-overflow-pill--down')).toBeNull()
  })
})
