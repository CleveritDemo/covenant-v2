/// <reference types="vite/client" />

import type { API } from '../../electron/preload'
import type { CovenantApi } from './covenantApi'

declare global {
  interface Window {
    api: API & { covenant?: CovenantApi }
  }
}

/**
 * La Popover API es HTML estándar y Chromium la soporta desde la 114 (Electron 33
 * trae la 130), pero los tipos de React 18 aún no la incluyen.
 */
declare module 'react' {
  interface HTMLAttributes<T> {
    popover?: 'auto' | 'manual'
  }
  interface ButtonHTMLAttributes<T> extends HTMLAttributes<T> {
    // En minúscula: React 18 sólo pasa al DOM los atributos desconocidos si lo son
    // (en camelCase los descarta con un warning y el popover nunca se abre).
    popovertarget?: string
    popovertargetaction?: 'toggle' | 'show' | 'hide'
  }
}

export {}
