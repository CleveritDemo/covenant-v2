import React, { useEffect, useState } from 'react'
import { Icon } from '../components/ui/Icon'
import { Tooltip } from '../components/ui/Tooltip'
import { isReduceMotionActive } from '../reduceMotion'
import './PlaneWorkspaceUploadProgress.css'

export const PLANE_WORKSPACE_UPLOAD_PROGRESS_EXIT_MS = 360

const DIAL_RADIUS = 8
const DIAL_CIRCUMFERENCE = 2 * Math.PI * DIAL_RADIUS

export interface PlaneWorkspaceUploadProgressProps {
  percent: number
  exiting?: boolean
  ariaLabel: string
  cancelLabel: string
  onCancel: () => void
}

export const PlaneWorkspaceUploadProgress: React.FC<PlaneWorkspaceUploadProgressProps> = ({
  percent,
  exiting = false,
  ariaLabel,
  cancelLabel,
  onCancel,
}) => {
  const clamped = Math.min(100, Math.max(0, Math.round(percent)))
  const complete = clamped >= 100

  return (
    <div
      className={[
        'plane-workspace-upload-progress',
        exiting
          ? 'plane-workspace-upload-progress--exit'
          : 'plane-workspace-upload-progress--enter',
        exiting && complete ? 'plane-workspace-upload-progress--exit-complete' : '',
        !exiting && complete ? 'plane-workspace-upload-progress--complete' : '',
        !exiting && !complete ? 'plane-workspace-upload-progress--active' : '',
      ].filter(Boolean).join(' ')}
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
    >
      <Tooltip content={ariaLabel} hint={cancelLabel}>
        <button
          type="button"
          className="plane-workspace-upload-progress__ring"
          aria-label={cancelLabel}
          disabled={exiting}
          onClick={onCancel}
        >
          <svg
            className="plane-workspace-upload-progress__dial"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <circle
              cx={10}
              cy={10}
              r={DIAL_RADIUS}
              fill="none"
              className="plane-workspace-upload-progress__dial-track"
            />
            <circle
              cx={10}
              cy={10}
              r={DIAL_RADIUS}
              fill="none"
              className="plane-workspace-upload-progress__dial-arc"
              strokeLinecap="round"
              transform="rotate(-90 10 10)"
              strokeDasharray={DIAL_CIRCUMFERENCE}
              style={{ strokeDashoffset: DIAL_CIRCUMFERENCE * (1 - clamped / 100) }}
            />
          </svg>
          <span className="plane-workspace-upload-progress__glyph" aria-hidden="true">
            <Icon name="close" size={8} />
          </span>
        </button>
      </Tooltip>
    </div>
  )
}

export interface PlaneWorkspaceUploadProgressSlotProps {
  progress: number | null
  getAriaLabel: (percent: number) => string
  cancelLabel: string
  onCancel: () => void
}

/** Mantiene la barra montada el tiempo del fade-out al terminar o cancelar. */
export const PlaneWorkspaceUploadProgressSlot: React.FC<PlaneWorkspaceUploadProgressSlotProps> = ({
  progress,
  getAriaLabel,
  cancelLabel,
  onCancel,
}) => {
  const [visible, setVisible] = useState<{ percent: number; exiting: boolean } | null>(null)

  useEffect(() => {
    if (progress != null) {
      setVisible({ percent: progress, exiting: false })
      return
    }
    setVisible(prev => {
      if (!prev || prev.exiting) return prev
      if (isReduceMotionActive()) return null
      return { percent: prev.percent, exiting: true }
    })
  }, [progress])

  useEffect(() => {
    if (!visible?.exiting) return
    const timer = window.setTimeout(
      () => setVisible(null),
      PLANE_WORKSPACE_UPLOAD_PROGRESS_EXIT_MS,
    )
    return () => window.clearTimeout(timer)
  }, [visible?.exiting])

  if (!visible) return null

  const clamped = Math.min(100, Math.max(0, Math.round(visible.percent)))

  return (
    <PlaneWorkspaceUploadProgress
      percent={visible.percent}
      exiting={visible.exiting}
      ariaLabel={getAriaLabel(clamped)}
      cancelLabel={cancelLabel}
      onCancel={onCancel}
    />
  )
}
