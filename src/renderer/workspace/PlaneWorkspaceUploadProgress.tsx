import React from 'react'
import { Icon } from '../components/ui/Icon'
import { Tooltip } from '../components/ui/Tooltip'
import './PlaneWorkspaceUploadProgress.css'

export interface PlaneWorkspaceUploadProgressProps {
  percent: number
  ariaLabel: string
  cancelLabel: string
  onCancel: () => void
}

export const PlaneWorkspaceUploadProgress: React.FC<PlaneWorkspaceUploadProgressProps> = ({
  percent,
  ariaLabel,
  cancelLabel,
  onCancel,
}) => {
  const clamped = Math.min(100, Math.max(0, Math.round(percent)))

  return (
    <div
      className="plane-workspace-upload-progress"
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
    >
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
          onClick={onCancel}
        >
          <Icon name="close" size={10} />
        </button>
      </Tooltip>
    </div>
  )
}
