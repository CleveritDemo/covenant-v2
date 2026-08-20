/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { agentCliSpec } from '@shared/agentCliProviders'
import type { PulseProviderStat } from '@shared/pulseEvents'
import { PulseHarnessTable } from '../PulseHarnessTable'

vi.mock('@i18n/useT', () => ({
  useT: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (params) {
        return `${key}:${Object.entries(params).map(([, v]) => String(v)).join(',')}`
      }
      return key
    },
  }),
}))

afterEach(cleanup)

function row(overrides: Partial<PulseProviderStat> & Pick<PulseProviderStat, 'provider'>): PulseProviderStat {
  return {
    turns: 10,
    tokensIn: 100,
    tokensOut: 50,
    tokens: 150,
    measuredTurns: 10,
    activeDays: 3,
    loopTurns: 0,
    avgDurationMs: 0,
    lastTs: new Date(2026, 7, 9).getTime(),
    agents: [{ agentId: 'tl', turns: 10 }],
    ...overrides,
  }
}

describe('PulseHarnessTable', () => {
  it('renders one row per provider with label and id', () => {
    const providers = [
      row({ provider: 'claude' }),
      row({ provider: 'cursor', turns: 4 }),
    ]

    render(<PulseHarnessTable providers={providers} />)

    expect(screen.getByText(agentCliSpec('claude').label)).toBeTruthy()
    expect(screen.getByText('claude')).toBeTruthy()
    expect(screen.getByText(agentCliSpec('cursor').label)).toBeTruthy()
    expect(screen.getByText('cursor')).toBeTruthy()
    expect(document.querySelectorAll('.pulse-harness__body .pulse-harness__row')).toHaveLength(2)
  })

  it('shows dashes instead of zero when measuredTurns is 0', () => {
    const providers = [
      row({
        provider: 'opencode',
        measuredTurns: 0,
        tokensIn: 0,
        tokensOut: 0,
        tokens: 0,
        turns: 5,
      }),
    ]

    render(<PulseHarnessTable providers={providers} />)

    const dataRow = document.querySelector('.pulse-harness__body .pulse-harness__row')!
    const numCells = dataRow.querySelectorAll('.pulse-harness__cell--num')
    expect(numCells[0]?.textContent).toContain('5')
    expect(numCells[1]?.textContent).toBe('—')
    expect(numCells[2]?.textContent).toBe('—')
    expect(numCells[3]?.textContent).toBe('—')
    expect(dataRow.textContent).not.toMatch(/\b0\b/)
  })

  it('shows partial measurement indicator when only some turns are measured', () => {
    const providers = [
      row({
        provider: 'codex',
        turns: 8,
        measuredTurns: 3,
        tokens: 900,
      }),
    ]

    render(<PulseHarnessTable providers={providers} />)

    expect(document.querySelector('.pulse-harness__partial')).toBeTruthy()
    expect(screen.getByText('≈')).toBeTruthy()
  })

  it('shows +N when more than three agents contributed', () => {
    const providers = [
      row({
        provider: 'copilot',
        agents: [
          { agentId: 'a1', turns: 1 },
          { agentId: 'a2', turns: 1 },
          { agentId: 'a3', turns: 1 },
          { agentId: 'a4', turns: 1 },
          { agentId: 'a5', turns: 1 },
        ],
      }),
    ]

    render(<PulseHarnessTable providers={providers} />)

    expect(screen.getByText('a1')).toBeTruthy()
    expect(screen.getByText('a2')).toBeTruthy()
    expect(screen.getByText('a3')).toBeTruthy()
    expect(screen.queryByText('a4')).toBeNull()
    expect(screen.getByText('+2')).toBeTruthy()
  })

  it('renders empty state without providers', () => {
    render(<PulseHarnessTable providers={[]} />)

    expect(screen.getByText('pulse.harness_empty')).toBeTruthy()
    expect(document.querySelector('.pulse-harness__row')).toBeNull()
  })
})
