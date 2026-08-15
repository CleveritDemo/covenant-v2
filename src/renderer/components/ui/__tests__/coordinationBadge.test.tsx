/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { AgentCoordination } from '@shared/agentOrchestration'
import { CoordinationBadge } from '../CoordinationBadge'

afterEach(cleanup)

const LABELS: Record<AgentCoordination, string> = {
  orchestrator: 'Orchestrator',
  productOwner: 'Product owner',
  none: 'Specialist',
}

describe('CoordinationBadge', () => {
  it.each(
    Object.entries(LABELS) as Array<[AgentCoordination, string]>,
  )('renderiza %s con aria-label y svg', (coordination, label) => {
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
      <CoordinationBadge coordination="none" label="Specialist" variant="inline" />,
    )
    expect(container.querySelector('.coordination-badge--inline')).toBeTruthy()
    expect(container.querySelector('.coordination-badge--chip')).toBeNull()
  })
})
