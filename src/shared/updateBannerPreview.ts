import type { UpdateState } from './updateState'

export const UPDATE_BANNER_PREVIEW_VERSION = '0.0.0-preview'

export type UpdateBannerPreviewStep = { atMs: number; state: UpdateState | null }

/** Timeline for the Developer preview: available → downloading → ready → clear. */
export function buildUpdateBannerPreviewTimeline(opts?: {
  stageMs?: number
  downloadTicks?: number
}): UpdateBannerPreviewStep[] {
  const stageMs = opts?.stageMs ?? 2000
  const downloadTicks = Math.max(2, opts?.downloadTicks ?? 5)
  const version = UPDATE_BANNER_PREVIEW_VERSION
  const steps: UpdateBannerPreviewStep[] = [
    { atMs: 0, state: { kind: 'available', version, notes: null } },
  ]
  let t = stageMs
  for (let i = 0; i < downloadTicks; i++) {
    const percent = Math.round((i / (downloadTicks - 1)) * 100)
    steps.push({ atMs: t, state: { kind: 'downloading', version, percent } })
    t += Math.round(stageMs / downloadTicks)
  }
  steps.push({ atMs: t, state: { kind: 'ready', version, notes: null } })
  t += stageMs
  steps.push({ atMs: t, state: null })
  return steps
}
