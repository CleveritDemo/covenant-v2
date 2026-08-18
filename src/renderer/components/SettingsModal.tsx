import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AppConfig, Language } from '@shared/configSchema'
import { validateConfig, mergeWithDefaults, sanitizeMusicVolume, sanitizeTerminalLineHeight } from '@shared/configSchema'
import { filterSettingsEntries } from '@shared/settingsSearch'
import { UI_FONTS, MONO_FONTS } from '@shared/fontStacks'
import { availableFonts, isFontInstalled, isMonospaced } from '@renderer/fontAvailability'
import type { AgentCliProvider } from '@shared/agentCliProviders'
import { useT } from '@i18n/useT'
import { TerminalModal } from './TerminalModal'
import { SettingsSection, SettingsField } from './SettingsSection'
import { SettingsFontFamilyField } from './SettingsFontFamilyField'
import { CodeIntelligenceSettings } from '../lsp/CodeIntelligenceSettings'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Select } from './ui/Select'
import { SettingToggle } from './ui/SettingToggle'
import { Icon } from './ui/Icon'
import { AgentCliTable } from './AgentCliTable'
import { GitHubAccountsField } from './GitHubAccountsField'
import { JiraConnectionField } from './JiraConnectionField'
import { AiMarkdown } from './AiMarkdown'
import { HeroConfirmOverlay } from './HeroConfirmOverlay'
import { QUIT_CONFIRM_Z } from '@shared/overlayZIndex'
import { replaySplash } from '../splash'
import { previewReleaseNotes, previewUpdateBanner } from '../updateBannerPreview'
import { changelogRecentModifications } from '@shared/changelog'
import type { UpdateState } from '@shared/updateState'
import { isStoreBuild } from '../platform'
// El CHANGELOG viaja dentro del bundle: no hay que leerlo del disco ni empaquetarlo aparte.
import changelogMd from '../../../CHANGELOG.md?raw'
import './SettingsModal.css'

const settingsChangelogMd = changelogRecentModifications(changelogMd)

interface Props {
  config: AppConfig
  onSave: (config: AppConfig) => void
  onClose: () => void
  /** cwd de la pestaña activa: `jira.json` es por proyecto, no de la app. */
  cwd?: string
  /** Relanza el wizard de onboarding (Developer). */
  onReplayOnboarding?: () => void
  /** Binding de workspace a limpiar al borrar una cuenta del llavero. */
  onAccountDeleted?: (accountId: string) => void
}

const LANGUAGES: { value: Language; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
]

const CATEGORIES = [
  { id: 'telemetry', icon: 'chart', labelKey: 'settings.telemetrySection' },
  { id: 'cli', icon: 'bot', labelKey: 'settings.agentCliSection' },
  { id: 'github', icon: 'git-branch', labelKey: 'settings.githubSection' },
  { id: 'jira', icon: 'jira', labelKey: 'jira.section' },
  { id: 'appearance', icon: 'sparkles', labelKey: 'settings.appearanceSection' },
  { id: 'sound', icon: 'pulse', labelKey: 'settings.soundSection' },
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
  { category: 'telemetry', anchor: 'settings-telemetry', titleKey: 'settings.telemetrySection', termKeys: ['settings.telemetryHint', 'settings.telemetryEndpointLabel', 'settings.telemetryHeadersLabel', 'settings.telemetryEnabledTitle', 'settings.telemetryLogPromptsTitle', 'settings.telemetryLogToolIOTitle'] },
  { category: 'cli', anchor: 'settings-cli', titleKey: 'settings.agentCliSection', termKeys: ['settings.agentCliHint', 'settings.cliCommandLabel'] },
  { category: 'github', anchor: 'settings-github', titleKey: 'settings.githubSection', termKeys: ['settings.githubTokenLabel', 'settings.githubTokenHint', 'settings.githubAccountsTitle', 'settings.githubAddAccount'] },
  { category: 'jira', anchor: 'settings-jira', titleKey: 'jira.section', termKeys: ['jira.siteLabel', 'jira.tokenHint'] },
  { category: 'appearance', anchor: 'settings-typography', titleKey: 'settings.typographySection', termKeys: ['settings.fontUiLabel', 'settings.fontMonoLabel', 'settings.fontCustomLabel', 'settings.terminalLineHeightLabel'] },
  { category: 'appearance', anchor: 'settings-language', titleKey: 'settings.languageSection', termKeys: ['settings.languageLabel'] },
  { category: 'appearance', anchor: 'settings-motion', titleKey: 'settings.motionSection', termKeys: ['settings.reduceMotionTitle', 'settings.reduceMotionDescription'] },
  { category: 'sound', anchor: 'settings-system-sounds', titleKey: 'settings.systemSoundsSection', termKeys: ['settings.systemSoundsEnabledTitle', 'settings.systemSoundsEnabledDescription'] },
  { category: 'sound', anchor: 'settings-music', titleKey: 'settings.musicSection', termKeys: ['settings.musicEnabledTitle', 'settings.musicVolumeLabel', 'settings.musicHint'] },
  { category: 'advanced', anchor: 'settings-discord', titleKey: 'settings.discordSection', termKeys: ['settings.discordPresenceTitle'] },
  { category: 'advanced', anchor: 'settings-workspaces', titleKey: 'settings.workspacesSection', termKeys: ['settings.defaultWorkspacesDirLabel', 'settings.defaultWorkspacesDirHint'] },
  { category: 'advanced', anchor: 'settings-config', titleKey: 'settings.configSection', termKeys: ['settings.configHint', 'settings.revealConfig'] },
  { category: 'advanced', anchor: 'settings-lsp', titleKey: 'lsp.settings.title', termKeys: ['lsp.settings.masterToggle', 'lsp.settings.hint'] },
  { category: 'developer', anchor: 'settings-developer', titleKey: 'settings.developerSection', termKeys: ['settings.splashLabel', 'settings.quitModalLabel', 'settings.updateBannerLabel', 'settings.releaseNotesLabel'] },
  { category: 'updates', anchor: 'settings-updates', titleKey: 'settings.updatesSection', termKeys: ['settings.autoUpdatesTitle', 'settings.checkUpdates', 'settings.restartToUpdate'] },
  { category: 'about', anchor: 'settings-about', titleKey: 'settings.aboutSection', termKeys: ['settings.aboutVersion', 'settings.onboardingLabel'] },
  // `as const` no es decoración: sin literales, `t()` rechaza las claves.
] as const

/** Una escritura por ráfaga de tecleo, no una por pulsación. */
const AUTOSAVE_DEBOUNCE_MS = 600

/** Claves que el modal edita. El resto (p. ej. githubAccounts) lo escriben otros canales. */
const SETTINGS_OWNED_KEYS: readonly (keyof AppConfig)[] = [
  'githubToken',
  'language',
  'reduceMotion',
  'musicEnabled',
  'musicVolume',
  'systemSoundsEnabled',
  'discordPresenceEnabled',
  'autoUpdatesEnabled',
  'defaultWorkspacesDir',
  'fontUi',
  'fontMono',
  'terminalLineHeight',
  'agentCliCommands',
  'otelEndpoint',
  'otelProtocol',
  'otelEnabled',
  'otelHeaders',
  'otelLogPrompts',
  'otelLogToolIO',
]

export function pickSettingsOwnedConfig(cfg: AppConfig): Partial<AppConfig> {
  return Object.fromEntries(SETTINGS_OWNED_KEYS.map(key => [key, cfg[key]])) as Partial<AppConfig>
}

export const SettingsModal: React.FC<Props> = ({ config, onSave, onClose, cwd = '', onReplayOnboarding, onAccountDeleted }) => {
  const { t } = useT()
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({
    githubToken: config.githubToken,
    language: config.language,
    reduceMotion: config.reduceMotion,
    musicEnabled: config.musicEnabled,
    musicVolume: sanitizeMusicVolume(config.musicVolume),
    systemSoundsEnabled: config.systemSoundsEnabled !== false,
    discordPresenceEnabled: config.discordPresenceEnabled,
    autoUpdatesEnabled: config.autoUpdatesEnabled !== false,
    defaultWorkspacesDir: config.defaultWorkspacesDir ?? '',
    fontUi: config.fontUi ?? '',
    fontMono: config.fontMono ?? '',
    terminalLineHeight: sanitizeTerminalLineHeight(config.terminalLineHeight),
    agentCliCommands: { ...(config.agentCliCommands ?? {}) } as Partial<Record<AgentCliProvider, string>>,
    otelEndpoint: config.otelEndpoint ?? '',
    otelProtocol: config.otelProtocol ?? 'http/protobuf',
    otelEnabled: config.otelEnabled ?? false,
    otelHeaders: config.otelHeaders ?? '',
    otelLogPrompts: config.otelLogPrompts ?? false,
    otelLogToolIO: config.otelLogToolIO ?? false,
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
  const [appVersion, setAppVersion] = useState('')
  const [checking, setChecking] = useState(false)
  const [forcing, setForcing] = useState(false)
  const [checkMsg, setCheckMsg] = useState('')
  const [updateState, setUpdateState] = useState<UpdateState>({ kind: 'idle' })
  /** Preview del confirm de salida (no cierra la app). */
  const [quitPreview, setQuitPreview] = useState(false)
  /**
   * Snapshot al abrir (copia profunda de mapas). No se reescribe tras autosave:
   * «Descartar» vuelve siempre a este estado de apertura.
   */
  const baseline = useRef(mergeWithDefaults({
    ...config,
    agentCliCommands: { ...(config.agentCliCommands ?? {}) },
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
              : state.kind === 'ready'
                ? t('settings.checkUpdatesReady', { version: state.version })
                : t('settings.checkUpdatesFound', { version: state.version }),
      )
    } finally {
      setChecking(false)
    }
  }

  /** Busca y, si hay versión nueva, dispara la descarga (mismo path que el badge). */
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
      if (state.kind === 'ready') {
        setCheckMsg(t('settings.checkUpdatesReady', { version: state.version }))
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

  /**
   * Config a persistir. No reenviar el objeto entero: el snapshot es de arranque
   * y no ve lo que escriben otros canales IPC (GITHUB_ACCOUNT_*).
   */
  function buildConfig(): AppConfig {
    return mergeWithDefaults({
      ...config,
      githubToken: form.githubToken.trim(),
      language: form.language,
      reduceMotion: form.reduceMotion,
      musicEnabled: form.musicEnabled,
      musicVolume: sanitizeMusicVolume(form.musicVolume),
      systemSoundsEnabled: form.systemSoundsEnabled,
      discordPresenceEnabled: form.discordPresenceEnabled,
      autoUpdatesEnabled: form.autoUpdatesEnabled,
      defaultWorkspacesDir: form.defaultWorkspacesDir.trim(),
      fontUi: form.fontUi,
      fontMono: form.fontMono,
      terminalLineHeight: sanitizeTerminalLineHeight(form.terminalLineHeight),
      // Vacío = comando por defecto del proveedor; mergeWithDefaults poda las claves.
      agentCliCommands: form.agentCliCommands,
      otelEndpoint: form.otelEndpoint.trim(),
      otelProtocol: form.otelProtocol,
      otelEnabled: form.otelEnabled,
      otelHeaders: form.otelHeaders.trim(),
      otelLogPrompts: form.otelLogPrompts,
      otelLogToolIO: form.otelLogToolIO,
    })
  }

  const commit = useCallback(async (next: AppConfig): Promise<void> => {
    pending.current = null
    const errs = validateConfig(next)
    if (errs.length) { setErrors(errs); return }

    const result = await window.api.setConfig(pickSettingsOwnedConfig(next))
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

  /** Replay desmonta Settings: vaciar el debounce antes de salir. */
  const handleReplayClick = (): void => {
    if (pending.current) void commit(pending.current)
    onReplayOnboarding?.()
  }

  /** Hay texto que no se está guardando: el pie tiene que decirlo, no callar. */
  useEffect(() => {
    void window.api.getAppVersion().then(setAppVersion)
  }, [])

  useEffect(() => {
    void window.api.getUpdateState().then(setUpdateState)
    return window.api.onUpdateState(setUpdateState)
  }, [])

  /**
  /**
   * Vuelve al snapshot de apertura, persiste ya (sin debounce) y da feedback.
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
      musicVolume: sanitizeMusicVolume(original.musicVolume),
      systemSoundsEnabled: original.systemSoundsEnabled !== false,
      discordPresenceEnabled: original.discordPresenceEnabled,
      autoUpdatesEnabled: original.autoUpdatesEnabled !== false,
      defaultWorkspacesDir: original.defaultWorkspacesDir ?? '',
      fontUi: original.fontUi ?? '',
      fontMono: original.fontMono ?? '',
      terminalLineHeight: sanitizeTerminalLineHeight(original.terminalLineHeight),
      agentCliCommands: { ...(original.agentCliCommands ?? {}) },
      otelEndpoint: original.otelEndpoint ?? '',
      otelProtocol: original.otelProtocol ?? 'http/protobuf',
      otelEnabled: original.otelEnabled ?? false,
      otelHeaders: original.otelHeaders ?? '',
      otelLogPrompts: original.otelLogPrompts ?? false,
      otelLogToolIO: original.otelLogToolIO ?? false,
    })
    setErrors([])
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
          <span className="settings-status">
            {footerHint === 'discarded'
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
          {category === 'telemetry' && (
            <SettingsSection title={t('settings.telemetrySection')} anchor="settings-telemetry">
              <p className="settings-hint settings-hint--block">{t('settings.telemetryHint')}</p>
              <SettingsField
                label={t('settings.telemetryEndpointLabel')}
                htmlFor="settings-otel-endpoint"
              >
                <Input
                  id="settings-otel-endpoint"
                  value={form.otelEndpoint}
                  onChange={e => {
                    const v = e.target.value
                    update('otelEndpoint', v)
                    if (!v.trim()) update('otelEnabled', false)
                  }}
                  placeholder={t('settings.telemetryEndpointPlaceholder')}
                />
                <p className="settings-hint">{t('settings.telemetryEndpointHint')}</p>
              </SettingsField>
              <SettingsField
                label={t('settings.telemetryProtocolLabel')}
                htmlFor="settings-otel-protocol"
              >
                <Select
                  id="settings-otel-protocol"
                  value={form.otelProtocol}
                  onChange={v => update('otelProtocol', v as AppConfig['otelProtocol'])}
                  options={[
                    { value: 'http/protobuf', label: t('settings.telemetryProtocolHttpProtobuf') },
                    { value: 'http/json', label: t('settings.telemetryProtocolHttpJson') },
                    { value: 'grpc', label: t('settings.telemetryProtocolGrpc') },
                  ]}
                />
              </SettingsField>
              <SettingsField
                label={t('settings.telemetryHeadersLabel')}
                htmlFor="settings-otel-headers"
              >
                <Input
                  id="settings-otel-headers"
                  type="password"
                  value={form.otelHeaders}
                  onChange={e => update('otelHeaders', e.target.value)}
                  placeholder={t('settings.telemetryHeadersPlaceholder')}
                />
                <p className="settings-hint">{t('settings.telemetryHeadersHint')}</p>
              </SettingsField>
              <SettingToggle
                checked={form.otelEnabled}
                onChange={checked => update('otelEnabled', checked)}
                title={t('settings.telemetryEnabledTitle')}
                description={
                  form.otelEndpoint
                    ? t('settings.telemetryEnabledDescription')
                    : t('settings.telemetryEnabledNoEndpoint')
                }
                disabled={!form.otelEndpoint}
              />
              <SettingToggle
                checked={form.otelLogPrompts}
                onChange={checked => update('otelLogPrompts', checked)}
                title={t('settings.telemetryLogPromptsTitle')}
                description={t('settings.telemetryLogPromptsDescription')}
                disabled={!form.otelEnabled || !form.otelEndpoint}
              />
              {form.otelLogPrompts && form.otelEnabled && form.otelEndpoint && (
                <p className="settings-hint settings-hint--block settings-hint--warning">
                  {t('settings.telemetryLogPromptsWarning')}
                </p>
              )}
              <SettingToggle
                checked={form.otelLogToolIO}
                onChange={checked => update('otelLogToolIO', checked)}
                title={t('settings.telemetryLogToolIOTitle')}
                description={t('settings.telemetryLogToolIODescription')}
                disabled={!form.otelEnabled || !form.otelEndpoint}
              />
              {form.otelLogToolIO && form.otelEnabled && form.otelEndpoint && (
                <p className="settings-hint settings-hint--block settings-hint--warning">
                  {t('settings.telemetryLogToolIOWarning')}
                </p>
              )}
            </SettingsSection>
          )}

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
              <GitHubAccountsField onAccountDeleted={onAccountDeleted} />
            </SettingsSection>
          )}

          {category === 'jira' && (
            <SettingsSection title={t('jira.section')} anchor="settings-jira">
              <JiraConnectionField cwd={cwd} />
            </SettingsSection>
          )}

          {category === 'appearance' && (
            <>
              <SettingsSection title={t('settings.typographySection')} anchor="settings-typography">
                <SettingsFontFamilyField
                  label={t('settings.fontUiLabel')}
                  hint={t('settings.fontUiHint')}
                  warning={fontWarning(form.fontUi, 'ui')}
                  value={form.fontUi}
                  options={fontOptions.ui}
                  onChange={next => update('fontUi', next)}
                  customLabel={t('settings.fontCustomLabel')}
                  placeholder={t('settings.fontCustomPlaceholder')}
                />
                <SettingsFontFamilyField
                  label={t('settings.fontMonoLabel')}
                  hint={t('settings.fontMonoHint')}
                  warning={fontWarning(form.fontMono, 'mono')}
                  value={form.fontMono}
                  options={fontOptions.mono}
                  onChange={next => update('fontMono', next)}
                  customLabel={t('settings.fontCustomLabel')}
                  placeholder={t('settings.fontCustomMonoPlaceholder')}
                />
                <SettingsField
                  label={t('settings.terminalLineHeightLabel')}
                  hint={t('settings.terminalLineHeightHint')}
                >
                  <Select
                    size="sm"
                    value={String(sanitizeTerminalLineHeight(form.terminalLineHeight))}
                    onChange={next => update('terminalLineHeight', sanitizeTerminalLineHeight(Number(next)))}
                    aria-label={t('settings.terminalLineHeightLabel')}
                    options={[
                      { value: '1', label: t('settings.terminalLineHeightCompact') },
                      { value: '1.2', label: t('settings.terminalLineHeightComfortable') },
                      { value: '1.4', label: t('settings.terminalLineHeightRelaxed') },
                    ]}
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

          {category === 'sound' && (
            <>
              <SettingsSection title={t('settings.systemSoundsSection')} anchor="settings-system-sounds">
                <SettingToggle
                  checked={form.systemSoundsEnabled}
                  onChange={checked => update('systemSoundsEnabled', checked)}
                  title={t('settings.systemSoundsEnabledTitle')}
                  description={t('settings.systemSoundsEnabledDescription')}
                />
              </SettingsSection>

              <SettingsSection title={t('settings.musicSection')} anchor="settings-music">
                <SettingToggle
                  checked={form.musicEnabled}
                  onChange={checked => update('musicEnabled', checked)}
                  title={t('settings.musicEnabledTitle')}
                  description={t('settings.musicEnabledDescription')}
                />
                <p className="settings-hint settings-hint--block">{t('settings.musicHint')}</p>
                <SettingsField
                  label={t('settings.musicVolumeLabel')}
                  htmlFor="settings-music-volume"
                >
                  <div className="settings-music-volume">
                    <input
                      id="settings-music-volume"
                      type="range"
                      className="settings-music-volume__slider"
                      min={0}
                      max={100}
                      step={1}
                      value={Math.round(sanitizeMusicVolume(form.musicVolume) * 100)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(sanitizeMusicVolume(form.musicVolume) * 100)}
                      aria-label={t('settings.musicVolumeLabel')}
                      onChange={e => update('musicVolume', sanitizeMusicVolume(Number(e.target.value) / 100))}
                    />
                    <span className="settings-music-volume__value" aria-hidden>
                      {Math.round(sanitizeMusicVolume(form.musicVolume) * 100)}%
                    </span>
                  </div>
                </SettingsField>
              </SettingsSection>
            </>
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
              <SettingsField
                label={t('settings.updateBannerLabel')}
                hint={t('settings.updateBannerHint')}
              >
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    onClose()
                    previewUpdateBanner()
                  }}
                >
                  {t('settings.updateBannerPreview')}
                </Button>
              </SettingsField>
              <SettingsField
                label={t('settings.releaseNotesLabel')}
                hint={t('settings.releaseNotesHint')}
              >
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    onClose()
                    previewReleaseNotes()
                  }}
                >
                  {t('settings.releaseNotesPreview')}
                </Button>
              </SettingsField>
            </SettingsSection>
          )}

          {category === 'updates' && (
            <SettingsSection
              title={t('settings.aboutVersion', { version: appVersion })}
              anchor="settings-updates"
            >
              {isStoreBuild ? (
                <p className="settings-hint settings-hint--block">{t('settings.updatesStoreManaged')}</p>
              ) : (
                <>
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
                    {updateState.kind === 'ready' ? (
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={checking || forcing}
                        onClick={() => window.api.installUpdate()}
                      >
                        {t('settings.restartToUpdate')}
                      </Button>
                    ) : (
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={checking || forcing}
                        onClick={() => void forceUpdate()}
                      >
                        {forcing ? t('settings.checkUpdatesRunning') : t('settings.forceUpdate')}
                      </Button>
                    )}
                    {checkMsg && <span className="settings-hint">{checkMsg}</span>}
                  </div>
                </>
              )}
            </SettingsSection>
          )}

          {category === 'about' && (
            <SettingsSection
              title={t('settings.aboutVersion', { version: appVersion })}
              anchor="settings-about"
            >
              {onReplayOnboarding ? (
                <SettingsField label={t('settings.onboardingLabel')}>
                  <Button variant="secondary" size="sm" onClick={handleReplayClick}>
                    {t('settings.onboardingButton')}
                  </Button>
                </SettingsField>
              ) : null}
              <div className="settings-changelog">
                <AiMarkdown content={settingsChangelogMd} />
              </div>
            </SettingsSection>
          )}

          {errors.length > 0 && (
            <div className="settings-errors">
              {errors.map((e, i) => <p key={i}>{e}</p>)}
            </div>
          )}

          {/* Portal propio: se pinta sobre Ajustes y no cierra la app. */}
          <HeroConfirmOverlay
            open={quitPreview}
            meta={t('quit.terminalsOpen', { count: 2 })}
            title={t('quit.title')}
            hint={t('quit.hint')}
            zIndex={QUIT_CONFIRM_Z}
            onCancel={() => setQuitPreview(false)}
            onConfirm={() => setQuitPreview(false)}
          />
        </div>
      </div>
    </TerminalModal>
  )
}
