/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  __resetThemeMusicEnergyForTests,
  attachThemeMusicAnalyser,
  detachThemeMusicAnalyser,
  getThemeMusicBands,
  getThemeMusicBeat,
  getThemeMusicEnergy,
  resumeThemeMusicEnergyContext,
  THEME_MUSIC_BAND_COUNT,
  themeMusicBandEdges,
} from '../themeMusicEnergy'

type FakeAnalyser = {
  fftSize: number
  smoothingTimeConstant: number
  frequencyBinCount: number
  connect: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
  getByteFrequencyData: ReturnType<typeof vi.fn>
}

type FakeSource = {
  connect: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
}

function makeFakeAudio(overrides: Partial<HTMLAudioElement> = {}): HTMLAudioElement {
  return {
    paused: true,
    ended: false,
    readyState: 0,
    ...overrides,
  } as unknown as HTMLAudioElement
}

describe('themeMusicEnergy', () => {
  let createMediaElementSource: ReturnType<typeof vi.fn>
  let createAnalyser: ReturnType<typeof vi.fn>
  let resume: ReturnType<typeof vi.fn>
  let close: ReturnType<typeof vi.fn>
  let lastAnalyser: FakeAnalyser | null
  let mediaSourceCallCount: number
  let frameLevel: number
  /** Si no es null, pinta bins por índice en vez de flat frameLevel. */
  let perBinLevels: Uint8Array | null

  beforeEach(() => {
    __resetThemeMusicEnergyForTests()
    lastAnalyser = null
    mediaSourceCallCount = 0
    frameLevel = 180
    perBinLevels = null

    createMediaElementSource = vi.fn((_audio: HTMLAudioElement) => {
      mediaSourceCallCount += 1
      const source: FakeSource = {
        connect: vi.fn(),
        disconnect: vi.fn(),
      }
      return source
    })

    createAnalyser = vi.fn(() => {
      const analyser: FakeAnalyser = {
        fftSize: 2048,
        smoothingTimeConstant: 0.8,
        frequencyBinCount: 128,
        connect: vi.fn(),
        disconnect: vi.fn(),
        getByteFrequencyData: vi.fn((buf: Uint8Array) => {
          if (perBinLevels && perBinLevels.length === buf.length) {
            buf.set(perBinLevels)
            return
          }
          for (let i = 0; i < buf.length; i += 1) buf[i] = frameLevel
        }),
      }
      lastAnalyser = analyser
      return analyser
    })

    resume = vi.fn(() => Promise.resolve())
    close = vi.fn(() => Promise.resolve())

    class FakeAudioContext {
      state = 'running'
      destination = {}
      createMediaElementSource = createMediaElementSource
      createAnalyser = createAnalyser
      resume = resume
      close = close
    }

    vi.stubGlobal('AudioContext', FakeAudioContext)
  })

  afterEach(() => {
    __resetThemeMusicEnergyForTests()
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('sin attach ni play la energía es 0', () => {
    expect(getThemeMusicEnergy()).toBe(0)
  })

  it('attach del mismo audio no crea dos MediaElementSource', () => {
    const audio = makeFakeAudio()
    attachThemeMusicAnalyser(audio)
    attachThemeMusicAnalyser(audio)
    expect(mediaSourceCallCount).toBe(1)
    expect(createMediaElementSource).toHaveBeenCalledTimes(1)
  })

  it('attach configura smoothing bajo en el analyser', () => {
    const audio = makeFakeAudio()
    attachThemeMusicAnalyser(audio)
    expect(lastAnalyser?.smoothingTimeConstant).toBeGreaterThanOrEqual(0.15)
    expect(lastAnalyser?.smoothingTimeConstant).toBeLessThanOrEqual(0.25)
  })

  it('detach deja energía en 0 y desconecta', () => {
    const audio = makeFakeAudio({
      paused: false,
      ended: false,
      readyState: 4,
    } as Partial<HTMLAudioElement>)
    attachThemeMusicAnalyser(audio)
    expect(lastAnalyser).toBeTruthy()
    const analyser = lastAnalyser!

    // Calienta energía
    const e1 = getThemeMusicEnergy()
    expect(e1).toBeGreaterThan(0)

    detachThemeMusicAnalyser(audio)
    expect(analyser.disconnect).toHaveBeenCalled()
    expect(getThemeMusicEnergy()).toBe(0)
  })

  it('frame alto sube y frame bajo baja: pulso, no plateau', () => {
    const audio = makeFakeAudio({
      paused: false,
      ended: false,
      readyState: 4,
    } as Partial<HTMLAudioElement>)
    attachThemeMusicAnalyser(audio)

    frameLevel = 220
    let rising = 0
    for (let i = 0; i < 6; i += 1) {
      rising = getThemeMusicEnergy()
    }
    expect(rising).toBeGreaterThan(0.35)

    frameLevel = 8
    let falling = rising
    const samples: number[] = []
    for (let i = 0; i < 10; i += 1) {
      falling = getThemeMusicEnergy()
      samples.push(falling)
    }
    expect(falling).toBeLessThan(rising * 0.55)
    expect(samples[samples.length - 1]!).toBeLessThan(samples[0]!)
  })

  it('attach/detach sin AudioContext no explotan', () => {
    vi.unstubAllGlobals()
    vi.stubGlobal('AudioContext', undefined)
    const audio = makeFakeAudio()
    expect(() => attachThemeMusicAnalyser(audio)).not.toThrow()
    expect(() => detachThemeMusicAnalyser(audio)).not.toThrow()
    expect(getThemeMusicEnergy()).toBe(0)
  })

  it('resumeThemeMusicEnergyContext reanuda context suspended', async () => {
    class SuspendedCtx {
      state = 'suspended'
      destination = {}
      createMediaElementSource = createMediaElementSource
      createAnalyser = createAnalyser
      resume = resume
      close = close
    }
    vi.stubGlobal('AudioContext', SuspendedCtx)
    __resetThemeMusicEnergyForTests()

    const audio = makeFakeAudio()
    attachThemeMusicAnalyser(audio)
    await Promise.resolve(resumeThemeMusicEnergyContext())
    expect(resume).toHaveBeenCalled()
  })

  it('sin audio getThemeMusicBands devuelve bandas en 0', () => {
    const bands = getThemeMusicBands()
    expect(bands).toHaveLength(THEME_MUSIC_BAND_COUNT)
    expect([...bands].every((v) => v === 0)).toBe(true)
  })

  it('una banda con bins altos sube más que las demás', () => {
    const audio = makeFakeAudio({
      paused: false,
      ended: false,
      readyState: 4,
    } as Partial<HTMLAudioElement>)
    attachThemeMusicAnalyser(audio)

    const binCount = 128
    const edges = themeMusicBandEdges(binCount)
    const hotBand = THEME_MUSIC_BAND_COUNT - 1
    const levels = new Uint8Array(binCount)
    for (let i = edges[hotBand]!; i < edges[hotBand + 1]!; i += 1) {
      levels[i] = 230
    }
    perBinLevels = levels

    let bands: readonly number[] = zeroLike()
    for (let i = 0; i < 8; i += 1) {
      bands = getThemeMusicBands()
    }

    expect(bands).toHaveLength(THEME_MUSIC_BAND_COUNT)
    expect(bands[hotBand]!).toBeGreaterThan(0.35)
    for (let b = 0; b < THEME_MUSIC_BAND_COUNT; b += 1) {
      if (b === hotBand) continue
      expect(bands[hotBand]!).toBeGreaterThan(bands[b]! * 2)
    }
  })

  it('al bajar bins de una banda decae gradualmente', () => {
    const audio = makeFakeAudio({
      paused: false,
      ended: false,
      readyState: 4,
    } as Partial<HTMLAudioElement>)
    attachThemeMusicAnalyser(audio)

    const binCount = 128
    const edges = themeMusicBandEdges(binCount)
    const hotBand = 2
    const hot = new Uint8Array(binCount)
    for (let i = edges[hotBand]!; i < edges[hotBand + 1]!; i += 1) {
      hot[i] = 230
    }
    perBinLevels = hot

    let peak = 0
    for (let i = 0; i < 8; i += 1) {
      peak = getThemeMusicBands()[hotBand]!
    }
    expect(peak).toBeGreaterThan(0.35)

    perBinLevels = new Uint8Array(binCount)
    const samples: number[] = []
    for (let i = 0; i < 10; i += 1) {
      samples.push(getThemeMusicBands()[hotBand]!)
    }
    expect(samples[1]!).toBeGreaterThan(0)
    expect(samples[samples.length - 1]!).toBeLessThan(samples[0]!)
    expect(samples[0]! - samples[3]!).toBeGreaterThan(0.01)
    expect(samples[samples.length - 1]!).toBeLessThan(peak * 0.55)
  })

  it('attach del mismo audio no duplica source al leer bandas', () => {
    const audio = makeFakeAudio({
      paused: false,
      ended: false,
      readyState: 4,
    } as Partial<HTMLAudioElement>)
    attachThemeMusicAnalyser(audio)
    attachThemeMusicAnalyser(audio)
    getThemeMusicBands()
    getThemeMusicEnergy()
    expect(mediaSourceCallCount).toBe(1)
  })

  it('sin audio getThemeMusicBeat devuelve pulse 0 y bpm null', () => {
    const beat = getThemeMusicBeat()
    expect(beat.pulse).toBe(0)
    expect(beat.bpm).toBeNull()
  })

  it('graves altos con cooldown disparan pulse y luego decae', () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000_000)

    const audio = makeFakeAudio({
      paused: false,
      ended: false,
      readyState: 4,
    } as Partial<HTMLAudioElement>)
    attachThemeMusicAnalyser(audio)

    const binCount = 128
    const edges = themeMusicBandEdges(binCount)
    const bassHit = new Uint8Array(binCount)
    for (let i = edges[0]!; i < edges[2]!; i += 1) {
      bassHit[i] = 240
    }
    const silent = new Uint8Array(binCount)

    perBinLevels = bassHit
    const hit = getThemeMusicBeat()
    expect(hit.pulse).toBeGreaterThan(0.9)

    perBinLevels = silent
    const samples: number[] = []
    for (let i = 0; i < 12; i += 1) {
      samples.push(getThemeMusicBeat().pulse)
    }
    expect(samples[0]!).toBeLessThan(hit.pulse)
    expect(samples[samples.length - 1]!).toBeLessThan(samples[0]!)
    expect(samples[samples.length - 1]!).toBeLessThan(0.35)

    // Dentro del cooldown no re-dispara aunque vuelvan graves.
    perBinLevels = bassHit
    const duringCooldown = getThemeMusicBeat()
    expect(duringCooldown.pulse).toBeLessThan(0.9)

    vi.setSystemTime(1_000_000 + 320)
    perBinLevels = silent
    getThemeMusicBeat()
    perBinLevels = bassHit
    const afterCooldown = getThemeMusicBeat()
    expect(afterCooldown.pulse).toBeGreaterThan(0.9)
  })

  it('intervalos válidos producen BPM aproximado', () => {
    vi.useFakeTimers()
    vi.setSystemTime(2_000_000)

    const audio = makeFakeAudio({
      paused: false,
      ended: false,
      readyState: 4,
    } as Partial<HTMLAudioElement>)
    attachThemeMusicAnalyser(audio)

    const binCount = 128
    const edges = themeMusicBandEdges(binCount)
    const bassHit = new Uint8Array(binCount)
    for (let i = edges[0]!; i < edges[2]!; i += 1) {
      bassHit[i] = 240
    }
    const silent = new Uint8Array(binCount)

    // 120 BPM → intervalo 500ms; hace falta ≥3 intervalos.
    for (let beat = 0; beat < 5; beat += 1) {
      vi.setSystemTime(2_000_000 + beat * 500)
      perBinLevels = silent
      getThemeMusicBeat()
      perBinLevels = bassHit
      getThemeMusicBeat()
    }

    const result = getThemeMusicBeat()
    expect(result.bpm).not.toBeNull()
    expect(result.bpm!).toBeGreaterThan(100)
    expect(result.bpm!).toBeLessThan(140)
  })

  it('attach del mismo audio no duplica source al leer beat', () => {
    const audio = makeFakeAudio({
      paused: false,
      ended: false,
      readyState: 4,
    } as Partial<HTMLAudioElement>)
    attachThemeMusicAnalyser(audio)
    attachThemeMusicAnalyser(audio)
    getThemeMusicBeat()
    getThemeMusicBands()
    expect(mediaSourceCallCount).toBe(1)
  })
})

function zeroLike(): readonly number[] {
  return Array.from({ length: THEME_MUSIC_BAND_COUNT }, () => 0)
}
