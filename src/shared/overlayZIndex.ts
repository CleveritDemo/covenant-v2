/** z-index for body-portaled overlays (Git panel, file explorer). Above pane windows (≥140). */
export const APP_OVERLAY_MODAL_Z = 670

/** Chat del plano (dock + composer): encima de minis del mapa (16), debajo de ventana abierta (205). */
export const PLANE_CHAT_STACK_Z = 200

/** Mapa con ventana abierta: encima del chat/composer (200), debajo del chrome (210). */
export const PLANE_ELEVATED_MAP_Z = 205

/**
 * Barras del plano (top-left, pool de contextos): encima del chat (200), debajo de badges wiki (300).
 * Jerarquía: mapa 16 → chat 200 → mapa elevado 205 → chrome 210 → badges 300 → curador 400 → modales 670.
 */
export const PLANE_CHROME_STACK_Z = 210

/**
 * Techo de la pila de modales: la confirmación de salida. Cualquier otro modal
 * (el más alto hoy es 920) debe quedar por debajo — se pide cerrar la app
 * mientras hay uno abierto y la pregunta tiene que verse, no esconderse tras
 * el que estabas usando. Si algún modal nuevo necesita subir, sube por debajo
 * de este número, no por encima.
 */
export const QUIT_CONFIRM_Z = 990
