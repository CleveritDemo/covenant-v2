import React, { useEffect, useMemo, useState } from 'react'
import { useT } from '@i18n/useT'
import {
  dayFromMs,
  heatmapGrid,
  intensityLevels,
  levelFor,
  shiftDay,
  PERSONAL_SCOPE,
  type PulseAgentStat,
  type PulseSnapshot,
} from '@shared/pulseEvents'
import { foldPulseReplicas, type PulseAgentGroup } from '@shared/pulseReplicas'
import type { OrgWorkspaceCatalogMap } from '@shared/orgWorkspaceCatalog'
import { findOrgWorkspaceCatalogEntryInMap, parseOrgWorkspaceCatalogMap } from '@shared/orgWorkspaceCatalog'
import { pulseWorkspaceLabel } from '@shared/pulseWorkspaceLabels'
import { relativeTime } from '@shared/relativeTime'
import { APP_OVERLAY_MODAL_Z } from '@shared/overlayZIndex'
import { Icon } from '../components/ui/Icon'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import { Select } from '../components/ui/Select'
import { Tooltip } from '../components/ui/Tooltip'
import './PulseView.css'

export interface PulseViewProps {
  open: boolean
  active?: boolean
  onClose: () => void
}

type Metric = 'prompts' | 'commits' | 'both'
type Range = '30d' | '90d' | 'all'

const ALL = ''

const METRICS = [
  { id: 'prompts', labelKey: 'pulse.metric_prompts' },
  { id: 'commits', labelKey: 'pulse.metric_commits' },
  { id: 'both', labelKey: 'pulse.metric_both' },
] as const satisfies ReadonlyArray<{ id: Metric; labelKey: string }>

/** Días y semanas de heatmap por rango: 12 meses solo tiene sentido en `all`. */
const RANGES = {
  '30d': { days: 30, weeks: 6, titleKey: 'pulse.activity_30d' },
  '90d': { days: 90, weeks: 14, titleKey: 'pulse.activity_90d' },
  all: { days: 0, weeks: 53, titleKey: 'pulse.activity' },
} as const satisfies Record<Range, { days: number; weeks: number; titleKey: string }>

function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(Math.round(value))
}

/**
 * Los tokens llegan a cientos de millones y el número exacto desborda la
 * tarjeta. Por encima del millón se abrevia (52M) y el exacto vive en el
 * tooltip; por debajo se muestra entero, que es lo que se quiere leer.
 */
const COMPACT_FROM = 1_000_000

function formatStat(value: number): string {
  const n = Math.round(value)
  if (n < COMPACT_FROM) return formatNumber(n)
  return new Intl.NumberFormat(undefined, {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n)
}

/** Variación de hoy contra la media de 30 días, en % redondeado. */
function todayDelta(snapshot: PulseSnapshot): number | null {
  if (snapshot.avgPrompts30d <= 0) return null
  return Math.round(((snapshot.todayPrompts - snapshot.avgPrompts30d) / snapshot.avgPrompts30d) * 100)
}

/** Duración de un turno: minutos y segundos, que es la escala real (1m 52s). */
function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return m > 0 ? `${m}m ${String(s).padStart(2, '0')}s` : `${s}s`
}

/** Reparto porcentual de los modos, redondeado a 100 para que la barra cierre. */
function modeShares(modes: PulseAgentStat['modes']): { ask: number; plan: number; auto: number; other: number } {
  const total = modes.ask + modes.plan + modes.auto + modes.other
  if (total === 0) return { ask: 0, plan: 0, auto: 0, other: 0 }
  const ask = Math.round((modes.ask / total) * 100)
  const plan = Math.round((modes.plan / total) * 100)
  const auto = Math.round((modes.auto / total) * 100)
  return { ask, plan, auto, other: Math.max(0, 100 - ask - plan - auto) }
}

const SPARK_W = 96
const SPARK_H = 26

/** Sparkline de turnos/día: área + línea + punto en el último día. */
const Sparkline: React.FC<{ series: number[]; label: string }> = ({ series, label }) => {
  const max = Math.max(...series, 1)
  const step = SPARK_W / Math.max(1, series.length - 1)
  const points = series.map((v, i) => [i * step, SPARK_H - 2 - (v / max) * (SPARK_H - 5)] as const)
  const line = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const last = points[points.length - 1]
  return (
    <svg
      className="pulse-agent__spark"
      viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
    >
      <polygon className="pulse-agent__spark-area" points={`${line} ${SPARK_W},${SPARK_H} 0,${SPARK_H}`} />
      <polyline className="pulse-agent__spark-line" points={line} />
      {last ? <circle className="pulse-agent__spark-dot" cx={last[0]} cy={last[1]} r={2} /> : null}
    </svg>
  )
}

const AgentRow: React.FC<{ group: PulseAgentGroup; nowMs: number; defaultOpen: boolean }> = ({
  group,
  nowMs,
  defaultOpen,
}) => {
  const { t } = useT()
  const [open, setOpen] = useState(defaultOpen)
  const { base: agent, instances, peakSameDay, emptyReplicas } = group
  const shares = modeShares(agent.modes)
  const perDay = agent.activeDays > 0 ? agent.turns / agent.activeDays : 0

  return (
    <div
      className={[
        'pulse-agent',
        open ? 'pulse-agent--open' : '',
        // Único acento nuevo de la lista: señala capacidad abierta al pedo.
        emptyReplicas > 0 ? 'pulse-agent--waste' : '',
      ].filter(Boolean).join(' ')}
    >
      <button
        type="button"
        className="pulse-agent__row"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
      >
        <span className="pulse-agent__id">
          <span className="pulse-agent__name">
            {agent.name || agent.agentId}
            {agent.provider ? <span className="pulse-agent__chip">{agent.provider}</span> : null}
            {peakSameDay > 1 ? (
              <span
                className="pulse-agent__chip pulse-agent__chip--fan"
                aria-label={t('pulse.agent_fanOut', { n: peakSameDay })}
              >
                ×{peakSameDay}
              </span>
            ) : null}
          </span>
          <span className="pulse-agent__meta">
            {[agent.name ? agent.agentId : '', agent.lastTs > 0 ? relativeTime(agent.lastTs, nowMs) : '']
              .filter(Boolean)
              .join(' · ')}
          </span>
        </span>

        <span className="pulse-agent__num">
          {formatStat(agent.turns)}
          <small>{t('pulse.agent_turns')}</small>
        </span>

        <span className="pulse-agent__num">
          {formatStat(agent.tokens)}
          <small>{t('pulse.agent_tokens')}</small>
        </span>

        {/* Los turnos previos a la instrumentación no traen modo: mostrar tres
            ceros haría leer como bug lo que en realidad es falta de dato. */}
        {shares.other === 100 ? (
          <span className="pulse-agent__auto pulse-agent__auto--empty">{t('pulse.agent_noModes')}</span>
        ) : (
        <span className="pulse-agent__auto">
          <span
            className="pulse-agent__bar"
            role="img"
            aria-label={t('pulse.agent_autonomy', shares)}
          >
            {(['ask', 'plan', 'auto', 'other'] as const).map(mode => (
              <span
                key={mode}
                className={`pulse-agent__bar-seg pulse-agent__bar-seg--${mode}`}
                style={{ width: `${shares[mode]}%` }}
              />
            ))}
          </span>
          <span className="pulse-agent__bar-key">
            <span>
              <i className="pulse-agent__bar-seg--ask" />
              {t('pulse.mode_ask')} {shares.ask}%
            </span>
            <span>
              <i className="pulse-agent__bar-seg--plan" />
              {t('pulse.mode_plan')} {shares.plan}%
            </span>
            <span>
              <i className="pulse-agent__bar-seg--auto" />
              {t('pulse.mode_auto')} {shares.auto}%
            </span>
          </span>
        </span>
        )}

        <Sparkline series={agent.series} label={t('pulse.agent_sparkline')} />

        <span className="pulse-agent__num">
          {perDay.toFixed(1)}
          <small>{t('pulse.agent_perDay')}</small>
        </span>

        <span className="pulse-agent__caret" aria-hidden="true">
          ›
        </span>
      </button>

      {open ? (
        <div className="pulse-agent__detail">
          <div className="pulse-agent__kv">
            <span className="pulse-agent__kv-title">{t('pulse.agent_modes')}</span>
            <dl className="pulse-agent__list">
              <dt>{t('pulse.mode_ask')}</dt>
              <dd>{formatNumber(agent.modes.ask)}</dd>
              <dt>{t('pulse.mode_plan')}</dt>
              <dd>{formatNumber(agent.modes.plan)}</dd>
              <dt>{t('pulse.mode_auto')}</dt>
              <dd>{formatNumber(agent.modes.auto)}</dd>
              {agent.modes.other > 0 ? (
                <>
                  <dt>{t('pulse.mode_other')}</dt>
                  <dd>{formatNumber(agent.modes.other)}</dd>
                </>
              ) : null}
            </dl>
          </div>
          <div className="pulse-agent__kv">
            <span className="pulse-agent__kv-title">{t('pulse.agent_orchestration')}</span>
            <dl className="pulse-agent__list">
              <dt>{t('pulse.agent_delegationsOut')}</dt>
              <dd>{formatNumber(agent.delegationsOut)}</dd>
              <dt>{t('pulse.agent_delegationsIn')}</dt>
              <dd>{formatNumber(agent.delegationsIn)}</dd>
              <dt>{t('pulse.agent_results')}</dt>
              <dd>{formatNumber(agent.results)}</dd>
            </dl>
          </div>
          {instances.length > 1 ? (
            <div className="pulse-agent__kv pulse-agent__kv--instances">
              <span className="pulse-agent__kv-title">{t('pulse.agent_instances')}</span>
              <div className="pulse-agent__instances">
                <span className="pulse-agent__instances-head">{t('pulse.agent_instance')}</span>
                <span className="pulse-agent__instances-head">{t('pulse.agent_turns')}</span>
                <span className="pulse-agent__instances-head">{t('pulse.agent_tokens')}</span>
                {instances.map((instance, index) => (
                  <React.Fragment key={instance.agentId}>
                    <span>
                      {instance.agentId}
                      {index === 0 ? (
                        <span className="pulse-agent__instance-tag">
                          {t('pulse.agent_instanceBase')}
                        </span>
                      ) : null}
                    </span>
                    <span>{formatStat(instance.turns)}</span>
                    <span>{formatStat(instance.tokens)}</span>
                  </React.Fragment>
                ))}
              </div>
            </div>
          ) : null}
          <div className="pulse-agent__kv">
            <span className="pulse-agent__kv-title">{t('pulse.agent_repos')}</span>
            <dl className="pulse-agent__list">
              {agent.repos.map(({ repo, turns }) => (
                <React.Fragment key={repo}>
                  <dt>{repo}</dt>
                  <dd>{formatNumber(turns)}</dd>
                </React.Fragment>
              ))}
            </dl>
          </div>
          <div className="pulse-agent__kv">
            <span className="pulse-agent__kv-title">{t('pulse.agent_work')}</span>
            <dl className="pulse-agent__list">
              <dt>{t('pulse.agent_activeDays')}</dt>
              <dd>{formatNumber(agent.activeDays)}</dd>
              <dt>{t('pulse.tokensPerTurn')}</dt>
              <dd>{formatStat(agent.turns > 0 ? agent.tokens / agent.turns : 0)}</dd>
              <dt>{t('pulse.agent_commits')}</dt>
              <dd>{formatNumber(agent.commits)}</dd>
              <dt>{t('pulse.agent_loopTurns')}</dt>
              <dd>{formatNumber(agent.loopTurns)}</dd>
              <dt>{t('pulse.agent_avgDuration')}</dt>
              <dd>{agent.avgDurationMs > 0 ? formatDuration(agent.avgDurationMs) : '—'}</dd>
              <dt>{t('pulse.agent_lastTurn')}</dt>
              <dd>{agent.lastTs > 0 ? dayFromMs(agent.lastTs) : '—'}</dd>
            </dl>
          </div>
        </div>
      ) : null}
    </div>
  )
}

/** Dashboard local de uso: la cadencia humana arriba, la flota de agentes abajo. */
export const PulseView: React.FC<PulseViewProps> = ({ open, active = true, onClose }) => {
  const { t } = useT()
  const [snapshot, setSnapshot] = useState<PulseSnapshot | null>(null)
  const [metric, setMetric] = useState<Metric>('both')
  const [range, setRange] = useState<Range>('all')
  const [workspace, setWorkspace] = useState(ALL)
  const [repo, setRepo] = useState(ALL)
  const [orgCatalogMap, setOrgCatalogMap] = useState<OrgWorkspaceCatalogMap | null>(null)

  // Escape cierra la vista — salvo que haya un modal portaled encima
  // (confirmaciones, pickers): ese Escape es del modal.
  useEffect(() => {
    if (!open || !active) return
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      if (document.querySelector('.terminal-modal-root')) return
      event.preventDefault()
      onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, active, onClose])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const days = RANGES[range].days
    void window.api
      .pulseSnapshot({
        ...(workspace ? { workspace } : {}),
        ...(repo ? { repo } : {}),
        ...(days ? { sinceDay: shiftDay(dayFromMs(Date.now()), -(days - 1)) } : {}),
      })
      .then(next => {
        if (!cancelled) setSnapshot(next)
      })
      .catch(() => {
        if (!cancelled) setSnapshot(null)
      })
    return () => {
      cancelled = true
    }
  }, [open, range, workspace, repo])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void window.api
      .getConfig()
      .then(cfg => {
        if (!cancelled) setOrgCatalogMap(parseOrgWorkspaceCatalogMap(cfg.orgWorkspaceCatalogCache))
      })
      .catch(() => {
        if (!cancelled) setOrgCatalogMap(null)
      })
    return () => {
      cancelled = true
    }
  }, [open])

  const grid = useMemo(
    () => heatmapGrid(snapshot?.days ?? [], dayFromMs(Date.now()), RANGES[range].weeks),
    [snapshot, range],
  )

  const valueOf = useMemo(() => {
    if (metric === 'prompts') return (c: { prompts: number; commits: number }) => c.prompts
    if (metric === 'commits') return (c: { prompts: number; commits: number }) => c.commits
    return (c: { prompts: number; commits: number }) => c.prompts + c.commits
  }, [metric])

  const thresholds = useMemo(
    () => intensityLevels(grid.flat().map(valueOf)),
    [grid, valueOf],
  )

  const workspaceOptions = useMemo(() => {
    const scopes = snapshot?.scopes
    const tags = scopes?.workspaces ?? []
    return [
      { value: ALL, label: t('pulse.scope_all') },
      ...tags.map(w => {
        const slash = w.indexOf('/')
        const entry = slash > 0 && slash < w.length - 1
          ? findOrgWorkspaceCatalogEntryInMap(
            orgCatalogMap,
            w.slice(0, slash),
            w.slice(slash + 1),
          )
          : undefined
        const label = entry
          ? `${entry.slug}/${entry.name}`
          : pulseWorkspaceLabel(w, null, tags)
        return { value: w, label }
      }),
      ...(scopes?.hasPersonal ? [{ value: PERSONAL_SCOPE, label: t('pulse.scope_personal') }] : []),
    ]
  }, [snapshot, orgCatalogMap, t])

  const repoOptions = useMemo(
    () => [
      { value: ALL, label: t('pulse.scope_all') },
      ...(snapshot?.scopes.repos ?? []).map(r => ({ value: r, label: r })),
    ],
    [snapshot, t],
  )

  const delta = snapshot ? todayDelta(snapshot) : null
  const empty = snapshot !== null && snapshot.totalPrompts === 0 && snapshot.totalCommits === 0
  const nowMs = Date.now()

  // Las réplicas son capacidad de un experto, no agentes: el roster y el
  // contador de flota tienen que mirar la misma lista plegada.
  const rows = useMemo(() => foldPulseReplicas(snapshot?.agents ?? []), [snapshot])

  // Agregados de flota derivados de las filas: un solo recorrido, sin campos nuevos.
  const fleet = useMemo(() => {
    const agents = snapshot?.agents ?? []
    let auto = 0
    let attributed = 0
    let delegations = 0
    for (const a of agents) {
      auto += a.modes.auto
      attributed += a.modes.ask + a.modes.plan + a.modes.auto + a.modes.other
      // Las emitidas, no las recibidas: cada delegación se cuenta una sola vez.
      delegations += a.delegationsOut
    }
    return {
      // Cuenta expertos, no copias: si no, cada oleada turbo infla la plantilla.
      agents: rows.length,
      delegations,
      autoShare: attributed > 0 ? Math.round((auto / attributed) * 100) : 0,
      tokensPerTurn: snapshot && snapshot.totalPrompts > 0 ? snapshot.totalTokens / snapshot.totalPrompts : 0,
    }
  }, [rows, snapshot])

  if (!open || !active) return null

  return (
    <div
      className="pulse-view"
      role="region"
      aria-label={t('pulse.title')}
      style={{ zIndex: APP_OVERLAY_MODAL_Z }}
    >
      <header className="pulse-view__bar">
        <span className="pulse-view__title">{t('pulse.title')}</span>
        <Tooltip content={t('pulse.closeView')}>
          <button
            type="button"
            className="pulse-view__icon"
            aria-label={t('pulse.closeView')}
            onClick={onClose}
          >
            <Icon name="close" size={12} />
          </button>
        </Tooltip>
      </header>
      <div className="pulse-view__body">
        {snapshot === null ? (
          <p className="pulse__empty">{t('pulse.loading')}</p>
        ) : (
          <div className="pulse">
            <div className="pulse__scope">
              <span className="pulse__scope-key">{t('pulse.scope_workspace')}</span>
              <span className="pulse__scope-field">
                <Select
                  value={workspace}
                  options={workspaceOptions}
                  onChange={setWorkspace}
                  size="sm"
                  aria-label={t('pulse.scope_workspace')}
                />
              </span>
              <span className="pulse__scope-key">{t('pulse.scope_repo')}</span>
              <span className="pulse__scope-field">
                <Select
                  value={repo}
                  options={repoOptions}
                  onChange={setRepo}
                  size="sm"
                  aria-label={t('pulse.scope_repo')}
                />
              </span>
              <span className="pulse__scope-spacer" />
              <SegmentedControl
                value={range}
                options={[
                  { value: '30d', label: t('pulse.range_30d') },
                  { value: '90d', label: t('pulse.range_90d') },
                  { value: 'all', label: t('pulse.range_all') },
                ]}
                onChange={setRange}
                label={t('pulse.activity')}
                size="sm"
                layout="scroll"
              />
            </div>

            {/* ─── Sección 1: la cadencia de la persona ─────────────────────── */}
            <section className="pulse__section">
              <header className="pulse__section-head">
                <span className="pulse__rail" />
                <span className="pulse__section-titles">
                  <span className="pulse__eyebrow">{t('pulse.human_eyebrow')}</span>
                  <h3 className="pulse__section-title">{t('pulse.human_title')}</h3>
                  <p className="pulse__section-sub">{t('pulse.human_sub')}</p>
                </span>
              </header>

              <div className="pulse__stats">
                <div className="pulse__stat pulse__stat--accent">
                  <span className="pulse__value">
                    {snapshot.currentStreak}
                    {t('pulse.daysSuffix')}
                  </span>
                  <span className="pulse__label">
                    {t('pulse.currentStreak')}
                    <span className="pulse__delta">
                      {t('pulse.longestStreakShort', { n: snapshot.longestStreak })}
                    </span>
                  </span>
                </div>
                <div className="pulse__stat">
                  <span className="pulse__value">{formatNumber(snapshot.todayPrompts)}</span>
                  <span className="pulse__label">
                    {t('pulse.today')}
                    {delta !== null ? (
                      <span className={delta < 0 ? 'pulse__delta pulse__delta--down' : 'pulse__delta'}>
                        {delta < 0 ? '▽' : '△'} {delta > 0 ? '+' : ''}
                        {delta}% {t('pulse.vsAverage')}
                      </span>
                    ) : null}
                  </span>
                </div>
                <div className="pulse__stat">
                  <span className="pulse__value">{formatStat(snapshot.totalPrompts)}</span>
                  <span className="pulse__label">{t('pulse.turnsDirected')}</span>
                </div>
                <div className="pulse__stat">
                  <span className="pulse__value">{formatStat(snapshot.totalCommits)}</span>
                  <span className="pulse__label">{t('pulse.totalCommits')}</span>
                </div>
                <div className="pulse__stat">
                  <span className="pulse__value">
                    {snapshot.totalCommits > 0
                      ? (snapshot.totalPrompts / snapshot.totalCommits).toFixed(1)
                      : '—'}
                  </span>
                  <span className="pulse__label">{t('pulse.turnsPerCommit')}</span>
                </div>
                <div className="pulse__stat">
                  <span className="pulse__value">{formatNumber(snapshot.days.length)}</span>
                  <span className="pulse__label">{t('pulse.activeDays')}</span>
                </div>
              </div>

              <section className="pulse__panel">
                <header className="pulse__panel-head">
                  <h3 className="pulse__panel-title">{t(RANGES[range].titleKey)}</h3>
                  <div className="pulse__toggle" role="group" aria-label={t('pulse.activity')}>
                    {METRICS.map(({ id, labelKey }) => (
                      <button
                        key={id}
                        type="button"
                        className={
                          metric === id ? 'pulse__toggle-btn pulse__toggle-btn--on' : 'pulse__toggle-btn'
                        }
                        aria-pressed={metric === id}
                        onClick={() => setMetric(id)}
                      >
                        {t(labelKey)}
                      </button>
                    ))}
                  </div>
                </header>

                {empty ? (
                  <p className="pulse__empty">{t('pulse.empty')}</p>
                ) : (
                  <>
                    <div className="pulse__grid">
                      {grid.map(column => (
                        <div className="pulse__col" key={column[0]!.day}>
                          {column.map(cell => (
                            <Tooltip
                              key={cell.day}
                              content={cell.day}
                              hint={t('pulse.dayDetail', {
                                prompts: cell.prompts,
                                commits: cell.commits,
                              })}
                            >
                              <span
                                className="pulse__cell"
                                data-level={levelFor(valueOf(cell), thresholds)}
                              />
                            </Tooltip>
                          ))}
                        </div>
                      ))}
                    </div>
                    <div className="pulse__legend">
                      <span>{t('pulse.less')}</span>
                      {[0, 1, 2, 3, 4].map(level => (
                        <span key={level} className="pulse__cell" data-level={level} />
                      ))}
                      <span>{t('pulse.more')}</span>
                    </div>
                  </>
                )}
              </section>
            </section>

            {/* ─── Sección 2: la flota ──────────────────────────────────────── */}
            <section className="pulse__section">
              <header className="pulse__section-head">
                <span className="pulse__rail pulse__rail--fleet" />
                <span className="pulse__section-titles">
                  <span className="pulse__eyebrow">{t('pulse.fleet_eyebrow')}</span>
                  <h3 className="pulse__section-title">{t('pulse.fleet_title')}</h3>
                  <p className="pulse__section-sub">{t('pulse.fleet_sub')}</p>
                </span>
              </header>

              <div className="pulse__stats">
                <div className="pulse__stat pulse__stat--accent">
                  <span className="pulse__value">{formatNumber(fleet.agents)}</span>
                  <span className="pulse__label">{t('pulse.activeAgents')}</span>
                </div>
                <div className="pulse__stat">
                  <Tooltip content={formatNumber(snapshot.totalTokens)}>
                    <span className="pulse__value">{formatStat(snapshot.totalTokens)}</span>
                  </Tooltip>
                  <span className="pulse__label">{t('pulse.totalTokens')}</span>
                </div>
                <div className="pulse__stat">
                  <span className="pulse__value">{formatStat(fleet.tokensPerTurn)}</span>
                  <span className="pulse__label">{t('pulse.tokensPerTurn')}</span>
                </div>
                <div className="pulse__stat">
                  <span className="pulse__value">{fleet.autoShare}%</span>
                  <span className="pulse__label">{t('pulse.autoShare')}</span>
                </div>
                <div className="pulse__stat">
                  <span className="pulse__value">{formatNumber(fleet.delegations)}</span>
                  <span className="pulse__label">{t('pulse.delegations')}</span>
                </div>
              </div>

              {snapshot.agents.length === 0 ? (
                <p className="pulse__empty">{t('pulse.roster_empty')}</p>
              ) : (
                <div className="pulse__roster">
                  {rows.map((group, i) => (
                    <AgentRow
                      key={group.base.agentId}
                      group={group}
                      nowMs={nowMs}
                      defaultOpen={i === 0}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
