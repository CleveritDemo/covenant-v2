// IPC channel names shared between main, preload and renderer
export const IPC = {
  // PTY
  PTY_CREATE: 'pty:create',
  PTY_WRITE: 'pty:write',
  PTY_RESIZE: 'pty:resize',
  PTY_KILL: 'pty:kill',
  PTY_DATA: 'pty:data',
  PTY_EXIT: 'pty:exit',
  PTY_ERROR: 'pty:error',
  // Agent CLI
  AGENT_CLI_START: 'agentCli:start',
  AGENT_CLI_STOP: 'agentCli:stop',
  AGENT_CLI_EVENT: 'agentCli:event',
  AGENT_CLI_EXIT: 'agentCli:exit',
  /** Renderer → main: ¿hay un turno de agente CLI en curso para este pane? */
  AGENT_CLI_IS_ACTIVE: 'agentCli:isActive',
  /** Renderer → main: listar modelos del CLI por provider. */
  AGENT_CLI_LIST_MODELS: 'agentCli:listModels',
  /** Renderer → main: ¿está el CLI de este provider en el PATH? Ruta y versión. */
  AGENT_CLI_RESOLVE: 'agentCli:resolve',
  /** Renderer → main: iniciar sala de brainstorm round-robin. */
  BRAINSTORM_START: 'brainstorm:start',
  /** Renderer → main: detener sala de brainstorm. */
  BRAINSTORM_STOP: 'brainstorm:stop',
  /** Renderer → main: pausar sala de brainstorm (conserva run + archivo). */
  BRAINSTORM_PAUSE: 'brainstorm:pause',
  /** Renderer → main: inyectar voz humana en el transcript de la sala. */
  BRAINSTORM_INJECT_HUMAN: 'brainstorm:injectHuman',
  /** Main → renderer: eventos de sala de brainstorm. */
  BRAINSTORM_EVENT: 'brainstorm:event',
  /** Renderer → main (invoke): listar salas en `.gravity/brainstorms/`. */
  BRAINSTORM_LIST: 'brainstorm:list',
  /** Renderer → main (invoke): crear/actualizar sala en disco. */
  BRAINSTORM_UPSERT: 'brainstorm:upsert',
  /** Renderer → main (invoke): borrar sala del catálogo en disco. */
  BRAINSTORM_DELETE: 'brainstorm:delete',
  /** Renderer → main (invoke): limpiar salas done/stopped antiguas. */
  BRAINSTORM_PRUNE: 'brainstorm:prune',
  /** Renderer → main (invoke): añadir contexto/archivo al working set de una sala activa. */
  BRAINSTORM_WORKING_SET_ADD: 'brainstorm:workingSetAdd',
  /** Renderer → main (invoke): exportar transcript de sala a Markdown. */
  BRAINSTORM_EXPORT_MD: 'brainstorm:exportMd',
  AGENT_CHAT_LOAD: 'agentChat:load',
  AGENT_CHAT_SAVE: 'agentChat:save',
  AGENT_CHAT_DELETE: 'agentChat:delete',
  /** Renderer → main: reinicia entrega de contextos (turnos/catálogo) de una sesión CLI. */
  AGENT_CONTEXT_DELIVERY_CLEAR: 'agentContextDelivery:clear',
  /** Renderer → main: contadores acumulados de entrega de contexto y tokens. */
  CONTEXT_METRICS_GET: 'contextMetrics:get',
  /** Renderer → main: servidores MCP configurados para el CLI de un proveedor. */
  AGENT_MCP_SERVERS_LIST: 'agentMcpServers:list',
  /** Renderer → main (invoke): revela el archivo de config MCP del CLI, creándolo si falta */
  AGENT_MCP_CONFIG_REVEAL: 'agentMcpServers:revealConfig',
  /** Renderer → main (invoke): texto crudo del archivo de config MCP del CLI. */
  AGENT_MCP_CONFIG_READ: 'agentMcpServers:readConfig',
  /** Renderer → main (invoke): sobrescribe ese archivo si el JSON es válido. */
  /**
   * Renderer → main (invoke): copia un servidor del `.mcp.json` del proyecto a
   * la config propia del CLI. Es la salida del callejón «este CLI no lee ese
   * archivo»: antes había que editarlo a mano fuera de la app.
   */
  AGENT_MCP_IMPORT_PROJECT: 'agentMcpServers:importProject',
  AGENT_MCP_CONFIG_WRITE: 'agentMcpServers:writeConfig',
  TAB_CONTEXT_PREVIEW: 'tabContext:preview',
  TAB_CONTEXT_MATERIALIZE: 'tabContext:materialize',
  TAB_CONTEXT_MERGE_ANNOTATIONS: 'tabContext:mergeAnnotations',
  TAB_CONTEXT_DISCOVER: 'tabContext:discover',
  TAB_CONTEXT_DELETE: 'tabContext:delete',
  /** Renderer → main: revela el .md del contexto en el Finder. */
  TAB_CONTEXT_REVEAL: 'tabContext:reveal',
  /** Renderer → main: crea .gravity/results/<slug>.md si no existe. */
  AGENT_RESULTS_ENSURE: 'agentResults:ensure',
  /** Renderer → main: guarda solo la región notes de un results. */
  AGENT_RESULTS_SET_NOTES: 'agentResults:setNotes',
  /** Main → renderer: usuario pulsó ⌘W / Ctrl+W (cerrar pestaña o ventana según estado) */
  SHORTCUT_CLOSE_TAB: 'shortcut:close-tab',
  // Config
  CONFIG_GET: 'config:get',
  CONFIG_SET: 'config:set',
  CONFIG_OPEN_FOLDER: 'config:openFolder',
  // Discord Rich Presence
  /** Renderer → main: publica la actividad (details, state, inicio en epoch s) */
  DISCORD_PRESENCE_SET: 'discord:presence:set',
  /** Renderer → main: borra la actividad y cierra el socket */
  DISCORD_PRESENCE_CLEAR: 'discord:presence:clear',
  /** Renderer → main: una línea completa enviada al PTY (para detectar `cd`) */
  CD_RECENT_RECORD_LINE: 'cdRecent:recordLine',
  /** Renderer → main: lee rutas de user-history/cd-recent.md */
  CD_RECENT_LIST: 'cdRecent:list',
  /** Renderer → main: cwd lógico de una sesión PTY */
  GET_SESSION_CWD: 'cdRecent:getCwd',
  /** Renderer → main: lista de subdirectorios del cwd actual de una sesión */
  LIST_CWD_DIRS: 'cdRecent:listCwdDirs',
  /** Renderer → main: abre una carpeta en Finder */
  OPEN_FOLDER: 'shell:openFolder',
  /** Renderer → main (invoke): diálogo nativo para elegir carpeta de proyecto */
  SELECT_DIRECTORY: 'shell:selectDirectory',
  CONTEXT_IMPORT_FILES: 'tabContext:importFiles',
  /** Renderer → main (invoke): abrir URL externa (http(s) / spotify:); playlists web → app si hay cliente */
  OPEN_EXTERNAL_URL: 'shell:openExternalUrl',
  /** Renderer → main (invoke): ¿cliente Spotify de escritorio instalado? */
  SPOTIFY_DESKTOP_INSTALLED: 'spotify:desktopInstalled',
  /** Renderer → main (invoke): reproducir playlist por ID (22 chars) */
  SPOTIFY_PLAY_PLAYLIST: 'spotify:playPlaylist',
  SPOTIFY_PAUSE: 'spotify:pause',
  SPOTIFY_PLAY: 'spotify:play',
  /** Renderer → main (invoke): estado aproximado de reproducción */
  SPOTIFY_GET_STATE: 'spotify:getState',
  /** Renderer → main: listado del cwd de la sesión + package.json (contexto IA) */
  PROJECT_AI_CONTEXT_GET: 'project:aiContext',
  /** Renderer → main (invoke): lee `.ai-terminal/agent.md` del cwd de la sesión; null si no existe */
  AGENT_MD_READ: 'agentMd:read',
  /** Renderer → main (invoke): escribe `.ai-terminal/agent.md` en el cwd de la sesión */
  AGENT_MD_WRITE: 'agentMd:write',
  /** Renderer → main (invoke): árbol superficial de carpetas del cwd (bootstrap agent.md) */
  AGENT_MD_TREE: 'agentMd:tree',
  /** Renderer → main (invoke): leer archivo relativo al cwd de la sesión (modo agente) */
  AGENT_FILE_READ: 'agentFile:read',
  /** Renderer → main (invoke): escribir archivo relativo al cwd de la sesión (modo agente) */
  AGENT_FILE_WRITE: 'agentFile:write',
  /** Renderer → main (invoke): parche search/replace en un archivo (modo agente) */
  AGENT_FILE_PATCH: 'agentFile:patch',
  /** Renderer → main (invoke): ejecutar una línea de shell en el cwd de la sesión (modo agente) */
  AGENT_SHELL_RUN: 'agentShell:run',

  /** Renderer → main (invoke): estado git del cwd de la sesión o path */
  GIT_STATUS: 'git:status',
  /** Renderer → main (invoke): repos git a 1 nivel bajo una carpeta */
  GIT_LIST_REPOS: 'git:listRepos',
  /** Renderer → main (invoke): unión dedupeada de repos bajo varias raíces */
  GIT_COLLECT_UNIQUE_REPOS: 'git:collectUniqueRepos',
  /** Renderer → main (invoke): texto truncado para sugerir mensaje de commit (IA) */
  GIT_DIFF_FOR_AI: 'git:diffForAi',
  /** Diff de un archivo concreto, para verlo antes de commitear. */
  GIT_DIFF_FILE: 'git:diffFile',
  GIT_PULL: 'git:pull',
  GIT_PUSH: 'git:push',
  GIT_COMMIT: 'git:commit',
  GIT_STAGE_ALL: 'git:stageAll',
  GIT_STAGE_FILE: 'git:stageFile',
  GIT_UNSTAGE_ALL: 'git:unstageAll',
  GIT_UNSTAGE_FILE: 'git:unstageFile',
  /** Destructivo: tira los cambios del worktree de un archivo. */
  GIT_DISCARD_FILE: 'git:discardFile',

  /** Renderer → main (invoke): rama actual del repo (`rev-parse --abbrev-ref HEAD`) */
  GIT_CURRENT_BRANCH: 'git:currentBranch',
  /** Renderer → main (invoke): crea worktree + rama nueva desde una ref */
  GIT_WORKTREE_ADD: 'git:worktreeAdd',
  /** Renderer → main (invoke): merge --no-ff de una rama en el repo base */
  GIT_WORKTREE_MERGE: 'git:worktreeMerge',
  /** Renderer → main (invoke): aborta un merge en curso (idempotente) */
  GIT_WORKTREE_ABORT_MERGE: 'git:worktreeAbortMerge',
  /** Renderer → main (invoke): elimina worktree + rama (best-effort) */
  GIT_WORKTREE_REMOVE: 'git:worktreeRemove',
  /** Renderer → main (invoke): lista worktrees del repo (`worktree list --porcelain`) */
  GIT_WORKTREE_LIST: 'git:worktreeList',

  /** Renderer → main (invoke): workflow runs de GitHub Actions vía gh CLI */
  GITHUB_ACTIONS_LIST: 'githubActions:list',
  /** Renderer → main: ¿de quién es este token y con qué scopes? Vacío = el resuelto del entorno. */
  GITHUB_CHECK_TOKEN: 'github:checkToken',
  /** Renderer → main (invoke): jobs y steps de un run; se pide al desplegarlo. */
  GITHUB_RUN_JOBS: 'githubActions:runJobs',

  /** Renderer → main (invoke): estado de sesión Covenant */
  COVENANT_STATUS: 'covenant:status',
  /** Renderer → main (invoke): exchange JWT vía token GitHub */
  COVENANT_SIGN_IN: 'covenant:signIn',
  /** Renderer → main (invoke): cerrar sesión Covenant */
  COVENANT_SIGN_OUT: 'covenant:signOut',
  /** Renderer → main (invoke): listar organizaciones */
  COVENANT_ORGS_LIST: 'covenant:orgs:list',
  /** Renderer → main (invoke): crear organización */
  COVENANT_ORG_CREATE: 'covenant:org:create',
  /** Renderer → main (invoke): listar miembros de org */
  COVENANT_MEMBERS_LIST: 'covenant:members:list',
  /** Renderer → main (invoke): listar solo logins de miembros (cualquier miembro) */
  COVENANT_MEMBER_LOGINS_LIST: 'covenant:memberLogins:list',
  /** Renderer → main (invoke): agregar miembro a org */
  COVENANT_MEMBER_ADD: 'covenant:member:add',
  /** Renderer → main (invoke): quitar miembro de org */
  COVENANT_MEMBER_REMOVE: 'covenant:member:remove',
  /** Renderer → main (invoke): listar defaults de org */
  COVENANT_DEFAULTS_LIST: 'covenant:defaults:list',
  /** Renderer → main (invoke): fijar default de org */
  COVENANT_DEFAULT_SET: 'covenant:default:set',
  /** Renderer → main (invoke): quitar default de org */
  COVENANT_DEFAULT_UNSET: 'covenant:default:unset',
  /** Renderer → main (invoke): listar workspaces de org */
  COVENANT_WORKSPACES_LIST: 'covenant:workspaces:list',
  /** Renderer → main (invoke): crear workspace de org */
  COVENANT_WORKSPACE_CREATE: 'covenant:workspace:create',
  /** Renderer → main (invoke): renombrar workspace de org */
  COVENANT_WORKSPACE_RENAME: 'covenant:workspace:rename',
  /** Renderer → main (invoke): borrar workspace de org */
  COVENANT_WORKSPACE_DELETE: 'covenant:workspace:delete',
  /** Renderer → main (invoke): agregar assignee a workspace */
  COVENANT_WORKSPACE_ASSIGNEE_ADD: 'covenant:workspace:assignee:add',
  /** Renderer → main (invoke): quitar assignee de workspace */
  COVENANT_WORKSPACE_ASSIGNEE_REMOVE: 'covenant:workspace:assignee:remove',
  /** Renderer → main (invoke): agregar admin de workspace */
  COVENANT_WORKSPACE_ADMIN_ADD: 'covenant:workspace:admin:add',
  /** Renderer → main (invoke): quitar admin de workspace */
  COVENANT_WORKSPACE_ADMIN_REMOVE: 'covenant:workspace:admin:remove',
  /** Renderer → main (invoke): listar agentes de workspace org */
  COVENANT_WORKSPACE_AGENTS_LIST: 'covenant:workspace:agents:list',
  /** Renderer → main (invoke): upsert agente de workspace org */
  COVENANT_WORKSPACE_AGENT_UPSERT: 'covenant:workspace:agent:upsert',
  /** Renderer → main (invoke): borrar agente de workspace org */
  COVENANT_WORKSPACE_AGENT_DELETE: 'covenant:workspace:agent:delete',
  /** Renderer → main (invoke): listar contextos de workspace org */
  COVENANT_WORKSPACE_CONTEXTS_LIST: 'covenant:workspace:contexts:list',
  /** Renderer → main (invoke): upsert contexto de workspace org */
  COVENANT_WORKSPACE_CONTEXT_UPSERT: 'covenant:workspace:context:upsert',
  /** Renderer → main (invoke): rename contexto org (PUT nuevo id + DELETE previousId) */
  COVENANT_WORKSPACE_CONTEXT_RENAME: 'covenant:workspace:context:rename',
  /** Renderer → main (invoke): borrar contexto de workspace org */
  COVENANT_WORKSPACE_CONTEXT_DELETE: 'covenant:workspace:context:delete',
  /** Renderer → main (invoke): listar repos de workspace org */
  COVENANT_WORKSPACE_REPOS_LIST: 'covenant:workspace:repos:list',
  /** Renderer → main (invoke): agregar repo a workspace org */
  COVENANT_WORKSPACE_REPO_ADD: 'covenant:workspace:repo:add',
  /** Renderer → main (invoke): actualizar repo de workspace org (folderName) */
  COVENANT_WORKSPACE_REPO_UPDATE: 'covenant:workspace:repo:update',
  /** Renderer → main (invoke): quitar repo de workspace org */
  COVENANT_WORKSPACE_REPO_DELETE: 'covenant:workspace:repo:delete',
  /** Renderer → main (invoke): clonar repos de un workspace org en disco local */
  COVENANT_WORKSPACE_CLONE: 'covenant:workspaceClone',
  /** Renderer → main (invoke): listar admins locales de org */
  COVENANT_ORG_ADMINS_LIST: 'covenant:orgAdmins:list',
  /** Renderer → main (invoke): agregar admin local de org */
  COVENANT_ORG_ADMIN_ADD: 'covenant:orgAdmin:add',
  /** Renderer → main (invoke): quitar admin local de org */
  COVENANT_ORG_ADMIN_REMOVE: 'covenant:orgAdmin:remove',

  /** Renderer → main (invoke): fijar raíz del explorador para la sesión (projectFolder del tab) */
  FILE_EXPLORER_SET_ROOT: 'fileExplorer:setRoot',
  /** Renderer → main (invoke): listar hijos de un directorio relativo al cwd de la sesión */
  FILE_EXPLORER_LIST_DIR: 'fileExplorer:listDir',
  /** Renderer → main (invoke): leer archivo para el explorador */
  FILE_EXPLORER_LOAD_FILE: 'fileExplorer:loadFile',
  /** Renderer → main (invoke): leer archivo como bytes para los visores (imagen, pdf, xlsx, docx) */
  FILE_EXPLORER_LOAD_BYTES: 'fileExplorer:loadBytes',
  /** Renderer → main (invoke): guardar archivo relativo al cwd de la sesión */
  FILE_EXPLORER_SAVE_FILE: 'fileExplorer:saveFile',
  /** Renderer → main (invoke): crear carpeta relativa al cwd de la sesión */
  FILE_EXPLORER_CREATE_DIR: 'fileExplorer:createDir',
  /** Renderer → main (invoke): crear archivo vacío (falla si ya existe) */
  FILE_EXPLORER_CREATE_FILE: 'fileExplorer:createFile',
  /** Renderer → main (invoke): copiar rutas al portapapeles */
  FILE_EXPLORER_COPY: 'fileExplorer:copy',
  /** Renderer → main (invoke): pegar desde portapapeles en una carpeta */
  FILE_EXPLORER_PASTE: 'fileExplorer:paste',
  /** Renderer → main (invoke): eliminar archivo o carpeta */
  FILE_EXPLORER_DELETE: 'fileExplorer:delete',
  /** Renderer → main (invoke): renombrar archivo o carpeta */
  FILE_EXPLORER_RENAME: 'fileExplorer:rename',
  /** Renderer → main (invoke): cortar rutas al portapapeles */
  FILE_EXPLORER_CUT: 'fileExplorer:cut',
  /** Renderer → main (invoke): mover archivo o carpeta */
  FILE_EXPLORER_MOVE: 'fileExplorer:move',
  /** Renderer → main (invoke): revelar en Finder */
  FILE_EXPLORER_REVEAL: 'fileExplorer:reveal',
  /** Renderer → main (invoke): búsqueda global de archivos (rg --files) */
  FILE_EXPLORER_SEARCH: 'fileExplorer:search',
  /** Renderer → main (invoke): misma búsqueda pero por cwd, sin sesión de explorador */
  PROJECT_FILE_SEARCH: 'project:fileSearch',
  /** Renderer → main: iniciar watcher del cwd */
  FILE_EXPLORER_WATCH_START: 'fileExplorer:watchStart',
  /** Renderer → main: detener watcher */
  FILE_EXPLORER_WATCH_STOP: 'fileExplorer:watchStop',
  /** Main → renderer: cambios en el filesystem */
  FILE_EXPLORER_FS_CHANGED: 'fileExplorer:fsChanged',
  /** Main → renderer: git status cambió (commit/stage) */
  GIT_STATUS_CHANGED: 'git:statusChanged',

  // ─── Persistencia de sesión ────────────────────────────────────────────────
  /** Renderer → main: guardar layout de pestañas + cwds */
  SESSION_SAVE: 'session:save',
  /** Renderer → main (invoke): cargar layout guardado */
  SESSION_LOAD: 'session:load',
  /** Renderer → main (invoke): listar agentes del catálogo del proyecto */
  PROJECT_AGENTS_LIST: 'projectAgents:list',
  /** Renderer → main (invoke): crear/actualizar agente en `.gravity/agents/` */
  PROJECT_AGENTS_UPSERT: 'projectAgents:upsert',
  /** Renderer → main (invoke): renombrar slug del JSON en `.gravity/agents/` */
  PROJECT_AGENTS_RENAME: 'projectAgents:rename',
  /** Renderer → main (invoke): borrar agente del catálogo del proyecto */
  PROJECT_AGENTS_DELETE: 'projectAgents:delete',
  /** Renderer → main: guardar historial de chat IA de un pane */
  AI_CHAT_SAVE: 'aiChat:save',
  /** Renderer → main (invoke): cargar historial de chat IA de un pane */
  AI_CHAT_LOAD: 'aiChat:load',
  /** Renderer → main: eliminar historial de chat IA de un pane */
  AI_CHAT_DELETE: 'aiChat:delete',
  /** Renderer → main: guardar historial de comandos (no cd) de un pane */
  CMD_HISTORY_SAVE: 'cmdHistory:save',
  /** Renderer → main (invoke): cargar historial de comandos de un pane */
  CMD_HISTORY_LOAD: 'cmdHistory:load',
  /** Renderer → main: eliminar historial de comandos de un pane */
  CMD_HISTORY_DELETE: 'cmdHistory:delete',
  /** Renderer → main: guardar scrollback serializado de un pane */
  SCROLLBACK_SAVE: 'scrollback:save',
  /** Renderer → main (invoke): cargar scrollback serializado de un pane */
  SCROLLBACK_LOAD: 'scrollback:load',
  /** Renderer → main: eliminar scrollback de un pane */
  SCROLLBACK_DELETE: 'scrollback:delete',
  /** Renderer → main (invoke): cargar log de interacciones de un pane */
  INTERACTIONS_LOG_LOAD: 'interactionsLog:load',
  /** Renderer → main: guardar log de interacciones de un pane */
  INTERACTIONS_LOG_SAVE: 'interactionsLog:save',
  /** Renderer → main: eliminar log de interacciones de un pane */
  INTERACTIONS_LOG_DELETE: 'interactionsLog:delete',
  /** Main → renderer: estado del auto-updater (UpdateState) */
  UPDATE_STATE: 'update:state',
  /** Renderer → main (invoke): estado actual del auto-updater */
  UPDATE_STATE_GET: 'update:stateGet',
  /** Renderer → main: descargar (si hace falta) e instalar saliendo de la app */
  UPDATE_INSTALL: 'update:install',
  /** Renderer → main: ocultar el banner hasta el próximo chequeo */
  UPDATE_DISMISS: 'update:dismiss',
  /** Renderer → main (invoke): chequeo manual; devuelve el estado resultante */
  UPDATE_CHECK: 'update:check',
  /** Renderer → main (invoke): versión de la app (`app.getVersion()`) */
  APP_VERSION: 'app:version',
  /** Main → renderer: pedir que el renderer serialice los scrollbacks antes de cerrar */
  APP_SAVE_BEFORE_CLOSE: 'app:saveBeforeClose',
  /** Renderer → main: datos de cierre (scrollbacks) listos para guardar */
  APP_CLOSE_READY: 'app:closeReady',
  /** Main → renderer: pedir confirmación de salida (modal de la app, no `dialog` nativo) */
  APP_CONFIRM_QUIT: 'app:confirmQuit',
  /** Renderer → main: el usuario confirmó salir */
  APP_QUIT_CONFIRMED: 'app:quitConfirmed',
  /** Renderer → main (invoke): agregado de la bitácora local de Pulse */
  PULSE_SNAPSHOT: 'pulse:snapshot',

  // ─── Motor LSP (code intelligence) ─────────────────────────────────────────
  /** Renderer → main (invoke): estado de instalación + runtime de un lenguaje */
  LSP_SERVER_STATUS: 'lsp:serverStatus',
  /** Renderer → main (invoke): descargar/instalar el server de un lenguaje */
  LSP_DOWNLOAD_SERVER: 'lsp:downloadServer',
  /** Renderer → main (invoke): inventario de servers del manifiesto + tamaño en disco */
  LSP_LIST_INSTALLED: 'lsp:listInstalled',
  /** Renderer → main (invoke): borrar el server instalado de un lenguaje */
  LSP_DELETE_SERVER: 'lsp:deleteServer',
  /** Renderer → main (invoke): re-detectar runtimes (node/dotnet/java) */
  LSP_RECHECK_RUNTIMES: 'lsp:recheckRuntimes',
  /** Renderer → main (invoke): arrancar/reutilizar un server para un archivo */
  LSP_START: 'lsp:start',
  /** Renderer → main: mensaje JSON-RPC hacia el server */
  LSP_SEND: 'lsp:send',
  /** Renderer → main: parar un server */
  LSP_STOP: 'lsp:stop',
  /** Renderer → main (invoke): leer un archivo dentro de la raíz del workspace */
  LSP_READ_FILE: 'lsp:readFile',
  /** Renderer → main (invoke): escribir un archivo dentro de la raíz del workspace */
  LSP_WRITE_FILE: 'lsp:writeFile',
  /** Main → renderer: mensaje JSON-RPC del server (multiplexado por serverId) */
  LSP_MESSAGE: 'lsp:message',
  /** Main → renderer: el server murió (multiplexado por serverId) */
  LSP_EXIT: 'lsp:exit',
  /** Main → renderer: progreso de descarga/instalación (multiplexado por lenguaje) */
  LSP_DOWNLOAD_PROGRESS: 'lsp:downloadProgress',

  /** Renderer → main (invoke): ¿dictado nativo disponible? */
  DICTATION_AVAILABLE: 'dictation:available',
  /** Renderer → main (invoke): revisar/pedir permiso de micrófono */
  DICTATION_REQUEST_PERMISSION: 'dictation:requestPermission',
  /** Renderer → main (invoke): iniciar captura push-to-talk */
  DICTATION_START: 'dictation:start',
  /** Renderer → main (invoke): detener y obtener transcript final */
  DICTATION_STOP: 'dictation:stop',
  /** Main → renderer: texto parcial mientras escucha */
  DICTATION_PARTIAL: 'dictation:partial',
  /** Main → renderer: pico de nivel de mic (throttled) para waveform */
  DICTATION_LEVEL: 'dictation:level',
  /** Main → renderer: transcript final (además del return de stop) */
  DICTATION_RESULT: 'dictation:result',
  /** Main → renderer: error de dictado */
  DICTATION_ERROR: 'dictation:error',
} as const
