import {
  drawGravityFallParticle,
  readAuroraThemeColors,
  type GravityFallParticle,
} from './auroraParticlesCore'
import { DICTATION_SPECTRUM_BAND_COUNT } from '../../shared/dictationSpectrum'

/** Espejo de `DICTATION_SILENCE_PEAK_THRESHOLD` / helper Swift. */
export const DICTATION_LEVEL_SPAWN_THRESHOLD = 0.008
export const DICTATION_BAND_SPAWN_THRESHOLD = 0.012

/** Espejo de `spectrumTargetHz` en native/mac-dictation/main.swift. */
export const DICTATION_BAND_HZ = [
  100, 150, 220, 330, 500, 750, 1100, 1700, 2500, 3800, 5500, 8000,
] as const

const MAX_PARTICLES = 88
const BAND_COLOR_VARS = [
  '--theme-magenta',
  '--accent',
  '--theme-cyan',
  '--theme-blue',
] as const

export type DictationMicTarget = {
  x: number
  y: number
}

export type DictationMicParticle = GravityFallParticle & {
  bandIndex: number
}

type BandTier = 'bass' | 'mid' | 'treble'

type BandProfile = {
  hz: number
  tier: BandTier
  /** Centro del arco de spawn (rad). */
  spawnAngle: number
  /** Ancho del arco de spawn (rad). */
  spawnWedge: number
  orbitMin: number
  orbitMax: number
  /** Punto de absorción en el anillo del mic (rad + px). */
  sinkAngle: number
  sinkRadius: number
  sizeMin: number
  sizeMax: number
  speedMin: number
  speedMax: number
  lifeMin: number
  lifeMax: number
  colorIndex: number
}

function bandTier(index: number): BandTier {
  if (index < 4) return 'bass'
  if (index < 8) return 'mid'
  return 'treble'
}

function buildBandProfiles(): BandProfile[] {
  return Array.from({ length: DICTATION_SPECTRUM_BAND_COUNT }, (_, index) => {
    const tier = bandTier(index)
    const spawnAngle = (index / DICTATION_SPECTRUM_BAND_COUNT) * Math.PI * 2 - Math.PI / 2
    const orbit =
      tier === 'bass'
        ? { min: 208, max: 272 }
        : tier === 'mid'
          ? { min: 168, max: 224 }
          : { min: 124, max: 172 }
    const sinkRadius = tier === 'bass' ? 36 : tier === 'mid' ? 28 : 20
    const size =
      tier === 'bass'
        ? { min: 2.2, max: 3.8 }
        : tier === 'mid'
          ? { min: 1.5, max: 2.8 }
          : { min: 1.0, max: 2.0 }
    const speed =
      tier === 'bass'
        ? { min: 62, max: 118 }
        : tier === 'mid'
          ? { min: 92, max: 168 }
          : { min: 128, max: 228 }
    const life =
      tier === 'bass'
        ? { min: 1.05, max: 1.55 }
        : tier === 'mid'
          ? { min: 0.82, max: 1.18 }
          : { min: 0.58, max: 0.92 }
    return {
      hz: DICTATION_BAND_HZ[index] ?? 0,
      tier,
      spawnAngle,
      spawnWedge: Math.PI / 9,
      orbitMin: orbit.min,
      orbitMax: orbit.max,
      sinkAngle: spawnAngle,
      sinkRadius,
      sizeMin: size.min,
      sizeMax: size.max,
      speedMin: speed.min,
      speedMax: speed.max,
      lifeMin: life.min,
      lifeMax: life.max,
      colorIndex: tier === 'bass' ? 0 : tier === 'mid' ? 1 + (index % 2) : 3,
    }
  })
}

const BAND_PROFILES = buildBandProfiles()

function bandProfile(index: number): BandProfile {
  return BAND_PROFILES[index] ?? BAND_PROFILES[0]!
}

function bandColor(colors: string[], profile: BandProfile): string {
  return colors[profile.colorIndex % colors.length] ?? colors[0] ?? 'rgba(120, 180, 255, 0.8)'
}

export function bandSinkTarget(bandIndex: number, mic: DictationMicTarget): DictationMicTarget {
  const profile = bandProfile(bandIndex)
  return {
    x: mic.x + Math.cos(profile.sinkAngle) * profile.sinkRadius,
    y: mic.y + Math.sin(profile.sinkAngle) * profile.sinkRadius,
  }
}

function spawnParticle(
  bandIndex: number,
  bandValue: number,
  mic: DictationMicTarget,
  colors: string[],
): DictationMicParticle {
  const profile = bandProfile(bandIndex)
  const sink = bandSinkTarget(bandIndex, mic)
  const energy = Math.min(1, bandValue)
  const angle = profile.spawnAngle + (Math.random() - 0.5) * profile.spawnWedge
  const radius = profile.orbitMin + Math.random() * (profile.orbitMax - profile.orbitMin)
  const x = mic.x + Math.cos(angle) * radius
  const y = mic.y + Math.sin(angle) * radius
  const dx = sink.x - x
  const dy = sink.y - y
  const dist = Math.max(1, Math.hypot(dx, dy))
  const speed = profile.speedMin + energy * (profile.speedMax - profile.speedMin)
  const maxLife = profile.lifeMin + Math.random() * (profile.lifeMax - profile.lifeMin)
  const size = profile.sizeMin + energy * (profile.sizeMax - profile.sizeMin) + Math.random() * 0.45
  return {
    x,
    y,
    vx: (dx / dist) * speed,
    vy: (dy / dist) * speed,
    life: maxLife,
    maxLife,
    size,
    color: bandColor(colors, profile),
    bandIndex,
    sinkX: sink.x,
    sinkY: sink.y,
    spawnDist: dist,
    pulsePhase: Math.random() * Math.PI * 2,
  }
}

/** Sin bandas reales: activa 1–2 bandas por tick, no las doce a la vez. */
function bandsFromLevel(level: number): number[] {
  const values = Array.from({ length: DICTATION_SPECTRUM_BAND_COUNT }, () => 0)
  const clamped = Math.min(1, Math.max(0, level))
  const primary = Math.floor(Math.random() * DICTATION_SPECTRUM_BAND_COUNT)
  values[primary] = clamped * (0.82 + Math.random() * 0.22)
  if (clamped > 0.04 && Math.random() < clamped * 0.55) {
    const offset = 1 + Math.floor(Math.random() * 2)
    const secondary = (primary + offset) % DICTATION_SPECTRUM_BAND_COUNT
    values[secondary] = clamped * (0.35 + Math.random() * 0.28)
  }
  return values
}

function effectiveBandValues(bands: number[], level: number): number[] {
  if (hasDictationBandEnergy(bands)) return bands
  if (level < DICTATION_LEVEL_SPAWN_THRESHOLD) {
    return Array.from({ length: DICTATION_SPECTRUM_BAND_COUNT }, () => 0)
  }
  return bandsFromLevel(level)
}

export function readDictationParticleColors(el: Element): string[] {
  const styles = getComputedStyle(el)
  const colors: string[] = []
  for (const name of BAND_COLOR_VARS) {
    const value = styles.getPropertyValue(name).trim()
    if (value) colors.push(value)
  }
  return colors.length > 0 ? colors : readAuroraThemeColors(el)
}

export function spawnDictationVoiceParticles(
  bands: number[],
  level: number,
  target: DictationMicTarget,
  colors: string[],
  particles: DictationMicParticle[],
): void {
  if (!hasDictationVoiceEnergy(bands, level)) return
  if (particles.length >= MAX_PARTICLES) return

  const values = effectiveBandValues(bands, level)
  for (let index = 0; index < DICTATION_SPECTRUM_BAND_COUNT; index += 1) {
    const value = values[index] ?? 0
    if (value < DICTATION_BAND_SPAWN_THRESHOLD) continue
    const spawnCount = value > 0.45 ? 2 : 1
    for (let n = 0; n < spawnCount; n += 1) {
      if (particles.length >= MAX_PARTICLES) return
      particles.push(spawnParticle(index, value, target, colors))
    }
  }
}

/** @deprecated Use spawnDictationVoiceParticles */
export const spawnDictationBandParticles = spawnDictationVoiceParticles

export function updateDictationMicParticles(
  particles: DictationMicParticle[],
  _mic: DictationMicTarget,
  dt: number,
): void {
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const particle = particles[i]!
    const profile = bandProfile(particle.bandIndex)
    particle.life -= dt
    const dx = particle.sinkX - particle.x
    const dy = particle.sinkY - particle.y
    const dist = Math.max(1, Math.hypot(dx, dy))
    const tierPull =
      profile.tier === 'bass' ? 130 : profile.tier === 'mid' ? 168 : 210
    const pull = tierPull + (1 - particle.life / particle.maxLife) * 220
    particle.vx += (dx / dist) * pull * dt
    particle.vy += (dy / dist) * pull * dt
    particle.vx *= profile.tier === 'treble' ? 0.978 : 0.984
    particle.vy *= profile.tier === 'treble' ? 0.978 : 0.984
    particle.x += particle.vx * dt
    particle.y += particle.vy * dt

    const absorb = profile.tier === 'bass' ? 18 : profile.tier === 'mid' ? 14 : 10
    if (particle.life <= 0 || dist < absorb) {
      particles.splice(i, 1)
    }
  }
}

export function drawDictationMicParticles(
  ctx: CanvasRenderingContext2D,
  particles: DictationMicParticle[],
  width: number,
  height: number,
): void {
  ctx.clearRect(0, 0, width, height)
  ctx.globalCompositeOperation = 'source-over'
  for (const particle of particles) {
    drawGravityFallParticle(ctx, particle)
  }
}

export function hasDictationBandEnergy(bands: number[]): boolean {
  return bands.some(value => value >= DICTATION_BAND_SPAWN_THRESHOLD)
}

export function hasDictationVoiceEnergy(bands: number[], level: number): boolean {
  return level >= DICTATION_LEVEL_SPAWN_THRESHOLD || hasDictationBandEnergy(bands)
}

export function spawnAngleForBand(bandIndex: number): number {
  return bandProfile(bandIndex).spawnAngle
}

export function sinkTargetForBand(bandIndex: number, mic: DictationMicTarget): DictationMicTarget {
  return bandSinkTarget(bandIndex, mic)
}
