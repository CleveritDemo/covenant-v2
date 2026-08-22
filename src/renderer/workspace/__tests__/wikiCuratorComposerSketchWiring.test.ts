import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(join(here, '../WikiCuratorComposer.tsx'), 'utf8')

describe('WikiCuratorComposer sketch wiring', () => {
  it('PendingImageThumb recibe onSketch que abre el lienzo con la imagen adjunta', () => {
    expect(source).toMatch(/openSketchWithImage/)
    expect(source).toMatch(
      /onSketch=\{\(\) => openSketchWithImage\(image\.previewUrl, image\.name\)\}/,
    )
  })

  it('SketchModal recibe initialImage y onClose limpia sketchInitialImage', () => {
    expect(source).toMatch(/initialImage=\{sketchInitialImage\}/)
    expect(source).toMatch(/setSketchOpen\(false\)/)
    expect(source).toMatch(/setSketchInitialImage\(null\)/)
  })

  it('el botón de sketch nuevo limpia sketchInitialImage antes de abrir', () => {
    expect(source).toMatch(/setSketchInitialImage\(null\)[\s\S]*setSketchOpen\(true\)/)
  })
})
