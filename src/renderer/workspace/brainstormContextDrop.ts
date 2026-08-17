import React, { useState } from 'react'
import { hasPlaneContextDrag, readPlaneContextDragData } from './planeContextDrag'

/** Lo que la ficha esparce sobre su nodo raíz para recibir un contexto. */
export interface BrainstormContextDropHandlers {
  onDragOver: (event: React.DragEvent) => void
  onDragLeave: (event: React.DragEvent) => void
  onDrop: (event: React.DragEvent) => void
}

export interface BrainstormContextDrop {
  /** Ficha bajo el contexto arrastrado, para pintarla como destino. */
  dropAgentId: string | null
  /** `undefined` cuando la vista no puede asignar: la ficha no acepta drops. */
  handlersFor: (agentId: string) => BrainstormContextDropHandlers | undefined
}

/**
 * Soltar un contexto del riel sobre la ficha de un agente, en cualquiera de las
 * tres vistas de la sala (roster, alta y sala viva). Solo traduce el arrastre a
 * `(agentId, contextId)`: quien escribe el catálogo es App, que es el único que
 * tiene la definición entera del agente —una vista con media definición
 * borraría el resto del archivo al guardarlo.
 */
export function useBrainstormContextDrop(
  onAssign?: (agentId: string, contextId: string) => void,
): BrainstormContextDrop {
  const [dropAgentId, setDropAgentId] = useState<string | null>(null)

  const handlersFor = (agentId: string): BrainstormContextDropHandlers | undefined => {
    if (!onAssign) return undefined
    return {
      onDragOver: event => {
        if (!hasPlaneContextDrag(event.dataTransfer)) return
        event.preventDefault()
        event.dataTransfer.dropEffect = 'copy'
        setDropAgentId(agentId)
      },
      onDragLeave: () => {
        setDropAgentId(current => (current === agentId ? null : current))
      },
      onDrop: event => {
        if (!hasPlaneContextDrag(event.dataTransfer)) return
        event.preventDefault()
        event.stopPropagation()
        setDropAgentId(null)
        const contextId = readPlaneContextDragData(event.dataTransfer)
        if (contextId) onAssign(agentId, contextId)
      },
    }
  }

  return { dropAgentId, handlersFor }
}
