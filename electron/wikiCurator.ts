/**
 * Turno single-shot del curador de la wiki (patrón brainstormRoom): spawn vía
 * `runAgentCliSpawn`, que NO post-procesa `assistant_final` — el ingest de
 * `ia-terminal-wiki` se aplica aquí explícito con applyWikiIngestFromFinalText
 * y después se extrae el fence `ia-terminal-wiki-view` para la UI.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { BrowserWindow } from 'electron'
import type { AppConfig } from '../src/shared/configSchema'
import type {
  AgentCliImageAttachment,
  AgentCliStartRequest,
  AgentCliUiEvent,
} from '../src/shared/agentCliTypes'
import {
  buildWikiCuratorPrompt,
  extractWikiViewRequest,
  isWikiCuratorInitCommand,
  parseWikiCuratorConfig,
  sanitizeWikiCuratorConfig,
  WIKI_CURATOR_INIT_COMMAND,
  type WikiCuratorConfig,
  type WikiCuratorEvent,
} from '../src/shared/wikiCurator'
import { IPC } from '../src/shared/ipcChannels'
import { lintWikiPages } from '../src/shared/wikiLint'
import { discoverTabContexts } from './tabContextBuild'
import { runAgentCliSpawn, stopAgentRunsForPane } from './agentCliRuntime'
import { MAX_WIKI_INIT_INGEST_OPS } from '../src/shared/wikiDoc'
import { applyWikiIngestFromFinalText } from './wikiIngest'
import { ensureWiki, readWikiPages, wikiRootPath } from './wikiStore'

export interface WikiCuratorStartConfig {
  cwd: string
  message: string
  /** Continuidad conversacional; sin él se reusa la sesión previa del cwd. */
  cliSessionId?: string
  /** Pegadas / sketch del composer; materializa runAgentCliSpawn. */
  images?: AgentCliImageAttachment[]
}

/** Mismo contrato que runAgentCliSpawn; inyectable en tests. */
export type WikiCuratorRunner = (
  request: AgentCliStartRequest,
  config: AppConfig,
  home: string,
  handlers: {
    onEvent: (event: AgentCliUiEvent) => void
    onDone: (code: number) => void
  },
) => void

const CURATOR_CONFIG_FILE = 'curator.json'
const CURATOR_AGENT_ID = 'wiki-curator'

/**
 * Las pages citan rutas relativas a su paquete (`electron/…`, `src/…`) pero el
 * cwd del proyecto puede ser un monorepo con esos paquetes un nivel abajo
 * (covenant-v2/electron/…), o relativas a raíces aún más profundas
 * (`locales/en.ts` bajo src/i18n). Regla precision-first: la ruta cuenta como
 * viva si existe bajo cwd o bajo una subcarpeta visible de primer nivel, y
 * solo se acusa como muerta si su primer segmento ancla en alguna raíz — una
 * ruta sin anclaje no es verificable y no se reporta.
 */
function buildWikiPathExists(cwd: string): (rel: string) => boolean {
  let roots: string[] | null = null
  const listRoots = (): string[] => {
    if (roots) return roots
    roots = [cwd]
    try {
      for (const entry of readdirSync(cwd, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
        roots.push(join(cwd, entry.name))
      }
    } catch { /* cwd ilegible: queda solo cwd */ }
    return roots
  }
  return rel => {
    const allRoots = listRoots()
    if (allRoots.some(root => existsSync(join(root, rel)))) return true
    const first = rel.split('/')[0] ?? ''
    return !allRoots.some(root => existsSync(join(root, first)))
  }
}

/** Sección `## Wiki health` para el prompt del curador; undefined si la wiki está sana. */
function buildWikiHealthSection(cwd: string): string | undefined {
  const report = lintWikiPages(readWikiPages(cwd), buildWikiPathExists(cwd))
  const lines = [
    ...report.orphans.map(slug => `- orphan page: [[${slug}]]`),
    ...report.brokenLinks.map(({ from, to }) => `- broken link: [[${from}]] → [[${to}]]`),
    ...report.deadPaths.map(({ slug, path }) => `- dead file path in [[${slug}]]: \`${path}\``),
  ]
  return lines.length ? lines.join('\n') : undefined
}

/** Un turno activo por cwd: el nuevo invalida al previo (generación + stop). */
const curatorGenerations = new Map<string, number>()
let nextCuratorGeneration = 1
/** Sesión CLI por cwd para continuidad conversacional entre turnos. */
const curatorSessions = new Map<string, string>()

export function wikiCuratorPaneId(cwd: string): string {
  return `wiki-curator:${cwd}`
}

function emitCurator(win: BrowserWindow, cwd: string, event: WikiCuratorEvent): void {
  if (!win.isDestroyed()) {
    win.webContents.send(IPC.WIKI_CURATOR_EVENT, cwd, event)
  }
}

function curatorConfigPath(cwd: string): string {
  return join(wikiRootPath(cwd), CURATOR_CONFIG_FILE)
}

/** Lee `.gravity/wiki/curator.json` sanitizado; ausente o inválido → {}. */
export function readWikiCuratorConfig(cwd: string): WikiCuratorConfig {
  const path = curatorConfigPath(cwd)
  if (!existsSync(path)) return {}
  try {
    return parseWikiCuratorConfig(readFileSync(path, 'utf8'))
  } catch {
    return {}
  }
}

/** Escribe la config sanitizada; crea `.gravity/wiki/` si falta. */
export function writeWikiCuratorConfig(
  cwd: string,
  value: unknown,
): { ok: true; config: WikiCuratorConfig } | { ok: false; error: string } {
  const config = sanitizeWikiCuratorConfig(value)
  try {
    mkdirSync(wikiRootPath(cwd), { recursive: true })
    writeFileSync(curatorConfigPath(cwd), `${JSON.stringify(config, null, 2)}\n`, 'utf8')
    return { ok: true, config }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/** True si la config sanitizada no trae nombre, provider, modelo ni reglas. */
export function isWikiCuratorConfigEmpty(config: WikiCuratorConfig): boolean {
  return Object.keys(config).length === 0
}

/** Lee wikiCurator de AppConfig ya sanitizado. */
export function wikiCuratorConfigFromApp(appConfig: AppConfig): WikiCuratorConfig {
  return sanitizeWikiCuratorConfig(appConfig.wikiCurator)
}

/** Aplica valor crudo a AppConfig (sin persistir). */
export function applyWikiCuratorConfigToApp(
  appConfig: AppConfig,
  value: unknown,
): { ok: true; config: WikiCuratorConfig; appConfig: AppConfig } {
  const config = sanitizeWikiCuratorConfig(value)
  return {
    ok: true,
    config,
    appConfig: { ...appConfig, wikiCurator: config },
  }
}

/**
 * Si AppConfig no tiene curador y el proyecto trae `.gravity/wiki/curator.json`,
 * copia sanitizada one-shot a AppConfig. No borra el archivo de proyecto.
 */
export function maybeMigrateWikiCuratorFromProject(
  cwd: string,
  appConfig: AppConfig,
): { appConfig: AppConfig; config: WikiCuratorConfig; migrated: boolean } {
  const current = wikiCuratorConfigFromApp(appConfig)
  if (!isWikiCuratorConfigEmpty(current)) {
    return { appConfig, config: current, migrated: false }
  }
  const projectConfig = readWikiCuratorConfig(cwd)
  if (isWikiCuratorConfigEmpty(projectConfig)) {
    return { appConfig, config: current, migrated: false }
  }
  const appConfigNext = { ...appConfig, wikiCurator: projectConfig }
  return { appConfig: appConfigNext, config: projectConfig, migrated: true }
}

export function startWikiCuratorTurn(
  win: BrowserWindow,
  config: WikiCuratorStartConfig,
  appConfig: AppConfig,
  home: string,
  options?: { runner?: WikiCuratorRunner },
): { ok: true } | { ok: false; error: string } {
  const cwd = typeof config.cwd === 'string' ? config.cwd.trim() : ''
  const message = typeof config.message === 'string' ? config.message.trim() : ''
  const images = Array.isArray(config.images)
    ? config.images.filter((image): image is AgentCliImageAttachment => (
      Boolean(
        image
        && typeof image.name === 'string'
        && typeof image.mimeType === 'string'
        && typeof image.base64 === 'string'
        && image.base64.length > 0,
      )
    ))
    : []
  if (!cwd) return { ok: false, error: 'cwd inválido' }
  if (!message && images.length === 0) return { ok: false, error: 'mensaje vacío' }

  const init = isWikiCuratorInitCommand(message)
  if (init) ensureWiki(cwd)
  const discovered = discoverTabContexts(cwd).contexts
  // Chat: solo wiki. Init: wiki + folderTree para explorar el proyecto read-only.
  let contexts = init
    ? discovered.filter(item => item.kind === 'wiki' || item.kind === 'folderTree')
    : discovered.filter(item => item.kind === 'wiki')
  if (init && !contexts.some(item => item.kind === 'folderTree')) {
    contexts = [
      ...contexts,
      {
        id: 'iaterminal:folderTree:init',
        name: 'Project folders',
        fileName: 'folders.md',
        kind: 'folderTree',
      },
    ]
  }
  if (!init && !contexts.length) {
    const error = 'El proyecto no tiene wiki (.gravity/wiki).'
    emitCurator(win, cwd, { type: 'error', message: error })
    emitCurator(win, cwd, { type: 'done' })
    return { ok: false, error }
  }

  const paneId = wikiCuratorPaneId(cwd)
  const generation = nextCuratorGeneration++
  curatorGenerations.set(cwd, generation)
  // El turno nuevo cancela al previo (runAgentCliSpawn también lo hace; esto
  // cubre runners inyectados y deja el estado consistente al instante).
  stopAgentRunsForPane(paneId)
  const isStale = (): boolean => curatorGenerations.get(cwd) !== generation

  const curatorConfig = sanitizeWikiCuratorConfig(appConfig.wikiCurator)
  const requestedSession = typeof config.cliSessionId === 'string' && config.cliSessionId.trim()
    ? config.cliSessionId.trim()
    : undefined

  const request: AgentCliStartRequest = {
    paneId,
    provider: curatorConfig.provider ?? 'claude',
    // Gestor de información: nunca programa ni toca archivos → plan.
    permissionMode: 'plan',
    prompt: buildWikiCuratorPrompt(
      curatorConfig,
      message || '(imagen adjunta)',
      buildWikiHealthSection(cwd),
      init ? 'init' : 'chat',
    ),
    cwd,
    name: curatorConfig.name,
    model: curatorConfig.model,
    agentId: CURATOR_AGENT_ID,
    coordination: 'none',
    allowDelegations: false,
    emitResults: false,
    emitChangelog: false,
    mcpsAllowed: [],
    contexts,
    cliSessionId: requestedSession ?? curatorSessions.get(cwd),
    ...(images.length ? { images } : {}),
  }

  let finalText = ''
  let lastError: string | undefined
  const runner = options?.runner ?? runAgentCliSpawn

  runner(request, appConfig, home, {
    onEvent: (event: AgentCliUiEvent) => {
      if (isStale()) return
      if (event.type === 'session') {
        curatorSessions.set(cwd, event.cliSessionId)
        return
      }
      if (event.type === 'assistant_delta') {
        emitCurator(win, cwd, { type: 'delta', text: event.text })
        return
      }
      if (event.type === 'assistant_final') {
        finalText = event.text
        return
      }
      if (event.type === 'error') {
        lastError = event.message
      }
    },
    onDone: code => {
      if (isStale()) return
      curatorGenerations.delete(cwd)
      if (code !== 0 && !finalText.trim()) {
        emitCurator(win, cwd, {
          type: 'error',
          message: lastError || `El CLI terminó con código ${code}.`,
        })
        emitCurator(win, cwd, { type: 'done' })
        return
      }
      // runAgentCliSpawn no aplica el ingest de assistant_final (eso vive en
      // startAgentTurn): se aplica aquí, una sola vez, con la wiki asignada.
      const ingest = applyWikiIngestFromFinalText(finalText, cwd, {
        agentId: CURATOR_AGENT_ID,
        persist: true,
        ...(init ? { maxOps: MAX_WIKI_INIT_INGEST_OPS } : {}),
      })
      if (ingest.persisted) {
        emitCurator(win, cwd, { type: 'applied', opsCount: ingest.applied })
      }
      const view = extractWikiViewRequest(ingest.visibleText)
      emitCurator(win, cwd, { type: 'final', text: view.visibleText })
      if (view.slugs.length) {
        emitCurator(win, cwd, { type: 'view', slugs: view.slugs })
      }
      emitCurator(win, cwd, { type: 'done' })
    },
  })

  return { ok: true }
}

export function stopWikiCuratorTurn(cwd: string, win?: BrowserWindow): void {
  const trimmed = typeof cwd === 'string' ? cwd.trim() : ''
  if (!trimmed) return
  if (!curatorGenerations.has(trimmed)) return
  curatorGenerations.delete(trimmed)
  stopAgentRunsForPane(wikiCuratorPaneId(trimmed))
  if (win) emitCurator(win, trimmed, { type: 'done' })
}

/** Solo tests: limpia generaciones y sesiones. */
export function clearWikiCuratorForTests(): void {
  curatorGenerations.clear()
  curatorSessions.clear()
}
