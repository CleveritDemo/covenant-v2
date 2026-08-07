import { isAgentCliProvider, type AgentCliProvider } from './agentCliProviders'
import type { OrgWorkspaceCatalog } from './orgWorkspaceCatalog'
import { parseOrgWorkspaceCatalog } from './orgWorkspaceCatalog'

/** Política de ejecución de shell del modo agente (el modelo propone bloques RUN). */
export type AgentShellPolicy = 'off' | 'ask' | 'always'

/** Proveedor de IA seleccionado. */
export type AiProvider = 'ollama' | 'anthropic' | 'openai'

/** Idioma de la interfaz. */
export type Language = 'en' | 'es'

const SPOTIFY_PLAYLIST_ID_RE = /^[a-zA-Z0-9]{22}$/

/**
 * Obtiene el ID de playlist de Spotify (22 caracteres) desde un ID crudo o desde enlaces habituales.
 * Devuelve `null` si la cadena no está vacía pero no se reconoce.
 */
export function parseSpotifyPlaylistId(raw: string): string | null {
  const s = raw.trim()
  if (!s) return null
  if (SPOTIFY_PLAYLIST_ID_RE.test(s)) return s
  const fromUrl = s.match(
    /open\.spotify\.com\/(?:[^/]+\/)*playlist\/([a-zA-Z0-9]{22})(?:\?|#|$|\/)/i,
  )
  if (fromUrl) return fromUrl[1]
  const fromUri = s.match(/^spotify:playlist:([a-zA-Z0-9]{22})$/i)
  if (fromUri) return fromUri[1]
  return null
}

/** Convierte enlaces reconocibles a ID de 22 caracteres; deja sin cambio entradas no vacías no reconocidas (para que falle la validación). */
export function canonicalizeMusicPlaylistIdsByMood(byMood: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(byMood)) {
    const t = (v ?? '').trim()
    if (!t) continue
    const id = parseSpotifyPlaylistId(t)
    out[k] = id ?? t
  }
  return out
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
  /** Muestra los controles de música en la barra de título. */
  musicEnabled: boolean
  /**
   * IDs de playlist de Spotify (22 caracteres) por clave de estado de ánimo (`musicMoods`).
   * Solo se usan entradas no vacías.
   */
  musicPlaylistIdsByMood?: Record<string, string>
  /** Idioma de la interfaz. */
  language: Language
  /**
   * Baja animaciones del plano y chat de agentes (también respeta OS reduce-motion vía DOM).
   */
  reduceMotion: boolean
  /** Reiniciar shell automáticamente tras exit en un panel de terminal. */
  autoRestartShell: boolean
  /**
   * Ejecutables usados por las ventanas de agente CLI, por proveedor.
   * Entrada vacía o ausente = comando por defecto de `AGENT_CLI_PROVIDERS`.
   */
  agentCliCommands: Partial<Record<AgentCliProvider, string>>
  /** Mood de música activo en la barra de título. */
  musicMood?: string
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
  agentMode: false,
  agentLoop: false,
  agentShellPolicy: 'off',
  thinkingMode: false,
  musicEnabled: true,
  musicPlaylistIdsByMood: {},
  language: 'en',
  reduceMotion: false,
  autoRestartShell: true,
  agentCliCommands: {},
  musicMood: 'focus',
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
  const rawMoods = {
    ...CONFIG_DEFAULTS.musicPlaylistIdsByMood,
    ...(partial.musicPlaylistIdsByMood ?? {}),
  }
  const moods = canonicalizeMusicPlaylistIdsByMood(rawMoods)
  const reduceMotion = typeof partial.reduceMotion === 'boolean'
    ? partial.reduceMotion
    : CONFIG_DEFAULTS.reduceMotion
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
    musicPlaylistIdsByMood: moods,
    reduceMotion,
    agentCliCommands,
    defaultWorkspacesDir,
  } as AppConfig & Record<string, unknown>
  for (const legacyKey of Object.keys(LEGACY_AGENT_CLI_KEYS)) delete merged[legacyKey]
  if (catalogKeyPresent) {
    if (orgWorkspaceCatalogCache) merged.orgWorkspaceCatalogCache = orgWorkspaceCatalogCache
    else delete merged.orgWorkspaceCatalogCache
  } else if (
    merged.orgWorkspaceCatalogCache !== undefined
    && parseOrgWorkspaceCatalog(merged.orgWorkspaceCatalogCache) == null
  ) {
    delete merged.orgWorkspaceCatalogCache
  }
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
  const pol = config.agentShellPolicy
  if (pol !== 'off' && pol !== 'ask' && pol !== 'always') {
    errors.push('agentShellPolicy debe ser off, ask o always')
  }
  const byMood = config.musicPlaylistIdsByMood ?? {}
  for (const [k, v] of Object.entries(byMood)) {
    const t = (v ?? '').trim()
    if (!t) continue
    const id = parseSpotifyPlaylistId(t)
    if (!id) {
      errors.push(
        `musicPlaylistIdsByMood["${k}"] debe ser un ID de 22 caracteres o un enlace open.spotify.com/playlist/…`,
      )
    }
  }
  return errors
}
