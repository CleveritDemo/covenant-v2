import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const appSource = readFileSync(join(here, '../App.tsx'), 'utf8')
const planeSource = readFileSync(join(here, '../workspace/TabAgenticPlane.tsx'), 'utf8')

describe('App preview open wiring', () => {
  it('declara handleOpenPreviewFromChat y estado previewOpenRequestByTab', () => {
    expect(appSource).toMatch(/const handleOpenPreviewFromChat = useCallback\(/)
    expect(appSource).toMatch(/previewOpenRequestByTab/)
    expect(appSource).toMatch(/setPreviewOpenRequestByTab/)
  })

  it('pasa onOpenPreview al AgentPane', () => {
    expect(appSource).toMatch(
      /onOpenPreview=\{fileName => handleOpenPreviewFromChat\(tab\.id, fileName\)\}/,
    )
  })

  it('pasa previewOpenRequest al TabAgenticPlane', () => {
    expect(appSource).toMatch(
      /previewOpenRequest=\{previewOpenRequestByTab\[tab\.id\] \?\? null\}/,
    )
  })

  it('TabAgenticPlane pasa onOpenPreview a PlaneQuickChat', () => {
    expect(planeSource).toMatch(/onOpenPreview=\{fileName => \{/)
    expect(planeSource).toMatch(/closeOtherPlaneOverlays\('previews'\)/)
    expect(planeSource).toMatch(/selectPreview\(fileName\)/)
  })
})
