import React, { useEffect, useState } from 'react'
import { Icon } from '../components/ui/Icon'
import { Tooltip } from '../components/ui/Tooltip'
import { isReduceMotionActive } from '../reduceMotion'
import './PlaneWorkspaceUploadProgress.css'

export const PLANE_WORKSPACE_UPLOAD_PROGRESS_EXIT_MS = 360

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
      <span className="plane-workspace-upload-progress__pulse" aria-hidden="true" />
      <div className="plane-workspace-upload-progress__track">
        <div
          className="plane-workspace-upload-progress__fill"
          style={{ ['--plane-upload-progress-percent' as string]: `${clamped}%` }}
        />
      </div>
      <span className="plane-workspace-upload-progress__percent" aria-hidden="true">
        {clamped}%
      </span>
      <Tooltip content={cancelLabel}>
        <button
          type="button"
          className="plane-workspace-upload-progress__cancel"
          aria-label={cancelLabel}
          disabled={exiting}
          onClick={onCancel}
        >
          <Icon name="close" size={10} />
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
