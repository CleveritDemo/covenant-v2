export interface XtermTheme {
  background: string
  foreground: string
  cursor: string
  cursorAccent: string
  selectionBackground: string
  selectionForeground: string
  black: string
  red: string
  green: string
  yellow: string
  blue: string
  magenta: string
  cyan: string
  white: string
  brightBlack: string
  brightRed: string
  brightGreen: string
  brightYellow: string
  brightBlue: string
  brightMagenta: string
  brightCyan: string
  brightWhite: string
}

export interface AppTheme {
  id: string
  name: string
  /** Si es `light`, se agrupa en el picker con otros claros */
  appearance?: 'light' | 'dark'
  // Chrome CSS variables (injected as --var: value on :root)
  vars: Record<string, string>
  xterm: XtermTheme
}

export type ThemeTabShape = 'square' | 'point-up' | 'point-down'
export type ThemeVisualCategory = 'regular' | 'glow'

export interface ThemeChromeProfile {
  category: ThemeVisualCategory
  tabShape: ThemeTabShape
  glowMultiplier: number
  panelRadius?: string
}

const tokyoNight: AppTheme = {
  id: 'tokyoNight',
  name: 'Tokyo Night',
  vars: {
    '--bg': '#1a1b26',
    '--bg-secondary': '#16161e',
    '--surface': '#24283b',
    '--surface-hover': '#2f3549',
    '--border': '#3b4261',
    '--text': '#c0caf5',
    '--text-muted': '#6772a4',
    '--accent': '#7aa2f7',
    '--accent-dim': '#3d59a1',
    '--danger': '#f7768e',
    '--tab-active-bg': '#24283b',
    '--tab-inactive-bg': '#1a1b26',
    '--scrollbar': '#3b4261',
    '--radius': '8px',
  },
  xterm: {
    background: '#1a1b26',
    foreground: '#a9b1d6',
    cursor: '#7aa2f7',
    cursorAccent: '#1a1b26',
    selectionBackground: '#3d59a155',
    selectionForeground: '#c0caf5',
    black: '#24283b',
    red: '#f7768e',
    green: '#9ece6a',
    yellow: '#e0af68',
    blue: '#c084fc',
    magenta: '#f472b6',
    cyan: '#2dd4bf',
    white: '#a9b1d6',
    brightBlack: '#565f89',
    brightRed: '#f7768e',
    brightGreen: '#9ece6a',
    brightYellow: '#e0af68',
    brightBlue: '#d8b4fe',
    brightMagenta: '#f9a8d4',
    brightCyan: '#5eead4',
    brightWhite: '#c0caf5',
  },
}

const matrix: AppTheme = {
  id: 'matrix',
  name: 'Matrix',
  vars: {
    '--bg': '#020403',
    '--bg-secondary': '#050a06',
    '--surface': '#0a120c',
    '--surface-hover': '#0f1a12',
    '--border': '#1a3322',
    '--text': '#c8ffc8',
    '--text-muted': '#4a7a55',
    '--accent': '#00ff66',
    '--accent-dim': '#009944',
    '--danger': '#ff4444',
    '--tab-active-bg': '#0a120c',
    '--tab-inactive-bg': '#020403',
    '--scrollbar': '#1a3322',
    '--radius': '8px',
  },
  xterm: {
    background: '#020403',
    foreground: '#86ff9f',
    cursor: '#00ff66',
    cursorAccent: '#020403',
    selectionBackground: '#00ff6628',
    selectionForeground: '#eaffee',
    black: '#071008',
    red: '#ff3d5a',
    green: '#00ff66',
    yellow: '#d4ff3f',
    blue: '#4d9fff',
    magenta: '#c44dff',
    cyan: '#2ef0c0',
    white: '#c8ffc8',
    brightBlack: '#274130',
    brightRed: '#ff7088',
    brightGreen: '#66ff99',
    brightYellow: '#e8ff7a',
    brightBlue: '#7db8ff',
    brightMagenta: '#d98cff',
    brightCyan: '#6ff5d4',
    brightWhite: '#f1fff1',
  },
}

/** Interstellar — vacío estelar, polvo cálido y acento NASA */
const interstellar: AppTheme = {
  id: 'interstellar',
  name: 'Interstellar',
  vars: {
    '--bg': '#05070c',
    '--bg-secondary': '#080b12',
    '--surface': '#0e121c',
    '--surface-hover': '#141a28',
    '--border': '#222a3c',
    '--text': '#c4cedc',
    '--text-muted': '#5a6578',
    '--accent': '#d4a84b',
    '--accent-dim': '#9a7630',
    '--danger': '#e85d4c',
    '--tab-active-bg': '#0e121c',
    '--tab-inactive-bg': '#05070c',
    '--scrollbar': '#222a3c',
    '--radius': '8px',
  },
  xterm: {
    background: '#05070c',
    foreground: '#c8d3e6',
    cursor: '#d4a84b',
    cursorAccent: '#05070c',
    selectionBackground: '#5a8fd444',
    selectionForeground: '#f4f8ff',
    black: '#0b0f17',
    red: '#ef6f5d',
    green: '#82b08f',
    yellow: '#d4a84b',
    blue: '#74a7f2',
    magenta: '#a79ad6',
    cyan: '#7fc8e4',
    white: '#d7dfeb',
    brightBlack: '#3b4558',
    brightRed: '#ff9a8d',
    brightGreen: '#a7d0b1',
    brightYellow: '#edc97e',
    brightBlue: '#a5c4ff',
    brightMagenta: '#cdc0ef',
    brightCyan: '#b1e1f5',
    brightWhite: '#f7fbff',
  },
}

const cyberpunk: AppTheme = {
  id: 'cyberpunk',
  name: 'Cyberpunk 2077',
  vars: {
    '--bg': '#0b0f19',
    '--bg-secondary': '#0f1626',
    '--surface': '#151d2f',
    '--surface-hover': '#1e2840',
    '--border': '#2a3654',
    '--text': '#e6f4ff',
    '--text-muted': '#6d85a8',
    '--accent': '#fcee0a',
    '--accent-dim': '#c9bd00',
    '--danger': '#ff2d6a',
    '--tab-active-bg': '#151d2f',
    '--tab-inactive-bg': '#0b0f19',
    '--scrollbar': '#2a3654',
    '--radius': '8px',
  },
  xterm: {
    background: '#0b0f19',
    foreground: '#d6fbff',
    cursor: '#fcee0a',
    cursorAccent: '#0b0f19',
    selectionBackground: '#ff6ef344',
    selectionForeground: '#fefefe',
    black: '#11182a',
    red: '#ff3b7d',
    green: '#00ff9c',
    yellow: '#fcee0a',
    blue: '#1fb6ff',
    magenta: '#ff6ef3',
    cyan: '#00f6ff',
    white: '#d6fbff',
    brightBlack: '#35507a',
    brightRed: '#ff72a6',
    brightGreen: '#72ffc3',
    brightYellow: '#fff587',
    brightBlue: '#7fd3ff',
    brightMagenta: '#ff9ff7',
    brightCyan: '#7cffff',
    brightWhite: '#ffffff',
  },
}

/** Cyberpunk Neon — más magenta/cian para paneles y chrome, sin tocar la idea base del terminal. */
const cyberpunkNeon: AppTheme = {
  id: 'cyberpunkNeon',
  name: 'Cyberpunk Neon',
  vars: {
    '--bg': '#090814',
    '--bg-secondary': '#0d0b1d',
    '--surface': '#151129',
    '--surface-hover': '#1d1638',
    '--border': '#3a2d68',
    '--text': '#f4ecff',
    '--text-muted': '#9a8fbe',
    '--accent': '#ff4fd8',
    '--accent-dim': '#b83297',
    '--danger': '#ff5a5f',
    '--tab-active-bg': '#1a1331',
    '--tab-inactive-bg': '#090814',
    '--scrollbar': '#3a2d68',
    '--radius': '10px',
  },
  xterm: {
    background: '#090814',
    foreground: '#e9fbff',
    cursor: '#00f0ff',
    cursorAccent: '#090814',
    selectionBackground: '#00f0ff33',
    selectionForeground: '#f7efff',
    black: '#130f25',
    red: '#ff5d73',
    green: '#22ffc1',
    yellow: '#ffe45e',
    blue: '#60a5fa',
    magenta: '#a855f7',
    cyan: '#22d3ee',
    white: '#f7efff',
    brightBlack: '#5a4795',
    brightRed: '#ff91a0',
    brightGreen: '#7cffd8',
    brightYellow: '#fff4a0',
    brightBlue: '#93c5fd',
    brightMagenta: '#c084fc',
    brightCyan: '#67e8f9',
    brightWhite: '#ffffff',
  },
}

/** TRON — rejilla cian sobre negro electrónico */
const tron: AppTheme = {
  id: 'tron',
  name: 'TRON',
  vars: {
    '--bg': '#050508',
    '--bg-secondary': '#0a0c12',
    '--surface': '#0f1218',
    '--surface-hover': '#151a24',
    '--border': '#1e2838',
    '--text': '#dff6ff',
    '--text-muted': '#5a7a9a',
    '--accent': '#00d4ff',
    '--accent-dim': '#0090b8',
    '--danger': '#ff3366',
    '--tab-active-bg': '#0f1218',
    '--tab-inactive-bg': '#050508',
    '--scrollbar': '#1e2838',
    '--radius': '6px',
  },
  xterm: {
    background: '#050508',
    foreground: '#d9f8ff',
    cursor: '#00d4ff',
    cursorAccent: '#050508',
    selectionBackground: '#00d4ff3d',
    selectionForeground: '#f3feff',
    black: '#0b1018',
    red: '#ff4b78',
    green: '#00ffd5',
    yellow: '#fff078',
    blue: '#818cf8',
    magenta: '#e879f9',
    cyan: '#34d399',
    white: '#dff6ff',
    brightBlack: '#2f4868',
    brightRed: '#ff7b97',
    brightGreen: '#6ee7b7',
    brightYellow: '#fff7a8',
    brightBlue: '#a5b4fc',
    brightMagenta: '#f0abfc',
    brightCyan: '#6ee7b7',
    brightWhite: '#ffffff',
  },
}

/** Blade Runner — neón naranja y teal sobre ciudad nocturna */
const bladeRunner: AppTheme = {
  id: 'bladeRunner',
  name: 'Blade Runner 2049',
  vars: {
    '--bg': '#100c14',
    '--bg-secondary': '#16101c',
    '--surface': '#1c1624',
    '--surface-hover': '#261e30',
    '--border': '#3a3048',
    '--text': '#ebe4f0',
    '--text-muted': '#8a7a9a',
    '--accent': '#ff9f1c',
    '--accent-dim': '#cc7722',
    '--danger': '#ff4d6d',
    '--tab-active-bg': '#1c1624',
    '--tab-inactive-bg': '#100c14',
    '--scrollbar': '#3a3048',
    '--radius': '8px',
  },
  xterm: {
    background: '#100c14',
    foreground: '#f0d8e8',
    cursor: '#2ec4b6',
    cursorAccent: '#100c14',
    selectionBackground: '#ff9f1c33',
    selectionForeground: '#fff8f1',
    black: '#1a1420',
    red: '#ff5a7a',
    green: '#28d1c0',
    yellow: '#ff9f1c',
    blue: '#6a7cff',
    magenta: '#d07cff',
    cyan: '#3de0d3',
    white: '#f0d8e8',
    brightBlack: '#5f4b66',
    brightRed: '#ff86a0',
    brightGreen: '#72f1df',
    brightYellow: '#ffc36b',
    brightBlue: '#9db1ff',
    brightMagenta: '#e8b7ff',
    brightCyan: '#8af7eb',
    brightWhite: '#fff8ff',
  },
}

/** Stranger Things — Mundo del revés (púrpura y rojo) */
const strangerThings: AppTheme = {
  id: 'strangerThings',
  name: 'Stranger Things',
  vars: {
    '--bg': '#12081c',
    '--bg-secondary': '#1a0c28',
    '--surface': '#241236',
    '--surface-hover': '#301848',
    '--border': '#402060',
    '--text': '#e8dcff',
    '--text-muted': '#9070b0',
    '--accent': '#c1121f',
    '--accent-dim': '#8a0e18',
    '--danger': '#ff4444',
    '--tab-active-bg': '#241236',
    '--tab-inactive-bg': '#12081c',
    '--scrollbar': '#402060',
    '--radius': '8px',
  },
  xterm: {
    background: '#12081c',
    foreground: '#eadcff',
    cursor: '#c1121f',
    cursorAccent: '#12081c',
    selectionBackground: '#e01e8440',
    selectionForeground: '#fff4ff',
    black: '#20102f',
    red: '#d11a2b',
    green: '#6d57ff',
    yellow: '#ff9d5c',
    blue: '#4d67ff',
    magenta: '#ff3ba7',
    cyan: '#76dbff',
    white: '#eadcff',
    brightBlack: '#5f4380',
    brightRed: '#ff4a5e',
    brightGreen: '#8c7cff',
    brightYellow: '#ffc27a',
    brightBlue: '#93adff',
    brightMagenta: '#ff7cc6',
    brightCyan: '#a8f0ff',
    brightWhite: '#ffffff',
  },
}

/** Fallout — verde Pip-Boy sobre fondo sepia oscuro */
const fallout: AppTheme = {
  id: 'fallout',
  name: 'Fallout',
  vars: {
    '--bg': '#0f1208',
    '--bg-secondary': '#141808',
    '--surface': '#1c2210',
    '--surface-hover': '#252c14',
    '--border': '#3a4220',
    '--text': '#d4e8a8',
    '--text-muted': '#6a7a40',
    '--accent': '#39ff14',
    '--accent-dim': '#22aa0c',
    '--danger': '#ff6b35',
    '--tab-active-bg': '#1c2210',
    '--tab-inactive-bg': '#0f1208',
    '--scrollbar': '#3a4220',
    '--radius': '6px',
  },
  xterm: {
    background: '#0f1208',
    foreground: '#bfe87a',
    cursor: '#39ff14',
    cursorAccent: '#0f1208',
    selectionBackground: '#39ff1428',
    selectionForeground: '#efffd1',
    black: '#161d0f',
    red: '#ff7c3e',
    green: '#39ff14',
    yellow: '#ffdc39',
    blue: '#5a9fd4',
    magenta: '#d080ff',
    cyan: '#5ee0ff',
    white: '#d9f2b0',
    brightBlack: '#53653a',
    brightRed: '#ffa26b',
    brightGreen: '#8fff75',
    brightYellow: '#fff085',
    brightBlue: '#8ec4ef',
    brightMagenta: '#e5b0ff',
    brightCyan: '#9aeeff',
    brightWhite: '#f7ffd8',
  },
}

/** Star Wars — hangar imperial (rojo y gris metálico) */
const starWars: AppTheme = {
  id: 'starWars',
  name: 'Star Wars',
  vars: {
    '--bg': '#0c0e12',
    '--bg-secondary': '#12151c',
    '--surface': '#1a1e28',
    '--surface-hover': '#242934',
    '--border': '#343b4a',
    '--text': '#e2e6ed',
    '--text-muted': '#7a8494',
    '--accent': '#e63946',
    '--accent-dim': '#a82832',
    '--danger': '#ff4444',
    '--tab-active-bg': '#1a1e28',
    '--tab-inactive-bg': '#0c0e12',
    '--scrollbar': '#343b4a',
    '--radius': '8px',
  },
  xterm: {
    background: '#0c0e12',
    foreground: '#d8dde6',
    cursor: '#ff465a',
    cursorAccent: '#0c0e12',
    selectionBackground: '#e6394633',
    selectionForeground: '#ffffff',
    black: '#171b22',
    red: '#ff465a',
    green: '#62d98f',
    yellow: '#f0c35b',
    blue: '#7aa7ff',
    magenta: '#b48cff',
    cyan: '#72d9ff',
    white: '#e2e6ed',
    brightBlack: '#4a5260',
    brightRed: '#ff7c8a',
    brightGreen: '#98efbc',
    brightYellow: '#f8dd7d',
    brightBlue: '#adc8ff',
    brightMagenta: '#d4bbff',
    brightCyan: '#9be9ff',
    brightWhite: '#ffffff',
  },
}

/** Avatar — bioluminiscencia de Pandora */
const avatar: AppTheme = {
  id: 'avatar',
  name: 'Avatar',
  vars: {
    '--bg': '#050a12',
    '--bg-secondary': '#081018',
    '--surface': '#0c1824',
    '--surface-hover': '#122030',
    '--border': '#1a3048',
    '--text': '#c8e8f0',
    '--text-muted': '#5080a0',
    '--accent': '#48d4e8',
    '--accent-dim': '#2890a8',
    '--danger': '#ff6b8a',
    '--tab-active-bg': '#0c1824',
    '--tab-inactive-bg': '#050a12',
    '--scrollbar': '#1a3048',
    '--radius': '8px',
  },
  xterm: {
    background: '#050a12',
    foreground: '#c5f3ff',
    cursor: '#48d4e8',
    cursorAccent: '#050a12',
    selectionBackground: '#48d4e83a',
    selectionForeground: '#f1fdff',
    black: '#0a1520',
    red: '#ff78a0',
    green: '#5bffaf',
    yellow: '#efe07a',
    blue: '#818cf8',
    magenta: '#e879f9',
    cyan: '#34d399',
    white: '#d6f5ff',
    brightBlack: '#315a7d',
    brightRed: '#ffadc1',
    brightGreen: '#98ffca',
    brightYellow: '#fff0aa',
    brightBlue: '#a5b4fc',
    brightMagenta: '#f0abfc',
    brightCyan: '#6ee7b7',
    brightWhite: '#ffffff',
  },
}

/** Zelda — Breath of the Wild: Hyrule profundo — cielo, poder Sheikah, bosque y tierra */
const zeldaDeepWoods: AppTheme = {
  id: 'zeldaDeepWoods',
  name: 'Zelda — Breath of the Wild',
  vars: {
    '--bg': '#061018',
    '--bg-secondary': '#0b1a20',
    '--surface': '#12231b',
    '--surface-hover': '#1c3325',
    '--border': '#6a5132',
    '--text': '#f0ead8',
    '--text-muted': '#9da78a',
    '--accent': '#4fd8e8',
    '--accent-dim': '#2f8fb0',
    '--danger': '#e34b5f',
    '--tab-active-bg': '#142722',
    '--tab-inactive-bg': '#061018',
    '--scrollbar': '#6a5132',
    '--radius': '10px',
  },
  xterm: {
    background: '#061018',
    foreground: '#f0ead8',
    cursor: '#4fd8e8',
    cursorAccent: '#061018',
    selectionBackground: '#4fd8e83d',
    selectionForeground: '#fff8e8',
    black: '#0b1716',
    red: '#e34b5f',
    green: '#5fbe55',
    yellow: '#d6a94a',
    blue: '#58a6ff',
    magenta: '#a68cff',
    cyan: '#4fd8e8',
    white: '#f0ead8',
    brightBlack: '#6f674f',
    brightRed: '#ff7a86',
    brightGreen: '#8ee070',
    brightYellow: '#f1ca6b',
    brightBlue: '#86c8ff',
    brightMagenta: '#c2adff',
    brightCyan: '#86f0f2',
    brightWhite: '#fff8e8',
  },
}

// ---------------------------------------------------------------------------
// Cinematic light — contraparte clara de cada tema cinematic
// ---------------------------------------------------------------------------

/** Tokyo Night Day — variante diurna de Tokyo Night */
const tokyoNightDay: AppTheme = {
  id: 'tokyoNightDay',
  name: 'Tokyo Night Day',
  appearance: 'light',
  vars: {
    '--bg': '#f6f7fb',
    '--bg-secondary': '#eceef5',
    '--surface': '#e5e8f2',
    '--surface-hover': '#d9ddec',
    '--border': '#c3cade',
    '--text': '#3760bf',
    '--text-muted': '#7981a7',
    '--accent': '#2e7de9',
    '--accent-dim': '#2662c0',
    '--danger': '#f52a65',
    '--tab-active-bg': '#e5e8f2',
    '--tab-inactive-bg': '#f6f7fb',
    '--scrollbar': '#c3cade',
    '--radius': '8px',
  },
  xterm: {
    background: '#f6f7fb',
    foreground: '#3760bf',
    cursor: '#2e7de9',
    cursorAccent: '#f6f7fb',
    selectionBackground: '#2e7de92e',
    selectionForeground: '#3760bf',
    black: '#b4b5b9',
    red: '#f52a65',
    green: '#587539',
    yellow: '#8c6c3e',
    blue: '#7c3aed',
    magenta: '#db2777',
    cyan: '#0d9488',
    white: '#6172b0',
    brightBlack: '#a1a6c5',
    brightRed: '#ff4774',
    brightGreen: '#5c8524',
    brightYellow: '#a27629',
    brightBlue: '#8b5cf6',
    brightMagenta: '#e11d8f',
    brightCyan: '#0f766e',
    brightWhite: '#3760bf',
  },
}

/** Matrix Light — código verde sobre papel fosforescente */
const matrixLight: AppTheme = {
  id: 'matrixLight',
  name: 'Matrix Light',
  appearance: 'light',
  vars: {
    '--bg': '#f8fdf9',
    '--bg-secondary': '#eef8f1',
    '--surface': '#e5f3e9',
    '--surface-hover': '#d7ecdd',
    '--border': '#b8dcc4',
    '--text': '#0e3d20',
    '--text-muted': '#54876a',
    '--accent': '#00a344',
    '--accent-dim': '#007a33',
    '--danger': '#d23f3f',
    '--tab-active-bg': '#e5f3e9',
    '--tab-inactive-bg': '#f8fdf9',
    '--scrollbar': '#b8dcc4',
    '--radius': '8px',
  },
  xterm: {
    background: '#f8fdf9',
    foreground: '#155c2e',
    cursor: '#00a344',
    cursorAccent: '#f8fdf9',
    selectionBackground: '#00a34426',
    selectionForeground: '#0a2e17',
    black: '#0e3d20',
    red: '#c42d4a',
    green: '#00a344',
    yellow: '#7a8f14',
    blue: '#1a6dcc',
    magenta: '#8a3db8',
    cyan: '#0d8a7a',
    white: '#b4dcc1',
    brightBlack: '#4a7a5c',
    brightRed: '#a0243c',
    brightGreen: '#007a33',
    brightYellow: '#627312',
    brightBlue: '#1557a3',
    brightMagenta: '#6f3094',
    brightCyan: '#0a6e62',
    brightWhite: '#0a2e17',
  },
}

/** Interstellar Light — polvo estelar de día y dorado NASA */
const interstellarLight: AppTheme = {
  id: 'interstellarLight',
  name: 'Interstellar Light',
  appearance: 'light',
  vars: {
    '--bg': '#fafbfd',
    '--bg-secondary': '#f0f3f8',
    '--surface': '#e8ecf3',
    '--surface-hover': '#dce2ec',
    '--border': '#c4cfde',
    '--text': '#2a3446',
    '--text-muted': '#71809a',
    '--accent': '#a87c22',
    '--accent-dim': '#866118',
    '--danger': '#c74a3c',
    '--tab-active-bg': '#e8ecf3',
    '--tab-inactive-bg': '#fafbfd',
    '--scrollbar': '#c4cfde',
    '--radius': '8px',
  },
  xterm: {
    background: '#fafbfd',
    foreground: '#2a3446',
    cursor: '#a87c22',
    cursorAccent: '#fafbfd',
    selectionBackground: '#3d6eb529',
    selectionForeground: '#1e2635',
    black: '#2a3446',
    red: '#c74a3c',
    green: '#4e7d5c',
    yellow: '#a87c22',
    blue: '#3766b8',
    magenta: '#6d5da8',
    cyan: '#357e99',
    white: '#bcc8da',
    brightBlack: '#5d6a82',
    brightRed: '#a53a2e',
    brightGreen: '#3f664b',
    brightYellow: '#866118',
    brightBlue: '#2c5296',
    brightMagenta: '#584b8a',
    brightCyan: '#2a657c',
    brightWhite: '#1e2635',
  },
}

/** Cyberpunk 2077 Light — Night City a plena luz */
const cyberpunkLight: AppTheme = {
  id: 'cyberpunkLight',
  name: 'Cyberpunk 2077 Light',
  appearance: 'light',
  vars: {
    '--bg': '#fbfcfe',
    '--bg-secondary': '#f2f4fa',
    '--surface': '#eaedf6',
    '--surface-hover': '#dee3f0',
    '--border': '#c8d1e2',
    '--text': '#232c40',
    '--text-muted': '#6b7c9c',
    '--accent': '#b8a300',
    '--accent-dim': '#8f7f00',
    '--danger': '#e0195a',
    '--tab-active-bg': '#eaedf6',
    '--tab-inactive-bg': '#fbfcfe',
    '--scrollbar': '#c8d1e2',
    '--radius': '8px',
  },
  xterm: {
    background: '#fbfcfe',
    foreground: '#232c40',
    cursor: '#b8a300',
    cursorAccent: '#fbfcfe',
    selectionBackground: '#c928a833',
    selectionForeground: '#181f30',
    black: '#232c40',
    red: '#e0195a',
    green: '#00915c',
    yellow: '#9c8a00',
    blue: '#0072c2',
    magenta: '#c928a8',
    cyan: '#008ba3',
    white: '#c0cade',
    brightBlack: '#54648a',
    brightRed: '#b81249',
    brightGreen: '#00774b',
    brightYellow: '#7d6e00',
    brightBlue: '#005c9e',
    brightMagenta: '#a61f8a',
    brightCyan: '#007086',
    brightWhite: '#181f30',
  },
}

/** Cyberpunk Neon Light — magenta y cian sobre blanco lavanda */
const cyberpunkNeonLight: AppTheme = {
  id: 'cyberpunkNeonLight',
  name: 'Cyberpunk Neon Light',
  appearance: 'light',
  vars: {
    '--bg': '#fcfafe',
    '--bg-secondary': '#f5f0fa',
    '--surface': '#ede5f6',
    '--surface-hover': '#e3d8f0',
    '--border': '#d0c1e5',
    '--text': '#2c2340',
    '--text-muted': '#7d6f9c',
    '--accent': '#d323ab',
    '--accent-dim': '#a81a87',
    '--danger': '#d9434a',
    '--tab-active-bg': '#ede5f6',
    '--tab-inactive-bg': '#fcfafe',
    '--scrollbar': '#d0c1e5',
    '--radius': '10px',
  },
  xterm: {
    background: '#fcfafe',
    foreground: '#2c2340',
    cursor: '#00a3b8',
    cursorAccent: '#fcfafe',
    selectionBackground: '#00a3b829',
    selectionForeground: '#1f1830',
    black: '#2c2340',
    red: '#d9434a',
    green: '#00996f',
    yellow: '#a3841a',
    blue: '#2d6ec9',
    magenta: '#9b2fd4',
    cyan: '#00a3b8',
    white: '#c9b8e0',
    brightBlack: '#63548a',
    brightRed: '#b3363c',
    brightGreen: '#007d5b',
    brightYellow: '#856b14',
    brightBlue: '#2458a3',
    brightMagenta: '#7a24a8',
    brightCyan: '#008596',
    brightWhite: '#1f1830',
  },
}

/** TRON Light — rejilla cian sobre blanco electrónico */
const tronLight: AppTheme = {
  id: 'tronLight',
  name: 'TRON Light',
  appearance: 'light',
  vars: {
    '--bg': '#f9fcfd',
    '--bg-secondary': '#eef5f9',
    '--surface': '#e4eef4',
    '--surface-hover': '#d6e4ee',
    '--border': '#bad0e0',
    '--text': '#1c2c3a',
    '--text-muted': '#6684a0',
    '--accent': '#0090b8',
    '--accent-dim': '#00718f',
    '--danger': '#d92955',
    '--tab-active-bg': '#e4eef4',
    '--tab-inactive-bg': '#f9fcfd',
    '--scrollbar': '#bad0e0',
    '--radius': '6px',
  },
  xterm: {
    background: '#f9fcfd',
    foreground: '#1c2c3a',
    cursor: '#0090b8',
    cursorAccent: '#f9fcfd',
    selectionBackground: '#0090b82b',
    selectionForeground: '#13202b',
    black: '#1c2c3a',
    red: '#d92955',
    green: '#00947c',
    yellow: '#9c8a1d',
    blue: '#818cf8',
    magenta: '#e879f9',
    cyan: '#2dd4bf',
    white: '#b4cbdc',
    brightBlack: '#4c6880',
    brightRed: '#b32146',
    brightGreen: '#007a66',
    brightYellow: '#7f7017',
    brightBlue: '#a5b4fc',
    brightMagenta: '#f0abfc',
    brightCyan: '#5eead4',
    brightWhite: '#13202b',
  },
}

/** Blade Runner 2049 Light — neblina naranja y teal de día */
const bladeRunnerLight: AppTheme = {
  id: 'bladeRunnerLight',
  name: 'Blade Runner 2049 Light',
  appearance: 'light',
  vars: {
    '--bg': '#fdfaf6',
    '--bg-secondary': '#f7f0e8',
    '--surface': '#f1e8dc',
    '--surface-hover': '#e8dbc9',
    '--border': '#d8c6ae',
    '--text': '#3c3040',
    '--text-muted': '#877790',
    '--accent': '#d97e08',
    '--accent-dim': '#b06506',
    '--danger': '#d93b5c',
    '--tab-active-bg': '#f1e8dc',
    '--tab-inactive-bg': '#fdfaf6',
    '--scrollbar': '#d8c6ae',
    '--radius': '8px',
  },
  xterm: {
    background: '#fdfaf6',
    foreground: '#3c3040',
    cursor: '#1a9c8f',
    cursorAccent: '#fdfaf6',
    selectionBackground: '#d97e0829',
    selectionForeground: '#2c2330',
    black: '#3c3040',
    red: '#d93b5c',
    green: '#1a9c8f',
    yellow: '#d97e08',
    blue: '#4b5cc9',
    magenta: '#9a4bc9',
    cyan: '#1a9c8f',
    white: '#d1bda6',
    brightBlack: '#6e5f78',
    brightRed: '#b32f4c',
    brightGreen: '#158076',
    brightYellow: '#b06506',
    brightBlue: '#3c4aa8',
    brightMagenta: '#7f3ca6',
    brightCyan: '#158076',
    brightWhite: '#2c2330',
  },
}

/** Stranger Things Light — Hawkins de día (rojo y púrpura) */
const strangerThingsLight: AppTheme = {
  id: 'strangerThingsLight',
  name: 'Stranger Things Light',
  appearance: 'light',
  vars: {
    '--bg': '#fcf9fd',
    '--bg-secondary': '#f5edf8',
    '--surface': '#eee1f2',
    '--surface-hover': '#e4d2eb',
    '--border': '#d1badd',
    '--text': '#31203f',
    '--text-muted': '#83699c',
    '--accent': '#c1121f',
    '--accent-dim': '#8a0e18',
    '--danger': '#d92b2b',
    '--tab-active-bg': '#eee1f2',
    '--tab-inactive-bg': '#fcf9fd',
    '--scrollbar': '#d1badd',
    '--radius': '8px',
  },
  xterm: {
    background: '#fcf9fd',
    foreground: '#31203f',
    cursor: '#c1121f',
    cursorAccent: '#fcf9fd',
    selectionBackground: '#c1121f24',
    selectionForeground: '#241730',
    black: '#31203f',
    red: '#c1121f',
    green: '#5a45d1',
    yellow: '#c26a1d',
    blue: '#3d51c9',
    magenta: '#c92384',
    cyan: '#2385ab',
    white: '#c8aed6',
    brightBlack: '#664e80',
    brightRed: '#9c0f1a',
    brightGreen: '#4837ab',
    brightYellow: '#9e5617',
    brightBlue: '#3242a3',
    brightMagenta: '#a61c6d',
    brightCyan: '#1c6c8a',
    brightWhite: '#241730',
  },
}

/** Fallout Light — Pip-Boy sobre sepia soleado */
const falloutLight: AppTheme = {
  id: 'falloutLight',
  name: 'Fallout Light',
  appearance: 'light',
  vars: {
    '--bg': '#fbfcf2',
    '--bg-secondary': '#f2f6e2',
    '--surface': '#eaf0d4',
    '--surface-hover': '#dee7c2',
    '--border': '#c8d6a2',
    '--text': '#2c3a14',
    '--text-muted': '#75855a',
    '--accent': '#2a9d0e',
    '--accent-dim': '#1f780a',
    '--danger': '#d95a26',
    '--tab-active-bg': '#eaf0d4',
    '--tab-inactive-bg': '#fbfcf2',
    '--scrollbar': '#c8d6a2',
    '--radius': '6px',
  },
  xterm: {
    background: '#fbfcf2',
    foreground: '#2c3a14',
    cursor: '#2a9d0e',
    cursorAccent: '#fbfcf2',
    selectionBackground: '#2a9d0e26',
    selectionForeground: '#212c0e',
    black: '#2c3a14',
    red: '#d95a26',
    green: '#2a9d0e',
    yellow: '#a3921a',
    blue: '#2f6fb0',
    magenta: '#8a4fc4',
    cyan: '#1a8a9c',
    white: '#bece97',
    brightBlack: '#5c6b40',
    brightRed: '#b3491e',
    brightGreen: '#21800b',
    brightYellow: '#857715',
    brightBlue: '#255a8f',
    brightMagenta: '#6f3f9e',
    brightCyan: '#15707e',
    brightWhite: '#212c0e',
  },
}

/** Star Wars Light — hangar rebelde a plena luz */
const starWarsLight: AppTheme = {
  id: 'starWarsLight',
  name: 'Star Wars Light',
  appearance: 'light',
  vars: {
    '--bg': '#fafbfc',
    '--bg-secondary': '#f0f2f6',
    '--surface': '#e7ebf1',
    '--surface-hover': '#dae1e9',
    '--border': '#c2cdd9',
    '--text': '#252c38',
    '--text-muted': '#6e7c8e',
    '--accent': '#c22d3a',
    '--accent-dim': '#99232e',
    '--danger': '#d92b2b',
    '--tab-active-bg': '#e7ebf1',
    '--tab-inactive-bg': '#fafbfc',
    '--scrollbar': '#c2cdd9',
    '--radius': '8px',
  },
  xterm: {
    background: '#fafbfc',
    foreground: '#252c38',
    cursor: '#c22d3a',
    cursorAccent: '#fafbfc',
    selectionBackground: '#c22d3a24',
    selectionForeground: '#1b212b',
    black: '#252c38',
    red: '#c22d3a',
    green: '#2a8a55',
    yellow: '#a3821c',
    blue: '#3468c9',
    magenta: '#7350c9',
    cyan: '#2385a8',
    white: '#bac6d4',
    brightBlack: '#586678',
    brightRed: '#9e2530',
    brightGreen: '#227046',
    brightYellow: '#856a17',
    brightBlue: '#2a54a3',
    brightMagenta: '#5e41a6',
    brightCyan: '#1c6c88',
    brightWhite: '#1b212b',
  },
}

/** Avatar Light — Pandora a la luz de Alpha Centauri */
const avatarLight: AppTheme = {
  id: 'avatarLight',
  name: 'Avatar Light',
  appearance: 'light',
  vars: {
    '--bg': '#f7fcfe',
    '--bg-secondary': '#eaf6fa',
    '--surface': '#def0f6',
    '--surface-hover': '#cde7f0',
    '--border': '#aed4e1',
    '--text': '#153542',
    '--text-muted': '#5b8496',
    '--accent': '#0e9cb4',
    '--accent-dim': '#0b7c90',
    '--danger': '#d9436b',
    '--tab-active-bg': '#def0f6',
    '--tab-inactive-bg': '#f7fcfe',
    '--scrollbar': '#aed4e1',
    '--radius': '8px',
  },
  xterm: {
    background: '#f7fcfe',
    foreground: '#153542',
    cursor: '#0e9cb4',
    cursorAccent: '#f7fcfe',
    selectionBackground: '#0e9cb429',
    selectionForeground: '#0f2833',
    black: '#153542',
    red: '#d9436b',
    green: '#009e63',
    yellow: '#9c8a1d',
    blue: '#6366f1',
    magenta: '#c026d3',
    cyan: '#0d9488',
    white: '#a4cfdd',
    brightBlack: '#456e80',
    brightRed: '#b3375a',
    brightGreen: '#008252',
    brightYellow: '#7f7017',
    brightBlue: '#818cf8',
    brightMagenta: '#e879f9',
    brightCyan: '#14b8a6',
    brightWhite: '#0f2833',
  },
}

/** Zelda — Breath of the Wild Light: campo al sol — hierba, silent princess, oro */
const zeldaDeepWoodsLight: AppTheme = {
  id: 'zeldaDeepWoodsLight',
  name: 'Zelda — Breath of the Wild Light',
  appearance: 'light',
  vars: {
    '--bg': '#f5f6e8',
    '--bg-secondary': '#e8edd8',
    '--surface': '#d8e4c4',
    '--surface-hover': '#c8d8a8',
    /* Toques dorados (no solo verde). */
    '--border': '#c4a86a',
    '--text': '#1a2e1c',
    '--text-muted': '#5a7050',
    /* Silent princess: azul-lila suave. */
    '--accent': '#5c6bc4',
    '--accent-dim': '#3f4a9a',
    '--danger': '#c23030',
    '--tab-active-bg': '#cce0b0',
    '--tab-inactive-bg': '#f5f6e8',
    '--scrollbar': '#b8a060',
    '--radius': '10px',
  },
  xterm: {
    background: '#f5f6e8',
    foreground: '#1a2e1c',
    cursor: '#5c6bc4',
    cursorAccent: '#f5f6e8',
    selectionBackground: '#5c6bc42e',
    selectionForeground: '#0e1a14',
    black: '#1a2e1c',
    red: '#c23030',
    green: '#1e8a3e',
    yellow: '#b8860e',
    blue: '#2a6fa0',
    magenta: '#9a60b0',
    cyan: '#2a8a88',
    white: '#8aaa80',
    brightBlack: '#3d5a48',
    brightRed: '#9e2424',
    brightGreen: '#186e32',
    brightYellow: '#946c0a',
    brightBlue: '#225a82',
    brightMagenta: '#7a488c',
    brightCyan: '#226e6c',
    brightWhite: '#0e1a14',
  },
}

export const THEMES: AppTheme[] = [
  // Cinematic — dark
  tokyoNight,
  matrix,
  interstellar,
  cyberpunk,
  cyberpunkNeon,
  tron,
  bladeRunner,
  strangerThings,
  fallout,
  starWars,
  avatar,
  zeldaDeepWoods,
  // Cinematic — light, espejo del orden de sus contrapartes oscuras
  tokyoNightDay,
  matrixLight,
  interstellarLight,
  cyberpunkLight,
  cyberpunkNeonLight,
  tronLight,
  bladeRunnerLight,
  strangerThingsLight,
  falloutLight,
  starWarsLight,
  avatarLight,
  zeldaDeepWoodsLight,
]

export function getTheme(id: string): AppTheme {
  return THEMES.find(t => t.id === id) ?? tokyoNight
}

const THEME_CHROME_PROFILES: Record<string, ThemeChromeProfile> = {
  tokyoNight: { category: 'glow', tabShape: 'square', glowMultiplier: 1.35, panelRadius: '10px' },
  matrix: { category: 'glow', tabShape: 'square', glowMultiplier: 1.65, panelRadius: '8px' },
  interstellar: { category: 'glow', tabShape: 'square', glowMultiplier: 1.28, panelRadius: '10px' },
  cyberpunk: { category: 'glow', tabShape: 'square', glowMultiplier: 1.95, panelRadius: '10px' },
  cyberpunkNeon: { category: 'glow', tabShape: 'square', glowMultiplier: 2.25, panelRadius: '12px' },
  tron: { category: 'glow', tabShape: 'square', glowMultiplier: 2.0, panelRadius: '8px' },
  bladeRunner: { category: 'glow', tabShape: 'square', glowMultiplier: 1.65, panelRadius: '10px' },
  strangerThings: { category: 'glow', tabShape: 'square', glowMultiplier: 1.8, panelRadius: '12px' },
  fallout: { category: 'glow', tabShape: 'square', glowMultiplier: 1.55, panelRadius: '8px' },
  starWars: { category: 'glow', tabShape: 'square', glowMultiplier: 1.45, panelRadius: '8px' },
  avatar: { category: 'glow', tabShape: 'square', glowMultiplier: 1.6, panelRadius: '14px' },
  zeldaDeepWoods: { category: 'glow', tabShape: 'square', glowMultiplier: 1.65, panelRadius: '14px' },
  // Lights: mismo carácter glow con intensidad reducida para fondos claros
  tokyoNightDay: { category: 'glow', tabShape: 'square', glowMultiplier: 1.0, panelRadius: '10px' },
  matrixLight: { category: 'glow', tabShape: 'square', glowMultiplier: 1.15, panelRadius: '8px' },
  interstellarLight: { category: 'glow', tabShape: 'square', glowMultiplier: 0.95, panelRadius: '10px' },
  cyberpunkLight: { category: 'glow', tabShape: 'square', glowMultiplier: 1.3, panelRadius: '10px' },
  cyberpunkNeonLight: { category: 'glow', tabShape: 'square', glowMultiplier: 1.4, panelRadius: '12px' },
  tronLight: { category: 'glow', tabShape: 'square', glowMultiplier: 1.35, panelRadius: '8px' },
  bladeRunnerLight: { category: 'glow', tabShape: 'square', glowMultiplier: 1.15, panelRadius: '10px' },
  strangerThingsLight: { category: 'glow', tabShape: 'square', glowMultiplier: 1.2, panelRadius: '12px' },
  falloutLight: { category: 'glow', tabShape: 'square', glowMultiplier: 1.1, panelRadius: '8px' },
  starWarsLight: { category: 'glow', tabShape: 'square', glowMultiplier: 1.05, panelRadius: '8px' },
  avatarLight: { category: 'glow', tabShape: 'square', glowMultiplier: 1.15, panelRadius: '14px' },
  zeldaDeepWoodsLight: { category: 'glow', tabShape: 'square', glowMultiplier: 1.1, panelRadius: '14px' },
}

export function getThemeChromeProfile(theme: AppTheme | string): ThemeChromeProfile {
  const id = typeof theme === 'string' ? theme : theme.id
  return THEME_CHROME_PROFILES[id] ?? {
    category: 'regular',
    tabShape: 'square',
    glowMultiplier: 1,
    panelRadius: '10px',
  }
}

/** Normaliza `themeId` persistido si apunta a un tema ya eliminado. */
export function normalizeThemeId(id: string): string {
  return THEMES.some(t => t.id === id) ? id : tokyoNight.id
}

function isLightTheme(t: AppTheme): boolean {
  return t.appearance === 'light'
}

/**
 * Temas del picker: oscuros primero y claros después
 * (separador visual entre grupos en el modal).
 */
export function getThemesForPicker(): AppTheme[] {
  const dark = THEMES.filter(t => !isLightTheme(t))
  const light = THEMES.filter(t => isLightTheme(t))
  return [...dark, ...light]
}

/** RGB 0–255 desde `#rgb` o `#rrggbb`; `null` si no es hex válido. */
function parseHexAccent(s: string): [number, number, number] | null {
  const t = s.trim()
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(t)
  if (!m) return null
  let h = m[1]
  if (h.length === 3) h = h.split('').map(c => c + c).join('')
  const n = parseInt(h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function rgba([r, g, b]: [number, number, number], alpha: number): string {
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function scaledAlpha(base: number, multiplier: number, max = 0.55): number {
  return Math.min(max, Number((base * multiplier).toFixed(3)))
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const lin = (v: number): number => {
    const x = v / 255
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
  }
  const R = lin(r)
  const G = lin(g)
  const B = lin(b)
  return 0.2126 * R + 0.7152 * G + 0.0722 * B
}

function contrastRatio(lumA: number, lumB: number): number {
  const hi = Math.max(lumA, lumB)
  const lo = Math.min(lumA, lumB)
  return (hi + 0.05) / (lo + 0.05)
}

const ACCENT_FG_CANDIDATES: ReadonlyArray<[[number, number, number], string]> = [
  [[255, 255, 255], '#f7f7fc'],
  [[12, 12, 14], '#0c0c0e'],
]

/**
 * Color de texto legible sobre `--accent` (WCAG: elige blanco u oscuro con mayor ratio de contraste).
 */
function accentForegroundFor(accentCss: string): string {
  const rgb = parseHexAccent(accentCss)
  if (!rgb) return '#f7f7fc'
  const L = relativeLuminance(rgb)
  let best = '#f7f7fc'
  let bestRatio = 0
  for (const [candRgb, hex] of ACCENT_FG_CANDIDATES) {
    const r = contrastRatio(L, relativeLuminance(candRgb))
    if (r > bestRatio) {
      bestRatio = r
      best = hex
    }
  }
  return best
}

/**
 * Acento oscurecido lo justo para que el texto blanco pase 4.5:1 (WCAG AA).
 * En los temas light el acento suele ser demasiado claro para texto blanco
 * (avatarLight: 3.1:1), y la etiqueta oscura que gana por contraste se lee mal
 * en botones sólidos. Mezcla hacia `#0c0c0e` en pasos del 5%.
 */
function accentForWhiteText(accentCss: string): string {
  const rgb = parseHexAccent(accentCss)
  if (!rgb) return accentCss
  const whiteLum = relativeLuminance([247, 247, 252]) // el `#f7f7fc` real de la etiqueta
  let mix = rgb
  for (let p = 1; p > 0.3; p -= 0.05) {
    mix = [
      Math.round(rgb[0] * p + 12 * (1 - p)),
      Math.round(rgb[1] * p + 12 * (1 - p)),
      Math.round(rgb[2] * p + 14 * (1 - p)),
    ]
    if (contrastRatio(relativeLuminance(mix), whiteLum) >= 4.5) break
  }
  return `#${mix.map(v => v.toString(16).padStart(2, '0')).join('')}`
}

export function applyTheme(theme: AppTheme): void {
  const root = document.documentElement
  const chrome = getThemeChromeProfile(theme)
  root.dataset.theme = theme.id
  root.dataset.themeCategory = chrome.category
  root.dataset.tabShape = chrome.tabShape
  root.dataset.themeAppearance = isLightTheme(theme) ? 'light' : 'dark'
  for (const [key, value] of Object.entries(theme.vars)) {
    root.style.setProperty(key, value)
  }
  root.style.setProperty('--panel-radius', chrome.panelRadius ?? theme.vars['--radius'] ?? '8px')

  const accent = theme.vars['--accent'] ?? theme.xterm.cursor
  root.style.setProperty('--accent-fg', accentForegroundFor(accent))

  // Botones sólidos: en light se oscurece el acento para llevar etiqueta blanca;
  // en dark el acento neón con etiqueta oscura ya es legible y se deja igual.
  const solidAccent = isLightTheme(theme) ? accentForWhiteText(accent) : accent
  root.style.setProperty('--accent-solid', solidAccent)
  root.style.setProperty('--accent-solid-fg', accentForegroundFor(solidAccent))

  // Estado pressed (toolbars): mismo tratamiento sobre --accent-dim. No se puede
  // reescribir --accent-dim porque también alimenta gradientes y auroras del plano.
  const dimAccent = theme.vars['--accent-dim'] ?? accent
  const pressedAccent = isLightTheme(theme) ? accentForWhiteText(dimAccent) : dimAccent
  root.style.setProperty('--accent-pressed', pressedAccent)
  root.style.setProperty('--accent-pressed-fg', accentForegroundFor(pressedAccent))

  // FAB terminal: contraste sobre el acento teal del plano (mezcla con accent).
  const terminalAccent = theme.vars['--plane-terminal-accent']
    ?? theme.vars['--accent']
    ?? '#2dd4bf'
  const terminalAccentHex = parseHexAccent(terminalAccent)
    ? terminalAccent
    : '#2dd4bf'
  root.style.setProperty('--plane-terminal-fg', accentForegroundFor(terminalAccentHex))

  const accentRgb = parseHexAccent(accent)
  if (accentRgb) {
    const glow = chrome.glowMultiplier
    root.style.setProperty('--accent-rgb', `${accentRgb[0]} ${accentRgb[1]} ${accentRgb[2]}`)
    root.style.setProperty('--accent-veil', rgba(accentRgb, scaledAlpha(0.08, glow, 0.28)))
    root.style.setProperty('--accent-veil-strong', rgba(accentRgb, scaledAlpha(0.14, glow, 0.34)))
    root.style.setProperty('--accent-glow-soft', rgba(accentRgb, scaledAlpha(0.12, glow, 0.3)))
    root.style.setProperty('--accent-glow', rgba(accentRgb, scaledAlpha(0.18, glow, 0.42)))
    root.style.setProperty('--accent-glow-strong', rgba(accentRgb, scaledAlpha(0.3, glow, 0.58)))
    root.style.setProperty('--accent-border-soft', rgba(accentRgb, scaledAlpha(0.24, glow, 0.42)))
    root.style.setProperty('--accent-border-strong', rgba(accentRgb, scaledAlpha(0.52, glow, 0.68)))

    // Plano HUD: intensidad de rejilla/glow alineada al chrome del tema
    root.style.setProperty('--plane-grid-opacity', String(Math.min(0.16, Number((0.08 * glow).toFixed(3)))))
    root.style.setProperty('--plane-atmosphere-a', rgba(accentRgb, scaledAlpha(0.16, glow, 0.36)))
    root.style.setProperty('--plane-atmosphere-b', rgba(accentRgb, scaledAlpha(0.07, glow, 0.22)))
    root.style.setProperty('--plane-glow', rgba(accentRgb, scaledAlpha(0.2, glow, 0.48)))
    root.style.setProperty('--plane-glow-strong', rgba(accentRgb, scaledAlpha(0.34, glow, 0.62)))
  }

  root.style.setProperty(
    '--plane-radius',
    chrome.panelRadius ?? theme.vars['--radius'] ?? '14px',
  )

  // Acentos secundarios del tema (aurora / HUD) desde la paleta xterm.
  root.style.setProperty('--theme-blue', theme.xterm.blue)
  root.style.setProperty('--theme-magenta', theme.xterm.magenta)
  root.style.setProperty('--theme-cyan', theme.xterm.cyan)

  // El splash de index.html pinta antes de que exista la config, así que deja
  // aquí las vars que necesita (chrome + las que usa Gravity.css): sin esto sale
  // oscuro aunque el tema activo sea claro.
  try {
    localStorage.setItem(SPLASH_VARS_KEY, JSON.stringify({
      '--bg': theme.vars['--bg'] ?? '#0d0d14',
      '--bg-secondary': theme.vars['--bg-secondary'] ?? theme.vars['--surface'] ?? '#13131e',
      '--text-muted': theme.vars['--text-muted'] ?? '#7878a8',
      '--accent': accent,
      '--theme-blue': theme.xterm.blue,
      '--theme-magenta': theme.xterm.magenta,
      '--theme-cyan': theme.xterm.cyan,
    }))
  } catch { /* modo privado / storage lleno: el splash usa sus defaults */ }
}

/** Lo lee el script inline de `index.html`. Cambiarlo aquí exige cambiarlo allí. */
export const SPLASH_VARS_KEY = 'splashThemeVars'
