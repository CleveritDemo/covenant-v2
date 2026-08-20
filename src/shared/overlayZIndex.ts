/** z-index for body-portaled overlays (Git panel, file explorer). Above pane windows (≥140). */
export const APP_OVERLAY_MODAL_Z = 670

/**
 * Coach mark del onboarding in-plane: por encima de BrainstormOverlay (670) y de los
 * haces de asignación elevados (671), y por debajo de fab/pool elevated (675),
 * PlaneContextChipMenu (676), modales de sala (680), pool (690), chrome (700) y
 * Tooltip (1000).
 */
export const ONBOARDING_COACH_MARK_Z = APP_OVERLAY_MODAL_Z + 4

/**
 * Chrome de nivel app (titlebar, theme picker, scope de resync, aviso de actualización).
 * Por encima de los overlays del plano (APP_OVERLAY_MODAL_Z = 670) y de los modales
 * internos de la sala y del explorador (680); por debajo de SettingsModal (720) para
 * que Ajustes siga ganando si se abre encima.
 */
export const APP_CHROME_MODAL_Z = 700

/** Chat del plano (dock + composer): encima del backdrop (16), debajo de stage chat-open (202). */
export const PLANE_CHAT_STACK_Z = 200

/** Stage con ventana abierta: por encima del composer (200), debajo del chrome (210). */
export const PLANE_ELEVATED_MAP_Z = 205

/**
 * Barras del plano (top-left, pool de contextos): encima del chat (200), debajo de badges wiki (300).
 * Jerarquía: backdrop 16 → chat 200 → stage chat-open 202 → stage elevado 205 → chrome 210 → badges 300 → curador 400 → modales 670.
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
