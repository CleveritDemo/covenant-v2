import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  APP_OVERLAY_MODAL_Z,
  ONBOARDING_COACH_MARK_Z,
  PANE_CONFIRM_MODAL_Z,
  PLANE_CHROME_STACK_Z,
  PLANE_CHAT_STACK_Z,
  QUIT_CONFIRM_Z,
} from '../overlayZIndex'

function walkFiles(dir: string, extensions: string[]): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) return walkFiles(full, extensions)
    return extensions.some(ext => entry.name.endsWith(ext)) ? [full] : []
  })
}

function tsxFiles(dir: string): string[] {
  return walkFiles(dir, ['.tsx'])
}

describe('ONBOARDING_COACH_MARK_Z', () => {
  it('queda sobre los modales de contextos (920) y bajo el confirm de salida', () => {
    // El paso create_context ancla en los botones del formulario de contextos
    // (TerminalModal a 920): por debajo de eso el coach no se vería.
    expect(ONBOARDING_COACH_MARK_Z).toBeGreaterThan(920)
    expect(ONBOARDING_COACH_MARK_Z).toBeLessThan(QUIT_CONFIRM_Z)
    expect(ONBOARDING_COACH_MARK_Z).toBeGreaterThan(APP_OVERLAY_MODAL_Z)
  })
})

describe('PLANE_CHAT_STACK_Z', () => {
  it('queda entre pane windows y modales portaled', () => {
    expect(PLANE_CHAT_STACK_Z).toBeGreaterThan(140)
    expect(PLANE_CHAT_STACK_Z).toBeLessThan(APP_OVERLAY_MODAL_Z)
  })
})

describe('PLANE_CHROME_STACK_Z', () => {
  it('queda entre chat del plano y badges wiki', () => {
    expect(PLANE_CHROME_STACK_Z).toBeGreaterThan(PLANE_CHAT_STACK_Z)
    expect(PLANE_CHROME_STACK_Z).toBeLessThan(300)
  })
})

describe('PANE_CONFIRM_MODAL_Z', () => {
  it('queda sobre el módulo de brainstorm y bajo el confirm de salida', () => {
    // «¿Cerrar esta ventana de agente?» se pedía a 600 y quedaba debajo del
    // BrainstormOverlay (670): el pane no se podía cerrar con el módulo abierto.
    expect(PANE_CONFIRM_MODAL_Z).toBeGreaterThan(APP_OVERLAY_MODAL_Z)
    expect(PANE_CONFIRM_MODAL_Z).toBeGreaterThan(ONBOARDING_COACH_MARK_Z)
    expect(PANE_CONFIRM_MODAL_Z).toBeLessThan(QUIT_CONFIRM_Z)
  })
})

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
