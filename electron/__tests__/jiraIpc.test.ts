import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { IPC } from '../../src/shared/ipcChannels'

describe('canales de Jira', () => {
  it('están declarados con su prefijo', () => {
    expect(IPC.JIRA_STATUS).toBe('jira:status')
    expect(IPC.JIRA_CONNECT).toBe('jira:connect')
    expect(IPC.JIRA_SEARCH).toBe('jira:search')
    expect(IPC.JIRA_ACCOUNTS_LIST).toBe('jira:accounts:list')
    expect(IPC.JIRA_ACCOUNT_CHECK).toBe('jira:account:check')
    expect(IPC.JIRA_WORKSPACE_ACCOUNT_GET).toBe('jira:workspaceAccount:get')
  })

  it('el preload expone cuentas y workspace account', () => {
    const preload = readFileSync(join(__dirname, '..', 'preload.ts'), 'utf8')
    for (const method of [
      'jiraAccountsList',
      'jiraAccountUpsert',
      'jiraAccountCheck',
      'jiraWorkspaceAccountGet',
      'jiraWorkspaceAccountSet',
    ]) {
      expect(preload).toMatch(new RegExp(`${method}\\s*[:(]`))
    }
  })

  it('el main registra handlers de cuentas Jira', () => {
    const main = readFileSync(join(__dirname, '..', 'main.ts'), 'utf8')
    for (const channel of [
      'JIRA_ACCOUNTS_LIST',
      'JIRA_ACCOUNT_UPSERT',
      'JIRA_ACCOUNT_DELETE',
      'JIRA_ACCOUNT_CHECK',
      'JIRA_WORKSPACE_ACCOUNT_SET',
    ]) {
      expect(main).toContain(`IPC.${channel}`)
    }
  })

  it('el preload los expone: sin esto el renderer no los alcanza', () => {
    const preload = readFileSync(join(__dirname, '..', 'preload.ts'), 'utf8')
    for (const method of ['jiraStatus', 'jiraConnect', 'jiraSearch']) {
      // El nombre puede definirse como propiedad-flecha (`método: (...) =>`) o
      // como method-shorthand (`método(...) {`) — este archivo usa shorthand en
      // todos los demás métodos; el test no debe pinnear un estilo, solo que el
      // método exista.
      expect(preload).toMatch(new RegExp(`${method}\\s*[:(]`))
    }
  })

  it('el main registra un handler por canal', () => {
    const main = readFileSync(join(__dirname, '..', 'main.ts'), 'utf8')
    for (const channel of ['JIRA_STATUS', 'JIRA_CONNECT', 'JIRA_SEARCH']) {
      expect(main).toContain(`IPC.${channel}`)
    }
  })
})
