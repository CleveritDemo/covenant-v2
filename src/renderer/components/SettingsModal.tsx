import React, { useCallback, useEffect, useRef, useState } from 'react'
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
import { AiMarkdown } from './AiMarkdown'
// El CHANGELOG viaja dentro del bundle: no hay que leerlo del disco ni empaquetarlo aparte.
import changelogMd from '../../../CHANGELOG.md?raw'
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
  { id: 'about', icon: 'history', labelKey: 'settings.aboutSection' },
] as const

type CategoryId = (typeof CATEGORIES)[number]['id']

/** Una escritura por ráfaga de tecleo, no una por pulsación. */
const AUTOSAVE_DEBOUNCE_MS = 600

export const SettingsModal: React.FC<Props> = ({ config, onSave, onClose }) => {
  const { t } = useT()
  const [form, setForm] = useState({
    githubToken: config.githubToken,
    language: config.language,
    reduceMotion: config.reduceMotion,
    musicEnabled: config.musicEnabled,
    defaultWorkspacesDir: config.defaultWorkspacesDir ?? '',
    agentCliCommands: { ...(config.agentCliCommands ?? {}) } as Partial<Record<AgentCliProvider, string>>,
    musicPlaylistIdsByMood: { ...(config.musicPlaylistIdsByMood ?? {}) } as Record<string, string>,
  })
  const [errors, setErrors] = useState<string[]>([])
  const [category, setCategory] = useState<CategoryId>('cli')
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [footerHint, setFooterHint] = useState<'idle' | 'discarded'>('idle')
  const [tokenFieldEpoch, setTokenFieldEpoch] = useState(0)
  const [appVersion, setAppVersion] = useState('')
  /** Moods ya visitados: no se marca en rojo un ID a medio escribir. */
  const [touchedMoods, setTouchedMoods] = useState<string[]>([])
  /**
   * Snapshot al abrir (copia profunda de mapas). No se reescribe tras autosave:
   * «Descartar» vuelve siempre a este estado de apertura.
   */
  const baseline = useRef(mergeWithDefaults({
    ...config,
    agentCliCommands: { ...(config.agentCliCommands ?? {}) },
    musicPlaylistIdsByMood: { ...(config.musicPlaylistIdsByMood ?? {}) },
  }))
  /** Cambio pendiente de escribir; el cierre lo vacía sin esperar al debounce. */
  const pending = useRef<AppConfig | null>(null)
  const firstRender = useRef(true)
  /** Tras discard el commit es inmediato; el efecto no debe re-encolar otro. */
  const skipAutosaveOnce = useRef(false)

  /** Un ID no vacío que no se reconoce; derivado, sin estado que sincronizar. */
  function moodError(moodId: string): boolean {
    const raw = (form.musicPlaylistIdsByMood[moodId] ?? '').trim()
    return Boolean(raw) && parseSpotifyPlaylistId(raw) === null
  }

  // Sin efecto de resync desde `config`: AppModals remonta el modal al abrirlo, y
  // reescribir el form tras cada guardado pisaría lo que se esté escribiendo.

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]): void {
    setFooterHint('idle')
    setForm(prev => ({ ...prev, [key]: value }))
    setErrors([])
  }

  function updateAgentCliCommand(provider: AgentCliProvider, value: string): void {
    setFooterHint('idle')
    setForm(prev => ({
      ...prev,
      agentCliCommands: { ...prev.agentCliCommands, [provider]: value },
    }))
    setErrors([])
  }

  function updatePlaylistMood(moodId: string, value: string): void {
    setFooterHint('idle')
    setForm(prev => ({
      ...prev,
      musicPlaylistIdsByMood: { ...prev.musicPlaylistIdsByMood, [moodId]: value },
    }))
    setErrors([])
  }

  /**
   * Config a persistir. Los moods inválidos se omiten en vez de abortar el guardado
   * entero: una playlist mal pegada no debe impedir que se guarde el resto.
   */
  function buildConfig(): AppConfig {
    const musicPlaylistIdsByMood: Record<string, string> = {}
    for (const m of MUSIC_MOODS) {
      const raw = (form.musicPlaylistIdsByMood[m.id] ?? '').trim()
      if (!raw) continue
      const id = parseSpotifyPlaylistId(raw)
      if (!id) continue // el error ya se ve en la tarjeta del mood
      musicPlaylistIdsByMood[m.id] = id
    }

    return mergeWithDefaults({
      ...config,
      githubToken: form.githubToken.trim(),
      language: form.language,
      reduceMotion: form.reduceMotion,
      musicEnabled: form.musicEnabled,
      defaultWorkspacesDir: form.defaultWorkspacesDir.trim(),
      // Vacío = comando por defecto del proveedor; mergeWithDefaults poda las claves.
      agentCliCommands: form.agentCliCommands,
      musicPlaylistIdsByMood,
    })
  }

  const commit = useCallback(async (next: AppConfig): Promise<void> => {
    pending.current = null
    const errs = validateConfig(next)
    if (errs.length) { setErrors(errs); return }

    const result = await window.api.setConfig(next)
    if (result.ok) {
      setErrors([])
      setSavedAt(new Date())
      onSave(next)
    } else {
      setErrors(result.errors ?? [t('settings.errorSave')])
    }
  }, [onSave, t])

  // Se guarda al cambiar: un debounce por ráfaga de tecleo, no por pulsación.
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return }
    if (skipAutosaveOnce.current) {
      skipAutosaveOnce.current = false
      return
    }
    const next = buildConfig()
    pending.current = next
    const timer = setTimeout(() => void commit(next), AUTOSAVE_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [form]) // eslint-disable-line react-hooks/exhaustive-deps

  /** Escape, clic fuera y «Listo» hacen lo mismo: vaciar lo pendiente y cerrar. */
  const handleRequestClose = (): void => {
    if (pending.current) void commit(pending.current)
    onClose()
  }

  /** Hay texto que no se está guardando: el pie tiene que decirlo, no callar. */
  useEffect(() => {
    void window.api.getAppVersion().then(setAppVersion)
  }, [])

  const invalidMoods = MUSIC_MOODS.some(m => moodError(m.id))

  /**
   * Vuelve al snapshot de apertura, persiste ya (sin debounce) y da feedback.
   * El status del token se remonta para no dejar identidad obsoleta.
   */
  const handleDiscard = (): void => {
    const original = baseline.current
    skipAutosaveOnce.current = true
    pending.current = null
    setForm({
      githubToken: original.githubToken,
      language: original.language,
      reduceMotion: original.reduceMotion,
      musicEnabled: original.musicEnabled,
      defaultWorkspacesDir: original.defaultWorkspacesDir ?? '',
      agentCliCommands: { ...(original.agentCliCommands ?? {}) },
      musicPlaylistIdsByMood: { ...(original.musicPlaylistIdsByMood ?? {}) },
    })
    setTouchedMoods([])
    setErrors([])
    setTokenFieldEpoch(n => n + 1)
    setFooterHint('discarded')
    void commit(mergeWithDefaults({ ...original }))
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
          <span className="settings-status" data-state={invalidMoods ? 'warn' : undefined}>
            {invalidMoods
              ? t('settings.notSavedInvalid', { section: t('settings.spotifySection') })
              : footerHint === 'discarded'
                ? t('settings.discarded')
                : savedAt
                  ? t('settings.savedAt', { time: savedAt.toLocaleTimeString() })
                  : t('settings.savesOnChange')}
          </span>
          <Button variant="secondary" size="sm" onClick={handleDiscard}>
            {t('settings.discard')}
          </Button>
          <Button variant="primary" size="sm" onClick={handleRequestClose}>
            {t('common.done')}
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
                key={tokenFieldEpoch}
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
                    onChange={next => update('language', next as Language)}
                    options={LANGUAGES.map(l => ({ value: l.value, label: l.label }))}
                  />
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
            <>
              <SettingsSection title={t('settings.workspacesSection')}>
                <SettingsField
                  label={t('settings.defaultWorkspacesDirLabel')}
                  hint={t('settings.defaultWorkspacesDirHint')}
                >
                  <div className="settings-folder-row">
                    <Input
                      type="text"
                      size="sm"
                      readOnly
                      value={form.defaultWorkspacesDir}
                      placeholder={t('settings.defaultWorkspacesDirLabel')}
                      aria-label={t('settings.defaultWorkspacesDirLabel')}
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        void (async () => {
                          const result = await window.api.selectDirectory({
                            title: t('settings.chooseFolder'),
                            defaultPath: form.defaultWorkspacesDir.trim() || undefined,
                          })
                          if (!result.ok) return
                          update('defaultWorkspacesDir', result.path)
                        })()
                      }}
                    >
                      <Icon name="folder" size={12} />
                      {t('settings.chooseFolder')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={!form.defaultWorkspacesDir.trim()}
                      onClick={() => update('defaultWorkspacesDir', '')}
                    >
                      {t('settings.clearFolder')}
                    </Button>
                  </div>
                </SettingsField>
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
            </>
          )}

          {category === 'about' && (
            <SettingsSection title={t('settings.aboutVersion', { version: appVersion })}>
              <div className="settings-changelog">
                <AiMarkdown content={changelogMd} />
              </div>
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
