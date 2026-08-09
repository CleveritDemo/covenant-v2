import React, { useEffect, useMemo, useState } from 'react'
import { useT } from '@i18n/useT'
import {
  dayFromMs,
  heatmapGrid,
  intensityLevels,
  levelFor,
  type PulseCell,
  type PulseSnapshot,
} from '@shared/pulseEvents'
import { TerminalModal } from '../components/TerminalModal'
import './PulseModal.css'

export interface PulseModalProps {
  open: boolean
  active?: boolean
  onClose: () => void
}

type Metric = 'prompts' | 'commits' | 'both'

const HEATMAP_WEEKS = 53

const METRICS = [
  { id: 'prompts', labelKey: 'pulse.metric_prompts' },
  { id: 'commits', labelKey: 'pulse.metric_commits' },
  { id: 'both', labelKey: 'pulse.metric_both' },
] as const satisfies ReadonlyArray<{ id: Metric; labelKey: string }>

function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(Math.round(value))
}

/** Variación de hoy contra la media de 30 días, en % redondeado. */
function todayDelta(snapshot: PulseSnapshot): number | null {
  if (snapshot.avgPrompts30d <= 0) return null
  return Math.round(((snapshot.todayPrompts - snapshot.avgPrompts30d) / snapshot.avgPrompts30d) * 100)
}

/** Dashboard local de uso: rachas, totales y actividad de los últimos 12 meses. */
export const PulseModal: React.FC<PulseModalProps> = ({ open, active = true, onClose }) => {
  const { t } = useT()
  const [snapshot, setSnapshot] = useState<PulseSnapshot | null>(null)
  const [metric, setMetric] = useState<Metric>('both')
  const [hovered, setHovered] = useState<PulseCell | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void window.api
      .pulseSnapshot()
      .then(next => {
        if (!cancelled) setSnapshot(next)
      })
      .catch(() => {
        if (!cancelled) setSnapshot(null)
      })
    return () => {
      cancelled = true
    }
  }, [open])

  const grid = useMemo(
    () => heatmapGrid(snapshot?.days ?? [], dayFromMs(Date.now()), HEATMAP_WEEKS),
    [snapshot],
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

  const delta = snapshot ? todayDelta(snapshot) : null
  const empty = snapshot !== null && snapshot.totalPrompts === 0 && snapshot.totalCommits === 0

  return (
    <TerminalModal
      open={open}
      active={active}
      onClose={onClose}
      title={t('pulse.title')}
      size="xxl"
      closeOnEscape
      closeOnBackdrop
    >
      {snapshot === null ? (
        <p className="pulse__empty">{t('pulse.loading')}</p>
      ) : (
        <div className="pulse">
          <div className="pulse__stats">
            <div className="pulse__stat pulse__stat--accent">
              <span className="pulse__value">
                {snapshot.currentStreak}
                {t('pulse.daysSuffix')}
              </span>
              <span className="pulse__label">{t('pulse.currentStreak')}</span>
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
              <span className="pulse__value">{formatNumber(snapshot.totalPrompts)}</span>
              <span className="pulse__label">{t('pulse.totalPrompts')}</span>
            </div>
            <div className="pulse__stat">
              <span className="pulse__value">{formatNumber(snapshot.totalCommits)}</span>
              <span className="pulse__label">{t('pulse.totalCommits')}</span>
            </div>
            <div className="pulse__stat">
              <span className="pulse__value">{formatNumber(snapshot.totalTokens)}</span>
              <span className="pulse__label">{t('pulse.totalTokens')}</span>
            </div>
            <div className="pulse__stat">
              <span className="pulse__value">
                {snapshot.longestStreak}
                {t('pulse.daysSuffix')}
              </span>
              <span className="pulse__label">{t('pulse.longestStreak')}</span>
            </div>
          </div>

          <section className="pulse__panel">
            <header className="pulse__panel-head">
              <h3 className="pulse__panel-title">{t('pulse.activity')}</h3>
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
                <div className="pulse__grid" onMouseLeave={() => setHovered(null)}>
                  {grid.map(column => (
                    <div className="pulse__col" key={column[0]!.day}>
                      {column.map(cell => (
                        <span
                          key={cell.day}
                          className="pulse__cell"
                          data-level={levelFor(valueOf(cell), thresholds)}
                          onMouseEnter={() => setHovered(cell)}
                        />
                      ))}
                    </div>
                  ))}
                </div>
                <div className="pulse__legend">
                  {/* El detalle del día vive acá y no en un tooltip por celda: son
                      371 celdas y el tooltip propio monta un portal por instancia. */}
                  <span className="pulse__hovered">
                    {hovered
                      ? t('pulse.dayDetail', {
                          day: hovered.day,
                          prompts: hovered.prompts,
                          commits: hovered.commits,
                        })
                      : ''}
                  </span>
                  <span>{t('pulse.less')}</span>
                  {[0, 1, 2, 3, 4].map(level => (
                    <span key={level} className="pulse__cell" data-level={level} />
                  ))}
                  <span>{t('pulse.more')}</span>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </TerminalModal>
  )
}
