import { describe, expect, it } from 'vitest'
import { canUploadOrgWorkspaceChanges } from '@shared/orgWorkspaceLocalSync'

describe('Plane upload button permission', () => {
  it('solo aparece con canRename (manager/admin)', () => {
    expect(canUploadOrgWorkspaceChanges(true)).toBe(true)
    expect(canUploadOrgWorkspaceChanges(false)).toBe(false)
    expect(canUploadOrgWorkspaceChanges(undefined)).toBe(false)
  })
})
