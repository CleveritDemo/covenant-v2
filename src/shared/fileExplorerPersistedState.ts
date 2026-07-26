/** Estado del explorador de archivos por tab (raíz = pane terminal activo). */
export interface FileExplorerPersistedState {
  open: boolean
  /** Ventana maximizada en el plano (mismo patrón que PaneWindow). */
  fullscreen: boolean
  selectedRelPath: string | null
  selectedIsDirectory: boolean
  /** Archivo abierto en el editor (puede diferir de la selección del árbol). */
  openedRelPath: string | null
  expandedRelPaths: string[]
  /** Mostrar node_modules, .git, etc. */
  showHiddenDirs: boolean
  /** Ancho del panel árbol en % cuando hay editor abierto (20–50). */
  treeWidthPercent: number
  /** Abrir archivo con un solo clic (false = doble clic). */
  openOnSingleClick: boolean
}

const DEFAULT_EXPANDED: string[] = ['']

export const DEFAULT_FILE_EXPLORER_STATE: FileExplorerPersistedState = {
  open: false,
  fullscreen: false,
  selectedRelPath: null,
  selectedIsDirectory: false,
  openedRelPath: null,
  expandedRelPaths: DEFAULT_EXPANDED,
  showHiddenDirs: false,
  treeWidthPercent: 30,
  openOnSingleClick: true,
}

export function normalizeFileExplorerState(raw: unknown): FileExplorerPersistedState {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_FILE_EXPLORER_STATE }
  const o = raw as Record<string, unknown>
  const expandedRaw = o.expandedRelPaths
  let expandedRelPaths = Array.isArray(expandedRaw)
    ? expandedRaw.filter((p): p is string => typeof p === 'string')
    : [...DEFAULT_EXPANDED]
  if (!expandedRelPaths.includes('')) expandedRelPaths.unshift('')
  if (expandedRelPaths.length === 1 && expandedRelPaths[0] === '') {
    expandedRelPaths = DEFAULT_EXPANDED
  }

  let treeWidthPercent = typeof o.treeWidthPercent === 'number' ? o.treeWidthPercent : 30
  if (treeWidthPercent < 20) treeWidthPercent = 20
  if (treeWidthPercent > 50) treeWidthPercent = 50

  const selectedRelPath = typeof o.selectedRelPath === 'string' ? o.selectedRelPath : null
  const selectedIsDirectory = o.selectedIsDirectory === true
  let openedRelPath = typeof o.openedRelPath === 'string' ? o.openedRelPath : null
  // Migración: si no había openedRelPath, abrir el archivo seleccionado.
  if (openedRelPath === null && selectedRelPath && !selectedIsDirectory) {
    openedRelPath = selectedRelPath
  }

  return {
    open: o.open === true,
    fullscreen: o.fullscreen === true,
    selectedRelPath,
    selectedIsDirectory,
    openedRelPath,
    expandedRelPaths,
    showHiddenDirs: o.showHiddenDirs === true,
    treeWidthPercent,
    openOnSingleClick: o.openOnSingleClick !== false,
  }
}
