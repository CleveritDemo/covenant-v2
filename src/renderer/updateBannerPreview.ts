import type { UpdateState } from '@shared/updateState'
import { buildUpdateBannerPreviewTimeline } from '@shared/updateBannerPreview'

/**
 * Override renderer-only del UpdateBanner para Ajustes → Developer.
 * No toca IPC ni electron-updater.
 */

let override: UpdateState | null = null
let generation = 0
const listeners = new Set<() => void>()
const pendingTimers = new Set<ReturnType<typeof setTimeout>>()

function emit(): void {
  for (const listener of listeners) listener()
}

function clearTimers(): void {
  for (const id of pendingTimers) clearTimeout(id)
  pendingTimers.clear()
}

function schedule(gen: number, delayMs: number, apply: () => void): void {
  const id = setTimeout(() => {
    pendingTimers.delete(id)
    if (gen !== generation) return
    apply()
  }, delayMs)
  pendingTimers.add(id)
}

export function getUpdateBannerPreviewState(): UpdateState | null {
  return override
}

export function isUpdateBannerPreviewActive(): boolean {
  return override !== null
}

export function subscribeUpdateBannerPreview(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function clearUpdateBannerPreview(): void {
  generation += 1
  clearTimers()
  if (override === null) return
  override = null
  emit()
}

/** Cicla available → downloading → ready → idle. Cancela un preview previo. */
export function previewUpdateBanner(): void {
  generation += 1
  const gen = generation
  clearTimers()

  const steps = buildUpdateBannerPreviewTimeline()
  for (const step of steps) {
    schedule(gen, step.atMs, () => {
      override = step.state
      emit()
    })
  }
}
