import React, { useRef } from 'react'
import { dictationMicSpectrumBands } from './dictationMicButton'
import './DictationMicButton.css'

export const VIEW_W = 100
export const VIEW_H = 24
const MID_Y = VIEW_H / 2
const MAX_AMP = VIEW_H / 2 - 1
const POINT_COUNT = 40
const WAVE_CYCLES = 2.2
const SMOOTHING = 0.58

function bandAmplitude(value: number, level: number): number {
  const raw = Math.min(1, value * 2.05 + level * 0.22)
  const floor = 0.02 + level * 0.06
  const energy = floor + Math.pow(raw, 0.82) * (1 - floor)
  return energy * MAX_AMP
}

function interpolateBand(bands: number[], xNorm: number): number {
  const floatIndex = xNorm * (bands.length - 1)
  const i0 = Math.floor(floatIndex)
  const i1 = Math.min(bands.length - 1, i0 + 1)
  const t = floatIndex - i0
  return (bands[i0] ?? 0) * (1 - t) + (bands[i1] ?? 0) * t
}

function buildWavePoints(bands: number[], level: number): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = []
  for (let index = 0; index < POINT_COUNT; index += 1) {
    const xNorm = index / (POINT_COUNT - 1)
    const x = xNorm * VIEW_W
    const amp = bandAmplitude(interpolateBand(bands, xNorm), level)
    const phase = xNorm * Math.PI * 2 * WAVE_CYCLES
    points.push({ x, y: MID_Y - amp * Math.sin(phase) })
  }
  return points
}

function catmullRomPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return ''

  const extended = [points[0], ...points, points[points.length - 1]]
  let path = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`

  for (let index = 1; index < points.length; index += 1) {
    const p0 = extended[index - 1]
    const p1 = extended[index]
    const p2 = extended[index + 1]
    const p3 = extended[index + 2]
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6
    path += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)} ${cp2x.toFixed(2)} ${cp2y.toFixed(2)} ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`
  }

  return path
}

export function smoothSpectrumBands(
  current: number[],
  previous: number[],
  factor: number,
): number[] {
  return current.map((value, index) => {
    const prev = previous[index] ?? value
    return prev + (value - prev) * factor
  })
}

export function buildWavePath(bands: number[], level: number): string | null {
  if (bands.length === 0) return null
  return catmullRomPath(buildWavePoints(bands, level))
}

export interface DictationMicSpectrumProps {
  bands: number[]
  level: number
}

/** Una sola línea de onda centrada, borde a borde, suavizada al espectro. */
export const DictationMicSpectrum: React.FC<DictationMicSpectrumProps> = ({
  bands,
  level,
}) => {
  const smoothedRef = useRef<number[]>([])
  const clampedLevel = Math.min(1, Math.max(0, level))
  const spectrum = dictationMicSpectrumBands(bands, clampedLevel)
  const smoothed = smoothSpectrumBands(spectrum, smoothedRef.current, SMOOTHING)
  smoothedRef.current = smoothed
  const line = buildWavePath(smoothed, clampedLevel)

  if (!line) return null

  return (
    <span className="dictation-mic-btn__wave" aria-hidden="true">
      <svg
        className="dictation-mic-btn__wave-svg"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="none"
      >
        <path className="dictation-mic-btn__wave-line" d={line} vectorEffect="non-scaling-stroke" />
      </svg>
    </span>
  )
}
