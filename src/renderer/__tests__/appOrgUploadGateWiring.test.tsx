import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  canUploadOrgWorkspaceFromCatalog,
  orgWorkspaceUploadGateState,
  type OrgWorkspaceCatalog,
} from '@shared/orgWorkspaceCatalog'

const here = dirname(fileURLToPath(import.meta.url))
const appSource = readFileSync(join(here, '../App.tsx'), 'utf8')

const deniedCatalog: OrgWorkspaceCatalog = {
  login: 'alice',
  fetchedAt: 1,
  entries: [
    { slug: 'acme', orgName: 'Acme', workspaceId: 'w2', name: 'Beta', canRename: false },
  ],
}

const allowedCatalog: OrgWorkspaceCatalog = {
  login: 'alice',
  fetchedAt: 1,
  entries: [
    { slug: 'acme', orgName: 'Acme', workspaceId: 'w1', name: 'Alpha', canRename: true },
  ],
}

describe('App org upload gate wiring', () => {
  it("gate 'denied' del catálogo es el valor que App pasa como uploadWorkspaceGate", () => {
    expect(orgWorkspaceUploadGateState(deniedCatalog, 'acme', 'w2')).toBe('denied')
    expect(appSource).toMatch(
      /uploadWorkspaceGate=\{orgWorkspaceUploadGateState\(\s*\n\s*orgCatalogForTab\(orgWorkspaceCatalogMap, tab, accountIdForCwd\),/,
    )
  })

  it("gate 'allowed' mantiene canUploadWorkspace true en App", () => {
    expect(canUploadOrgWorkspaceFromCatalog(allowedCatalog, 'acme', 'w1')).toBe(true)
    expect(orgWorkspaceUploadGateState(allowedCatalog, 'acme', 'w1')).toBe('allowed')
    expect(appSource).toMatch(
      /canUploadWorkspace=\{canUploadOrgWorkspaceFromCatalog\(\s*\n\s*orgCatalogForTab\(orgWorkspaceCatalogMap, tab, accountIdForCwd\),/,
    )
  })

  it('onRefreshPermissions refetcha el catálogo con loadOrgWorkspaceCatalog(true)', () => {
    expect(appSource).toMatch(/const handleRefreshOrgPermissions = useCallback\(async \(\) => \{/)
    expect(appSource).toMatch(/await loadOrgWorkspaceCatalog\(true\)/)
    expect(appSource).toMatch(/onRefreshPermissions=\{\(\) => \{ void handleRefreshOrgPermissions\(\) \}\}/)
    expect(appSource).toMatch(/refreshPermissionsBusy=\{permissionsRefreshBusy\}/)
  })
})
