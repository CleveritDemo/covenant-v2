/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { OrgsDetailSkeleton, OrgsNavSkeleton } from '../OrgsSkeleton'

afterEach(cleanup)

describe('OrgsNavSkeleton', () => {
  it('pinta N filas y expone role=status con aria-label', () => {
    const { container } = render(
      <OrgsNavSkeleton rows={5} label="Cargando organizaciones" />,
    )
    const list = container.querySelector('.orgs-skeleton')
    expect(list?.getAttribute('role')).toBe('status')
    expect(list?.getAttribute('aria-label')).toBe('Cargando organizaciones')
    expect(container.querySelectorAll('.orgs-skeleton__row')).toHaveLength(5)
  })

  it('con withAvatar pinta el círculo; sin él no', () => {
    const { container: withAvatar } = render(
      <OrgsNavSkeleton rows={2} withAvatar label="Con avatar" />,
    )
    expect(withAvatar.querySelectorAll('.skeleton--circle')).toHaveLength(2)

    const { container: plain } = render(
      <OrgsNavSkeleton rows={2} label="Sin avatar" />,
    )
    expect(plain.querySelector('.skeleton--circle')).toBeNull()
  })
})

describe('OrgsDetailSkeleton', () => {
  it('expone role=status con aria-label y dos secciones', () => {
    const { container } = render(
      <OrgsDetailSkeleton label="Cargando detalle" />,
    )
    const root = container.querySelector('.orgs-skeleton-detail')
    expect(root?.getAttribute('role')).toBe('status')
    expect(root?.getAttribute('aria-label')).toBe('Cargando detalle')
    expect(container.querySelectorAll('.orgs-skeleton-detail__section')).toHaveLength(2)
  })
})
