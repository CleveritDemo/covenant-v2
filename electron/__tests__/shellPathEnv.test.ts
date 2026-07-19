import { describe, expect, it } from 'vitest'
import { applyLoginShellPath, mergePathEntries, splitPath } from '../shellPathEnv'

const SEP = process.platform === 'win32' ? ';' : ':'

describe('shellPathEnv', () => {
  it('splits PATH entries and drops empties', () => {
    expect(splitPath(`/a${SEP}${SEP}/b${SEP}/c${SEP}`)).toEqual(['/a', '/b', '/c'])
  })

  it('merges PATH groups without duplicates, first wins', () => {
    expect(mergePathEntries(
      ['/shell/bin', '/shared'],
      ['/extra/bin', '/shared'],
      ['/electron/bin', '/shell/bin'],
    )).toBe(['/shell/bin', '/shared', '/extra/bin', '/electron/bin'].join(SEP))
  })

  it('enriches PATH with login shell and common bin dirs', () => {
    if (process.platform === 'win32') return
    const env: NodeJS.ProcessEnv = { PATH: '/usr/bin:/bin', SHELL: process.env.SHELL }
    applyLoginShellPath(env)
    expect(env.PATH).toBeTruthy()
    expect(env.PATH!.includes('/usr/bin')).toBe(true)
    expect(env.PATH).toMatch(/\.local\/bin/)
  })
})
