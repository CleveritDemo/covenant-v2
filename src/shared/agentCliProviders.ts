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
export type AgentPermissionMode = 'auto' | 'plan'

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
  /**
   * Directorio vacío y descartable. Para los CLIs cuyo único modo de acotar
   * skills es "lee de aquí en vez de descubrir" (kimi): apuntarlos a un
   * directorio sin nada es la forma de decir "ninguna".
   */
  emptySkillsDir?: string
  /** Ruta a un mcp.json efímero con solo los servidores permitidos. */
  mcpConfigPath?: string
  /** Nombres permitidos, para los CLIs que aceptan la allowlist directa. */
  mcpAllowed?: string[]
  /**
   * Nombres a desactivar = configurados − permitidos. Para los CLIs que solo
   * saben quitar de uno en uno (copilot). Derivado por el runtime, que es
   * quien puede leer la config del CLI.
   */
  mcpDisabled?: string[]
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
  /**
   * Qué sabe acotar este CLI por spawn. Omitido = nada.
   * Solo se marca `true` con el flag verificado contra el `--help` del CLI,
   * igual que el resto de la tabla.
   *
   * `nativeSkills` es poder **apagarlas**; `nativeSkillNamespaces` es además
   * poder dejar pasar unas y no otras. Hay CLIs que solo tienen lo primero
   * (`opencode --pure`), y ofrecer ahí una allowlist sería mentir.
   */
  capabilities?: {
    nativeSkills?: boolean
    nativeSkillNamespaces?: boolean
    mcpAllowlist?: boolean
  }
}

const withModel = (flag: string, model: string | undefined): string[] =>
  model?.trim() ? [flag, model.trim()] : []

/**
 * Flags de los CLIs que acotan skills sustituyendo el directorio de origen en
 * vez de excluir el scope de usuario. Sin permitidos (gate apagado o allowlist
 * vacía) apunta al directorio vacío, que es su forma de decir "ninguna".
 */
const skillsDirFlags = (
  flag: string,
  input: Pick<AgentCliArgsInput, 'disableSkills' | 'pluginDirs' | 'emptySkillsDir'>,
): string[] => {
  const dirs = input.disableSkills ? [] : input.pluginDirs ?? []
  const sources = dirs.length ? dirs : [input.emptySkillsDir].filter((dir): dir is string => Boolean(dir))
  return sources.flatMap(dir => [flag, dir])
}

/**
 * `--disallowedTools` una sola vez con todo lo denegado. Emitir el flag dos
 * veces no equivale a una lista fusionada.
 */
const disallowedTools = (disableSkills?: boolean): string[] => {
  return disableSkills ? ['--disallowedTools', 'Skill'] : []
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
      ...disallowedTools(disableSkills),
      ...(mode === 'auto' ? ['--permission-mode', 'bypassPermissions'] : []),
      ...(mode === 'plan' ? ['--permission-mode', 'plan'] : []),
      ...withModel('--model', model),
    ],
    capabilities: { nativeSkills: true, nativeSkillNamespaces: true, mcpAllowlist: true },
  },
  cursor: {
    label: 'Cursor Agent',
    brand: '#8A93A0',
    command: 'agent',
    stream: 'cursor',
    args: ({ prompt, cwd, mode, model, sessionId }) => [
      '-p',
      // headless requiere --trust; sin él plan falla en carpetas no confiadas (auto a veces pasa por --force).
      '--trust',
      '--output-format',
      'stream-json',
      '--stream-partial-output',
      '--workspace',
      cwd,
      ...(sessionId ? ['--resume', sessionId] : []),
      // Plan es solo lectura en el CLI de Cursor; sin flag, el default escribe.
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
    args: ({ prompt, mode, model, sessionId, mcpDisabled }) => [
      '-p',
      prompt,
      '--output-format',
      'json',
      // Copilot no tiene el par --mcp-config/--strict-mcp-config: su
      // --additional-mcp-config *suma* a ~/.copilot/mcp-config.json. La única
      // vía es la inversa — apagar el built-in y cada servidor no permitido,
      // que el runtime deriva de esa misma config. Un servidor que aparezca
      // después de leerla no queda cubierto: es una denylist, no un sandbox.
      ...(mcpDisabled?.length
        ? ['--disable-builtin-mcps', ...mcpDisabled.flatMap(name => ['--disable-mcp-server', name])]
        : []),
      ...(mode === 'auto' ? ['--yolo'] : []),
      ...(mode === 'plan' ? ['--plan'] : []),
      ...(sessionId ? [`--resume=${sessionId}`] : []),
      ...withModel('--model', model),
    ],
    capabilities: { mcpAllowlist: true },
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
    args: ({ prompt, mode, model, mcpAllowed }) => [
      '-p',
      prompt,
      '-o',
      'stream-json',
      // El único CLI con allowlist nativa por nombre; no hace falta config
      // efímero ni derivar una denylist.
      ...(mcpAllowed?.length ? ['--allowed-mcp-server-names', ...mcpAllowed] : []),
      ...(mode === 'auto' ? ['--yolo'] : []),
      ...(mode === 'plan' ? ['--approval-mode', 'plan'] : []),
      ...withModel('-m', model),
    ],
    capabilities: { mcpAllowlist: true },
  },
  kimi: {
    label: 'Kimi',
    brand: '#7D8EFF',
    command: 'kimi',
    stream: 'claude',
    // ponytail: mismo caso que Gemini — `--output-format stream-json` es
    // compatible con el de Claude Code.
    args: ({ prompt, mode, model, sessionId, disableSkills, pluginDirs, emptySkillsDir }) => [
      '-p',
      prompt,
      '--output-format',
      'stream-json',
      // `--skills-dir` carga "en vez de" los directorios auto-descubiertos de
      // usuario y proyecto, así que acota sin necesitar un flag de exclusión.
      // Sin permitidos no hay nada que apuntar: un directorio vacío es cómo se
      // dice "ninguna" en este CLI.
      ...skillsDirFlags('--skills-dir', { disableSkills, pluginDirs, emptySkillsDir }),
      ...(mode === 'auto' ? ['-y'] : []),
      ...(sessionId ? ['-S', sessionId] : []),
      ...withModel('-m', model),
    ],
    capabilities: { nativeSkills: true, nativeSkillNamespaces: true },
  },
  opencode: {
    label: 'Opencode',
    brand: '#8A93A0',
    command: 'opencode',
    stream: 'text',
    // ponytail: `--format json` existe pero su esquema de eventos no está
    // documentado; usamos la salida normal como texto. Upgrade: normalizador
    // propio + `-s <id>` para recuperar la sesión.
    args: ({ prompt, mode, model, disableSkills }) => [
      'run',
      // `--pure` corre sin plugins externos: apaga, pero no sabe dejar pasar
      // unos y no otros. De ahí que no declare `nativeSkillNamespaces`.
      ...(disableSkills ? ['--pure'] : []),
      ...(mode === 'plan' ? ['--agent', 'plan'] : []),
      ...withModel('-m', model),
      prompt,
    ],
    capabilities: { nativeSkills: true },
  },
  pi: {
    label: 'Pi',
    brand: '#7C8AFF',
    command: 'pi',
    stream: 'text',
    // ponytail: pi no expone permisos por flag (--approve es confianza en
    // archivos del proyecto, no en herramientas), así que `mode` no se mapea.
    args: ({ prompt, model, disableSkills, pluginDirs }) => [
      '-p',
      // Misma forma que Claude: `--no-skills` mata el descubrimiento y
      // `--skill` vuelve a añadir solo lo permitido.
      // ponytail: que `--skill` sobreviva a `--no-skills` es lo que el propio
      // help afirma del par equivalente `--no-extensions`/`-e`; no pude
      // comprobarlo en vivo (sin auth de pi en esta máquina). Si no sobrevive,
      // el agente se queda sin skills en vez de con todas — falla cerrado, que
      // es el default de este gate. Upgrade: un spawn real con `--verbose`.
      '--no-skills',
      ...(disableSkills ? [] : (pluginDirs ?? []).flatMap(dir => ['--skill', dir])),
      ...withModel('--model', model),
      prompt,
    ],
    capabilities: { nativeSkills: true, nativeSkillNamespaces: true },
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
  grok: {
    label: 'Grok',
    brand: '#6E7681',
    command: 'grok',
    stream: 'text',
    // ponytail: `grok -p <prompt> -m <model> -d <dir>` está en la doc del CLI,
    // pero no pude correr `grok --help` en vivo (no está instalado en esta
    // máquina). No documenta flag de auto-aprobación ni de plan, así que
    // `mode` no se mapea: en Plan el CLI escribe igual. Tampoco expone
    // salida estructurada ni resume de sesión, de ahí `stream: 'text'` y que
    // no se pase `sessionId`. Sin `capabilities`: falla cerrado.
    args: ({ prompt, cwd, model }) => [
      '-p',
      prompt,
      '-d',
      cwd,
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

/**
 * Lo que la UI puede ofrecer para este proveedor. Un CLI sin el flag
 * verificado devuelve `false`: el control se muestra deshabilitado con el
 * motivo, porque prometer un acotado que no se aplica es peor que no ofrecerlo.
 */
export function providerCapabilities(
  provider: AgentCliProvider,
): { nativeSkills: boolean; nativeSkillNamespaces: boolean; mcpAllowlist: boolean } {
  // Vía `agentCliSpec` y no el registro directo: `satisfies` conserva el tipo
  // literal de cada entrada, y las que omiten `capabilities` no tienen la
  // propiedad en su tipo.
  const caps = agentCliSpec(provider).capabilities
  return {
    nativeSkills: caps?.nativeSkills === true,
    nativeSkillNamespaces: caps?.nativeSkillNamespaces === true,
    mcpAllowlist: caps?.mcpAllowlist === true,
  }
}

/** Ejecutable configurado por el usuario, o el default del proveedor. */
export function agentCliCommand(
  commands: Partial<Record<AgentCliProvider, string>> | undefined,
  provider: AgentCliProvider,
): string {
  return (commands?.[provider] ?? '').trim() || AGENT_CLI_PROVIDERS[provider].command
}
