/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { CoordinationBadge } from '../CoordinationBadge'

afterEach(cleanup)

describe('CoordinationBadge', () => {
  it.each([
    ['orchestrator', 'Orchestrator'],
    ['productOwner', 'Product owner'],
  ] as const)('renderiza %s con aria-label y svg', (coordination, label) => {
    const { container } = render(
      <CoordinationBadge coordination={coordination} label={label} />,
    )
    const badge = screen.getByLabelText(label)
    expect(badge).toBeTruthy()
    expect(badge.querySelector('svg')).toBeTruthy()
    expect(container.querySelector('.coordination-badge--chip')).toBeTruthy()
  })

  it('aplica coordination-badge--inline con variant="inline"', () => {
    const { container } = render(
      <CoordinationBadge coordination="orchestrator" label="Orchestrator" variant="inline" />,
    )
    expect(container.querySelector('.coordination-badge--inline')).toBeTruthy()
    expect(container.querySelector('.coordination-badge--chip')).toBeNull()
  })

  it.each(['chip', 'inline'] as const)(
    'no renderiza nada con coordination="none" (variant=%s)',
    (variant) => {
      const { container } = render(
        <CoordinationBadge coordination="none" label="Specialist" variant={variant} />,
      )
      expect(container.firstChild).toBeNull()
      expect(screen.queryByLabelText('Specialist')).toBeNull()
    },
  )
})
