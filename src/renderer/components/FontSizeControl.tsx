import React from 'react'
import { useT } from '@i18n/useT'
import { Button } from './ui/Button'
import { Icon } from './ui/Icon'

interface FontSizeControlProps {
  fontSize: number
  min: number
  max: number
  onIncrease: () => void
  onDecrease: () => void
}

export const FontSizeControl: React.FC<FontSizeControlProps> = ({
  fontSize,
  min,
  max,
  onIncrease,
  onDecrease,
}) => {
  const { t } = useT()
  return (
    <>
      <Button
        variant="icon"
        size="sm"
        tabIndex={-1}
        onClick={onDecrease}
        disabled={fontSize <= min}
        title={t('ui.decreaseFontTitle')}
        aria-label={t('ui.decreaseFontTitle')}
      >
        <Icon name="zoom-out" size={14} />
      </Button>
      <Button
        variant="icon"
        size="sm"
        tabIndex={-1}
        onClick={onIncrease}
        disabled={fontSize >= max}
        title={t('ui.increaseFontTitle')}
        aria-label={t('ui.increaseFontTitle')}
      >
        <Icon name="zoom-in" size={14} />
      </Button>
    </>
  )
}
