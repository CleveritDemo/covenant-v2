import { describe, expect, it } from 'vitest'
import type { GitHubJob, GitHubJobStep } from '../githubActionsTypes'
import {
  durationSeconds,
  foldScaffoldSteps,
  formatDuration,
  isScaffoldStep,
  runTimeline,
  statusKind,
} from '../githubRunTimeline'

function step(
  number: number,
  name: string,
  startedAt: string | null,
  completedAt: string | null,
  conclusion: string | null = 'success',
): GitHubJobStep {
  return { number, name, status: completedAt ? 'completed' : 'in_progress', conclusion, startedAt, completedAt }
}

function job(name: string, startedAt: string | null, completedAt: string | null, steps: GitHubJobStep[] = []): GitHubJob {
  return {
    id: name.length,
    name,
    status: completedAt ? 'completed' : 'in_progress',
    conclusion: completedAt ? 'success' : null,
    startedAt,
    completedAt,
    url: '',
    steps,
  }
}

// Jobs reales del run de release de v0.4.0 (#31145544757).
const RELEASE_JOBS: GitHubJob[] = [
  job('macos', '2026-08-07T03:50:12Z', '2026-08-07T03:53:16Z'),
  job('windows', '2026-08-07T03:50:13Z', '2026-08-07T03:53:26Z'),
  job('linux', '2026-08-07T03:50:12Z', '2026-08-07T03:52:38Z'),
  job('cask', '2026-08-07T03:53:19Z', '2026-08-07T03:53:28Z'),
]

describe('isScaffoldStep', () => {
  it('reconoce los steps que GitHub añade a todos los jobs', () => {
    expect(isScaffoldStep('Set up job')).toBe(true)
    expect(isScaffoldStep('Complete job')).toBe(true)
    expect(isScaffoldStep('Post Run actions/checkout@v4')).toBe(true)
    expect(isScaffoldStep('Post Run actions/setup-node@v4')).toBe(true)
  })

  it('no confunde steps propios que empiezan parecido', () => {
    expect(isScaffoldStep('Run npm ci')).toBe(false)
    expect(isScaffoldStep('Build + sign + notarize + publish')).toBe(false)
    // «Postprocess» no es un step Post de GitHub: sin espacio detrás.
    expect(isScaffoldStep('Postprocess artifacts')).toBe(false)
  })
})

describe('formatDuration', () => {
  it('usa segundos por debajo del minuto y m+s por encima', () => {
    expect(formatDuration(0)).toBe('0s')
    expect(formatDuration(19)).toBe('19s')
    expect(formatDuration(59.4)).toBe('59s')
    expect(formatDuration(184)).toBe('3m4s')
    expect(formatDuration(120)).toBe('2m0s')
  })

  it('sin dato devuelve raya, no 0s', () => {
    expect(formatDuration(null)).toBe('—')
  })
})

describe('durationSeconds', () => {
  it('mide contra `now` mientras el step sigue corriendo', () => {
    const now = Date.parse('2026-08-07T03:51:12Z')
    expect(durationSeconds('2026-08-07T03:50:12Z', null, now)).toBe(60)
  })

  it('devuelve null si no ha arrancado', () => {
    expect(durationSeconds(null, null)).toBeNull()
  })

  it('nunca devuelve negativos aunque las marcas vengan cruzadas', () => {
    expect(durationSeconds('2026-08-07T03:53:00Z', '2026-08-07T03:50:00Z')).toBe(0)
  })
})

describe('runTimeline', () => {
  it('el reloj del run es menor que la suma de jobs cuando van en paralelo', () => {
    const t = runTimeline(RELEASE_JOBS)
    expect(Math.round(t.spanSeconds)).toBe(196)      // 3m16s de reloj
    expect(Math.round(t.totalJobSeconds)).toBe(532)  // 8m52s de trabajo
    expect(t.totalJobSeconds).toBeGreaterThan(t.spanSeconds)
  })

  it('los jobs que arrancan juntos empiezan en el mismo punto', () => {
    const [macos, windows, linux, cask] = runTimeline(RELEASE_JOBS).lanes
    expect(macos.offsetPct).toBe(0)
    expect(linux.offsetPct).toBe(0)
    expect(windows.offsetPct).toBeCloseTo(0.51, 1)
    // cask espera a los tres: arranca pasado el 95% del run.
    expect(cask.offsetPct).toBeGreaterThan(95)
  })

  it('ninguna barra se sale de la pista', () => {
    for (const lane of runTimeline(RELEASE_JOBS).lanes) {
      expect(lane.offsetPct + lane.widthPct).toBeLessThanOrEqual(100.01)
    }
  })

  it('un job de duración cero sigue siendo visible', () => {
    const t = runTimeline([
      job('largo', '2026-08-07T03:50:00Z', '2026-08-07T03:55:00Z'),
      job('instantáneo', '2026-08-07T03:50:00Z', '2026-08-07T03:50:00Z'),
    ])
    expect(t.lanes[1].widthPct).toBeGreaterThan(0)
  })

  it('un job en cola no rompe el cálculo', () => {
    const t = runTimeline([
      job('corriendo', '2026-08-07T03:50:00Z', '2026-08-07T03:51:00Z'),
      job('en cola', null, null),
    ])
    expect(t.lanes[1]).toMatchObject({ offsetPct: 0, widthPct: 0, seconds: null })
    expect(Math.round(t.spanSeconds)).toBe(60)
  })

  it('sin ningún job arrancado no divide por cero', () => {
    const t = runTimeline([job('a', null, null), job('b', null, null)])
    expect(t.spanSeconds).toBe(0)
    expect(t.lanes).toHaveLength(2)
  })
})

describe('foldScaffoldSteps', () => {
  // Los 11 steps reales del job macos.
  const MACOS: GitHubJobStep[] = [
    step(1, 'Set up job', '2026-08-07T03:50:12Z', '2026-08-07T03:50:12Z'),
    step(2, 'Run actions/checkout@v4', '2026-08-07T03:50:12Z', '2026-08-07T03:50:15Z'),
    step(3, 'Run actions/setup-node@v4', '2026-08-07T03:50:15Z', '2026-08-07T03:50:21Z'),
    step(4, 'Run npm ci', '2026-08-07T03:50:21Z', '2026-08-07T03:50:40Z'),
    step(5, 'Write notary API key', '2026-08-07T03:50:40Z', '2026-08-07T03:50:40Z'),
    step(6, 'Prepare release (notes + GitHub release)', '2026-08-07T03:50:40Z', '2026-08-07T03:50:41Z'),
    step(7, 'Build + sign + notarize + publish', '2026-08-07T03:50:41Z', '2026-08-07T03:53:06Z'),
    step(8, 'Verify signature and notarization', '2026-08-07T03:53:06Z', '2026-08-07T03:53:07Z'),
    step(15, 'Post Run actions/setup-node@v4', '2026-08-07T03:53:07Z', '2026-08-07T03:53:12Z'),
    step(16, 'Post Run actions/checkout@v4', '2026-08-07T03:53:12Z', '2026-08-07T03:53:12Z'),
    step(17, 'Complete job', '2026-08-07T03:53:12Z', '2026-08-07T03:53:13Z'),
  ]

  it('pliega el andamiaje: 11 steps quedan en 7', () => {
    const folded = foldScaffoldSteps(MACOS)
    expect(folded.visible).toHaveLength(7)
    expect(folded.foldedCount).toBe(4)
    expect(Math.round(folded.foldedSeconds)).toBe(6)
    expect(folded.visible.map(s => s.name)).not.toContain('Set up job')
  })

  it('expandido los muestra todos y no queda nada plegado', () => {
    const folded = foldScaffoldSteps(MACOS, { expanded: true })
    expect(folded.visible).toHaveLength(11)
    expect(folded.foldedCount).toBe(0)
  })

  it('si el andamiaje es lo que falló, no se esconde la causa', () => {
    const broken = MACOS.map(s =>
      s.name === 'Complete job' ? { ...s, conclusion: 'failure' } : s)
    const folded = foldScaffoldSteps(broken)
    expect(folded.visible).toHaveLength(11)
    expect(folded.foldedCount).toBe(0)
  })

  it('marca el step propio más lento', () => {
    expect(foldScaffoldSteps(MACOS).slowestName).toBe('Build + sign + notarize + publish')
  })

  it('el andamiaje nunca sale como el más lento', () => {
    const lento = [
      step(1, 'Set up job', '2026-08-07T03:50:00Z', '2026-08-07T03:55:00Z'),
      step(2, 'Run npm ci', '2026-08-07T03:55:00Z', '2026-08-07T03:55:20Z'),
    ]
    expect(foldScaffoldSteps(lento).slowestName).toBe('Run npm ci')
  })

  it('sin nada que destaque no resalta un step de 1s', () => {
    const rapido = [step(1, 'Run echo', '2026-08-07T03:50:00Z', '2026-08-07T03:50:01Z')]
    expect(foldScaffoldSteps(rapido).slowestName).toBeNull()
  })
})

describe('statusKind', () => {
  it('la conclusión manda sobre el status', () => {
    expect(statusKind('completed', 'success')).toBe('success')
    expect(statusKind('completed', 'failure')).toBe('failure')
    expect(statusKind('completed', 'timed_out')).toBe('failure')
    expect(statusKind('completed', 'cancelled')).toBe('cancelled')
    expect(statusKind('completed', 'skipped')).toBe('cancelled')
  })

  it('sin conclusión, en marcha o en cola cuentan como running', () => {
    expect(statusKind('in_progress', null)).toBe('running')
    expect(statusKind('queued', null)).toBe('running')
    expect(statusKind('completed', null)).toBe('neutral')
  })
})
