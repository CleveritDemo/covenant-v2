#!/usr/bin/env node
/**
 * Prototipo desechable: Pulse NDJSON → OTLP/HTTP JSON (métricas).
 *
 * Valida empíricamente el contrato OTLP del diseño Pulse↔OTEL. Sin deps nuevas
 * (Node `fetch` nativo). No es el exportador de producción.
 *
 * Uso:
 *   node covenant-v2/scripts/pulse-otlp-export.mjs --sample --dry-run
 *   node covenant-v2/scripts/pulse-otlp-export.mjs --file ~/Library/Application\ Support/Covenant\ Gravity/pulse.ndjson
 *   node covenant-v2/scripts/pulse-otlp-export.mjs --endpoint http://localhost:4318 --limit 500
 *   node covenant-v2/scripts/pulse-otlp-export.mjs --sample --endpoint http://localhost:4318
 *
 * Flags:
 *   --file <path>       NDJSON de Pulse (default: userData macOS de Covenant Gravity)
 *   --endpoint <url>    Base del collector OTLP/HTTP (default: http://localhost:4318)
 *   --dry-run           Imprime el ExportMetricsServiceRequest JSON y no POST
 *   --limit N           Solo las primeras N líneas parseables
 *   --sample            Ignora --file y fabrica eventos sintéticos (4 kinds)
 *
 * Métricas:
 *   gravity.pulse.turns           Counter  attrs: agent.id, agent.provider,
 *                                               permission_mode, via_loop
 *   gravity.pulse.tokens          Counter  attrs: direction=in|out
 *   gravity.pulse.turn.duration   Histogram (s) buckets explícitos para turnos
 *   gravity.pulse.commits         Counter
 *   gravity.pulse.delegations     Counter
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { homedir } from 'os'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const PULSE_EVENT_KINDS = ['prompt', 'commit', 'delegate', 'result']

/** Buckets en segundos: turnos de agente (segundos → horas). */
const DURATION_BOUNDS_S = [1, 2, 5, 10, 30, 60, 120, 300, 600, 1800, 3600]

const DEFAULT_FILE = join(
  homedir(),
  'Library',
  'Application Support',
  'Covenant Gravity',
  'pulse.ndjson',
)

const AGG_TEMPORALITY_CUMULATIVE = 2 // AGGREGATION_TEMPORALITY_CUMULATIVE

// ── CLI ──────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const out = {
    file: DEFAULT_FILE,
    endpoint: 'http://localhost:4318',
    dryRun: false,
    limit: null,
    sample: false,
    writeStats: null,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--dry-run') out.dryRun = true
    else if (a === '--sample') out.sample = true
    else if (a === '--file') out.file = argv[++i]
    else if (a === '--endpoint') out.endpoint = argv[++i]
    else if (a === '--limit') out.limit = Number(argv[++i])
    else if (a === '--write-stats') out.writeStats = argv[++i]
    else if (a === '--help' || a === '-h') {
      console.log(readFileSync(fileURLToPath(import.meta.url), 'utf-8').split('\n').slice(1, 28).join('\n'))
      process.exit(0)
    } else {
      console.error(`Flag desconocida: ${a}`)
      process.exit(2)
    }
  }
  if (out.limit != null && (!Number.isFinite(out.limit) || out.limit < 0)) {
    console.error('--limit debe ser un entero ≥ 0')
    process.exit(2)
  }
  return out
}

// ── Parseo tolerante (espejo de electron/pulseStore.ts#parsePulseLines) ──────

/**
 * Descarta líneas ilegibles; una última línea truncada no invalida la bitácora.
 */
function parsePulseLines(text) {
  const out = []
  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    try {
      const parsed = JSON.parse(line)
      if (typeof parsed.ts !== 'number' || !Number.isFinite(parsed.ts)) continue
      if (!parsed.kind || !PULSE_EVENT_KINDS.includes(parsed.kind)) continue
      out.push(parsed)
    } catch {
      continue
    }
  }
  return out
}

// ── Sample sintético ─────────────────────────────────────────────────────────

function sampleEvents() {
  const now = Date.now()
  const ago = (ms) => now - ms
  return [
    // Evento viejo sin permissionMode (bitácoras antiguas).
    {
      ts: ago(86_400_000 * 3),
      kind: 'prompt',
      agentId: 'dev',
      agentName: 'Dev',
      provider: 'codex',
      tokensIn: 12_000,
      tokensOut: 800,
      durationMs: 45_000,
      viaLoop: false,
      repo: 'demo-repo',
    },
    {
      ts: ago(86_400_000 * 2),
      kind: 'prompt',
      agentId: 'tl',
      agentName: 'TL',
      provider: 'claude',
      permissionMode: 'ask',
      tokensIn: 40_000,
      tokensOut: 2_100,
      durationMs: 120_000,
      viaLoop: true,
      repo: 'demo-repo',
    },
    {
      ts: ago(86_400_000),
      kind: 'prompt',
      agentId: 'po',
      provider: 'cursor',
      permissionMode: 'plan',
      tokensIn: 8_000,
      tokensOut: 400,
      durationMs: 8_500,
      viaLoop: false,
    },
    {
      ts: ago(3_600_000),
      kind: 'prompt',
      agentId: 'dev',
      provider: 'copilot',
      permissionMode: 'auto',
      tokensIn: 22_000,
      tokensOut: 1_500,
      durationMs: 3_200,
      viaLoop: false,
    },
    {
      ts: ago(2_700_000),
      kind: 'commit',
      agentId: 'dev',
      repo: 'demo-repo',
      branch: 'feat/pulse-otlp',
    },
    {
      ts: ago(2_400_000),
      kind: 'commit',
      // Commit del panel Git: sin agentId (persona).
      repo: 'demo-repo',
      branch: 'feat/pulse-otlp',
    },
    {
      ts: ago(1_800_000),
      kind: 'delegate',
      agentId: 'tl',
      toAgentId: 'dev',
      provider: 'claude',
    },
    {
      ts: ago(1_700_000),
      kind: 'delegate',
      agentId: 'po',
      toAgentId: 'qa',
    },
    {
      ts: ago(900_000),
      kind: 'result',
      agentId: 'dev',
      repo: 'demo-repo',
    },
    {
      ts: ago(60_000),
      kind: 'prompt',
      agentId: 'qa',
      provider: 'claude',
      permissionMode: 'ask',
      tokensIn: 5_000,
      tokensOut: 200,
      durationMs: 720_000, // 12 min → bucket alto
      viaLoop: true,
    },
  ]
}

// ── OTLP helpers ─────────────────────────────────────────────────────────────

function nanoStr(ms) {
  // int64 como string (proto JSON): ms → ns
  return String(BigInt(Math.trunc(ms)) * 1_000_000n)
}

function attrString(key, value) {
  return { key, value: { stringValue: String(value) } }
}

function attrBool(key, value) {
  return { key, value: { boolValue: Boolean(value) } }
}

function attrInt(key, value) {
  return { key, value: { intValue: String(BigInt(Math.trunc(value))) } }
}

function permissionModeOf(event) {
  const m = event.permissionMode
  if (m === 'ask' || m === 'plan' || m === 'auto') return m
  return 'other'
}

function seriesKey(parts) {
  return parts.join('\0')
}

// ── Agregación → data points ─────────────────────────────────────────────────

function aggregate(events) {
  /** @type {Map<string, {attrs: object[], count: number, startMs: number, endMs: number}>} */
  const turns = new Map()
  /** @type {Map<string, {attrs: object[], count: number, startMs: number, endMs: number}>} */
  const tokens = new Map()
  /** @type {{count: number, sum: number, bucketCounts: number[], startMs: number, endMs: number, attrs: object[]}} */
  const duration = {
    count: 0,
    sum: 0,
    bucketCounts: new Array(DURATION_BOUNDS_S.length + 1).fill(0),
    startMs: Infinity,
    endMs: 0,
    attrs: [],
  }
  let commits = { count: 0, startMs: Infinity, endMs: 0 }
  let delegations = { count: 0, startMs: Infinity, endMs: 0 }

  const bumpCounter = (map, key, attrs, ts, n = 1) => {
    let row = map.get(key)
    if (!row) {
      row = { attrs, count: 0, startMs: ts, endMs: ts }
      map.set(key, row)
    }
    row.count += n
    if (ts < row.startMs) row.startMs = ts
    if (ts > row.endMs) row.endMs = ts
  }

  const observeDuration = (seconds, ts) => {
    duration.count++
    duration.sum += seconds
    if (ts < duration.startMs) duration.startMs = ts
    if (ts > duration.endMs) duration.endMs = ts
    let placed = false
    for (let i = 0; i < DURATION_BOUNDS_S.length; i++) {
      if (seconds <= DURATION_BOUNDS_S[i]) {
        duration.bucketCounts[i]++
        placed = true
        break
      }
    }
    if (!placed) duration.bucketCounts[DURATION_BOUNDS_S.length]++
  }

  for (const e of events) {
    if (e.kind === 'prompt') {
      const agentId = e.agentId ?? 'unknown'
      const provider = e.provider ?? 'unknown'
      const mode = permissionModeOf(e)
      const viaLoop = Boolean(e.viaLoop)
      const tAttrs = [
        attrString('agent.id', agentId),
        attrString('agent.provider', provider),
        attrString('permission_mode', mode),
        attrBool('via_loop', viaLoop),
      ]
      bumpCounter(turns, seriesKey([agentId, provider, mode, String(viaLoop)]), tAttrs, e.ts)

      if (typeof e.tokensIn === 'number' && e.tokensIn > 0) {
        bumpCounter(
          tokens,
          'in',
          [attrString('direction', 'in')],
          e.ts,
          Math.trunc(e.tokensIn),
        )
      }
      if (typeof e.tokensOut === 'number' && e.tokensOut > 0) {
        bumpCounter(
          tokens,
          'out',
          [attrString('direction', 'out')],
          e.ts,
          Math.trunc(e.tokensOut),
        )
      }
      if (typeof e.durationMs === 'number' && e.durationMs >= 0) {
        observeDuration(e.durationMs / 1000, e.ts)
      }
    } else if (e.kind === 'commit') {
      commits.count++
      if (e.ts < commits.startMs) commits.startMs = e.ts
      if (e.ts > commits.endMs) commits.endMs = e.ts
    } else if (e.kind === 'delegate') {
      delegations.count++
      if (e.ts < delegations.startMs) delegations.startMs = e.ts
      if (e.ts > delegations.endMs) delegations.endMs = e.ts
    }
    // `result` no emite métrica propia en este prototipo (diseño mínimo).
  }

  return { turns, tokens, duration, commits, delegations }
}

function sumDataPoint(row, nowMs) {
  const start = Number.isFinite(row.startMs) ? row.startMs : nowMs
  const end = row.endMs || nowMs
  return {
    attributes: row.attrs ?? [],
    startTimeUnixNano: nanoStr(start),
    timeUnixNano: nanoStr(end),
    asInt: String(BigInt(Math.trunc(row.count))),
  }
}

function buildExportRequest(agg, nowMs) {
  const metrics = []

  const turnPoints = [...agg.turns.values()].map((row) => sumDataPoint(row, nowMs))
  if (turnPoints.length) {
    metrics.push({
      name: 'gravity.pulse.turns',
      description: 'Pulse agent turns (prompt events)',
      unit: '{turn}',
      sum: {
        dataPoints: turnPoints,
        aggregationTemporality: AGG_TEMPORALITY_CUMULATIVE,
        isMonotonic: true,
      },
    })
  }

  const tokenPoints = [...agg.tokens.values()].map((row) => sumDataPoint(row, nowMs))
  if (tokenPoints.length) {
    metrics.push({
      name: 'gravity.pulse.tokens',
      description: 'Pulse tokens in/out from prompt events',
      unit: '{token}',
      sum: {
        dataPoints: tokenPoints,
        aggregationTemporality: AGG_TEMPORALITY_CUMULATIVE,
        isMonotonic: true,
      },
    })
  }

  if (agg.duration.count > 0) {
    const start = Number.isFinite(agg.duration.startMs) ? agg.duration.startMs : nowMs
    metrics.push({
      name: 'gravity.pulse.turn.duration',
      description: 'Pulse turn wall-clock duration',
      unit: 's',
      histogram: {
        dataPoints: [
          {
            attributes: agg.duration.attrs,
            startTimeUnixNano: nanoStr(start),
            timeUnixNano: nanoStr(agg.duration.endMs || nowMs),
            count: String(BigInt(agg.duration.count)),
            sum: agg.duration.sum,
            bucketCounts: agg.duration.bucketCounts.map((c) => String(BigInt(c))),
            explicitBounds: DURATION_BOUNDS_S,
          },
        ],
        aggregationTemporality: AGG_TEMPORALITY_CUMULATIVE,
      },
    })
  }

  if (agg.commits.count > 0) {
    metrics.push({
      name: 'gravity.pulse.commits',
      description: 'Pulse commit events',
      unit: '{commit}',
      sum: {
        dataPoints: [sumDataPoint({ ...agg.commits, attrs: [] }, nowMs)],
        aggregationTemporality: AGG_TEMPORALITY_CUMULATIVE,
        isMonotonic: true,
      },
    })
  }

  if (agg.delegations.count > 0) {
    metrics.push({
      name: 'gravity.pulse.delegations',
      description: 'Pulse delegate events',
      unit: '{delegation}',
      sum: {
        dataPoints: [sumDataPoint({ ...agg.delegations, attrs: [] }, nowMs)],
        aggregationTemporality: AGG_TEMPORALITY_CUMULATIVE,
        isMonotonic: true,
      },
    })
  }

  return {
    resourceMetrics: [
      {
        resource: {
          attributes: [
            attrString('service.name', 'covenant-gravity-pulse'),
            attrString('telemetry.sdk.language', 'nodejs'),
            attrString('telemetry.sdk.name', 'pulse-otlp-export-prototype'),
          ],
        },
        scopeMetrics: [
          {
            scope: {
              name: 'gravity.pulse',
              version: '0.0.0-prototype',
            },
            metrics,
          },
        ],
      },
    ],
  }
}

function cardinalityReport(agg) {
  return {
    'gravity.pulse.turns': agg.turns.size,
    'gravity.pulse.tokens': agg.tokens.size,
    'gravity.pulse.turn.duration': agg.duration.count > 0 ? 1 : 0,
    'gravity.pulse.commits': agg.commits.count > 0 ? 1 : 0,
    'gravity.pulse.delegations': agg.delegations.count > 0 ? 1 : 0,
  }
}

function seriesCount(body) {
  let n = 0
  for (const rm of body.resourceMetrics ?? []) {
    for (const sm of rm.scopeMetrics ?? []) {
      for (const m of sm.metrics ?? []) {
        const points =
          m.sum?.dataPoints?.length ??
          m.histogram?.dataPoints?.length ??
          m.gauge?.dataPoints?.length ??
          0
        n += points
      }
    }
  }
  return n
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const nowMs = Date.now()

  let events
  if (args.sample) {
    events = sampleEvents()
  } else {
    if (!existsSync(args.file)) {
      console.error(`No existe el NDJSON: ${args.file}`)
      console.error('Usa --sample para fabricar eventos sintéticos.')
      process.exit(1)
    }
    events = parsePulseLines(readFileSync(args.file, 'utf-8'))
  }

  if (args.limit != null) events = events.slice(0, args.limit)

  const agg = aggregate(events)
  const body = buildExportRequest(agg, nowMs)
  const card = cardinalityReport(agg)
  const series = seriesCount(body)

  const stats = {
    events: events.length,
    series,
    cardinality: card,
    metricNames: (body.resourceMetrics?.[0]?.scopeMetrics?.[0]?.metrics ?? []).map((m) => m.name),
  }

  if (args.writeStats) {
    mkdirSync(dirname(args.writeStats), { recursive: true })
    writeFileSync(args.writeStats, JSON.stringify(stats, null, 2))
  }

  if (args.dryRun) {
    process.stdout.write(JSON.stringify(body, null, 2) + '\n')
    console.error(
      `# dry-run: events=${events.length} series=${series} cardinality=${JSON.stringify(card)}`,
    )
    return
  }

  const url = `${args.endpoint.replace(/\/$/, '')}/v1/metrics`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const text = await res.text().catch(() => '')
  console.log(
    JSON.stringify(
      {
        httpStatus: res.status,
        ok: res.ok,
        url,
        events: events.length,
        series,
        cardinality: card,
        metricNames: stats.metricNames,
        responseBody: text.slice(0, 500),
      },
      null,
      2,
    ),
  )
  if (!res.ok) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
