/// <reference types="vite/client" />

import type { API } from '../../electron/preload'
import type { CovenantApi } from './covenantApi'

declare global {
  interface Window {
    api: API & { covenant?: CovenantApi }
  }
}

export {}
