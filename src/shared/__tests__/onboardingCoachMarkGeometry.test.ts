import { describe, it, expect } from 'vitest'
import { resolveCoachMarkTooltipTop } from '../onboardingCoachMarkGeometry'

describe('resolveCoachMarkTooltipTop', () => {
  it('ancla arriba con espacio abajo → above=false, top=anchorBottom+12', () => {
    const result = resolveCoachMarkTooltipTop({
      anchorTop: 40,
      anchorBottom: 72,
      tooltipHeight: 96,
      viewportHeight: 640,
    })
    expect(result.above).toBe(false)
    expect(result.top).toBe(84)
  })

  it('assign_context ES (112px) con ancla a 40px del borde inferior → above=true, top>=8', () => {
    const result = resolveCoachMarkTooltipTop({
      anchorTop: 560,
      anchorBottom: 600,
      tooltipHeight: 112,
      viewportHeight: 640,
    })
    expect(result.above).toBe(true)
    expect(result.top).toBeGreaterThanOrEqual(8)
  })

  it('clamp superior: ancla en top=20 sin espacio arriba → above=false y top>=8', () => {
    const result = resolveCoachMarkTooltipTop({
      anchorTop: 20,
      anchorBottom: 52,
      tooltipHeight: 112,
      viewportHeight: 640,
    })
    expect(result.above).toBe(false)
    expect(result.top).toBeGreaterThanOrEqual(8)
  })

  it('clamp inferior: anchorBottom=620 → top <= viewportHeight - tooltipHeight - 8', () => {
    const result = resolveCoachMarkTooltipTop({
      anchorTop: 580,
      anchorBottom: 620,
      tooltipHeight: 112,
      viewportHeight: 640,
    })
    expect(result.top).toBeLessThanOrEqual(640 - 112 - 8)
  })

  it('tooltip más alto que el viewport → top=8 sin NaN', () => {
    const result = resolveCoachMarkTooltipTop({
      anchorTop: 100,
      anchorBottom: 140,
      tooltipHeight: 700,
      viewportHeight: 640,
    })
    expect(result.top).toBe(8)
    expect(Number.isNaN(result.top)).toBe(false)
  })
})
