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
  /** Familia del picker; sin valor cae en `cinematic`, que es el grueso. */
  family?: 'cinematic' | 'credicorp'
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
    '--bg': '#0e0e14',
    '--bg-secondary': '#0c0c10',
    '--surface': '#13151f',
    '--surface-hover': '#191c26',
    '--border': '#3b4261',
    '--text': '#c0caf5',
    '--text-muted': '#6772a4',
    '--accent': '#89b4fa',
    '--accent-dim': '#4568c4',
    '--danger': '#f7768e',
    '--tab-active-bg': '#13151f',
    '--tab-inactive-bg': '#0e0e14',
    '--scrollbar': '#3b4261',
    '--radius': '8px',
  },
  xterm: {
    background: '#0e0e14',
    foreground: '#a9b1d6',
    cursor: '#89b4fa',
    cursorAccent: '#0e0e14',
    selectionBackground: '#4568c455',
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
    '--bg': '#020302',
    '--bg-secondary': '#030704',
    '--surface': '#070c08',
    '--surface-hover': '#0a110c',
    '--border': '#1a3322',
    '--text': '#c8ffc8',
    '--text-muted': '#4a7a55',
    '--accent': '#00ff66',
    '--accent-dim': '#009944',
    '--danger': '#ff4444',
    '--tab-active-bg': '#070c08',
    '--tab-inactive-bg': '#020302',
    '--scrollbar': '#1a3322',
    '--radius': '8px',
  },
  xterm: {
    background: '#020302',
    foreground: '#86ff9f',
    cursor: '#00ff66',
    cursorAccent: '#020302',
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
    '--bg': '#030508',
    '--bg-secondary': '#05070c',
    '--surface': '#090c12',
    '--surface-hover': '#0d111a',
    '--border': '#222a3c',
    '--text': '#c4cedc',
    '--text-muted': '#5a6578',
    '--accent': '#d4a84b',
    '--accent-dim': '#9a7630',
    '--danger': '#e85d4c',
    '--tab-active-bg': '#090c12',
    '--tab-inactive-bg': '#030508',
    '--scrollbar': '#222a3c',
    '--radius': '8px',
  },
  xterm: {
    background: '#030508',
    foreground: '#c8d3e6',
    cursor: '#d4a84b',
    cursorAccent: '#030508',
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


/** Cyberpunk Neon — más magenta/cian para paneles y chrome, sin tocar la idea base del terminal. */
const cyberpunkNeon: AppTheme = {
  id: 'cyberpunkNeon',
  name: 'Cyberpunk Neon',
  vars: {
    '--bg': '#05050c',
    '--bg-secondary': '#080711',
    '--surface': '#0d0a19',
    '--surface-hover': '#110d22',
    '--border': '#3a2d68',
    '--text': '#f4ecff',
    '--text-muted': '#9a8fbe',
    '--accent': '#ff4fd8',
    '--accent-dim': '#b83297',
    '--danger': '#ff5a5f',
    '--tab-active-bg': '#0d0a19',
    '--tab-inactive-bg': '#05050c',
    '--scrollbar': '#3a2d68',
    '--radius': '10px',
  },
  xterm: {
    background: '#05050c',
    foreground: '#e9fbff',
    cursor: '#00f0ff',
    cursorAccent: '#05050c',
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
    '--bg': '#030305',
    '--bg-secondary': '#07080c',
    '--surface': '#0a0c10',
    '--surface-hover': '#0e1117',
    '--border': '#1e2838',
    '--text': '#dff6ff',
    '--text-muted': '#5a7a9a',
    '--accent': '#00d4ff',
    '--accent-dim': '#0090b8',
    '--danger': '#ff3366',
    '--tab-active-bg': '#0a0c10',
    '--tab-inactive-bg': '#030305',
    '--scrollbar': '#1e2838',
    '--radius': '6px',
  },
  xterm: {
    background: '#030305',
    foreground: '#d9f8ff',
    cursor: '#00d4ff',
    cursorAccent: '#030305',
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


/** Stranger Things — Mundo del revés (púrpura y rojo) */
const strangerThings: AppTheme = {
  id: 'strangerThings',
  name: 'Stranger Things',
  vars: {
    '--bg': '#0d0614',
    '--bg-secondary': '#12081c',
    '--surface': '#190d26',
    '--surface-hover': '#221132',
    '--border': '#402060',
    '--text': '#e8dcff',
    '--text-muted': '#9070b0',
    '--accent': '#ff3d5c',
    '--accent-dim': '#c42845',
    '--danger': '#ff4444',
    '--tab-active-bg': '#190d26',
    '--tab-inactive-bg': '#0d0614',
    '--scrollbar': '#402060',
    '--radius': '8px',
  },
  xterm: {
    background: '#0d0614',
    foreground: '#eadcff',
    cursor: '#ff3d5c',
    cursorAccent: '#0d0614',
    selectionBackground: '#ff3d5c40',
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


/** Star Wars — hangar imperial (rojo y gris metálico) */
const starWars: AppTheme = {
  id: 'starWars',
  name: 'Star Wars',
  vars: {
    '--bg': '#07080b',
    '--bg-secondary': '#0b0d11',
    '--surface': '#101218',
    '--surface-hover': '#16191f',
    '--border': '#343b4a',
    '--text': '#e2e6ed',
    '--text-muted': '#7a8494',
    '--accent': '#ff4d5e',
    '--accent-dim': '#c2303c',
    '--danger': '#ff4444',
    '--tab-active-bg': '#101218',
    '--tab-inactive-bg': '#07080b',
    '--scrollbar': '#343b4a',
    '--radius': '8px',
  },
  xterm: {
    background: '#07080b',
    foreground: '#d8dde6',
    cursor: '#ff4d5e',
    cursorAccent: '#07080b',
    selectionBackground: '#ff4d5e33',
    selectionForeground: '#ffffff',
    black: '#171b22',
    red: '#ff4d5e',
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
    '--bg': '#03060b',
    '--bg-secondary': '#050a0e',
    '--surface': '#070e16',
    '--surface-hover': '#0b131d',
    '--border': '#1a3048',
    '--text': '#c8e8f0',
    '--text-muted': '#5080a0',
    '--accent': '#48d4e8',
    '--accent-dim': '#2890a8',
    '--danger': '#ff6b8a',
    '--tab-active-bg': '#070e16',
    '--tab-inactive-bg': '#03060b',
    '--scrollbar': '#1a3048',
    '--radius': '8px',
  },
  xterm: {
    background: '#03060b',
    foreground: '#c5f3ff',
    cursor: '#48d4e8',
    cursorAccent: '#03060b',
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

/** Zelda: Hyrule profundo — cielo, poder Sheikah, bosque y tierra */
const zeldaDeepWoods: AppTheme = {
  id: 'zeldaDeepWoods',
  name: 'Zelda',
  vars: {
    '--bg': '#040b11',
    '--bg-secondary': '#081216',
    '--surface': '#0d1913',
    '--surface-hover': '#14241a',
    '--border': '#6a5132',
    '--text': '#f0ead8',
    '--text-muted': '#9da78a',
    '--accent': '#4fd8e8',
    '--accent-dim': '#2f8fb0',
    '--danger': '#e34b5f',
    '--tab-active-bg': '#0d1913',
    '--tab-inactive-bg': '#040b11',
    '--scrollbar': '#6a5132',
    '--radius': '10px',
  },
  xterm: {
    background: '#040b11',
    foreground: '#f0ead8',
    cursor: '#4fd8e8',
    cursorAccent: '#040b11',
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

/** Vikings — nórdico oscuro: azules/grises fríos, acento ámbar rúnico */
const vikings: AppTheme = {
  id: 'vikings',
  name: 'Vikings',
  vars: {
    '--bg': '#070b11',
    '--bg-secondary': '#0b0f16',
    '--surface': '#0f151d',
    '--surface-hover': '#141b26',
    '--border': '#2a3a4c',
    '--text': '#e4ecf4',
    '--text-muted': '#7a8fa3',
    '--accent': '#d4a017',
    '--accent-dim': '#a07a12',
    '--danger': '#c44a3c',
    '--tab-active-bg': '#0f151d',
    '--tab-inactive-bg': '#070b11',
    '--scrollbar': '#2a3a4c',
    '--radius': '8px',
  },
  xterm: {
    background: '#070b11',
    foreground: '#dce6f0',
    cursor: '#d4a017',
    cursorAccent: '#070b11',
    selectionBackground: '#d4a01733',
    selectionForeground: '#f7f3e8',
    black: '#121a24',
    red: '#c44a3c',
    green: '#5a9e6e',
    yellow: '#d4a017',
    blue: '#4a7aa8',
    magenta: '#8a6a9a',
    cyan: '#5a9ab0',
    white: '#e4ecf4',
    brightBlack: '#4a5c70',
    brightRed: '#e06a5a',
    brightGreen: '#7abe8e',
    brightYellow: '#e8c04a',
    brightBlue: '#6a9ac8',
    brightMagenta: '#aa8aba',
    brightCyan: '#7ab8cc',
    brightWhite: '#ffffff',
  },
}

/** Ragnarok Online — fantasy MMO: azul cielo, morado y verde suave */
const ragnarokOnline: AppTheme = {
  id: 'ragnarokOnline',
  name: 'Ragnarok Online',
  vars: {
    '--bg': '#080a12',
    '--bg-secondary': '#0d0e1c',
    '--surface': '#121424',
    '--surface-hover': '#191b32',
    '--border': '#3a3c68',
    '--text': '#e8eaf8',
    '--text-muted': '#8a8cb8',
    '--accent': '#5ec8f0',
    '--accent-dim': '#3a98c0',
    '--danger': '#e06070',
    '--tab-active-bg': '#121424',
    '--tab-inactive-bg': '#080a12',
    '--scrollbar': '#3a3c68',
    '--radius': '10px',
  },
  xterm: {
    background: '#080a12',
    foreground: '#e0e4f8',
    cursor: '#5ec8f0',
    cursorAccent: '#080a12',
    selectionBackground: '#5ec8f033',
    selectionForeground: '#f4f6ff',
    black: '#161830',
    red: '#e06070',
    green: '#6ec89a',
    yellow: '#e0c060',
    blue: '#6080e0',
    magenta: '#a070d8',
    cyan: '#5ec8f0',
    white: '#e8eaf8',
    brightBlack: '#585a88',
    brightRed: '#f08090',
    brightGreen: '#8ee0b4',
    brightYellow: '#f0d880',
    brightBlue: '#88a0f0',
    brightMagenta: '#c090f0',
    brightCyan: '#88e0f8',
    brightWhite: '#ffffff',
  },
}

/** Metroid — sci-fi Nintendo: negro/verde profundo, ámbar de visor, cyan de energía */
const metroid: AppTheme = {
  id: 'metroid',
  name: 'Metroid',
  vars: {
    '--bg': '#030705',
    '--bg-secondary': '#070c09',
    '--surface': '#0a110d',
    '--surface-hover': '#101712',
    '--border': '#2a4034',
    '--text': '#d8ece0',
    '--text-muted': '#6a8878',
    '--accent': '#e89030',
    '--accent-dim': '#b06820',
    '--danger': '#d05040',
    '--tab-active-bg': '#0a110d',
    '--tab-inactive-bg': '#030705',
    '--scrollbar': '#2a4034',
    '--radius': '8px',
  },
  xterm: {
    background: '#030705',
    foreground: '#c8e0d0',
    cursor: '#e89030',
    cursorAccent: '#030705',
    selectionBackground: '#e8903033',
    selectionForeground: '#f0f8f0',
    black: '#0c1610',
    red: '#d05040',
    green: '#3a9860',
    yellow: '#e89030',
    blue: '#3a7090',
    magenta: '#786898',
    cyan: '#40c8b8',
    white: '#d8ece0',
    brightBlack: '#4a6860',
    brightRed: '#e87060',
    brightGreen: '#58b880',
    brightYellow: '#f0b050',
    brightBlue: '#5898b8',
    brightMagenta: '#9888b8',
    brightCyan: '#60e0d0',
    brightWhite: '#ffffff',
  },
}

/** Pokémon — alegre usable: azul, amarillo y rojo moderados */
const pokemon: AppTheme = {
  id: 'pokemon',
  name: 'Pokémon',
  vars: {
    '--bg': '#090d14',
    '--bg-secondary': '#0d121a',
    '--surface': '#121823',
    '--surface-hover': '#181f2d',
    '--border': '#3a4a64',
    '--text': '#e8eef6',
    '--text-muted': '#7a8aa0',
    '--accent': '#3d7ec8',
    '--accent-dim': '#2a5a98',
    '--danger': '#c85048',
    '--tab-active-bg': '#121823',
    '--tab-inactive-bg': '#090d14',
    '--scrollbar': '#3a4a64',
    '--radius': '10px',
  },
  xterm: {
    background: '#090d14',
    foreground: '#dce4f0',
    cursor: '#d4a84b',
    cursorAccent: '#090d14',
    selectionBackground: '#3d7ec833',
    selectionForeground: '#f4f8fc',
    black: '#161e2c',
    red: '#c85048',
    green: '#4a9860',
    yellow: '#d4a84b',
    blue: '#3d7ec8',
    magenta: '#986898',
    cyan: '#4aa8b8',
    white: '#e8eef6',
    brightBlack: '#586878',
    brightRed: '#e07068',
    brightGreen: '#68b880',
    brightYellow: '#e8c068',
    brightBlue: '#5a98e0',
    brightMagenta: '#b888b8',
    brightCyan: '#68c8d8',
    brightWhite: '#ffffff',
  },
}

/** Dragon Ball Z — naranjas y azules de energía sobre fondo oscuro */
const dragonBallZ: AppTheme = {
  id: 'dragonBallZ',
  name: 'Dragon Ball Z',
  vars: {
    '--bg': '#07060b',
    '--bg-secondary': '#0c0a11',
    '--surface': '#120e18',
    '--surface-hover': '#191422',
    '--border': '#4a3858',
    '--text': '#f0e8e0',
    '--text-muted': '#988880',
    '--accent': '#e87828',
    '--accent-dim': '#b05818',
    '--danger': '#d04050',
    '--tab-active-bg': '#120e18',
    '--tab-inactive-bg': '#07060b',
    '--scrollbar': '#4a3858',
    '--radius': '8px',
  },
  xterm: {
    background: '#07060b',
    foreground: '#e8e0d8',
    cursor: '#e87828',
    cursorAccent: '#07060b',
    selectionBackground: '#e8782833',
    selectionForeground: '#fff8f0',
    black: '#16121e',
    red: '#d04050',
    green: '#58a060',
    yellow: '#e8a838',
    blue: '#3868c8',
    magenta: '#9860a8',
    cyan: '#48a8c8',
    white: '#f0e8e0',
    brightBlack: '#685868',
    brightRed: '#e86070',
    brightGreen: '#78c080',
    brightYellow: '#f0c050',
    brightBlue: '#5888e8',
    brightMagenta: '#b880c8',
    brightCyan: '#68c8e0',
    brightWhite: '#ffffff',
  },
}

/** Saint Seiya — azul cosmos y dorado de armadura */
const saintSeiya: AppTheme = {
  id: 'saintSeiya',
  name: 'Saint Seiya',
  vars: {
    '--bg': '#060811',
    '--bg-secondary': '#0a0e19',
    '--surface': '#0f1524',
    '--surface-hover': '#151c30',
    '--border': '#344068',
    '--text': '#e8ecf8',
    '--text-muted': '#7888a8',
    '--accent': '#c8a030',
    '--accent-dim': '#988020',
    '--danger': '#c84858',
    '--tab-active-bg': '#0f1524',
    '--tab-inactive-bg': '#060811',
    '--scrollbar': '#344068',
    '--radius': '10px',
  },
  xterm: {
    background: '#060811',
    foreground: '#dce2f0',
    cursor: '#c8a030',
    cursorAccent: '#060811',
    selectionBackground: '#c8a03033',
    selectionForeground: '#f8f4e8',
    black: '#101828',
    red: '#c84858',
    green: '#489868',
    yellow: '#c8a030',
    blue: '#4060c0',
    magenta: '#7860a8',
    cyan: '#4890c0',
    white: '#e8ecf8',
    brightBlack: '#506088',
    brightRed: '#e06878',
    brightGreen: '#68b888',
    brightYellow: '#e0c050',
    brightBlue: '#6080e0',
    brightMagenta: '#9880c8',
    brightCyan: '#68b0d8',
    brightWhite: '#ffffff',
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
    '--bg': '#fcfcfe',
    '--bg-secondary': '#f7f8fc',
    '--surface': '#f2f3f9',
    '--surface-hover': '#e9ebf4',
    '--border': '#d0d5e6',
    '--text': '#3760bf',
    '--text-muted': '#7981a7',
    '--accent': '#2468d9',
    '--accent-dim': '#1c52b0',
    '--danger': '#f52a65',
    '--tab-active-bg': '#f2f3f9',
    '--tab-inactive-bg': '#fcfcfe',
    '--scrollbar': '#d0d5e6',
    '--radius': '8px',
  },
  xterm: {
    background: '#fcfcfe',
    foreground: '#3760bf',
    cursor: '#2468d9',
    cursorAccent: '#fcfcfe',
    selectionBackground: '#2468d92e',
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
    '--bg': '#fcfefc',
    '--bg-secondary': '#f7fbf8',
    '--surface': '#f1f7f3',
    '--surface-hover': '#e8f1eb',
    '--border': '#c5dbc9',
    '--text': '#0e3d20',
    '--text-muted': '#54876a',
    '--accent': '#008a3a',
    '--accent-dim': '#006b2d',
    '--danger': '#d23f3f',
    '--tab-active-bg': '#f1f7f3',
    '--tab-inactive-bg': '#fcfefc',
    '--scrollbar': '#c5dbc9',
    '--radius': '8px',
  },
  xterm: {
    background: '#fcfefc',
    foreground: '#155c2e',
    cursor: '#008a3a',
    cursorAccent: '#fcfefc',
    selectionBackground: '#008a3a26',
    selectionForeground: '#0a2e17',
    black: '#0e3d20',
    red: '#c42d4a',
    green: '#008a3a',
    yellow: '#7a8f14',
    blue: '#1a6dcc',
    magenta: '#8a3db8',
    cyan: '#0d8a7a',
    white: '#b4dcc1',
    brightBlack: '#4a7a5c',
    brightRed: '#a0243c',
    brightGreen: '#006b2d',
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
    '--bg': '#fcfcfe',
    '--bg-secondary': '#f7f8fb',
    '--surface': '#f1f3f8',
    '--surface-hover': '#e8ebf2',
    '--border': '#cfd5e2',
    '--text': '#2a3446',
    '--text-muted': '#71809a',
    '--accent': '#9a7020',
    '--accent-dim': '#7a5818',
    '--danger': '#c74a3c',
    '--tab-active-bg': '#f1f3f8',
    '--tab-inactive-bg': '#fcfcfe',
    '--scrollbar': '#cfd5e2',
    '--radius': '8px',
  },
  xterm: {
    background: '#fcfcfe',
    foreground: '#2a3446',
    cursor: '#9a7020',
    cursorAccent: '#fcfcfe',
    selectionBackground: '#3d6eb529',
    selectionForeground: '#1e2635',
    black: '#2a3446',
    red: '#c74a3c',
    green: '#4e7d5c',
    yellow: '#9a7020',
    blue: '#3766b8',
    magenta: '#6d5da8',
    cyan: '#357e99',
    white: '#bcc8da',
    brightBlack: '#5d6a82',
    brightRed: '#a53a2e',
    brightGreen: '#3f664b',
    brightYellow: '#7a5818',
    brightBlue: '#2c5296',
    brightMagenta: '#584b8a',
    brightCyan: '#2a657c',
    brightWhite: '#1e2635',
  },
}


/** Cyberpunk Neon Light — magenta y cian sobre blanco lavanda */
const cyberpunkNeonLight: AppTheme = {
  id: 'cyberpunkNeonLight',
  name: 'Cyberpunk Neon Light',
  appearance: 'light',
  vars: {
    '--bg': '#fcfbfe',
    '--bg-secondary': '#f9f7fc',
    '--surface': '#f5f2f9',
    '--surface-hover': '#ece7f4',
    '--border': '#d9cfe8',
    '--text': '#2c2340',
    '--text-muted': '#7d6f9c',
    '--accent': '#c41a9e',
    '--accent-dim': '#9a1480',
    '--danger': '#d9434a',
    '--tab-active-bg': '#f5f2f9',
    '--tab-inactive-bg': '#fcfbfe',
    '--scrollbar': '#d9cfe8',
    '--radius': '10px',
  },
  xterm: {
    background: '#fcfbfe',
    foreground: '#2c2340',
    cursor: '#0099ad',
    cursorAccent: '#fcfbfe',
    selectionBackground: '#0099ad29',
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
    '--bg': '#fbfcfe',
    '--bg-secondary': '#f6f9fc',
    '--surface': '#f0f5f9',
    '--surface-hover': '#e6eef5',
    '--border': '#c8d8e6',
    '--text': '#1c2c3a',
    '--text-muted': '#6684a0',
    '--accent': '#0082a8',
    '--accent-dim': '#006686',
    '--danger': '#d92955',
    '--tab-active-bg': '#f0f5f9',
    '--tab-inactive-bg': '#fbfcfe',
    '--scrollbar': '#c8d8e6',
    '--radius': '6px',
  },
  xterm: {
    background: '#fbfcfe',
    foreground: '#1c2c3a',
    cursor: '#0082a8',
    cursorAccent: '#fbfcfe',
    selectionBackground: '#0082a82b',
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


/** Stranger Things Light — Hawkins de día (rojo y púrpura) */
const strangerThingsLight: AppTheme = {
  id: 'strangerThingsLight',
  name: 'Stranger Things Light',
  appearance: 'light',
  vars: {
    '--bg': '#fcfbfe',
    '--bg-secondary': '#f9f7fc',
    '--surface': '#f5f2f9',
    '--surface-hover': '#ece7f4',
    '--border': '#ddd0e8',
    '--text': '#31203f',
    '--text-muted': '#83699c',
    '--accent': '#b8101c',
    '--accent-dim': '#8a0c15',
    '--danger': '#d92b2b',
    '--tab-active-bg': '#f5f2f9',
    '--tab-inactive-bg': '#fcfbfe',
    '--scrollbar': '#ddd0e8',
    '--radius': '8px',
  },
  xterm: {
    background: '#fcfbfe',
    foreground: '#31203f',
    cursor: '#b8101c',
    cursorAccent: '#fcfbfe',
    selectionBackground: '#b8101c24',
    selectionForeground: '#241730',
    black: '#31203f',
    red: '#b8101c',
    green: '#5a45d1',
    yellow: '#c26a1d',
    blue: '#3d51c9',
    magenta: '#c92384',
    cyan: '#2385ab',
    white: '#c8aed6',
    brightBlack: '#664e80',
    brightRed: '#8a0c15',
    brightGreen: '#4837ab',
    brightYellow: '#9e5617',
    brightBlue: '#3242a3',
    brightMagenta: '#a61c6d',
    brightCyan: '#1c6c8a',
    brightWhite: '#241730',
  },
}


/** Star Wars Light — hangar rebelde a plena luz */
const starWarsLight: AppTheme = {
  id: 'starWarsLight',
  name: 'Star Wars Light',
  appearance: 'light',
  vars: {
    '--bg': '#fcfcfd',
    '--bg-secondary': '#f7f8fa',
    '--surface': '#f1f3f6',
    '--surface-hover': '#e8ebf0',
    '--border': '#cfd5de',
    '--text': '#252c38',
    '--text-muted': '#6e7c8e',
    '--accent': '#b82430',
    '--accent-dim': '#921c26',
    '--danger': '#d92b2b',
    '--tab-active-bg': '#f1f3f6',
    '--tab-inactive-bg': '#fcfcfd',
    '--scrollbar': '#cfd5de',
    '--radius': '8px',
  },
  xterm: {
    background: '#fcfcfd',
    foreground: '#252c38',
    cursor: '#b82430',
    cursorAccent: '#fcfcfd',
    selectionBackground: '#b8243024',
    selectionForeground: '#1b212b',
    black: '#252c38',
    red: '#b82430',
    green: '#2a8a55',
    yellow: '#a3821c',
    blue: '#3468c9',
    magenta: '#7350c9',
    cyan: '#2385a8',
    white: '#bac6d4',
    brightBlack: '#586678',
    brightRed: '#921c26',
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
    '--bg': '#fbfcfe',
    '--bg-secondary': '#f6f9fb',
    '--surface': '#f0f5f8',
    '--surface-hover': '#e6eef3',
    '--border': '#c5d8e2',
    '--text': '#153542',
    '--text-muted': '#5b8496',
    '--accent': '#0c8498',
    '--accent-dim': '#096a7a',
    '--danger': '#d9436b',
    '--tab-active-bg': '#f0f5f8',
    '--tab-inactive-bg': '#fbfcfe',
    '--scrollbar': '#c5d8e2',
    '--radius': '8px',
  },
  xterm: {
    background: '#fbfcfe',
    foreground: '#153542',
    cursor: '#0c8498',
    cursorAccent: '#fbfcfe',
    selectionBackground: '#0c849829',
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

/** Zelda Light: campo al sol — hierba, silent princess, oro */
const zeldaDeepWoodsLight: AppTheme = {
  id: 'zeldaDeepWoodsLight',
  name: 'Zelda Light',
  appearance: 'light',
  vars: {
    '--bg': '#fcfdf9',
    '--bg-secondary': '#f8faf3',
    '--surface': '#f2f5eb',
    '--surface-hover': '#e9eedf',
    /* Toques dorados (no solo verde). */
    '--border': '#d4c49a',
    '--text': '#1a2e1c',
    '--text-muted': '#5a7050',
    /* Silent princess: azul-lila con contraste sobre blanco. */
    '--accent': '#3f52b0',
    '--accent-dim': '#2f3e8a',
    '--danger': '#c23030',
    '--tab-active-bg': '#f2f5eb',
    '--tab-inactive-bg': '#fcfdf9',
    '--scrollbar': '#c8b888',
    '--radius': '10px',
  },
  xterm: {
    background: '#fcfdf9',
    foreground: '#1a2e1c',
    cursor: '#3f52b0',
    cursorAccent: '#fcfdf9',
    selectionBackground: '#3f52b02e',
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


/** Vikings Light — fjords claros, ámbar rúnico sobre niebla */
const vikingsLight: AppTheme = {
  id: 'vikingsLight',
  name: 'Vikings Light',
  appearance: 'light',
  vars: {
    '--bg': '#f7f9fc',
    '--bg-secondary': '#f0f3f8',
    '--surface': '#e8edf4',
    '--surface-hover': '#dce4ee',
    '--border': '#c0cddc',
    '--text': '#1a2838',
    '--text-muted': '#5a7088',
    '--accent': '#b8860e',
    '--accent-dim': '#8a660a',
    '--danger': '#b03830',
    '--tab-active-bg': '#e8edf4',
    '--tab-inactive-bg': '#f7f9fc',
    '--scrollbar': '#c0cddc',
    '--radius': '8px',
  },
  xterm: {
    background: '#f7f9fc',
    foreground: '#1a2838',
    cursor: '#b8860e',
    cursorAccent: '#f7f9fc',
    selectionBackground: '#b8860e2e',
    selectionForeground: '#121c28',
    black: '#1a2838',
    red: '#b03830',
    green: '#2e7a48',
    yellow: '#9a7010',
    blue: '#2a5a88',
    magenta: '#6a4a7a',
    cyan: '#2a7088',
    white: '#8aa0b4',
    brightBlack: '#3a5068',
    brightRed: '#8e2c26',
    brightGreen: '#246038',
    brightYellow: '#7a580c',
    brightBlue: '#22486e',
    brightMagenta: '#543a62',
    brightCyan: '#225a6e',
    brightWhite: '#0e1620',
  },
}

/** Ragnarok Online Light — cielo y pradera de Midgard */
const ragnarokOnlineLight: AppTheme = {
  id: 'ragnarokOnlineLight',
  name: 'Ragnarok Online Light',
  appearance: 'light',
  vars: {
    '--bg': '#fafbfe',
    '--bg-secondary': '#f4f5fc',
    '--surface': '#eceef8',
    '--surface-hover': '#e0e4f2',
    '--border': '#c8cce0',
    '--text': '#1c1e3a',
    '--text-muted': '#5c6088',
    '--accent': '#2a88c0',
    '--accent-dim': '#1e6898',
    '--danger': '#c04050',
    '--tab-active-bg': '#eceef8',
    '--tab-inactive-bg': '#fafbfe',
    '--scrollbar': '#c8cce0',
    '--radius': '10px',
  },
  xterm: {
    background: '#fafbfe',
    foreground: '#1c1e3a',
    cursor: '#2a88c0',
    cursorAccent: '#fafbfe',
    selectionBackground: '#2a88c02e',
    selectionForeground: '#121428',
    black: '#1c1e3a',
    red: '#c04050',
    green: '#2e8a5a',
    yellow: '#a08020',
    blue: '#3a50b0',
    magenta: '#7848b0',
    cyan: '#2a88a8',
    white: '#989ab8',
    brightBlack: '#404268',
    brightRed: '#9a3240',
    brightGreen: '#246e48',
    brightYellow: '#806818',
    brightBlue: '#2e4090',
    brightMagenta: '#603890',
    brightCyan: '#226e88',
    brightWhite: '#101228',
  },
}

/** Metroid Light — bruma verde y ámbar de visor */
const metroidLight: AppTheme = {
  id: 'metroidLight',
  name: 'Metroid Light',
  appearance: 'light',
  vars: {
    '--bg': '#f4f8f4',
    '--bg-secondary': '#ecf2ec',
    '--surface': '#e0eae2',
    '--surface-hover': '#d2e0d6',
    '--border': '#b0c8b8',
    '--text': '#14241a',
    '--text-muted': '#4a6858',
    '--accent': '#c06818',
    '--accent-dim': '#904c10',
    '--danger': '#b03830',
    '--tab-active-bg': '#e0eae2',
    '--tab-inactive-bg': '#f4f8f4',
    '--scrollbar': '#b0c8b8',
    '--radius': '8px',
  },
  xterm: {
    background: '#f4f8f4',
    foreground: '#14241a',
    cursor: '#c06818',
    cursorAccent: '#f4f8f4',
    selectionBackground: '#c068182e',
    selectionForeground: '#0c1810',
    black: '#14241a',
    red: '#b03830',
    green: '#2a7848',
    yellow: '#a05810',
    blue: '#2a5878',
    magenta: '#584878',
    cyan: '#287868',
    white: '#88a098',
    brightBlack: '#3a5448',
    brightRed: '#8e2c26',
    brightGreen: '#226038',
    brightYellow: '#804810',
    brightBlue: '#224860',
    brightMagenta: '#483a60',
    brightCyan: '#206054',
    brightWhite: '#0a120c',
  },
}

/** Pokémon Light — cielo y pradera suaves */
const pokemonLight: AppTheme = {
  id: 'pokemonLight',
  name: 'Pokémon Light',
  appearance: 'light',
  vars: {
    '--bg': '#f7f9fc',
    '--bg-secondary': '#f0f3f8',
    '--surface': '#e6ebf4',
    '--surface-hover': '#dae2ee',
    '--border': '#b8c4d8',
    '--text': '#1a2438',
    '--text-muted': '#506078',
    '--accent': '#2a68b0',
    '--accent-dim': '#1e5088',
    '--danger': '#b03830',
    '--tab-active-bg': '#e6ebf4',
    '--tab-inactive-bg': '#f7f9fc',
    '--scrollbar': '#b8c4d8',
    '--radius': '10px',
  },
  xterm: {
    background: '#f7f9fc',
    foreground: '#1a2438',
    cursor: '#2a68b0',
    cursorAccent: '#f7f9fc',
    selectionBackground: '#2a68b02e',
    selectionForeground: '#121828',
    black: '#1a2438',
    red: '#b03830',
    green: '#2e7848',
    yellow: '#9a7018',
    blue: '#2a68b0',
    magenta: '#684878',
    cyan: '#287888',
    white: '#8898b0',
    brightBlack: '#3a4a60',
    brightRed: '#8e2c26',
    brightGreen: '#246038',
    brightYellow: '#7a5810',
    brightBlue: '#225490',
    brightMagenta: '#543a60',
    brightCyan: '#206068',
    brightWhite: '#0e1420',
  },
}

/** Dragon Ball Z Light — energía diurna naranja/azul */
const dragonBallZLight: AppTheme = {
  id: 'dragonBallZLight',
  name: 'Dragon Ball Z Light',
  appearance: 'light',
  vars: {
    '--bg': '#faf7f4',
    '--bg-secondary': '#f4efe8',
    '--surface': '#ece4da',
    '--surface-hover': '#e2d8cc',
    '--border': '#c8b8a8',
    '--text': '#241810',
    '--text-muted': '#685848',
    '--accent': '#c05818',
    '--accent-dim': '#904010',
    '--danger': '#b03040',
    '--tab-active-bg': '#ece4da',
    '--tab-inactive-bg': '#faf7f4',
    '--scrollbar': '#c8b8a8',
    '--radius': '8px',
  },
  xterm: {
    background: '#faf7f4',
    foreground: '#241810',
    cursor: '#c05818',
    cursorAccent: '#faf7f4',
    selectionBackground: '#c058182e',
    selectionForeground: '#181008',
    black: '#241810',
    red: '#b03040',
    green: '#2e7848',
    yellow: '#a06818',
    blue: '#2848a0',
    magenta: '#684078',
    cyan: '#286888',
    white: '#a09080',
    brightBlack: '#483828',
    brightRed: '#8e2430',
    brightGreen: '#246038',
    brightYellow: '#805010',
    brightBlue: '#203880',
    brightMagenta: '#543060',
    brightCyan: '#205468',
    brightWhite: '#100c08',
  },
}

/** Saint Seiya Light — cosmos diurno y oro suave */
const saintSeiyaLight: AppTheme = {
  id: 'saintSeiyaLight',
  name: 'Saint Seiya Light',
  appearance: 'light',
  vars: {
    '--bg': '#f6f8fc',
    '--bg-secondary': '#eef1f8',
    '--surface': '#e4e8f4',
    '--surface-hover': '#d8deec',
    '--border': '#b8c0d8',
    '--text': '#141c34',
    '--text-muted': '#485878',
    '--accent': '#9a7818',
    '--accent-dim': '#745810',
    '--danger': '#b03848',
    '--tab-active-bg': '#e4e8f4',
    '--tab-inactive-bg': '#f6f8fc',
    '--scrollbar': '#b8c0d8',
    '--radius': '10px',
  },
  xterm: {
    background: '#f6f8fc',
    foreground: '#141c34',
    cursor: '#9a7818',
    cursorAccent: '#f6f8fc',
    selectionBackground: '#9a78182e',
    selectionForeground: '#0c1020',
    black: '#141c34',
    red: '#b03848',
    green: '#2e7848',
    yellow: '#8a6810',
    blue: '#3048a0',
    magenta: '#584878',
    cyan: '#286888',
    white: '#8890a8',
    brightBlack: '#384060',
    brightRed: '#8e2c38',
    brightGreen: '#246038',
    brightYellow: '#6e5410',
    brightBlue: '#283880',
    brightMagenta: '#483a60',
    brightCyan: '#205468',
    brightWhite: '#080c18',
  },
}


// ─── Credicorp ───────────────────────────────────────────────────────────────
// Paleta y variantes del manual de marca (CREDICORP_BRANDBOOK 2024_01, pág. 20
// y 21). El manual define cuatro versiones del isologotipo —monocromo y tres
// gradientes— y esas son las variantes; los hex son los publicados, sin
// reinterpretar. El fondo claro es el papel del propio manual (#FAF7F3) y el
// oscuro su negro (#000000).

/** Isologotipo cian → magenta: la versión insignia del manual. */
const credicorp: AppTheme = {
  id: 'credicorp',
  name: 'Credicorp',
  family: 'credicorp',
  vars: {
    '--bg': '#000000',
    '--bg-secondary': '#0a0a0a',
    '--surface': '#141414',
    '--surface-hover': '#1f1f1f',
    '--border': '#2e2e2e',
    '--text': '#FAF7F3',
    '--text-muted': '#828282',
    '--accent': '#2AD2C9',
    '--accent-dim': '#15B3E4',
    '--danger': '#E32811',
    '--tab-active-bg': '#141414',
    '--tab-inactive-bg': '#000000',
    '--scrollbar': '#2e2e2e',
    '--radius': '8px',
  },
  xterm: {
    background: '#000000',
    foreground: '#E8E4DF',
    cursor: '#2AD2C9',
    cursorAccent: '#000000',
    selectionBackground: '#2AD2C955',
    selectionForeground: '#FAF7F3',
    black: '#141414',
    red: '#E32811',
    green: '#26D07C',
    yellow: '#FED800',
    blue: '#0095FF',
    magenta: '#E93CAC',
    cyan: '#2AD2C9',
    white: '#E8E4DF',
    brightBlack: '#828282',
    brightRed: '#FE5000',
    brightGreen: '#77E2AD',
    brightYellow: '#FFE467',
    brightBlue: '#15B3E4',
    brightMagenta: '#F184CB',
    brightCyan: '#6EE1DA',
    brightWhite: '#FAF7F3',
  },
}

/** Isologotipo verde → amarillo. */
const credicorpVerde: AppTheme = {
  id: 'credicorpVerde',
  name: 'Credicorp Verde',
  family: 'credicorp',
  vars: {
    '--bg': '#000000',
    '--bg-secondary': '#0a0a0a',
    '--surface': '#141414',
    '--surface-hover': '#1f1f1f',
    '--border': '#2e2e2e',
    '--text': '#FAF7F3',
    '--text-muted': '#828282',
    '--accent': '#26D07C',
    '--accent-dim': '#13AC7C',
    '--danger': '#E32811',
    '--tab-active-bg': '#141414',
    '--tab-inactive-bg': '#000000',
    '--scrollbar': '#2e2e2e',
    '--radius': '8px',
  },
  xterm: {
    background: '#000000',
    foreground: '#E8E4DF',
    cursor: '#26D07C',
    cursorAccent: '#000000',
    selectionBackground: '#26D07C55',
    selectionForeground: '#FAF7F3',
    black: '#141414',
    red: '#E32811',
    green: '#26D07C',
    yellow: '#FED800',
    blue: '#0095FF',
    magenta: '#E93CAC',
    cyan: '#2AD2C9',
    white: '#E8E4DF',
    brightBlack: '#828282',
    brightRed: '#FE5000',
    brightGreen: '#77E2AD',
    brightYellow: '#FFE467',
    brightBlue: '#15B3E4',
    brightMagenta: '#F184CB',
    brightCyan: '#6EE1DA',
    brightWhite: '#FAF7F3',
  },
}

/** Isologotipo naranja → rojo. */
const credicorpNaranja: AppTheme = {
  id: 'credicorpNaranja',
  name: 'Credicorp Naranja',
  family: 'credicorp',
  vars: {
    '--bg': '#000000',
    '--bg-secondary': '#0a0a0a',
    '--surface': '#141414',
    '--surface-hover': '#1f1f1f',
    '--border': '#2e2e2e',
    '--text': '#FAF7F3',
    '--text-muted': '#828282',
    '--accent': '#FE5000',
    // El rojo medio del manual (#E32811) queda en zona muerta: ni etiqueta
    // blanca ni negra llegan a 4.5:1 sobre él. Se usa el profundo, que además
    // es donde termina el gradiente naranja → rojo.
    '--accent-dim': '#C70021',
    '--danger': '#E32811',
    '--tab-active-bg': '#141414',
    '--tab-inactive-bg': '#000000',
    '--scrollbar': '#2e2e2e',
    '--radius': '8px',
  },
  xterm: {
    background: '#000000',
    foreground: '#E8E4DF',
    cursor: '#FE5000',
    cursorAccent: '#000000',
    selectionBackground: '#FE500055',
    selectionForeground: '#FAF7F3',
    black: '#141414',
    red: '#E32811',
    green: '#26D07C',
    yellow: '#FED800',
    blue: '#0095FF',
    magenta: '#E93CAC',
    cyan: '#2AD2C9',
    white: '#E8E4DF',
    brightBlack: '#828282',
    brightRed: '#FE5000',
    brightGreen: '#77E2AD',
    brightYellow: '#FFE467',
    brightBlue: '#15B3E4',
    brightMagenta: '#F184CB',
    brightCyan: '#6EE1DA',
    brightWhite: '#FAF7F3',
  },
}

/** Isologotipo monocromo: el uso recomendado sobre piezas ya cargadas de color. */
const credicorpMono: AppTheme = {
  id: 'credicorpMono',
  name: 'Credicorp Mono',
  family: 'credicorp',
  vars: {
    '--bg': '#000000',
    '--bg-secondary': '#0a0a0a',
    '--surface': '#141414',
    '--surface-hover': '#1f1f1f',
    '--border': '#2e2e2e',
    '--text': '#FAF7F3',
    '--text-muted': '#828282',
    '--accent': '#FAF7F3',
    '--accent-dim': '#B3AFAC',
    '--danger': '#E32811',
    '--tab-active-bg': '#141414',
    '--tab-inactive-bg': '#000000',
    '--scrollbar': '#2e2e2e',
    '--radius': '8px',
  },
  xterm: {
    background: '#000000',
    foreground: '#E8E4DF',
    cursor: '#FAF7F3',
    cursorAccent: '#000000',
    selectionBackground: '#FAF7F355',
    selectionForeground: '#FAF7F3',
    black: '#141414',
    red: '#E32811',
    green: '#26D07C',
    yellow: '#FED800',
    blue: '#0095FF',
    magenta: '#E93CAC',
    cyan: '#2AD2C9',
    white: '#E8E4DF',
    brightBlack: '#828282',
    brightRed: '#FE5000',
    brightGreen: '#77E2AD',
    brightYellow: '#FFE467',
    brightBlue: '#15B3E4',
    brightMagenta: '#F184CB',
    brightCyan: '#6EE1DA',
    brightWhite: '#FAF7F3',
  },
}

const credicorpLight: AppTheme = {
  id: 'credicorpLight',
  name: 'Credicorp Light',
  family: 'credicorp',
  appearance: 'light',
  vars: {
    '--bg': '#FAF7F3',
    '--bg-secondary': '#F3EFEA',
    '--surface': '#FFFFFF',
    '--surface-hover': '#F0ECE6',
    '--border': '#E8E4DF',
    '--text': '#000000',
    '--text-muted': '#828282',
    '--accent': '#15B3E4',
    '--accent-dim': '#0095FF',
    '--danger': '#C70021',
    '--tab-active-bg': '#FFFFFF',
    '--tab-inactive-bg': '#FAF7F3',
    '--scrollbar': '#E8E4DF',
    '--radius': '8px',
  },
  xterm: {
    background: '#FAF7F3',
    foreground: '#000000',
    cursor: '#15B3E4',
    cursorAccent: '#FAF7F3',
    selectionBackground: '#15B3E42e',
    selectionForeground: '#000000',
    black: '#B3AFAC',
    red: '#C70021',
    green: '#00877C',
    yellow: '#FF9600',
    blue: '#0095FF',
    magenta: '#9C2A6F',
    cyan: '#13AC7C',
    white: '#828282',
    brightBlack: '#828282',
    brightRed: '#E32811',
    brightGreen: '#13AC7C',
    brightYellow: '#FFB900',
    brightBlue: '#15B3E4',
    brightMagenta: '#C3338E',
    brightCyan: '#2AD2C9',
    brightWhite: '#000000',
  },
}

const credicorpVerdeLight: AppTheme = {
  id: 'credicorpVerdeLight',
  name: 'Credicorp Verde Light',
  family: 'credicorp',
  appearance: 'light',
  vars: {
    '--bg': '#FAF7F3',
    '--bg-secondary': '#F3EFEA',
    '--surface': '#FFFFFF',
    '--surface-hover': '#F0ECE6',
    '--border': '#E8E4DF',
    '--text': '#000000',
    '--text-muted': '#828282',
    '--accent': '#13AC7C',
    '--accent-dim': '#00877C',
    '--danger': '#C70021',
    '--tab-active-bg': '#FFFFFF',
    '--tab-inactive-bg': '#FAF7F3',
    '--scrollbar': '#E8E4DF',
    '--radius': '8px',
  },
  xterm: {
    background: '#FAF7F3',
    foreground: '#000000',
    cursor: '#13AC7C',
    cursorAccent: '#FAF7F3',
    selectionBackground: '#13AC7C2e',
    selectionForeground: '#000000',
    black: '#B3AFAC',
    red: '#C70021',
    green: '#00877C',
    yellow: '#FF9600',
    blue: '#0095FF',
    magenta: '#9C2A6F',
    cyan: '#13AC7C',
    white: '#828282',
    brightBlack: '#828282',
    brightRed: '#E32811',
    brightGreen: '#13AC7C',
    brightYellow: '#FFB900',
    brightBlue: '#15B3E4',
    brightMagenta: '#C3338E',
    brightCyan: '#2AD2C9',
    brightWhite: '#000000',
  },
}

const credicorpNaranjaLight: AppTheme = {
  id: 'credicorpNaranjaLight',
  name: 'Credicorp Naranja Light',
  family: 'credicorp',
  appearance: 'light',
  vars: {
    '--bg': '#FAF7F3',
    '--bg-secondary': '#F3EFEA',
    '--surface': '#FFFFFF',
    '--surface-hover': '#F0ECE6',
    '--border': '#E8E4DF',
    '--text': '#000000',
    '--text-muted': '#828282',
    '--accent': '#E32811',
    '--accent-dim': '#C70021',
    '--danger': '#C70021',
    '--tab-active-bg': '#FFFFFF',
    '--tab-inactive-bg': '#FAF7F3',
    '--scrollbar': '#E8E4DF',
    '--radius': '8px',
  },
  xterm: {
    background: '#FAF7F3',
    foreground: '#000000',
    cursor: '#E32811',
    cursorAccent: '#FAF7F3',
    selectionBackground: '#E328112e',
    selectionForeground: '#000000',
    black: '#B3AFAC',
    red: '#C70021',
    green: '#00877C',
    yellow: '#FF9600',
    blue: '#0095FF',
    magenta: '#9C2A6F',
    cyan: '#13AC7C',
    white: '#828282',
    brightBlack: '#828282',
    brightRed: '#E32811',
    brightGreen: '#13AC7C',
    brightYellow: '#FFB900',
    brightBlue: '#15B3E4',
    brightMagenta: '#C3338E',
    brightCyan: '#2AD2C9',
    brightWhite: '#000000',
  },
}

const credicorpMonoLight: AppTheme = {
  id: 'credicorpMonoLight',
  name: 'Credicorp Mono Light',
  family: 'credicorp',
  appearance: 'light',
  vars: {
    '--bg': '#FAF7F3',
    '--bg-secondary': '#F3EFEA',
    '--surface': '#FFFFFF',
    '--surface-hover': '#F0ECE6',
    '--border': '#E8E4DF',
    '--text': '#000000',
    '--text-muted': '#828282',
    '--accent': '#000000',
    '--accent-dim': '#828282',
    '--danger': '#C70021',
    '--tab-active-bg': '#FFFFFF',
    '--tab-inactive-bg': '#FAF7F3',
    '--scrollbar': '#E8E4DF',
    '--radius': '8px',
  },
  xterm: {
    background: '#FAF7F3',
    foreground: '#000000',
    cursor: '#000000',
    cursorAccent: '#FAF7F3',
    selectionBackground: '#0000002e',
    selectionForeground: '#000000',
    black: '#B3AFAC',
    red: '#C70021',
    green: '#00877C',
    yellow: '#FF9600',
    blue: '#0095FF',
    magenta: '#9C2A6F',
    cyan: '#13AC7C',
    white: '#828282',
    brightBlack: '#828282',
    brightRed: '#E32811',
    brightGreen: '#13AC7C',
    brightYellow: '#FFB900',
    brightBlue: '#15B3E4',
    brightMagenta: '#C3338E',
    brightCyan: '#2AD2C9',
    brightWhite: '#000000',
  },
}

export const THEMES: AppTheme[] = [
  // Credicorp — dark
  credicorp,
  credicorpVerde,
  credicorpNaranja,
  credicorpMono,
  // Credicorp — light
  credicorpLight,
  credicorpVerdeLight,
  credicorpNaranjaLight,
  credicorpMonoLight,
  // Cinematic — dark
  tokyoNight,
  matrix,
  interstellar,
  cyberpunkNeon,
  tron,
  strangerThings,
  starWars,
  avatar,
  zeldaDeepWoods,
  vikings,
  ragnarokOnline,
  metroid,
  pokemon,
  dragonBallZ,
  saintSeiya,
  // Cinematic — light, espejo del orden de sus contrapartes oscuras
  tokyoNightDay,
  matrixLight,
  interstellarLight,
  cyberpunkNeonLight,
  tronLight,
  strangerThingsLight,
  starWarsLight,
  avatarLight,
  zeldaDeepWoodsLight,
  vikingsLight,
  ragnarokOnlineLight,
  metroidLight,
  pokemonLight,
  dragonBallZLight,
  saintSeiyaLight,
]

export function getTheme(id: string): AppTheme {
  return THEMES.find(t => t.id === id) ?? tokyoNight
}

const THEME_CHROME_PROFILES: Record<string, ThemeChromeProfile> = {
  tokyoNight: { category: 'glow', tabShape: 'square', glowMultiplier: 1.35, panelRadius: '10px' },
  matrix: { category: 'glow', tabShape: 'square', glowMultiplier: 1.65, panelRadius: '8px' },
  interstellar: { category: 'glow', tabShape: 'square', glowMultiplier: 1.28, panelRadius: '10px' },
  cyberpunkNeon: { category: 'glow', tabShape: 'square', glowMultiplier: 2.25, panelRadius: '12px' },
  tron: { category: 'glow', tabShape: 'square', glowMultiplier: 2.0, panelRadius: '8px' },
  strangerThings: { category: 'glow', tabShape: 'square', glowMultiplier: 1.8, panelRadius: '12px' },
  starWars: { category: 'glow', tabShape: 'square', glowMultiplier: 1.45, panelRadius: '8px' },
  avatar: { category: 'glow', tabShape: 'square', glowMultiplier: 1.6, panelRadius: '14px' },
  zeldaDeepWoods: { category: 'glow', tabShape: 'square', glowMultiplier: 1.65, panelRadius: '14px' },
  vikings: { category: 'glow', tabShape: 'square', glowMultiplier: 1.5, panelRadius: '8px' },
  ragnarokOnline: { category: 'glow', tabShape: 'square', glowMultiplier: 1.55, panelRadius: '10px' },
  metroid: { category: 'glow', tabShape: 'square', glowMultiplier: 1.55, panelRadius: '8px' },
  pokemon: { category: 'glow', tabShape: 'square', glowMultiplier: 1.45, panelRadius: '10px' },
  dragonBallZ: { category: 'glow', tabShape: 'square', glowMultiplier: 1.6, panelRadius: '8px' },
  saintSeiya: { category: 'glow', tabShape: 'square', glowMultiplier: 1.5, panelRadius: '10px' },
  // Lights: mismo carácter glow con intensidad reducida para fondos claros
  tokyoNightDay: { category: 'glow', tabShape: 'square', glowMultiplier: 1.0, panelRadius: '10px' },
  matrixLight: { category: 'glow', tabShape: 'square', glowMultiplier: 1.15, panelRadius: '8px' },
  interstellarLight: { category: 'glow', tabShape: 'square', glowMultiplier: 0.95, panelRadius: '10px' },
  cyberpunkNeonLight: { category: 'glow', tabShape: 'square', glowMultiplier: 1.4, panelRadius: '12px' },
  tronLight: { category: 'glow', tabShape: 'square', glowMultiplier: 1.35, panelRadius: '8px' },
  strangerThingsLight: { category: 'glow', tabShape: 'square', glowMultiplier: 1.2, panelRadius: '12px' },
  starWarsLight: { category: 'glow', tabShape: 'square', glowMultiplier: 1.05, panelRadius: '8px' },
  avatarLight: { category: 'glow', tabShape: 'square', glowMultiplier: 1.15, panelRadius: '14px' },
  zeldaDeepWoodsLight: { category: 'glow', tabShape: 'square', glowMultiplier: 1.1, panelRadius: '14px' },
  vikingsLight: { category: 'glow', tabShape: 'square', glowMultiplier: 1.05, panelRadius: '8px' },
  ragnarokOnlineLight: { category: 'glow', tabShape: 'square', glowMultiplier: 1.1, panelRadius: '10px' },
  metroidLight: { category: 'glow', tabShape: 'square', glowMultiplier: 1.1, panelRadius: '8px' },
  pokemonLight: { category: 'glow', tabShape: 'square', glowMultiplier: 1.05, panelRadius: '10px' },
  dragonBallZLight: { category: 'glow', tabShape: 'square', glowMultiplier: 1.15, panelRadius: '8px' },
  saintSeiyaLight: { category: 'glow', tabShape: 'square', glowMultiplier: 1.1, panelRadius: '10px' },
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

/** Mezcla border/accent como `--plane-grid-line` en global.css (55% / 18%). */
function mixPlaneGridLineRgb(
  borderRgb: [number, number, number],
  accentRgb: [number, number, number],
): [number, number, number] {
  const borderWeight = 55
  const accentWeight = 18
  const total = borderWeight + accentWeight
  return [
    Math.round((borderRgb[0] * borderWeight + accentRgb[0] * accentWeight) / total),
    Math.round((borderRgb[1] * borderWeight + accentRgb[1] * accentWeight) / total),
    Math.round((borderRgb[2] * borderWeight + accentRgb[2] * accentWeight) / total),
  ]
}

function lerpRgb(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ]
}

/**
 * Alfa que arrastra `--plane-grid-line`: los pesos del `color-mix` suman 73%,
 * y CSS multiplica el alfa del resultado por esa suma. Cualquier consumidor que
 * no sea CSS (canvas 2D, WebGL) tiene que aplicarlo a mano o pintará más fuerte.
 */
export const PLANE_GRID_LINE_ALPHA = 0.73

/** Opacidad compuesta (rejilla × alfa de línea): canvas 2D, WebGL y fallback CSS. */
export function computePlaneGridCompositeOpacity(gridOpacity: number): number {
  return gridOpacity * PLANE_GRID_LINE_ALPHA
}

/** `rgb(...)` de la línea de rejilla, ya mezclada: WebGL no sabe leer color-mix. */
export function computePlaneGridLineRgb(theme: AppTheme): string {
  const borderRgb = parseHexAccent(theme.vars['--border'] ?? '#222a3c') ?? [34, 42, 60]
  const accentRgb = parseHexAccent(theme.vars['--accent'] ?? '#d4a84b') ?? [212, 168, 75]
  const [r, g, b] = mixPlaneGridLineRgb(borderRgb, accentRgb)
  return `rgb(${r}, ${g}, ${b})`
}

function planeGridContrastRatio(
  bg: string,
  border: string,
  accent: string,
  opacity: number,
): number | null {
  const bgRgb = parseHexAccent(bg)
  const borderRgb = parseHexAccent(border)
  const accentRgb = parseHexAccent(accent)
  if (!bgRgb || !borderRgb || !accentRgb) return null
  const lineRgb = mixPlaneGridLineRgb(borderRgb, accentRgb)
  const bgLum = relativeLuminance(bgRgb)
  const lineLum = relativeLuminance(lineRgb)
  const alpha = opacity * PLANE_GRID_LINE_ALPHA
  const blended = bgLum * (1 - alpha) + lineLum * alpha
  return contrastRatio(blended, bgLum)
}

const PLANE_GRID_OPACITY_BASE = 0.25
const PLANE_GRID_OPACITY_MIN = 0.02
const PLANE_GRID_OPACITY_MAX = 1
/** Ancla de contraste por apariencia: oscuros y claros se calibran por separado. */
const PLANE_GRID_REFERENCE_ID = {
  dark: 'interstellar',
  light: 'interstellarLight',
} as const
/** Ajuste fino de notoriedad por apariencia (1 = neutro). Cada escala solo toca su familia. */
const PLANE_GRID_DARK_NOTORIETY_SCALE = 1.934
/** Calibrado para Interstellar Light ≈0.249 con ancla propia (0.25×0.95). */
const PLANE_GRID_LIGHT_NOTORIETY_SCALE = 1.051

function planeGridReferenceThemeId(light: boolean): string {
  return PLANE_GRID_REFERENCE_ID[light ? 'light' : 'dark']
}

function planeGridNotorietyScale(light: boolean): number {
  return light ? PLANE_GRID_LIGHT_NOTORIETY_SCALE : PLANE_GRID_DARK_NOTORIETY_SCALE
}

function planeGridAnchorOpacity(theme: AppTheme, light: boolean): number {
  return referencePlaneGridOpacity(theme) * planeGridNotorietyScale(light)
}

/** Opacidad ancla del tema de referencia: base × glow del chrome, sin escala de notoriedad. */
export function referencePlaneGridOpacity(
  theme: AppTheme = getTheme(planeGridReferenceThemeId(false)),
): number {
  return Number((PLANE_GRID_OPACITY_BASE * getThemeChromeProfile(theme).glowMultiplier).toFixed(3))
}

/** Contraste objetivo = el del ancla de la misma apariencia a su opacidad calibrada. */
export function planeGridTargetContrast(light = false): number {
  const refTheme = getTheme(planeGridReferenceThemeId(light))
  const refOpacity = planeGridAnchorOpacity(refTheme, light)
  const refRatio = planeGridContrastRatio(
    refTheme.vars['--bg'] ?? '#030508',
    refTheme.vars['--border'] ?? '#222a3c',
    refTheme.vars['--accent'] ?? '#d4a84b',
    refOpacity,
  )
  return refRatio ?? 1
}

/**
 * Opacidad de la rejilla del plano calibrada al contraste perceptual del ancla de su apariencia.
 * La escala de notoriedad se aplica al **salto de contraste**, no a la opacidad en bruto.
 */
export function computePlaneGridOpacity(theme: AppTheme): number {
  const light = isLightTheme(theme)
  const refId = planeGridReferenceThemeId(light)
  if (theme.id === refId) {
    return Number(planeGridAnchorOpacity(theme, light).toFixed(3))
  }

  const refTheme = getTheme(refId)
  const target = planeGridTargetContrast(light)

  let best = referencePlaneGridOpacity(refTheme)
  let bestDelta = Number.POSITIVE_INFINITY
  for (
    let opacity = PLANE_GRID_OPACITY_MIN;
    opacity <= PLANE_GRID_OPACITY_MAX;
    opacity += 0.002
  ) {
    const ratio = planeGridContrastRatio(
      theme.vars['--bg'] ?? refTheme.vars['--bg'] ?? '#030508',
      theme.vars['--border'] ?? '#222a3c',
      theme.vars['--accent'] ?? '#d4a84b',
      opacity,
    )
    if (ratio == null) continue
    const delta = Math.abs(ratio - target)
    if (delta < bestDelta) {
      bestDelta = delta
      best = opacity
    }
  }
  return Number(best.toFixed(3))
}

const PLANE_GRID_WARMTH_BASE = 0.42
/** El resplandor sí depende del sentido: en light el acento oscurece la línea. */
const PLANE_GRID_WARMTH_REFERENCE_ID = {
  dark: 'interstellar',
  light: 'interstellarLight',
} as const

function planeGridWarmLuminanceSpread(theme: AppTheme, warmth: number): number | null {
  const borderRgb = parseHexAccent(theme.vars['--border'] ?? '#222a3c')
  const accentRgb = parseHexAccent(theme.vars['--accent'] ?? '#d4a84b')
  if (!borderRgb || !accentRgb) return null
  const lineRgb = mixPlaneGridLineRgb(borderRgb, accentRgb)
  const warmRgb = lerpRgb(lineRgb, accentRgb, warmth)
  return relativeLuminance(warmRgb) - relativeLuminance(lineRgb)
}

/**
 * Resplandor línea→acento en WebGL calibrado al spread luminante de Interstellar.
 */
export function computePlaneGridWarmth(theme: AppTheme): number {
  const light = isLightTheme(theme)
  const refTheme = getTheme(PLANE_GRID_WARMTH_REFERENCE_ID[light ? 'light' : 'dark'])
  const target = planeGridWarmLuminanceSpread(refTheme, PLANE_GRID_WARMTH_BASE)
  if (target == null) return PLANE_GRID_WARMTH_BASE

  let best = PLANE_GRID_WARMTH_BASE
  let bestDelta = Number.POSITIVE_INFINITY
  for (let warmth = 0.05; warmth <= 1; warmth += 0.005) {
    const spread = planeGridWarmLuminanceSpread(theme, warmth)
    if (spread == null) continue
    const delta = Math.abs(spread - target)
    if (delta < bestDelta) {
      bestDelta = delta
      best = warmth
    }
  }
  return Number(best.toFixed(3))
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

    // Plano HUD: rejilla con contraste fijo (referencia Interstellar); glow solo en atmósfera
    const planeGridOpacity = computePlaneGridOpacity(theme)
    root.style.setProperty('--plane-grid-opacity', String(planeGridOpacity))
    root.style.setProperty(
      '--plane-grid-line-opacity',
      String(computePlaneGridCompositeOpacity(planeGridOpacity)),
    )
    root.style.setProperty('--plane-grid-warmth', String(computePlaneGridWarmth(theme)))
    root.style.setProperty('--plane-grid-line-rgb', computePlaneGridLineRgb(theme))
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
