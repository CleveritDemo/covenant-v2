import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { getTheme, getThemesForPicker } from '@themes/presets'
import { useT } from '@i18n/useT'
import { TerminalModal } from './TerminalModal'
import { ThemePreview } from './ThemePreview'
import { ThemeChip } from './ThemeChip'
import { ThemePickerAudioControls, type ThemePickerAudioPartial } from './ThemePickerAudioControls'
import { Input } from './ui/Input'
import './ThemePickerModal.css'

function themeMatchesQuery(theme: { name: string; id: string }, q: string): boolean {
  const s = q.trim().toLowerCase()
  if (!s) return true
  return theme.name.toLowerCase().includes(s) || theme.id.toLowerCase().includes(s)
}

function isThemePickerNavBlockedTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  if (el.closest('[data-theme-picker-audio]')) return true
  if (el.closest('input[type="search"]')) return true
  return false
}

interface Props {
  open: boolean
  currentThemeId: string
  musicEnabled: boolean
  onSelectTheme: (themeId: string) => void
  onAudioConfigChange: (partial: ThemePickerAudioPartial) => void
  onClose: () => void
}

export const ThemePickerModal: React.FC<Props> = ({
  open,
  currentThemeId,
  musicEnabled,
  onSelectTheme,
  onAudioConfigChange,
  onClose,
}) => {
  const { t } = useT()
  const pickerThemes = useMemo(() => getThemesForPicker(), [])
  const [filter, setFilter] = useState('')
  const filteredThemes = useMemo(
    () => pickerThemes.filter(theme => themeMatchesQuery(theme, filter)),
    [pickerThemes, filter],
  )

  const groupedThemes = useMemo(() => {
    // Familia × apariencia. `family` sin valor es `cinematic`, que es el grueso
    // del catálogo; las marcas se listan aparte para no diluirse entre ellas.
    const pick = (family: 'cinematic' | 'credicorp', light: boolean) =>
      filteredThemes.filter(theme =>
        (theme.family ?? 'cinematic') === family
        && (theme.appearance === 'light') === light)
    return [
      { key: 'cinematic-dark', title: 'Cinematic — dark', themes: pick('cinematic', false) },
      { key: 'cinematic-light', title: 'Cinematic — light', themes: pick('cinematic', true) },
      { key: 'credicorp-dark', title: 'Credicorp — dark', themes: pick('credicorp', false) },
      { key: 'credicorp-light', title: 'Credicorp — light', themes: pick('credicorp', true) },
    ].filter(group => group.themes.length > 0)
  }, [filteredThemes])

  const [focusedId, setFocusedId] = useState(currentThemeId)

  useEffect(() => {
    if (open) { setFocusedId(currentThemeId); setFilter('') }
  }, [open, currentThemeId])

  useEffect(() => {
    if (!open) return
    if (filteredThemes.some(theme => theme.id === focusedId)) return
    const preferred = filteredThemes.find(theme => theme.id === currentThemeId)?.id ?? filteredThemes[0]?.id
    if (preferred) setFocusedId(preferred)
  }, [open, filteredThemes, focusedId, currentThemeId])

  const focusedTheme = useMemo(() => getTheme(focusedId), [focusedId])

  const applyThemeId = useCallback((id: string) => { onSelectTheme(id) }, [onSelectTheme])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (isThemePickerNavBlockedTarget(e.target)) return
      if (e.key === 'Enter' && focusedId && filteredThemes.length > 0) {
        e.preventDefault(); e.stopPropagation(); applyThemeId(focusedId); return
      }
      if (e.key === 'ArrowRight' && filteredThemes.length > 0) {
        e.preventDefault()
        const i = filteredThemes.findIndex(theme => theme.id === focusedId)
        const from = i < 0 ? -1 : i
        setFocusedId(filteredThemes[(from + 1 + filteredThemes.length) % filteredThemes.length].id)
      }
      if (e.key === 'ArrowLeft' && filteredThemes.length > 0) {
        e.preventDefault()
        const i = filteredThemes.findIndex(theme => theme.id === focusedId)
        const from = i < 0 ? 0 : i
        setFocusedId(filteredThemes[(from - 1 + filteredThemes.length) % filteredThemes.length].id)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, focusedId, applyThemeId, filteredThemes])

  return (
    <TerminalModal
      open={open}
      onClose={onClose}
      title={t('themePicker.title')}
      titleId="theme-picker-title"
      size="xl"
      panelVariant="theme-picker"
      zIndex={660}
      bodyLayout="flush"
      closeOnBackdrop
      footer={
        <span className="theme-picker-footer-hint">
          {t('themePicker.footerHint')}
        </span>
      }
    >
      <div className="theme-picker-scroll">
        <div className="theme-picker-preview-wrap">
          <ThemePreview theme={focusedTheme} currentThemeId={currentThemeId} />
        </div>
        <ThemePickerAudioControls
          musicEnabled={musicEnabled}
          onAudioConfigChange={onAudioConfigChange}
        />
        <div className="theme-picker-spacer" aria-hidden="true" />
        <div className="theme-picker-sticky-stack">
          <div className="theme-picker-rail-label theme-picker-rail-label--path">
            {t('themePicker.previewLabel')}
          </div>
          <Input
            type="search"
            size="md"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder={t('themePicker.filterPlaceholder')}
            aria-label={t('themePicker.filterAriaLabel')}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
          />
          <div className="theme-picker-theme-grid" role="listbox" aria-label={t('themePicker.listAriaLabel')}>
            {filteredThemes.length === 0 && (
              <div className="theme-picker-empty" role="status">
                {t('themePicker.emptyState', { filter: filter.trim() })}
              </div>
            )}
            {groupedThemes.map(group => (
              <React.Fragment key={group.key}>
                <div className="theme-picker-grid-section-title">{group.title}</div>
                {group.themes.map(theme => (
                  <ThemeChip
                    key={theme.id}
                    theme={theme}
                    isActive={theme.id === currentThemeId}
                    isFocused={theme.id === focusedId}
                    onSelect={() => applyThemeId(theme.id)}
                    onHover={() => setFocusedId(theme.id)}
                  />
                ))}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </TerminalModal>
  )
}
