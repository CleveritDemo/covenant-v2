import { isAgentCliProvider, type AgentCliProvider } from './agentCliProviders'
import type { OrgWorkspaceCatalog } from './orgWorkspaceCatalog'
import { parseOrgWorkspaceCatalog } from './orgWorkspaceCatalog'

/** Política de ejecución de shell del modo agente (el modelo propone bloques RUN). */
export type AgentShellPolicy = 'off' | 'ask' | 'always'

/** Proveedor de IA seleccionado. */
export type AiProvider = 'ollama' | 'anthropic' | 'openai'

/** Idioma de la interfaz. */
export type Language = 'en' | 'es'

const DEFAULT_MUSIC_VOLUME = 0.35

/**
 * Volumen de música interna: escala 0..1.
 * Valores fuera de rango se clampean; p. ej. 35 → 1 (no se interpreta como 35%).
 */
export function sanitizeMusicVolume(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return DEFAULT_MUSIC_VOLUME
  return Math.min(1, Math.max(0, n))
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
  /** Volumen del reproductor interno (0..1). */
  musicVolume: number
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
   * Snapshot de workspaces org para Cmd+T sin red.
   * Ausente/undefined = sin tocar en merges parciales; null = borrar cache.
   */
  orgWorkspaceCatalogCache?: OrgWorkspaceCatalog | null
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
  agentMode: false,
  agentLoop: false,
  agentShellPolicy: 'off',
  thinkingMode: false,
  musicEnabled: true,
  musicVolume: DEFAULT_MUSIC_VOLUME,
  language: 'en',
  reduceMotion: false,
  autoRestartShell: true,
  discordPresenceEnabled: false,
  autoUpdatesEnabled: true,
  agentCliCommands: {},
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
  const agentCliCommands = migrateAgentCliCommands(partial)
  const defaultWorkspacesDir = typeof partial.defaultWorkspacesDir === 'string'
    ? partial.defaultWorkspacesDir
    : CONFIG_DEFAULTS.defaultWorkspacesDir
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
  const merged = {
    ...CONFIG_DEFAULTS,
    ...partial,
    musicVolume,
    reduceMotion,
    autoUpdatesEnabled,
    agentCliCommands,
    defaultWorkspacesDir,
  } as AppConfig & Record<string, unknown>
  for (const legacyKey of Object.keys(LEGACY_AGENT_CLI_KEYS)) delete merged[legacyKey]
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
  if (typeof config.defaultWorkspacesDir !== 'string') {
    errors.push('defaultWorkspacesDir debe ser un string')
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
  return errors
}
