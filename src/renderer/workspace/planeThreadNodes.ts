/**
 * Filas de hilo de la card mini de un agente.
 *
 * La regla es que el listado muestre **todo lo que corre**: turno humano y
 * carriles de delegación por igual. Por eso no se puede armar mapeando el
 * catálogo de threads y filtrando por running: un carril entra en el mapa de
 * hilos activos en cuanto el orquestador despacha la subtarea (con su
 * `toThreadId`), y el pane solo lo registra en el catálogo cuando arranca el
 * turno. En esa ventana —y en cualquier hilo que la poda del tope haya sacado
 * del catálogo mientras seguía vivo— la fila desaparecía y la card se quedaba
 * mostrando el snippet, sin ninguna señal de trabajo.
 */
export interface PlaneThreadNodeInput {
  id: string
  title: string
}

export interface PlaneThreadNodeData {
  id: string
  title: string
  running: boolean
  activity: string
}

export function buildPlaneThreadNodes(
  catalogThreads: readonly PlaneThreadNodeInput[],
  runningThreadIds: ReadonlySet<string> | undefined,
  activities: Record<string, string> | undefined,
): PlaneThreadNodeData[] {
  const running = runningThreadIds ?? new Set<string>()
  const known = new Set(catalogThreads.map(thread => thread.id))
  const nodes: PlaneThreadNodeData[] = catalogThreads.map(thread => ({
    id: thread.id,
    title: thread.title,
    running: running.has(thread.id),
    activity: activities?.[thread.id] ?? '',
  }))
  // Hilos vivos que el catálogo todavía no tiene: van al final, en el orden en
  // que se despacharon.
  for (const threadId of running) {
    if (known.has(threadId)) continue
    nodes.push({
      id: threadId,
      title: '',
      running: true,
      activity: activities?.[threadId] ?? '',
    })
  }
  return nodes
}
