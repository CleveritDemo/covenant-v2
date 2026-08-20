import React from 'react'
import './Skeleton.css'

export interface SkeletonProps {
  width?: number | string
  height?: number
  radius?: 'sm' | 'md' | 'pill' | 'circle'
}

/** Placeholder de carga con geometría fija; el barrido respeta reduce-motion. */
export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 12,
  radius = 'sm',
}) => (
  <span
    className={`skeleton skeleton--${radius}`}
    style={{ width, height }}
    aria-hidden="true"
  />
)
