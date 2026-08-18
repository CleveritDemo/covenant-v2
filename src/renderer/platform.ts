/** Platform id from preload; safe when `window.api` is missing (jsdom / tests). */
type PlatformBridge = {
  platform?: string
  isStoreBuild?: boolean
  setTitleBarOverlay?: (color: string, symbolColor: string) => void
}

function bridge(): PlatformBridge | undefined {
  if (typeof window === 'undefined') return undefined
  return (window as Window & { api?: PlatformBridge }).api
}

export const platformId: string = bridge()?.platform ?? ''
export const isWindows = platformId === 'win32'
export const isMacOS = platformId === 'darwin'
export const isStoreBuild: boolean = bridge()?.isStoreBuild === true
