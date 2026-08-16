import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useT } from '@i18n/useT'
import { isReduceMotionActive } from '../reduceMotion'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Icon } from '../components/ui/Icon'
import { Spinner } from '../components/ui/Spinner'
import { Tooltip } from '../components/ui/Tooltip'
import {
  useWikiGraphScene,
  type WikiGraphHover,
  type WikiGraphNodeScreenPosition,
} from './useWikiGraphScene'
import { wikiSweepPassLabelKey, type WikiSweepPass } from '@shared/wikiCuratorSweep'
import { getMostRecentlyUpdatedWikiSlugs, type WikiGraphData, type WikiGraphNodeType } from './wikiGraph'
import './WikiGraphView.css'

export type WikiGraphPhase = 'loading' | 'empty' | 'ready' | 'error'

export interface WikiGraphViewProps {
  /** null = cargando (aún sin respuesta del IPC); nodes vacíos = wiki sin pages. */
  data: WikiGraphData | null
  /** Mensaje de error del fetch del grafo; prioridad sobre loading/empty. */
  error?: string | null
  /** Relanza el fetch del grafo (overlay de error). */
  onRetry?: () => void
  /** cwd del proyecto; el CTA 'Crear wiki' lo pasa a ensureWiki. */
  cwd: string
  onClose: () => void
  onOpenNode: (slug: string, screen?: { x: number; y: number }) => void
  /** Posiciones en pantalla de nodos (canvas/plano); además del estado local de badges. */
  onNodeScreenPositions?: (positions: ReadonlyMap<string, WikiGraphNodeScreenPosition>) => void
  /** Relanza el fetch del grafo por el camino existente (tras crear la wiki). */
  onRefetchGraph: () => void
  /** Slot del composer del curador; se monta dentro del overlay del mapa. */
  curator?: React.ReactNode
  /**
   * Si false, no se monta el overlay (tab inactiva). El padre puede conservar
   * `wikiMapOpen` sin auto-cerrar al cambiar de workspace.
   */
  active?: boolean
  /** Barrido secuencial de la wiki (cinco pases del curador). */
  sweep?: {
    running: boolean
    pass: WikiSweepPass | null
    index: number
    total: number
    opsApplied: number
    errors: string[]
    snapshotPath: string | null
    onStart: () => void
    onStop: () => void
    onDismissSummary: () => void
  }
}

const EMPTY_GRAPH: WikiGraphData = { nodes: [], edges: [] }

export function wikiTypeLabelKey(
  type: WikiGraphNodeType,
): 'tabs.wikiMapTypeConcept'
  | 'tabs.wikiMapTypeDecision'
  | 'tabs.wikiMapTypeFlow'
  | 'tabs.wikiMapTypeReference' {
  if (type === 'decision') return 'tabs.wikiMapTypeDecision'
  if (type === 'flow') return 'tabs.wikiMapTypeFlow'
  if (type === 'reference') return 'tabs.wikiMapTypeReference'
  return 'tabs.wikiMapTypeConcept'
}

const LEGEND_TYPES: WikiGraphNodeType[] = ['concept', 'decision', 'flow', 'reference']

/** Duración del implode enter del mapa (mismo timing/easing que gravity-enter). */
const WIKI_MAP_ENTER_MS = 2400

/**
 * Mapa neuronal 3D de la wiki: cubre el plano del workspace (absolute inset)
 * y se cierra con Escape o su botón. Vive dentro de `.tab-agentic-plane` para
 * no tapar otros workspaces al cambiar de tab. Se monta dentro de PlaneMap
 * (`.plane-map__wiki-overlay`) sobre el backdrop de grilla y partículas.
 * El render 3D vive en `useWikiGraphScene`; aquí solo el chrome HTML.
 */
export const WikiGraphView: React.FC<WikiGraphViewProps> = ({
  data,
  error = null,
  onRetry,
  cwd,
  onClose,
  onOpenNode,
  onRefetchGraph,
  onNodeScreenPositions,
  curator,
  active = true,
  sweep,
}) => {
  const { t } = useT()
  const containerRef = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<WikiGraphHover | null>(null)
  const [nodeScreenPositions, setNodeScreenPositions] = useState<
    ReadonlyMap<string, WikiGraphNodeScreenPosition>
  >(() => new Map())
  const [mapEntering, setMapEntering] = useState(true)
  const [creatingWiki, setCreatingWiki] = useState(false)
  const [createWikiFailed, setCreateWikiFailed] = useState(false)
  const [snapshotCopied, setSnapshotCopied] = useState(false)
  const awaitingCreateLoadRef = useRef(false)
  const graphData = data ?? EMPTY_GRAPH

  const phase: WikiGraphPhase = error != null
    ? 'error'
    : data === null
      ? 'loading'
      : data.nodes.length === 0
        ? 'empty'
        : 'ready'

  const showLoadingOverlay = phase === 'loading' || creatingWiki || Boolean(sweep?.running)

  useEffect(() => {
    setSnapshotCopied(false)
  }, [sweep?.snapshotPath])

  const handleCopySnapshotPath = useCallback((): void => {
    const path = sweep?.snapshotPath?.trim()
    if (!path) return
    void navigator.clipboard.writeText(path).then(
      () => {
        setSnapshotCopied(true)
        window.setTimeout(() => setSnapshotCopied(false), 1500)
      },
      () => {},
    )
  }, [sweep?.snapshotPath])

  const handleNodeScreenPositions = useCallback(
    (positions: ReadonlyMap<string, WikiGraphNodeScreenPosition>) => {
      setNodeScreenPositions(positions)
      onNodeScreenPositions?.(positions)
    },
    [onNodeScreenPositions],
  )

  const { webglAvailable } = useWikiGraphScene(containerRef, graphData, {
    onHover: setHover,
    onPick: (slug, screen) => onOpenNode(slug, screen),
    onNodeScreenPositions: handleNodeScreenPositions,
  }, active)

  // Implode enter del canvas al abrir el mapa.
  useEffect(() => {
    if (!active) {
      setMapEntering(true)
      return
    }
    if (isReduceMotionActive()) {
      setMapEntering(false)
      return
    }
    setMapEntering(true)
    const timer = window.setTimeout(
      () => setMapEntering(false),
      WIKI_MAP_ENTER_MS,
    )
    return () => window.clearTimeout(timer)
  }, [active])

  // Tras ensureWiki ok el padre refetchea (data=null); mantener spinner hasta que llegue data.
  useEffect(() => {
    if (!awaitingCreateLoadRef.current || data === null) return
    awaitingCreateLoadRef.current = false
    setCreatingWiki(false)
  }, [data])

  // Escape cierra la vista — salvo que haya un modal portaled encima
  // (el placeholder de nodo u otro): ese Escape es del modal.
  useEffect(() => {
    if (!active) return
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      if (document.querySelector('.terminal-modal-root')) return
      event.preventDefault()
      onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, onClose])

  const hoverNode = useMemo(
    () => (hover ? graphData.nodes.find(node => node.slug === hover.slug) ?? null : null),
    [graphData, hover],
  )

  const recentBadges = useMemo(() => {
    if (phase !== 'ready') return []
    const recentSlugs = getMostRecentlyUpdatedWikiSlugs(graphData.nodes)
    return graphData.nodes.flatMap(node => {
      if (!recentSlugs.has(node.slug)) return []
      const pos = nodeScreenPositions.get(node.slug)
      if (!pos?.visible) return []
      return [{ slug: node.slug, x: pos.x, y: pos.y }]
    })
  }, [graphData.nodes, nodeScreenPositions, phase])

  if (!active) return null

  return (
    <div
      className="wiki-graph-view"
      role="region"
      aria-label={t('tabs.wikiMapTitle')}
    >
      <div
        ref={containerRef}
        className={[
          'wiki-graph-view__canvas',
          mapEntering ? 'wiki-graph-view__canvas--entering' : '',
        ].filter(Boolean).join(' ')}
      />
      {!mapEntering && recentBadges.length > 0 ? (
        <div className="wiki-graph-view__node-badges" aria-hidden>
          {recentBadges.map(badge => (
            <span
              key={badge.slug}
              className="wiki-graph-view__node-badge"
              style={{ left: badge.x + 12, top: badge.y }}
            >
              <Badge variant="accent">{t('tabs.wikiMapRecentlyUpdated')}</Badge>
            </span>
          ))}
        </div>
      ) : null}
      {showLoadingOverlay ? (
        <div className="wiki-graph-view__loading" role="status">
          <Spinner
            aria-label={
              sweep?.running
                ? (sweep.pass ? t(wikiSweepPassLabelKey(sweep.pass)) : t('tabs.wikiSweepStart'))
                : creatingWiki
                  ? t('tabs.wikiMapCreating')
                  : t('tabs.wikiMapLoading')
            }
          />
          {sweep?.running ? (
            <div className="wiki-graph-view__loading-detail">
              {sweep.pass ? (
                <p className="wiki-graph-view__loading-pass">
                  {t(wikiSweepPassLabelKey(sweep.pass))}
                </p>
              ) : null}
              <p className="wiki-graph-view__loading-progress">
                {t('tabs.wikiSweepProgress', { index: sweep.index, total: sweep.total })}
              </p>
              <p className="wiki-graph-view__loading-ops">{sweep.opsApplied}</p>
              {sweep.errors.length > 0 ? (
                <div className="wiki-graph-view__loading-errors">
                  <p className="wiki-graph-view__loading-errors-title">
                    {t('tabs.wikiSweepErrorsTitle')}
                  </p>
                  <ul className="wiki-graph-view__loading-errors-list">
                    {sweep.errors.map((message, index) => (
                      <li key={`${index}-${message}`}>{message}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      {phase === 'error' ? (
        <div className="wiki-graph-view__error" role="alert">
          <p className="wiki-graph-view__error-text">
            {error?.trim() || t('tabs.wikiMapError')}
          </p>
          {onRetry ? (
            <div className="wiki-graph-view__error-cta">
              <Button variant="secondary" size="sm" onClick={onRetry}>
                {t('tabs.wikiMapRetry')}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
      {phase === 'empty' && !creatingWiki ? (
        <div className="wiki-graph-view__empty" role="status">
          <p className="wiki-graph-view__empty-title">{t('tabs.wikiMapEmpty')}</p>
          <p className="wiki-graph-view__empty-hint">{t('tabs.wikiMapEmptyHint')}</p>
          <div className="wiki-graph-view__empty-cta">
            <Button
              variant="primary"
              size="sm"
              disabled={creatingWiki}
              onClick={() => {
                setCreatingWiki(true)
                setCreateWikiFailed(false)
                void (async () => {
                  let ok = false
                  try {
                    ok = (await window.api.ensureWiki(cwd)).ok
                  } catch { /* ok queda en false */ }
                  if (ok) {
                    awaitingCreateLoadRef.current = true
                    onRefetchGraph()
                  } else {
                    setCreatingWiki(false)
                    setCreateWikiFailed(true)
                  }
                })()
              }}
            >
              {t('tabs.wikiMapCreate')}
            </Button>
          </div>
          {createWikiFailed ? (
            <p className="wiki-graph-view__empty-error" role="alert">
              {t('tabs.wikiMapCreateError')}
            </p>
          ) : null}
        </div>
      ) : phase === 'ready' && !webglAvailable ? (
        <p className="wiki-graph-view__fallback">{t('tabs.wikiMapNoWebgl')}</p>
      ) : null}
      {!mapEntering ? (
        <>
          <header className="wiki-graph-view__bar">
            <h2 className="wiki-graph-view__title">{t('tabs.wikiMapTitle')}</h2>
            <ul className="wiki-graph-view__legend">
              {LEGEND_TYPES.map(type => (
                <li
                  key={type}
                  className={`wiki-graph-view__legend-item wiki-graph-view__legend-item--${type}`}
                >
                  {t(wikiTypeLabelKey(type))}
                </li>
              ))}
            </ul>
            {sweep ? (
              <div className="wiki-graph-view__sweep">
                {sweep.running ? (
                  <Button variant="secondary" size="sm" onClick={sweep.onStop}>
                    {t('tabs.wikiSweepStop')}
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={phase !== 'ready'}
                    onClick={sweep.onStart}
                  >
                    {t('tabs.wikiSweepStart')}
                  </Button>
                )}
              </div>
            ) : null}
            <Tooltip content={t('tabs.wikiMapClose')}>
              <button
                type="button"
                className="wiki-graph-view__close"
                aria-label={t('tabs.wikiMapClose')}
                onClick={onClose}
              >
                <Icon name="close" size={12} />
              </button>
            </Tooltip>
          </header>
          {sweep && !sweep.running && (sweep.snapshotPath || sweep.errors.length > 0) ? (
            <div className="wiki-graph-view__summary" role="status">
              <div className="wiki-graph-view__summary-header">
                <h3 className="wiki-graph-view__summary-title">
                  {sweep.snapshotPath
                    ? t('tabs.wikiSweepSnapshotTitle')
                    : t('tabs.wikiSweepErrorsTitle')}
                </h3>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={sweep.onDismissSummary}
                  aria-label={t('tabs.wikiSweepSummaryClose')}
                >
                  {t('tabs.wikiSweepSummaryClose')}
                </Button>
              </div>
              {sweep.snapshotPath ? (
                <>
                  <p className="wiki-graph-view__summary-hint">
                    {t('tabs.wikiSweepSnapshotHint')}
                  </p>
                  <code className="wiki-graph-view__summary-path">{sweep.snapshotPath}</code>
                  <div className="wiki-graph-view__summary-actions">
                    <Button variant="secondary" size="xs" onClick={handleCopySnapshotPath}>
                      {snapshotCopied
                        ? t('tabs.wikiSweepSnapshotCopied')
                        : t('tabs.wikiSweepSnapshotCopy')}
                    </Button>
                  </div>
                </>
              ) : null}
              {sweep.errors.length > 0 ? (
                <div className="wiki-graph-view__summary-errors">
                  <p className="wiki-graph-view__summary-errors-title">
                    {t('tabs.wikiSweepErrorsTitle')}
                  </p>
                  <ul className="wiki-graph-view__summary-errors-list">
                    {sweep.errors.map((message, index) => (
                      <li key={`${index}-${message}`}>{message}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
          {curator}
          {hover && hoverNode ? (
            <div
              className="wiki-graph-view__tooltip"
              role="status"
              style={{ left: hover.x + 14, top: hover.y + 12 }}
            >
              <span className="wiki-graph-view__tooltip-title">{hoverNode.title}</span>
              <span
                className={`wiki-graph-view__tooltip-type wiki-graph-view__tooltip-type--${hoverNode.type}`}
              >
                {t(wikiTypeLabelKey(hoverNode.type))}
              </span>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
