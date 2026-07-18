/** Carpetas pesadas ocultas por defecto cuando showHiddenDirs es false. */
export const FILE_EXPLORER_HIDDEN_DIR_NAMES = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  'out',
  'coverage',
  '__pycache__',
])

/** Alias histórico usado en el renderer. */
export const DEFAULT_COLLAPSED_DIR_NAMES = FILE_EXPLORER_HIDDEN_DIR_NAMES
