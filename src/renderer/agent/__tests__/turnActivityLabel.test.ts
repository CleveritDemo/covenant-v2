import { describe, expect, it } from 'vitest'
import {
  formatElapsed,
  shouldPromoteTurnPhaseToWriting,
  turnActivityKey,
  turnActivityLabel,
  type TurnActivityState,
} from '../turnActivityLabel'

function t(key: string, vars?: Record<string, string | number>): string {
  if (!vars) return `[${key}]`
  const payload = Object.entries(vars).map(([name, value]) => `${name}=${value}`).join(',')
  return `[${key}|${payload}]`
}

const starting: TurnActivityState = { phase: 'starting', toolCount: 0 }

describe('turnActivityLabel', () => {
  it('maps starting, thinking and writing to their phase keys', () => {
    expect(turnActivityLabel(starting, t)).toBe('[agentPane.phaseStarting]')
    expect(turnActivityLabel({ phase: 'thinking', toolCount: 0 }, t)).toBe('[agentPane.phaseThinking]')
    expect(turnActivityLabel({ phase: 'writing', toolCount: 2 }, t)).toBe('[agentPane.phaseWriting]')
  })

  it('maps context to contextLoading with the section count', () => {
    expect(turnActivityLabel({ phase: 'context', contextCount: 4, toolCount: 0 }, t))
      .toBe('[agentPane.contextLoading|n=4]')
  })

  it('uses 0 sections when contextCount is missing', () => {
    expect(turnActivityLabel({ phase: 'context', toolCount: 0 }, t))
      .toBe('[agentPane.contextLoading|n=0]')
  })

  it('maps a single tool to the product verb label and never returns empty', () => {
    expect(turnActivityLabel({ phase: 'tool', toolLabel: 'Read · a.ts', toolCount: 1 }, t))
      .toBe('[toolVerb.withTarget|verb=[toolVerb.read],target=a.ts]')
    expect(turnActivityLabel({ phase: 'tool', toolCount: 1 }, t))
      .toBe('[agentPane.activity|tool=]')
    expect(turnActivityLabel({ phase: 'tool', toolCount: 1 }, t)).not.toBe('')
  })

  it('falls back to the raw activity key for unknown tool names', () => {
    expect(turnActivityLabel({ phase: 'tool', toolLabel: 'TotallyUnknown · x', toolCount: 1 }, t))
      .toBe('[agentPane.activity|tool=TotallyUnknown · x]')
  })

  it('appends step count after the label when toolCount is greater than 1', () => {
    expect(turnActivityLabel({ phase: 'tool', toolLabel: 'Read · src/foo.ts', toolCount: 7 }, t))
      .toBe('[agentPane.activitySteps|label=[toolVerb.withTarget|verb=[toolVerb.read],target=src/foo.ts],n=7]')
    expect(turnActivityLabel({ phase: 'tool', toolLabel: 'Bash', toolCount: 3 }, t))
      .toBe('[agentPane.activitySteps|label=[toolVerb.bare|verb=[toolVerb.run]],n=3]')
  })
})

describe('shouldPromoteTurnPhaseToWriting', () => {
  it('blocks writing while a tool is in flight', () => {
    expect(shouldPromoteTurnPhaseToWriting('tool', 1)).toBe(false)
    expect(shouldPromoteTurnPhaseToWriting('writing', 2)).toBe(false)
  })

  it('allows writing once every tool has completed', () => {
    expect(shouldPromoteTurnPhaseToWriting('tool', 0)).toBe(true)
    expect(shouldPromoteTurnPhaseToWriting('thinking', 0)).toBe(true)
  })
})

describe('turnActivityKey', () => {
  it('is phase and toolLabel only, so a clock tick cannot change it', () => {
    expect(turnActivityKey({ phase: 'tool', toolLabel: 'Read', toolCount: 9 })).toBe('tool:Read')
    expect(turnActivityKey(starting)).toBe('starting:')
    expect(turnActivityKey({ phase: 'writing', toolCount: 2 })).toBe('writing:')
  })
})

describe('formatElapsed', () => {
  it('renders m:ss until 59:59 and h:mm:ss from one hour', () => {
    expect(formatElapsed(0)).toBe('0:00')
    expect(formatElapsed(1000)).toBe('0:01')
    expect(formatElapsed(60_000)).toBe('1:00')
    expect(formatElapsed(3_599_000)).toBe('59:59')
    expect(formatElapsed(3_600_000)).toBe('1:00:00')
    expect(formatElapsed(3_661_000)).toBe('1:01:01')
  })

  it('maps negatives and NaN to 0:00', () => {
    expect(formatElapsed(-12)).toBe('0:00')
    expect(formatElapsed(Number.NaN)).toBe('0:00')
  })
})
