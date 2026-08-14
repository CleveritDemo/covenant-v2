/**
 * @vitest-environment jsdom
 */
import React, { useRef } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
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
    copy(): this { return this }
    clone(): Color { return new Color() }
    lerp(): this { return this }
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
  ;(globalThis as { __wikiCoreMats?: LineBasicMaterial[] }).__wikiCoreMats = coreMats
  ;(globalThis as { __wikiBoltMats?: LineBasicMaterial[] }).__wikiBoltMats = boltMats
  ;(globalThis as { __wikiCoreGeoms?: BufferGeometry[] }).__wikiCoreGeoms = coreGeoms
  class LineBasicMaterial {
    color = new Color()
    opacity = 0
    vertexColors = false
    dispose(): void {}
    constructor(opts?: { vertexColors?: boolean; opacity?: number }) {
      boltMats.push(this)
      if (opts?.vertexColors) {
        this.vertexColors = true
        coreMats.push(this)
      }
      if (opts?.opacity != null) this.opacity = opts.opacity
    }
  }
  class LineSegments {
    __kind = 'LineSegments' as const
    constructor(_g: unknown, _m: unknown) {}
  }
  class Line {
    frustumCulled = false
    __kind = 'Line' as const
    constructor(geom: BufferGeometry, mat: LineBasicMaterial) {
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
  class AmbientLight { __kind = 'AmbientLight' as const }
  class HemisphereLight { __kind = 'HemisphereLight' as const }
  class DirectionalLight {
    __kind = 'DirectionalLight' as const
    position = { set: (): void => undefined }
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
  class SpriteMaterial { color = new Color(); opacity = 0; dispose(): void {} }
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

type LineBasicMaterial = { vertexColors: boolean; opacity: number }

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

import { useWikiGraphScene } from '../useWikiGraphScene'

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
function getCoreGeoms(): BufferGeometry[] {
  return (globalThis as { __wikiCoreGeoms?: BufferGeometry[] }).__wikiCoreGeoms ?? []
}
function getPointLights(): Array<{ position: { x: number; y: number; z: number }; intensity: number }> {
  return (globalThis as { __wikiPointLights?: Array<{ position: { x: number; y: number; z: number }; intensity: number }> }).__wikiPointLights ?? []
}
type SceneMesh = {
  material: { emissive?: { lastScalar: number } }
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
  getPointLights().length = 0
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
}: {
  data?: WikiGraphData
  width?: number
  height?: number
  onNodeScreenPositions?: (
    positions: ReadonlyMap<string, { x: number; y: number; visible: boolean }>,
  ) => void
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
        if (node) setContainerSize(node, width, height)
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
  it('núcleo con vertexColors y gradiente central > extremos', () => {
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
    expect(midIntensity).toBeGreaterThan(endIntensity)
    expect(midIntensity).toBeGreaterThan(lastIntensity)
  })

  it('peak por disparo queda en [0.88, 1.0] y flicker solo en core y halo', () => {
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

    const envelope1 = glowMat.opacity / BOLT_GLOW_OPACITY
    const inferredPeak = envelope1 / (0.1 / 0.18)
    expect(inferredPeak).toBeGreaterThanOrEqual(0.88 * 0.78)
    expect(inferredPeak).toBeLessThanOrEqual(1.0)
    expect(glowMat.opacity / envelope1).toBeCloseTo(BOLT_GLOW_OPACITY, 4)

    const coreNorm1 = coreMat.opacity / envelope1
    const haloNorm1 = haloMat.opacity / envelope1
    expect(haloNorm1 / coreNorm1).toBeCloseTo(BOLT_HALO_OPACITY / BOLT_CORE_OPACITY, 4)

    const tFlicker = tAttack + 25
    nowSpy.mockReturnValue(tFlicker)
    tick(tFlicker)
    const envelope2 = glowMat.opacity / BOLT_GLOW_OPACITY
    expect(glowMat.opacity / envelope2).toBeCloseTo(BOLT_GLOW_OPACITY, 4)

    const coreNorm2 = coreMat.opacity / envelope2
    const haloNorm2 = haloMat.opacity / envelope2
    expect(coreNorm1).not.toBeCloseTo(coreNorm2, 2)
    expect(haloNorm1).not.toBeCloseTo(haloNorm2, 2)

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
    const tAttack = t0 + BOLT_ACTIVE_MS * 0.1
    nowSpy.mockReturnValue(tAttack)
    tick(tAttack)

    const light = getPointLights().find(l => l.intensity > 0)!
    expect(light).toBeDefined()
    expect(light.position.x).toBeCloseTo(from[0], 4)
    expect(light.position.y).toBeCloseTo(from[1], 4)
    expect(light.position.z).toBeCloseTo(from[2], 4)

    const tMid = t0 + BOLT_ACTIVE_MS * 0.35
    nowSpy.mockReturnValue(tMid)
    tick(tMid)

    const travelT = Math.min(1, 0.35 * 1.05)
    const segIdx = Math.min(8, Math.floor(travelT * 8))
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

    const emissiveScalar = (originMesh.material as { emissive: { lastScalar: number } }).emissive.lastScalar
    expect(emissiveScalar).toBeGreaterThan(NODE_EMISSIVE_BASE)

    const destMesh = getSceneMeshes().find(m => m.userData.slug === 'b')!
    const destScalar = (destMesh.material as { emissive: { lastScalar: number } }).emissive.lastScalar
    expect(destScalar).toBeLessThan(emissiveScalar)

    randomSpy.mockRestore()
    rafSpy.mockRestore()
    nowSpy.mockRestore()
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
