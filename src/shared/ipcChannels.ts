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
  AGENT_CHAT_LOAD: 'agentChat:load',
  AGENT_CHAT_SAVE: 'agentChat:save',
  AGENT_CHAT_DELETE: 'agentChat:delete',
  /** Renderer → main: reinicia entrega de contextos (turnos/catálogo) de una sesión CLI. */
  AGENT_CONTEXT_DELIVERY_CLEAR: 'agentContextDelivery:clear',
  TAB_CONTEXT_PREVIEW: 'tabContext:preview',
  TAB_CONTEXT_MATERIALIZE: 'tabContext:materialize',
  TAB_CONTEXT_MERGE_ANNOTATIONS: 'tabContext:mergeAnnotations',
  TAB_CONTEXT_DISCOVER: 'tabContext:discover',
  TAB_CONTEXT_DELETE: 'tabContext:delete',
  /** Renderer → main: crea .iaterminal/results/<slug>.md si no existe. */
  AGENT_RESULTS_ENSURE: 'agentResults:ensure',
  /** Main → renderer: usuario pulsó ⌘W / Ctrl+W (cerrar pestaña o ventana según estado) */
  SHORTCUT_CLOSE_TAB: 'shortcut:close-tab',
  // Config
  CONFIG_GET: 'config:get',
  CONFIG_SET: 'config:set',
  CONFIG_OPEN_FOLDER: 'config:openFolder',
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

  /** Renderer → main (invoke): estado git del cwd de la sesión */
  GIT_STATUS: 'git:status',
  /** Renderer → main (invoke): texto truncado para sugerir mensaje de commit (IA) */
  GIT_DIFF_FOR_AI: 'git:diffForAi',
  GIT_PULL: 'git:pull',
  GIT_PUSH: 'git:push',
  GIT_COMMIT: 'git:commit',
  GIT_STAGE_ALL: 'git:stageAll',
  GIT_STAGE_FILE: 'git:stageFile',
  GIT_UNSTAGE_ALL: 'git:unstageAll',
  GIT_UNSTAGE_FILE: 'git:unstageFile',

  /** Renderer → main (invoke): workflow runs de GitHub Actions vía gh CLI */
  GITHUB_ACTIONS_LIST: 'githubActions:list',

  /** Renderer → main (invoke): listar hijos de un directorio relativo al cwd de la sesión */
  FILE_EXPLORER_LIST_DIR: 'fileExplorer:listDir',
  /** Renderer → main (invoke): leer archivo para el explorador */
  FILE_EXPLORER_LOAD_FILE: 'fileExplorer:loadFile',
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
  /** Renderer → main (invoke): crear/actualizar agente en `.iaterminal/agents/` */
  PROJECT_AGENTS_UPSERT: 'projectAgents:upsert',
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
  /** Main → renderer: pedir que el renderer serialice los scrollbacks antes de cerrar */
  APP_SAVE_BEFORE_CLOSE: 'app:saveBeforeClose',
  /** Renderer → main: datos de cierre (scrollbacks) listos para guardar */
  APP_CLOSE_READY: 'app:closeReady',
} as const
