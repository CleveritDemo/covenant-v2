import { describe, expect, it, vi } from 'vitest'
import { renameWorkspaceContext } from '../../src/shared/orgWorkspaceContent'
import type { CovenantWorkspaceContextPayload } from '../../src/shared/covenantTypes'

/**
 * Espejo del cableado en electron/covenantApi.renameWorkspaceContext
 * (PUT next → DELETE previous) usado por IPC COVENANT_WORKSPACE_CONTEXT_RENAME.
 */
async function ipcRenameWorkspaceContext(
  slug: string,
  workspaceId: string,
  previousId: string,
  nextId: string,
  payload: CovenantWorkspaceContextPayload,
  deps: {
    upsert: (
      slug: string,
      workspaceId: string,
      contextId: string,
      payload: CovenantWorkspaceContextPayload,
    ) => Promise<{ contextId: string } & CovenantWorkspaceContextPayload>
    delete: (slug: string, workspaceId: string, contextId: string) => Promise<void>
  },
) {
  return renameWorkspaceContext(previousId, nextId, payload, {
    upsert: (contextId, body) => deps.upsert(slug, workspaceId, contextId, body),
    delete: contextId => deps.delete(slug, workspaceId, contextId),
  })
}

describe('IPC renameWorkspaceContext wiring', () => {
  it('PUT next then DELETE previous with slug/workspace args', async () => {
    const upsert = vi.fn(async (_s: string, _w: string, id: string, p: CovenantWorkspaceContextPayload) => ({
      contextId: id,
      ...p,
    }))
    const del = vi.fn(async () => {})
    const payload = { kind: 'notes', name: 'B', body: 'x' }
    const result = await ipcRenameWorkspaceContext(
      'acme',
      'ws-1',
      'id-a',
      'id-b',
      payload,
      { upsert, delete: del },
    )
    expect(upsert).toHaveBeenCalledWith('acme', 'ws-1', 'id-b', payload)
    expect(del).toHaveBeenCalledWith('acme', 'ws-1', 'id-a')
    expect(result.deletedPrevious).toBe(true)
  })

  it('does not DELETE if upsert fails', async () => {
    const del = vi.fn(async () => {})
    await expect(ipcRenameWorkspaceContext(
      'acme',
      'ws-1',
      'id-a',
      'id-b',
      { kind: 'notes', name: 'B' },
      {
        upsert: async () => { throw new Error('network') },
        delete: del,
      },
    )).rejects.toThrow('network')
    expect(del).not.toHaveBeenCalled()
  })
})
