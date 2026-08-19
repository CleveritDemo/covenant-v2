import { describe, expect, it } from 'vitest'
import {
  applyLoginShellPath,
  decodeCliStderrChunk,
  exceedsWindowsCommandLimit,
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

  it('exceedsWindowsCommandLimit solo en win32 y con margen de 7500', () => {
    const short = exceedsWindowsCommandLimit('cmd', ['a'])
    const long = exceedsWindowsCommandLimit('cmd', ['x'.repeat(8000)])
    if (process.platform === 'win32') {
      expect(short).toBe(false)
      expect(long).toBe(true)
    } else {
      expect(short).toBe(false)
      expect(long).toBe(false)
    }
  })

  it('decodeCliStderrChunk preserva UTF-8 válido y traduce cp850 en bytes altos', () => {
    expect(decodeCliStderrChunk('hola')).toBe('hola')
    expect(decodeCliStderrChunk(Buffer.from([0xa1]).toString('latin1'))).toBe('í')
    expect(decodeCliStderrChunk(Buffer.from([0x9a]).toString('latin1'))).toBe('Ü')
    expect(decodeCliStderrChunk(Buffer.from([0x97]).toString('latin1'))).toBe('ù')
    expect(decodeCliStderrChunk(Buffer.from([0xa9]).toString('latin1'))).toBe('®')
    expect(decodeCliStderrChunk(Buffer.from('café', 'utf8').toString('latin1'))).toBe('café')
  })
})
