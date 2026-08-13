import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { isReduceMotionActive } from '../reduceMotion'
import { getThemeMusicBeat } from '../themeMusicEnergy'
import {
  layoutWikiGraph,
  type WikiGraphData,
  type WikiGraphNodeType,
} from './wikiGraph'
import {
  computeInitialNodeFireAt,
  computeNextNodeFireAt,
} from './wikiGraphBoltTiming'

export interface WikiGraphHover {
  slug: string
  /** Posición del puntero en coordenadas del viewport (para el tooltip HTML). */
  x: number
  y: number
}

export interface WikiGraphSceneCallbacks {
  onHover: (hover: WikiGraphHover | null) => void
  onPick: (slug: string) => void
}

/** Semilla fija: el mapa se ve igual entre aperturas mientras no cambien las pages. */
const LAYOUT_SEED = 42

/** Var CSS del tema por tipo de nodo + fallback hex (mismo enfoque que PlaneMapGridParticles). */
const NODE_TYPE_COLOR_VARS: Record<WikiGraphNodeType, [string, string]> = {
  concept: ['--accent', '#7aa2f7'],
  decision: ['--theme-magenta', '#ff79c6'],
  flow: ['--theme-cyan', '#22d3ee'],
  reference: ['--theme-blue', '#60a5fa'],
}

const EDGE_VAR = '--text-muted'
const EDGE_FALLBACK = '#8b93a7'
/** Red base con reduce motion ON: única representación de conexiones. */
const EDGE_OPACITY_STATIC = 0.55
/** Red base con reduce motion OFF: legible bajo los rayos sin competir. */
const EDGE_OPACITY_LIVE = 0.45
const IDLE_ROTATE_SPEED = 0.55
/** Tras soltar la cámara, la rotación idle vuelve pasado este lapso. */
const IDLE_RESUME_MS = 3000

/** Descarga eléctrica: polilínea jittered que enciende toda la arista. */
const BOLT_SEGMENTS = 8
/** Vida total de una descarga (ataque + fade). */
const BOLT_ACTIVE_MS = 260
/** Ataque rápido: fracción del ciclo hasta el pico. */
const BOLT_ATTACK = 0.18
/** Amplitud perpendicular como fracción de la longitud de la arista. */
const BOLT_JITTER_RATIO = 0.045
/** Máximo de nodos con al menos un rayo en estado firing. */
const NODE_MAX_CONCURRENT_PULSES = 2
/** Reintento cuando el cap de nodos activos está lleno (ms). */
const BOLT_CAP_RETRY_MS = 250
/** Cooldown global entre disparos sincronizados al beat (ms). */
const BOLT_BEAT_COOLDOWN_MS = 350

const isMusicActive = (pulse: number): boolean => pulse > 0.001

/** Color único de todos los rayos (core, halo, glow, flashes, luces). */
const BOLT_WHITE = new THREE.Color('#ffffff')
const BOLT_CORE_OPACITY = 0.95
const BOLT_HALO_OPACITY = 0.55
/** Halo externo ancho: mayor jitter y opacidad baja para simular "linewidth"
 *  con aditivo — da la sensación de luz espacial que un LineBasicMaterial solo
 *  no puede lograr en WebGL. */
const BOLT_GLOW_OPACITY = 0.32
const BOLT_GLOW_JITTER_MULT = 2.6
/** Flash breve en los endpoints (sprite aditivo): enciende los nodos conectados. */
const BOLT_ENDPOINT_OPACITY = 0.9
const BOLT_ENDPOINT_SCALE_MULT = 2.8
/** Luz puntual por descarga (pool compartido): ilumina de verdad los nodos
 *  vecinos — los materiales de nodo son Lambert para recibirla. */
const BOLT_LIGHT_POOL = 6
const BOLT_LIGHT_INTENSITY = 45
const BOLT_LIGHT_DISTANCE_MULT = 0.75
/** Glow volumétrico: sprites aditivos a lo largo del rayo (no solo líneas). */
const BOLT_RAY_GLOW_OPACITY = 0.4
const BOLT_RAY_GLOW_STOPS = [0.3, 0.5, 0.7] as const
const BOLT_RAY_GLOW_SCALE = [0.11, 0.16, 0.11] as const
/** Radio máximo de nodo (linkCount alto) para margen en fit de cámara. */
const MAX_NODE_RADIUS = 1.65
/** Dirección de vista inicial al encuadrar el grafo. */
const FIT_CAMERA_DIR = new THREE.Vector3(0, 0.25, 1).normalize()

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => isReduceMotionActive())
  useLayoutEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return
    const sync = (): void => setReduced(isReduceMotionActive())
    const mq = typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null
    mq?.addEventListener('change', sync)
    const observer = new MutationObserver(sync)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-reduce-motion'],
    })
    sync()
    return () => {
      mq?.removeEventListener('change', sync)
      observer.disconnect()
    }
  }, [])
  return reduced
}

/** jsdom y GPUs sin contexto: no montar three (la vista muestra un aviso). */
function webGlSupported(): boolean {
  if (typeof document === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    return Boolean(
      canvas.getContext('webgl2') ?? canvas.getContext('webgl'),
    )
  } catch {
    return false
  }
}

/** Color CSS del tema → THREE.Color; rgba pierde alpha (three no lo modela). */
function themeColor(el: Element, varName: string, fallback: string): THREE.Color {
  const raw = getComputedStyle(el).getPropertyValue(varName).trim() || fallback
  const value = raw.replace(
    /rgba\(([^)]+),[^,)]+\)/,
    (_m, rgb: string) => `rgb(${rgb})`,
  )
  try {
    return new THREE.Color(value)
  } catch {
    return new THREE.Color(fallback)
  }
}

/** Disco radial blanco→transparente para halos y pulsos (se tiñe por material). */
function createGlowTexture(): THREE.Texture | null {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const gradient = ctx.createRadialGradient(
    size / 2, size / 2, 0,
    size / 2, size / 2, size / 2,
  )
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.35, 'rgba(255,255,255,0.45)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  return texture
}

function nodeRadius(linkCount: number): number {
  return 0.55 + Math.min(1.1, Math.sqrt(Math.max(0, linkCount)) * 0.32)
}

interface SceneNode {
  slug: string
  type: WikiGraphNodeType
  mesh: THREE.Mesh
}

/**
 * Escena three.js del mapa neuronal, aislada de React: nodos-esfera sin halo,
 * aristas tenues y descargas eléctricas intermitentes (polilíneas
 * jittered con núcleo blanco-cian y halo teñido por tipo) que encienden la
 * conexión completa por breves instantes. OrbitControls con rotación idle.
 * Con reduce-motion la escena queda estática: solo la red base, sin rayos.
 * `active` gobierna el montaje: al desactivarse el effect limpia todo; al
 * reactivarse vuelve a crear renderer/escena sobre el contenedor actual.
 * Devuelve si hay WebGL disponible.
 */
export function useWikiGraphScene(
  containerRef: React.RefObject<HTMLDivElement | null>,
  data: WikiGraphData,
  callbacks: WikiGraphSceneCallbacks,
  active: boolean = true,
): { webglAvailable: boolean } {
  const [webglAvailable] = useState(() => webGlSupported())
  const reducedMotion = usePrefersReducedMotion()
  const callbacksRef = useRef(callbacks)
  callbacksRef.current = callbacks

  const positions = useMemo(
    () => layoutWikiGraph(data, { seed: LAYOUT_SEED }),
    [data],
  )

  useEffect(() => {
    const container = containerRef.current
    if (!container || !webglAvailable || !active) return

    let renderer: THREE.WebGLRenderer
    try {
      // alpha: el canvas es transparente para que la grilla y las partículas
      // del plano (PlaneMap, debajo del overlay) sigan visibles tras el mapa.
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        premultipliedAlpha: false,
      })
    } catch {
      return
    }
    renderer.setClearColor(0x000000, 0)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    const canvas = renderer.domElement
    canvas.style.background = 'transparent'
    container.appendChild(canvas)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 600)
    camera.position.set(0, 7, 36)

    const controls = new OrbitControls(camera, canvas)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.enablePan = true
    controls.screenSpacePanning = true
    controls.minDistance = 6
    controls.maxDistance = 160
    controls.autoRotate = !reducedMotion
    controls.autoRotateSpeed = IDLE_ROTATE_SPEED

    const glowTexture = createGlowTexture()

    const nodeColors = new Map<WikiGraphNodeType, THREE.Color>()
    const readThemeColors = (): void => {
      for (const type of Object.keys(NODE_TYPE_COLOR_VARS) as WikiGraphNodeType[]) {
        const [varName, fallback] = NODE_TYPE_COLOR_VARS[type]
        nodeColors.set(type, themeColor(container, varName, fallback))
      }
    }
    readThemeColors()
    // Sin scene.background: el fondo lo pone el CSS translúcido de la vista,
    // dejando pasar la grilla y las partículas del plano.

    if (reducedMotion) {
      // Ambiente a intensidad 1: nodos Lambert planos, sin luces extra.
      scene.add(new THREE.AmbientLight('#ffffff', 1))
    } else {
      scene.add(new THREE.AmbientLight('#ffffff', 0.35))
      scene.add(new THREE.HemisphereLight('#c8d8ff', '#1a1028', 0.55))
      const dirLight = new THREE.DirectionalLight('#ffffff', 0.65)
      dirLight.position.set(12, 18, 14)
      scene.add(dirLight)
    }

    const sceneNodes: SceneNode[] = []
    const pickMeshes: THREE.Mesh[] = []
    for (const node of data.nodes) {
      const [x, y, z] = positions.get(node.slug) ?? [0, 0, 0]
      const color = nodeColors.get(node.type) ?? new THREE.Color('#ffffff')
      const radius = nodeRadius(node.linkCount)
      const segments = reducedMotion ? 24 : 32
      const material = reducedMotion
        ? new THREE.MeshLambertMaterial({ color: color.clone() })
        : new THREE.MeshStandardMaterial({
          color: color.clone(),
          metalness: 0.12,
          roughness: 0.38,
          emissive: color.clone().multiplyScalar(0.08),
        })
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(radius, segments, segments),
        material,
      )
      mesh.position.set(x, y, z)
      mesh.userData.slug = node.slug
      if (!reducedMotion) mesh.userData.baseRadius = radius
      scene.add(mesh)
      pickMeshes.push(mesh)

      sceneNodes.push({ slug: node.slug, type: node.type, mesh })
    }

    const typeBySlug = new Map(data.nodes.map(node => [node.slug, node.type]))
    const edgeEnds: Array<{
      from: THREE.Vector3
      to: THREE.Vector3
      type: WikiGraphNodeType
      fromSlug: string
    }> = []
    const edgePositions: number[] = []
    for (const edge of data.edges) {
      const from = positions.get(edge.from)
      const to = positions.get(edge.to)
      if (!from || !to) continue
      edgePositions.push(...from, ...to)
      edgeEnds.push({
        from: new THREE.Vector3(...from),
        to: new THREE.Vector3(...to),
        type: typeBySlug.get(edge.from) ?? 'concept',
        fromSlug: edge.from,
      })
    }
    const edgeGeometry = new THREE.BufferGeometry()
    edgeGeometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(edgePositions, 3),
    )
    const edgeMaterial = new THREE.LineBasicMaterial({
      color: themeColor(container, EDGE_VAR, EDGE_FALLBACK),
      transparent: true,
      opacity: reducedMotion ? EDGE_OPACITY_STATIC : EDGE_OPACITY_LIVE,
      depthWrite: false,
    })
    const edgeLines = new THREE.LineSegments(edgeGeometry, edgeMaterial)
    scene.add(edgeLines)

    // Descargas eléctricas: dos polilíneas jittered por arista (núcleo blanco-
    // cian + halo teñido). Ambas comparten geometría por arista, con actualización
    // de posiciones en cada disparo. Stagger aleatorio para que no parpadeen a la vez.
    interface Bolt {
      edgeIndex: number
      length: number
      dir: THREE.Vector3
      perp1: THREE.Vector3
      perp2: THREE.Vector3
      coreGeom: THREE.BufferGeometry
      haloGeom: THREE.BufferGeometry
      glowGeom: THREE.BufferGeometry
      coreLine: THREE.Line
      haloLine: THREE.Line
      glowLine: THREE.Line
      coreMat: THREE.LineBasicMaterial
      haloMat: THREE.LineBasicMaterial
      glowMat: THREE.LineBasicMaterial
      flashFrom: THREE.Sprite | null
      flashTo: THREE.Sprite | null
      /** Glow volumétrico a lo largo del rayo; vacío sin glowTexture. */
      rayGlows: THREE.Sprite[]
      /** Luz del pool asignada mientras dispara; null en idle o pool agotado. */
      light: THREE.PointLight | null
      state: 'idle' | 'firing'
      startedAt: number
      seed: number
      /** Intensidad aleatoria del disparo (0.72–1.0). */
      peak: number
    }
    interface NodePulseSchedule {
      fromSlug: string
      nodeIndex: number
      nextFireAt: number
    }
    const bolts: Bolt[] = []
    const boltIndicesByFromSlug = new Map<string, number[]>()
    const boltStartOffset = performance.now()
    // Pool de luces puntuales: pocas luces reales compartidas entre todas las
    // aristas (WebGL no aguanta una por arista); la descarga toma una libre.
    const lightPool: THREE.PointLight[] = []
    const allLights: THREE.PointLight[] = []
    if (!reducedMotion) {
      for (let i = 0; i < BOLT_LIGHT_POOL; i++) {
        const light = new THREE.PointLight('#ffffff', 0, 1, 2)
        scene.add(light)
        lightPool.push(light)
        allLights.push(light)
      }
    }
    if (!reducedMotion) {
      edgeEnds.forEach((edge, i) => {
        const dir = new THREE.Vector3().subVectors(edge.to, edge.from)
        const length = dir.length()
        if (length <= 0.0001) return
        dir.normalize()
        // Dos ejes perpendiculares al edge para jitter en 3D.
        const up = Math.abs(dir.y) > 0.95
          ? new THREE.Vector3(1, 0, 0)
          : new THREE.Vector3(0, 1, 0)
        const perp1 = new THREE.Vector3().crossVectors(dir, up).normalize()
        const perp2 = new THREE.Vector3().crossVectors(dir, perp1).normalize()

        const points = new Float32Array((BOLT_SEGMENTS + 1) * 3)
        // Recta inicial from→to; se re-jitterea en cada disparo.
        for (let s = 0; s <= BOLT_SEGMENTS; s++) {
          const t = s / BOLT_SEGMENTS
          points[s * 3] = edge.from.x + (edge.to.x - edge.from.x) * t
          points[s * 3 + 1] = edge.from.y + (edge.to.y - edge.from.y) * t
          points[s * 3 + 2] = edge.from.z + (edge.to.z - edge.from.z) * t
        }
        const coreGeom = new THREE.BufferGeometry()
        coreGeom.setAttribute('position', new THREE.BufferAttribute(points.slice(), 3))
        // Intensidad por vértice: centro más brillante que extremos (no-plano).
        const coreVertexColors = new Float32Array((BOLT_SEGMENTS + 1) * 3)
        for (let s = 0; s <= BOLT_SEGMENTS; s++) {
          const t = s / BOLT_SEGMENTS
          const bell = Math.sin(t * Math.PI)
          const intensity = 0.55 + 0.45 * bell
          // Blanco puro: el tinte del origen lo pone el color del material
          // (los vertex colors multiplican al material en LineBasicMaterial).
          coreVertexColors[s * 3] = intensity
          coreVertexColors[s * 3 + 1] = intensity
          coreVertexColors[s * 3 + 2] = intensity
        }
        coreGeom.setAttribute('color', new THREE.BufferAttribute(coreVertexColors, 3))
        const haloGeom = new THREE.BufferGeometry()
        haloGeom.setAttribute('position', new THREE.BufferAttribute(points.slice(), 3))
        const glowGeom = new THREE.BufferGeometry()
        glowGeom.setAttribute('position', new THREE.BufferAttribute(points.slice(), 3))

        const coreMat = new THREE.LineBasicMaterial({
          color: BOLT_WHITE.clone(),
          vertexColors: true,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
        const haloMat = new THREE.LineBasicMaterial({
          color: BOLT_WHITE.clone(),
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
        const glowMat = new THREE.LineBasicMaterial({
          color: BOLT_WHITE.clone(),
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
        const coreLine = new THREE.Line(coreGeom, coreMat)
        const haloLine = new THREE.Line(haloGeom, haloMat)
        const glowLine = new THREE.Line(glowGeom, glowMat)
        coreLine.frustumCulled = false
        haloLine.frustumCulled = false
        glowLine.frustumCulled = false
        scene.add(glowLine)
        scene.add(haloLine)
        scene.add(coreLine)

        // Flashes en endpoints: sprites aditivos que se encienden con el rayo.
        // Sin glowTexture (jsdom/2d off) el efecto solo queda en las líneas.
        let flashFrom: THREE.Sprite | null = null
        let flashTo: THREE.Sprite | null = null
        if (glowTexture) {
          const makeFlash = (at: THREE.Vector3): THREE.Sprite => {
            const s = new THREE.Sprite(new THREE.SpriteMaterial({
              map: glowTexture,
              color: BOLT_WHITE.clone(),
              blending: THREE.AdditiveBlending,
              transparent: true,
              opacity: 0,
              depthWrite: false,
            }))
            s.scale.setScalar(BOLT_ENDPOINT_SCALE_MULT)
            s.position.copy(at)
            scene.add(s)
            return s
          }
          flashFrom = makeFlash(edge.from)
          flashTo = makeFlash(edge.to)
        }

        // Glow volumétrico: sprites aditivos repartidos a lo largo del rayo.
        // Las líneas WebGL son de 1px y se ven planas; estos discos dan el
        // volumen de luz que emite la descarga.
        const rayGlows: THREE.Sprite[] = []
        if (glowTexture) {
          BOLT_RAY_GLOW_STOPS.forEach((stop, gi) => {
            const s = new THREE.Sprite(new THREE.SpriteMaterial({
              map: glowTexture,
              color: BOLT_WHITE.clone(),
              blending: THREE.AdditiveBlending,
              transparent: true,
              opacity: 0,
              depthWrite: false,
            }))
            s.scale.setScalar(length * (BOLT_RAY_GLOW_SCALE[gi] ?? 0.16))
            s.position.set(
              edge.from.x + (edge.to.x - edge.from.x) * stop,
              edge.from.y + (edge.to.y - edge.from.y) * stop,
              edge.from.z + (edge.to.z - edge.from.z) * stop,
            )
            scene.add(s)
            rayGlows.push(s)
          })
        }

        const boltIndex = bolts.length
        const fromIndices = boltIndicesByFromSlug.get(edge.fromSlug) ?? []
        fromIndices.push(boltIndex)
        boltIndicesByFromSlug.set(edge.fromSlug, fromIndices)

        bolts.push({
          edgeIndex: i,
          length,
          dir,
          perp1,
          perp2,
          coreGeom,
          haloGeom,
          glowGeom,
          coreLine,
          haloLine,
          glowLine,
          coreMat,
          haloMat,
          glowMat,
          flashFrom,
          flashTo,
          rayGlows,
          light: null,
          state: 'idle',
          startedAt: 0,
          seed: Math.random() * 1000,
          peak: 1,
        })
      })
    }

    const musicAtMount = isMusicActive(getThemeMusicBeat().pulse)
    const sourceNodeSlugs = [...boltIndicesByFromSlug.keys()]
    const nodeSchedules: NodePulseSchedule[] = sourceNodeSlugs.map((fromSlug, nodeIndex) => ({
      fromSlug,
      nodeIndex,
      nextFireAt: computeInitialNodeFireAt(
        boltStartOffset,
        nodeIndex,
        sourceNodeSlugs.length,
        Math.random,
        musicAtMount,
      ),
    }))

    const countFiringNodes = (): number => {
      let count = 0
      for (const fromSlug of sourceNodeSlugs) {
        const indices = boltIndicesByFromSlug.get(fromSlug) ?? []
        if (indices.some(index => bolts[index]!.state === 'firing')) count++
      }
      return count
    }

    const isNodePulsing = (fromSlug: string): boolean => {
      const indices = boltIndicesByFromSlug.get(fromSlug) ?? []
      return indices.some(index => bolts[index]!.state === 'firing')
    }

    /** Enciende todos los rayos salientes de un nodo a la vez. */
    const fireNodePulse = (fromSlug: string, now: number): void => {
      const indices = boltIndicesByFromSlug.get(fromSlug) ?? []
      for (const boltIndex of indices) {
        const bolt = bolts[boltIndex]!
        bolt.state = 'firing'
        bolt.startedAt = now
        bolt.peak = 0.88 + Math.random() * 0.12
        rewriteBolt(bolt, 1)
        const light = lightPool.pop() ?? null
        if (light) {
          const edge = edgeEnds[bolt.edgeIndex]!
          light.color.copy(BOLT_WHITE)
          light.position.set(
            (edge.from.x + edge.to.x) / 2,
            (edge.from.y + edge.to.y) / 2,
            (edge.from.z + edge.to.z) / 2,
          )
          light.distance = bolt.length * BOLT_LIGHT_DISTANCE_MULT
          bolt.light = light
        }
      }
    }

    /** Reescribe la polilínea del rayo con jitter perpendicular determinista+random. */
    const rewriteBolt = (bolt: Bolt, jitterScale: number): void => {
      const edge = edgeEnds[bolt.edgeIndex]!
      const coreAttr = bolt.coreGeom.getAttribute('position') as THREE.BufferAttribute
      const haloAttr = bolt.haloGeom.getAttribute('position') as THREE.BufferAttribute
      const glowAttr = bolt.glowGeom.getAttribute('position') as THREE.BufferAttribute
      const amp = bolt.length * BOLT_JITTER_RATIO * jitterScale
      for (let s = 0; s <= BOLT_SEGMENTS; s++) {
        const t = s / BOLT_SEGMENTS
        // Bell: máximo en el medio, 0 en los nodos, para que el rayo salga limpio.
        const bell = Math.sin(t * Math.PI)
        const baseX = edge.from.x + (edge.to.x - edge.from.x) * t
        const baseY = edge.from.y + (edge.to.y - edge.from.y) * t
        const baseZ = edge.from.z + (edge.to.z - edge.from.z) * t
        const isEnd = s === 0 || s === BOLT_SEGMENTS
        const j1c = isEnd ? 0 : (Math.random() - 0.5) * 2 * amp * bell
        const j2c = isEnd ? 0 : (Math.random() - 0.5) * 2 * amp * bell
        const j1h = isEnd ? 0 : (Math.random() - 0.5) * 2 * amp * bell * 1.35
        const j2h = isEnd ? 0 : (Math.random() - 0.5) * 2 * amp * bell * 1.35
        const j1g = isEnd ? 0 : (Math.random() - 0.5) * 2 * amp * bell * BOLT_GLOW_JITTER_MULT
        const j2g = isEnd ? 0 : (Math.random() - 0.5) * 2 * amp * bell * BOLT_GLOW_JITTER_MULT
        coreAttr.setXYZ(
          s,
          baseX + bolt.perp1.x * j1c + bolt.perp2.x * j2c,
          baseY + bolt.perp1.y * j1c + bolt.perp2.y * j2c,
          baseZ + bolt.perp1.z * j1c + bolt.perp2.z * j2c,
        )
        haloAttr.setXYZ(
          s,
          baseX + bolt.perp1.x * j1h + bolt.perp2.x * j2h,
          baseY + bolt.perp1.y * j1h + bolt.perp2.y * j2h,
          baseZ + bolt.perp1.z * j1h + bolt.perp2.z * j2h,
        )
        glowAttr.setXYZ(
          s,
          baseX + bolt.perp1.x * j1g + bolt.perp2.x * j2g,
          baseY + bolt.perp1.y * j1g + bolt.perp2.y * j2g,
          baseZ + bolt.perp1.z * j1g + bolt.perp2.z * j2g,
        )
      }
      coreAttr.needsUpdate = true
      haloAttr.needsUpdate = true
      glowAttr.needsUpdate = true
    }

    const render = (): void => renderer.render(scene, camera)

    /** Encuadra la cámara al bounding sphere del grafo (solo al montar). */
    const fitCameraToGraph = (): void => {
      if (sceneNodes.length === 0) return
      const nodePositions = sceneNodes.map(sn => sn.mesh.position)
      const box = new THREE.Box3().setFromPoints(nodePositions)
      const sphere = new THREE.Sphere()
      box.getBoundingSphere(sphere)
      sphere.radius += MAX_NODE_RADIUS
      const fovV = (camera.fov * Math.PI) / 180
      const fovH = 2 * Math.atan(Math.tan(fovV / 2) * camera.aspect)
      const effectiveFov = Math.min(fovV, fovH)
      const distance = (sphere.radius / Math.sin(effectiveFov / 2)) * 1.15
      controls.target.copy(sphere.center)
      camera.position.copy(sphere.center).add(
        FIT_CAMERA_DIR.clone().multiplyScalar(distance),
      )
      controls.maxDistance = Math.max(160, distance * 2)
      controls.update()
    }

    const applyTheme = (): void => {
      readThemeColors()
      edgeMaterial.color = themeColor(container, EDGE_VAR, EDGE_FALLBACK)
      for (const sceneNode of sceneNodes) {
        const color = nodeColors.get(sceneNode.type) ?? new THREE.Color('#ffffff')
        const mat = sceneNode.mesh.material
        if (mat instanceof THREE.MeshStandardMaterial) {
          mat.color.copy(color)
          mat.emissive.copy(color).multiplyScalar(0.08)
        } else {
          (mat as THREE.MeshLambertMaterial).color.copy(color)
        }
      }
      for (const bolt of bolts) {
        bolt.coreMat.color.copy(BOLT_WHITE)
        bolt.haloMat.color.copy(BOLT_WHITE)
        bolt.glowMat.color.copy(BOLT_WHITE)
        if (bolt.flashFrom) (bolt.flashFrom.material as THREE.SpriteMaterial).color.copy(BOLT_WHITE)
        if (bolt.flashTo) (bolt.flashTo.material as THREE.SpriteMaterial).color.copy(BOLT_WHITE)
        for (const glow of bolt.rayGlows) {
          (glow.material as THREE.SpriteMaterial).color.copy(BOLT_WHITE)
        }
      }
      render()
    }
    // applyTheme() inyecta las vars en el style del root y marca data-theme.
    const themeObserver = new MutationObserver(applyTheme)
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'style'],
    })

    const resize = (): void => {
      const width = Math.max(1, container.clientWidth)
      const height = Math.max(1, container.clientHeight)
      renderer.setSize(width, height)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      render()
    }
    resize()
    fitCameraToGraph()
    render()
    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(resize)
      : null
    resizeObserver?.observe(container)

    // Rotación idle: pausa al interactuar, vuelve tras un lapso sin tocar.
    let idleTimer: number | undefined
    const onControlsStart = (): void => {
      controls.autoRotate = false
      window.clearTimeout(idleTimer)
    }
    const onControlsEnd = (): void => {
      if (reducedMotion) return
      window.clearTimeout(idleTimer)
      idleTimer = window.setTimeout(() => { controls.autoRotate = true }, IDLE_RESUME_MS)
    }
    controls.addEventListener('start', onControlsStart)
    controls.addEventListener('end', onControlsEnd)
    if (reducedMotion) controls.addEventListener('change', render)

    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    let hoveredSlug: string | null = null
    const pickAt = (event: PointerEvent): string | null => {
      const rect = canvas.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return null
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(pointer, camera)
      const hit = raycaster.intersectObjects(pickMeshes, false)[0]
      return hit ? String(hit.object.userData.slug) : null
    }

    const onPointerMove = (event: PointerEvent): void => {
      const slug = pickAt(event)
      canvas.style.cursor = slug ? 'pointer' : ''
      if (slug !== hoveredSlug || slug) {
        hoveredSlug = slug
        callbacksRef.current.onHover(
          slug ? { slug, x: event.clientX, y: event.clientY } : null,
        )
      }
    }
    const onPointerLeave = (): void => {
      hoveredSlug = null
      canvas.style.cursor = ''
      callbacksRef.current.onHover(null)
    }
    // Click ≠ arrastre de órbita: solo abre si el puntero apenas se movió.
    let downAt: { x: number; y: number } | null = null
    const onPointerDown = (event: PointerEvent): void => {
      if (event.button !== 0) return
      downAt = { x: event.clientX, y: event.clientY }
    }
    const onPointerUp = (event: PointerEvent): void => {
      if (event.button !== 0 || !downAt) return
      const moved = Math.hypot(event.clientX - downAt.x, event.clientY - downAt.y)
      downAt = null
      if (moved > 5) return
      const slug = pickAt(event)
      if (slug) callbacksRef.current.onPick(slug)
    }
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerleave', onPointerLeave)
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointerup', onPointerUp)

    let raf = 0
    let prevBeatPulse = 0
    let lastBeatFireAt = 0
    let beatNodeCursor = 0
    const tick = (): void => {
      raf = requestAnimationFrame(tick)
      const now = performance.now()

      const beat = getThemeMusicBeat()

      if (isMusicActive(beat.pulse)) {
        const beatOnset = beat.pulse > 0.35 && beat.pulse > prevBeatPulse
        if (beatOnset && now - lastBeatFireAt >= BOLT_BEAT_COOLDOWN_MS) {
          if (countFiringNodes() < NODE_MAX_CONCURRENT_PULSES) {
            const slugCount = Math.max(1, sourceNodeSlugs.length)
            const slug = sourceNodeSlugs[beatNodeCursor % slugCount]!
            fireNodePulse(slug, now)
            beatNodeCursor = (beatNodeCursor + 1) % slugCount
            lastBeatFireAt = now
          }
        }
        prevBeatPulse = beat.pulse
      } else {
        prevBeatPulse = 0
        for (const schedule of nodeSchedules) {
          if (isNodePulsing(schedule.fromSlug) || now < schedule.nextFireAt) continue
          if (countFiringNodes() >= NODE_MAX_CONCURRENT_PULSES) {
            schedule.nextFireAt = now + BOLT_CAP_RETRY_MS
            continue
          }
          fireNodePulse(schedule.fromSlug, now)
          schedule.nextFireAt = computeNextNodeFireAt(
            now,
            schedule.nodeIndex,
            Math.random,
            false,
          )
        }
      }

      for (const bolt of bolts) {
        if (bolt.state === 'idle') continue
        const t = (now - bolt.startedAt) / BOLT_ACTIVE_MS
        if (t >= 1) {
          bolt.state = 'idle'
          bolt.coreMat.opacity = 0
          bolt.haloMat.opacity = 0
          bolt.glowMat.opacity = 0
          if (bolt.flashFrom) (bolt.flashFrom.material as THREE.SpriteMaterial).opacity = 0
          if (bolt.flashTo) (bolt.flashTo.material as THREE.SpriteMaterial).opacity = 0
          for (const glow of bolt.rayGlows) {
            (glow.material as THREE.SpriteMaterial).opacity = 0
          }
          if (bolt.light) {
            bolt.light.intensity = 0
            lightPool.push(bolt.light)
            bolt.light = null
          }
          continue
        }
        // Envelope: ataque rápido y fade largo — chispazo eléctrico.
        const env = t < BOLT_ATTACK
          ? t / BOLT_ATTACK
          : 1 - (t - BOLT_ATTACK) / (1 - BOLT_ATTACK)
        const eased = Math.max(0, env)
        const envelope = eased * bolt.peak
        const flicker = 0.88 + 0.12 * Math.sin(now * 0.05 + bolt.seed)
        bolt.coreMat.opacity = BOLT_CORE_OPACITY * envelope * flicker
        bolt.haloMat.opacity = BOLT_HALO_OPACITY * envelope * flicker
        bolt.glowMat.opacity = BOLT_GLOW_OPACITY * envelope
        // Flashes en endpoints: destello más corto (potencia^2) para reforzar
        // "arranque/impacto" del rayo sin robar continuidad al halo.
        const flash = BOLT_ENDPOINT_OPACITY * eased * eased
        if (bolt.flashFrom) (bolt.flashFrom.material as THREE.SpriteMaterial).opacity = flash
        if (bolt.flashTo) (bolt.flashTo.material as THREE.SpriteMaterial).opacity = flash
        // Glow volumétrico y luz real siguen el mismo envelope del rayo.
        for (const glow of bolt.rayGlows) {
          (glow.material as THREE.SpriteMaterial).opacity =
            BOLT_RAY_GLOW_OPACITY * envelope
        }
        if (bolt.light) {
          bolt.light.intensity = BOLT_LIGHT_INTENSITY * envelope
        }
        // Un pequeño re-jitter a mitad de vida da sensación de descarga viva.
        if (t > 0.45 && t < 0.55) rewriteBolt(bolt, 0.7)
      }
      for (const sceneNode of sceneNodes) {
        sceneNode.mesh.scale.setScalar(1)
      }
      controls.update()
      render()
    }
    if (reducedMotion) render()
    else raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(idleTimer)
      themeObserver.disconnect()
      resizeObserver?.disconnect()
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerleave', onPointerLeave)
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointerup', onPointerUp)
      controls.removeEventListener('start', onControlsStart)
      controls.removeEventListener('end', onControlsEnd)
      controls.removeEventListener('change', render)
      controls.dispose()
      for (const sceneNode of sceneNodes) {
        sceneNode.mesh.geometry.dispose()
        ;(sceneNode.mesh.material as THREE.Material).dispose()
      }
      for (const bolt of bolts) {
        bolt.coreGeom.dispose()
        bolt.haloGeom.dispose()
        bolt.glowGeom.dispose()
        bolt.coreMat.dispose()
        bolt.haloMat.dispose()
        bolt.glowMat.dispose()
        if (bolt.flashFrom) (bolt.flashFrom.material as THREE.Material).dispose()
        if (bolt.flashTo) (bolt.flashTo.material as THREE.Material).dispose()
        for (const glow of bolt.rayGlows) {
          (glow.material as THREE.Material).dispose()
        }
      }
      for (const light of allLights) light.dispose()
      edgeGeometry.dispose()
      edgeMaterial.dispose()
      glowTexture?.dispose()
      renderer.dispose()
      canvas.remove()
      callbacksRef.current.onHover(null)
    }
  }, [containerRef, data, positions, reducedMotion, webglAvailable, active])

  return { webglAvailable }
}
