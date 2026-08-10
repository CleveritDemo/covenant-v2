import type { TabContext, TabContextKind } from './tabContext'

/** Íconos elegibles para la cara visual de un contexto (subset estable). */
export const TAB_CONTEXT_ICON_NAMES = [
  'folder',
  'files',
  'code',
  'note',
  'git-branch',
  'package',
  'book',
  'history',
  'sparkles',
  'bot',
  'brain',
  'search',
  'terminal',
  'settings',
  'jira',
  'atlassian',
  'port',
  'mcp',
  'table',
] as const

export type TabContextIconName = (typeof TAB_CONTEXT_ICON_NAMES)[number]

export const TAB_CONTEXT_COLORS = [
  '#5ec8ff',
  '#f0c14a',
  '#c084fc',
  '#fb7185',
  '#fb923c',
  '#2dd4bf',
  '#38bdf8',
  '#a3e635',
  '#f472b6',
  '#94a3b8',
  '#e879f9',
  '#34d399',
] as const

export type TabContextColor = (typeof TAB_CONTEXT_COLORS)[number]

const KIND_DEFAULT_ICON: Record<TabContextKind, TabContextIconName> = {
  folderTree: 'folder',
  files: 'files',
  symbols: 'code',
  notes: 'note',
  git: 'git-branch',
  deps: 'package',
  readme: 'book',
  changelog: 'history',
  mcp: 'mcp',
  spreadsheet: 'table',
  agentResult: 'bot',
  skill: 'sparkles',
}

const KIND_DEFAULT_COLOR: Record<TabContextKind, TabContextColor> = {
  folderTree: '#5ec8ff',
  files: '#f0c14a',
  symbols: '#c084fc',
  notes: '#fb7185',
  git: '#fb923c',
  deps: '#2dd4bf',
  readme: '#38bdf8',
  changelog: '#a3e635',
  mcp: '#f472b6',
  spreadsheet: '#34d399',
  agentResult: '#94a3b8',
  skill: '#e879f9',
}

const ICON_SET = new Set<string>(TAB_CONTEXT_ICON_NAMES)
const COLOR_SET = new Set<string>(TAB_CONTEXT_COLORS.map(c => c.toLowerCase()))

export function defaultIconForKind(kind: TabContextKind): TabContextIconName {
  return KIND_DEFAULT_ICON[kind]
}

export function defaultColorForKind(kind: TabContextKind): TabContextColor {
  return KIND_DEFAULT_COLOR[kind]
}

export function normalizeContextIcon(value: unknown): TabContextIconName | undefined {
  if (typeof value !== 'string') return undefined
  const icon = value.trim()
  return ICON_SET.has(icon) ? icon as TabContextIconName : undefined
}

export function normalizeContextColor(value: unknown): TabContextColor | undefined {
  if (typeof value !== 'string') return undefined
  const color = value.trim().toLowerCase()
  if (!/^#[0-9a-f]{6}$/.test(color)) return undefined
  return COLOR_SET.has(color) ? color as TabContextColor : undefined
}

export function resolveContextIcon(
  context: Pick<TabContext, 'kind' | 'icon'>,
): TabContextIconName {
  return normalizeContextIcon(context.icon) ?? defaultIconForKind(context.kind)
}

export function resolveContextColor(
  context: Pick<TabContext, 'kind' | 'color'>,
): string {
  return normalizeContextColor(context.color) ?? defaultColorForKind(context.kind)
}

/** Iniciales del agente para su monograma: 2 caracteres, mayúsculas. */
export function agentMonogram(name: string): string {
  const words = name.trim().split(/[^\p{L}\p{N}]+/u).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return `${words[0][0]}${words[1][0]}`.toUpperCase()
}

/** Color de paleta estable para una semilla (mismo agente → mismo color). */
export function paletteColorForSeed(seed: string): TabContextColor {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0
  }
  return TAB_CONTEXT_COLORS[Math.abs(hash) % TAB_CONTEXT_COLORS.length]
}
