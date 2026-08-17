import * as THREE from 'three'
import { computePlaneGridCompositeOpacity } from '@themes/presets'
import {
  PLANE_GRID_HORIZONTAL_FOV_DEG,
  PLANE_GRID_CELL_SIZE_PX,
  PLANE_GRID_MIN_ANGULAR_STEP,
  PLANE_GRID_POINTER_LOOK_LERP,
  readPlaneGridLineColor,
  resolveCssColor,
  sphereGridLatitudeMax,
  spherePointerLookTarget,
  verticalFovForAspect,
} from './planeSphericalGridDraw'

export { verticalFovForAspect } from './planeSphericalGridDraw'
export {
  PLANE_GRID_POINTER_LOOK_LERP,
  PLANE_GRID_POINTER_PITCH_MAX_RAD,
  PLANE_GRID_POINTER_YAW_MAX_RAD,
  spherePointerLookTarget,
} from './planeSphericalGridDraw'

export type SpacetimeGridConfig = {
  cellSize: number
  opacity: number
  warmth: number
  lineColor: THREE.Color
  /** false = reduce-motion: sin parallax de pointer. */
  animate: boolean
}

export type PlaneSpacetimeGridRuntime = {
  resize: (width: number, height: number) => void
  updateConfig: (config: SpacetimeGridConfig) => void
  /** Energía del plano 0..1: solo uniforms, nunca reconstruye geometría. */
  setEnergy: (energy: number) => void
  /**
   * Mirada de cámara por pointer NDC (−1..1, +Y arriba).
   * Solo aplica con `animate`; reduce-motion ignora.
   */
  setPointerLook: (ndcX: number, ndcY: number) => void
  render: (timeMs: number) => void
  dispose: () => void
}

const SPHERE_RADIUS = 68
const MAX_HORIZONTAL_FOV_DEG = PLANE_GRID_HORIZONTAL_FOV_DEG
const MIN_ANGULAR_STEP = PLANE_GRID_MIN_ANGULAR_STEP
/** Observador en el centro; mira por el ecuador frontal (+Z). */
const SPHERE_CENTER = new THREE.Vector3(0, 0, 0)
const CAMERA_LOOK_TARGET = new THREE.Vector3(0, 0, 1)
/** Observador en el centro de la esfera; solo rota la rejilla, polos fuera del arco dibujado. */
const SPHERE_ROTATION_AXIS = new THREE.Vector3(0, 1, 0)
const SPHERE_Y_ROTATION_ARC_DEG = 45
const SPHERE_Y_ROTATION_PERIOD_S = 33
const POLE_EPSILON = 0.02

export function sphereCameraPosition(): [number, number, number] {
  return [SPHERE_CENTER.x, SPHERE_CENTER.y, SPHERE_CENTER.z]
}

export function sphereCameraLookTarget(): [number, number, number] {
  return [CAMERA_LOOK_TARGET.x, CAMERA_LOOK_TARGET.y, CAMERA_LOOK_TARGET.z]
}

export function sphereYRotationSpeedRadPerSec(
  arcDeg = SPHERE_Y_ROTATION_ARC_DEG,
  periodSec = SPHERE_Y_ROTATION_PERIOD_S,
): number {
  return (arcDeg * Math.PI) / (180 * periodSec)
}

export function sphereRotationAxis(): [number, number, number] {
  return [SPHERE_ROTATION_AXIS.x, SPHERE_ROTATION_AXIS.y, SPHERE_ROTATION_AXIS.z]
}

/** Punto en la superficie interior de la esfera (u=latitud, v=longitud). */
export function sphereInteriorPoint(
  u: number,
  v: number,
  radius: number,
): [number, number, number] {
  const cosU = Math.cos(u)
  return [
    radius * cosU * Math.sin(v),
    radius * Math.sin(u),
    radius * cosU * Math.cos(v),
  ]
}

/**
 * Resplandor hacia la dirección de la cámara (+Z mundo desde el centro).
 * En WebGL se evalúa en el vertex shader con `modelMatrix` para que el brillo
 * quede fijo en el FOV aunque la rejilla gire.
 */
export function interiorSphereLineWarmth(
  x: number,
  y: number,
  z: number,
  warmthMax = 0.42,
): number {
  const inv = 1 / Math.hypot(x, y, z)
  const forward = Math.max(0, z * inv)
  return forward ** 1.15 * warmthMax
}

const SPHERE_GRID_VERTEX_SHADER = `
  uniform vec3 lineColor;
  uniform vec3 accentColor;
  uniform float warmthMax;
  varying vec3 vColor;
  void main() {
    vec3 worldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    float invLen = inversesqrt(dot(worldPos, worldPos));
    float forward = max(0.0, worldPos.z * invLen);
    float warmth = pow(forward, 1.15) * warmthMax;
    vColor = mix(lineColor, accentColor, warmth);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const SPHERE_GRID_FRAGMENT_SHADER = `
  uniform float opacity;
  varying vec3 vColor;
  void main() {
    gl_FragColor = vec4(vColor, opacity);
  }
`

export function readSpacetimeGridConfig(el: HTMLElement, animate: boolean): SpacetimeGridConfig {
  const style = getComputedStyle(el)
  const root = document.documentElement
  const cellSize = Number.parseFloat(style.getPropertyValue('--plane-grid-size')) || PLANE_GRID_CELL_SIZE_PX
  const opacity = Number.parseFloat(style.getPropertyValue('--plane-grid-opacity')) || 0.093
  const warmthRaw = Number.parseFloat(style.getPropertyValue('--plane-grid-warmth'))
  // 0 es válido (sin tinte); no usar `||` porque lo sustituiría por el default.
  const warmth = Number.isFinite(warmthRaw) ? warmthRaw : 0
  return {
    cellSize,
    opacity,
    warmth,
    lineColor: new THREE.Color(readPlaneGridLineColor(root)),
    animate,
  }
}

function clampEnergy(energy: number): number {
  if (!Number.isFinite(energy)) return 0
  return Math.min(1, Math.max(0, energy))
}

/** Warmth con energía: hasta +80% de mezcla hacia el acento. */
export function energizedWarmth(base: number, energy: number): number {
  return base * (1 + 0.8 * clampEnergy(energy))
}

/** Factor de opacidad con energía: hasta +18%. */
export function energizedOpacityFactor(energy: number): number {
  return 1 + 0.18 * clampEnergy(energy)
}

/** Multiplicador de velocidad angular con energía: hasta 1.5×. */
export function energizedRotationMul(energy: number): number {
  return 1 + 0.5 * clampEnergy(energy)
}

/** Alfa final del material: la rejilla y el alfa que CSS aplica a `--plane-grid-line`. */
export function sphereMaterialOpacity(gridOpacity: number): number {
  return computePlaneGridCompositeOpacity(gridOpacity)
}

/**
 * Paso angular único para latitud y longitud.
 * En una cámara perspectiva con `aspect` correcto la distancia focal en píxeles
 * es la misma en H y V, así que un solo paso angular da una esfera uniforme
 * (celdas cuadradas en el centro de la vista, no rectángulos estirados).
 */
export function angularStepsForAspect(
  cellSize: number,
  height: number,
  verticalFovDeg: number,
): { stepLat: number; stepLon: number } {
  const vFovRad = (verticalFovDeg * Math.PI) / 180
  const focalPx = Math.max(height, 1) / 2 / Math.tan(vFovRad / 2)
  const step = Math.max(cellSize / focalPx, MIN_ANGULAR_STEP)
  return { stepLat: step, stepLon: step }
}

function syncSphereCamera(camera: THREE.PerspectiveCamera, width: number, height: number): void {
  const aspect = width / Math.max(height, 1)
  camera.aspect = aspect
  camera.fov = verticalFovForAspect(aspect)
  camera.position.copy(SPHERE_CENTER)
  camera.up.set(0, 1, 0)
  camera.lookAt(CAMERA_LOOK_TARGET)
  camera.updateProjectionMatrix()
}

type SegmentWriter = {
  positions: number[]
}

function writeSegment(
  writer: SegmentWriter,
  x1: number,
  y1: number,
  z1: number,
  x2: number,
  y2: number,
  z2: number,
): void {
  writer.positions.push(x1, y1, z1, x2, y2, z2)
}

function buildInteriorSphereGrid(
  width: number,
  height: number,
  cellSize: number,
): { positions: Float32Array; vertexCount: number } {
  const aspect = width / Math.max(height, 1)
  const verticalFovDeg = verticalFovForAspect(aspect)
  const { stepLat, stepLon } = angularStepsForAspect(cellSize, height, verticalFovDeg)
  const writer: SegmentWriter = { positions: [] }
  const curveSegments = 80
  const latMax = sphereGridLatitudeMax()

  const traceMeridian = (v: number): void => {
    let prev: [number, number, number] | null = null
    for (let i = 0; i <= curveSegments; i += 1) {
      const u = -latMax + (2 * latMax * i) / curveSegments
      const point = sphereInteriorPoint(u, v, SPHERE_RADIUS)
      if (prev) {
        writeSegment(writer, prev[0], prev[1], prev[2], point[0], point[1], point[2])
      }
      prev = point
    }
  }

  const traceParallel = (u: number): void => {
    if (Math.abs(Math.cos(u)) <= POLE_EPSILON) return
    let prev: [number, number, number] | null = null
    for (let i = 0; i <= curveSegments; i += 1) {
      const v = (-Math.PI + (2 * Math.PI * i) / curveSegments)
      const point = sphereInteriorPoint(u, v, SPHERE_RADIUS)
      if (prev) {
        writeSegment(writer, prev[0], prev[1], prev[2], point[0], point[1], point[2])
      }
      prev = point
    }
  }

  for (let u = -latMax; u <= latMax + stepLat * 0.5; u += stepLat) {
    traceParallel(u)
  }
  for (let v = -Math.PI; v < Math.PI - stepLon * 0.25; v += stepLon) {
    traceMeridian(v)
  }

  const vertexCount = writer.positions.length / 3
  return {
    positions: new Float32Array(writer.positions),
    vertexCount,
  }
}

function replaceGridGeometry(
  grid: THREE.LineSegments,
  width: number,
  height: number,
  cellSize: number,
): number {
  const built = buildInteriorSphereGrid(width, height, cellSize)
  grid.geometry.dispose()
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(built.positions, 3))
  grid.geometry = geometry
  return built.vertexCount
}

export function mountPlaneSpacetimeGrid(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  config: SpacetimeGridConfig,
): PlaneSpacetimeGridRuntime {
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(50, width / Math.max(height, 1), 0.1, SPHERE_RADIUS * 3)
  syncSphereCamera(camera, width, height)

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'low-power',
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.setSize(width, height, false)
  renderer.setClearColor(0x000000, 0)

  let activeConfig = config
  let layoutWidth = width
  let layoutHeight = height
  const accentHex = resolveCssColor(document.documentElement, '--accent', '#d4a84b')
  const accentColor = new THREE.Color(accentHex)

  const material = new THREE.ShaderMaterial({
    uniforms: {
      opacity: { value: sphereMaterialOpacity(activeConfig.opacity) },
      lineColor: { value: activeConfig.lineColor.clone() },
      accentColor: { value: accentColor.clone() },
      warmthMax: { value: activeConfig.warmth },
    },
    vertexShader: SPHERE_GRID_VERTEX_SHADER,
    fragmentShader: SPHERE_GRID_FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
  })

  const syncGridMaterialColors = (config: SpacetimeGridConfig): void => {
    material.uniforms.lineColor!.value.copy(config.lineColor)
    material.uniforms.accentColor!.value.copy(accentColor)
    material.uniforms.warmthMax!.value = config.warmth
    material.uniforms.opacity!.value = sphereMaterialOpacity(config.opacity)
  }

  const grid = new THREE.LineSegments(new THREE.BufferGeometry(), material)
  replaceGridGeometry(grid, width, height, activeConfig.cellSize)
  scene.add(grid)
  grid.rotation.set(0, 0, 0)

  let energy = 0
  const pointerTarget = new THREE.Vector2(0, 0)
  const lookCurrent = new THREE.Vector3().copy(CAMERA_LOOK_TARGET)
  const lookScratch = new THREE.Vector3()

  const applyEnergyUniforms = (): void => {
    material.uniforms.warmthMax!.value = energizedWarmth(activeConfig.warmth, energy)
    material.uniforms.opacity!.value = sphereMaterialOpacity(
      activeConfig.opacity * energizedOpacityFactor(energy),
    )
  }

  const applyCameraLook = (): void => {
    if (!activeConfig.animate) {
      lookCurrent.copy(CAMERA_LOOK_TARGET)
      camera.up.set(0, 1, 0)
      camera.lookAt(CAMERA_LOOK_TARGET)
      return
    }
    const [tx, ty, tz] = spherePointerLookTarget(pointerTarget.x, pointerTarget.y)
    lookScratch.set(tx, ty, tz)
    lookCurrent.lerp(lookScratch, PLANE_GRID_POINTER_LOOK_LERP)
    if (lookCurrent.lengthSq() < 1e-8) {
      lookCurrent.copy(CAMERA_LOOK_TARGET)
    } else {
      lookCurrent.normalize()
    }
    camera.up.set(0, 1, 0)
    camera.lookAt(lookCurrent)
  }

  const render = (_timeMs: number): void => {
    // Sin giro de malla: solo parallax de cámara (si animate) + energía.
    applyCameraLook()
    renderer.render(scene, camera)
  }

  return {
    resize(nextWidth: number, nextHeight: number): void {
      syncSphereCamera(camera, nextWidth, nextHeight)
      renderer.setSize(nextWidth, nextHeight, false)
      if (nextWidth !== layoutWidth || nextHeight !== layoutHeight) {
        layoutWidth = nextWidth
        layoutHeight = nextHeight
        replaceGridGeometry(grid, nextWidth, nextHeight, activeConfig.cellSize)
      }
    },
    updateConfig(next: SpacetimeGridConfig): void {
      activeConfig = next
      accentColor.set(resolveCssColor(document.documentElement, '--accent', '#d4a84b'))
      syncGridMaterialColors(next)
      // El tema reescribe warmth/opacity base: reaplica la energía vigente.
      applyEnergyUniforms()
      replaceGridGeometry(grid, layoutWidth, layoutHeight, next.cellSize)
      if (!next.animate) {
        pointerTarget.set(0, 0)
        lookCurrent.copy(CAMERA_LOOK_TARGET)
      }
    },
    setEnergy(next: number): void {
      const value = clampEnergy(next)
      if (value === energy) return
      energy = value
      applyEnergyUniforms()
    },
    setPointerLook(ndcX: number, ndcY: number): void {
      if (!activeConfig.animate) {
        pointerTarget.set(0, 0)
        return
      }
      const x = Number.isFinite(ndcX) ? Math.min(1, Math.max(-1, ndcX)) : 0
      const y = Number.isFinite(ndcY) ? Math.min(1, Math.max(-1, ndcY)) : 0
      pointerTarget.set(x, y)
    },
    render,
    dispose(): void {
      grid.geometry.dispose()
      material.dispose()
      renderer.dispose()
    },
  }
}
