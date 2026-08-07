/**
 * Cálculo del detalle de un run: duraciones, posición de cada job en el tiempo y
 * plegado del andamiaje.
 *
 * Todo puro: el componente sólo pinta lo que sale de aquí.
 */
import type { GitHubJob, GitHubJobStep } from './githubActionsTypes'

/**
 * Steps que GitHub añade a todos los jobs. Son la mitad de la lista y nunca se
 * leen si pasan, así que se pliegan salvo que alguno falle.
 */
export function isScaffoldStep(name: string): boolean {
  return /^(Set up job|Complete job|Post\s)/.test(name.trim())
}

/** Segundos entre dos marcas ISO. `null` si no se puede saber todavía. */
export function durationSeconds(
  startedAt: string | null,
  completedAt: string | null,
  now = Date.now(),
): number | null {
  if (!startedAt) return null
  const start = Date.parse(startedAt)
  if (Number.isNaN(start)) return null
  const end = completedAt ? Date.parse(completedAt) : now
  if (Number.isNaN(end)) return null
  return Math.max(0, (end - start) / 1000)
}

/** `3m4s`, `19s`, `0s`. `—` cuando no hay dato. */
export function formatDuration(seconds: number | null): string {
  if (seconds === null) return '—'
  const total = Math.round(seconds)
  if (total < 60) return `${total}s`
  const minutes = Math.floor(total / 60)
  return `${minutes}m${total - minutes * 60}s`
}

export interface FoldedSteps {
  /** Lo que se pinta, en orden. */
  visible: GitHubJobStep[]
  /** Cuántos steps de andamiaje quedaron plegados; 0 = no hay nada que desplegar. */
  foldedCount: number
  /** Suma de los plegados, para la línea del grupo. */
  foldedSeconds: number
  /** Step no-andamiaje más lento, para resaltarlo. `null` si ninguno destaca. */
  slowestName: string | null
}

/** Un step por debajo de esto no merece resaltarse como «el lento». */
const SLOWEST_MIN_SECONDS = 5

export function foldScaffoldSteps(
  steps: GitHubJobStep[],
  options: { expanded?: boolean; now?: number } = {},
): FoldedSteps {
  const now = options.now ?? Date.now()
  const scaffold = steps.filter(step => isScaffoldStep(step.name))
  const real = steps.filter(step => !isScaffoldStep(step.name))

  // Si el andamiaje es lo que falló, esconderlo sería esconder la causa.
  const scaffoldFailed = scaffold.some(step => step.conclusion === 'failure')
  const show = Boolean(options.expanded) || scaffoldFailed

  let slowestName: string | null = null
  let slowestSeconds = SLOWEST_MIN_SECONDS
  for (const step of real) {
    const seconds = durationSeconds(step.startedAt, step.completedAt, now)
    if (seconds !== null && seconds > slowestSeconds) {
      slowestSeconds = seconds
      slowestName = step.name
    }
  }

  return {
    visible: show ? steps : real,
    foldedCount: show ? 0 : scaffold.length,
    foldedSeconds: show
      ? 0
      : scaffold.reduce((sum, s) => sum + (durationSeconds(s.startedAt, s.completedAt, now) ?? 0), 0),
    slowestName,
  }
}

export interface JobLane {
  job: GitHubJob
  /** % desde el inicio del run hasta que arrancó este job. */
  offsetPct: number
  /** % del ancho total que ocupa. Nunca 0, para que un job de 0s se vea. */
  widthPct: number
  seconds: number | null
}

export interface RunTimeline {
  /** Reloj de pared del run entero. */
  spanSeconds: number
  /** Suma de los jobs: mayor que `spanSeconds` cuando corren en paralelo. */
  totalJobSeconds: number
  lanes: JobLane[]
}

/**
 * Coloca cada job en la línea de tiempo del run. La diferencia entre
 * `spanSeconds` y `totalJobSeconds` es exactamente lo que se gana en paralelo.
 */
export function runTimeline(jobs: GitHubJob[], now = Date.now()): RunTimeline {
  const started = jobs
    .map(job => (job.startedAt ? Date.parse(job.startedAt) : NaN))
    .filter(value => !Number.isNaN(value))

  if (started.length === 0) {
    return {
      spanSeconds: 0,
      totalJobSeconds: 0,
      lanes: jobs.map(job => ({ job, offsetPct: 0, widthPct: 0, seconds: null })),
    }
  }

  const first = Math.min(...started)
  const last = Math.max(
    ...jobs.map(job => {
      if (job.completedAt) {
        const end = Date.parse(job.completedAt)
        return Number.isNaN(end) ? first : end
      }
      return job.startedAt ? now : first
    }),
  )
  const spanMs = Math.max(1, last - first)

  let totalJobSeconds = 0
  const lanes = jobs.map(job => {
    const seconds = durationSeconds(job.startedAt, job.completedAt, now)
    if (seconds !== null) totalJobSeconds += seconds
    if (!job.startedAt) return { job, offsetPct: 0, widthPct: 0, seconds }

    const start = Date.parse(job.startedAt)
    const offsetPct = Number.isNaN(start) ? 0 : ((start - first) / spanMs) * 100
    const widthPct = Math.max(1.5, ((seconds ?? 0) * 1000 / spanMs) * 100)
    return {
      job,
      offsetPct,
      // Un job largo que arranca tarde no debe desbordar la pista.
      widthPct: Math.min(widthPct, 100 - offsetPct),
      seconds,
    }
  })

  return { spanSeconds: spanMs / 1000, totalJobSeconds, lanes }
}

export type RunStatusKind = 'success' | 'failure' | 'cancelled' | 'running' | 'neutral'

/** Mismo criterio para runs, jobs y steps: conclusion manda, status desempata. */
export function statusKind(status: string, conclusion: string | null): RunStatusKind {
  const c = (conclusion ?? '').toLowerCase()
  if (c === 'success') return 'success'
  if (c === 'failure' || c === 'timed_out') return 'failure'
  if (c === 'cancelled' || c === 'skipped') return 'cancelled'
  const s = (status ?? '').toLowerCase()
  if (s === 'in_progress' || s === 'queued' || s === 'waiting' || s === 'pending') return 'running'
  return 'neutral'
}
