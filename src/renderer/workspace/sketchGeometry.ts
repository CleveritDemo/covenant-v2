/**
 * Geometría del lienzo de sketch: puro, sin canvas ni React, para poder testear
 * las formas sin montar el modal.
 */

export interface SketchPoint {
  x: number
  y: number
}

export interface SketchBox {
  x: number
  y: number
  width: number
  height: number
}

export interface SketchEllipse {
  cx: number
  cy: number
  rx: number
  ry: number
}

/**
 * Los dos extremos de la punta de flecha, medidos hacia atrás desde el destino.
 * El largo crece con el trazo para que una flecha gruesa no pierda la punta.
 */
export function arrowHeadPoints(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  stroke: number,
): [SketchPoint, SketchPoint] {
  const angle = Math.atan2(toY - fromY, toX - fromX)
  const length = 9 + stroke * 2
  const spread = 0.45
  return [
    { x: toX - length * Math.cos(angle - spread), y: toY - length * Math.sin(angle - spread) },
    { x: toX - length * Math.cos(angle + spread), y: toY - length * Math.sin(angle + spread) },
  ]
}

/** Caja normalizada: arrastrar en cualquier dirección da ancho y alto positivos. */
export function boxFromDrag(x0: number, y0: number, x1: number, y1: number): SketchBox {
  return {
    x: Math.min(x0, x1),
    y: Math.min(y0, y1),
    width: Math.abs(x1 - x0),
    height: Math.abs(y1 - y0),
  }
}

/**
 * Caja centrada para pegar una imagen en el lienzo: reduce si hace falta, nunca amplía.
 */
export function fitImageBox(
  imageWidth: number,
  imageHeight: number,
  canvasWidth: number,
  canvasHeight: number,
): SketchBox {
  if (
    !Number.isFinite(imageWidth) ||
    !Number.isFinite(imageHeight) ||
    !Number.isFinite(canvasWidth) ||
    !Number.isFinite(canvasHeight) ||
    imageWidth <= 0 ||
    imageHeight <= 0 ||
    canvasWidth <= 0 ||
    canvasHeight <= 0
  ) {
    return { x: 0, y: 0, width: 0, height: 0 }
  }
  const scale = Math.min(canvasWidth / imageWidth, canvasHeight / imageHeight, 1)
  const width = imageWidth * scale
  const height = imageHeight * scale
  return {
    x: (canvasWidth - width) / 2,
    y: (canvasHeight - height) / 2,
    width,
    height,
  }
}

/** Elipse inscrita en la caja del arrastre. */
export function ellipseFromDrag(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): SketchEllipse {
  return {
    cx: (x0 + x1) / 2,
    cy: (y0 + y1) / 2,
    rx: Math.abs(x1 - x0) / 2,
    ry: Math.abs(y1 - y0) / 2,
  }
}
