/**
 * Bus de energía musical del tema (0..1 con pulso) para partículas ambientales.
 * Un AudioContext lazy + un MediaElementSource por HTMLAudioElement.
 * También expone energía por bandas de frecuencia y beat/BPM (mismo analyser).
 */

/** Suavizado del Analyser: bajo para conservar transientes. */
const ANALYSER_SMOOTHING = 0.2
/** Ataque rápido hacia picos. */
const ATTACK = 0.65
/** Liberación lenta tras el golpe. */
const RELEASE = 0.12
/** Exponente perceptual: enfatiza picos, aplana valles. */
const PERCEPTUAL_EXP = 0.65
/** Índice de bin grave/medio relativo al buffer (evita trebles planos). */
const BASS_MID_END_RATIO = 0.45
/** Adaptación lenta del piso de ruido. */
const FLOOR_ADAPT = 0.04
/** Adaptación del pico: sube rápido, baja lento. */
const PEAK_ATTACK = 0.4
const PEAK_RELEASE = 0.025
/** Rango mínimo de normalización para evitar división por ~0. */
const MIN_RANGE = 0.18

/** Bandas log: sub/bass → bass → low-mid → mid → high-mid → presence/high. */
export const THEME_MUSIC_BAND_COUNT = 6
/** Ataque por banda (rápido). */
const BAND_ATTACK = 0.65
/** Liberación por banda (lenta). */
const BAND_RELEASE = 0.12

/** Primeras N bandas (sub/bass) para onset de beat. */
const BEAT_BASS_BANDS = 2
/** Cooldown mínimo entre golpes (evita dobles). */
const BEAT_COOLDOWN_MS = 280
/** Delta mínimo sobre el nivel previo para onset. */
const BEAT_ONSET_DELTA = 0.07
/** Adaptación del umbral dinámico de graves. */
const BEAT_THRESHOLD_ADAPT = 0.12
/** Margen sobre el umbral adaptativo. */
const BEAT_THRESHOLD_MARGIN = 0.04
/** BPM válido para estimar tempo. */
const BPM_MIN = 60
const BPM_MAX = 180
/** Historial de intervalos válidos para mediana. */
const BEAT_INTERVAL_HISTORY = 8
/** Mínimo de intervalos para publicar BPM. */
const BEAT_BPM_MIN_SAMPLES = 3
/** Ataque del pulse hacia 1 en cada beat. */
const BEAT_PULSE_ATTACK = 0.92
/** Release del pulse por llamada/frame (más lento = golpe más legible). */
const BEAT_PULSE_RELEASE = 0.11

export type ThemeMusicBeat = {
  /** 0..1: sube en el golpe y decae. */
  pulse: number
  /** BPM estimado o null si no hay suficientes golpes. */
  bpm: number | null
}

type AttachedSource = {
  audio: HTMLAudioElement
  source: MediaElementAudioSourceNode
  analyser: AnalyserNode
}

let audioContext: AudioContext | null = null
let attached: AttachedSource | null = null
let pulsedEnergy = 0
let adaptiveFloor = 0.06
let adaptivePeak = 0.45
let freqBuffer: Uint8Array | null = null
const pulsedBands: number[] = Array.from({ length: THEME_MUSIC_BAND_COUNT }, () => 0)
const zeroBands: readonly number[] = Object.freeze(
  Array.from({ length: THEME_MUSIC_BAND_COUNT }, () => 0),
)

let beatPulse = 0
let beatPrevBass = 0
let beatThreshold = 0.2
let lastBeatAtMs = 0
const beatIntervalsMs: number[] = []
let estimatedBpm: number | null = null

function getAudioContextCtor(): (typeof AudioContext) | null {
  if (typeof window === 'undefined') return null
  const w = window as Window & { webkitAudioContext?: typeof AudioContext }
  return w.AudioContext ?? w.webkitAudioContext ?? null
}

function ensureContext(): AudioContext | null {
  if (audioContext) return audioContext
  const Ctor = getAudioContextCtor()
  if (!Ctor) return null
  try {
    audioContext = new Ctor()
    return audioContext
  } catch {
    return null
  }
}

function isAudioPlaying(audio: HTMLAudioElement): boolean {
  try {
    return !audio.paused && !audio.ended && audio.readyState >= 2
  } catch {
    return false
  }
}

/** Rellena freqBuffer desde el analyser (una lectura por llamada). */
function fillFreqBuffer(analyser: AnalyserNode): Uint8Array | null {
  const len = analyser.frequencyBinCount
  if (len <= 0) return null
  if (!freqBuffer || freqBuffer.length !== len) {
    freqBuffer = new Uint8Array(len)
  }
  analyser.getByteFrequencyData(freqBuffer)
  return freqBuffer
}

function readRawEnergyFromBuffer(buf: Uint8Array): number {
  const len = buf.length
  const end = Math.max(1, Math.floor(len * BASS_MID_END_RATIO))
  let sum = 0
  for (let i = 0; i < end; i += 1) {
    sum += buf[i]!
  }
  return Math.min(1, Math.max(0, sum / (end * 255)))
}

function readRawEnergy(analyser: AnalyserNode): number {
  const buf = fillFreqBuffer(analyser)
  if (!buf) return 0
  return readRawEnergyFromBuffer(buf)
}

/**
 * Bordes de bins logarítmicos crecientes (THEME_MUSIC_BAND_COUNT + 1).
 * Aproxima sub/bass → presence/high.
 */
export function themeMusicBandEdges(binCount: number): number[] {
  const edges = [0]
  for (let b = 1; b < THEME_MUSIC_BAND_COUNT; b += 1) {
    const t = b / THEME_MUSIC_BAND_COUNT
    const edge = Math.floor(Math.pow(Math.max(2, binCount), t))
    edges.push(Math.max(edges[edges.length - 1]! + 1, edge))
  }
  edges.push(binCount)
  return edges
}

function readRawBandsFromBuffer(buf: Uint8Array): number[] {
  const edges = themeMusicBandEdges(buf.length)
  const raw: number[] = []
  for (let b = 0; b < THEME_MUSIC_BAND_COUNT; b += 1) {
    const start = edges[b]!
    const end = Math.max(start + 1, edges[b + 1]!)
    let sum = 0
    const span = end - start
    for (let i = start; i < end; i += 1) {
      sum += buf[i] ?? 0
    }
    raw.push(Math.min(1, Math.max(0, sum / (span * 255))))
  }
  return raw
}

/** Noise gate + rango dinámico adaptativo → 0..1. */
function normalizeDynamic(raw: number): number {
  adaptiveFloor += (raw - adaptiveFloor) * FLOOR_ADAPT
  if (raw > adaptivePeak) {
    adaptivePeak += (raw - adaptivePeak) * PEAK_ATTACK
  } else {
    adaptivePeak += (raw - adaptivePeak) * PEAK_RELEASE
  }

  const floor = Math.min(adaptiveFloor, adaptivePeak - MIN_RANGE)
  const range = Math.max(MIN_RANGE, adaptivePeak - floor)
  return Math.min(1, Math.max(0, (raw - floor) / range))
}

function applyEnvelope(target: number): number {
  const rate = target > pulsedEnergy ? ATTACK : RELEASE
  pulsedEnergy += (target - pulsedEnergy) * rate
  if (pulsedEnergy < 0.001) pulsedEnergy = 0
  return Math.min(1, Math.max(0, pulsedEnergy))
}

function decayTowardZero(): number {
  return applyEnvelope(0)
}

function applyBandEnvelopes(targets: readonly number[]): readonly number[] {
  for (let b = 0; b < THEME_MUSIC_BAND_COUNT; b += 1) {
    const target = targets[b] ?? 0
    const current = pulsedBands[b]!
    const rate = target > current ? BAND_ATTACK : BAND_RELEASE
    let next = current + (target - current) * rate
    if (next < 0.001) next = 0
    pulsedBands[b] = Math.min(1, Math.max(0, next))
  }
  return pulsedBands
}

function decayBandsTowardZero(): readonly number[] {
  return applyBandEnvelopes(zeroBands)
}

function resetAdaptiveLevels(): void {
  adaptiveFloor = 0.06
  adaptivePeak = 0.45
}

function resetBandEnvelopes(): void {
  for (let b = 0; b < THEME_MUSIC_BAND_COUNT; b += 1) {
    pulsedBands[b] = 0
  }
}

function nowMs(): number {
  return Date.now()
}

/** Media de las primeras bandas graves (raw 0..1). */
function readRawBassEnergy(buf: Uint8Array): number {
  const rawBands = readRawBandsFromBuffer(buf)
  let sum = 0
  const n = Math.min(BEAT_BASS_BANDS, rawBands.length)
  for (let i = 0; i < n; i += 1) sum += rawBands[i]!
  return n > 0 ? sum / n : 0
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2
  }
  return sorted[mid]!
}

function intervalToBpm(intervalMs: number): number {
  return 60000 / intervalMs
}

function isValidBeatInterval(intervalMs: number): boolean {
  const bpm = intervalToBpm(intervalMs)
  return bpm >= BPM_MIN && bpm <= BPM_MAX
}

function applyBeatPulseEnvelope(target: number): number {
  const rate = target > beatPulse ? BEAT_PULSE_ATTACK : BEAT_PULSE_RELEASE
  beatPulse += (target - beatPulse) * rate
  if (beatPulse < 0.001) beatPulse = 0
  return Math.min(1, Math.max(0, beatPulse))
}

function decayBeatTowardZero(): ThemeMusicBeat {
  estimatedBpm = null
  beatIntervalsMs.length = 0
  lastBeatAtMs = 0
  beatPrevBass = 0
  return { pulse: applyBeatPulseEnvelope(0), bpm: null }
}

function resetBeatState(): void {
  beatPulse = 0
  beatPrevBass = 0
  beatThreshold = 0.2
  lastBeatAtMs = 0
  beatIntervalsMs.length = 0
  estimatedBpm = null
}

function registerBeat(now: number): void {
  if (lastBeatAtMs > 0) {
    const interval = now - lastBeatAtMs
    if (isValidBeatInterval(interval)) {
      beatIntervalsMs.push(interval)
      if (beatIntervalsMs.length > BEAT_INTERVAL_HISTORY) {
        beatIntervalsMs.shift()
      }
      if (beatIntervalsMs.length >= BEAT_BPM_MIN_SAMPLES) {
        const med = median(beatIntervalsMs)
        const rawBpm = intervalToBpm(med)
        estimatedBpm = estimatedBpm == null
          ? rawBpm
          : estimatedBpm * 0.65 + rawBpm * 0.35
      }
    }
  }
  lastBeatAtMs = now
  beatPulse = 1
}

function processBeatFromBass(bassEnergy: number): ThemeMusicBeat {
  const now = nowMs()
  beatThreshold += (bassEnergy - beatThreshold) * BEAT_THRESHOLD_ADAPT

  const crossed =
    bassEnergy > beatThreshold + BEAT_THRESHOLD_MARGIN
    && bassEnergy > beatPrevBass + BEAT_ONSET_DELTA
  const cooled = lastBeatAtMs === 0 || now - lastBeatAtMs >= BEAT_COOLDOWN_MS

  if (crossed && cooled) {
    registerBeat(now)
  } else {
    applyBeatPulseEnvelope(0)
  }

  beatPrevBass = bassEnergy
  return {
    pulse: Math.min(1, Math.max(0, beatPulse)),
    bpm: estimatedBpm,
  }
}

/** Energía de pulso 0..1. Sin audio/analyser/context → tiende a 0. */
export function getThemeMusicEnergy(): number {
  if (!attached || !audioContext) return decayTowardZero()
  if (audioContext.state === 'suspended' || !isAudioPlaying(attached.audio)) {
    return decayTowardZero()
  }

  let raw = 0
  try {
    raw = readRawEnergy(attached.analyser)
  } catch {
    raw = 0
  }

  const normalized = normalizeDynamic(raw)
  const perceptual = Math.pow(normalized, PERCEPTUAL_EXP)
  return applyEnvelope(perceptual)
}

/**
 * Energía por banda 0..1 (THEME_MUSIC_BAND_COUNT valores).
 * Mismo analyser/source; sin audio/play/context → todas tienden a 0.
 */
export function getThemeMusicBands(): readonly number[] {
  if (!attached || !audioContext) return decayBandsTowardZero()
  if (audioContext.state === 'suspended' || !isAudioPlaying(attached.audio)) {
    return decayBandsTowardZero()
  }

  let rawBands: number[] = Array.from({ length: THEME_MUSIC_BAND_COUNT }, () => 0)
  try {
    const buf = fillFreqBuffer(attached.analyser)
    if (buf) rawBands = readRawBandsFromBuffer(buf)
  } catch {
    rawBands = Array.from({ length: THEME_MUSIC_BAND_COUNT }, () => 0)
  }

  const targets = rawBands.map((raw) => Math.pow(raw, PERCEPTUAL_EXP))
  return applyBandEnvelopes(targets)
}

/**
 * Beat aproximado desde graves (mismas bandas 0–1 raw).
 * pulse: sube a 1 en onset y decae; bpm: mediana suavizada o null.
 */
export function getThemeMusicBeat(): ThemeMusicBeat {
  if (!attached || !audioContext) return decayBeatTowardZero()
  if (audioContext.state === 'suspended' || !isAudioPlaying(attached.audio)) {
    return decayBeatTowardZero()
  }

  let bass = 0
  try {
    const buf = fillFreqBuffer(attached.analyser)
    if (buf) bass = readRawBassEnergy(buf)
  } catch {
    bass = 0
  }

  return processBeatFromBass(bass)
}

/** Despierta el AudioContext tras gesto del usuario (antes de play). */
export function resumeThemeMusicEnergyContext(): Promise<void> | void {
  const ctx = ensureContext()
  if (!ctx || ctx.state !== 'suspended') return
  try {
    return ctx.resume().catch(() => {})
  } catch {
    // entornos sin WebAudio
  }
}

/**
 * Conecta audio → analyser → destination una sola vez por elemento.
 * Re-attach del mismo audio es no-op; otro audio reemplaza el vínculo.
 */
export function attachThemeMusicAnalyser(audio: HTMLAudioElement): void {
  if (!audio) return
  if (attached?.audio === audio) return

  const ctx = ensureContext()
  if (!ctx) return

  try {
    if (attached) {
      try {
        attached.source.disconnect()
      } catch { /* already disconnected */ }
      try {
        attached.analyser.disconnect()
      } catch { /* already disconnected */ }
      attached = null
    }

    const source = ctx.createMediaElementSource(audio)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 256
    analyser.smoothingTimeConstant = ANALYSER_SMOOTHING
    source.connect(analyser)
    analyser.connect(ctx.destination)
    attached = { audio, source, analyser }
    pulsedEnergy = 0
    resetAdaptiveLevels()
    resetBandEnvelopes()
    resetBeatState()
  } catch {
    // jsdom / createMediaElementSource ya usado / sin WebAudio
    attached = null
  }
}

/** Libera el vínculo del audio y deja la energía tendiendo a 0. */
export function detachThemeMusicAnalyser(audio?: HTMLAudioElement): void {
  if (!attached) {
    pulsedEnergy = 0
    resetBandEnvelopes()
    resetBeatState()
    return
  }
  if (audio && attached.audio !== audio) return

  try {
    attached.source.disconnect()
  } catch { /* ignore */ }
  try {
    attached.analyser.disconnect()
  } catch { /* ignore */ }
  attached = null
  pulsedEnergy = 0
  resetAdaptiveLevels()
  resetBandEnvelopes()
  resetBeatState()
}

/** Solo para tests: resetea estado del módulo. */
export function __resetThemeMusicEnergyForTests(): void {
  if (attached) {
    try { attached.source.disconnect() } catch { /* ignore */ }
    try { attached.analyser.disconnect() } catch { /* ignore */ }
  }
  attached = null
  pulsedEnergy = 0
  resetAdaptiveLevels()
  resetBandEnvelopes()
  resetBeatState()
  freqBuffer = null
  if (audioContext) {
    try {
      void audioContext.close()
    } catch { /* ignore */ }
  }
  audioContext = null
}
