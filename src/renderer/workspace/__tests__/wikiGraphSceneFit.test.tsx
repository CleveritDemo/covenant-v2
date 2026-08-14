/**
 * @vitest-environment jsdom
 */
import React, { useRef } from 'react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, waitFor } from '@testing-library/react'
import { layoutWikiGraph, type WikiGraphData } from '../wikiGraph'

const MAX_NODE_RADIUS = 1.65
const FIT_MARGIN = 1.15
const BOLT_CORE_OPACITY = 0.95
const BOLT_HALO_OPACITY = 0.55
const BOLT_GLOW_OPACITY = 0.32
const BOLT_ACTIVE_MS = 260
const NODE_EMISSIVE_BASE = 0.08

vi.mock('three', () => {
  class Color {
    r = 1; g = 1; b = 1
    lastScalar = 1
    constructor(value?: string | number) {
      if (typeof value === 'number') {
        const hex = value.toString(16).padStart(6, '0').slice(-6)
        this.r = parseInt(hex.slice(0, 2), 16) / 255
        this.g = parseInt(hex.slice(2, 4), 16) / 255
        this.b = parseInt(hex.slice(4, 6), 16) / 255
        return
      }
      if (typeof value === 'string' && value.startsWith('#')) {
        const hex = value.slice(1)
        if (hex.length === 6) {
          this.r = parseInt(hex.slice(0, 2), 16) / 255
          this.g = parseInt(hex.slice(2, 4), 16) / 255
          this.b = parseInt(hex.slice(4, 6), 16) / 255
        }
      }
    }
    copy(other?: Color): this {
      if (other) {
        this.r = other.r
        this.g = other.g
        this.b = other.b
      }
      return this
    }
    clone(): Color {
      const c = new Color()
      c.r = this.r
      c.g = this.g
      c.b = this.b
      return c
    }
    set(value: string): this {
      if (value.startsWith('#') && value.length === 7) {
        this.r = parseInt(value.slice(1, 3), 16) / 255
        this.g = parseInt(value.slice(3, 5), 16) / 255
        this.b = parseInt(value.slice(5, 7), 16) / 255
      }
      return this
    }
    lerp(target: Color, alpha: number): this {
      this.r = this.r + (target.r - this.r) * alpha
      this.g = this.g + (target.g - this.g) * alpha
      this.b = this.b + (target.b - this.b) * alpha
      return this
    }
    multiplyScalar(s: number): this { this.lastScalar = s; return this }
  }
  class Vector2 { x = 0; y = 0 }
  class Vector3 {
    x = 0; y = 0; z = 0
    constructor(x = 0, y = 0, z = 0) {
      this.x = x; this.y = y; this.z = z
    }
    subVectors(a: Vector3, b: Vector3): this {
      this.x = a.x - b.x; this.y = a.y - b.y; this.z = a.z - b.z
      return this
    }
    length(): number { return Math.hypot(this.x, this.y, this.z) }
    normalize(): this {
      const l = this.length()
      if (l > 0) { this.x /= l; this.y /= l; this.z /= l }
      return this
    }
    crossVectors(a: Vector3, b: Vector3): this {
      const ax = a.x; const ay = a.y; const az = a.z
      const bx = b.x; const by = b.y; const bz = b.z
      this.x = ay * bz - az * by
      this.y = az * bx - ax * bz
      this.z = ax * by - ay * bx
      return this
    }
    copy(v: Vector3): this {
      this.x = v.x; this.y = v.y; this.z = v.z
      return this
    }
    set(x: number, y: number, z: number): this {
      this.x = x; this.y = y; this.z = z
      return this
    }
    add(v: Vector3): this {
      this.x += v.x; this.y += v.y; this.z += v.z
      return this
    }
    clone(): Vector3 { return new Vector3(this.x, this.y, this.z) }
    multiplyScalar(s: number): this {
      this.x *= s; this.y *= s; this.z *= s
      return this
    }
    distanceTo(v: { x: number; y: number; z: number }): number {
      return Math.hypot(this.x - v.x, this.y - v.y, this.z - v.z)
    }
    project(): this {
      this.z = 0
      return this
    }
  }
  class Sphere {
    center = new Vector3()
    radius = 1
  }
  class Box3 {
    private _min = { x: 0, y: 0, z: 0 }
    private _max = { x: 0, y: 0, z: 0 }
    setFromPoints(points: Vector3[]): this {
      let minX = Infinity; let minY = Infinity; let minZ = Infinity
      let maxX = -Infinity; let maxY = -Infinity; let maxZ = -Infinity
      for (const p of points) {
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x)
        minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y)
        minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z)
      }
      this._min = { x: minX, y: minY, z: minZ }
      this._max = { x: maxX, y: maxY, z: maxZ }
      return this
    }
    getBoundingSphere(sphere: Sphere): Sphere {
      sphere.center.x = (this._min.x + this._max.x) / 2
      sphere.center.y = (this._min.y + this._max.y) / 2
      sphere.center.z = (this._min.z + this._max.z) / 2
      const dx = this._max.x - sphere.center.x
      const dy = this._max.y - sphere.center.y
      const dz = this._max.z - sphere.center.z
      sphere.radius = Math.sqrt(dx * dx + dy * dy + dz * dz)
      return sphere
    }
  }
  const cameras: PerspectiveCamera[] = []
  ;(globalThis as { __wikiFitCameras?: PerspectiveCamera[] }).__wikiFitCameras = cameras
  class PerspectiveCamera {
    aspect = 1
    fov = 50
    position = new Vector3()
    updateProjectionMatrix(): void {}
    constructor() { cameras.push(this) }
  }
  class WebGLRenderer {
    domElement: HTMLCanvasElement
    constructor() { this.domElement = document.createElement('canvas') }
    setClearColor(): void {}
    setPixelRatio(): void {}
    setSize(): void {}
    render(): void {}
    dispose(): void {}
  }
  class BufferAttribute {
    array: Float32Array
    itemSize: number
    needsUpdate = false
    constructor(array: Float32Array, itemSize: number) {
      this.array = array; this.itemSize = itemSize
    }
    setXYZ(i: number, x: number, y: number, z: number): void {
      this.array[i * 3] = x
      this.array[i * 3 + 1] = y
      this.array[i * 3 + 2] = z
    }
    getX(i: number): number { return this.array[i * 3] }
    getY(i: number): number { return this.array[i * 3 + 1] }
    getZ(i: number): number { return this.array[i * 3 + 2] }
  }
  class Float32BufferAttribute extends BufferAttribute {}
  class BufferGeometry {
    private _attrs: Record<string, BufferAttribute> = {}
    setAttribute(name: string, attr: BufferAttribute): void { this._attrs[name] = attr }
    getAttribute(name: string): BufferAttribute { return this._attrs[name] }
    dispose(): void {}
  }
  const coreMats: LineBasicMaterial[] = []
  const boltMats: LineBasicMaterial[] = []
  const coreGeoms: BufferGeometry[] = []
  const lineGeoms: BufferGeometry[] = []
  ;(globalThis as { __wikiCoreMats?: LineBasicMaterial[] }).__wikiCoreMats = coreMats
  ;(globalThis as { __wikiBoltMats?: LineBasicMaterial[] }).__wikiBoltMats = boltMats
  ;(globalThis as { __wikiCoreGeoms?: BufferGeometry[] }).__wikiCoreGeoms = coreGeoms
  ;(globalThis as { __wikiLineGeoms?: BufferGeometry[] }).__wikiLineGeoms = lineGeoms
  class LineBasicMaterial {
    color = new Color()
    opacity = 0
    vertexColors = false
    blending = 1
    dispose(): void {}
    constructor(opts?: {
      vertexColors?: boolean
      opacity?: number
      color?: Color
      blending?: number
    }) {
      boltMats.push(this)
      if (opts?.vertexColors) {
        this.vertexColors = true
        coreMats.push(this)
      }
      if (opts?.opacity != null) this.opacity = opts.opacity
      if (opts?.color) this.color.copy(opts.color)
      if (opts?.blending != null) this.blending = opts.blending
    }
  }
  class LineSegments {
    __kind = 'LineSegments' as const
    constructor(_g: unknown, _m: unknown) {}
  }
  class Line {
    frustumCulled = false
    renderOrder = 0
    __kind = 'Line' as const
    constructor(geom: BufferGeometry, mat: LineBasicMaterial) {
      lineGeoms.push(geom)
      if (mat.vertexColors) coreGeoms.push(geom)
    }
  }
  class SphereGeometry { dispose(): void {} }
  class MeshBasicMaterial { color = new Color(); dispose(): void {} }
  class MeshLambertMaterial { color = new Color(); dispose(): void {} }
  class MeshStandardMaterial {
    color = new Color()
    emissive = new Color()
    metalness = 0
    roughness = 0
    dispose(): void {}
  }
  class AmbientLight {
    __kind = 'AmbientLight' as const
    intensity = 1
    constructor(_color?: string, intensity?: number) {
      ambientLights.push(this)
      if (intensity != null) this.intensity = intensity
    }
  }
  const ambientLights: AmbientLight[] = []
  ;(globalThis as { __wikiAmbientLights?: AmbientLight[] }).__wikiAmbientLights = ambientLights
  class HemisphereLight {
    __kind = 'HemisphereLight' as const
    color = new Color()
    groundColor = new Color()
    intensity = 1
    constructor(sky?: string, ground?: string, intensity?: number) {
      hemisphereLights.push(this)
      if (sky) this.color.set(sky)
      if (ground) this.groundColor.set(ground)
      if (intensity != null) this.intensity = intensity
    }
  }
  const hemisphereLights: HemisphereLight[] = []
  ;(globalThis as { __wikiHemisphereLights?: HemisphereLight[] }).__wikiHemisphereLights = hemisphereLights
  class DirectionalLight {
    __kind = 'DirectionalLight' as const
    intensity = 1
    position = { set: (): void => undefined }
    constructor(_color?: string, intensity?: number) {
      if (intensity != null) this.intensity = intensity
    }
  }
  const pointLights: PointLight[] = []
  ;(globalThis as { __wikiPointLights?: PointLight[] }).__wikiPointLights = pointLights
  class PointLight {
    __kind = 'PointLight' as const
    color = new Color()
    intensity = 0
    distance = 0
    position = new Vector3()
    dispose(): void {}
    constructor() { pointLights.push(this) }
  }
  class SpriteMaterial {
    color = new Color()
    opacity = 0
    blending = 1
    dispose(): void {}
    constructor(opts?: { color?: Color; blending?: number }) {
      if (opts?.color) this.color.copy(opts.color)
      if (opts?.blending != null) this.blending = opts.blending
    }
  }
  class Sprite {
    __kind = 'Sprite' as const
    material = new SpriteMaterial()
    position = { copy: (): void => undefined, set: (): void => undefined }
    scale = { setScalar: (): void => undefined }
  }
  const sceneMeshes: Mesh[] = []
  ;(globalThis as { __wikiSceneMeshes?: Mesh[] }).__wikiSceneMeshes = sceneMeshes
  class Mesh {
    __kind = 'Mesh' as const
    material: MeshBasicMaterial | MeshLambertMaterial | MeshStandardMaterial
    geometry: SphereGeometry
    position = new Vector3()
    scale = { setScalar: vi.fn() }
    userData: Record<string, unknown> = {}
    constructor(
      geometry: SphereGeometry,
      material: MeshBasicMaterial | MeshLambertMaterial | MeshStandardMaterial,
    ) {
      this.geometry = geometry; this.material = material
      sceneMeshes.push(this)
    }
  }
  class Raycaster { setFromCamera(): void {}; intersectObjects(): unknown[] { return [] } }
  class CanvasTexture { needsUpdate = false; dispose(): void {} }
  const sceneAdds: string[][] = []
  class Scene {
    private _added: string[] = []
    constructor() { sceneAdds.push(this._added) }
    add(obj: { __kind?: string }): void { this._added.push(obj?.__kind ?? 'unknown') }
  }
  return {
    AdditiveBlending: 2,
    NormalBlending: 1,
    Box3,
    BufferAttribute,
    BufferGeometry,
    CanvasTexture,
    Color,
    Float32BufferAttribute,
    Line,
    LineBasicMaterial,
    LineSegments,
    Mesh,
    AmbientLight,
    MeshBasicMaterial,
    MeshLambertMaterial,
    MeshStandardMaterial,
    HemisphereLight,
    DirectionalLight,
    PointLight,
    PerspectiveCamera,
    Raycaster,
    Scene,
    Sphere,
    SphereGeometry,
    Sprite,
    SpriteMaterial,
    Vector2,
    Vector3,
    WebGLRenderer,
  }
})

vi.mock('three/examples/jsm/controls/OrbitControls.js', () => {
  const controlsList: OrbitControls[] = []
  ;(globalThis as { __wikiFitControls?: OrbitControls[] }).__wikiFitControls = controlsList
  class OrbitControls {
    autoRotate = false
    autoRotateSpeed = 0
    enableDamping = false
    dampingFactor = 0
    enablePan = false
    screenSpacePanning = false
    minDistance = 0
    maxDistance = 0
    target = new (class {
      x = 0; y = 0; z = 0
      copy(v: { x: number; y: number; z: number }): void {
        this.x = v.x; this.y = v.y; this.z = v.z
      }
    })()
    addEventListener(): void {}
    removeEventListener(): void {}
    update(): void {}
    dispose(): void {}
    constructor() { controlsList.push(this) }
  }
  return { OrbitControls }
})

type OrbitControls = {
  target: { x: number; y: number; z: number; copy: (v: { x: number; y: number; z: number }) => void }
  maxDistance: number
}

type PerspectiveCamera = {
  aspect: number
  fov: number
  position: { x: number; y: number; z: number }
}

type LineBasicMaterial = {
  vertexColors: boolean
  opacity: number
  color: { r: number; g: number; b: number }
  blending: number
}

type BufferGeometry = {
  getAttribute: (name: string) => { array: Float32Array; itemSize: number }
}

const resizeCallbacks: Array<() => void> = []
;(globalThis as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver = class {
  private _cb: () => void
  constructor(cb: () => void) { this._cb = cb }
  observe(): void { resizeCallbacks.push(this._cb) }
  disconnect(): void {}
} as unknown as typeof ResizeObserver

const getThemeMusicBeat = vi.fn(() => ({ pulse: 0, bpm: null as number | null }))

vi.mock('../../themeMusicEnergy', () => ({
  getThemeMusicBeat: (...args: unknown[]) => getThemeMusicBeat(...args),
}))

beforeAll(() => {
  const fake2d = {
    createRadialGradient: () => ({ addColorStop: (): void => undefined }),
    fillRect: (): void => undefined,
    set fillStyle(_v: unknown) {},
  }
  HTMLCanvasElement.prototype.getContext = function patched(
    this: HTMLCanvasElement,
    id: string,
  ) {
    if (id === 'webgl' || id === 'webgl2') return {} as unknown as WebGLRenderingContext
    if (id === '2d') return fake2d as unknown as CanvasRenderingContext2D
    return null
  } as typeof HTMLCanvasElement.prototype.getContext
})

import {
  boltGlowsEnabled,
  boltLightIntensityMult,
  edgeOpacityForAppearance,
  useWikiGraphScene,
} from '../useWikiGraphScene'

const DATA: WikiGraphData = {
  nodes: [
    { slug: 'a', title: 'A', type: 'concept', linkCount: 1, body: '' },
    { slug: 'b', title: 'B', type: 'flow', linkCount: 1, body: '' },
  ],
  edges: [{ from: 'a', to: 'b' }],
}

const MULTI_EDGE_DATA: WikiGraphData = {
  nodes: [
    { slug: 'a', title: 'A', type: 'concept', linkCount: 3, body: '' },
    { slug: 'b', title: 'B', type: 'flow', linkCount: 1, body: '' },
    { slug: 'c', title: 'C', type: 'flow', linkCount: 1, body: '' },
    { slug: 'd', title: 'D', type: 'flow', linkCount: 1, body: '' },
  ],
  edges: [
    { from: 'a', to: 'b' },
    { from: 'a', to: 'c' },
    { from: 'a', to: 'd' },
  ],
}

const TWO_SOURCE_DATA: WikiGraphData = {
  nodes: [
    { slug: 'a', title: 'A', type: 'concept', linkCount: 1, body: '' },
    { slug: 'b', title: 'B', type: 'flow', linkCount: 1, body: '' },
    { slug: 'c', title: 'C', type: 'flow', linkCount: 1, body: '' },
    { slug: 'd', title: 'D', type: 'flow', linkCount: 1, body: '' },
  ],
  edges: [
    { from: 'a', to: 'b' },
    { from: 'c', to: 'd' },
  ],
}

const EMPTY_DATA: WikiGraphData = { nodes: [], edges: [] }

function getCameras(): PerspectiveCamera[] {
  return (globalThis as { __wikiFitCameras?: PerspectiveCamera[] }).__wikiFitCameras ?? []
}
function getControls(): OrbitControls[] {
  return (globalThis as { __wikiFitControls?: OrbitControls[] }).__wikiFitControls ?? []
}
function getCoreMats(): LineBasicMaterial[] {
  return (globalThis as { __wikiCoreMats?: LineBasicMaterial[] }).__wikiCoreMats ?? []
}
function getBoltMats(): LineBasicMaterial[] {
  return (globalThis as { __wikiBoltMats?: LineBasicMaterial[] }).__wikiBoltMats ?? []
}
function getLineGeoms(): BufferGeometry[] {
  return (globalThis as { __wikiLineGeoms?: BufferGeometry[] }).__wikiLineGeoms ?? []
}
function getCoreGeoms(): BufferGeometry[] {
  return (globalThis as { __wikiCoreGeoms?: BufferGeometry[] }).__wikiCoreGeoms ?? []
}
function getPointLights(): Array<{
  position: { x: number; y: number; z: number }
  intensity: number
  color: { r: number; g: number; b: number }
}> {
  return (globalThis as {
    __wikiPointLights?: Array<{
      position: { x: number; y: number; z: number }
      intensity: number
      color: { r: number; g: number; b: number }
    }>
  }).__wikiPointLights ?? []
}
function getAmbientLights(): Array<{ intensity: number }> {
  return (globalThis as { __wikiAmbientLights?: Array<{ intensity: number }> }).__wikiAmbientLights ?? []
}
function getHemisphereLights(): Array<{
  groundColor: { r: number; g: number; b: number }
  intensity: number
}> {
  return (globalThis as {
    __wikiHemisphereLights?: Array<{
      groundColor: { r: number; g: number; b: number }
      intensity: number
    }>
  }).__wikiHemisphereLights ?? []
}
type SceneMesh = {
  material: {
    emissive?: { lastScalar: number; r: number; g: number; b: number }
  }
  userData: Record<string, unknown>
  scale: { setScalar: ReturnType<typeof vi.fn> }
}
function getSceneMeshes(): SceneMesh[] {
  return (globalThis as { __wikiSceneMeshes?: SceneMesh[] }).__wikiSceneMeshes ?? []
}

function resetGlobals(): void {
  getCameras().length = 0
  getControls().length = 0
  getCoreMats().length = 0
  getBoltMats().length = 0
  getCoreGeoms().length = 0
  getLineGeoms().length = 0
  getPointLights().length = 0
  getAmbientLights().length = 0
  getHemisphereLights().length = 0
  getSceneMeshes().length = 0
  resizeCallbacks.length = 0
}

function setContainerSize(el: HTMLDivElement, width: number, height: number): void {
  Object.defineProperty(el, 'clientWidth', { configurable: true, value: width })
  Object.defineProperty(el, 'clientHeight', { configurable: true, value: height })
}

function Harness({
  data = DATA,
  width = 800,
  height = 600,
  onNodeScreenPositions,
  wikiBoltColor,
  wikiNodeConcept,
}: {
  data?: WikiGraphData
  width?: number
  height?: number
  onNodeScreenPositions?: (
    positions: ReadonlyMap<string, { x: number; y: number; visible: boolean }>,
  ) => void
  wikiBoltColor?: string
  wikiNodeConcept?: string
}): JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  useWikiGraphScene(
    ref,
    data,
    {
      onHover: () => undefined,
      onPick: () => undefined,
      onNodeScreenPositions,
    },
    true,
  )
  return (
    <div
      ref={node => {
        ref.current = node
        if (node) {
          if (wikiBoltColor) node.style.setProperty('--wiki-bolt-color', wikiBoltColor)
          if (wikiNodeConcept) node.style.setProperty('--wiki-node-concept', wikiNodeConcept)
          setContainerSize(node, width, height)
        }
      }}
      className="wiki-graph-view__canvas"
    />
  )
}

function dist3(
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number,
): number {
  return Math.hypot(ax - bx, ay - by, az - bz)
}

function expectedFitDistance(aspect: number, fovDeg: number, sphereRadius: number): number {
  const fovV = (fovDeg * Math.PI) / 180
  const fovH = 2 * Math.atan(Math.tan(fovV / 2) * aspect)
  const effectiveFov = Math.min(fovV, fovH)
  return (sphereRadius / Math.sin(effectiveFov / 2)) * FIT_MARGIN
}

function expectedSphereCenter(data: WikiGraphData): { x: number; y: number; z: number; radius: number } {
  const positions = layoutWikiGraph(data, { seed: 42 })
  const pts = data.nodes.map(n => positions.get(n.slug)!)
  let minX = Infinity; let minY = Infinity; let minZ = Infinity
  let maxX = -Infinity; let maxY = -Infinity; let maxZ = -Infinity
  for (const [x, y, z] of pts) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x)
    minY = Math.min(minY, y); maxY = Math.max(maxY, y)
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z)
  }
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  const cz = (minZ + maxZ) / 2
  const dx = maxX - cx
  const dy = maxY - cy
  const dz = maxZ - cz
  const radius = Math.sqrt(dx * dx + dy * dy + dz * dz) + MAX_NODE_RADIUS
  return { x: cx, y: cy, z: cz, radius }
}

afterEach(cleanup)

describe('useWikiGraphScene: fit de cámara', () => {
  it('tras montar, target = centro de esfera y distancia respeta margen 1.15 y fov efectivo', () => {
    resetGlobals()
    const width = 800
    const height = 600
    render(<Harness width={width} height={height} />)
    const camera = getCameras().at(-1)!
    const controls = getControls().at(-1)!
    const sphere = expectedSphereCenter(DATA)
    const aspect = width / height
    const expectedDist = expectedFitDistance(aspect, camera.fov, sphere.radius)

    expect(controls.target.x).toBeCloseTo(sphere.x, 5)
    expect(controls.target.y).toBeCloseTo(sphere.y, 5)
    expect(controls.target.z).toBeCloseTo(sphere.z, 5)

    const camDist = dist3(
      camera.position.x, camera.position.y, camera.position.z,
      controls.target.x, controls.target.y, controls.target.z,
    )
    expect(camDist).toBeCloseTo(expectedDist, 4)
    expect(camera.aspect).toBe(aspect)
  })

  it('con canvas 0×0 el fit se aplica en el primer resize ≥64px', () => {
    resetGlobals()
    render(<Harness width={0} height={0} />)
    const camera = getCameras().at(-1)!
    expect(camera.position.z).toBe(36)

    const el = document.querySelector('.wiki-graph-view__canvas') as HTMLDivElement
    setContainerSize(el, 800, 600)
    resizeCallbacks.forEach(cb => cb())

    const controls = getControls().at(-1)!
    const sphere = expectedSphereCenter(DATA)
    expect(controls.target.x).toBeCloseTo(sphere.x, 5)
    expect(camera.position.z).not.toBe(36)
  })

  it('un segundo resize NO reposiciona la cámara', () => {
    resetGlobals()
    render(<Harness width={800} height={600} />)
    const camera = getCameras().at(-1)!
    const posBefore = { x: camera.position.x, y: camera.position.y, z: camera.position.z }
    const targetBefore = {
      x: getControls().at(-1)!.target.x,
      y: getControls().at(-1)!.target.y,
      z: getControls().at(-1)!.target.z,
    }

    expect(resizeCallbacks.length).toBeGreaterThan(0)
    resizeCallbacks.forEach(cb => cb())

    expect(camera.position.x).toBeCloseTo(posBefore.x, 8)
    expect(camera.position.y).toBeCloseTo(posBefore.y, 8)
    expect(camera.position.z).toBeCloseTo(posBefore.z, 8)
    const controls = getControls().at(-1)!
    expect(controls.target.x).toBeCloseTo(targetBefore.x, 8)
    expect(controls.target.y).toBeCloseTo(targetBefore.y, 8)
    expect(controls.target.z).toBeCloseTo(targetBefore.z, 8)
  })

  it('wiki vacía conserva posición default (0, 7, 36) sin lanzar', () => {
    resetGlobals()
    render(<Harness data={EMPTY_DATA} />)
    const camera = getCameras().at(-1)!
    expect(camera.position.x).toBe(0)
    expect(camera.position.y).toBe(7)
    expect(camera.position.z).toBe(36)
  })

  it('maxDistance de OrbitControls ≥ distancia del fit', () => {
    resetGlobals()
    render(<Harness width={800} height={600} />)
    const camera = getCameras().at(-1)!
    const controls = getControls().at(-1)!
    const fitDist = dist3(
      camera.position.x, camera.position.y, camera.position.z,
      controls.target.x, controls.target.y, controls.target.z,
    )
    expect(controls.maxDistance).toBeGreaterThanOrEqual(fitDist)
  })
})

describe('useWikiGraphScene: iluminación de rayos', () => {
  it('núcleo con vertexColors planos (intensidad uniforme 1.0)', () => {
    resetGlobals()
    document.documentElement.removeAttribute('data-reduce-motion')
    render(<Harness />)
    const coreMat = getCoreMats()[0]
    expect(coreMat?.vertexColors).toBe(true)
    const geom = getCoreGeoms()[0]
    const colorAttr = geom?.getAttribute('color')
    expect(colorAttr).toBeDefined()
    const arr = colorAttr!.array
    const nVerts = arr.length / 3
    const mid = Math.floor(nVerts / 2)
    const endIntensity = arr[0] + arr[1] + arr[2]
    const midIntensity = arr[mid * 3] + arr[mid * 3 + 1] + arr[mid * 3 + 2]
    const lastIntensity = arr[(nVerts - 1) * 3] + arr[(nVerts - 1) * 3 + 1] + arr[(nVerts - 1) * 3 + 2]
    expect(endIntensity).toBeCloseTo(3.0, 4)
    expect(midIntensity).toBeCloseTo(3.0, 4)
    expect(lastIntensity).toBeCloseTo(3.0, 4)
  })

  it('core y halo comparten la misma espina jittered tras disparo', () => {
    resetGlobals()
    document.documentElement.removeAttribute('data-reduce-motion')
    getThemeMusicBeat.mockReturnValue({ pulse: 0, bpm: null })

    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.25)
    const rafQueue: FrameRequestCallback[] = []
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
      rafQueue.push(cb)
      return rafQueue.length
    })
    const nowSpy = vi.spyOn(performance, 'now')
    const t0 = 10000
    nowSpy.mockReturnValue(t0)

    render(<Harness />)
    const lineGeoms = getLineGeoms()
    expect(lineGeoms.length).toBeGreaterThanOrEqual(2)
    const coreGeom = lineGeoms[0]!
    const haloGeom = lineGeoms[1]!

    const tick = rafQueue[rafQueue.length - 1]!
    nowSpy.mockReturnValue(t0)
    tick(t0)

    const corePos = coreGeom.getAttribute('position').array
    const haloPos = haloGeom.getAttribute('position').array
    const s = 1
    expect(corePos[s * 3]).toBeCloseTo(haloPos[s * 3], 6)
    expect(corePos[s * 3 + 1]).toBeCloseTo(haloPos[s * 3 + 1], 6)
    expect(corePos[s * 3 + 2]).toBeCloseTo(haloPos[s * 3 + 2], 6)

    randomSpy.mockRestore()
    rafSpy.mockRestore()
    nowSpy.mockRestore()
  })

  it('peak por disparo queda en [0.88, 1.0] sin flicker en opacidades', () => {
    resetGlobals()
    document.documentElement.removeAttribute('data-reduce-motion')
    const randomValues = [0, 0, 0.5]
    const randomSpy = vi.spyOn(Math, 'random').mockImplementation(() => {
      const v = randomValues.shift() ?? 0.5
      return v
    })

    const rafQueue: FrameRequestCallback[] = []
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
      rafQueue.push(cb)
      return rafQueue.length
    })
    const nowSpy = vi.spyOn(performance, 'now')
    const t0 = 10000
    nowSpy.mockReturnValue(t0)

    render(<Harness />)

    const boltMats = getBoltMats()
    // edgeMaterial + 3 bolt mats (core, halo, glow)
    const coreMat = boltMats.find(m => m.vertexColors)!
    const haloMat = boltMats[boltMats.indexOf(coreMat) + 1]!
    const glowMat = boltMats[boltMats.indexOf(coreMat) + 2]!
    expect(coreMat.vertexColors).toBe(true)

    const tick = rafQueue[rafQueue.length - 1]!
    nowSpy.mockReturnValue(t0)
    tick(t0)
    const tAttack = t0 + BOLT_ACTIVE_MS * 0.1
    nowSpy.mockReturnValue(tAttack)
    tick(tAttack)

    const glowBase = BOLT_GLOW_OPACITY
    const envelope1 = glowMat.opacity / glowBase
    const inferredPeak = envelope1 / (0.1 / 0.18)
    expect(inferredPeak).toBeGreaterThanOrEqual(0.88 * 0.78)
    expect(inferredPeak).toBeLessThanOrEqual(1.0)
    expect(glowMat.opacity / envelope1).toBeCloseTo(glowBase, 4)

    const coreNorm1 = coreMat.opacity / envelope1
    const haloNorm1 = haloMat.opacity / envelope1
    expect(haloNorm1 / coreNorm1).toBeCloseTo(BOLT_HALO_OPACITY / BOLT_CORE_OPACITY, 4)

    const tLater = tAttack + 25
    nowSpy.mockReturnValue(tLater)
    tick(tLater)
    const envelope2 = glowMat.opacity / glowBase
    expect(glowMat.opacity / envelope2).toBeCloseTo(glowBase, 4)

    const coreNorm2 = coreMat.opacity / envelope2
    const haloNorm2 = haloMat.opacity / envelope2
    expect(coreNorm1).toBeCloseTo(coreNorm2, 4)
    expect(haloNorm1).toBeCloseTo(haloNorm2, 4)

    randomSpy.mockRestore()
    rafSpy.mockRestore()
    nowSpy.mockRestore()
  })

  it('opacidad del core igual con pulse 0 y pulse 1 en la misma fase de ataque', () => {
    const measureCoreOpacity = (pulse: number): number => {
      resetGlobals()
      document.documentElement.removeAttribute('data-reduce-motion')
      getThemeMusicBeat.mockReturnValue({ pulse, bpm: pulse > 0 ? 120 : null })

      const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0)
      const rafQueue: FrameRequestCallback[] = []
      const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
        rafQueue.push(cb)
        return rafQueue.length
      })
      const nowSpy = vi.spyOn(performance, 'now')
      const t0 = 10000
      nowSpy.mockReturnValue(t0)

      render(<Harness />)
      const coreMat = getBoltMats().find(m => m.vertexColors)!
      const tick = rafQueue[rafQueue.length - 1]!

      nowSpy.mockReturnValue(t0)
      tick(t0)
      const tAttack = t0 + BOLT_ACTIVE_MS * 0.1
      nowSpy.mockReturnValue(tAttack)
      tick(tAttack)

      const opacity = coreMat.opacity
      randomSpy.mockRestore()
      rafSpy.mockRestore()
      nowSpy.mockRestore()
      return opacity
    }

    const opacityNoPulse = measureCoreOpacity(0)
    const opacityWithPulse = measureCoreOpacity(1)
    expect(opacityWithPulse).toBeCloseTo(opacityNoPulse, 4)
  })

  it('sin música, los 3 rayos salientes de A encienden juntos al pulsar el nodo', () => {
    resetGlobals()
    document.documentElement.removeAttribute('data-reduce-motion')
    getThemeMusicBeat.mockReturnValue({ pulse: 0, bpm: null })

    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0)
    const rafQueue: FrameRequestCallback[] = []
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
      rafQueue.push(cb)
      return rafQueue.length
    })
    const nowSpy = vi.spyOn(performance, 'now')
    const t0 = 10000
    nowSpy.mockReturnValue(t0)

    render(<Harness data={MULTI_EDGE_DATA} />)
    const coreMats = getCoreMats()
    expect(coreMats).toHaveLength(3)

    const tick = rafQueue[rafQueue.length - 1]!
    nowSpy.mockReturnValue(t0)
    tick(t0)
    const tAttack = t0 + BOLT_ACTIVE_MS * 0.1
    nowSpy.mockReturnValue(tAttack)
    tick(tAttack)

    const opacities = coreMats.map(m => m.opacity)
    expect(opacities.every(o => o > 0)).toBe(true)
    const spread = Math.max(...opacities) - Math.min(...opacities)
    expect(spread).toBeLessThan(0.05)

    randomSpy.mockRestore()
    rafSpy.mockRestore()
    nowSpy.mockRestore()
  })

  it('con beat onset en MULTI_EDGE_DATA enciende los 3 rayos salientes de A', () => {
    resetGlobals()
    document.documentElement.removeAttribute('data-reduce-motion')
    getThemeMusicBeat.mockReturnValue({ pulse: 1, bpm: 120 })

    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0)
    const rafQueue: FrameRequestCallback[] = []
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
      rafQueue.push(cb)
      return rafQueue.length
    })
    const nowSpy = vi.spyOn(performance, 'now')
    const t0 = 10000
    nowSpy.mockReturnValue(t0)

    render(<Harness data={MULTI_EDGE_DATA} />)
    const coreMats = getCoreMats()
    expect(coreMats).toHaveLength(3)
    const tick = rafQueue[rafQueue.length - 1]!

    nowSpy.mockReturnValue(t0)
    tick(t0)
    const tAttack = t0 + BOLT_ACTIVE_MS * 0.1
    nowSpy.mockReturnValue(tAttack)
    tick(tAttack)

    expect(coreMats.filter(m => m.opacity > 0)).toHaveLength(3)

    randomSpy.mockRestore()
    rafSpy.mockRestore()
    nowSpy.mockRestore()
  })

  it('segundo beat con TWO_SOURCE rota al otro nodo origen', () => {
    resetGlobals()
    document.documentElement.removeAttribute('data-reduce-motion')
    const BOLT_BEAT_COOLDOWN_MS = 350

    let beatPulse = 0.2
    getThemeMusicBeat.mockImplementation(() => ({ pulse: beatPulse, bpm: 120 }))

    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0)
    const rafQueue: FrameRequestCallback[] = []
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
      rafQueue.push(cb)
      return rafQueue.length
    })
    const nowSpy = vi.spyOn(performance, 'now')
    const t0 = 10000
    nowSpy.mockReturnValue(t0)

    render(<Harness data={TWO_SOURCE_DATA} />)
    const coreMats = getCoreMats()
    expect(coreMats).toHaveLength(2)
    const tick = rafQueue[rafQueue.length - 1]!

    // Primer beat: nodo A (índice 0 en sourceNodeSlugs)
    beatPulse = 0.5
    nowSpy.mockReturnValue(t0)
    tick(t0)
    const tAttack1 = t0 + BOLT_ACTIVE_MS * 0.1
    nowSpy.mockReturnValue(tAttack1)
    tick(tAttack1)
    expect(coreMats[0]!.opacity).toBeGreaterThan(0)
    expect(coreMats[1]!.opacity).toBe(0)

    // Esperar fin del rayo y cooldown
    const tAfterCooldown = t0 + BOLT_ACTIVE_MS + BOLT_BEAT_COOLDOWN_MS + 10
    nowSpy.mockReturnValue(tAfterCooldown)
    tick(tAfterCooldown)
    coreMats.forEach(m => { m.opacity = 0 })

    // Segundo beat: nodo C (índice 1) — bajar pulse y volver a subir para onset
    beatPulse = 0.2
    tick(tAfterCooldown + 1)
    beatPulse = 0.5
    const tBeat2 = tAfterCooldown + 20
    nowSpy.mockReturnValue(tBeat2)
    tick(tBeat2)
    const tAttack2 = tBeat2 + BOLT_ACTIVE_MS * 0.1
    nowSpy.mockReturnValue(tAttack2)
    tick(tAttack2)

    expect(coreMats[0]!.opacity).toBe(0)
    expect(coreMats[1]!.opacity).toBeGreaterThan(0)

    randomSpy.mockRestore()
    rafSpy.mockRestore()
    nowSpy.mockRestore()
  })

  it('la luz puntual arranca en el origen del edge y avanza por la polilínea del core', () => {
    resetGlobals()
    document.documentElement.removeAttribute('data-reduce-motion')
    getThemeMusicBeat.mockReturnValue({ pulse: 0, bpm: null })

    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0)
    const rafQueue: FrameRequestCallback[] = []
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
      rafQueue.push(cb)
      return rafQueue.length
    })
    const nowSpy = vi.spyOn(performance, 'now')
    const t0 = 10000
    nowSpy.mockReturnValue(t0)

    render(<Harness />)
    const positions = layoutWikiGraph(DATA, { seed: 42 })
    const from = positions.get('a')!
    const to = positions.get('b')!
    const coreGeom = getCoreGeoms()[0]!

    const tick = rafQueue[rafQueue.length - 1]!
    nowSpy.mockReturnValue(t0)
    tick(t0)
    const tStart = t0 + BOLT_ACTIVE_MS * 0.02
    nowSpy.mockReturnValue(tStart)
    tick(tStart)

    const light = getPointLights().find(l => l.intensity > 0)!
    expect(light).toBeDefined()
    expect(light.position.x).toBeCloseTo(from[0], 4)
    expect(light.position.y).toBeCloseTo(from[1], 4)
    expect(light.position.z).toBeCloseTo(from[2], 4)

    const tAttack = t0 + BOLT_ACTIVE_MS * 0.1
    nowSpy.mockReturnValue(tAttack)
    tick(tAttack)

    const tMid = t0 + BOLT_ACTIVE_MS * 0.35
    nowSpy.mockReturnValue(tMid)
    tick(tMid)

    const travelT = Math.min(1, 0.35 * 1.05)
    const segIdx = Math.min(16, Math.floor(travelT * 16))
    const posAttrMid = coreGeom.getAttribute('position')
    expect(light.position.x).toBeCloseTo(posAttrMid.array[segIdx * 3], 4)
    expect(light.position.y).toBeCloseTo(posAttrMid.array[segIdx * 3 + 1], 4)
    expect(light.position.z).toBeCloseTo(posAttrMid.array[segIdx * 3 + 2], 4)

    const tEnd = t0 + BOLT_ACTIVE_MS * 0.95
    nowSpy.mockReturnValue(tEnd)
    tick(tEnd)
    expect(light.position.x).not.toBeCloseTo((from[0] + to[0]) / 2, 1)

    randomSpy.mockRestore()
    rafSpy.mockRestore()
    nowSpy.mockRestore()
  })

  it('el nodo origen sube emissive por encima de la base al disparar en fase de ataque', () => {
    resetGlobals()
    document.documentElement.removeAttribute('data-reduce-motion')
    getThemeMusicBeat.mockReturnValue({ pulse: 0, bpm: null })

    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0)
    const rafQueue: FrameRequestCallback[] = []
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
      rafQueue.push(cb)
      return rafQueue.length
    })
    const nowSpy = vi.spyOn(performance, 'now')
    const t0 = 10000
    nowSpy.mockReturnValue(t0)

    render(<Harness />)
    const originMesh = getSceneMeshes().find(m => m.userData.slug === 'a')!
    expect(originMesh).toBeDefined()

    const tick = rafQueue[rafQueue.length - 1]!
    nowSpy.mockReturnValue(t0)
    tick(t0)
    const tAttack = t0 + BOLT_ACTIVE_MS * 0.1
    nowSpy.mockReturnValue(tAttack)
    tick(tAttack)

    const emissive = (originMesh.material as { emissive: { r: number; g: number; b: number } }).emissive
    const emissivePeak = Math.max(emissive.r, emissive.g, emissive.b)
    expect(emissivePeak).toBeGreaterThan(NODE_EMISSIVE_BASE)

    randomSpy.mockRestore()
    rafSpy.mockRestore()
    nowSpy.mockRestore()
  })

  it('nodo destino iluminado por rayo tiene emissive blanco (wash), no solo tinte del tipo', () => {
    resetGlobals()
    document.documentElement.removeAttribute('data-reduce-motion')
    getThemeMusicBeat.mockReturnValue({ pulse: 0, bpm: null })

    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0)
    const rafQueue: FrameRequestCallback[] = []
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
      rafQueue.push(cb)
      return rafQueue.length
    })
    const nowSpy = vi.spyOn(performance, 'now')
    const t0 = 10000
    nowSpy.mockReturnValue(t0)

    render(<Harness />)
    const tick = rafQueue[rafQueue.length - 1]!
    nowSpy.mockReturnValue(t0)
    tick(t0)
    const tAttack = t0 + BOLT_ACTIVE_MS * 0.1
    nowSpy.mockReturnValue(tAttack)
    tick(tAttack)

    const destMesh = getSceneMeshes().find(m => m.userData.slug === 'b')!
    const emissive = (destMesh.material as { emissive: { r: number; g: number; b: number } }).emissive
    expect(Math.min(emissive.r, emissive.g, emissive.b)).toBeGreaterThan(0.55)

    randomSpy.mockRestore()
    rafSpy.mockRestore()
    nowSpy.mockRestore()
  })
})

function getEdgeMat(): LineBasicMaterial | undefined {
  return getBoltMats().find(m => !m.vertexColors)
}

describe('useWikiGraphScene: aristas por apariencia', () => {
  let appearanceBackup: string | null

  beforeEach(() => {
    appearanceBackup = document.documentElement.getAttribute('data-theme-appearance')
  })

  afterEach(() => {
    if (appearanceBackup != null) {
      document.documentElement.setAttribute('data-theme-appearance', appearanceBackup)
    } else {
      document.documentElement.removeAttribute('data-theme-appearance')
    }
  })

  it('en light edgeMaterial opacity ≈ 0.225 (0.45×0.5)', () => {
    resetGlobals()
    document.documentElement.removeAttribute('data-reduce-motion')
    document.documentElement.setAttribute('data-theme-appearance', 'light')
    render(<Harness />)
    const edgeMat = getEdgeMat()
    expect(edgeMat?.opacity).toBeCloseTo(0.225, 4)
    expect(edgeOpacityForAppearance(false)).toBeCloseTo(0.225, 4)
  })

  it('en dark edgeMaterial opacity sigue 0.45', () => {
    resetGlobals()
    document.documentElement.removeAttribute('data-reduce-motion')
    document.documentElement.setAttribute('data-theme-appearance', 'dark')
    render(<Harness />)
    const edgeMat = getEdgeMat()
    expect(edgeMat?.opacity).toBeCloseTo(0.45, 4)
    expect(edgeOpacityForAppearance(false)).toBeCloseTo(0.45, 4)
  })

  it('boltLightIntensityMult es 1.5 y en dark firing la PointLight tiene intensidad > 0', () => {
    resetGlobals()
    document.documentElement.removeAttribute('data-reduce-motion')
    document.documentElement.setAttribute('data-theme-appearance', 'dark')
    getThemeMusicBeat.mockReturnValue({ pulse: 0, bpm: null })

    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0)
    const rafQueue: FrameRequestCallback[] = []
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
      rafQueue.push(cb)
      return rafQueue.length
    })
    const nowSpy = vi.spyOn(performance, 'now')
    const t0 = 10000
    nowSpy.mockReturnValue(t0)

    expect(boltLightIntensityMult()).toBe(1.5)
    render(<Harness />)
    const tick = rafQueue[rafQueue.length - 1]!
    nowSpy.mockReturnValue(t0)
    tick(t0)
    const tAttack = t0 + BOLT_ACTIVE_MS * 0.1
    nowSpy.mockReturnValue(tAttack)
    tick(tAttack)

    const light = getPointLights().find(l => l.intensity > 0)!
    expect(light.intensity).toBeGreaterThan(0)

    randomSpy.mockRestore()
    rafSpy.mockRestore()
    nowSpy.mockRestore()
  })

  it('en dark la PointLight activa durante firing es blanca explícita', () => {
    resetGlobals()
    document.documentElement.removeAttribute('data-reduce-motion')
    document.documentElement.setAttribute('data-theme-appearance', 'dark')
    getThemeMusicBeat.mockReturnValue({ pulse: 0, bpm: null })

    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0)
    const rafQueue: FrameRequestCallback[] = []
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
      rafQueue.push(cb)
      return rafQueue.length
    })
    const nowSpy = vi.spyOn(performance, 'now')
    const t0 = 10000
    nowSpy.mockReturnValue(t0)

    render(<Harness />)
    const tick = rafQueue[rafQueue.length - 1]!
    nowSpy.mockReturnValue(t0)
    tick(t0)
    const tAttack = t0 + BOLT_ACTIVE_MS * 0.1
    nowSpy.mockReturnValue(tAttack)
    tick(tAttack)

    const light = getPointLights().find(l => l.intensity > 0)!
    expect(light.color.r).toBeGreaterThan(0.9)
    expect(light.color.g).toBeGreaterThan(0.9)
    expect(light.color.b).toBeGreaterThan(0.9)

    randomSpy.mockRestore()
    rafSpy.mockRestore()
    nowSpy.mockRestore()
  })

  it('en dark usa iluminación de escena clara (hemisphere ground y ambient)', () => {
    resetGlobals()
    document.documentElement.removeAttribute('data-reduce-motion')
    document.documentElement.setAttribute('data-theme-appearance', 'dark')
    render(<Harness />)
    const ambient = getAmbientLights().at(-1)!
    const hemisphere = getHemisphereLights().at(-1)!
    expect(ambient.intensity).toBeCloseTo(0.32, 4)
    expect(hemisphere.groundColor.b).toBeGreaterThan(0.9)
    expect(hemisphere.intensity).toBeCloseTo(0.45, 4)
  })
})

describe('useWikiGraphScene: color de rayos por apariencia', () => {
  const ADDITIVE_BLENDING = 2
  let appearanceBackup: string | null

  beforeEach(() => {
    appearanceBackup = document.documentElement.getAttribute('data-theme-appearance')
  })

  afterEach(() => {
    if (appearanceBackup != null) {
      document.documentElement.setAttribute('data-theme-appearance', appearanceBackup)
    } else {
      document.documentElement.removeAttribute('data-theme-appearance')
    }
    document.documentElement.style.removeProperty('--wiki-bolt-color')
  })

  it('en dark usa blanco brillante y blending aditivo en el núcleo del rayo', () => {
    resetGlobals()
    document.documentElement.setAttribute('data-theme-appearance', 'dark')
    render(<Harness wikiBoltColor="#ffffff" />)
    const coreMat = getCoreMats()[0]!
    expect(coreMat.color.r).toBeGreaterThan(0.9)
    expect(coreMat.color.g).toBeGreaterThan(0.9)
    expect(coreMat.color.b).toBeGreaterThan(0.9)
    expect(coreMat.blending).toBe(ADDITIVE_BLENDING)
  })

  it('en light usa color oscuro y blending Normal en el núcleo del rayo', () => {
    resetGlobals()
    document.documentElement.setAttribute('data-theme-appearance', 'light')
    render(<Harness wikiBoltColor="#3d3d5c" />)
    const coreMat = getCoreMats()[0]!
    expect(Math.max(coreMat.color.r, coreMat.color.g, coreMat.color.b)).toBeLessThan(0.45)
    expect(coreMat.blending).not.toBe(ADDITIVE_BLENDING)
    expect(coreMat.blending).toBe(1)
  })

  it('en light firing: core visible, halo/glow en 0 y PointLight blanca activa', () => {
    resetGlobals()
    document.documentElement.removeAttribute('data-reduce-motion')
    document.documentElement.setAttribute('data-theme-appearance', 'light')
    getThemeMusicBeat.mockReturnValue({ pulse: 0, bpm: null })

    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0)
    const rafQueue: FrameRequestCallback[] = []
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
      rafQueue.push(cb)
      return rafQueue.length
    })
    const nowSpy = vi.spyOn(performance, 'now')
    const t0 = 10000
    nowSpy.mockReturnValue(t0)

    render(<Harness wikiBoltColor="#3d3d5c" />)
    const boltMats = getBoltMats()
    const coreMat = boltMats.find(m => m.vertexColors)!
    const haloMat = boltMats[boltMats.indexOf(coreMat) + 1]!
    const glowMat = boltMats[boltMats.indexOf(coreMat) + 2]!
    const tick = rafQueue[rafQueue.length - 1]!
    nowSpy.mockReturnValue(t0)
    tick(t0)
    const tAttack = t0 + BOLT_ACTIVE_MS * 0.1
    nowSpy.mockReturnValue(tAttack)
    tick(tAttack)

    expect(coreMat.opacity).toBeGreaterThan(0)
    expect(haloMat.opacity).toBe(0)
    expect(glowMat.opacity).toBe(0)
    const light = getPointLights().find(l => l.intensity > 0)!
    expect(light).toBeDefined()
    expect(light.intensity).toBeGreaterThan(0)
    expect(light.color.r).toBeGreaterThan(0.9)
    expect(light.color.g).toBeGreaterThan(0.9)
    expect(light.color.b).toBeGreaterThan(0.9)

    randomSpy.mockRestore()
    rafSpy.mockRestore()
    nowSpy.mockRestore()
  })

  it('dark firing → toggle light: PointLight sigue activa y blanca', async () => {
    resetGlobals()
    document.documentElement.removeAttribute('data-reduce-motion')
    document.documentElement.setAttribute('data-theme-appearance', 'dark')
    getThemeMusicBeat.mockReturnValue({ pulse: 0, bpm: null })

    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0)
    const rafQueue: FrameRequestCallback[] = []
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
      rafQueue.push(cb)
      return rafQueue.length
    })
    const nowSpy = vi.spyOn(performance, 'now')
    const t0 = 10000
    nowSpy.mockReturnValue(t0)

    render(<Harness wikiBoltColor="#3d3d5c" />)
    const tick = rafQueue[rafQueue.length - 1]!
    nowSpy.mockReturnValue(t0)
    tick(t0)
    const tAttack = t0 + BOLT_ACTIVE_MS * 0.1
    nowSpy.mockReturnValue(tAttack)
    tick(tAttack)

    const light = getPointLights().find(l => l.intensity > 0)!
    expect(light).toBeDefined()
    expect(light.color.r).toBeGreaterThan(0.9)

    document.documentElement.setAttribute('data-theme-appearance', 'light')
    await new Promise<void>(resolve => queueMicrotask(resolve))

    expect(light.intensity).toBeGreaterThan(0)
    expect(light.color.r).toBeGreaterThan(0.9)
    expect(light.color.g).toBeGreaterThan(0.9)
    expect(light.color.b).toBeGreaterThan(0.9)

    randomSpy.mockRestore()
    rafSpy.mockRestore()
    nowSpy.mockRestore()
  })

  it('en light el nodo origen aclara emissive al disparar', () => {
    resetGlobals()
    document.documentElement.removeAttribute('data-reduce-motion')
    document.documentElement.setAttribute('data-theme-appearance', 'light')
    getThemeMusicBeat.mockReturnValue({ pulse: 0, bpm: null })

    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0)
    const rafQueue: FrameRequestCallback[] = []
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
      rafQueue.push(cb)
      return rafQueue.length
    })
    const nowSpy = vi.spyOn(performance, 'now')
    const t0 = 10000
    nowSpy.mockReturnValue(t0)

    render(<Harness wikiBoltColor="#3d3d5c" />)
    const originMesh = getSceneMeshes().find(m => m.userData.slug === 'a')!
    const baseEmissive = (originMesh.material as { emissive: { r: number; g: number; b: number } }).emissive
    const basePeak = Math.max(baseEmissive.r, baseEmissive.g, baseEmissive.b)

    const tick = rafQueue[rafQueue.length - 1]!
    nowSpy.mockReturnValue(t0)
    tick(t0)
    const tAttack = t0 + BOLT_ACTIVE_MS * 0.1
    nowSpy.mockReturnValue(tAttack)
    tick(tAttack)

    const emissive = (originMesh.material as { emissive: { r: number; g: number; b: number } }).emissive
    const emissivePeak = Math.max(emissive.r, emissive.g, emissive.b)
    expect(emissivePeak).toBeGreaterThan(basePeak)
    expect(emissivePeak).toBeGreaterThan(NODE_EMISSIVE_BASE)

    randomSpy.mockRestore()
    rafSpy.mockRestore()
    nowSpy.mockRestore()
  })

  it('light firing → toggle dark: PointLight sigue blanca', async () => {
    resetGlobals()
    document.documentElement.removeAttribute('data-reduce-motion')
    document.documentElement.setAttribute('data-theme-appearance', 'light')
    getThemeMusicBeat.mockReturnValue({ pulse: 0, bpm: null })

    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0)
    const rafQueue: FrameRequestCallback[] = []
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
      rafQueue.push(cb)
      return rafQueue.length
    })
    const nowSpy = vi.spyOn(performance, 'now')
    const t0 = 10000
    nowSpy.mockReturnValue(t0)

    render(<Harness wikiBoltColor="#3d3d5c" />)
    const tick = rafQueue[rafQueue.length - 1]!
    nowSpy.mockReturnValue(t0)
    tick(t0)
    const tAttack = t0 + BOLT_ACTIVE_MS * 0.1
    nowSpy.mockReturnValue(tAttack)
    tick(tAttack)

    const light = getPointLights().find(l => l.intensity > 0)!
    expect(light).toBeDefined()
    expect(light.color.r).toBeGreaterThan(0.9)
    expect(light.color.g).toBeGreaterThan(0.9)
    expect(light.color.b).toBeGreaterThan(0.9)

    document.documentElement.setAttribute('data-theme-appearance', 'dark')
    await new Promise<void>(resolve => queueMicrotask(resolve))

    expect(light.intensity).toBeGreaterThan(0)
    expect(light.color.r).toBeGreaterThan(0.9)
    expect(light.color.g).toBeGreaterThan(0.9)
    expect(light.color.b).toBeGreaterThan(0.9)

    randomSpy.mockRestore()
    rafSpy.mockRestore()
    nowSpy.mockRestore()
  })

  it('en dark firing: core blanco, aditivo y PointLight blanca (regresión)', () => {
    resetGlobals()
    document.documentElement.removeAttribute('data-reduce-motion')
    document.documentElement.setAttribute('data-theme-appearance', 'dark')
    getThemeMusicBeat.mockReturnValue({ pulse: 0, bpm: null })

    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0)
    const rafQueue: FrameRequestCallback[] = []
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
      rafQueue.push(cb)
      return rafQueue.length
    })
    const nowSpy = vi.spyOn(performance, 'now')
    const t0 = 10000
    nowSpy.mockReturnValue(t0)

    render(<Harness wikiBoltColor="#ffffff" />)
    const coreMat = getCoreMats()[0]!
    const tick = rafQueue[rafQueue.length - 1]!
    nowSpy.mockReturnValue(t0)
    tick(t0)
    const tAttack = t0 + BOLT_ACTIVE_MS * 0.1
    nowSpy.mockReturnValue(tAttack)
    tick(tAttack)

    expect(coreMat.color.r).toBeGreaterThan(0.9)
    expect(coreMat.color.g).toBeGreaterThan(0.9)
    expect(coreMat.color.b).toBeGreaterThan(0.9)
    expect(coreMat.blending).toBe(ADDITIVE_BLENDING)
    expect(coreMat.opacity).toBeGreaterThan(0)
    const light = getPointLights().find(l => l.intensity > 0)!
    expect(light.color.r).toBeGreaterThan(0.9)
    expect(light.color.g).toBeGreaterThan(0.9)
    expect(light.color.b).toBeGreaterThan(0.9)

    randomSpy.mockRestore()
    rafSpy.mockRestore()
    nowSpy.mockRestore()
  })

  it('boltGlowsEnabled: false en light, true en dark', () => {
    document.documentElement.setAttribute('data-theme-appearance', 'light')
    expect(boltGlowsEnabled()).toBe(false)
    document.documentElement.setAttribute('data-theme-appearance', 'dark')
    expect(boltGlowsEnabled()).toBe(true)
  })
})

describe('useWikiGraphScene: color de nodos por apariencia', () => {
  const SATURATED_CONCEPT = '#7c6af7'
  const ALT_SATURATED_CONCEPT = '#7aa2f7'
  let appearanceBackup: string | null
  const wikiNodeVars = [
    '--wiki-node-concept',
    '--wiki-node-decision',
    '--wiki-node-flow',
    '--wiki-node-reference',
  ] as const

  beforeEach(() => {
    appearanceBackup = document.documentElement.getAttribute('data-theme-appearance')
  })

  afterEach(() => {
    if (appearanceBackup != null) {
      document.documentElement.setAttribute('data-theme-appearance', appearanceBackup)
    } else {
      document.documentElement.removeAttribute('data-theme-appearance')
    }
    for (const v of wikiNodeVars) {
      document.documentElement.style.removeProperty(v)
    }
  })

  function conceptMeshColor(): { r: number; g: number; b: number } {
    const mesh = getSceneMeshes().find(m => m.userData.slug === 'a')!
    const mat = mesh.material as { color: { r: number; g: number; b: number } }
    return { r: mat.color.r, g: mat.color.g, b: mat.color.b }
  }

  it('en light y dark usa tokens saturados vía MutationObserver', async () => {
    resetGlobals()
    document.documentElement.removeAttribute('data-reduce-motion')
    document.documentElement.setAttribute('data-theme-appearance', 'light')
    render(<Harness wikiNodeConcept={SATURATED_CONCEPT} />)

    const lightColor = conceptMeshColor()
    const lightDominant = Math.max(lightColor.r, lightColor.g, lightColor.b)
    expect(lightDominant).toBeGreaterThan(0.35)

    const el = document.querySelector('.wiki-graph-view__canvas') as HTMLDivElement
    el.style.setProperty('--wiki-node-concept', ALT_SATURATED_CONCEPT)
    document.documentElement.setAttribute('data-theme-appearance', 'dark')

    await waitFor(() => {
      const darkColor = conceptMeshColor()
      const darkDominant = Math.max(darkColor.r, darkColor.g, darkColor.b)
      expect(darkDominant).toBeGreaterThan(0.35)
      expect(darkColor.b).toBeGreaterThan(darkColor.r * 0.8)
    })
  })
})

describe('useWikiGraphScene: proyección de nodos', () => {
  it('onNodeScreenPositions recibe un entry por nodo tras el primer render', () => {
    resetGlobals()
    const positions = new Map<string, { x: number; y: number; visible: boolean }>()
    render(
      <Harness
        onNodeScreenPositions={map => {
          for (const [slug, pos] of map) positions.set(slug, { ...pos })
        }}
      />,
    )
    expect(positions.size).toBe(DATA.nodes.length)
    for (const node of DATA.nodes) {
      const pos = positions.get(node.slug)
      expect(pos).toBeDefined()
      expect(pos!.visible).toBe(true)
      expect(Number.isFinite(pos!.x)).toBe(true)
      expect(Number.isFinite(pos!.y)).toBe(true)
    }
  })
})
