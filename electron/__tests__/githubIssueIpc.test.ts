import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { IPC } from '../../src/shared/ipcChannels'

describe('canales de GitHub issues', () => {
  it('están declarados con su prefijo', () => {
    expect(IPC.GITHUB_ISSUE_STATUS).toBe('githubIssue:status')
    expect(IPC.GITHUB_ISSUE_SEARCH).toBe('githubIssue:search')
    expect(IPC.GITHUB_ISSUE_PREVIEW).toBe('githubIssue:preview')
  })

  it('el preload los expone', () => {
    const preload = readFileSync(join(__dirname, '..', 'preload.ts'), 'utf8')
    for (const method of ['githubIssueStatus', 'githubIssueSearch', 'githubIssuePreview']) {
      expect(preload).toMatch(new RegExp(`${method}\\s*[:(]`))
    }
  })

  it('el main registra un handler por canal', () => {
    const main = readFileSync(join(__dirname, '..', 'main.ts'), 'utf8')
    for (const channel of ['GITHUB_ISSUE_STATUS', 'GITHUB_ISSUE_SEARCH', 'GITHUB_ISSUE_PREVIEW']) {
      expect(main).toContain(`IPC.${channel}`)
    }
  })
})
