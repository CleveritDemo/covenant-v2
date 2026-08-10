/**
 * Subtareas del orquestador deben arrancar CLI fresco (sin --resume).
 * Turnos humanos y orchestrationFollowUp en el mismo pane sí reanudan sesión.
 *
 * La respuesta vale para las dos puntas del turno: un turno que no reanuda
 * tampoco *adopta* la sesión que emita su CLI. Si la adoptara, el hilo del
 * pane quedaría apuntando a la subtarea y el siguiente turno humano reanudaría
 * el job del orquestador en vez de su propia conversación.
 */
export function shouldResumeCliSessionForTurn(options: {
  delegation?: unknown
}): boolean {
  return options.delegation == null
}
