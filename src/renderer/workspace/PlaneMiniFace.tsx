import React, { useRef } from 'react'
import type { AgentCliProvider } from '@shared/tabSession'
import { agentResultContextIdForSlug } from '@shared/projectAgentCatalog'
import { useT } from '@i18n/useT'
import { agentCliSpec } from '@shared/agentCliProviders'
import { agentMonogram } from '@shared/tabContextAppearance'
import { Icon } from '../components/ui/Icon'
import { BrandIcon } from '../components/ui/BrandIcon'
import { CoordinationBadge } from '../components/ui/CoordinationBadge'
import { OrchestrationWorkStyleBadge } from '../components/ui/OrchestrationWorkStyleBadge'
import type { OrchestrationWorkStyle } from '@shared/agentOrchestration'
import { PlaneAgentContextNodes, type PlaneAgentContextChip } from './PlaneAgentContextNodes'
import { setPlaneContextDragData } from './planeContextDrag'
import {
  isPlaneMiniSmallControlTarget,
  isPlaneMiniThreadRowTarget,
  markPlaneMiniCardOpenedFromPointer,
  openPlaneMiniCardFromPointerDown,
  shouldSkipPlaneMiniCardClick,
} from './planeMiniCardOpen'
import type { PlaneActivityDotKind } from '../agent/paneWorkActive'
import { PlaneBusyDot } from '../components/ui/PlaneBusyDot'
import './PlaneMiniFace.css'

export interface PlaneMiniFaceProps {
  name: string
  /**
   * Con la mesa de brainstorm abierta, la card se arrastra a ella.
   * El handle de reorder sigue siendo suyo: el drag nativo sale del cuerpo.
   */
  seatDragEnabled?: boolean
  monogram?: string
  busy?: boolean
  /** Dot en esquina: busy o delegating (prioridad sobre glow). */
  activityDot?: PlaneActivityDotKind | null
  provider?: AgentCliProvider
  /** Muestra chip de orquestador / product owner junto al proveedor. */
  coordination?: 'none' | 'orchestrator' | 'productOwner'
  /** Solo orquestadores: lineal o turbo. */
  orchestrationWorkStyle?: OrchestrationWorkStyle
  statusLabel: string
  /** Reemplaza la cápsula de estado (p. ej. hilos activos en lugar de «En espera»). */
  statusSlot?: React.ReactNode
  /** Densidad visual; compact reduce padding/gaps para listas y modales. */
  density?: 'default' | 'compact'
  configLabel?: string
  deleteLabel?: string
  onConfigure?: () => void
  onDelete?: () => void
  /** Slug del agente: habilita drag del archivo de results. */
  agentId?: string
  reorderEnabled?: boolean
  reorderLabel?: string
  resultsDragLabel?: string
  onReorderPointerDown?: (event: React.PointerEvent) => void
  /** Clic puro (sin drag) sobre el icono de results → vista previa. */
  onOpenResultsPreview?: (contextId: string) => void
  /** Clic en la cara (fuera de controles): abrir chat del agente. */
  onOpen?: () => void
  /** Contextos anidados (lista con nombres) debajo del cuerpo. */
  children?: React.ReactNode
}

/** Cara mini del agente: card con proveedor, estado y contextos. */
export const PlaneMiniFace: React.FC<PlaneMiniFaceProps> = ({
  name,
  seatDragEnabled = false,
  monogram,
  busy = false,
  activityDot = null,
  provider = 'claude',
  coordination = 'none',
  orchestrationWorkStyle,
  statusLabel,
  statusSlot,
  density = 'default',
  configLabel,
  deleteLabel,
  onConfigure,
  onDelete,
  agentId,
  reorderEnabled = false,
  reorderLabel,
  resultsDragLabel,
  onReorderPointerDown,
  onOpenResultsPreview,
  onOpen,
  children,
}) => {
  const { t } = useT()
  const resultsDragOccurredRef = useRef(false)
  const showReorder = Boolean(reorderEnabled && onReorderPointerDown && reorderLabel)
  const resultsId = agentId?.trim()
    ? agentResultContextIdForSlug(agentId)
    : ''
  // Visible si hay agentId; el label i18n no oculta el control.
  const showResultsDrag = Boolean(resultsId)
  const resultsTitle = resultsDragLabel || resultsId
  const displayMonogram = (monogram?.trim() || agentMonogram(name)).toUpperCase()
  const skipClickRef = useRef(false)
  const showIntegratedActions = Boolean(
    (onConfigure && configLabel) || (onDelete && deleteLabel),
  )
  const showControlsRail = showReorder || showIntegratedActions

  const openFromFaceClick = (event: React.MouseEvent): void => {
    if (!onOpen) return
    if (shouldSkipPlaneMiniCardClick(skipClickRef)) return
    if (isPlaneMiniThreadRowTarget(event.target)) return
    if (isPlaneMiniSmallControlTarget(event.target)) return
    event.stopPropagation()
    onOpen()
  }

  const onFacePointerDown = (event: React.PointerEvent): void => {
    if (!onOpen) return
    if (event.button !== 0) return
    if (isPlaneMiniThreadRowTarget(event.target)) return
    if (isPlaneMiniSmallControlTarget(event.target)) return
    markPlaneMiniCardOpenedFromPointer(skipClickRef)
    openPlaneMiniCardFromPointerDown(event, onOpen)
  }

  const controlsRail = showControlsRail ? (
    <div className="plane-mini-face__controls-rail">
      {showReorder ? (
        <button
          type="button"
          className="plane-mini-face__controls-btn plane-mini-face__drag-handle"
          aria-label={reorderLabel}
          onClick={event => {
            event.preventDefault()
            event.stopPropagation()
          }}
          onPointerDown={event => {
            event.stopPropagation()
            onReorderPointerDown?.(event)
          }}
        >
          <Icon name="drag-handle" size={13} />
        </button>
      ) : null}
      {onConfigure && configLabel ? (
        <button
          type="button"
          className="plane-mini-face__controls-btn"
          aria-label={configLabel}
          onClick={event => {
            event.preventDefault()
            event.stopPropagation()
            onConfigure()
          }}
          onPointerDown={event => {
            event.preventDefault()
            event.stopPropagation()
          }}
          onPointerUp={event => event.stopPropagation()}
        >
          <Icon name="settings" size={13} />
        </button>
      ) : null}
      {onDelete && deleteLabel ? (
        <button
          type="button"
          className="plane-mini-face__controls-btn plane-mini-face__controls-btn--danger"
          aria-label={deleteLabel}
          onClick={event => {
            event.preventDefault()
            event.stopPropagation()
            onDelete()
          }}
          onPointerDown={event => {
            event.preventDefault()
            event.stopPropagation()
          }}
          onPointerUp={event => event.stopPropagation()}
        >
          <Icon name="trash" size={13} />
        </button>
      ) : null}
    </div>
  ) : null

  const face = (
  <div
    className={[
      'plane-mini-face',
      busy ? 'plane-mini-face--busy' : '',
      activityDot ? 'plane-mini-face--has-activity-dot' : '',
      density === 'compact' ? 'plane-mini-face--compact' : '',
      `plane-mini-face--${provider}`,
      onOpen ? 'plane-mini-face--openable' : '',
    ].filter(Boolean).join(' ')}
    onClick={onOpen ? openFromFaceClick : undefined}
    onPointerDown={onOpen ? onFacePointerDown : undefined}
  >
    {activityDot ? (
      <PlaneBusyDot placement="corner" variant={activityDot} />
    ) : null}
    <div className="plane-mini-face__glow" aria-hidden="true" />
    <div className="plane-mini-face__main">
    <div className="plane-mini-face__header">
      <div className="plane-mini-face__identity">
        <span className="plane-mini-face__monogram" aria-hidden>
          {displayMonogram}
        </span>
        <span className="plane-mini-face__name">{name}</span>
      </div>
      <div className="plane-mini-face__header-aside">
        <div className="plane-mini-face__meta-badges">
          <span
            className="plane-mini-face__provider"
            style={{ '--plane-mini-face-brand': agentCliSpec(provider).brand } as React.CSSProperties}
            aria-label={agentCliSpec(provider).label}
          >
            <BrandIcon provider={provider} size={11} aria-hidden />
          </span>
          <CoordinationBadge
            coordination={coordination}
            variant="inline"
            iconSize={11}
            label={t(
              coordination === 'orchestrator'
                ? 'agentPane.orchestratorBadge'
                : coordination === 'productOwner'
                  ? 'agentPane.productOwnerBadge'
                  : 'agentPane.specialistBadge',
            )}
          />
          {coordination === 'orchestrator' && orchestrationWorkStyle ? (
            <OrchestrationWorkStyleBadge
              workStyle={orchestrationWorkStyle}
              variant="inline"
              iconSize={11}
              label={t(
                orchestrationWorkStyle === 'turbo'
                  ? 'agentPane.orchestrationWorkStyleTurbo'
                  : 'agentPane.orchestrationWorkStyleLinear',
              )}
            />
          ) : null}
        </div>
      </div>
    </div>
    <div
      className={[
        'plane-mini-face__body',
        statusSlot ? 'plane-mini-face__body--slot' : '',
      ].filter(Boolean).join(' ')}
    >
      {statusSlot ?? (
        <div className="plane-mini-face__status-surface">
          <span className="plane-mini-face__status">{statusLabel}</span>
        </div>
      )}
    </div>
    {children ? (
      <div className="plane-mini-face__nodes">
        {children}
      </div>
    ) : null}
    </div>
    {showResultsDrag ? (
      <button
        type="button"
        className="plane-mini-face__results-drag"
        aria-label={resultsTitle}
        draggable
        onClick={event => {
          event.preventDefault()
          event.stopPropagation()
          if (resultsDragOccurredRef.current) {
            resultsDragOccurredRef.current = false
            return
          }
          onOpenResultsPreview?.(resultsId)
        }}
        onPointerDown={event => {
          event.stopPropagation()
        }}
        onPointerUp={event => event.stopPropagation()}
        onDragStart={event => {
          event.stopPropagation()
          resultsDragOccurredRef.current = true
          setPlaneContextDragData(event.dataTransfer, resultsId)
        }}
        onDragEnd={event => {
          event.stopPropagation()
          // Mantener el flag hasta después del click sintético post-drag.
          window.setTimeout(() => {
            resultsDragOccurredRef.current = false
          }, 50)
        }}
      >
        <Icon name="files" size={9} aria-hidden />
      </button>
    ) : null}
  </div>
  )

  if (!showControlsRail) return face

  return (
    <div className="plane-mini-face-wrap">
      {face}
      {controlsRail}
    </div>
  )
}
