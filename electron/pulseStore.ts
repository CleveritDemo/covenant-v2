import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import {
  aggregatePulse,
  filterPulseEvents,
  pulseScopeOptions,
  PULSE_EVENT_KINDS,
  type PulseEvent,
  type PulseScope,
  type PulseSnapshot,
} from '../src/shared/pulseEvents'

/**
 * Bitácora local de Pulse: NDJSON append-only en userData. Un evento pesa ~150
 * bytes, así que un uso intenso (40 prompts/día) deja ~2 MB al año.
 *
 * ponytail: se lee el archivo entero al abrir el dashboard. Con esos volúmenes
 * sobra; si algún día molesta, el upgrade es un índice por día al final del
 * archivo, no una base de datos.
 */
const PULSE_FILE = (): string => join(app.getPath('userData'), 'pulse.ndjson')

/** Nunca lanza: la telemetría jamás debe romper un turno ni un commit. */
export function recordPulseEvent(event: PulseEvent): void {
  try {
    const path = PULSE_FILE()
    mkdirSync(app.getPath('userData'), { recursive: true })
    appendFileSync(path, `${JSON.stringify(event)}\n`, 'utf-8')
  } catch {
    /* ignorado a propósito */
  }
}

/**
 * Parsea el NDJSON descartando líneas ilegibles: un cierre abrupto de la app
 * puede dejar la última línea truncada, y eso no debe invalidar la bitácora.
 */
export function parsePulseLines(text: string): PulseEvent[] {
  const out: PulseEvent[] = []
  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    try {
      const parsed = JSON.parse(line) as Partial<PulseEvent>
      if (typeof parsed.ts !== 'number' || !Number.isFinite(parsed.ts)) continue
      if (!parsed.kind || !PULSE_EVENT_KINDS.includes(parsed.kind)) continue
      out.push(parsed as PulseEvent)
    } catch {
      continue
    }
  }
  return out
}

export function readPulseEvents(): PulseEvent[] {
  try {
    const path = PULSE_FILE()
    if (!existsSync(path)) return []
    return parsePulseLines(readFileSync(path, 'utf-8'))
  } catch {
    return []
  }
}

export function pulseSnapshot(scope: PulseScope = {}): PulseSnapshot {
  const all = readPulseEvents()
  return {
    ...aggregatePulse(filterPulseEvents(all, scope), Date.now()),
    scopes: pulseScopeOptions(all),
  }
}
