import React from 'react'
import { Button } from '../components/ui/Button'
import { useT } from '@i18n/useT'

interface Props {
  value: string
  projectCwd: string
  onChange: (rootPath: string | undefined) => void
  onPickError?: (message: string) => void
}

/** Selector de subcarpeta relativa al proyecto para contextos host (symbols, etc.). */
export const TabContextRootPathField: React.FC<Props> = ({
  value,
  projectCwd,
  onChange,
  onPickError,
}) => {
  const { t } = useT()

  const pickFolder = async (): Promise<void> => {
    const cwd = projectCwd.trim()
    if (!cwd) {
      onPickError?.(t('tabContexts.missingCwd'))
      return
    }
    const result = await window.api.selectDirectory({
      title: t('tabContexts.pickRootTitle'),
      defaultPath: value.trim() || cwd,
      withinPath: cwd,
    })
    if (!result.ok) {
      if (result.cancelled) return
      onPickError?.(
        result.error === 'outside project folder'
          ? t('tabContexts.rootOutsideProject')
          : (result.error ?? t('tabContexts.previewError')),
      )
      return
    }
    const relativePath = result.relativePath?.trim()
    onChange(!relativePath || relativePath === '.' ? '.' : relativePath)
  }

  return (
    <label>
      <span>{t('tabContexts.rootPath')}</span>
      <div className="tab-contexts__root-row">
        <input
          value={value}
          placeholder={t('tabContexts.rootPlaceholder')}
          onChange={event => {
            const next = event.target.value.trim()
            onChange(next || undefined)
          }}
        />
        <Button variant="secondary" size="sm" onClick={() => { void pickFolder() }}>
          {t('tabContexts.pickRoot')}
        </Button>
        {value.trim() ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange(undefined)}
          >
            {t('tabContexts.clearRoot')}
          </Button>
        ) : null}
      </div>
      <small>{t('tabContexts.rootHint')}</small>
    </label>
  )
}
