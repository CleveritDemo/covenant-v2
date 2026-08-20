import React from 'react'
import { useT } from '@i18n/useT'
import { Button, Input } from '../components/ui'
import { Icon } from '../components/ui/Icon'
import './TabContextSearchBar.css'

export interface TabContextSearchBarProps {
  value: string
  onChange: (value: string) => void
  matchCount: number
  activeIndex: number
  onPrev: () => void
  onNext: () => void
  onClear: () => void
  ariaLabel: string
}

export const TabContextSearchBar: React.FC<TabContextSearchBarProps> = ({
  value,
  onChange,
  matchCount,
  activeIndex,
  onPrev,
  onNext,
  onClear,
  ariaLabel,
}) => {
  const { t } = useT()
  const showCounter = value.trim().length >= 2
  const counterLabel = !showCounter
    ? null
    : matchCount === 0
      ? t('tabContexts.bodySearchNoMatches')
      : t('tabContexts.bodySearchCount', { current: activeIndex + 1, total: matchCount })

  return (
    <div className="tab-context-search-bar">
      <Input
        size="sm"
        type="search"
        value={value}
        placeholder={t('tabContexts.bodySearchPlaceholder')}
        aria-label={ariaLabel}
        onChange={event => onChange(event.target.value)}
        onKeyDown={event => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            onNext()
          } else if (event.key === 'Enter' && event.shiftKey) {
            event.preventDefault()
            onPrev()
          } else if (event.key === 'Escape') {
            event.preventDefault()
            onClear()
          }
        }}
      />
      {counterLabel ? (
        <span className="tab-context-search-bar__count" aria-live="polite">
          {counterLabel}
        </span>
      ) : null}
      <div className="tab-context-search-bar__nav">
        <Button
          variant="ghost"
          size="sm"
          disabled={matchCount === 0}
          aria-label={t('tabContexts.bodySearchPrev')}
          onClick={onPrev}
        >
          <Icon name="chevron-up" size={14} />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={matchCount === 0}
          aria-label={t('tabContexts.bodySearchNext')}
          onClick={onNext}
        >
          <Icon name="chevron-down" size={14} />
        </Button>
      </div>
    </div>
  )
}
