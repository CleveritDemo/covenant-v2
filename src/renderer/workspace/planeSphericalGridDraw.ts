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
/** Tamaño de celda en pantalla (px); densidad 3D/2D y CSS plana elevada. */
export const PLANE_GRID_CELL_SIZE_PX = Number((68 / 1.6).toFixed(3))
/** Paso angular mínimo compartido entre WebGL y canvas 2D. */
export const PLANE_GRID_MIN_ANGULAR_STEP = 0.035

export function verticalFovForAspect(
  aspect: number,
  maxHorizontalFovDeg = PLANE_GRID_HORIZONTAL_FOV_DEG,
): number {
  const hFovRad = (maxHorizontalFovDeg * Math.PI) / 180
  const vFovRad = 2 * Math.atan(Math.tan(hFovRad / 2) / Math.max(aspect, 0.01))
  return (vFovRad * 180) / Math.PI
}

/** Distancia focal en px del viewport esférico (misma fórmula que WebGL). */
export function planeGridFocalPx(width: number, height: number): number {
  const aspect = width / Math.max(height, 1)
  const vFovRad = (verticalFovForAspect(aspect) * Math.PI) / 180
  return Math.max(height, 1) / 2 / Math.tan(vFovRad / 2)
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

function strokePolyline(
  ctx: CanvasRenderingContext2D,
  points: ReadonlyArray<SphereGridPoint | null>,
  baseAlpha: number,
): void {
  ctx.globalAlpha = baseAlpha
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i]
    const p1 = points[i + 1]
    if (!p0 || !p1) continue
    ctx.beginPath()
    ctx.moveTo(snapLineCoord(p0.x), snapLineCoord(p0.y))
    ctx.lineTo(snapLineCoord(p1.x), snapLineCoord(p1.y))
    ctx.stroke()
  }
}

/** Latitud máxima dibujada (ratio×π): deja convergencia polar fuera del FOV interior. */
export const PLANE_GRID_LATITUDE_MAX_RATIO = 0.47

export function sphereGridLatitudeMax(
  ratio = PLANE_GRID_LATITUDE_MAX_RATIO,
): number {
  return Math.PI * ratio
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
    fovScale: fovScaleOverride,
    uMax = sphereGridLatitudeMax(),
  } = options

  if (width <= 0 || height <= 0) return

  const focalPx = planeGridFocalPx(width, height)
  const fovScale = fovScaleOverride ?? focalPx / (Math.min(width, height) * 0.5)
  const step = Math.max(cellSizePx / focalPx, PLANE_GRID_MIN_ANGULAR_STEP)
  const segments = 96
  const latMax = Math.min(uMax, Math.PI * 0.48)
  const poleEpsilon = 0.02

  ctx.clearRect(0, 0, width, height)
  ctx.strokeStyle = lineColor
  ctx.lineWidth = 1
  ctx.lineJoin = 'round'
  ctx.lineCap = 'butt'

  for (let u = -latMax; u <= latMax + step * 0.5; u += step) {
    if (Math.abs(Math.cos(u)) <= poleEpsilon) continue
    const row: Array<SphereGridPoint | null> = []
    for (let i = 0; i <= segments; i += 1) {
      const v = -Math.PI + (2 * Math.PI * i) / segments
      row.push(projectSphereGridPoint(u, v, width, height, fovScale))
    }
    strokePolyline(ctx, row, lineAlpha)
  }

  for (let v = -Math.PI; v < Math.PI - step * 0.25; v += step) {
    const col: Array<SphereGridPoint | null> = []
    for (let i = 0; i <= segments; i += 1) {
      const u = -latMax + (2 * latMax * i) / segments
      col.push(projectSphereGridPoint(u, v, width, height, fovScale))
    }
    strokePolyline(ctx, col, lineAlpha)
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
  const size = Number.parseFloat(style.getPropertyValue('--plane-grid-size')) || PLANE_GRID_CELL_SIZE_PX
  const gridOpacity = Number.parseFloat(style.getPropertyValue('--plane-grid-opacity')) || 0.619
  const lineOpacity = Number.parseFloat(style.getPropertyValue('--plane-grid-line-opacity'))
  return {
    cellSizePx: size,
    lineColor: readPlaneGridLineColor(root),
    lineAlpha: Number.isFinite(lineOpacity) ? lineOpacity : gridOpacity * PLANE_GRID_LINE_ALPHA,
  }
}
