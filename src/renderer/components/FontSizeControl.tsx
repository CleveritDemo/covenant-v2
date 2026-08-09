import React from 'react'
import { useT } from '@i18n/useT'
import { Button } from './ui/Button'
import { Icon } from './ui/Icon'
import { Tooltip } from './ui/Tooltip'

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
      <Tooltip content={t('ui.decreaseFontTitle')}>
        <Button
          variant="icon"
          size="sm"
          tabIndex={-1}
          onClick={onDecrease}
          disabled={fontSize <= min}
          aria-label={t('ui.decreaseFontTitle')}
        >
          <Icon name="zoom-out" size={14} />
        </Button>
      </Tooltip>
      <Tooltip content={t('ui.increaseFontTitle')}>
        <Button
          variant="icon"
          size="sm"
          tabIndex={-1}
          onClick={onIncrease}
          disabled={fontSize >= max}
          aria-label={t('ui.increaseFontTitle')}
        >
          <Icon name="zoom-in" size={14} />
        </Button>
      </Tooltip>
    </>
  )
}
