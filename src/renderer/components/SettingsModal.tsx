import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AppConfig, Language } from '@shared/configSchema'
import { validateConfig, mergeWithDefaults, parseSpotifyPlaylistId } from '@shared/configSchema'
import { MUSIC_MOODS } from '@shared/musicMoods'
import { filterSettingsEntries } from '@shared/settingsSearch'
import { UI_FONTS, MONO_FONTS } from '@shared/fontStacks'
import { availableFonts, isFontInstalled, isMonospaced } from '@renderer/fontAvailability'
import type { AgentCliProvider } from '@shared/agentCliProviders'
import { useT } from '@i18n/useT'
import { TerminalModal } from './TerminalModal'
import { SettingsSection, SettingsField } from './SettingsSection'
import { CodeIntelligenceSettings } from '../lsp/CodeIntelligenceSettings'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Select } from './ui/Select'
import { SettingToggle } from './ui/SettingToggle'
import { Icon } from './ui/Icon'
import { AgentCliTable } from './AgentCliTable'
import { GitHubTokenField } from './GitHubTokenField'
import { AiMarkdown } from './AiMarkdown'
import { QuitConfirmModal } from './QuitConfirmModal'
import { replaySplash } from '../splash'
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
  { id: 'updates', icon: 'refresh', labelKey: 'settings.updatesSection' },
  { id: 'about', icon: 'history', labelKey: 'settings.aboutSection' },
  { id: 'developer', icon: 'code', labelKey: 'settings.developerSection' },
] as const

type CategoryId = (typeof CATEGORIES)[number]['id']

/**
 * Índice del buscador: una entrada por sección, con las etiquetas de sus campos
 * como términos que también hacen match aunque no se muestren. Buscar «fuente»
 * tiene que llevar a Tipografía, y «rich presence» a Discord.
 *
 * ponytail: escrito a mano y no derivado de los componentes. Son ~12 entradas y
 * el compilador no puede saber qué campo vive en qué sección; si algún día se
 * desincroniza, el upgrade es declarar las secciones como datos y renderizarlas
 * desde ahí, no un extractor de i18n.
 */
const SEARCH_INDEX = [
  { category: 'cli', anchor: 'settings-cli', titleKey: 'settings.agentCliSection', termKeys: ['settings.agentCliHint', 'settings.cliCommandLabel'] },
  { category: 'github', anchor: 'settings-github', titleKey: 'settings.githubSection', termKeys: ['settings.githubTokenLabel', 'settings.githubTokenHint'] },
  { category: 'appearance', anchor: 'settings-typography', titleKey: 'settings.typographySection', termKeys: ['settings.fontUiLabel', 'settings.fontMonoLabel', 'settings.fontCustomLabel'] },
  { category: 'appearance', anchor: 'settings-language', titleKey: 'settings.languageSection', termKeys: ['settings.languageLabel'] },
  { category: 'appearance', anchor: 'settings-motion', titleKey: 'settings.motionSection', termKeys: ['settings.reduceMotionTitle', 'settings.reduceMotionDescription'] },
  { category: 'music', anchor: 'settings-spotify', titleKey: 'settings.spotifySection', termKeys: ['settings.musicEnabledTitle', 'settings.spotifyHint'] },
  { category: 'advanced', anchor: 'settings-discord', titleKey: 'settings.discordSection', termKeys: ['settings.discordPresenceTitle'] },
  { category: 'advanced', anchor: 'settings-workspaces', titleKey: 'settings.workspacesSection', termKeys: ['settings.defaultWorkspacesDirLabel', 'settings.defaultWorkspacesDirHint'] },
  { category: 'advanced', anchor: 'settings-config', titleKey: 'settings.configSection', termKeys: ['settings.configHint', 'settings.revealConfig'] },
  { category: 'advanced', anchor: 'settings-lsp', titleKey: 'lsp.settings.title', termKeys: ['lsp.settings.masterToggle', 'lsp.settings.hint'] },
  { category: 'developer', anchor: 'settings-developer', titleKey: 'settings.developerSection', termKeys: ['settings.splashLabel', 'settings.quitModalLabel'] },
  { category: 'updates', anchor: 'settings-updates', titleKey: 'settings.updatesSection', termKeys: ['settings.autoUpdatesTitle', 'settings.checkUpdates'] },
  { category: 'about', anchor: 'settings-about', titleKey: 'settings.aboutSection', termKeys: ['settings.aboutVersion'] },
  // `as const` no es decoración: sin literales, `t()` rechaza las claves.
] as const

/** Una escritura por ráfaga de tecleo, no una por pulsación. */
const AUTOSAVE_DEBOUNCE_MS = 600

export const SettingsModal: React.FC<Props> = ({ config, onSave, onClose }) => {
  const { t } = useT()
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({
    githubToken: config.githubToken,
    language: config.language,
    reduceMotion: config.reduceMotion,
    musicEnabled: config.musicEnabled,
    discordPresenceEnabled: config.discordPresenceEnabled,
    autoUpdatesEnabled: config.autoUpdatesEnabled !== false,
    defaultWorkspacesDir: config.defaultWorkspacesDir ?? '',
    fontUi: config.fontUi ?? '',
    fontMono: config.fontMono ?? '',
    agentCliCommands: { ...(config.agentCliCommands ?? {}) } as Partial<Record<AgentCliProvider, string>>,
    musicPlaylistIdsByMood: { ...(config.musicPlaylistIdsByMood ?? {}) } as Record<string, string>,
  })
  const [errors, setErrors] = useState<string[]>([])
  const [category, setCategory] = useState<CategoryId>('cli')

  const searchResults = useMemo(() => filterSettingsEntries(
    SEARCH_INDEX.map(entry => ({
      ...entry,
      title: t(entry.titleKey),
      categoryLabel: t(
        CATEGORIES.find(c => c.id === entry.category)?.labelKey ?? entry.titleKey,
      ),
      terms: (entry.termKeys ?? []).map(key => t(key)),
    })),
    search,
  ), [search, t])

  /**
   * La sección se monta al cambiar de categoría, así que el scroll va en el
   * frame siguiente: en este todavía no existe el ancla.
   */
  const goToResult = useCallback((result: { category: CategoryId; anchor: string }): void => {
    setCategory(result.category)
    setSearch('')
    requestAnimationFrame(() => {
      const target = document.getElementById(result.anchor)
      target?.scrollIntoView({ block: 'start', behavior: 'smooth' })
      target?.classList.add('settings-section--found')
      window.setTimeout(() => target?.classList.remove('settings-section--found'), 1400)
    })
  }, [])
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [footerHint, setFooterHint] = useState<'idle' | 'discarded'>('idle')
  const [tokenFieldEpoch, setTokenFieldEpoch] = useState(0)
  const [appVersion, setAppVersion] = useState('')
  const [checking, setChecking] = useState(false)
  const [forcing, setForcing] = useState(false)
  const [checkMsg, setCheckMsg] = useState('')
  /** Moods ya visitados: no se marca en rojo un ID a medio escribir. */
  /** Preview del confirm de salida (no cierra la app). */
  const [quitPreview, setQuitPreview] = useState(false)
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

  /**
   * Catálogo curado filtrado por lo instalado, más la elección actual aunque venga
   * del campo libre: un ajuste guardado nunca desaparece del desplegable.
   */
  const fontOptions = useMemo(() => {
    const build = (catalog: readonly string[], current: string): { value: string; label: string }[] => {
      const list = availableFonts(catalog)
      const withCurrent = current && !list.includes(current) ? [current, ...list] : list
      return [
        { value: '', label: t('settings.fontDefault') },
        ...withCurrent.map(f => ({ value: f, label: f })),
      ]
    }
    return { ui: build(UI_FONTS, form.fontUi), mono: build(MONO_FONTS, form.fontMono) }
  }, [form.fontUi, form.fontMono, t])

  /** Aviso bajo el campo libre: nombre mal escrito, o proporcional en la terminal. */
  function fontWarning(family: string, kind: 'ui' | 'mono'): string | undefined {
    const name = family.trim()
    if (!name) return undefined
    if (!isFontInstalled(name)) return t('settings.fontNotInstalled')
    if (kind === 'mono' && !isMonospaced(name)) return t('settings.fontNotMonospaced')
    return undefined
  }

  /** Un ID no vacío que no se reconoce; derivado, sin estado que sincronizar. */
  function moodError(moodId: string): boolean {
    const raw = (form.musicPlaylistIdsByMood[moodId] ?? '').trim()
    return Boolean(raw) && parseSpotifyPlaylistId(raw) === null
  }

  /**
   * Chequeo manual. Si hay versión nueva el banner de la titlebar la enseña solo:
   * aquí basta con decir qué pasó.
   */
  async function checkUpdates(): Promise<void> {
    setChecking(true)
    setCheckMsg('')
    try {
      const state = await window.api.checkForUpdates()
      setCheckMsg(
        state.kind === 'error'
          ? t('settings.checkUpdatesError', { message: state.message })
          : state.kind === 'idle'
            ? t('settings.checkUpdatesNone')
            : state.kind === 'downloading'
              ? t('settings.forceUpdateBusy')
              : t('settings.checkUpdatesFound', { version: state.version }),
      )
    } finally {
      setChecking(false)
    }
  }

  /** Busca y, si hay versión nueva, dispara descarga+instalación (mismo path que el badge). */
  async function forceUpdate(): Promise<void> {
    setForcing(true)
    setCheckMsg('')
    try {
      const state = await window.api.checkForUpdates()
      if (state.kind === 'error') {
        setCheckMsg(t('settings.checkUpdatesError', { message: state.message }))
        return
      }
      if (state.kind === 'idle') {
        setCheckMsg(t('settings.checkUpdatesNone'))
        return
      }
      if (state.kind === 'downloading') {
        setCheckMsg(t('settings.forceUpdateBusy'))
        return
      }
      setCheckMsg(t('settings.forceUpdateStarting', { version: state.version }))
      window.api.installUpdate()
    } finally {
      setForcing(false)
    }
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
      discordPresenceEnabled: form.discordPresenceEnabled,
      autoUpdatesEnabled: form.autoUpdatesEnabled,
      defaultWorkspacesDir: form.defaultWorkspacesDir.trim(),
      fontUi: form.fontUi,
      fontMono: form.fontMono,
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
      discordPresenceEnabled: original.discordPresenceEnabled,
      autoUpdatesEnabled: original.autoUpdatesEnabled !== false,
      defaultWorkspacesDir: original.defaultWorkspacesDir ?? '',
      fontUi: original.fontUi ?? '',
      fontMono: original.fontMono ?? '',
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
          <Input
            value={search}
            onChange={event => setSearch(event.target.value)}
            size="sm"
            placeholder={t('settings.searchPlaceholder')}
            aria-label={t('settings.searchPlaceholder')}
          />

          {search.trim() ? (
            searchResults.length === 0 ? (
              <p className="settings-nav__empty">
                {t('settings.searchEmpty', { query: search.trim() })}
              </p>
            ) : (
              searchResults.map(result => (
                <button
                  key={result.anchor}
                  type="button"
                  className="settings-nav__result"
                  onClick={() => goToResult(result)}
                >
                  <span className="settings-nav__result-title">{result.title}</span>
                  <span className="settings-nav__result-category">{result.categoryLabel}</span>
                </button>
              ))
            )
          ) : (
            CATEGORIES.map(c => (
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
            ))
          )}
        </nav>

        <div className="settings-panel">
          {category === 'cli' && (
            <SettingsSection title={t('settings.agentCliSection')} anchor="settings-cli">
              <AgentCliTable
                commands={form.agentCliCommands}
                onChange={updateAgentCliCommand}
              />
            </SettingsSection>
          )}

          {category === 'github' && (
            <SettingsSection title={t('settings.githubSection')} anchor="settings-github">
              <GitHubTokenField
                key={tokenFieldEpoch}
                value={form.githubToken}
                onChange={token => update('githubToken', token)}
              />
            </SettingsSection>
          )}

          {category === 'appearance' && (
            <>
              <SettingsSection title={t('settings.typographySection')} anchor="settings-typography">
                <SettingsField label={t('settings.fontUiLabel')} hint={t('settings.fontUiHint')}>
                  <Select
                    value={form.fontUi}
                    onChange={next => update('fontUi', next)}
                    options={fontOptions.ui}
                  />
                </SettingsField>
                <SettingsField
                  label={t('settings.fontCustomLabel')}
                  hint={fontWarning(form.fontUi, 'ui') ?? t('settings.fontCustomHint')}
                  compact
                >
                  <Input
                    type="text"
                    size="sm"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder={t('settings.fontCustomPlaceholder')}
                    value={form.fontUi}
                    onChange={e => update('fontUi', e.target.value)}
                  />
                </SettingsField>

                <SettingsField label={t('settings.fontMonoLabel')} hint={t('settings.fontMonoHint')}>
                  <Select
                    value={form.fontMono}
                    onChange={next => update('fontMono', next)}
                    options={fontOptions.mono}
                  />
                </SettingsField>
                <SettingsField
                  label={t('settings.fontCustomLabel')}
                  hint={fontWarning(form.fontMono, 'mono') ?? t('settings.fontCustomHint')}
                  compact
                >
                  <Input
                    type="text"
                    size="sm"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder={t('settings.fontCustomMonoPlaceholder')}
                    value={form.fontMono}
                    onChange={e => update('fontMono', e.target.value)}
                  />
                </SettingsField>
              </SettingsSection>

              <SettingsSection title={t('settings.languageSection')} anchor="settings-language">
                <SettingsField label={t('settings.languageLabel')}>
                  <Select
                    value={form.language}
                    onChange={next => update('language', next as Language)}
                    options={LANGUAGES.map(l => ({ value: l.value, label: l.label }))}
                  />
                </SettingsField>
              </SettingsSection>

              <SettingsSection title={t('settings.motionSection')} anchor="settings-motion">
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
            <SettingsSection title={t('settings.spotifySection')} anchor="settings-spotify">
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
              <SettingsSection title={t('settings.discordSection')} anchor="settings-discord">
                <SettingToggle
                  checked={form.discordPresenceEnabled}
                  onChange={checked => update('discordPresenceEnabled', checked)}
                  title={t('settings.discordPresenceTitle')}
                  description={t('settings.discordPresenceDescription')}
                />
              </SettingsSection>

              <SettingsSection title={t('settings.workspacesSection')} anchor="settings-workspaces">
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
              <SettingsSection title={t('settings.configSection')} anchor="settings-config">
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

          {category === 'advanced' && (
            <SettingsSection title={t('lsp.settings.title')} anchor="settings-lsp">
              <CodeIntelligenceSettings />
            </SettingsSection>
          )}

          {category === 'developer' && (
            <SettingsSection title={t('settings.developerSection')} anchor="settings-developer">
              <SettingsField
                label={t('settings.splashLabel')}
                hint={t('settings.splashHint')}
              >
                <Button variant="secondary" size="sm" onClick={replaySplash}>
                  {t('settings.splashReplay')}
                </Button>
              </SettingsField>
              <SettingsField
                label={t('settings.quitModalLabel')}
                hint={t('settings.quitModalHint')}
              >
                <Button variant="secondary" size="sm" onClick={() => setQuitPreview(true)}>
                  {t('settings.quitModalPreview')}
                </Button>
              </SettingsField>
            </SettingsSection>
          )}

          {category === 'updates' && (
            <SettingsSection
              title={t('settings.aboutVersion', { version: appVersion })}
              anchor="settings-updates"
            >
              <SettingToggle
                checked={form.autoUpdatesEnabled}
                onChange={checked => update('autoUpdatesEnabled', checked)}
                title={t('settings.autoUpdatesTitle')}
                description={t('settings.autoUpdatesDescription')}
              />
              <div className="settings-update-check">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={checking || forcing}
                  onClick={() => void checkUpdates()}
                >
                  <Icon name="refresh" size={12} />
                  {checking ? t('settings.checkUpdatesRunning') : t('settings.checkUpdates')}
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={checking || forcing}
                  onClick={() => void forceUpdate()}
                >
                  {forcing ? t('settings.checkUpdatesRunning') : t('settings.forceUpdate')}
                </Button>
                {checkMsg && <span className="settings-hint">{checkMsg}</span>}
              </div>
            </SettingsSection>
          )}

          {category === 'about' && (
            <SettingsSection
              title={t('settings.aboutVersion', { version: appVersion })}
              anchor="settings-about"
            >
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

          {/* Portal propio: se pinta sobre Ajustes y no cierra la app. */}
          <QuitConfirmModal
            open={quitPreview}
            terminals={2}
            agents={1}
            onCancel={() => setQuitPreview(false)}
            onConfirm={() => setQuitPreview(false)}
          />
        </div>
      </div>
    </TerminalModal>
  )
}
