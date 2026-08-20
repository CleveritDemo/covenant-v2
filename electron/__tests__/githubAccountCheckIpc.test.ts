import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { IPC } from '../../src/shared/ipcChannels'

describe('canal github:account:check', () => {
  it('está declarado, el preload lo expone y main registra el handler', () => {
    expect(IPC.GITHUB_ACCOUNT_CHECK).toBe('github:account:check')
    const preload = readFileSync(join(__dirname, '..', 'preload.ts'), 'utf8')
    expect(preload).toMatch(/githubAccountCheck\s*[:(]/)
    const main = readFileSync(join(__dirname, '..', 'main.ts'), 'utf8')
    expect(main).toContain('IPC.GITHUB_ACCOUNT_CHECK')
  })
})
