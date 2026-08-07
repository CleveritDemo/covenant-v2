import React, { useRef } from 'react'
import type { AgentCliProvider } from '@shared/tabSession'
import { agentResultContextIdForSlug } from '@shared/projectAgentCatalog'
import { useT } from '@i18n/useT'
import { agentCliSpec } from '@shared/agentCliProviders'
import { Icon } from '../components/ui/Icon'
import { BrandIcon } from '../components/ui/BrandIcon'
import { PlaneBusyDot } from './PlaneBusyDot'
import { setPlaneContextDragData } from './planeContextDrag'
import './PlaneMiniFace.css'

export interface PlaneMiniFaceProps {
  name: string
  busy?: boolean
  provider?: AgentCliProvider
  /** Muestra chip de orquestador / product owner junto al proveedor. */
  coordination?: 'none' | 'orchestrator' | 'productOwner'
  statusLabel: string
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
  /** Contextos anidados (lista con nombres) debajo del cuerpo. */
  children?: React.ReactNode
}

/** Cara mini del agente: card con proveedor, estado y contextos. */
export const PlaneMiniFace: React.FC<PlaneMiniFaceProps> = ({
  name,
  busy = false,
  provider = 'claude',
  coordination = 'none',
  statusLabel,
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

  return (
  <div
    className={[
      'plane-mini-face',
      busy ? 'plane-mini-face--busy' : '',
      density === 'compact' ? 'plane-mini-face--compact' : '',
      `plane-mini-face--${provider}`,
    ].filter(Boolean).join(' ')}
  >
    <div className="plane-mini-face__glow" aria-hidden="true" />
    <div className="plane-mini-face__header">
      <div className="plane-mini-face__identity">
        {showReorder ? (
          <button
            type="button"
            className="plane-mini-face__action plane-mini-face__drag-handle"
            title={reorderLabel}
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
            <Icon name="drag-handle" size={11} />
          </button>
        ) : null}
        <span className="plane-mini-face__name" title={name}>{name}</span>
        <span
          className="plane-mini-face__provider"
          style={{ '--plane-mini-face-brand': agentCliSpec(provider).brand } as React.CSSProperties}
          title={agentCliSpec(provider).label}
          aria-label={agentCliSpec(provider).label}
        >
          <BrandIcon provider={provider} size={9} aria-hidden />
        </span>
        {coordination === 'orchestrator' ? (
          <span
            className="plane-mini-face__provider plane-mini-face__provider--orchestrator"
            title={t('agentPane.orchestratorBadge')}
            aria-label={t('agentPane.orchestratorBadge')}
          >
            <Icon name="git-branch" size={9} aria-hidden />
          </span>
        ) : null}
        {coordination === 'productOwner' ? (
          <span
            className="plane-mini-face__provider plane-mini-face__provider--orchestrator"
            title={t('agentPane.productOwnerBadge')}
            aria-label={t('agentPane.productOwnerBadge')}
          >
            <Icon name="folder" size={9} aria-hidden />
          </span>
        ) : null}
      </div>
      <div className="plane-mini-face__header-end">
        {busy ? <PlaneBusyDot /> : null}
        {onConfigure && configLabel ? (
          <button
            type="button"
            className="plane-mini-face__action"
            title={configLabel}
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
            <Icon name="settings" size={11} />
          </button>
        ) : null}
        {onDelete && deleteLabel ? (
          <button
            type="button"
            className="plane-mini-face__action plane-mini-face__action--danger"
            title={deleteLabel}
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
            <Icon name="trash" size={11} />
          </button>
        ) : null}
      </div>
    </div>
    <div className="plane-mini-face__body">
      <span className="plane-mini-face__status" title={statusLabel}>{statusLabel}</span>
    </div>
    {children ? (
      <div className="plane-mini-face__nodes">
        {children}
      </div>
    ) : null}
    {showResultsDrag ? (
      <button
        type="button"
        className="plane-mini-face__action plane-mini-face__results-drag"
        title={resultsTitle}
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
        <Icon name="files" size={12} />
      </button>
    ) : null}
  </div>
  )
}
