/** z-index for body-portaled overlays (Git panel, file explorer). Above pane windows (≥140). */
export const APP_OVERLAY_MODAL_Z = 670

/** Chat del plano (dock + composer): encima de pane windows (140), debajo de chrome del plano (210). */
export const PLANE_CHAT_STACK_Z = 200

/**
 * Barras del plano (top-left, pool de contextos): encima del chat (200), debajo de badges wiki (300).
 * Jerarquía: mapa 16 → ventanas 140 → chat 200 → chrome 210 → badges 300 → curador 400 → modales 670.
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
