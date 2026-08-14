import { describe, expect, it } from 'vitest'
import {
  buildDelegationTurnSummary,
  isBetterDelegationSummary,
  isDelegationSummaryPlaceholder,
} from '../delegationTurnSummary'

describe('isDelegationSummaryPlaceholder', () => {
  it('detects empty and host placeholders', () => {
    expect(isDelegationSummaryPlaceholder('')).toBe(true)
    expect(isDelegationSummaryPlaceholder('   ')).toBe(true)
    expect(isDelegationSummaryPlaceholder('(empty response)')).toBe(true)
    expect(isDelegationSummaryPlaceholder('(sin respuesta)')).toBe(true)
    expect(isDelegationSummaryPlaceholder('(empty)')).toBe(true)
  })

  it('accepts real summaries', () => {
    expect(isDelegationSummaryPlaceholder('QA passed all gates.')).toBe(false)
  })
})

describe('buildDelegationTurnSummary', () => {
  it('prefers assistant text when present', () => {
    expect(buildDelegationTurnSummary({
      assistantText: 'Visible answer.',
      resultsSummary: 'From results file.',
      emptyFallback: '(empty response)',
    })).toBe('Visible answer.')
  })

  it('falls back to results summary when assistant is placeholder', () => {
    expect(buildDelegationTurnSummary({
      assistantText: '(empty response)',
      resultsSummary: 'Persisted in results fence.',
      emptyFallback: '(empty response)',
    })).toBe('Persisted in results fence.')
  })

  it('falls back to changes when summary is missing', () => {
    expect(buildDelegationTurnSummary({
      assistantText: '(sin respuesta)',
      resultsSummary: null,
      resultsChanges: ['AgentPane.tsx: notify path', 'App.tsx: reconcile idle'],
      emptyFallback: '(empty response)',
    })).toBe('AgentPane.tsx: notify path; App.tsx: reconcile idle')
  })

  it('returns emptyFallback when nothing usable exists', () => {
    expect(buildDelegationTurnSummary({
      assistantText: '(empty)',
      resultsSummary: '(empty)',
      resultsChanges: [],
      emptyFallback: '(sin respuesta)',
    })).toBe('(sin respuesta)')
  })
})

describe('isBetterDelegationSummary', () => {
  it('upgrades placeholders only', () => {
    expect(isBetterDelegationSummary('(empty response)', 'Real summary.')).toBe(true)
    expect(isBetterDelegationSummary('Real summary.', 'Another.')).toBe(false)
    expect(isBetterDelegationSummary('(empty response)', '(empty)')).toBe(false)
  })
})
