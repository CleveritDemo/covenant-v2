import { describe, expect, it } from 'vitest'
import {
  UPDATE_BANNER_PREVIEW_VERSION,
  buildUpdateBannerPreviewTimeline,
} from '../updateBannerPreview'

describe('buildUpdateBannerPreviewTimeline', () => {
  it('walks available → downloading ticks → ready → clear', () => {
    const steps = buildUpdateBannerPreviewTimeline({ stageMs: 2000, downloadTicks: 4 })
    expect(steps[0]).toEqual({
      atMs: 0,
      state: { kind: 'available', version: UPDATE_BANNER_PREVIEW_VERSION, notes: null },
    })
    const downloading = steps.filter(s => s.state?.kind === 'downloading')
    expect(downloading).toHaveLength(4)
    expect(downloading[0]!.state).toMatchObject({ percent: 0 })
    expect(downloading.at(-1)!.state).toMatchObject({ percent: 100 })
    expect(steps.some(s => s.state?.kind === 'ready')).toBe(true)
    expect(steps.at(-1)).toEqual({ atMs: expect.any(Number), state: null })
    expect(steps.at(-1)!.atMs).toBeGreaterThan(steps.at(-2)!.atMs)
  })

  it('keeps atMs strictly non-decreasing', () => {
    const steps = buildUpdateBannerPreviewTimeline()
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i]!.atMs).toBeGreaterThanOrEqual(steps[i - 1]!.atMs)
    }
  })
})
