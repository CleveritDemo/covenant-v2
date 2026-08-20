import React from 'react'
import { Skeleton } from './ui/Skeleton'
import './OrgsSkeleton.css'

export function OrgsNavSkeleton({
  rows,
  withAvatar = false,
  label,
}: {
  rows: number
  withAvatar?: boolean
  label: string
}): React.ReactElement {
  return (
    <ul className="orgs-skeleton" role="status" aria-label={label}>
      {Array.from({ length: rows }, (_, index) => (
        <li key={index} className="orgs-skeleton__row">
          {withAvatar ? <Skeleton radius="circle" width={22} height={22} /> : null}
          <span className="orgs-skeleton__text">
            <Skeleton width="62%" height={11} />
            <Skeleton width="38%" height={9} />
          </span>
        </li>
      ))}
    </ul>
  )
}

export function OrgsDetailSkeleton({ label }: { label: string }): React.ReactElement {
  return (
    <div className="orgs-skeleton-detail" role="status" aria-label={label}>
      <div className="orgs-skeleton-detail__head">
        <span className="orgs-skeleton-detail__title">
          <Skeleton width={220} height={17} />
        </span>
        <Skeleton width={104} height={28} radius="pill" />
      </div>
      <div className="orgs-skeleton-detail__body">
        {[0, 1].map(index => (
          <div key={index} className="orgs-skeleton-detail__section">
            <Skeleton width={90} height={9} />
            <div className="orgs-skeleton-detail__chips">
              <Skeleton width={132} height={22} radius="pill" />
              <Skeleton width={132} height={22} radius="pill" />
              <Skeleton width={132} height={22} radius="pill" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
