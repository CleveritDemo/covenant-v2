import { describe, expect, it } from 'vitest'
import {
  applyLoginShellPath,
  mergePathEntries,
  mergeShellEnv,
  parseShellEnv,
  splitPath,
} from '../shellPathEnv'

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

  // Spawns the real login shell synchronously; needs extra margin under full-suite CPU load.
  it('enriches PATH with login shell and common bin dirs', () => {
    if (process.platform === 'win32') return
    const env: NodeJS.ProcessEnv = { PATH: '/usr/bin:/bin', SHELL: process.env.SHELL }
    applyLoginShellPath(env)
    expect(env.PATH).toBeTruthy()
    expect(env.PATH!.includes('/usr/bin')).toBe(true)
    expect(env.PATH).toMatch(/\.local\/bin/)
  }, 20000)

  it('parses `env -0` and the newline fallback, dropping rc noise', () => {
    expect(parseShellEnv('A=1\0B=x=y\0Welcome to zsh\0BASH_FUNC_f%%=(){}\0')).toEqual({
      A: '1',
      B: 'x=y',
    })
    expect(parseShellEnv('A=1\nB=2\n')).toEqual({ A: '1', B: '2' })
  })

  it('imports missing shell vars but never overrides the host env', () => {
    const env: NodeJS.ProcessEnv = { PATH: '/usr/bin', HOME: '/real/home' }
    mergeShellEnv(env, { PI_API_KEY: 'k', HOME: '/shell/home', PATH: '/nope', PWD: '/tmp' })
    expect(env.PI_API_KEY).toBe('k')
    expect(env.HOME).toBe('/real/home')
    expect(env.PATH).toBe('/usr/bin')
    expect(env.PWD).toBeUndefined()
  })

  it('formats ENOENT/-4058 with actionable Windows guidance', async () => {
    const { formatCliSpawnFailure } = await import('../shellPathEnv')
    expect(formatCliSpawnFailure('claude', -4058)).toContain('ENOENT')
    expect(formatCliSpawnFailure('claude', -4058)).toContain('Ajustes')
    expect(formatCliSpawnFailure('agent', 1, 'boom')).toBe('boom')
  })
})
