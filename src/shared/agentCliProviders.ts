/**
 * Registro único de CLIs de agente.
 *
 * Una entrada por proveedor: comando por defecto, cómo se leen sus eventos y
 * cómo se traducen `permissionMode` / modelo / sesión a flags. Todo lo demás
 * (settings, picker, mini-face, runtime, catálogo) itera esta tabla, así que
 * agregar un CLI es agregar una entrada.
 *
 * Los flags están verificados contra el `--help` de cada CLI (2026-08).
 */

/** Modo de permisos del pane de agente. */
export type AgentPermissionMode = 'ask' | 'auto' | 'plan'

/**
 * Cómo se interpreta stdout del CLI:
 * - `claude` | `cursor` | `copilot` | `codex`: NDJSON con normalizador propio.
 * - `text`: sin salida estructurada; cada línea es texto del asistente.
 *   Sin tool-calls ni resume de sesión, pero la conversación se ve completa.
 */
export type AgentCliStreamKind = 'claude' | 'cursor' | 'copilot' | 'codex' | 'text'

export interface AgentCliArgsInput {
  prompt: string
  cwd: string
  mode: AgentPermissionMode
  /** Modelo ya recortado, o vacío para el default del CLI. */
  model?: string
  /** Sesión previa del CLI para continuar el hilo. */
  sessionId?: string
  /** Deniega la tool `Skill`: el proceso no puede invocar ninguna skill. */
  disableSkills?: boolean
  /** Rutas de plugin a cargar solo para este spawn. Vacío = ninguna. */
  pluginDirs?: string[]
  /** Ruta a un mcp.json efímero con solo los servidores permitidos. */
  mcpConfigPath?: string
}

/** Disponibilidad real del CLI de un proveedor en la máquina. */
export interface AgentCliResolution {
  provider: AgentCliProvider
  /** Comando comprobado: el que se escribió, el configurado o el por defecto. */
  command: string
  /** Ruta absoluta del binario, o `null` si no está en el PATH. */
  path: string | null
  /** Versión que reporta `--version`, o `null` si el CLI no la da. */
  version: string | null
}

export interface AgentCliProviderSpec {
  /** Nombre de marca: no se traduce. */
  label: string
  /** Color de marca del icono (ver `BrandIcon`). */
  brand: string
  /** Ejecutable por defecto cuando el usuario no configura otro. */
  command: string
  stream: AgentCliStreamKind
  args: (input: AgentCliArgsInput) => string[]
}

const withModel = (flag: string, model: string | undefined): string[] =>
  model?.trim() ? [flag, model.trim()] : []

/**
 * `--disallowedTools` una sola vez con todo lo denegado. Emitir el flag dos
 * veces no equivale a una lista fusionada.
 */
const disallowedTools = (mode: AgentPermissionMode, disableSkills?: boolean): string[] => {
  const tools = [
    // Ask: sin escritura. Claude no tiene --mode ask; en -p no hay UI de
    // confirmación, así que bloqueamos herramientas que mutan el workspace.
    ...(mode === 'ask' ? ['Edit', 'Write', 'NotebookEdit', 'Bash', 'MultiEdit'] : []),
    ...(disableSkills ? ['Skill'] : []),
  ]
  return tools.length ? ['--disallowedTools', tools.join(',')] : []
}

export const AGENT_CLI_PROVIDERS = {
  claude: {
    label: 'Claude Code',
    brand: '#D97757',
    command: 'claude',
    stream: 'claude',
    args: ({ prompt, mode, model, sessionId, disableSkills, pluginDirs, mcpConfigPath }) => [
      '-p',
      prompt,
      '--output-format',
      'stream-json',
      '--verbose',
      '--include-partial-messages',
      // Excluye el scope `user`, que es donde el harness instala los plugins
      // (~/.claude/plugins/cache). Sin esta exclusión, --plugin-dir solo suma
      // y la allowlist no acota nada. Verificado con un spawn real.
      '--setting-sources', 'project',
      ...(pluginDirs ?? []).flatMap(dir => ['--plugin-dir', dir]),
      // --strict-mcp-config es la mitad que acota: sin él, este config se suma
      // a los demás en vez de sustituirlos.
      ...(mcpConfigPath ? ['--mcp-config', mcpConfigPath, '--strict-mcp-config'] : []),
      ...(sessionId ? ['--resume', sessionId] : []),
      ...disallowedTools(mode, disableSkills),
      ...(mode === 'auto' ? ['--permission-mode', 'bypassPermissions'] : []),
      ...(mode === 'plan' ? ['--permission-mode', 'plan'] : []),
      ...withModel('--model', model),
    ],
  },
  cursor: {
    label: 'Cursor Agent',
    brand: '#8A93A0',
    command: 'agent',
    stream: 'cursor',
    args: ({ prompt, cwd, mode, model, sessionId }) => [
      '-p',
      '--output-format',
      'stream-json',
      '--stream-partial-output',
      '--workspace',
      cwd,
      ...(sessionId ? ['--resume', sessionId] : []),
      // Ask/Plan son solo lectura en el CLI de Cursor; sin flag, el default escribe.
      ...(mode === 'ask' ? ['--mode', 'ask'] : []),
      ...(mode === 'auto' ? ['--force'] : []),
      ...(mode === 'plan' ? ['--mode', 'plan'] : []),
      ...withModel('--model', model),
      prompt,
    ],
  },
  copilot: {
    label: 'GitHub Copilot',
    brand: '#6DD29A',
    command: 'copilot',
    stream: 'copilot',
    args: ({ prompt, mode, model, sessionId }) => [
      '-p',
      prompt,
      '--output-format',
      'json',
      ...(mode === 'auto' ? ['--yolo'] : []),
      ...(mode === 'plan' ? ['--plan'] : []),
      ...(sessionId ? [`--resume=${sessionId}`] : []),
      ...withModel('--model', model),
    ],
  },
  codex: {
    label: 'Codex',
    brand: '#9BA3AE',
    command: 'codex',
    stream: 'codex',
    // `codex exec [resume <id>] --json`: el prompt va al final.
    // `--skip-git-repo-check` porque el cwd del pane puede no ser un repo.
    args: ({ prompt, mode, model, sessionId }) => [
      'exec',
      ...(sessionId ? ['resume', sessionId] : []),
      '--json',
      '--skip-git-repo-check',
      ...(mode === 'auto'
        ? ['--dangerously-bypass-approvals-and-sandbox']
        : ['--sandbox', 'read-only']),
      ...withModel('-m', model),
      prompt,
    ],
  },
  gemini: {
    label: 'Gemini',
    brand: '#8E75B2',
    command: 'gemini',
    stream: 'claude',
    // ponytail: `-o stream-json` de Gemini publica eventos con el mismo sobre
    // que Claude Code, así que reusamos su normalizador. No pude verificarlo
    // en vivo (sin auth en esta máquina); si el esquema difiere, el runtime
    // cae al volcado crudo de stdout y basta con darle su propio normalizador.
    args: ({ prompt, mode, model }) => [
      '-p',
      prompt,
      '-o',
      'stream-json',
      ...(mode === 'auto' ? ['--yolo'] : []),
      ...(mode === 'plan' ? ['--approval-mode', 'plan'] : []),
      ...withModel('-m', model),
    ],
  },
  kimi: {
    label: 'Kimi',
    brand: '#7D8EFF',
    command: 'kimi',
    stream: 'claude',
    // ponytail: mismo caso que Gemini — `--output-format stream-json` es
    // compatible con el de Claude Code.
    args: ({ prompt, mode, model, sessionId }) => [
      '-p',
      prompt,
      '--output-format',
      'stream-json',
      ...(mode === 'auto' ? ['-y'] : []),
      ...(sessionId ? ['-S', sessionId] : []),
      ...withModel('-m', model),
    ],
  },
  opencode: {
    label: 'Opencode',
    brand: '#8A93A0',
    command: 'opencode',
    stream: 'text',
    // ponytail: `--format json` existe pero su esquema de eventos no está
    // documentado; usamos la salida normal como texto. Upgrade: normalizador
    // propio + `-s <id>` para recuperar la sesión.
    args: ({ prompt, mode, model }) => [
      'run',
      ...(mode === 'plan' ? ['--agent', 'plan'] : []),
      ...withModel('-m', model),
      prompt,
    ],
  },
  pi: {
    label: 'Pi',
    brand: '#7C8AFF',
    command: 'pi',
    stream: 'text',
    // ponytail: pi no expone permisos por flag (--approve es confianza en
    // archivos del proyecto, no en herramientas), así que `mode` no se mapea.
    args: ({ prompt, model }) => [
      '-p',
      ...withModel('--model', model),
      prompt,
    ],
  },
  hermes: {
    label: 'Hermes',
    brand: '#C9A227',
    command: 'hermes',
    stream: 'text',
    args: ({ prompt, mode, model }) => [
      '-z',
      prompt,
      ...(mode === 'auto' ? ['--yolo'] : []),
      ...withModel('-m', model),
    ],
  },
} satisfies Record<string, AgentCliProviderSpec>

export type AgentCliProvider = keyof typeof AGENT_CLI_PROVIDERS

export const AGENT_CLI_PROVIDER_IDS = Object.keys(AGENT_CLI_PROVIDERS) as AgentCliProvider[]

export function isAgentCliProvider(value: unknown): value is AgentCliProvider {
  return typeof value === 'string' && value in AGENT_CLI_PROVIDERS
}

export function agentCliSpec(provider: AgentCliProvider): AgentCliProviderSpec {
  return AGENT_CLI_PROVIDERS[provider]
}

/** Ejecutable configurado por el usuario, o el default del proveedor. */
export function agentCliCommand(
  commands: Partial<Record<AgentCliProvider, string>> | undefined,
  provider: AgentCliProvider,
): string {
  return (commands?.[provider] ?? '').trim() || AGENT_CLI_PROVIDERS[provider].command
}
