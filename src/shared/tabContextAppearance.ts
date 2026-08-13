import type { TabContext, TabContextKind } from './tabContext'

/**
 * Íconos elegibles para la cara visual de un contexto, agrupados por el
 * trabajo que describen. El grupo no es decorativo: con ~50 iconos, una
 * rejilla plana obliga a barrer todo el set para encontrar uno, y el orden
 * alfabético no ayuda a quien busca "algo de datos" sin nombre en la cabeza.
 */
export const TAB_CONTEXT_ICON_GROUPS = [
  {
    id: 'code',
    icons: ['code', 'git-branch', 'package', 'terminal', 'cpu', 'bug', 'beaker', 'layers', 'rocket', 'zap'],
  },
  {
    id: 'docs',
    icons: ['folder', 'files', 'note', 'book', 'history', 'clipboard', 'table', 'image', 'map', 'inbox'],
  },
  {
    id: 'data',
    icons: ['database', 'cloud', 'chart', 'target', 'filter', 'search', 'globe', 'calendar', 'link', 'tag'],
  },
  {
    id: 'team',
    icons: ['sparkles', 'bot', 'brain', 'messages', 'users', 'workspace', 'pulse', 'star', 'flag', 'palette'],
  },
  {
    id: 'ops',
    icons: ['settings', 'wrench', 'lock', 'key', 'shield-check', 'eye', 'plug', 'compass', 'jira', 'atlassian', 'datadog', 'port', 'mcp'],
  },
] as const

export type TabContextIconGroupId = (typeof TAB_CONTEXT_ICON_GROUPS)[number]['id']

export type TabContextIconName = (typeof TAB_CONTEXT_ICON_GROUPS)[number]['icons'][number]

/** Lista plana; los grupos son la fuente única para no desincronizar ambas. */
export const TAB_CONTEXT_ICON_NAMES: readonly TabContextIconName[] =
  TAB_CONTEXT_ICON_GROUPS.flatMap(group => group.icons as readonly TabContextIconName[])

/**
 * Sinónimos de búsqueda para los iconos cuyo nombre técnico no es lo que la
 * persona teclea ("marca" para `tag`, "deuda" para `bug`). En es y en: el
 * modal se usa en los dos idiomas y el nombre del icono solo existe en inglés.
 */
const ICON_KEYWORDS: Partial<Record<TabContextIconName, string>> = {
  'git-branch': 'git rama branch version control',
  code: 'codigo symbols clases funciones source',
  terminal: 'consola shell comando cli',
  package: 'dependencias deps paquete npm libreria',
  cpu: 'chip procesador hardware sistema build',
  bug: 'error incidencia defecto qa deuda',
  beaker: 'test pruebas experimento lab qa',
  layers: 'capas arquitectura stack modulos',
  rocket: 'release deploy lanzamiento entrega',
  zap: 'rendimiento performance rapido accion',
  folder: 'carpeta arbol directorio tree',
  files: 'archivos ficheros documentos',
  note: 'nota apuntes markdown texto',
  book: 'readme documentacion manual guia libro',
  history: 'changelog historial cambios registro',
  clipboard: 'portapapeles tareas checklist backlog',
  table: 'tabla hoja calculo spreadsheet excel csv datos',
  image: 'imagen diseno figma captura foto',
  map: 'mapa roadmap ruta plano',
  inbox: 'bandeja entrada pendientes cola',
  database: 'base datos sql db esquema modelo',
  cloud: 'nube cloud aws azure infra',
  chart: 'grafico metricas analitica reporte kpi datos',
  target: 'objetivo meta okr foco',
  filter: 'filtro criterio segmento',
  search: 'buscar busqueda lupa investigacion',
  globe: 'web internet dominio idioma global',
  calendar: 'calendario fecha sprint agenda',
  link: 'enlace url referencia vinculo',
  tag: 'etiqueta marca label version',
  sparkles: 'ia ai skill magia habilidad prompt',
  bot: 'agente agent ia robot resultado',
  brain: 'memoria conocimiento cerebro aprendizaje',
  messages: 'mensajes chat conversacion comentarios',
  users: 'equipo personas usuarios roles',
  workspace: 'espacio trabajo workspace proyecto',
  pulse: 'pulso actividad estado salud monitoreo',
  star: 'favorito destacado importante',
  flag: 'bandera hito marca aviso',
  palette: 'paleta diseno estilo marca colores',
  settings: 'ajustes configuracion preferencias config',
  wrench: 'herramienta mantenimiento fix ajuste',
  lock: 'seguridad candado privado bloqueo',
  key: 'clave llave credencial secreto token api',
  'shield-check': 'seguridad politica permisos escudo',
  eye: 'revision observabilidad ver vigilancia',
  plug: 'integracion conector enchufe api',
  compass: 'guia direccion norte principios',
  jira: 'jira ticket issue atlassian tablero',
  atlassian: 'atlassian confluence jira',
  datadog: 'datadog observabilidad monitoreo apm logs metricas alertas dashboard',
  port: 'port puerto servicio',
  mcp: 'mcp servidor herramienta protocolo',
}

/** minúsculas y sin tildes: "Ícono"/"grafico" deben encontrar lo mismo. */
function foldForSearch(value: string): string {
  return value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export interface TabContextIconGroup {
  id: TabContextIconGroupId
  icons: TabContextIconName[]
}

/**
 * Grupos que coinciden con la búsqueda; los vacíos se descartan para que la
 * rejilla no muestre encabezados huérfanos. Consulta vacía = todo.
 */
export function filterContextIconGroups(query: string): TabContextIconGroup[] {
  const needle = foldForSearch(query)
  return TAB_CONTEXT_ICON_GROUPS
    .map(group => ({
      id: group.id,
      icons: (group.icons as readonly TabContextIconName[]).filter(icon =>
        !needle || foldForSearch(`${icon} ${group.id} ${ICON_KEYWORDS[icon] ?? ''}`).includes(needle)),
    }))
    .filter(group => group.icons.length > 0)
}

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
  '#2684ff',
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
  jira: 'jira',
  wiki: 'book',
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
  jira: '#2684ff',
  wiki: '#2dd4bf',
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
