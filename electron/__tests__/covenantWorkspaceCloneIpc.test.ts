import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { IPC } from '../../src/shared/ipcChannels'
import type { OrgWorkspaceCloneResult } from '../../src/shared/orgWorkspaceClone'

/**
 * Espejo del post-clone binding en IPC.COVENANT_WORKSPACE_CLONE (electron/main.ts).
 */
function finishOrgWorkspaceClone(
  result: OrgWorkspaceCloneResult,
  accountId: string,
  writeWorkspaceAccountId: (cwd: string, accountId: string) => void,
): OrgWorkspaceCloneResult {
  if (result.ok && result.workspaceDir && accountId !== 'default') {
    writeWorkspaceAccountId(result.workspaceDir, accountId)
  }
  return result
}

describe('IPC COVENANT_WORKSPACE_CLONE account binding', () => {
  it('está declarado y main registra el handler con writeWorkspaceAccountId', () => {
    expect(IPC.COVENANT_WORKSPACE_CLONE).toBe('covenant:workspaceClone')
    const main = readFileSync(join(__dirname, '..', 'main.ts'), 'utf8')
    expect(main).toContain('IPC.COVENANT_WORKSPACE_CLONE')
    expect(main).toMatch(
      /if \(result\.ok && result\.workspaceDir && resolved\.accountId !== 'default'\)/,
    )
    expect(main).toContain('writeWorkspaceAccountId(result.workspaceDir, resolved.accountId)')
  })

  it('clon ok con accountId real escribe el binding en workspaceDir', () => {
    const write = vi.fn()
    const result: OrgWorkspaceCloneResult = {
      ok: true,
      workspaceDir: '/tmp/ws/acme/team',
      cloned: ['owner/repo'],
      skipped: [],
    }
    expect(finishOrgWorkspaceClone(result, 'acc-real', write)).toBe(result)
    expect(write).toHaveBeenCalledWith('/tmp/ws/acme/team', 'acc-real')
  })

  it("clon ok con accountId 'default' no escribe nada", () => {
    const write = vi.fn()
    const result: OrgWorkspaceCloneResult = {
      ok: true,
      workspaceDir: '/tmp/ws/acme/team',
      cloned: [],
      skipped: [],
    }
    expect(finishOrgWorkspaceClone(result, 'default', write)).toBe(result)
    expect(write).not.toHaveBeenCalled()
  })

  it('clon con ok:false no escribe nada', () => {
    const write = vi.fn()
    const result: OrgWorkspaceCloneResult = {
      ok: false,
      error: 'clone-failed',
      workspaceDir: '/tmp/ws/acme/team',
    }
    expect(finishOrgWorkspaceClone(result, 'acc-real', write)).toBe(result)
    expect(write).not.toHaveBeenCalled()
  })
})
