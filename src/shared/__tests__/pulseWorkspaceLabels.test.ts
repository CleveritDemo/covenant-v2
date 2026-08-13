import { describe, expect, it } from 'vitest'
import type { OrgWorkspaceCatalog } from '../orgWorkspaceCatalog'
import { pulseWorkspaceLabel } from '../pulseWorkspaceLabels'

const TAG = 'rodrigoanti/dbbda641-1971-40bf-b139-bfb90a9205c6'
const OTHER = 'rodrigoanti/aaaaaaaa-1111-2222-3333-444444444444'

const catalog: OrgWorkspaceCatalog = {
  login: 'carlos',
  fetchedAt: 1,
  entries: [{
    slug: 'rodrigoanti',
    orgName: 'Rodrigoanti',
    workspaceId: 'dbbda641-1971-40bf-b139-bfb90a9205c6',
    name: 'Covenant',
  }],
}

describe('pulseWorkspaceLabel', () => {
  it('usa slug/nombre cuando el catálogo tiene la entrada', () => {
    expect(pulseWorkspaceLabel(TAG, catalog, [TAG])).toBe('rodrigoanti/Covenant')
  })

  it('deja solo el slug si no hay catálogo y es el único workspace de esa org', () => {
    expect(pulseWorkspaceLabel(TAG, null, [TAG])).toBe('rodrigoanti')
  })

  it('acorta el id a 8 si no hay catálogo y hay otro workspace del mismo slug', () => {
    expect(pulseWorkspaceLabel(TAG, null, [TAG, OTHER])).toBe('rodrigoanti/dbbda641')
  })

  it('devuelve el tag tal cual si no tiene /', () => {
    expect(pulseWorkspaceLabel('personal', null, ['personal'])).toBe('personal')
  })
})
