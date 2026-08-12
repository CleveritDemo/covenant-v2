import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { IPC } from '../../src/shared/ipcChannels'

describe('canales de Jira', () => {
  it('están declarados con su prefijo', () => {
    expect(IPC.JIRA_STATUS).toBe('jira:status')
    expect(IPC.JIRA_CONNECT).toBe('jira:connect')
    expect(IPC.JIRA_SEARCH).toBe('jira:search')
  })

  it('el preload los expone: sin esto el renderer no los alcanza', () => {
    const preload = readFileSync(join(__dirname, '..', 'preload.ts'), 'utf8')
    for (const method of ['jiraStatus', 'jiraConnect', 'jiraSearch']) {
      expect(preload).toContain(`${method}:`)
    }
  })

  it('el main registra un handler por canal', () => {
    const main = readFileSync(join(__dirname, '..', 'main.ts'), 'utf8')
    for (const channel of ['JIRA_STATUS', 'JIRA_CONNECT', 'JIRA_SEARCH']) {
      expect(main).toContain(`IPC.${channel}`)
    }
  })
})
