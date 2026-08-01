import React, { useEffect, useState } from 'react'
import type { AppConfig, Language } from '@shared/configSchema'
import { validateConfig, mergeWithDefaults, parseSpotifyPlaylistId } from '@shared/configSchema'
import { MUSIC_MOODS } from '@shared/musicMoods'
import { useT } from '@i18n/useT'
import { TerminalModal } from './TerminalModal'
import { SettingsSection, SettingsField } from './SettingsSection'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Select } from './ui/Select'
import { SettingToggle } from './ui/SettingToggle'
import { Icon } from './ui/Icon'
import './SettingsModal.css'

interface Props {
  config: AppConfig
  onSave: (config: AppConfig) => void
  onClose: () => void
}

const LANGUAGES: { value: Language; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
]

export const SettingsModal: React.FC<Props> = ({ config, onSave, onClose }) => {
  const { t } = useT()
  const [form, setForm] = useState({
    githubToken: config.githubToken,
    language: config.language,
    reduceMotion: config.reduceMotion,
    agentCliClaudeCommand: config.agentCliClaudeCommand,
    agentCliCursorCommand: config.agentCliCursorCommand,
    musicPlaylistIdsByMood: { ...(config.musicPlaylistIdsByMood ?? {}) } as Record<string, string>,
  })
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<string[]>([])

  useEffect(() => {
    setForm({
      githubToken: config.githubToken,
      language: config.language,
      reduceMotion: config.reduceMotion,
      agentCliClaudeCommand: config.agentCliClaudeCommand,
      agentCliCursorCommand: config.agentCliCursorCommand,
      musicPlaylistIdsByMood: { ...(config.musicPlaylistIdsByMood ?? {}) },
    })
  }, [config])

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]): void {
    setForm(prev => ({ ...prev, [key]: value }))
    setErrors([])
  }

  function updatePlaylistMood(moodId: string, value: string): void {
    setForm(prev => ({
      ...prev,
      musicPlaylistIdsByMood: { ...prev.musicPlaylistIdsByMood, [moodId]: value },
    }))
    setErrors([])
  }

  async function handleSave(): Promise<void> {
    const musicPlaylistIdsByMood: Record<string, string> = { ...(config.musicPlaylistIdsByMood ?? {}) }
    for (const m of MUSIC_MOODS) {
      const raw = (form.musicPlaylistIdsByMood[m.id] ?? '').trim()
      if (!raw) { delete musicPlaylistIdsByMood[m.id]; continue }
      const id = parseSpotifyPlaylistId(raw)
      if (!id) {
        setErrors([t('settings.spotifyError', { label: m.label })])
        return
      }
      musicPlaylistIdsByMood[m.id] = id
    }

    const updated = mergeWithDefaults({
      ...config,
      githubToken: form.githubToken.trim(),
      language: form.language,
      reduceMotion: form.reduceMotion,
      agentCliClaudeCommand: form.agentCliClaudeCommand.trim(),
      agentCliCursorCommand: form.agentCliCursorCommand.trim(),
      musicPlaylistIdsByMood,
    })
    const errs = validateConfig(updated)
    if (errs.length) { setErrors(errs); return }

    setSaving(true)
    const result = await window.api.setConfig(updated)
    setSaving(false)

    if (result.ok) { onSave(updated); onClose() }
    else setErrors(result.errors ?? [t('settings.errorSave')])
  }

  /** Cierre por backdrop/Escape: guardar en vez de descartar (Cancelar sigue descartando). */
  const handleRequestClose = (): void => {
    if (saving) return
    void handleSave()
  }

  return (
    <TerminalModal
      open
      onClose={handleRequestClose}
      title={t('settings.title')}
      size="lg"
      zIndex={720}
      bodyLayout="spacious"
      closeOnBackdrop
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" size="sm" onClick={() => void handleSave()} disabled={saving}>
            {saving ? t('common.saving') : t('common.save')}
          </Button>
        </>
      }
    >
      <SettingsSection title={t('settings.agentCliSection')}>
        <p className="settings-hint settings-hint--block">{t('settings.agentCliHint')}</p>
        <SettingsField label={t('settings.agentCliClaudeLabel')}>
          <Input
            type="text"
            value={form.agentCliClaudeCommand}
            onChange={e => update('agentCliClaudeCommand', e.target.value)}
            placeholder="claude"
            spellCheck={false}
          />
        </SettingsField>
        <SettingsField label={t('settings.agentCliCursorLabel')}>
          <Input
            type="text"
            value={form.agentCliCursorCommand}
            onChange={e => update('agentCliCursorCommand', e.target.value)}
            placeholder="agent"
            spellCheck={false}
          />
        </SettingsField>
      </SettingsSection>

      <SettingsSection title={t('settings.githubSection')}>
        <SettingsField
          label={t('settings.githubTokenLabel')}
          hint={
            <>
              {t('settings.githubTokenHint')}{' '}
              <button
                type="button"
                className="settings-inline-link"
                onClick={() => void window.api.openExternalUrl('https://github.com/settings/tokens')}
              >
                github.com/settings/tokens
              </button>
            </>
          }
        >
          <Input
            type="password"
            value={form.githubToken}
            onChange={e => update('githubToken', e.target.value)}
            placeholder={t('settings.githubTokenPlaceholder')}
            spellCheck={false}
            autoComplete="off"
          />
        </SettingsField>
      </SettingsSection>

      <SettingsSection title={t('settings.languageSection')}>
        <SettingsField label={t('settings.languageLabel')}>
          <Select
            value={form.language}
            onChange={e => update('language', e.target.value as Language)}
          >
            {LANGUAGES.map(l => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </Select>
        </SettingsField>
      </SettingsSection>

      <SettingsSection title={t('settings.motionSection')}>
        <SettingToggle
          checked={form.reduceMotion}
          onChange={checked => update('reduceMotion', checked)}
          title={t('settings.reduceMotionTitle')}
          description={t('settings.reduceMotionDescription')}
        />
      </SettingsSection>

      <SettingsSection title={t('settings.spotifySection')}>
        <p className="settings-hint settings-hint--block">{t('settings.spotifyHint')}</p>
        <div className="settings-spotify-grid">
          {MUSIC_MOODS.map(m => (
            <div key={m.id} className="settings-spotify-row">
              <SettingsField label={m.label} htmlFor={`settings-pl-${m.id}`} compact>
                <Input
                  id={`settings-pl-${m.id}`}
                  type="text"
                  placeholder={t('settings.spotifyPlaceholder')}
                  autoComplete="off"
                  spellCheck={false}
                  value={form.musicPlaylistIdsByMood[m.id] ?? ''}
                  onChange={e => updatePlaylistMood(m.id, e.target.value)}
                />
              </SettingsField>
            </div>
          ))}
        </div>
        <span className="settings-hint">{t('settings.spotifyInputHint')}</span>
      </SettingsSection>

      <SettingsSection title={t('settings.configSection')}>
        <p className="settings-hint settings-hint--block">{t('settings.configHint')}</p>
        <Button variant="secondary" size="sm" onClick={() => window.api.openConfigFolder()}>
          <Icon name="folder" size={12} />
          {typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform)
            ? t('settings.revealConfig')
            : t('settings.revealConfigWin')}
        </Button>
      </SettingsSection>

      {errors.length > 0 && (
        <div className="settings-errors">
          {errors.map((e, i) => <p key={i}>{e}</p>)}
        </div>
      )}
    </TerminalModal>
  )
}
