import { describe, expect, it } from 'vitest'
import {
  RUN_KEY_SEP,
  buildRunKey,
  isRunKeyForPane,
  parseRunKey,
} from '../agentRunKey'
import { DEFAULT_THREAD_ID } from '../agentThreads'

describe('agentRunKey', () => {
  it('buildRunKey usa DEFAULT_THREAD_ID si threadId vacío', () => {
    expect(buildRunKey('pane-1')).toBe(`pane-1${RUN_KEY_SEP}${DEFAULT_THREAD_ID}`)
    expect(buildRunKey('pane-1', '')).toBe(`pane-1${RUN_KEY_SEP}${DEFAULT_THREAD_ID}`)
    expect(buildRunKey('pane-1', 't2')).toBe(`pane-1${RUN_KEY_SEP}t2`)
  })

  it('parseRunKey parte por el primer separador', () => {
    expect(parseRunKey(`p${RUN_KEY_SEP}t1`)).toEqual({ paneId: 'p', threadId: 't1' })
    expect(parseRunKey(`p${RUN_KEY_SEP}a${RUN_KEY_SEP}b`)).toEqual({
      paneId: 'p',
      threadId: `a${RUN_KEY_SEP}b`,
    })
    expect(parseRunKey('solo-pane')).toEqual({
      paneId: 'solo-pane',
      threadId: DEFAULT_THREAD_ID,
    })
  })

  it('isRunKeyForPane compara el paneId', () => {
    const key = buildRunKey('pane-x', 't9')
    expect(isRunKeyForPane(key, 'pane-x')).toBe(true)
    expect(isRunKeyForPane(key, 'pane-y')).toBe(false)
    expect(isRunKeyForPane('pane-x', 'pane-x')).toBe(true)
  })
})
