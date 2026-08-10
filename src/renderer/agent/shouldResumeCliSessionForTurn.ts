/**
 * Subtareas del orquestador deben arrancar CLI fresco (sin --resume).
 * Turnos humanos y orchestrationFollowUp en el mismo pane sí reanudan sesión.
 */
export function shouldResumeCliSessionForTurn(options: {
  delegation?: unknown
}): boolean {
  return options.delegation == null
}
