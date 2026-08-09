import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { SerializeAddon } from '@xterm/addon-serialize'
import { getTheme } from '@themes/presets'
import type { AppConfig } from '@shared/configSchema'
import { feedCompletedUserLines } from '@renderer/history/feedCompletedUserLines'
import { isClearCommandLine } from '@renderer/terminal/isClearCommand'
import { ConfirmTerminalModal } from '@renderer/components/ConfirmTerminalModal'
import { TerminalFindModal } from '@renderer/components/TerminalFindModal'
import {
  findMatchesInCommandHistory,
  findMatchesInTerminalBuffer,
  type TerminalBufferFindMatch,
} from '@renderer/terminal/terminalFindInBuffer'
import { PaneToolbar } from './PaneToolbar'
import {
  createTerminalRepaintScheduler,
  repaintTerminalCanvas,
} from './terminalCanvasRepaint'
import { trimRestoredScrollback } from './terminalScrollbackRestore'
import { TerminalSuggestStack } from './TerminalSuggestStack'
import { TerminalScrollDown } from './TerminalScrollDown'
import { normalizeSessionCwd, sessionCwdPaneLabel } from './explorer/explorerPathUtils'
import '@xterm/xterm/css/xterm.css'
import './TerminalPane.css'

function shellSingleQuotePosix(path: string): string {
  return `'${path.replace(/'/g, `'\\''`)}'`
}

function isCdStart(draft: string): boolean {
  return /^cd(\s|$)/i.test(draft.trimStart())
}

function filterPaths(paths: string[], draft: string): string[] {
  const arg = draft.trimStart().replace(/^cd\s*/i, '')
  if (!arg) return paths
  const lower = arg.toLowerCase()
  return paths.filter(p => p.toLowerCase().includes(lower))
}

// ── Sugerencias de comandos ────────────────────────────────────────────────

interface CmdSnippet { label: string; cmd: string }

const CMD_SNIPPETS: Record<string, CmdSnippet[]> = {
  git: [
    { label: 'git status',              cmd: 'git status' },
    { label: 'git add .',               cmd: 'git add .' },
    { label: 'git commit -m ""',        cmd: 'git commit -m ""' },
    { label: 'git push',                cmd: 'git push' },
    { label: 'git pull',                cmd: 'git pull' },
    { label: 'git log --oneline',       cmd: 'git log --oneline' },
    { label: 'git diff',                cmd: 'git diff' },
    { label: 'git checkout -b',         cmd: 'git checkout -b ' },
    { label: 'git stash',               cmd: 'git stash' },
    { label: 'git merge',               cmd: 'git merge ' },
  ],
  npm: [
    { label: 'npm install',             cmd: 'npm install' },
    { label: 'npm run dev',             cmd: 'npm run dev' },
    { label: 'npm run build',           cmd: 'npm run build' },
    { label: 'npm run test',            cmd: 'npm run test' },
    { label: 'npm install -D',          cmd: 'npm install --save-dev ' },
    { label: 'npm uninstall',           cmd: 'npm uninstall ' },
    { label: 'npm list',                cmd: 'npm list' },
    { label: 'npm outdated',            cmd: 'npm outdated' },
    { label: 'npm update',              cmd: 'npm update' },
    { label: 'npm init -y',             cmd: 'npm init -y' },
  ],
  pnpm: [
    { label: 'pnpm install',            cmd: 'pnpm install' },
    { label: 'pnpm run dev',            cmd: 'pnpm run dev' },
    { label: 'pnpm run build',          cmd: 'pnpm run build' },
    { label: 'pnpm run test',           cmd: 'pnpm run test' },
    { label: 'pnpm add -D',             cmd: 'pnpm add -D ' },
    { label: 'pnpm remove',             cmd: 'pnpm remove ' },
    { label: 'pnpm list',               cmd: 'pnpm list' },
    { label: 'pnpm outdated',           cmd: 'pnpm outdated' },
    { label: 'pnpm update',             cmd: 'pnpm update' },
    { label: 'pnpm init',               cmd: 'pnpm init' },
  ],
  docker: [
    { label: 'docker ps',               cmd: 'docker ps' },
    { label: 'docker ps -a',            cmd: 'docker ps -a' },
    { label: 'docker build -t',         cmd: 'docker build -t ' },
    { label: 'docker run -it',          cmd: 'docker run -it ' },
    { label: 'docker stop',             cmd: 'docker stop ' },
    { label: 'docker rm',               cmd: 'docker rm ' },
    { label: 'docker images',           cmd: 'docker images' },
    { label: 'docker pull',             cmd: 'docker pull ' },
    { label: 'docker logs -f',          cmd: 'docker logs -f ' },
    { label: 'docker exec -it',         cmd: 'docker exec -it ' },
  ],
  ssh: [
    { label: 'ssh user@host',           cmd: 'ssh user@' },
    { label: 'ssh -p 22',               cmd: 'ssh -p 22 user@' },
    { label: 'ssh -i key.pem',          cmd: 'ssh -i ~/.ssh/id_rsa user@' },
    { label: 'ssh-keygen -t ed25519',   cmd: 'ssh-keygen -t ed25519' },
    { label: 'ssh-copy-id',             cmd: 'ssh-copy-id user@' },
  ],
  grep: [
    { label: 'grep -r "" .',            cmd: 'grep -r "" .' },
    { label: 'grep -ri "" .',           cmd: 'grep -ri "" .' },
    { label: 'grep -n "" file',         cmd: 'grep -n ""  ' },
    { label: 'grep -l "" .',            cmd: 'grep -l "" .' },
    { label: 'grep -v ""',              cmd: 'grep -v "" ' },
  ],
  find: [
    { label: 'find . -name',            cmd: 'find . -name "" ' },
    { label: 'find . -type f',          cmd: 'find . -type f' },
    { label: 'find . -type d',          cmd: 'find . -type d' },
    { label: 'find . -mtime -1',        cmd: 'find . -mtime -1' },
    { label: 'find . -name "*.ts"',     cmd: 'find . -name "*.ts"' },
  ],
  curl: [
    { label: 'curl -X GET',             cmd: 'curl -X GET ' },
    { label: 'curl -X POST -d',         cmd: 'curl -X POST -H "Content-Type: application/json" -d \'{}\' ' },
    { label: 'curl -o file',            cmd: 'curl -o output ' },
    { label: 'curl -L -O',              cmd: 'curl -L -O ' },
    { label: 'curl -s | jq',            cmd: 'curl -s  | jq .' },
  ],
  tar: [
    { label: 'tar -czf file.tar.gz',    cmd: 'tar -czf output.tar.gz ' },
    { label: 'tar -xzf file.tar.gz',    cmd: 'tar -xzf ' },
    { label: 'tar -tzf file.tar.gz',    cmd: 'tar -tzf ' },
    { label: 'tar -xjf file.tar.bz2',   cmd: 'tar -xjf ' },
    { label: 'tar -czf - | ssh',        cmd: 'tar -czf - . | ssh user@host "cat > backup.tar.gz"' },
  ],
  python: [
    { label: 'python -m venv venv',     cmd: 'python -m venv venv' },
    { label: 'python -m pip install',   cmd: 'python -m pip install ' },
    { label: 'python -c ""',            cmd: 'python -c ""' },
    { label: 'python -m http.server',   cmd: 'python -m http.server 8080' },
    { label: 'python -m pytest',        cmd: 'python -m pytest' },
  ],
  node: [
    { label: 'node -e ""',              cmd: 'node -e ""' },
    { label: 'node --inspect',          cmd: 'node --inspect ' },
    { label: 'node -r dotenv/config',   cmd: 'node -r dotenv/config ' },
    { label: 'node --version',          cmd: 'node --version' },
    { label: 'node -p ""',              cmd: 'node -p ""' },
  ],
  lsof: [
    { label: 'lsof -i :port',           cmd: 'lsof -i :' },
    { label: 'lsof -ti :port',          cmd: 'lsof -ti :' },
    { label: 'lsof -nP -i :port',       cmd: 'lsof -nP -i :' },
    { label: 'lsof -i tcp',             cmd: 'lsof -i tcp' },
    { label: 'lsof -i udp',             cmd: 'lsof -i udp' },
  ],
  kill: [
    { label: 'kill PID',                cmd: 'kill ' },
    { label: 'kill -9 PID',             cmd: 'kill -9 ' },
    { label: 'kill -15 PID',            cmd: 'kill -15 ' },
    { label: 'kill $(lsof -ti :port)', cmd: 'kill $(lsof -ti :)' },
    { label: 'killall',                 cmd: 'killall ' },
  ],
}

const CMD_SNIPPET_KEYS = Object.keys(CMD_SNIPPETS)
/** Mínimo de caracteres en el borrador antes de filtrar recientes y snippets estáticos. */
const CMD_SUGGEST_MIN_DRAFT_LEN = 3

function getMatchedCmd(trimmedDraft: string): string | null {
  for (const cmd of CMD_SNIPPET_KEYS) {
    if (new RegExp(`^${cmd}(\\s|$)`, 'i').test(trimmedDraft)) return cmd
  }
  return null
}

function filterCmdSnippetsByDraft(all: CmdSnippet[], trimmedDraft: string): CmdSnippet[] {
  const d = trimmedDraft.trimStart().toLowerCase()
  if (d.length < CMD_SUGGEST_MIN_DRAFT_LEN) return []
  return all.filter(
    s =>
      s.cmd.toLowerCase().startsWith(d) ||
      s.label.toLowerCase().startsWith(d),
  )
}

const MAX_RECENT_COMMANDS = 120
const MAX_VISIBLE_RECENT_MATCHES = 5

/** MRU sin duplicados exactos (tras trim); el más reciente queda primero. */
function pushRecentUnique(prev: string[], line: string, max: number): string[] {
  const t = line.trim()
  if (!t) return prev
  return [t, ...prev.filter(x => x !== t)].slice(0, max)
}

/**
 * Historial de líneas ejecutadas (MRU), filtrado solo por si el borrador aparece en la línea.
 * Independiente de CMD_SNIPPETS. No lista `cd` (va al panel de carpetas).
 */
function filterExecutedRecentsByDraft(recent: string[], draft: string, limit: number): string[] {
  const d = draft.trimStart()
  if (!d || d.length < CMD_SUGGEST_MIN_DRAFT_LEN || isCdStart(d)) return []
  const dl = d.toLowerCase()
  const out: string[] = []
  for (const c of recent) {
    const t = c.trim()
    if (!t || isCdStart(t)) continue
    if (!t.toLowerCase().includes(dl)) continue
    out.push(c)
    if (out.length >= limit) break
  }
  return out
}

/** ¿Hay algo que mostrar en el panel de sugerencias de comandos? */
function shouldShowCmdSuggestPanel(
  draft: string,
  recent: string[],
  matched: string | null,
): boolean {
  const t = draft.trimStart()
  if (t.length < CMD_SUGGEST_MIN_DRAFT_LEN || isCdStart(t)) return false
  if (matched) {
    const snippets = filterCmdSnippetsByDraft(CMD_SNIPPETS[matched] ?? [], t)
    if (snippets.length > 0) return true
  }
  return filterExecutedRecentsByDraft(recent, t, 1).length > 0
}





function isTerminalScrolledUp(term: Terminal): boolean {
  try {
    const buf = term.buffer.active
    return buf.type === 'normal' && buf.viewportY < buf.baseY
  } catch {
    return false
  }
}

function syncTerminalScrolledUpState(
  term: Terminal | null | undefined,
  setIsScrolledUp: React.Dispatch<React.SetStateAction<boolean>>,
): void {
  setIsScrolledUp(term ? isTerminalScrolledUp(term) : false)
}

function fitTerminal(term: Terminal, fit: FitAddon): void {
  try {
    const before = term.buffer.active
    const wasAtBottom = !isTerminalScrolledUp(term)
    // Si el usuario está leyendo historial, preservamos una posición aproximada
    // manteniendo la distancia al final del scrollback. Con resize/reflow no hay
    // identidad estable de línea, pero esto evita saltos bruscos hacia arriba/abajo.
    const distanceFromBottom = Math.max(0, before.baseY - before.viewportY)

    fit.fit()

    if (wasAtBottom) {
      // Si seguía el stream, un resize/fit (dock IA, tabs, font-size, split pane)
      // no debe dejar el viewport “un poco arriba”, porque desde ahí xterm deja
      // de auto-seguir las escrituras siguientes.
      term.scrollToBottom()
    } else {
      const after = term.buffer.active
      term.scrollToLine(Math.max(0, after.baseY - distanceFromBottom))
    }
    repaintTerminalCanvas(term)
  } catch {
    /* dimensions / dispose */
  }
}

interface BasicTerminalFitScheduler {
  schedule: () => void
  cancel: () => void
  runNow: () => void
}

const FIT_BURST_COALESCE_MS = 100

/** Techo del reintento durante el morph (~0.6 s a 60 fps) por si la clase se queda pegada. */
const MAX_ZOOM_WAIT_FRAMES = 40

function createBasicTerminalFitScheduler(
  getTerm: () => Terminal | null,
  getFit: () => FitAddon | null,
  getContainer: () => HTMLElement | null,
  onDimensionsChange: (cols: number, rows: number) => void,
  onAfterFit?: () => void,
): BasicTerminalFitScheduler {
  let raf = 0
  let burstTimer: ReturnType<typeof setTimeout> | null = null
  let lastFitAt = 0
  let lastCols = -1
  let lastRows = -1
  let lastContainerW = -1
  let lastContainerH = -1
  let zoomWaitFrames = 0

  const runFit = (): void => {
    raf = 0
    lastFitAt = Date.now()
    const term = getTerm()
    const fit = getFit()
    if (!term || !fit) return
    const host = getContainer()
    // Morph mini↔full: no refittear durante la animación (el scale lo hace PaneWindow;
    // un fit corta el texto). Reintenta al frame siguiente: descartarlo dejaba el fit
    // de App.tsx (rAF al abrir) perdido y xterm con cols viejos → reflow con líneas en
    // blanco entre prompts al expandir.
    // ponytail: reintento por frame (~18 frames de morph), sin listener de transitionend.
    if (host?.closest('.pane-window--zooming') && zoomWaitFrames < MAX_ZOOM_WAIT_FRAMES) {
      zoomWaitFrames++
      raf = requestAnimationFrame(runFit)
      return
    }
    const waited = zoomWaitFrames
    zoomWaitFrames = 0
    if (host) {
      const w = host.clientWidth
      const h = host.clientHeight
      if (
        w === lastContainerW &&
        h === lastContainerH &&
        term.cols === lastCols &&
        term.rows === lastRows
      ) {
        if (import.meta.env.DEV) {
          console.log('[fit] skip (sin cambio)', `${w}x${h}`, `${term.cols}x${term.rows}`, `waited ${waited}f`)
        }
        return
      }
      lastContainerW = w
      lastContainerH = h
    }
    try {
      const colsBefore = term.cols
      const rowsBefore = term.rows
      fitTerminal(term, fit)
      if (import.meta.env.DEV) {
        console.log('[fit]', `${colsBefore}x${rowsBefore} → ${term.cols}x${term.rows}`, `waited ${waited}f`)
      }
      onAfterFit?.()
      const cols = Math.max(1, term.cols)
      const rows = Math.max(1, term.rows)
      if (
        cols === lastCols &&
        rows === lastRows &&
        cols === colsBefore &&
        rows === rowsBefore
      ) {
        return
      }
      lastCols = cols
      lastRows = rows
      onDimensionsChange(cols, rows)
    } catch {
      /* dimensions / dispose */
    }
  }

  const cancelPending = (): void => {
    if (burstTimer != null) {
      clearTimeout(burstTimer)
      burstTimer = null
    }
    if (raf !== 0) {
      cancelAnimationFrame(raf)
      raf = 0
    }
  }

  return {
    schedule: () => {
      if (raf !== 0 || burstTimer != null) return
      const elapsed = Date.now() - lastFitAt
      if (elapsed >= FIT_BURST_COALESCE_MS) {
        raf = requestAnimationFrame(runFit)
        return
      }
      burstTimer = setTimeout(() => {
        burstTimer = null
        raf = requestAnimationFrame(runFit)
      }, FIT_BURST_COALESCE_MS - elapsed)
    },
    cancel: cancelPending,
    runNow: () => {
      cancelPending()
      runFit()
    },
  }
}

interface PlainPtyWriteBatcher {
  write: (data: string, afterParsed?: () => void) => void
  dispose: () => void
}

function createPlainPtyWriteBatcher(
  getTerm: () => Terminal | null,
  getUserScrollEpoch: () => number = () => 0,
): PlainPtyWriteBatcher {
  let pending = ''
  const afterParsedCbs: Array<() => void> = []
  let raf = 0
  let followOutput = true
  let lastUserScrollEpoch = getUserScrollEpoch()

  const flush = (): void => {
    raf = 0
    const term = getTerm()
    const chunk = pending
    pending = ''
    const cbs = afterParsedCbs.splice(0)
    if (!term || !chunk) {
      for (const cb of cbs) {
        try { cb() } catch { /* ignore */ }
      }
      return
    }
    const followEpoch = getUserScrollEpoch()
    // Importante: durante streams grandes (npm run build, vite/tsc) xterm puede
    // quedar temporalmente con viewportY < baseY mientras escrituras anteriores
    // siguen encoladas. Si recalculamos “está scrolleado” desde ese estado
    // transitorio, perdemos el autoseguimiento para todos los batches siguientes.
    // Por eso solo consideramos que el usuario abandonó el final cuando cambia
    // explícitamente el epoch de scroll manual.
    const shouldFollowOutput = followEpoch === lastUserScrollEpoch
      ? followOutput || !isTerminalScrolledUp(term)
      : !isTerminalScrolledUp(term)
    lastUserScrollEpoch = followEpoch
    followOutput = shouldFollowOutput
    try {
      if (shouldFollowOutput) {
        // Restaurar el fondo antes de parsear el chunk re-activa el autoscroll
        // interno de xterm para el propio write, no solo al final del callback.
        try { term.scrollToBottom() } catch { /* dispose / dimensions */ }
      }
      term.write(chunk, () => {
        if (shouldFollowOutput && getUserScrollEpoch() === followEpoch) {
          try { term.scrollToBottom() } catch { /* dispose / dimensions */ }
          requestAnimationFrame(() => {
            if (getTerm() !== term || getUserScrollEpoch() !== followEpoch) return
            try { term.scrollToBottom() } catch { /* dispose / dimensions */ }
          })
        } else if (!isTerminalScrolledUp(term)) {
          followOutput = true
        }
        for (const cb of cbs) {
          try { cb() } catch { /* ignore */ }
        }
      })
    } catch {
      for (const cb of cbs) {
        try { cb() } catch { /* ignore */ }
      }
    }
  }

  return {
    write(data, afterParsed) {
      if (!data) return
      pending += data
      if (afterParsed) afterParsedCbs.push(afterParsed)
      if (raf !== 0) return
      raf = requestAnimationFrame(flush)
    },
    dispose() {
      if (raf !== 0) {
        cancelAnimationFrame(raf)
        raf = 0
      }
      pending = ''
      afterParsedCbs.length = 0
    },
  }
}

export interface TerminalRef {
  getSelection: () => string
  writeToTty: (data: string) => void
  /** Viewport al final del scrollback (⌘Fin). */
  scrollToBottom: () => void
  /** Serializa el buffer completo (VT sequences) para persistencia */
  serialize: () => string
  /** Reajusta dimensiones del terminal y notifica al PTY. */
  refit: () => void
  /** Enfoca el xterm (p. ej. al expandir en el plano). */
  focus: () => void
  /** Solicita abrir el panel Git del plano (⌘G / toolbar). */
  openGitPanel: () => void
  /** Últimas líneas visibles (preview del mapa). */
  getPreviewLines: (maxLines?: number) => string[]
}

export interface PaneToolbar {
  onClosePane?: () => void
  /** Si false, no muestra la X del toolbar (p. ej. ya hay traffic lights macOS). */
  showClosePane?: boolean
  /** Reordenar columnas dentro de la pestaña (solo si hay varios paneIds). */
  paneReorder?: {
    enabled: boolean
    isGrabbed: boolean
    onDragHandleStart: (e: React.DragEvent) => void
    onDragHandleEnd: () => void
  }
}

interface Props {
  sessionId: string
  /** La pestaña está seleccionada en la barra */
  tabActive: boolean
  /** Este panel tiene el foco dentro de la pestaña (clic o último split) */
  isActivePane: boolean
  /** cwd inicial al crear el PTY (restaurado o panel dividido). */
  initialPtyCwd?: string
  /** Tras arrancar el PTY con un cwd conocido (persistencia en App). */
  onPtyCwdInitialized?: (sessionId: string, cwd: string) => void
  /** Tras un `cd` exitoso: persistir cwd de este panel en session.json. */
  onPaneCwdChanged?: (sessionId: string, cwd: string) => void
  /** Estado visual del explorador de la tab (toolbar). */
  explorerOpen?: boolean
  /** false = tab sin projectFolder; se oculta el botón del explorador. */
  explorerEnabled?: boolean
  /** Abre/cierra el explorador a nivel tab. */
  onToggleExplorer?: () => void
  /** Revela un archivo relativo en el explorador de la tab (Quick Open). */
  onExplorerRevealFile?: (relPath: string) => void
  paneToolbar?: PaneToolbar
  /**
   * Toolbar interno (git/explorer/folder). En mini del plano se oculta:
   * el chrome visible es el titlebar macOS de PaneWindow.
   */
  showPaneToolbar?: boolean
  /** Al interactuar con este panel, selecciona pestaña y enfoca este split */
  onRequestPaneFocus?: () => void
  config: AppConfig
  onTitleChange: (title: string) => void
  onRegisterRef: (ref: TerminalRef | null) => void
  /** Notifica si este panel tiene un proceso activo (true) o ha vuelto al prompt (false). */
  onBusyChange?: (busy: boolean) => void
  /**
   * Registra la misma confirmación que la cruz del panel para cierres por atajo (⌘W desde `App`).
   */
  registerShortcutCloseInterceptor?: (openConfirm: () => void) => () => void
  /** ⌘G / toolbar: pide al plano abrir el panel Git (no monta modal aquí). */
  onRequestGitPanel?: () => void
}

export const TerminalPane: React.FC<Props> = ({
  sessionId,
  tabActive,
  isActivePane,
  initialPtyCwd,
  onPtyCwdInitialized,
  onPaneCwdChanged,
  explorerOpen = false,
  explorerEnabled = true,
  onToggleExplorer,
  onExplorerRevealFile,
  paneToolbar,
  showPaneToolbar = true,
  onRequestPaneFocus,
  config,
  onTitleChange,
  onRegisterRef,
  onBusyChange,
  registerShortcutCloseInterceptor,
  onRequestGitPanel,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const serializeAddonRef = useRef<SerializeAddon | null>(null)
  const userLineDraftRef = useRef('')
  const absorbUserInputRef = useRef<(raw: string) => void>(() => {})
  const ptyInjectRef = useRef<(raw: string) => void>(() => {})
  const scrollbackSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const busySilenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ptyBusyRef = useRef(false)
  const paneBusyRef = useRef(false)
  const onBusyChangeRef = useRef(onBusyChange)
  onBusyChangeRef.current = onBusyChange

  const syncPaneBusyState = useCallback((): void => {
    const next = ptyBusyRef.current
    if (paneBusyRef.current === next) return
    paneBusyRef.current = next
    onBusyChangeRef.current?.(next)
  }, [])
  const onPtyCwdInitializedRef = useRef(onPtyCwdInitialized)
  onPtyCwdInitializedRef.current = onPtyCwdInitialized
  const onPaneCwdChangedRef = useRef(onPaneCwdChanged)
  onPaneCwdChangedRef.current = onPaneCwdChanged
  const onToggleExplorerRef = useRef(onToggleExplorer)
  onToggleExplorerRef.current = onToggleExplorer
  const onExplorerRevealFileRef = useRef(onExplorerRevealFile)
  onExplorerRevealFileRef.current = onExplorerRevealFile
  const scrollTerminalToBottomRef = useRef<() => void>(() => {})
  const refitTerminalRef = useRef<() => void>(() => {})
  /** Fit coalescido (sugerencias): evita runNow en ráfaga. */
  const scheduleRefitTerminalRef = useRef<() => void>(() => {})
  const configRef = useRef(config)
  configRef.current = config

  const [isScrolledUp, setIsScrolledUp] = useState(false)

  const [cdVisible, setCdVisible] = useState(false)
  const [cdDraft, setCdDraft] = useState('')
  const [cdPaths, setCdPaths] = useState<string[]>([])
  const [cdLocalDirs, setCdLocalDirs] = useState<string[]>([])
  const cdVisibleRef = useRef(false)

  const [cmdSuggestCmd, setCmdSuggestCmd] = useState<string | null>(null)
  const [cmdSuggestDraft, setCmdSuggestDraft] = useState('')
  const cmdSuggestPanelOpenRef = useRef(false)
  const [recentCommands, setRecentCommands] = useState<string[]>([])
  const [cmdHistoryLoaded, setCmdHistoryLoaded] = useState(false)
  const cmdHistoryLoadedRef = useRef(false)
  const recentCommandsRef = useRef<string[]>([])
  recentCommandsRef.current = recentCommands
  const cmdHistorySaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [confirmClosePaneOpen, setConfirmClosePaneOpen] = useState(false)
  const registerShortcutInterceptorRef = useRef(registerShortcutCloseInterceptor)
  registerShortcutInterceptorRef.current = registerShortcutCloseInterceptor

  const hasClosePaneAction = Boolean(paneToolbar?.onClosePane)
  useEffect(() => {
    if (!hasClosePaneAction) return
    const reg = registerShortcutInterceptorRef.current
    if (!reg) return
    return reg(() => {
      setConfirmClosePaneOpen(true)
    })
  }, [hasClosePaneAction])

  const [paneCwd, setPaneCwd] = useState(() => initialPtyCwd?.trim() ?? '')
  const paneCwdRef = useRef(paneCwd)
  paneCwdRef.current = paneCwd
  const [findModalOpen, setFindModalOpen] = useState(false)
  const [findModalBuffer, setFindModalBuffer] = useState<TerminalBufferFindMatch[]>([])
  const [findModalHistory, setFindModalHistory] = useState<string[]>([])
  const [quickOpenOpen, setQuickOpenOpen] = useState(false)

  const isActivePaneRef = useRef(isActivePane)
  isActivePaneRef.current = isActivePane

  const tabActiveRef = useRef(tabActive)
  tabActiveRef.current = tabActive

  const paneRootRef = useRef<HTMLDivElement>(null)
  const onRequestPaneFocusRef = useRef(onRequestPaneFocus)
  onRequestPaneFocusRef.current = onRequestPaneFocus
  const onRequestGitPanelRef = useRef(onRequestGitPanel)
  onRequestGitPanelRef.current = onRequestGitPanel

  /**
   * Los botones chrome (cerrar, scroll) no deben robar el foco del PTY: preventDefault
   * en mousedown evita que el botón reciba foco antes del click.
   */
  const onTerminalChromePointerDown = useCallback((e: React.MouseEvent): void => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const openThisPaneFolderInFinder = useCallback(async (): Promise<void> => {
    try {
      const cwd = await window.api.getSessionCwd(sessionId)
      if (cwd) window.api.openFolder(cwd)
    } catch { /* ignore */ }
  }, [sessionId])

  useEffect(() => {
    let cancelled = false
    const syncPaneCwd = async (): Promise<void> => {
      const cwd = normalizeSessionCwd(await window.api.getSessionCwd(sessionId))
      if (!cwd || cancelled) return
      if (paneCwdRef.current === cwd) return
      paneCwdRef.current = cwd
      setPaneCwd(cwd)
      // Mirror en App para el badge del mini (sin persistir; el cd ya persiste).
      onPtyCwdInitializedRef.current?.(sessionId, cwd)
    }
    void syncPaneCwd()
    const id = window.setInterval(() => { void syncPaneCwd() }, 1500)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [sessionId])


  const loadCdPaths = useCallback(async (): Promise<void> => {
    try {
      const list = await window.api.getCdRecentList()
      setCdPaths(list)
    } catch { /* ignore */ }
  }, [])

  const loadCdLocalDirs = useCallback(async (): Promise<void> => {
    try {
      const dirs = await window.api.listCwdDirs(sessionId)
      setCdLocalDirs(dirs)
    } catch { /* ignore */ }
  }, [sessionId])

  useEffect(() => { void loadCdPaths() }, [loadCdPaths])

  // Historial de comandos (mismo paneId que chat IA / scrollback): carga y guardado con debounce
  useEffect(() => {
    cmdHistoryLoadedRef.current = false
    setRecentCommands([])
    setCmdHistoryLoaded(false)
    let cancelled = false
    void window.api.loadCmdHistory(sessionId).then(lines => {
      if (cancelled) return
      setRecentCommands(lines.slice(0, MAX_RECENT_COMMANDS))
      setCmdHistoryLoaded(true)
      cmdHistoryLoadedRef.current = true
    }).catch(() => {
      if (cancelled) return
      setRecentCommands([])
      setCmdHistoryLoaded(true)
      cmdHistoryLoadedRef.current = true
    })
    return () => {
      cancelled = true
      if (cmdHistorySaveTimerRef.current) {
        clearTimeout(cmdHistorySaveTimerRef.current)
        cmdHistorySaveTimerRef.current = null
      }
      if (cmdHistoryLoadedRef.current) {
        window.api.saveCmdHistory(sessionId, recentCommandsRef.current)
      }
      cmdHistoryLoadedRef.current = false
    }
  }, [sessionId])

  useEffect(() => {
    if (!cmdHistoryLoaded) return
    if (cmdHistorySaveTimerRef.current) clearTimeout(cmdHistorySaveTimerRef.current)
    cmdHistorySaveTimerRef.current = setTimeout(() => {
      cmdHistorySaveTimerRef.current = null
      window.api.saveCmdHistory(sessionId, recentCommands)
    }, 800)
    return () => {
      if (cmdHistorySaveTimerRef.current) {
        clearTimeout(cmdHistorySaveTimerRef.current)
        cmdHistorySaveTimerRef.current = null
      }
    }
  }, [recentCommands, cmdHistoryLoaded, sessionId])

  const scrollTerminalToBottom = useCallback((): void => {
    onRequestPaneFocusRef.current?.()
    const term = termRef.current
    if (term) {
      try {
        term.scrollToBottom()
      } catch {
        /* dispose / dimensions */
      }
      repaintTerminalCanvas(term)
      syncTerminalScrolledUpState(term, setIsScrolledUp)
    } else {
      setIsScrolledUp(false)
    }
    termRef.current?.focus()
  }, [])

  // Keep ref in sync so the effect below can expose it without re-running
  scrollTerminalToBottomRef.current = scrollTerminalToBottom

  useEffect(() => {
    if (!containerRef.current) return

    /** false tras cleanup: evita IPC / rAF / scroll sobre xterm disposed. */
    let termAlive = true

    userLineDraftRef.current = ''

    // Use configRef.current to get the LATEST config at mount time (avoids
    // creating the terminal with CONFIG_DEFAULTS before getConfig() resolves)
    const initialTheme = getTheme(configRef.current.themeId)
    const term = new Terminal({
      fontFamily: getComputedStyle(document.documentElement).getPropertyValue('--font-mono').trim() || 'monospace',
      fontSize: configRef.current.fontSize,
      lineHeight: 1.4,
      cursorBlink: true,
      cursorStyle: 'bar',
      theme: initialTheme.xterm,
      scrollback: 5000,
      allowProposedApi: true,
    })

    const fit = new FitAddon()
    const links = new WebLinksAddon((_ev, uri) => {
      void window.api.openExternalUrl(uri).then(r => {
        if (!r.ok) console.warn('[openExternalUrl]', r.error)
      })
    })
    const serialize = new SerializeAddon()
    term.loadAddon(fit)
    term.loadAddon(links)
    term.loadAddon(serialize)

    let openWaitObserver: ResizeObserver | null = null
    let openWaitRaf = 0
    let fontsReady = false
    let openKick: (() => void) | null = null
    const stopOpenWait = (): void => {
      if (openWaitObserver) {
        openWaitObserver.disconnect()
        openWaitObserver = null
      }
      if (openWaitRaf) {
        cancelAnimationFrame(openWaitRaf)
        openWaitRaf = 0
      }
      openKick = null
    }

    const fontsPromise = (
      document as Document & { fonts?: { ready?: Promise<unknown> } }
    ).fonts?.ready
    if (!fontsPromise) {
      fontsReady = true
    } else {
      void fontsPromise.then(() => {
        if (!termAlive) return
        fontsReady = true
        openKick?.()
      })
    }

    const openWhenReady = (onReady: (host: HTMLElement) => void): void => {
      const tryHost = (): HTMLElement | null => {
        if (!fontsReady) return null
        const el = containerRef.current
        if (!el || el.clientWidth <= 0 || el.clientHeight <= 0) return null
        // offsetParent === null ⇒ ancestro display:none (tab/pane inactivo).
        if (!el.isConnected || el.offsetParent === null) return null
        return el
      }
      const kick = (): void => {
        if (!termAlive) return
        const host = tryHost()
        if (!host) return
        stopOpenWait()
        onReady(host)
      }
      openKick = kick
      const ready = tryHost()
      if (ready) {
        stopOpenWait()
        onReady(ready)
        return
      }
      const el = containerRef.current
      if (!el) return
      if (typeof ResizeObserver !== 'undefined') {
        openWaitObserver = new ResizeObserver(() => kick())
        openWaitObserver.observe(el)
      }
      const tick = (): void => {
        if (!termAlive) return
        if (tryHost()) {
          kick()
          return
        }
        openWaitRaf = requestAnimationFrame(tick)
      }
      openWaitRaf = requestAnimationFrame(tick)
    }

    // Setup continues only after open succeeds (container may be 0×0 while mini/hidden).
    let booted = false
    let bootCleanup: (() => void) | null = null

    openWhenReady(host => {
      if (!termAlive || booted) return
      try {
        term.open(host)
      } catch (e) {
        console.warn('[terminal.open]', e)
        return
      }
      // Fuerza dimensions ya (el Viewport de xterm agenda syncScrollArea en setTimeout(0)).
      try {
        fitTerminal(term, fit)
      } catch {
        /* dimensions aún no listas */
      }
      if (!termAlive) {
        try { term.dispose() } catch { /* ignore */ }
        return
      }
      booted = true

    termRef.current = term
    fitRef.current = fit
    serializeAddonRef.current = serialize

    // ponytail: registro solo-dev + `__gravityTermInfo()` para diagnosticar el alto de fila.
    if (import.meta.env.DEV) {
      const w = window as unknown as {
        __gravityTerms?: Record<string, Terminal>
        __gravityTermInfo?: () => unknown[]
      }
      const reg = (w.__gravityTerms ??= {})
      reg[sessionId] = term
      w.__gravityTermInfo ??= () => Object.entries(w.__gravityTerms ?? {}).map(([id, t]) => {
        const core = (t as unknown as { _core?: { _renderService?: { dimensions?: { css?: { cell?: unknown } } } } })._core
        const el = t.element?.querySelector('.xterm-rows')
        const first = el?.firstElementChild as HTMLElement | null
        return {
          id,
          cols: t.cols,
          rows: t.rows,
          domRows: el?.childElementCount ?? -1,
          cell: core?._renderService?.dimensions?.css?.cell,
          rowHeight: first ? getComputedStyle(first).height : null,
          rowInline: first?.style.height || '(sin inline)',
          fontFamily: t.options.fontFamily,
          fontSize: t.options.fontSize,
          lineHeight: t.options.lineHeight,
        }
      })
    }

    const syncScrollDownBtnVisibility = (): void => {
      if (!termAlive || termRef.current !== term) return
      syncTerminalScrolledUpState(term, setIsScrolledUp)
    }

    const terminalRepaint = createTerminalRepaintScheduler(
      () => (termAlive && termRef.current === term ? term : null),
    )
    const scheduleTerminalCanvasRepaint = (): void => {
      if (!termAlive || termRef.current !== term) return
      terminalRepaint.scheduleAfterWrite()
    }
    const scheduleTerminalCanvasRepaintImmediate = (): void => {
      if (!termAlive || termRef.current !== term) return
      terminalRepaint.schedule()
    }

    const fitScheduler = createBasicTerminalFitScheduler(
      () => (termAlive && termRef.current === term ? term : null),
      () => (termAlive && termRef.current === term ? fit : null),
      () => containerRef.current,
      (cols, rows) => {
        window.api.ptyResize(sessionId, cols, rows)
      },
      syncScrollDownBtnVisibility,
    )
    refitTerminalRef.current = () => {
      fitScheduler.runNow()
      scheduleTerminalCanvasRepaintImmediate()
    }
    scheduleRefitTerminalRef.current = () => {
      fitScheduler.schedule()
    }
    fitScheduler.runNow()

    const dScroll = term.onScroll(syncScrollDownBtnVisibility)

    let scrollbackHydrated = false
    const ptyDataBuffer: string[] = []

    const flushPtyDataBuffer = (): void => {
      if (!termAlive || termRef.current !== term || ptyDataBuffer.length === 0) return
      const pending = ptyDataBuffer.splice(0, ptyDataBuffer.length).join('')
      const shouldFollowOutput = !isTerminalScrolledUp(term)
      try {
        term.write(pending, () => {
          if (shouldFollowOutput) {
            try { term.scrollToBottom() } catch { /* dispose / dimensions */ }
          }
          scheduleTerminalCanvasRepaint()
          syncScrollDownBtnVisibility()
        })
      } catch {
        /* dispose / dimensions */
      }
    }

    const markScrollbackHydrated = (): void => {
      if (scrollbackHydrated) return
      scrollbackHydrated = true
      flushPtyDataBuffer()
    }

    const writeScrollbackThenHydrate = (rawSaved: string | null): void => {
      if (!termAlive || termRef.current !== term) return
      // Sin la última línea (prompt del shell muerto): si no, el shell nuevo
      // arranca a media línea y antepone su marca de fin de línea.
      const saved = rawSaved ? trimRestoredScrollback(rawSaved) : ''
      if (!saved) {
        markScrollbackHydrated()
        return
      }
      term.write(saved, () => {
        if (!termAlive) return
        try { term.scrollToBottom() } catch { /* dispose / dimensions */ }
        scheduleTerminalCanvasRepaintImmediate()
        syncScrollDownBtnVisibility()
        markScrollbackHydrated()
      })
    }

    void window.api.loadScrollback(sessionId).then(saved => {
      writeScrollbackThenHydrate(saved)
    }).catch(() => {
      markScrollbackHydrated()
    })

    const scheduleScrollbackSave = (): void => {
      if (!scrollbackHydrated) return
      if (scrollbackSaveTimerRef.current) clearTimeout(scrollbackSaveTimerRef.current)
      scrollbackSaveTimerRef.current = setTimeout(() => {
        scrollbackSaveTimerRef.current = null
        try {
          const data = serializeAddonRef.current?.serialize()
          if (data) window.api.saveScrollback(sessionId, data)
        } catch { /* ignore */ }
      }, 5000)
    }

    const clearTerminalScrollback = (): void => {
      if (!termAlive || termRef.current !== term) return
      try {
        term.clear()
        scheduleTerminalCanvasRepaintImmediate()
        syncScrollDownBtnVisibility()
        if (scrollbackSaveTimerRef.current) {
          clearTimeout(scrollbackSaveTimerRef.current)
          scrollbackSaveTimerRef.current = null
        }
        window.api.deleteScrollback(sessionId)
      } catch {
        /* dispose / dimensions */
      }
    }

    const writeToPty = (data: string): void => { window.api.ptyWrite(sessionId, data) }

    const BUSY_SILENCE_MS = 450

    const clearBusySilenceTimer = (): void => {
      if (busySilenceTimerRef.current) {
        clearTimeout(busySilenceTimerRef.current)
        busySilenceTimerRef.current = null
      }
    }

    const scheduleBusyIdleClear = (): void => {
      clearBusySilenceTimer()
      busySilenceTimerRef.current = setTimeout(() => {
        busySilenceTimerRef.current = null
        if (!ptyBusyRef.current) return
        ptyBusyRef.current = false
        syncPaneBusyState()
      }, BUSY_SILENCE_MS)
    }

    const markPaneBusy = (): void => {
      if (!ptyBusyRef.current) {
        ptyBusyRef.current = true
        syncPaneBusyState()
      }
      scheduleBusyIdleClear()
    }

    const absorbUserInput = (raw: string): void => {
      const { draft, completedLines } = feedCompletedUserLines(userLineDraftRef.current, raw)
      userLineDraftRef.current = draft
      if (completedLines.length > 0) {
        cmdSuggestPanelOpenRef.current = false
        setCmdSuggestCmd(null)
        setCmdSuggestDraft('')
        markPaneBusy()
      }
      for (const line of completedLines) {
        if (isClearCommandLine(line)) {
          clearTerminalScrollback()
          continue
        }
        void window.api.recordCdLine(sessionId, line).then(newCwd => {
          if (!newCwd) return
          setPaneCwd(newCwd)
          onPaneCwdChangedRef.current?.(sessionId, newCwd)
        })
        if (!/^\s*(?:builtin\s+|command\s+)?cd(\s|$)/i.test(line.trim())) {
          setRecentCommands(prev => pushRecentUnique(prev, line, MAX_RECENT_COMMANDS))
        }
        if (/^\s*(?:builtin\s+|command\s+)?cd(\s|$)/i.test(line.trim())) {
          void loadCdPaths()
        }
      }
      const t = draft.trimStart()
      if (isCdStart(t)) {
        if (!cdVisibleRef.current) {
          cdVisibleRef.current = true
          setCdVisible(true)
          void loadCdLocalDirs()
        }
        if (cdVisibleRef.current) setCdDraft(t)
        setCmdSuggestCmd(null)
        setCmdSuggestDraft('')
      } else {
        cdVisibleRef.current = false
        setCdVisible(false)
        setCdDraft('')
        setCdLocalDirs([])
        const matched = getMatchedCmd(t)
        const showCmdPanel = shouldShowCmdSuggestPanel(
          t,
          recentCommandsRef.current,
          matched,
        )
        if (!showCmdPanel) {
          if (cmdSuggestPanelOpenRef.current) {
            cmdSuggestPanelOpenRef.current = false
            setCmdSuggestCmd(null)
            setCmdSuggestDraft('')
          }
        } else {
          cmdSuggestPanelOpenRef.current = true
          setCmdSuggestCmd(matched)
          setCmdSuggestDraft(t)
        }
      }
    }
    absorbUserInputRef.current = absorbUserInput

    const sendWordBackwardKill = (): void => {
      const seq = '\x17'
      absorbUserInput(seq)
      writeToPty(seq)
      scheduleTerminalCanvasRepaint()
    }

    const scrollTerminalViewportToBottom = (): void => {
      if (!termAlive || termRef.current !== term) return
      try {
        term.scrollToBottom()
      } catch {
        /* dispose / dimensions */
      }
      scheduleTerminalCanvasRepaintImmediate()
      syncScrollDownBtnVisibility()
    }

    term.attachCustomKeyEventHandler((e: KeyboardEvent) => {
      if (e.type !== 'keydown') return true

      const isBackspace = e.key === 'Backspace' || e.code === 'Backspace'
      const isEnter = e.key === 'Enter' || e.code === 'Enter' || e.code === 'NumpadEnter'
      const isPlainBackspace = isBackspace && !e.ctrlKey && !e.altKey && !e.metaKey
      const isCtrlBackspace = isBackspace && e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey
      const isPlainEnter = isEnter && !e.ctrlKey && !e.altKey && !e.metaKey
      const isScrollUpKey =
        e.key === 'PageUp' ||
        e.code === 'PageUp' ||
        e.key === 'Home' ||
        e.code === 'Home'
      if (isScrollUpKey) userScrollEpoch += 1
      if (isPlainEnter || isPlainBackspace || isCtrlBackspace) {
        scrollTerminalViewportToBottom()
      }
      /*
       * macOS / xterm.js:
       * - Ctrl+Backspace → \b (solo mueve el cursor, no borra)
       * - ⌥/⌘+Backspace → \x1b\x7f o \x7f (a menudo no enlazado a backward-kill-word en zsh)
       * Enviamos ^W (backward-kill-word), estándar en zsh/bash/readline.
       */
      if (
        isBackspace &&
        !e.shiftKey &&
        ((e.altKey || e.metaKey) && !e.ctrlKey || e.ctrlKey && !e.altKey && !e.metaKey)
      ) {
        e.preventDefault()
        e.stopPropagation()
        sendWordBackwardKill()
        return false
      }

      const accel = e.metaKey || e.ctrlKey
      if (!accel || e.altKey || e.shiftKey) return true

      const isFind = e.key === 'f' || e.key === 'F' || e.code === 'KeyF'
      const isGit = e.key === 'g' || e.key === 'G' || e.code === 'KeyG'
      const isQuickOpen = e.key === 'p' || e.key === 'P' || e.code === 'KeyP'
      if (!isFind && !isGit && !isQuickOpen) return true

      e.preventDefault()
      e.stopPropagation()
      queueMicrotask(() => {
        if (isFind) {
          setFindModalOpen(true)
          setFindModalBuffer([])
          setFindModalHistory([])
        } else if (isGit) {
          onRequestPaneFocusRef.current?.()
          onRequestGitPanelRef.current?.()
        } else {
          onRequestPaneFocusRef.current?.()
          setQuickOpenOpen(prev => !prev)
        }
      })
      return false
    })

    ptyInjectRef.current = (raw: string): void => {
      absorbUserInput(raw)
      writeToPty(raw)
    }

    onRegisterRef({
      getSelection: () => term.getSelection(),
      writeToTty: (data: string) => {
        onRequestPaneFocusRef.current?.()
        absorbUserInput(data)
        writeToPty(data)
        term.focus()
      },
      scrollToBottom: () => scrollTerminalToBottomRef.current(),
      serialize: () => serializeAddonRef.current?.serialize() ?? '',
      refit: () => fitScheduler.runNow(),
      focus: () => { term.focus() },
      openGitPanel: () => {
        onRequestPaneFocusRef.current?.()
        onRequestGitPanelRef.current?.()
      },
      getPreviewLines: (maxLines = 6) => {
        try {
          const buf = term.buffer.active
          const end = buf.baseY + buf.cursorY
          const start = Math.max(0, end - Math.max(1, maxLines) + 1)
          const lines: string[] = []
          for (let y = start; y <= end; y++) {
            const line = buf.getLine(y)
            if (!line) continue
            lines.push(line.translateToString(true).replace(/\s+$/u, ''))
          }
          while (lines.length > 0 && lines[0] === '') lines.shift()
          return lines.slice(-maxLines)
        } catch {
          return []
        }
      },
    })

    term.onData(data => {
      absorbUserInput(data)
      writeToPty(data)
      // Fallback: si el compositor no repintó tras salida PTY, el input de xterm
      // fuerza render; programamos el mismo repintado post-write por si el eco tarda.
      scheduleTerminalCanvasRepaint()
    })
    term.onTitleChange(title => { if (title && isActivePaneRef.current) onTitleChange(title) })

    const resizeObs = new ResizeObserver(() => {
      if (!termAlive || termRef.current !== term) return
      fitScheduler.schedule()
    })
    if (containerRef.current) resizeObs.observe(containerRef.current)

    // Marca scroll manual hacia arriba para que un callback pendiente de term.write
    // no reactive el follow si el usuario empezó a leer historial durante el stream.
    let userScrollEpoch = 0
    const terminalHost = containerRef.current
    const markUserScrollUpIntent = (ev: WheelEvent): void => {
      if (ev.deltaY < 0) userScrollEpoch += 1
    }
    const markViewportPointerScrollIntent = (ev: MouseEvent): void => {
      const target = ev.target as HTMLElement | null
      if (target?.closest('.xterm-viewport')) userScrollEpoch += 1
    }
    terminalHost?.addEventListener('wheel', markUserScrollUpIntent, { passive: true })
    terminalHost?.addEventListener('mousedown', markViewportPointerScrollIntent, { passive: true })

    const ptyWriteBatcher = createPlainPtyWriteBatcher(
      () => (termAlive && termRef.current === term ? term : null),
      () => userScrollEpoch,
    )

    // Suscribirse ANTES de ptyCreate: la salida inicial del shell no se pierde por carrera IPC.
    let lastPtyErrorAt = 0
    const unsubData = window.api.onPtyData(sessionId, data => {
      if (!termAlive || termRef.current !== term) return
      if (ptyBusyRef.current) scheduleBusyIdleClear()
      if (!scrollbackHydrated) {
        ptyDataBuffer.push(data)
        return
      }
      ptyWriteBatcher.write(data, scheduleTerminalCanvasRepaint)
      scheduleScrollbackSave()
    })
    const unsubExit = window.api.onPtyExit(sessionId, code => {
      if (!termAlive || termRef.current !== term) return
      // Evita re-spawn tras un spawn fallido cuyo kill dejó un onExit tardío del PTY anterior.
      if (Date.now() - lastPtyErrorAt < 800) return
      ptyWriteBatcher.write(
        `\r\n\x1b[2m[proceso terminado — código ${code}]\x1b[0m\r\n`,
        scheduleTerminalCanvasRepaint,
      )
      if (busySilenceTimerRef.current) clearTimeout(busySilenceTimerRef.current)
      busySilenceTimerRef.current = null
      if (ptyBusyRef.current) {
        ptyBusyRef.current = false
        syncPaneBusyState()
      }
      if (config.autoRestartShell === false) return
      // Sin proceso, ptyWrite no hace nada → no hay eco en xterm; el onData del renderer
      // sigue alimentando sugerencias. Re-lanzar shell en el mismo sessionId si el panel sigue montado.
      void window.api.getSessionCwd(sessionId).then(cwd => {
        const dir = cwd.trim()
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (!termAlive || termRef.current !== term) return
            const host = containerRef.current
            if (!host?.isConnected) return
            try {
              window.api.ptyCreate(sessionId, dir || undefined)
              fitScheduler.runNow()
            } catch {
              /* xterm / PTY carrera */
            }
            scheduleTerminalCanvasRepaintImmediate()
          })
        })
      })
    })
    const unsubErr = window.api.onPtyError(sessionId, message => {
      if (!termAlive || termRef.current !== term) return
      lastPtyErrorAt = Date.now()
      ptyWriteBatcher.write(
        `\r\n\x1b[31m${message}\x1b[0m\r\n`,
        scheduleTerminalCanvasRepaint,
      )
    })

    const spawnCwd = initialPtyCwd?.trim()
    window.api.ptyCreate(sessionId, spawnCwd || undefined)
    if (spawnCwd) onPtyCwdInitializedRef.current?.(sessionId, spawnCwd)
    window.api.ptyResize(sessionId, Math.max(1, term.cols), Math.max(1, term.rows))

    bootCleanup = () => {
      ptyWriteBatcher.dispose()
      terminalRepaint.cancel()
      absorbUserInputRef.current = () => {}
      ptyInjectRef.current = () => {}
      if (scrollbackSaveTimerRef.current) {
        clearTimeout(scrollbackSaveTimerRef.current)
        scrollbackSaveTimerRef.current = null
      }
      if (busySilenceTimerRef.current) {
        clearTimeout(busySilenceTimerRef.current)
        busySilenceTimerRef.current = null
      }
      if (ptyBusyRef.current) {
        ptyBusyRef.current = false
        syncPaneBusyState()
      }
      cdVisibleRef.current = false
      setCdVisible(false); setCdDraft(''); setCdLocalDirs([])
      setIsScrolledUp(false)
      fitScheduler.cancel()
      resizeObs.disconnect()
      terminalHost?.removeEventListener('wheel', markUserScrollUpIntent)
      terminalHost?.removeEventListener('mousedown', markViewportPointerScrollIntent)
      unsubData(); unsubExit(); unsubErr()
      dScroll.dispose()
      // Guardar scrollback final antes de desmontar
      try {
        const data = serializeAddonRef.current?.serialize()
        if (data) window.api.saveScrollback(sessionId, data)
      } catch { /* ignore */ }
      serializeAddonRef.current = null
      refitTerminalRef.current = () => {}
      scheduleRefitTerminalRef.current = () => {}
      termRef.current = null
      fitRef.current = null
      if (import.meta.env.DEV) {
        delete (window as unknown as { __gravityTerms?: Record<string, Terminal> }).__gravityTerms?.[sessionId]
      }
      term.dispose()
      onRegisterRef(null)
    }
    }) // openWhenReady

    return () => {
      termAlive = false
      stopOpenWait()
      if (bootCleanup) {
        bootCleanup()
        bootCleanup = null
      } else {
        try { term.dispose() } catch { /* never opened */ }
        onRegisterRef(null)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  useEffect(() => {
    const term = termRef.current
    if (!term) return
    term.options.theme = getTheme(config.themeId).xterm
    // Force xterm to re-render all glyphs with the new palette
    // (clearTextureAtlas is part of the proposed API, enabled above)
    ;(term as Terminal & { clearTextureAtlas?: () => void }).clearTextureAtlas?.()
    // En Electron/macOS el atlas puede quedar sin repintar; refresh fuerza un frame.
    requestAnimationFrame(() => {
      const t = termRef.current
      if (!t || t.rows < 1 || t !== term) return
      try {
        t.refresh(0, t.rows - 1)
      } catch {
        /* dimensions */
      }
    })
  }, [config.themeId])

  useEffect(() => {
    const term = termRef.current
    const fit = fitRef.current
    if (term && fit) {
      term.options.fontSize = config.fontSize
      fitTerminal(term, fit)
      syncTerminalScrolledUpState(term, setIsScrolledUp)
      window.api.ptyResize(sessionId, Math.max(1, term.cols), Math.max(1, term.rows))
    }
  }, [config.fontSize, sessionId])

  useEffect(() => {
    if (tabActive && isActivePane && fitRef.current && termRef.current) {
      const id = setTimeout(() => {
        const term = termRef.current
        const fit = fitRef.current
        if (!term || !fit || term.rows < 1) return
        fitTerminal(term, fit)
        syncTerminalScrolledUpState(term, setIsScrolledUp)
        window.api.ptyResize(sessionId, Math.max(1, term.cols), Math.max(1, term.rows))
        // Tab con display:none no compone el canvas; segundo frame tras volver visible (Electron).
        requestAnimationFrame(() => {
          const t = termRef.current
          if (!t || t !== term || t.rows < 1) return
          repaintTerminalCanvas(t)
        })
        term.focus()
      }, 10)
      return () => clearTimeout(id)
    }
  }, [tabActive, isActivePane, sessionId])

  useEffect(() => {
    if (!tabActive || !isActivePane || !fitRef.current || !termRef.current) return
    const t = setTimeout(() => {
      const term = termRef.current
      const fit = fitRef.current
      if (!term || !fit || term.rows < 1) return
      fitTerminal(term, fit)
      syncTerminalScrolledUpState(term, setIsScrolledUp)
      window.api.ptyResize(sessionId, Math.max(1, term.cols), Math.max(1, term.rows))
    }, 60)
    return () => clearTimeout(t)
  }, [tabActive, isActivePane, sessionId])

  const handleCdPick = (path: string): void => {
    const cmd = `\x15cd ${shellSingleQuotePosix(path)}\r`
    userLineDraftRef.current = ''
    cdVisibleRef.current = false
    setCdVisible(false); setCdDraft(''); setCdLocalDirs([])
    absorbUserInputRef.current(cmd)
    window.api.ptyWrite(sessionId, cmd)
    termRef.current?.focus()
  }

  const handleCdLocalPick = (dirname: string): void => {
    const cmd = `\x15cd ${shellSingleQuotePosix(dirname)}\r`
    userLineDraftRef.current = ''
    cdVisibleRef.current = false
    setCdVisible(false); setCdDraft(''); setCdLocalDirs([])
    absorbUserInputRef.current(cmd)
    window.api.ptyWrite(sessionId, cmd)
    termRef.current?.focus()
  }

  const cdArg = cdDraft.trimStart().replace(/^cd\s*/i, '').toLowerCase()
  const visiblePaths = cdVisible ? filterPaths(cdPaths, cdDraft) : []
  const visibleLocalDirs = cdVisible
    ? (cdArg ? cdLocalDirs.filter(d => d.toLowerCase().includes(cdArg)) : cdLocalDirs)
    : []

  const handleCmdSnippetPick = (snippet: string): void => {
    // Ctrl+U borra la línea, luego escribe el snippet SIN \r (no ejecuta)
    const toWrite = `\x15${snippet}`
    userLineDraftRef.current = snippet
    const matched = getMatchedCmd(snippet.trimStart())
    if (matched) {
      setCmdSuggestCmd(matched)
      setCmdSuggestDraft(snippet.trimStart())
    } else {
      setCmdSuggestCmd(null)
      setCmdSuggestDraft(snippet.trimStart())
    }
    window.api.ptyWrite(sessionId, toWrite)
    termRef.current?.focus()
  }

  const handleRecentCmdPick = (cmd: string): void => {
    const toWrite = `\x15${cmd}`
    userLineDraftRef.current = cmd
    const matched = getMatchedCmd(cmd.trimStart())
    if (matched) {
      setCmdSuggestCmd(matched)
      setCmdSuggestDraft(cmd.trimStart())
    } else {
      setCmdSuggestCmd(null)
      setCmdSuggestDraft(cmd.trimStart())
    }
    window.api.ptyWrite(sessionId, toWrite)
    termRef.current?.focus()
  }

  const runTerminalFind = useCallback((raw: string) => {
    const q = raw.trim()
    if (!q) return
    const term = termRef.current
    if (!term) {
      setFindModalBuffer([])
      setFindModalHistory([])
      return
    }
    setFindModalBuffer(findMatchesInTerminalBuffer(term, q))
    setFindModalHistory(findMatchesInCommandHistory(recentCommandsRef.current, q))
  }, [])

  const closeFindModal = useCallback(() => {
    setFindModalOpen(false)
    setFindModalBuffer([])
    setFindModalHistory([])
    queueMicrotask(() => { termRef.current?.focus() })
  }, [])

  const closeQuickOpen = useCallback(() => {
    setQuickOpenOpen(false)
    queueMicrotask(() => { termRef.current?.focus() })
  }, [])

  const handleQuickOpenPick = useCallback((relPath: string) => {
    setQuickOpenOpen(false)
    onRequestPaneFocusRef.current?.()
    onExplorerRevealFileRef.current?.(relPath)
  }, [])

  const onGoToFindBufferMatch = useCallback((m: TerminalBufferFindMatch) => {
    const term = termRef.current
    if (!term) return
    closeFindModal()
    term.scrollToLine(m.lineIndex)
    term.focus()
  }, [closeFindModal])

  const onApplyFindHistoryLine = (line: string): void => {
    setFindModalOpen(false)
    setFindModalBuffer([])
    setFindModalHistory([])
    handleRecentCmdPick(line)
  }

  const visibleSnippets: CmdSnippet[] = cmdSuggestCmd
    ? filterCmdSnippetsByDraft(CMD_SNIPPETS[cmdSuggestCmd] ?? [], cmdSuggestDraft)
    : []

  const visibleRecentMatches = useMemo(
    () => filterExecutedRecentsByDraft(recentCommands, cmdSuggestDraft, MAX_VISIBLE_RECENT_MATCHES),
    [recentCommands, cmdSuggestDraft],
  )

  const showCmdSuggestPanel = visibleSnippets.length > 0 || visibleRecentMatches.length > 0
  const showCdSuggestPanel = cdVisible && (visibleLocalDirs.length > 0 || cdPaths.length > 0)
  const showSuggestStack = showCmdSuggestPanel || showCdSuggestPanel

  useEffect(() => {
    scheduleRefitTerminalRef.current()
  }, [showSuggestStack, visibleSnippets.length, visibleRecentMatches.length, visibleLocalDirs.length, visiblePaths.length])

  return (
    <div
      ref={paneRootRef}
      className={[
        'terminal-pane',
        tabActive && isActivePane ? 'terminal-pane--focused' : '',
        tabActive && !isActivePane ? 'terminal-pane--inactive-pane' : '',
      ].filter(Boolean).join(' ')}
    >
      {tabActive && showPaneToolbar && (
        <PaneToolbar
          showReorderHandle={!!paneToolbar?.paneReorder?.enabled}
          isGrabbed={paneToolbar?.paneReorder?.isGrabbed ?? false}
          showClosePane={paneToolbar?.showClosePane ?? false}
          onDragHandleStart={e => {
            onRequestPaneFocusRef.current?.()
            paneToolbar?.paneReorder?.onDragHandleStart(e)
          }}
          onDragHandleEnd={() => {
            paneToolbar?.paneReorder?.onDragHandleEnd()
            queueMicrotask(() => { termRef.current?.focus() })
          }}
          onClosePane={() => {
            onRequestPaneFocusRef.current?.()
            setConfirmClosePaneOpen(true)
            queueMicrotask(() => { termRef.current?.focus() })
          }}
          onOpenGitPanel={() => {
            onRequestPaneFocusRef.current?.()
            onRequestGitPanelRef.current?.()
            queueMicrotask(() => { termRef.current?.focus() })
          }}
          explorerOpen={explorerOpen}
          explorerEnabled={explorerEnabled}
          folderLabel={sessionCwdPaneLabel(paneCwd)}
          quickOpenOpen={quickOpenOpen}
          sessionId={sessionId}
          onQuickOpenClose={closeQuickOpen}
          onQuickOpenPick={handleQuickOpenPick}
          onToggleExplorer={() => onToggleExplorerRef.current?.()}
          onOpenFolderInFinder={() => {
            onRequestPaneFocusRef.current?.()
            void openThisPaneFolderInFinder()
            queueMicrotask(() => { termRef.current?.focus() })
          }}
          onPointerDown={onTerminalChromePointerDown}
        />
      )}

      <div className="terminal-pane-body">
        <div className="terminal-pane-body__workspace">
        <div
          className="terminal-pane-main"
          onMouseDown={e => {
            onRequestPaneFocusRef.current?.()
            if ((e.target as HTMLElement).closest('button')) return
            termRef.current?.focus()
          }}
        >
          <div className="terminal-pane-main__terminal">
            <div ref={containerRef} className="terminal-container" />

            {isScrolledUp && (
              <TerminalScrollDown
                onPointerDown={onTerminalChromePointerDown}
                onClick={scrollTerminalToBottom}
              />
            )}
          </div>

          <TerminalSuggestStack
            showCdSuggestPanel={showCdSuggestPanel}
            showCmdSuggestPanel={showCmdSuggestPanel}
            visibleLocalDirs={visibleLocalDirs}
            visiblePaths={visiblePaths}
            onPickCdLocal={handleCdLocalPick}
            onPickCdRecent={handleCdPick}
            visibleRecentMatches={visibleRecentMatches}
            visibleSnippets={visibleSnippets}
            cmdSuggestCmd={cmdSuggestCmd}
            cmdSuggestDraft={cmdSuggestDraft}
            onPickRecentCmd={handleRecentCmdPick}
            onPickCmdSnippet={handleCmdSnippetPick}
          />
        </div>
        </div>
      </div>

      <TerminalFindModal
        open={findModalOpen && tabActive}
        onClose={closeFindModal}
        bufferMatches={findModalBuffer}
        historyMatches={findModalHistory}
        onSearch={runTerminalFind}
        onGoToBufferMatch={onGoToFindBufferMatch}
        onApplyHistoryLine={onApplyFindHistoryLine}
      />

      <ConfirmTerminalModal
        open={confirmClosePaneOpen}
        active={tabActive}
        message="¿Cerrar este panel?"
        detail="Se cerrará la sesión de esta terminal (PTY de esta celda)."
        onConfirm={() => {
          setConfirmClosePaneOpen(false)
          paneToolbar?.onClosePane?.()
        }}
        onCancel={() => setConfirmClosePaneOpen(false)}
      />
    </div>
  )
}
