import { computePlaneMiniSlotCell } from '@shared/paneWindows'

/**
 * Alto de una tarjeta de asiento en la columna de la sala.
 *
 * Es la misma ranura que el plano de codificación da a sus minis
 * (`computePlaneMiniSlotCell`): se aprieta para que quepan las N del turno y,
 * cuando toca el mínimo, deja de encogerse y la columna scrollea. La sala no
 * inventa su propia escala: nueve asientos se comportan como tres.
 */
export function brainstormSeatCellHeight(
  viewportHeight: number,
  seatCount: number,
): number {
  return computePlaneMiniSlotCell(
    { width: 1280, height: Math.max(240, viewportHeight) },
    seatCount,
  ).height
}

/**
 * Qué se puede permitir la tarjeta a ese alto. El recorte va por este orden:
 * primero desaparece la última línea del turno, después el rol. El nombre y el
 * estado no se caen nunca — sin ellos la tarjeta deja de decir quién habla.
 */
export type BrainstormSeatTier = 'compact' | 'default' | 'roomy'

export function brainstormSeatTier(cellHeight: number): BrainstormSeatTier {
  if (cellHeight >= 178) return 'roomy'
  if (cellHeight >= 146) return 'default'
  return 'compact'
}
