import { describe, expect, it } from 'vitest'
import { existsSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  readJiraWorkspaceAccountId,
  resolveJiraWorkspaceAccountId,
  writeJiraWorkspaceAccountId,
} from '../jiraWorkspaceAccount'

describe('jiraWorkspaceAccount', () => {
  it('ida y vuelta por .gravity/jira-account.json; null borra el archivo', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gravity-jira-ws-'))
    expect(readJiraWorkspaceAccountId(dir)).toBeNull()

    writeJiraWorkspaceAccountId(dir, 'acc-1')
    expect(readJiraWorkspaceAccountId(dir)).toBe('acc-1')
    const raw = readFileSync(join(dir, '.gravity', 'jira-account.json'), 'utf8')
    expect(JSON.parse(raw)).toEqual({ accountId: 'acc-1' })
    expect(raw).not.toMatch(/token|password|secret/i)

    writeJiraWorkspaceAccountId(dir, null)
    expect(existsSync(join(dir, '.gravity', 'jira-account.json'))).toBe(false)
    expect(readJiraWorkspaceAccountId(dir)).toBeNull()
  })

  it('JSON roto = sin cuenta, no lanza', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gravity-jira-ws-'))
    mkdirSync(join(dir, '.gravity'))
    writeFileSync(join(dir, '.gravity', 'jira-account.json'), '{ roto', 'utf8')
    expect(readJiraWorkspaceAccountId(dir)).toBeNull()
  })
})

describe('resolveJiraWorkspaceAccountId', () => {
  it('id desconocido: null y borra el archivo', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gravity-jira-ws-'))
    writeJiraWorkspaceAccountId(dir, 'ghost')
    expect(existsSync(join(dir, '.gravity', 'jira-account.json'))).toBe(true)
    expect(resolveJiraWorkspaceAccountId(dir, ['acc-1'])).toBeNull()
    expect(existsSync(join(dir, '.gravity', 'jira-account.json'))).toBe(false)
  })
})
