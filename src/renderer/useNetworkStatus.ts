// Detecta si la interfaz de red del sistema está caída (navigator.onLine), no si el backend responde.
// El consumidor decide qué hacer con el estado (encolar, aviso en UI, etc.).

import { useEffect, useState } from 'react'

export type NetworkStatus = 'online' | 'offline'

export function networkStatusFromOnLine(onLine: boolean | undefined | null): NetworkStatus {
  return onLine === false ? 'offline' : 'online'
}

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>(() =>
    networkStatusFromOnLine(typeof navigator === 'undefined' ? undefined : navigator.onLine),
  )

  useEffect(() => {
    if (typeof window === 'undefined') return

    const goOffline = () => setStatus('offline')
    const goOnline = () => setStatus('online')

    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)

    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
    }
  }, [])

  return status
}
