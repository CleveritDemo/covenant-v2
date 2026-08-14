import { isAgentCliProvider, type AgentCliProvider } from './agentCliProviders'
import type { OrgWorkspaceCatalog } from './orgWorkspaceCatalog'
import { parseOrgWorkspaceCatalog } from './orgWorkspaceCatalog'
import {
  sanitizeWikiCuratorConfig,
  type WikiCuratorConfig,
} from './wikiCurator'

/** Política de ejecución de shell del modo agente (el modelo propone bloques RUN). */
export type AgentShellPolicy = 'off' | 'ask' | 'always'

/** Proveedor de IA seleccionado. */
export type AiProvider = 'ollama' | 'anthropic' | 'openai'

/** Idioma de la interfaz. */
export type Language = 'en' | 'es'

/** Protocolo OTLP para exportación de telemetría. */
export type OtelProtocol = 'http/protobuf' | 'http/json' | 'grpc'

const DEFAULT_MUSIC_VOLUME = 0.35

/** Interlineado xterm: 1.2 = cómodo (default), 1 = denso, 1.4 = holgado. */
const DEFAULT_TERMINAL_LINE_HEIGHT = 1.2
const MIN_TERMINAL_LINE_HEIGHT = 1
const MAX_TERMINAL_LINE_HEIGHT = 1.6

/**
 * Volumen de música interna: escala 0..1.
 * Valores fuera de rango se clampean; p. ej. 35 → 1 (no se interpreta como 35%).
 */
export function sanitizeMusicVolume(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return DEFAULT_MUSIC_VOLUME
  return Math.min(1, Math.max(0, n))
}

/** Interlineado de terminal: 1.0–1.6, un decimal. Basura → default. */
export function sanitizeTerminalLineHeight(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return DEFAULT_TERMINAL_LINE_HEIGHT
  const clamped = Math.min(MAX_TERMINAL_LINE_HEIGHT, Math.max(MIN_TERMINAL_LINE_HEIGHT, n))
  return Math.round(clamped * 10) / 10
}

export interface AppConfig {
  /** Proveedor de IA activo. */
  aiProvider: AiProvider
  ollamaBaseURL: string
  /** API key de Anthropic (claude-*). Solo se usa cuando aiProvider === 'anthropic'. */
  anthropicApiKey: string
  /** API key de OpenAI (gpt-*, o*). Solo se usa cuando aiProvider === 'openai'. */
  openaiApiKey: string
  /** Personal Access Token de GitHub para Actions y API. Alternativa: GITHUB_TOKEN en .env. */
  githubToken: string
  /**
   * Carpeta raíz donde se instalan los workspaces organizacionales.
   * Vacío = sin carpeta por defecto configurada.
   */
  defaultWorkspacesDir: string
  defaultModel: string
  maxContextLines: number
  themeId: string
  fontSize: number
  /** Familia de la interfaz. Vacío = stack por defecto de `global.css`. Ver `fontStacks.ts`. */
  fontUi: string
  /** Familia monoespaciada (terminales y código). Vacío = stack por defecto. */
  fontMono: string
  /** Interlineado xterm (1.0–1.6). UI: Compacto / Cómodo / Holgado. */
  terminalLineHeight: number
  /** Si true, el chat puede leer/escribir archivos bajo el cwd (modo agente). UI: cabecera del panel IA. */
  agentMode: boolean
  /**
   * Si true (y agentMode), tras cada respuesta del agente se vuelve a lanzar la misma tarea
   * hasta pulsar Stop. UI: cabecera del panel IA.
   */
  agentLoop: boolean
  /**
   * Ejecución de comandos RUN del agente bajo el cwd de la sesión.
   * `off`: no se ejecuta nada; `ask`: confirmación por comando; `always`: sin preguntar. UI: cabecera del panel IA.
   */
  agentShellPolicy: AgentShellPolicy
  /**
   * Activa el modo thinking (Ollama: `think: true`; Anthropic: extended thinking).
   * Solo tiene efecto en modelos que lo soportan.
   */
  thinkingMode: boolean
  /** Activa el audio del tema (play/pausa en titlebar si hay track). */
  musicEnabled: boolean
  /**
   * Si true, el usuario pausó la música del tema; no autoplay al arrancar ni al cambiar de tema.
   * Independiente de `musicEnabled`: al desactivar audio se conserva para al reactivar respetar la pausa.
   */
  musicPaused: boolean
  /** Volumen del reproductor interno (0..1). */
  musicVolume: number
  /**
   * Sonidos del sistema (dictado/micrófono y fin de agente).
   * Independiente de la música del tema.
   * Migra desde `soundFeedbackEnabled` (v0.39.59).
   */
  systemSoundsEnabled: boolean
  /** Idioma de la interfaz. */
  language: Language
  /**
   * Baja animaciones del plano y chat de agentes (también respeta OS reduce-motion vía DOM).
   */
  reduceMotion: boolean
  /** Reiniciar shell automáticamente tras exit en un panel de terminal. */
  autoRestartShell: boolean
  /**
   * Discord Rich Presence — publica "In <workspace> · N sesiones" en el perfil
   * de Discord vía el socket IPC local. Off por defecto. Solo nombre de
   * workspace y contadores: nunca comandos, rutas ni salida.
   */
  discordPresenceEnabled: boolean
  /**
   * Chequeos silenciosos de actualización al arrancar y cada hora.
   * Off = solo búsqueda manual / forzar desde Ajustes. Default ON.
   */
  autoUpdatesEnabled: boolean
  /**
   * Ejecutables usados por las ventanas de agente CLI, por proveedor.
   * Entrada vacía o ausente = comando por defecto de `AGENT_CLI_PROVIDERS`.
   */
  agentCliCommands: Partial<Record<AgentCliProvider, string>>
  /**
   * Versión de onboarding completada (`ONBOARDING_VERSION` en `onboarding.ts`).
   * `''` = el usuario nunca completó el wizard.
   */
  onboardingCompletedVersion: string
  /**
   * Snapshot de workspaces org para Cmd+T sin red.
   * Ausente/undefined = sin tocar en merges parciales; null = borrar cache.
   */
  orgWorkspaceCatalogCache?: OrgWorkspaceCatalog | null
  /** Curador wiki global (nombre, CLI, modelo, reglas); persiste en userData/config.json. */
  wikiCurator: WikiCuratorConfig

  // --- OTEL telemetry ---

  /** Endpoint OTLP (p. ej. https://otel.example.com:4318). Vacío = desactivado. */
  otelEndpoint: string
  /** Protocolo OTLP: http/protobuf (por defecto) o grpc. */
  otelProtocol: OtelProtocol
  /** Activa la inyección de variables OTEL en los spawns de agente CLI. */
  otelEnabled: boolean
  /**
   * Cabeceras OTLP (formato OTEL: `key=value,key2=value2`).
   * Se cifra en disco vía SECRET_FIELDS.
   */
  otelHeaders: string
  /** Registrar prompts del usuario y respuestas del asistente en telemetría. */
  otelLogPrompts: boolean
  /** Registrar detalles y contenido de herramientas en telemetría. */
  otelLogToolIO: boolean
}

export const DEFAULT_MODEL_BY_PROVIDER: Record<AiProvider, string> = {
  ollama: 'llama3.2',
  anthropic: 'claude-sonnet-4-5',
  openai: 'gpt-4o',
}

export const CONFIG_DEFAULTS: AppConfig = {
  aiProvider: 'ollama',
  ollamaBaseURL: 'http://127.0.0.1:11434',
  anthropicApiKey: '',
  openaiApiKey: '',
  githubToken: '',
  defaultWorkspacesDir: '',
  defaultModel: 'llama3.2',
  maxContextLines: 200,
  themeId: 'tokyoNight',
  fontSize: 13,
  fontUi: '',
  fontMono: '',
  terminalLineHeight: DEFAULT_TERMINAL_LINE_HEIGHT,
  agentMode: false,
  agentLoop: false,
  agentShellPolicy: 'off',
  thinkingMode: false,
  musicEnabled: true,
  musicPaused: false,
  musicVolume: DEFAULT_MUSIC_VOLUME,
  systemSoundsEnabled: true,
  language: 'en',
  reduceMotion: false,
  autoRestartShell: true,
  discordPresenceEnabled: false,
  autoUpdatesEnabled: true,
  agentCliCommands: {},
  onboardingCompletedVersion: '',
  wikiCurator: {},
  otelEndpoint: '',
  otelProtocol: 'http/protobuf',
  otelEnabled: false,
  otelHeaders: '',
  otelLogPrompts: false,
  otelLogToolIO: false,
}

/** Versión de onboarding: no-string, vacío o >32 chars → ''. */
export function sanitizeOnboardingCompletedVersion(value: unknown): string {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > 32) return ''
  return trimmed
}

/** Claves previas a `agentCliCommands` (una por proveedor). */
const LEGACY_AGENT_CLI_KEYS: Record<string, AgentCliProvider> = {
  agentCliClaudeCommand: 'claude',
  agentCliCursorCommand: 'cursor',
  agentCliCopilotCommand: 'copilot',
}

/** Config guardada antes del registro de proveedores: pliega las 3 claves sueltas. */
export function migrateAgentCliCommands(
  partial: Partial<AppConfig>,
): Partial<Record<AgentCliProvider, string>> {
  const raw = partial as Record<string, unknown>
  const out: Partial<Record<AgentCliProvider, string>> = {}
  for (const [legacyKey, provider] of Object.entries(LEGACY_AGENT_CLI_KEYS)) {
    const value = raw[legacyKey]
    if (typeof value === 'string' && value.trim()) out[provider] = value.trim()
  }
  for (const [provider, value] of Object.entries(partial.agentCliCommands ?? {})) {
    if (!isAgentCliProvider(provider)) continue
    const trimmed = typeof value === 'string' ? value.trim() : ''
    if (trimmed) out[provider] = trimmed
    else delete out[provider]
  }
  return out
}

export function mergeWithDefaults(partial: Partial<AppConfig>): AppConfig {
  const reduceMotion = typeof partial.reduceMotion === 'boolean'
    ? partial.reduceMotion
    : CONFIG_DEFAULTS.reduceMotion
  const autoUpdatesEnabled = typeof partial.autoUpdatesEnabled === 'boolean'
    ? partial.autoUpdatesEnabled
    : CONFIG_DEFAULTS.autoUpdatesEnabled
  const musicVolume = Object.prototype.hasOwnProperty.call(partial, 'musicVolume')
    ? sanitizeMusicVolume(partial.musicVolume)
    : CONFIG_DEFAULTS.musicVolume
  const terminalLineHeight = Object.prototype.hasOwnProperty.call(partial, 'terminalLineHeight')
    ? sanitizeTerminalLineHeight(partial.terminalLineHeight)
    : CONFIG_DEFAULTS.terminalLineHeight
  const musicPaused = typeof partial.musicPaused === 'boolean'
    ? partial.musicPaused
    : CONFIG_DEFAULTS.musicPaused
  const rawPartial = partial as Record<string, unknown>
  // systemSoundsEnabled (aprobado) migra soundFeedbackEnabled de v0.39.59.
  const systemSoundsEnabled = typeof partial.systemSoundsEnabled === 'boolean'
    ? partial.systemSoundsEnabled
    : typeof rawPartial.soundFeedbackEnabled === 'boolean'
      ? (rawPartial.soundFeedbackEnabled as boolean)
      : CONFIG_DEFAULTS.systemSoundsEnabled
  const agentCliCommands = migrateAgentCliCommands(partial)
  const defaultWorkspacesDir = typeof partial.defaultWorkspacesDir === 'string'
    ? partial.defaultWorkspacesDir
    : CONFIG_DEFAULTS.defaultWorkspacesDir
  const onboardingCompletedVersion = Object.prototype.hasOwnProperty.call(
    partial,
    'onboardingCompletedVersion',
  )
    ? sanitizeOnboardingCompletedVersion(partial.onboardingCompletedVersion)
    : CONFIG_DEFAULTS.onboardingCompletedVersion
  const rawRecord = partial as Record<string, unknown>
  const catalogKeyPresent = Object.prototype.hasOwnProperty.call(
    rawRecord,
    'orgWorkspaceCatalogCache',
  )
  const catalogRaw = catalogKeyPresent ? rawRecord.orgWorkspaceCatalogCache : undefined
  const orgWorkspaceCatalogCache = catalogKeyPresent
    ? catalogRaw === null || catalogRaw === undefined
      ? undefined
      : (parseOrgWorkspaceCatalog(catalogRaw) ?? undefined)
    : undefined
  const wikiCurator = sanitizeWikiCuratorConfig(
    Object.prototype.hasOwnProperty.call(partial, 'wikiCurator')
      ? partial.wikiCurator
      : CONFIG_DEFAULTS.wikiCurator,
  )
  const merged = {
    ...CONFIG_DEFAULTS,
    ...partial,
    musicVolume,
    terminalLineHeight,
    musicPaused,
    systemSoundsEnabled,
    reduceMotion,
    autoUpdatesEnabled,
    agentCliCommands,
    defaultWorkspacesDir,
    onboardingCompletedVersion,
    wikiCurator,
  } as AppConfig & Record<string, unknown>
  for (const legacyKey of Object.keys(LEGACY_AGENT_CLI_KEYS)) delete merged[legacyKey]
  delete merged.soundFeedbackEnabled
  delete merged.musicMood
  delete merged.musicPlaylistIdsByMood
  if (catalogKeyPresent) {
    if (orgWorkspaceCatalogCache) merged.orgWorkspaceCatalogCache = orgWorkspaceCatalogCache
    else delete merged.orgWorkspaceCatalogCache
  } else if (
    merged.orgWorkspaceCatalogCache !== undefined
    && parseOrgWorkspaceCatalog(merged.orgWorkspaceCatalogCache) == null
  ) {
    delete merged.orgWorkspaceCatalogCache
  }
  delete merged.orgWorkspaceAgentsCache
  return merged as AppConfig
}

export function validateConfig(config: AppConfig): string[] {
  const errors: string[] = []
  const validProviders: AiProvider[] = ['ollama', 'anthropic', 'openai']
  if (!validProviders.includes(config.aiProvider)) {
    errors.push('aiProvider debe ser ollama, anthropic u openai')
  }
  if (config.aiProvider === 'ollama') {
    try {
      const url = new URL(config.ollamaBaseURL)
      if (!['http:', 'https:'].includes(url.protocol)) {
        errors.push('ollamaBaseURL debe usar protocolo http o https')
      }
    } catch {
      errors.push('ollamaBaseURL no es una URL válida')
    }
  }
  // Las API keys del chat embebido ya no se configuran en la UI; no bloquear guardado.
  if (config.maxContextLines < 10 || config.maxContextLines > 2000) {
    errors.push('maxContextLines debe estar entre 10 y 2000')
  }
  if (config.fontSize < 9 || config.fontSize > 24) {
    errors.push('fontSize debe estar entre 9 y 24')
  }
  if (
    typeof config.terminalLineHeight !== 'number'
    || !Number.isFinite(config.terminalLineHeight)
  ) {
    errors.push('terminalLineHeight debe ser un número')
  } else if (
    config.terminalLineHeight < MIN_TERMINAL_LINE_HEIGHT
    || config.terminalLineHeight > MAX_TERMINAL_LINE_HEIGHT
  ) {
    errors.push('terminalLineHeight debe estar entre 1 y 1.6')
  }
  if (typeof config.defaultWorkspacesDir !== 'string') {
    errors.push('defaultWorkspacesDir debe ser un string')
  }
  if (typeof config.onboardingCompletedVersion !== 'string') {
    errors.push('onboardingCompletedVersion debe ser un string')
  } else if (sanitizeOnboardingCompletedVersion(config.onboardingCompletedVersion) !== config.onboardingCompletedVersion) {
    errors.push('onboardingCompletedVersion inválida')
  }
  if (
    config.orgWorkspaceCatalogCache != null
    && parseOrgWorkspaceCatalog(config.orgWorkspaceCatalogCache) == null
  ) {
    errors.push('orgWorkspaceCatalogCache tiene una forma inválida')
  }
  for (const provider of Object.keys(config.agentCliCommands ?? {})) {
    if (!isAgentCliProvider(provider)) {
      errors.push(`agentCliCommands["${provider}"] no es un proveedor conocido`)
    }
  }
  if (typeof config.autoUpdatesEnabled !== 'boolean') {
    errors.push('autoUpdatesEnabled debe ser boolean')
  }
  const pol = config.agentShellPolicy
  if (pol !== 'off' && pol !== 'ask' && pol !== 'always') {
    errors.push('agentShellPolicy debe ser off, ask o always')
  }
  if (typeof config.musicVolume !== 'number' || !Number.isFinite(config.musicVolume)) {
    errors.push('musicVolume debe ser un número')
  } else if (config.musicVolume < 0 || config.musicVolume > 1) {
    errors.push('musicVolume debe estar entre 0 y 1')
  }
  if (typeof config.musicPaused !== 'boolean') {
    errors.push('musicPaused debe ser boolean')
  }
  if (typeof config.systemSoundsEnabled !== 'boolean') {
    errors.push('systemSoundsEnabled debe ser boolean')
  }
  // OTEL
  if (config.otelEndpoint) {
    try {
      const url = new URL(config.otelEndpoint)
      if (!['http:', 'https:'].includes(url.protocol)) {
        errors.push('otelEndpoint debe usar protocolo http o https')
      }
    } catch {
      errors.push('otelEndpoint no es una URL válida')
    }
  }
  const validOtelProtocols: OtelProtocol[] = ['http/protobuf', 'http/json', 'grpc']
  if (!validOtelProtocols.includes(config.otelProtocol)) {
    errors.push('otelProtocol debe ser http/protobuf, http/json o grpc')
  }
  return errors
}
