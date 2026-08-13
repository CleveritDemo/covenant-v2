import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useT } from '@i18n/useT'
import { APP_OVERLAY_MODAL_Z } from '@shared/overlayZIndex'
import { Button } from '../components/ui/Button'
import { Icon } from '../components/ui/Icon'
import { Spinner } from '../components/ui/Spinner'
import { Tooltip } from '../components/ui/Tooltip'
import { useWikiGraphScene, type WikiGraphHover } from './useWikiGraphScene'
import type { WikiGraphData, WikiGraphNodeType } from './wikiGraph'
import './WikiGraphView.css'

export interface WikiGraphViewProps {
  /** null = cargando (aún sin respuesta del IPC); nodes vacíos = wiki sin pages. */
  data: WikiGraphData | null
  /** cwd del proyecto; el CTA 'Crear wiki' lo pasa a ensureWiki. */
  cwd: string
  onClose: () => void
  onOpenNode: (slug: string) => void
  /** Relanza el fetch del grafo por el camino existente (tras crear la wiki). */
  onRefetchGraph: () => void
  /** Slot del composer del curador; se monta dentro del overlay del mapa. */
  curator?: React.ReactNode
  /**
   * Si false, no se monta el overlay (tab inactiva). El padre puede conservar
   * `wikiMapOpen` sin auto-cerrar al cambiar de workspace.
   */
  active?: boolean
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

/**
 * Mapa neuronal 3D de la wiki: cubre el plano del workspace (absolute inset)
 * y se cierra con Escape o su botón. Vive dentro de `.tab-agentic-plane` para
 * no tapar otros workspaces al cambiar de tab; el z APP_OVERLAY_MODAL_Z queda
 * por encima del stacking de PlaneMap (z 16), así las PaneWindow no lo tapan.
 * El render 3D vive en `useWikiGraphScene`; aquí solo el chrome HTML.
 */
export const WikiGraphView: React.FC<WikiGraphViewProps> = ({
  data,
  cwd,
  onClose,
  onOpenNode,
  onRefetchGraph,
  curator,
  active = true,
}) => {
  const { t } = useT()
  const containerRef = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<WikiGraphHover | null>(null)
  const [creatingWiki, setCreatingWiki] = useState(false)
  const [createWikiFailed, setCreateWikiFailed] = useState(false)
  const graphData = data ?? EMPTY_GRAPH
  // Empty solo con respuesta ya cargada: mientras data es null no hay veredicto.
  const isEmpty = data !== null && data.nodes.length === 0
  const { webglAvailable } = useWikiGraphScene(containerRef, graphData, {
    onHover: setHover,
    onPick: onOpenNode,
  }, active)

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

  if (!active) return null

  return (
    <div
      className="wiki-graph-view"
      role="region"
      aria-label={t('tabs.wikiMapTitle')}
      style={{ zIndex: APP_OVERLAY_MODAL_Z }}
    >
      <div ref={containerRef} className="wiki-graph-view__canvas" />
      {isEmpty ? (
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
                  setCreatingWiki(false)
                  if (ok) onRefetchGraph()
                  else setCreateWikiFailed(true)
                })()
              }}
            >
              {creatingWiki ? <Spinner aria-label={t('tabs.wikiMapCreating')} /> : null}
              {t('tabs.wikiMapCreate')}
            </Button>
          </div>
          {createWikiFailed ? (
            <p className="wiki-graph-view__empty-error" role="alert">
              {t('tabs.wikiMapCreateError')}
            </p>
          ) : null}
        </div>
      ) : !webglAvailable ? (
        <p className="wiki-graph-view__fallback">{t('tabs.wikiMapNoWebgl')}</p>
      ) : null}
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
    </div>
  )
}
