/**
 * @vitest-environment jsdom
 */
import React, { useRef } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import type { WikiGraphData } from '../wikiGraph'

// Stub de `three`: sin WebGL real, cada `new WebGLRenderer` crea un canvas
// propio. Lo que verifica el test es el ciclo append→cleanup→append cuando
// `active` alterna, no las matemáticas de la escena.
vi.mock('three', () => {
  class Color { copy(): this { return this }; clone(): Color { return new Color() }; lerp(): this { return this } }
  class Vector2 {}
  class Vector3 {
    x = 0; y = 0; z = 0
    constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z }
    subVectors(): this { return this }
    length(): number { return 1 }
    normalize(): this { return this }
    crossVectors(): this { return this }
    copy(): this { return this }
    set(): this { return this }
    add(): this { return this }
    clone(): Vector3 { return new Vector3() }
    multiplyScalar(): this { return this }
  }
  class Sphere {
    center = new Vector3()
    radius = 1
  }
  class Box3 {
    setFromPoints(): this { return this }
    getBoundingSphere(sphere: Sphere): Sphere { return sphere }
  }
  const sceneAdds: string[][] = []
  ;(globalThis as { __wikiSceneAdds?: string[][] }).__wikiSceneAdds = sceneAdds
  class Scene {
    background: unknown = null
    private _added: string[] = []
    constructor() { sceneAdds.push(this._added) }
    add(obj: { __kind?: string }): void { this._added.push(obj?.__kind ?? 'unknown') }
  }
  class PerspectiveCamera {
    aspect = 1
    fov = 50
    position = new Vector3()
    updateProjectionMatrix(): void {}
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
  class BufferGeometry {
    setAttribute(): void {}
    getAttribute() { return { setXYZ: (): void => undefined, needsUpdate: false } }
    dispose(): void {}
  }
  class Float32BufferAttribute {}
  class BufferAttribute {}
  const edgeOpacities: number[] = []
  ;(globalThis as { __wikiEdgeOpacities?: number[] }).__wikiEdgeOpacities = edgeOpacities
  class LineBasicMaterial {
    color = new Color()
    opacity = 0
    constructor(opts?: { opacity?: number }) {
      if (opts?.opacity != null) this.opacity = opts.opacity
    }
    dispose(): void {}
  }
  class LineSegments {
    __kind = 'LineSegments' as const
    constructor(_geometry: unknown, material: LineBasicMaterial) {
      edgeOpacities.push(material.opacity)
    }
  }
  class Line { frustumCulled = false; __kind = 'Line' as const }
  class SphereGeometry { dispose(): void {} }
  class MeshBasicMaterial { color = new Color(); dispose(): void {} }
  class MeshLambertMaterial { color = new Color(); dispose(): void {} }
  class AmbientLight { __kind = 'AmbientLight' as const }
  class PointLight {
    __kind = 'PointLight' as const
    color = new Color()
    intensity = 0
    distance = 0
    position = { set: (): void => undefined, copy: (): void => undefined }
    dispose(): void {}
  }
  class SpriteMaterial { color = new Color(); opacity = 0; dispose(): void {} }
  class Sprite {
    __kind = 'Sprite' as const
    material = new SpriteMaterial()
    position = { copy: (): void => undefined, set: (): void => undefined }
    scale = { setScalar: (): void => undefined }
  }
  class Mesh {
    __kind = 'Mesh' as const
    material: MeshBasicMaterial
    geometry: SphereGeometry
    position = new Vector3()
    userData: Record<string, unknown> = {}
    constructor(geometry: SphereGeometry, material: MeshBasicMaterial) {
      this.geometry = geometry; this.material = material
    }
  }
  class Raycaster { setFromCamera(): void {}; intersectObjects(): unknown[] { return [] } }
  class CanvasTexture { needsUpdate = false; dispose(): void {} }
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
  class OrbitControls {
    autoRotate = false
    autoRotateSpeed = 0
    enableDamping = false
    dampingFactor = 0
    enablePan = false
    screenSpacePanning = false
    minDistance = 0
    maxDistance = 0
    target = { copy: (): void => undefined }
    addEventListener(): void {}
    removeEventListener(): void {}
    update(): void {}
    dispose(): void {}
  }
  return { OrbitControls }
})

// Fuerza webGlSupported() a true — jsdom por defecto no expone getContext('webgl').
// También devuelve un stub 2d para createGlowTexture (jsdom sin canvas).
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

function Harness({ active }: { active: boolean }): JSX.Element | null {
  const ref = useRef<HTMLDivElement>(null)
  useWikiGraphScene(ref, DATA, { onHover: () => undefined, onPick: () => undefined }, active)
  if (!active) return null
  return <div ref={ref} className="wiki-graph-view__canvas" />
}

afterEach(cleanup)

describe('useWikiGraphScene: ciclo de vida con active', () => {
  const getSceneAdds = (): string[][] => {
    return (globalThis as { __wikiSceneAdds?: string[][] }).__wikiSceneAdds ?? []
  }
  const getEdgeOpacities = (): number[] => {
    return (globalThis as { __wikiEdgeOpacities?: number[] }).__wikiEdgeOpacities ?? []
  }
  const resetSceneAdds = (): void => {
    const adds = getSceneAdds()
    adds.length = 0
    const opacities = getEdgeOpacities()
    opacities.length = 0
  }

  it('active=true → false → true reappenda un canvas al contenedor nuevo', () => {
    resetSceneAdds()
    const { container, rerender } = render(<Harness active />)
    const firstCanvas = container.querySelector('.wiki-graph-view__canvas canvas')
    expect(firstCanvas).not.toBeNull()

    rerender(<Harness active={false} />)
    expect(container.querySelector('.wiki-graph-view__canvas')).toBeNull()

    rerender(<Harness active />)
    const finalCanvas = container.querySelector('.wiki-graph-view__canvas canvas')
    expect(finalCanvas).not.toBeNull()
    // Canvas nuevo: el anterior se fue con su contenedor.
    expect(finalCanvas).not.toBe(firstCanvas)
  })

  it('con reduce motion activo no arranca la animación (raf no se solicita)', () => {
    resetSceneAdds()
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame')
    document.documentElement.setAttribute('data-reduce-motion', 'true')
    try {
      render(<Harness active />)
      // Sin bolts ni tick loop: el hook renderiza una sola vez y no pide rAF.
      expect(rafSpy).not.toHaveBeenCalled()
    } finally {
      document.documentElement.removeAttribute('data-reduce-motion')
      rafSpy.mockRestore()
    }
  })

  it('reduce motion ON: solo línea base, sin bolts ni halos de conexión', () => {
    resetSceneAdds()
    document.documentElement.setAttribute('data-reduce-motion', 'true')
    try {
      render(<Harness active />)
      const adds = getSceneAdds()
      expect(adds.length).toBeGreaterThan(0)
      const last = adds[adds.length - 1]!
      // Contrato reduce motion ON: nunca se instancia Line (bolts) ni Sprite
      // (flashes de endpoint). Solo LineSegments (red base) y
      // los Mesh de los nodos.
      expect(last).toContain('LineSegments')
      expect(last).not.toContain('Line')
      expect(last).not.toContain('Sprite')
      // Única capa de conexiones: opacidad estática legible (EDGE_OPACITY_STATIC).
      expect(getEdgeOpacities().at(-1)).toBe(0.55)
    } finally {
      document.documentElement.removeAttribute('data-reduce-motion')
    }
  })

  it('reduce motion OFF: línea base + capa de rayos/iluminación (Line + Sprite)', () => {
    resetSceneAdds()
    document.documentElement.removeAttribute('data-reduce-motion')
    render(<Harness active />)
    const adds = getSceneAdds()
    expect(adds.length).toBeGreaterThan(0)
    const last = adds[adds.length - 1]!
    // Red base visible debajo de los rayos (EDGE_OPACITY_LIVE).
    expect(last).toContain('LineSegments')
    expect(getEdgeOpacities().at(-1)).toBe(0.45)
    // Cada arista aporta 3 Line (core + halo + glow) y 2 Sprite endpoint;
    // con 1 arista: 3 Line, 2 Sprite de flash por arista.
    const lineCount = last.filter(k => k === 'Line').length
    const spriteCount = last.filter(k => k === 'Sprite').length
    expect(lineCount).toBeGreaterThanOrEqual(3)
    expect(spriteCount).toBeGreaterThanOrEqual(2)
  })
})
