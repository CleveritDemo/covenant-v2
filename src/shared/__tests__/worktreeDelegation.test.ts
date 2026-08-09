import { describe, expect, it } from 'vitest'
import {
  buildConflictFollowUp,
  buildMergeCommitMessage,
  planDelegationWorktrees,
  planWorktreeMergeOrder,
  sanitizeDelegationSlug,
  shouldUseWorktreeForDelegation,
  WORKTREES_DIR_SEGMENT,
  worktreeBranchFor,
  worktreeRelPathFor,
} from '../worktreeDelegation'

describe('sanitizeDelegationSlug', () => {
  it('lowercases and replaces spaces/uppercase with dashes', () => {
    expect(sanitizeDelegationSlug('Hello World')).toBe('hello-world')
  })

  it('collapses repeated separators', () => {
    expect(sanitizeDelegationSlug('a---b__c   d')).toBe('a-b-c-d')
  })

  it('strips a leading run of dashes instead of preserving them', () => {
    expect(sanitizeDelegationSlug('--x')).toBe('x')
  })

  it('strips unicode/non [a-z0-9] characters', () => {
    expect(sanitizeDelegationSlug('café ñandú 日本語')).toBe('caf-and')
  })

  it('falls back to a safe non-dash value for empty input', () => {
    const result = sanitizeDelegationSlug('')
    expect(result).toBeTruthy()
    expect(result.startsWith('-')).toBe(false)
  })

  it('falls back to a safe non-dash value for input that is only separators', () => {
    const result = sanitizeDelegationSlug('   ---   ')
    expect(result).toBeTruthy()
    expect(result.startsWith('-')).toBe(false)
  })

  it('truncates to at most 40 chars', () => {
    const long = 'a'.repeat(80)
    const result = sanitizeDelegationSlug(long)
    expect(result.length).toBeLessThanOrEqual(40)
  })

  it('never returns a string starting with "-" or containing ".."', () => {
    const inputs = ['', '--', '..', '../../etc', '---leading', 'CAFÉ', '   ', '-.-.-', 'a'.repeat(200)]
    for (const input of inputs) {
      const result = sanitizeDelegationSlug(input)
      expect(result.startsWith('-')).toBe(false)
      expect(result.includes('..')).toBe(false)
    }
  })
})

describe('worktreeBranchFor / worktreeRelPathFor', () => {
  it('worktreeBranchFor is deterministic and namespaced', () => {
    expect(worktreeBranchFor('deleg-123')).toBe('gravity/deleg/deleg-123')
    expect(worktreeBranchFor('deleg-123')).toBe(worktreeBranchFor('deleg-123'))
  })

  it('worktreeBranchFor sanitizes unsafe delegationId', () => {
    expect(worktreeBranchFor('--evil')).toBe('gravity/deleg/evil')
  })

  it('worktreeRelPathFor composes tabId/delegationId under WORKTREES_DIR_SEGMENT', () => {
    expect(worktreeRelPathFor('tab-1', 'deleg-1')).toBe(`${WORKTREES_DIR_SEGMENT}/tab-1/deleg-1`)
  })

  it('worktreeRelPathFor is deterministic', () => {
    const a = worktreeRelPathFor('tab-1', 'deleg-1')
    const b = worktreeRelPathFor('tab-1', 'deleg-1')
    expect(a).toBe(b)
  })

  it('worktreeRelPathFor sanitizes both segments', () => {
    expect(worktreeRelPathFor('../escape', '--evil')).toBe(`${WORKTREES_DIR_SEGMENT}/escape/evil`)
  })
})

describe('planWorktreeMergeOrder', () => {
  it('orders by completedAt ascending', () => {
    const order = planWorktreeMergeOrder([
      { delegationId: 'c', completedAt: 300 },
      { delegationId: 'a', completedAt: 100 },
      { delegationId: 'b', completedAt: 200 },
    ])
    expect(order).toEqual(['a', 'b', 'c'])
  })

  it('breaks ties by delegationId ascending', () => {
    const order = planWorktreeMergeOrder([
      { delegationId: 'z', completedAt: 100 },
      { delegationId: 'a', completedAt: 100 },
      { delegationId: 'm', completedAt: 100 },
    ])
    expect(order).toEqual(['a', 'm', 'z'])
  })

  it('returns an empty list for empty input', () => {
    expect(planWorktreeMergeOrder([])).toEqual([])
  })

  it('does not mutate the input array', () => {
    const items = [
      { delegationId: 'b', completedAt: 2 },
      { delegationId: 'a', completedAt: 1 },
    ]
    const copy = [...items]
    planWorktreeMergeOrder(items)
    expect(items).toEqual(copy)
  })

  it('is stable and deterministic across repeated calls with identical timestamps', () => {
    const items = [
      { delegationId: 'x1', completedAt: 5 },
      { delegationId: 'x2', completedAt: 5 },
      { delegationId: 'x3', completedAt: 5 },
    ]
    expect(planWorktreeMergeOrder(items)).toEqual(['x1', 'x2', 'x3'])
    expect(planWorktreeMergeOrder(items)).toEqual(['x1', 'x2', 'x3'])
  })
})

describe('buildMergeCommitMessage', () => {
  it('builds a single-line message with the slug appended', () => {
    const msg = buildMergeCommitMessage({
      agentId: 'agent-1',
      objectiveFirstLine: 'Fix the login bug',
      delegationId: 'deleg-42',
    })
    expect(msg).toBe('merge(deleg): Fix the login bug [deleg-42]')
    expect(msg.includes('\n')).toBe(false)
  })

  it('truncates objectives longer than 72 chars', () => {
    const longObjective = 'x'.repeat(100)
    const msg = buildMergeCommitMessage({
      agentId: 'agent-1',
      objectiveFirstLine: longObjective,
      delegationId: 'deleg-1',
    })
    expect(msg.includes('\n')).toBe(false)
    // "merge(deleg): " (14) + truncated objective (72) + " [deleg-1]" (10)
    const objectivePart = msg.slice('merge(deleg): '.length, msg.length - ' [deleg-1]'.length)
    expect(objectivePart.length).toBeLessThanOrEqual(72)
  })

  it('strips newlines from the objective', () => {
    const msg = buildMergeCommitMessage({
      agentId: 'agent-1',
      objectiveFirstLine: 'line one\nline two',
      delegationId: 'deleg-1',
    })
    expect(msg.includes('\n')).toBe(false)
  })
})

describe('buildConflictFollowUp', () => {
  it('includes all conflict files and the branch name', () => {
    const text = buildConflictFollowUp({
      conflictFiles: ['src/a.ts', 'src/b.ts', 'README.md'],
      branch: 'gravity/deleg/deleg-1',
    })
    expect(text.includes('src/a.ts')).toBe(true)
    expect(text.includes('src/b.ts')).toBe(true)
    expect(text.includes('README.md')).toBe(true)
    expect(text.includes('gravity/deleg/deleg-1')).toBe(true)
  })

  it('has no fences or JSON', () => {
    const text = buildConflictFollowUp({ conflictFiles: ['a.ts'], branch: 'b' })
    expect(text.includes('```')).toBe(false)
    expect(text.trim().startsWith('{')).toBe(false)
  })

  it('handles an empty conflictFiles list gracefully', () => {
    const text = buildConflictFollowUp({ conflictFiles: [], branch: 'b' })
    expect(text.length).toBeGreaterThan(0)
  })
})

describe('shouldUseWorktreeForDelegation', () => {
  it('is true only when both isGitRepo and hasBaseBranch are true', () => {
    expect(shouldUseWorktreeForDelegation({ isGitRepo: true, hasBaseBranch: true })).toBe(true)
    expect(shouldUseWorktreeForDelegation({ isGitRepo: true, hasBaseBranch: false })).toBe(false)
    expect(shouldUseWorktreeForDelegation({ isGitRepo: false, hasBaseBranch: true })).toBe(false)
    expect(shouldUseWorktreeForDelegation({ isGitRepo: false, hasBaseBranch: false })).toBe(false)
  })
})

describe('planDelegationWorktrees', () => {
  it('plans distinct absolute paths per delegation under WORKTREES_DIR_SEGMENT', () => {
    const planned = planDelegationWorktrees({
      baseCwd: '/Users/me/repo',
      tabId: 'tab-a',
      delegationIds: ['d1', 'd2'],
    })
    expect(planned.map(item => item.worktreePath)).toEqual([
      `/Users/me/repo/${WORKTREES_DIR_SEGMENT}/tab-a/d1`,
      `/Users/me/repo/${WORKTREES_DIR_SEGMENT}/tab-a/d2`,
    ])
    expect(planned[0]!.branch).toBe('gravity/deleg/d1')
    expect(planned[1]!.branch).toBe('gravity/deleg/d2')
  })
})
