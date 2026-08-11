/** z-index for body-portaled overlays (Git panel, file explorer). Above pane windows (≥140). */
export const APP_OVERLAY_MODAL_Z = 670

/**
 * Techo de la pila de modales: la confirmación de salida. Cualquier otro modal
 * (el más alto hoy es 920) debe quedar por debajo — se pide cerrar la app
 * mientras hay uno abierto y la pregunta tiene que verse, no esconderse tras
 * el que estabas usando. Si algún modal nuevo necesita subir, sube por debajo
 * de este número, no por encima.
 */
export const QUIT_CONFIRM_Z = 990
