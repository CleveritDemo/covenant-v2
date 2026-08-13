/**
 * Etiqueta legible de un contexto desde su id, sin ir a disco:
 * `iaterminal:<kind>:<stem>` → tipo + nombre.
 *
 * ponytail: el nombre real exigiría `discoverTabContexts`; el stem alcanza para
 * reconocerlo, y es lo que ya se pintaba en el material de la sala.
 */
export function brainstormContextLabel(contextId: string): { tag: string; label: string } {
  const parts = contextId.split(':')
  const kind = parts[1] ?? 'ctx'
  const stem = parts.slice(2).join(':').replace(/[-_]/g, ' ').trim()
  return { tag: kind, label: stem || kind }
}
