/**
 * Tono de presentación del chip de updater, no diagnóstico.
 * El mensaje crudo sigue viajando desde main; aquí solo se decide
 * si se pinta como offline o como fallo.
 */
const OFFLINE_MARKERS = [
  'err_internet_disconnected',
  'err_name_not_resolved',
  'err_network_changed',
  'err_connection_',
  'err_address_unreachable',
  'err_proxy_connection_failed',
  'err_timed_out',
  'enotfound',
  'econnrefused',
  'econnreset',
  'etimedout',
  'getaddrinfo',
  'fetch failed',
  'network is unreachable',
] as const

export function classifyUpdateError(message: string): 'offline' | 'failed' {
  const normalized = message.toLowerCase()
  return OFFLINE_MARKERS.some(marker => normalized.includes(marker)) ? 'offline' : 'failed'
}
