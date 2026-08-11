import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { APP_OVERLAY_MODAL_Z, QUIT_CONFIRM_Z } from '../overlayZIndex'

function tsxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) return tsxFiles(full)
    return entry.name.endsWith('.tsx') ? [full] : []
  })
}

describe('QUIT_CONFIRM_Z', () => {
  it('queda por encima de cualquier otro modal', () => {
    // La confirmación de salida se pide con otro modal abierto (contextos,
    // ajustes…) y tiene que verse. Este test es el guardián: un modal nuevo con
    // un z-index más alto la escondería y nadie lo notaría hasta cerrar la app.
    const offenders: string[] = []
    for (const file of tsxFiles(join(process.cwd(), 'src', 'renderer'))) {
      if (file.endsWith('HeroConfirmOverlay.tsx')) continue
      const source = readFileSync(file, 'utf8')
      for (const match of source.matchAll(/zIndex=\{(\d+)\}/g)) {
        if (Number(match[1]) >= QUIT_CONFIRM_Z) offenders.push(`${file}: ${match[1]}`)
      }
    }
    expect(offenders).toEqual([])
    expect(QUIT_CONFIRM_Z).toBeGreaterThan(APP_OVERLAY_MODAL_Z)
  })
})
