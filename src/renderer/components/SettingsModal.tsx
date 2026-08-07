import React, { useEffect, useState } from 'react'
import type { AppConfig, Language } from '@shared/configSchema'
import { validateConfig, mergeWithDefaults, parseSpotifyPlaylistId } from '@shared/configSchema'
import { MUSIC_MOODS } from '@shared/musicMoods'
import type { AgentCliProvider } from '@shared/agentCliProviders'
import { useT } from '@i18n/useT'
import { TerminalModal } from './TerminalModal'
import { SettingsSection, SettingsField } from './SettingsSection'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Select } from './ui/Select'
import { SettingToggle } from './ui/SettingToggle'
import { Icon } from './ui/Icon'
import { AgentCliTable } from './AgentCliTable'
import { GitHubTokenField } from './GitHubTokenField'
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

const CATEGORIES = [
  { id: 'cli', icon: 'bot', labelKey: 'settings.agentCliSection' },
  { id: 'github', icon: 'git-branch', labelKey: 'settings.githubSection' },
  { id: 'appearance', icon: 'sparkles', labelKey: 'settings.appearanceSection' },
  { id: 'music', icon: 'play', labelKey: 'settings.spotifySection' },
  { id: 'advanced', icon: 'folder', labelKey: 'settings.advancedSection' },
] as const

type CategoryId = (typeof CATEGORIES)[number]['id']

export const SettingsModal: React.FC<Props> = ({ config, onSave, onClose }) => {
  const { t } = useT()
  const [form, setForm] = useState({
    githubToken: config.githubToken,
    language: config.language,
    reduceMotion: config.reduceMotion,
    musicEnabled: config.musicEnabled,
    agentCliCommands: { ...(config.agentCliCommands ?? {}) } as Partial<Record<AgentCliProvider, string>>,
    musicPlaylistIdsByMood: { ...(config.musicPlaylistIdsByMood ?? {}) } as Record<string, string>,
  })
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [category, setCategory] = useState<CategoryId>('cli')
  /** Moods ya visitados: no se marca en rojo un ID a medio escribir. */
  const [touchedMoods, setTouchedMoods] = useState<string[]>([])

  /** Un ID no vacío que no se reconoce; derivado, sin estado que sincronizar. */
  function moodError(moodId: string): boolean {
    const raw = (form.musicPlaylistIdsByMood[moodId] ?? '').trim()
    return Boolean(raw) && parseSpotifyPlaylistId(raw) === null
  }

  useEffect(() => {
    setForm({
      githubToken: config.githubToken,
      language: config.language,
      reduceMotion: config.reduceMotion,
      musicEnabled: config.musicEnabled,
      agentCliCommands: { ...(config.agentCliCommands ?? {}) },
      musicPlaylistIdsByMood: { ...(config.musicPlaylistIdsByMood ?? {}) },
    })
  }, [config])

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]): void {
    setForm(prev => ({ ...prev, [key]: value }))
    setErrors([])
  }

  function updateAgentCliCommand(provider: AgentCliProvider, value: string): void {
    setForm(prev => ({
      ...prev,
      agentCliCommands: { ...prev.agentCliCommands, [provider]: value },
    }))
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
    const badMoods = MUSIC_MOODS.filter(m => moodError(m.id))
    if (badMoods.length > 0) {
      // El error ya se ve en cada tarjeta; hay que descubrirlas y llevar allí al usuario.
      setTouchedMoods(MUSIC_MOODS.map(m => m.id))
      setCategory('music')
      return
    }
    for (const m of MUSIC_MOODS) {
      const raw = (form.musicPlaylistIdsByMood[m.id] ?? '').trim()
      if (!raw) { delete musicPlaylistIdsByMood[m.id]; continue }
      musicPlaylistIdsByMood[m.id] = parseSpotifyPlaylistId(raw) as string
    }

    const updated = mergeWithDefaults({
      ...config,
      githubToken: form.githubToken.trim(),
      language: form.language,
      reduceMotion: form.reduceMotion,
      musicEnabled: form.musicEnabled,
      // Vacío = comando por defecto del proveedor; mergeWithDefaults poda las claves.
      agentCliCommands: form.agentCliCommands,
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
      bodyLayout="flush"
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
      <div className="settings-layout">
        <nav className="settings-nav" aria-label={t('settings.title')}>
          {CATEGORIES.map(c => (
            <button
              key={c.id}
              type="button"
              className="settings-nav__item"
              aria-current={category === c.id ? 'page' : undefined}
              onClick={() => setCategory(c.id)}
            >
              <Icon name={c.icon} size={13} aria-hidden />
              {t(c.labelKey)}
            </button>
          ))}
        </nav>

        <div className="settings-panel">
          {category === 'cli' && (
            <SettingsSection title={t('settings.agentCliSection')}>
              <AgentCliTable
                commands={form.agentCliCommands}
                onChange={updateAgentCliCommand}
              />
            </SettingsSection>
          )}

          {category === 'github' && (
            <SettingsSection title={t('settings.githubSection')}>
              <GitHubTokenField
                value={form.githubToken}
                onChange={token => update('githubToken', token)}
              />
            </SettingsSection>
          )}

          {category === 'appearance' && (
            <>
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
            </>
          )}

          {category === 'music' && (
            <SettingsSection title={t('settings.spotifySection')}>
              <SettingToggle
                checked={form.musicEnabled}
                onChange={checked => update('musicEnabled', checked)}
                title={t('settings.musicEnabledTitle')}
                description={t('settings.musicEnabledDescription')}
              />
              {form.musicEnabled && (
                <>
                  <p className="settings-hint settings-hint--block">{t('settings.spotifyHint')}</p>
                  <div className="settings-spotify-grid">
                    {MUSIC_MOODS.map(m => {
                      const invalid = touchedMoods.includes(m.id) && moodError(m.id)
                      return (
                        <div key={m.id} className="settings-spotify-row">
                          <SettingsField
                            label={m.label}
                            htmlFor={`settings-pl-${m.id}`}
                            error={invalid ? t('settings.spotifyError', { label: m.label }) : undefined}
                            compact
                          >
                            <Input
                              id={`settings-pl-${m.id}`}
                              type="text"
                              placeholder={t('settings.spotifyPlaceholder')}
                              autoComplete="off"
                              spellCheck={false}
                              aria-invalid={invalid || undefined}
                              value={form.musicPlaylistIdsByMood[m.id] ?? ''}
                              onChange={e => updatePlaylistMood(m.id, e.target.value)}
                              onBlur={() => setTouchedMoods(prev =>
                                prev.includes(m.id) ? prev : [...prev, m.id],
                              )}
                            />
                          </SettingsField>
                        </div>
                      )
                    })}
                  </div>
                  <span className="settings-hint">{t('settings.spotifyInputHint')}</span>
                </>
              )}
            </SettingsSection>
          )}

          {category === 'advanced' && (
            <SettingsSection title={t('settings.configSection')}>
              <p className="settings-hint settings-hint--block">{t('settings.configHint')}</p>
              <Button variant="secondary" size="sm" onClick={() => window.api.openConfigFolder()}>
                <Icon name="folder" size={12} />
                {typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform)
                  ? t('settings.revealConfig')
                  : t('settings.revealConfigWin')}
              </Button>
            </SettingsSection>
          )}

          {errors.length > 0 && (
            <div className="settings-errors">
              {errors.map((e, i) => <p key={i}>{e}</p>)}
            </div>
          )}
        </div>
      </div>
    </TerminalModal>
  )
}
