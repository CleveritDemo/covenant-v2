export type AuroraParticle = {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  color: string
}

export const AURORA_COLOR_VARS = ['--accent', '--theme-cyan', '--theme-magenta', '--theme-blue'] as const

/** Pico de opacidad: legible bajo el glass suave, sin competir con el texto. */
export const AURORA_ALPHA_PEAK = 0.9

export function readAuroraThemeColors(el: Element): string[] {
  const styles = getComputedStyle(el)
  const colors: string[] = []
  for (const name of AURORA_COLOR_VARS) {
    const value = styles.getPropertyValue(name).trim()
    if (value) colors.push(value)
  }
  return colors.length > 0 ? colors : ['rgba(120, 180, 255, 0.7)']
}

export function drawAuroraParticle(ctx: CanvasRenderingContext2D, p: AuroraParticle): void {
  const t = 1 - p.life / p.maxLife
  const fade = Math.sin(Math.min(1, p.life / p.maxLife) * Math.PI)
  const alpha = Math.max(0, fade * AURORA_ALPHA_PEAK * (1 - t * 0.18))
  if (alpha < 0.02) return

  const radius = p.size * (1 - t * 0.45)
  if (radius < 0.2) return

  ctx.globalAlpha = alpha
  ctx.fillStyle = p.color
  ctx.beginPath()
  ctx.arc(p.x, p.y, Math.max(0.7, radius * 0.55), 0, Math.PI * 2)
  ctx.fill()
}

export type GravityFallParticle = AuroraParticle & {
  sinkX: number
  sinkY: number
  spawnDist: number
  pulsePhase: number
}

/** Estela corta lejana; pulso de tamaño; estiramiento solo al acercarse al pozo. */
export function drawGravityFallParticle(
  ctx: CanvasRenderingContext2D,
  p: GravityFallParticle,
): void {
  const dx = p.sinkX - p.x
  const dy = p.sinkY - p.y
  const dist = Math.max(0.001, Math.hypot(dx, dy))
  const approach = 1 - Math.min(1, dist / Math.max(p.spawnDist, 1))
  const lifeRatio = Math.max(0, p.life / p.maxLife)
  const lifeFade = Math.sin(Math.min(1, lifeRatio) * Math.PI)
  const pulse = 0.56 + 0.44 * Math.sin((1 - lifeRatio) * Math.PI * 2.8 + p.pulsePhase)
  const stretchT = Math.pow(Math.max(0, (approach - 0.68) / 0.32), 2)
  const scaleX = 1 - stretchT * 0.52
  const scaleY = 1.02 + stretchT * 0.34
  const angle = Math.atan2(dy, dx)
  const base = p.size * pulse * (0.82 + (1 - approach) * 0.1)
  const rx = Math.max(0.32, base * scaleX * 0.36)
  const ry = Math.max(0.38, base * scaleY * 0.36)
  const alpha = Math.max(
    0,
    lifeFade * AURORA_ALPHA_PEAK * (0.32 + (1 - approach) * 0.42) * (0.68 + pulse * 0.32),
  )
  if (alpha < 0.02) return

  ctx.save()
  ctx.translate(p.x, p.y)
  ctx.rotate(angle + Math.PI / 2)
  ctx.globalAlpha = alpha

  const grad = ctx.createRadialGradient(0, -ry * 0.18, 0, 0, 0, Math.max(rx, ry))
  grad.addColorStop(0, p.color)
  grad.addColorStop(0.52, p.color)
  grad.addColorStop(1, 'rgba(0,0,0,0)')

  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}
