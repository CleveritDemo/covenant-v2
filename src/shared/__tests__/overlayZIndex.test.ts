import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  APP_CHROME_MODAL_Z,
  APP_OVERLAY_MODAL_Z,
  ONBOARDING_COACH_MARK_Z,
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
  it('queda entre BrainstormOverlay y fab/pool elevated', () => {
    expect(APP_OVERLAY_MODAL_Z).toBe(670)
    expect(ONBOARDING_COACH_MARK_Z).toBe(674)
    expect(ONBOARDING_COACH_MARK_Z).toBeGreaterThan(APP_OVERLAY_MODAL_Z)
    expect(ONBOARDING_COACH_MARK_Z).toBeLessThan(675)
    expect(675).toBeLessThan(676)
    expect(676).toBeLessThan(680)
    expect(680).toBeLessThan(690)
    expect(690).toBeLessThan(APP_CHROME_MODAL_Z)
    expect(APP_CHROME_MODAL_Z).toBe(700)
    expect(APP_CHROME_MODAL_Z).toBeLessThan(QUIT_CONFIRM_Z)
    expect(QUIT_CONFIRM_Z).toBe(990)
  })
})

describe('banda z del coach mark', () => {
  it('no permite capas hardcodeadas entre coach mark y fab/pool elevated', () => {
    const offenders: string[] = []
    const srcDir = join(process.cwd(), 'src')
    for (const file of walkFiles(srcDir, ['.css'])) {
      const source = readFileSync(file, 'utf8')
      for (const match of source.matchAll(/z-index:\s*(\d+)/g)) {
        const n = Number(match[1])
        if (n >= ONBOARDING_COACH_MARK_Z && n < 675) offenders.push(`${file}: ${n}`)
      }
    }
    for (const file of walkFiles(srcDir, ['.tsx'])) {
      const source = readFileSync(file, 'utf8')
      for (const match of source.matchAll(/zIndex=\{(\d+)\}/g)) {
        const n = Number(match[1])
        if (n >= ONBOARDING_COACH_MARK_Z && n < 675) offenders.push(`${file}: ${n}`)
      }
    }
    expect(offenders).toEqual([])
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
