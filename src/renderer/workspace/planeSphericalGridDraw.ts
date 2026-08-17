import { PLANE_GRID_LINE_ALPHA } from '@themes/presets'

export type SphericalGridOptions = {
  cellSizePx: number
  lineColor: string
  /** Opacidad compuesta (rejilla × alfa de la línea): el canvas la aplica, no el CSS. */
  lineAlpha?: number
  /** Dirección de mirada unitaria (mundo); default +Z. */
  lookDir?: readonly [number, number, number]
}

export type SphereGridPoint = {
  x: number
  y: number
}

/** FOV horizontal de la esfera (grados). */
export const PLANE_GRID_HORIZONTAL_FOV_DEG = 110
/** Tamaño de celda en pantalla (px). */
export const PLANE_GRID_CELL_SIZE_PX = Number((68 / 1.6).toFixed(3))
/** Paso angular mínimo de la rejilla. */
export const PLANE_GRID_MIN_ANGULAR_STEP = 0.035

/** Desplazamiento máximo de mirada con el cursor (radianes). */
export const PLANE_GRID_POINTER_YAW_MAX_RAD = (10 * Math.PI) / 180
export const PLANE_GRID_POINTER_PITCH_MAX_RAD = (7 * Math.PI) / 180
/**
 * Suavizado de mirada por frame (legacy WebGL / ~60fps).
 * Preferir `planeGridPointerLerpAlpha` + tau en el path canvas 2D.
 */
export const PLANE_GRID_POINTER_LOOK_LERP = 0.035
/** Espera tras el último pointermove antes de comprometer el NDC objetivo (ms). */
export const PLANE_GRID_POINTER_DEBOUNCE_MS = 100
/** Constante de tiempo: NDC suavizado → objetivo (s). Más alto = más inercia. */
export const PLANE_GRID_POINTER_NDC_TAU_S = 0.32
/** Constante de tiempo: mirada → look del NDC suavizado (s). */
export const PLANE_GRID_POINTER_LOOK_TAU_S = 0.55

/** Alfa de lerp frame-rate independent: `1 - exp(-dt / tau)`. */
export function planeGridPointerLerpAlpha(dtSec: number, tauSec: number): number {
  if (!(dtSec > 0) || !(tauSec > 0)) return 0
  return 1 - Math.exp(-dtSec / tauSec)
}

export function verticalFovForAspect(
  aspect: number,
  maxHorizontalFovDeg = PLANE_GRID_HORIZONTAL_FOV_DEG,
): number {
  const hFovRad = (maxHorizontalFovDeg * Math.PI) / 180
  const vFovRad = 2 * Math.atan(Math.tan(hFovRad / 2) / Math.max(aspect, 0.01))
  return (vFovRad * 180) / Math.PI
}

/** Distancia focal en px del viewport esférico. */
export function planeGridFocalPx(width: number, height: number): number {
  const aspect = width / Math.max(height, 1)
  const vFovRad = (verticalFovForAspect(aspect) * Math.PI) / 180
  return Math.max(height, 1) / 2 / Math.tan(vFovRad / 2)
}

/** Latitud máxima dibujada (ratio×π): deja convergencia polar fuera del FOV interior. */
export const PLANE_GRID_LATITUDE_MAX_RATIO = 0.47

export function sphereGridLatitudeMax(
  ratio = PLANE_GRID_LATITUDE_MAX_RATIO,
): number {
  return Math.PI * ratio
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(-1, value))
}

/**
 * Dirección de mirada desde el centro: +Z en reposo; yaw/pitch según NDC del pointer.
 * `ndcX` derecha+, `ndcY` arriba+. Pitch = +ndcY (canvas 2D: cursor arriba → vista arriba).
 */
export function spherePointerLookTarget(
  ndcX: number,
  ndcY: number,
  yawMaxRad = PLANE_GRID_POINTER_YAW_MAX_RAD,
  pitchMaxRad = PLANE_GRID_POINTER_PITCH_MAX_RAD,
): [number, number, number] {
  const x = clampUnit(ndcX)
  const y = clampUnit(ndcY)
  const yaw = x * yawMaxRad
  const pitch = y * pitchMaxRad
  const cosP = Math.cos(pitch)
  const sinP = Math.sin(pitch)
  const cosY = Math.cos(yaw)
  const sinY = Math.sin(yaw)
  return [
    cosP * sinY,
    sinP,
    cosP * cosY,
  ]
}

/** Dirección unitaria en la esfera (u=latitud, v=longitud). */
export function sphereInteriorDirection(u: number, v: number): [number, number, number] {
  const cosU = Math.cos(u)
  return [
    cosU * Math.sin(v),
    Math.sin(u),
    cosU * Math.cos(v),
  ]
}

function normalize3(x: number, y: number, z: number): [number, number, number] {
  const len = Math.hypot(x, y, z)
  if (len < 1e-8) return [0, 0, 1]
  return [x / len, y / len, z / len]
}

/** Base cámara: forward=look, right=+X, up=+Y (mundo up = +Y). */
export function sphereCameraBasis(
  lookDir: readonly [number, number, number],
): {
  forward: [number, number, number]
  right: [number, number, number]
  up: [number, number, number]
} {
  const forward = normalize3(lookDir[0], lookDir[1], lookDir[2])
  // right = normalize(cross(worldUp, forward)) con worldUp=(0,1,0) → (fz, 0, -fx)
  let right = normalize3(forward[2], 0, -forward[0])
  if (Math.hypot(right[0], right[1], right[2]) < 1e-6) {
    right = [1, 0, 0]
  }
  // up = cross(forward, right)
  const up = normalize3(
    forward[1] * right[2] - forward[2] * right[1],
    forward[2] * right[0] - forward[0] * right[2],
    forward[0] * right[1] - forward[1] * right[0],
  )
  return { forward, right, up }
}

/**
 * Proyección pinhole desde el centro hacia `lookDir`.
 * Coordenadas CSS px; null si queda detrás del plano de visión.
 */
export function projectSphereGridPoint(
  u: number,
  v: number,
  width: number,
  height: number,
  lookDir: readonly [number, number, number] = [0, 0, 1],
): SphereGridPoint | null {
  const [wx, wy, wz] = sphereInteriorDirection(u, v)
  const { forward, right, up } = sphereCameraBasis(lookDir)
  const camX = wx * right[0] + wy * right[1] + wz * right[2]
  const camY = wx * up[0] + wy * up[1] + wz * up[2]
  const camZ = wx * forward[0] + wy * forward[1] + wz * forward[2]
  if (camZ <= 0.02) return null
  const focalPx = planeGridFocalPx(width, height)
  return {
    x: width / 2 + (camX / camZ) * focalPx,
    y: height / 2 - (camY / camZ) * focalPx,
  }
}

/** Opacidad mínima en el centro del viewport (50% de la base en los bordes). */
export const PLANE_GRID_CENTER_OPACITY_RATIO = 0.5

/**
 * Factor 0.5..1 según distancia al centro del viewport (bordes = 1, centro = 0.5).
 */
export function planeGridRadialOpacityFactor(
  x: number,
  y: number,
  width: number,
  height: number,
): number {
  const cx = width / 2
  const cy = height / 2
  const maxDist = Math.hypot(cx, cy)
  if (maxDist < 1e-6) return PLANE_GRID_CENTER_OPACITY_RATIO
  const dist = Math.hypot(x - cx, y - cy)
  const t = Math.min(1, dist / maxDist)
  return PLANE_GRID_CENTER_OPACITY_RATIO + (1 - PLANE_GRID_CENTER_OPACITY_RATIO) * t
}

function snapLineCoord(value: number): number {
  return Math.round(value) + 0.5
}

function strokePolyline(
  ctx: CanvasRenderingContext2D,
  points: ReadonlyArray<SphereGridPoint | null>,
  baseAlpha: number,
  width: number,
  height: number,
): void {
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i]
    const p1 = points[i + 1]
    if (!p0 || !p1) continue
    const midX = (p0.x + p1.x) / 2
    const midY = (p0.y + p1.y) / 2
    ctx.globalAlpha = baseAlpha * planeGridRadialOpacityFactor(midX, midY, width, height)
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
    lookDir = [0, 0, 1],
  } = options

  if (width <= 0 || height <= 0) return

  const focalPx = planeGridFocalPx(width, height)
  const step = Math.max(cellSizePx / focalPx, PLANE_GRID_MIN_ANGULAR_STEP)
  const segments = 96
  const latMax = Math.min(sphereGridLatitudeMax(), Math.PI * 0.48)
  const poleEpsilon = 0.02
  const look = normalize3(lookDir[0], lookDir[1], lookDir[2])

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
      row.push(projectSphereGridPoint(u, v, width, height, look))
    }
    strokePolyline(ctx, row, lineAlpha, width, height)
  }

  for (let v = -Math.PI; v < Math.PI - step * 0.25; v += step) {
    const col: Array<SphereGridPoint | null> = []
    for (let i = 0; i <= segments; i += 1) {
      const u = -latMax + (2 * latMax * i) / segments
      col.push(projectSphereGridPoint(u, v, width, height, look))
    }
    strokePolyline(ctx, col, lineAlpha, width, height)
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

/** Color de línea: `--plane-grid-line-rgb` (blanco dark / negro light). */
export function readPlaneGridLineColor(root: HTMLElement): string {
  const declared = getComputedStyle(root).getPropertyValue('--plane-grid-line-rgb').trim()
  if (declared) return declared
  return resolveCssColor(root, '--plane-grid-line', resolveCssColor(root, '--border', 'rgb(255, 255, 255)'))
}

export function readSphericalGridTheme(el: HTMLElement): SphericalGridOptions {
  const style = getComputedStyle(el)
  const root = document.documentElement
  const size = Number.parseFloat(style.getPropertyValue('--plane-grid-size')) || PLANE_GRID_CELL_SIZE_PX
  const gridOpacity = Number.parseFloat(style.getPropertyValue('--plane-grid-opacity')) || 0.093
  const lineOpacity = Number.parseFloat(style.getPropertyValue('--plane-grid-line-opacity'))
  return {
    cellSizePx: size,
    lineColor: readPlaneGridLineColor(root),
    lineAlpha: Number.isFinite(lineOpacity) ? lineOpacity : gridOpacity * PLANE_GRID_LINE_ALPHA,
  }
}
