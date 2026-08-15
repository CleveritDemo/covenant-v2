/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { SegmentedControl } from '../SegmentedControl'

afterEach(cleanup)

const OPTIONS = [
  { value: 'user', label: 'Member' },
  { value: 'admin', label: 'Admin' },
] as const

describe('SegmentedControl layout', () => {
  it('aplica segmented-control--hug con layout="hug"', () => {
    render(
      <SegmentedControl
        value="user"
        options={OPTIONS}
        onChange={() => {}}
        label="Role"
        layout="hug"
      />,
    )
    const group = screen.getByRole('radiogroup')
    expect(group.className).toContain('segmented-control--hug')
    expect(group.className).not.toContain('segmented-control--equal')
  })

  it('usa segmented-control--equal por defecto', () => {
    render(
      <SegmentedControl
        value="user"
        options={OPTIONS}
        onChange={() => {}}
        label="Role"
      />,
    )
    const group = screen.getByRole('radiogroup')
    expect(group.className).toContain('segmented-control--equal')
  })

  it('pinta .segmented-control__icon solo cuando la opción trae icon', () => {
    render(
      <SegmentedControl
        value="with"
        options={[
          { value: 'with', label: 'Con icono', icon: 'flag' },
          { value: 'without', label: 'Sin icono' },
        ]}
        onChange={() => {}}
        label="Icons"
      />,
    )
    const icons = document.querySelectorAll('.segmented-control__icon')
    expect(icons).toHaveLength(1)
  })
})
