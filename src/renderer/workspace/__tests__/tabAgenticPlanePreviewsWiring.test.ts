import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const planeSource = readFileSync(join(here, '../TabAgenticPlane.tsx'), 'utf8')

describe('TabAgenticPlane previews wiring', () => {
  it('monta PreviewsView con el hook y el botón del rail', () => {
    expect(planeSource).toMatch(/import \{ PreviewsView \} from '\.\/PreviewsView'/)
    expect(planeSource).toMatch(/import \{ PlanePreviewsButton \} from '\.\/PlanePreviewsButton'/)
    expect(planeSource).toMatch(/import \{ usePreviews \} from '\.\/usePreviews'/)
    expect(planeSource).toMatch(/<PreviewsView/)
    expect(planeSource).toMatch(/<PlanePreviewsButton/)
  })

  it("closeOtherPlaneOverlays acepta 'previews'", () => {
    expect(planeSource).toMatch(
      /keep: 'wiki' \| 'brainstorm' \| 'pulse' \| 'previews' \| 'none'/,
    )
    expect(planeSource).toMatch(/if \(keep !== 'previews'\) setPreviewsOpen\(false\)/)
  })
})
