import { describe, expect, it } from 'vitest'
import {
  resolveContextAssignOutcome,
  shouldPersistAssignedContext,
  type ContextAssignOutcome,
} from '../onboardingContextAssign'

describe('resolveContextAssignOutcome', () => {
  it('rejects blank contextId in assign mode', () => {
    expect(
      resolveContextAssignOutcome({
        currentIds: ['ctx-1'],
        contextId: '   ',
        ownResult: false,
        mode: 'assign',
      }),
    ).toBe('rejected')
  })

  it('rejects blank contextId in toggle mode', () => {
    expect(
      resolveContextAssignOutcome({
        currentIds: ['ctx-1'],
        contextId: '   ',
        ownResult: false,
        mode: 'toggle',
      }),
    ).toBe('rejected')
  })

  it('treats undefined currentIds as empty for assign', () => {
    expect(
      resolveContextAssignOutcome({
        currentIds: undefined,
        contextId: 'ctx-1',
        ownResult: false,
        mode: 'assign',
      }),
    ).toBe('added')
  })

  it('treats null currentIds as empty for assign', () => {
    expect(
      resolveContextAssignOutcome({
        currentIds: null,
        contextId: 'ctx-1',
        ownResult: false,
        mode: 'assign',
      }),
    ).toBe('added')
  })

  it('toggle on present id returns removed even when ownResult is true', () => {
    expect(
      resolveContextAssignOutcome({
        currentIds: ['ctx-1'],
        contextId: 'ctx-1',
        ownResult: true,
        mode: 'toggle',
      }),
    ).toBe('removed')
  })

  it('toggle on absent id with ownResult true returns rejected', () => {
    expect(
      resolveContextAssignOutcome({
        currentIds: ['ctx-2'],
        contextId: 'ctx-1',
        ownResult: true,
        mode: 'toggle',
      }),
    ).toBe('rejected')
  })

  it('toggle on absent id with ownResult false returns added', () => {
    expect(
      resolveContextAssignOutcome({
        currentIds: ['ctx-2'],
        contextId: 'ctx-1',
        ownResult: false,
        mode: 'toggle',
      }),
    ).toBe('added')
  })

  it('assign on present id returns already', () => {
    expect(
      resolveContextAssignOutcome({
        currentIds: ['ctx-1', 'ctx-2'],
        contextId: 'ctx-1',
        ownResult: false,
        mode: 'assign',
      }),
    ).toBe('already')
  })

  it('assign on absent id with ownResult true returns rejected', () => {
    expect(
      resolveContextAssignOutcome({
        currentIds: ['ctx-2'],
        contextId: 'ctx-1',
        ownResult: true,
        mode: 'assign',
      }),
    ).toBe('rejected')
  })

  it('assign on absent id with ownResult false returns added', () => {
    expect(
      resolveContextAssignOutcome({
        currentIds: ['ctx-2'],
        contextId: 'ctx-1',
        ownResult: false,
        mode: 'assign',
      }),
    ).toBe('added')
  })
})

describe('shouldPersistAssignedContext', () => {
  const cases: Array<{ outcome: ContextAssignOutcome; persist: boolean }> = [
    { outcome: 'added', persist: true },
    { outcome: 'already', persist: true },
    { outcome: 'removed', persist: false },
    { outcome: 'rejected', persist: false },
  ]

  it.each(cases)('returns $persist for $outcome', ({ outcome, persist }) => {
    expect(shouldPersistAssignedContext(outcome)).toBe(persist)
  })
})
