import * as THREE from 'three'
import { PLANE_GRID_LINE_ALPHA } from '@themes/presets'
import {
  PLANE_GRID_HORIZONTAL_FOV_DEG,
  PLANE_GRID_CELL_SIZE_PX,
  PLANE_GRID_MIN_ANGULAR_STEP,
  readPlaneGridLineColor,
  resolveCssColor,
  verticalFovForAspect,
} from './planeSphericalGridDraw'

export { verticalFovForAspect } from './planeSphericalGridDraw'

export type SpacetimeGridConfig = {
  cellSize: number
  opacity: number
  warmth: number
  lineColor: THREE.Color
  animate: boolean
}

export type PlaneSpacetimeGridRuntime = {
  resize: (width: number, height: number) => void
  updateConfig: (config: SpacetimeGridConfig) => void
  render: (timeMs: number) => void
  dispose: () => void
}

const SPHERE_RADIUS = 68
const MAX_HORIZONTAL_FOV_DEG = PLANE_GRID_HORIZONTAL_FOV_DEG
const MIN_ANGULAR_STEP = PLANE_GRID_MIN_ANGULAR_STEP
/** Observador en el centro; mira por el ecuador frontal (+Z), alineado con planeSphericalGridDraw. */
const SPHERE_CENTER = new THREE.Vector3(0, 0, 0)
const CAMERA_LOOK_TARGET = new THREE.Vector3(0, 0, 1)
/** Giro en Y (vertical): mantiene polos arriba/abajo del FOV. */
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

/** Resplandor simétrico hacia el hemisferio frontal (+Z) desde el centro. */
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

export function readSpacetimeGridConfig(el: HTMLElement, animate: boolean): SpacetimeGridConfig {
  const style = getComputedStyle(el)
  const root = document.documentElement
  const cellSize = Number.parseFloat(style.getPropertyValue('--plane-grid-size')) || PLANE_GRID_CELL_SIZE_PX
  const opacity = Number.parseFloat(style.getPropertyValue('--plane-grid-opacity')) || 0.595
  const warmth = Number.parseFloat(style.getPropertyValue('--plane-grid-warmth')) || 0.42
  return {
    cellSize,
    opacity,
    warmth,
    lineColor: new THREE.Color(readPlaneGridLineColor(root)),
    animate,
  }
}

/** Alfa final del material: la rejilla y el alfa que CSS aplica a `--plane-grid-line`. */
export function sphereMaterialOpacity(gridOpacity: number): number {
  return gridOpacity * PLANE_GRID_LINE_ALPHA
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
  colors: number[]
}

function writeSegment(
  writer: SegmentWriter,
  x1: number,
  y1: number,
  z1: number,
  x2: number,
  y2: number,
  z2: number,
  lineColor: THREE.Color,
  accentColor: THREE.Color,
  warmthMax: number,
): void {
  const mix = new THREE.Color()
  const w1 = interiorSphereLineWarmth(x1, y1, z1, warmthMax)
  const w2 = interiorSphereLineWarmth(x2, y2, z2, warmthMax)
  mix.copy(lineColor).lerp(accentColor, w1)
  writer.positions.push(x1, y1, z1, x2, y2, z2)
  writer.colors.push(mix.r, mix.g, mix.b)
  mix.copy(lineColor).lerp(accentColor, w2)
  writer.colors.push(mix.r, mix.g, mix.b)
}

function buildInteriorSphereGrid(
  width: number,
  height: number,
  cellSize: number,
  lineColor: THREE.Color,
  accentColor: THREE.Color,
  warmthMax: number,
): { positions: Float32Array; colors: Float32Array; vertexCount: number } {
  const aspect = width / Math.max(height, 1)
  const verticalFovDeg = verticalFovForAspect(aspect)
  const { stepLat, stepLon } = angularStepsForAspect(cellSize, height, verticalFovDeg)
  const writer: SegmentWriter = { positions: [], colors: [] }
  const curveSegments = 80
  const latMax = Math.PI / 2 - POLE_EPSILON

  const traceMeridian = (v: number): void => {
    let prev: [number, number, number] | null = null
    for (let i = 0; i <= curveSegments; i += 1) {
      const u = -latMax + (2 * latMax * i) / curveSegments
      const point = sphereInteriorPoint(u, v, SPHERE_RADIUS)
      if (prev) {
        writeSegment(writer, prev[0], prev[1], prev[2], point[0], point[1], point[2], lineColor, accentColor, warmthMax)
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
        writeSegment(writer, prev[0], prev[1], prev[2], point[0], point[1], point[2], lineColor, accentColor, warmthMax)
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
    colors: new Float32Array(writer.colors),
    vertexCount,
  }
}

function replaceGridGeometry(
  grid: THREE.LineSegments,
  width: number,
  height: number,
  lineColor: THREE.Color,
  accentColor: THREE.Color,
  cellSize: number,
  warmthMax: number,
): number {
  const built = buildInteriorSphereGrid(width, height, cellSize, lineColor, accentColor, warmthMax)
  grid.geometry.dispose()
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(built.positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(built.colors, 3))
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
    },
    vertexShader: `
      attribute vec3 color;
      varying vec3 vColor;
      void main() {
        vColor = color;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float opacity;
      varying vec3 vColor;
      void main() {
        gl_FragColor = vec4(vColor, opacity);
      }
    `,
    transparent: true,
    depthWrite: false,
  })

  const grid = new THREE.LineSegments(new THREE.BufferGeometry(), material)
  replaceGridGeometry(
    grid,
    width,
    height,
    activeConfig.lineColor,
    accentColor,
    activeConfig.cellSize,
    activeConfig.warmth,
  )
  scene.add(grid)

  const rotationQuat = new THREE.Quaternion()

  const render = (timeMs: number): void => {
    if (activeConfig.animate) {
      const angle = timeMs * 0.001 * sphereYRotationSpeedRadPerSec()
      rotationQuat.setFromAxisAngle(SPHERE_ROTATION_AXIS, angle)
      grid.setRotationFromQuaternion(rotationQuat)
    } else {
      grid.rotation.set(0, 0, 0)
    }
    renderer.render(scene, camera)
  }

  return {
    resize(nextWidth: number, nextHeight: number): void {
      syncSphereCamera(camera, nextWidth, nextHeight)
      renderer.setSize(nextWidth, nextHeight, false)
      if (nextWidth !== layoutWidth || nextHeight !== layoutHeight) {
        layoutWidth = nextWidth
        layoutHeight = nextHeight
        replaceGridGeometry(
          grid,
          nextWidth,
          nextHeight,
          activeConfig.lineColor,
          accentColor,
          activeConfig.cellSize,
          activeConfig.warmth,
        )
      }
    },
    updateConfig(next: SpacetimeGridConfig): void {
      activeConfig = next
      accentColor.set(resolveCssColor(document.documentElement, '--accent', '#d4a84b'))
      material.uniforms.opacity!.value = sphereMaterialOpacity(next.opacity)
      replaceGridGeometry(
        grid,
        layoutWidth,
        layoutHeight,
        next.lineColor,
        accentColor,
        next.cellSize,
        next.warmth,
      )
    },
    render,
    dispose(): void {
      grid.geometry.dispose()
      material.dispose()
      renderer.dispose()
    },
  }
}
