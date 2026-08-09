import { describe, expect, it } from 'vitest'
import { gitAreaTotals, gitFileLineStats, parseGitNumStat } from '../gitDiffNumStat'

describe('parseGitNumStat', () => {
  it('parses tab-separated lines', () => {
    const map = parseGitNumStat('10\t5\tsrc/foo.ts\n3\t0\tbar.ts\n')
    expect(map.get('src/foo.ts')).toEqual({ insertions: 10, deletions: 5 })
    expect(map.get('bar.ts')).toEqual({ insertions: 3, deletions: 0 })
  })

  it('treats binary - as zero', () => {
    const map = parseGitNumStat('-\t-\timage.png\n')
    expect(map.get('image.png')).toEqual({ insertions: 0, deletions: 0 })
  })
})

describe('gitFileLineStats', () => {
  const unstaged = parseGitNumStat('4\t1\tboth.ts\n2\t0\tunstaged.ts\n')
  const staged = parseGitNumStat('6\t2\tboth.ts\n1\t0\tstaged.ts\n')

  it('sums staged and unstaged for MM files', () => {
    expect(
      gitFileLineStats({ status: 'MM', path: 'both.ts' }, unstaged, staged),
    ).toEqual({ insertions: 10, deletions: 3 })
  })

  it('uses only unstaged map for worktree-only changes', () => {
    expect(
      gitFileLineStats({ status: ' M', path: 'unstaged.ts' }, unstaged, staged),
    ).toEqual({ insertions: 2, deletions: 0 })
  })

  it('uses only staged map for index-only changes', () => {
    expect(
      gitFileLineStats({ status: 'M ', path: 'staged.ts' }, unstaged, staged),
    ).toEqual({ insertions: 1, deletions: 0 })
  })

  it('returns null for untracked without numstat', () => {
    expect(
      gitFileLineStats({ status: '??', path: 'new.ts' }, unstaged, staged),
    ).toBeNull()
  })
})

describe('gitAreaTotals', () => {
  it('sums only the entries given, ignoring files missing from the numstat', () => {
    const map = parseGitNumStat('10\t5\tsrc/foo.ts\n3\t0\tbar.ts\n')
    const totals = gitAreaTotals(
      [
        { status: 'M ', path: 'src/foo.ts' },
        { status: 'A ', path: 'bar.ts' },
        { status: 'A ', path: 'sin-stats.ts' },
      ],
      map,
    )
    expect(totals).toEqual({ insertions: 13, deletions: 5 })
  })

  it('is zero for an empty area', () => {
    expect(gitAreaTotals([], parseGitNumStat(''))).toEqual({ insertions: 0, deletions: 0 })
  })
})
