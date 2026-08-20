/** z-index for body-portaled overlays (Git panel, file explorer). Above pane windows (≥140). */
export const APP_OVERLAY_MODAL_Z = 670

/**
 * Coach mark del onboarding in-plane. Va por encima de TODO lo que puede llevar
 * un ancla: plano y su chrome (≤675), BrainstormOverlay (670), modales de sala
 * (680), pool (690), chrome de app (700) y los modales de contextos (listado
 * 900, formulario y confirm 920) — el paso de crear contexto ancla en los
 * botones de ese formulario. Debajo del confirm de salida (990) y del Tooltip
 * (1000). Es inerte (velo sin pointer-events), así que estar arriba no bloquea.
 */
export const ONBOARDING_COACH_MARK_Z = 930

/**
 * Confirmaciones de cierre de pane/hilo (ConfirmTerminalModal por defecto). Se
 * piden con el módulo de brainstorm (670), el chrome de app (700) o un coach
 * mark (930) en pantalla y la pregunta tiene que verse: por encima de todo eso y
 * por debajo del confirm de salida (990).
 */
export const PANE_CONFIRM_MODAL_Z = 940

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
