/**
 * Tope global de turnos headless concurrentes (brainstorm, loops, etc.).
 * Los runners en main esperan en cola FIFO si ya hay tres activos.
 */
export const MAX_CONCURRENT_HEADLESS_TURNS = 3
