import { PLANE_GRID_LINE_ALPHA } from '@themes/presets'

export type SphericalGridOptions = {
  cellSizePx: number
  lineColor: string
  /** Opacidad compuesta (rejilla × alfa de la línea): el canvas la aplica, no el CSS. */
  lineAlpha?: number
  /** Escala del arco visible (mayor = más curvatura en bordes). */
  fovScale?: number
  /** Elevación máxima dibujada (radianes). */
  uMax?: number
}

export type SphereGridPoint = {
  x: number
  y: number
}

/** FOV horizontal de la esfera WebGL y del fallback 2D (grados). */
export const PLANE_GRID_HORIZONTAL_FOV_DEG = 110
/** Opacidad mínima en el borde del FOV (centro = 1). */
export const PLANE_GRID_FOV_FALLOFF_MIN = 0.5

/** Semiangulo del cono visual hasta la esquina del frustum. */
export function maxFovHalfAngleRad(horizontalFovDeg: number, aspect: number): number {
  const hHalfRad = (horizontalFovDeg * Math.PI) / 180 / 2
  const vHalfRad = Math.atan(Math.tan(hHalfRad) / Math.max(aspect, 0.01))
  return Math.atan(Math.hypot(Math.tan(hHalfRad), Math.tan(vHalfRad)))
}

/** Opacidad relativa por distancia angular desde el centro del FOV (+Z). */
export function sphereGridFovFalloff(
  x: number,
  y: number,
  z: number,
  maxAngleRad: number,
  minOpacity = PLANE_GRID_FOV_FALLOFF_MIN,
): number {
  const len = Math.hypot(x, y, z)
  if (len <= 0) return 1
  const cosAngle = Math.max(-1, Math.min(1, z / len))
  const angle = Math.acos(cosAngle)
  const t = Math.min(1, angle / Math.max(maxAngleRad, 0.001))
  return 1 - t * (1 - minOpacity)
}

export function sphereGridFovFalloffFromAngles(
  u: number,
  v: number,
  maxAngleRad: number,
  minOpacity = PLANE_GRID_FOV_FALLOFF_MIN,
): number {
  const cosU = Math.cos(u)
  return sphereGridFovFalloff(
    cosU * Math.sin(v),
    Math.sin(u),
    cosU * Math.cos(v),
    maxAngleRad,
    minOpacity,
  )
}

/** Proyección pinhole desde el centro de la esfera hacia el hemisferio frontal. */
export function projectSphereGridPoint(
  u: number,
  v: number,
  width: number,
  height: number,
  fovScale: number,
): SphereGridPoint | null {
  const cosU = Math.cos(u)
  const dirZ = cosU * Math.cos(v)
  if (dirZ <= 0.02) return null

  const scale = Math.min(width, height) * fovScale * 0.5
  const dirX = cosU * Math.sin(v)
  const dirY = Math.sin(u)
  return {
    x: width / 2 + (dirX / dirZ) * scale,
    y: height / 2 - (dirY / dirZ) * scale,
  }
}

function snapLineCoord(value: number): number {
  return Math.round(value) + 0.5
}

function strokePolylineWithFalloff(
  ctx: CanvasRenderingContext2D,
  points: ReadonlyArray<SphereGridPoint | null>,
  alphas: ReadonlyArray<number | null>,
  baseAlpha: number,
): void {
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i]
    const p1 = points[i + 1]
    const a0 = alphas[i]
    const a1 = alphas[i + 1]
    if (!p0 || !p1 || a0 == null || a1 == null) continue
    ctx.globalAlpha = baseAlpha * (a0 + a1) / 2
    ctx.beginPath()
    ctx.moveTo(snapLineCoord(p0.x), snapLineCoord(p0.y))
    ctx.lineTo(snapLineCoord(p1.x), snapLineCoord(p1.y))
    ctx.stroke()
  }
}

/** Dibuja la rejilla interior de esfera sobre un canvas 2D (coordenadas CSS px). */
export function drawSphericalGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  options: SphericalGridOptions,
): void {
  const {
    cellSizePx,
    lineColor,
    lineAlpha = 1,
    fovScale = 1.72,
    uMax = Math.PI * 0.47,
  } = options

  if (width <= 0 || height <= 0) return

  const scale = Math.min(width, height) * fovScale * 0.5
  const step = Math.max(cellSizePx / scale, 0.04)
  const segments = 96
  const frontMax = Math.min(uMax, Math.PI * 0.48)
  const maxAngleRad = maxFovHalfAngleRad(PLANE_GRID_HORIZONTAL_FOV_DEG, width / Math.max(height, 1))

  ctx.clearRect(0, 0, width, height)
  ctx.strokeStyle = lineColor
  ctx.lineWidth = 1
  ctx.lineJoin = 'round'
  ctx.lineCap = 'butt'

  for (let u = -frontMax; u <= frontMax + step * 0.5; u += step) {
    const row: Array<SphereGridPoint | null> = []
    const rowAlpha: Array<number | null> = []
    for (let i = 0; i <= segments; i += 1) {
      const v = -frontMax + (2 * frontMax * i) / segments
      const point = projectSphereGridPoint(u, v, width, height, fovScale)
      row.push(point)
      rowAlpha.push(point ? sphereGridFovFalloffFromAngles(u, v, maxAngleRad) : null)
    }
    strokePolylineWithFalloff(ctx, row, rowAlpha, lineAlpha)
  }

  for (let v = -Math.PI + step * 0.5; v <= Math.PI - step * 0.5; v += step) {
    if (Math.cos(v) <= 0.02) continue
    const col: Array<SphereGridPoint | null> = []
    const colAlpha: Array<number | null> = []
    for (let i = 0; i <= segments; i += 1) {
      const u = -frontMax + (2 * frontMax * i) / segments
      const point = projectSphereGridPoint(u, v, width, height, fovScale)
      col.push(point)
      colAlpha.push(point ? sphereGridFovFalloffFromAngles(u, v, maxAngleRad) : null)
    }
    strokePolylineWithFalloff(ctx, col, colAlpha, lineAlpha)
  }

  ctx.globalAlpha = 1
}

let colorProbe: HTMLSpanElement | null = null

function isResolvedColor(value: string): boolean {
  return Boolean(value)
    && value !== 'transparent'
    && value !== 'rgba(0, 0, 0, 0)'
}

/** Resuelve un custom property con color-mix a rgb()/rgba() para canvas. */
export function resolveCssColor(root: HTMLElement, varName: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback
  if (!colorProbe) {
    colorProbe = document.createElement('span')
    colorProbe.style.position = 'absolute'
    colorProbe.style.visibility = 'hidden'
    colorProbe.style.pointerEvents = 'none'
    colorProbe.setAttribute('aria-hidden', 'true')
  }
  if (!colorProbe.parentElement) root.appendChild(colorProbe)

  colorProbe.style.backgroundColor = 'transparent'
  colorProbe.style.color = 'transparent'
  colorProbe.style.backgroundColor = `var(${varName})`
  const background = getComputedStyle(colorProbe).backgroundColor
  if (isResolvedColor(background)) return background

  colorProbe.style.backgroundColor = 'transparent'
  colorProbe.style.color = `var(${varName})`
  const foreground = getComputedStyle(colorProbe).color
  if (isResolvedColor(foreground)) return foreground

  return fallback
}

/**
 * Color de línea listo para canvas/WebGL. `--plane-grid-line-rgb` lo escribe
 * `applyTheme()` ya mezclado; el `color-mix` de `--plane-grid-line` solo sirve para CSS.
 */
export function readPlaneGridLineColor(root: HTMLElement): string {
  const declared = getComputedStyle(root).getPropertyValue('--plane-grid-line-rgb').trim()
  if (declared) return declared
  return resolveCssColor(root, '--plane-grid-line', resolveCssColor(root, '--border', 'rgb(34, 42, 60)'))
}

export function readSphericalGridTheme(el: HTMLElement): SphericalGridOptions {
  const style = getComputedStyle(el)
  const root = document.documentElement
  const size = Number.parseFloat(style.getPropertyValue('--plane-grid-size')) || 68
  const opacity = Number.parseFloat(style.getPropertyValue('--plane-grid-opacity')) || 0.352
  return {
    cellSizePx: size,
    lineColor: readPlaneGridLineColor(root),
    lineAlpha: opacity * PLANE_GRID_LINE_ALPHA,
  }
}
