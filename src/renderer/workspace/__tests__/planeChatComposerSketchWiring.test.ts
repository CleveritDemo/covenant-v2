import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const composerSource = readFileSync(join(here, '../PlaneChatComposer.tsx'), 'utf8')

describe('PlaneChatComposer sketch wiring', () => {
  it('PendingImageThumb recibe onSketch para abrir el lienzo con la imagen', () => {
    expect(composerSource).toMatch(/onSketch=\{\(\) => openSketchWithImage\(image\.previewUrl, image\.name\)\}/)
  })

  it('SketchModal recibe initialImage y onClose limpia el estado', () => {
    expect(composerSource).toMatch(/initialImage=\{sketchInitialImage\}/)
    expect(composerSource).toMatch(/onClose=\{\(\) => \{/)
    expect(composerSource).toMatch(/setSketchOpen\(false\)/)
    expect(composerSource).toMatch(/setSketchInitialImage\(null\)/)
  })

  it('PlaneChatComposerHandle expone openSketchWithImage', () => {
    expect(composerSource).toMatch(/export interface PlaneChatComposerHandle \{/)
    expect(composerSource).toMatch(/openSketchWithImage: \(src: string, name: string\) => void/)
    expect(composerSource).toMatch(/useImperativeHandle\(ref, \(\) => \(\{ attachReference, openSketchWithImage \}\)/)
  })
})
