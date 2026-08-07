# Errores conocidos y mitigaciones

Historial de fallos reproducibles en **Electron + macOS** (y en parte multiplataforma) relacionados con **xterm.js**, **PTY / IPC**, **foco del teclado**, composición de Chromium y temas. Sirve para evitar regresiones al cambiar CSS, temas o el ciclo de vida del panel de terminal.

---

## 1. Terminal xterm: no se ve lo que se escribe (“muerta” pero el PTY sí responde)

### Síntomas

- Al teclear, **no aparece texto** en la pantalla del terminal.
- A menudo **sí** hay señales de que el proceso recibe entrada (historial, sugerencias, comandos ejecutándose, eco del shell por otros medios).
- Puede ser **intermitente**, aparecer tras cambiar de tema, redimensionar, cambiar de pestaña/split o tras hot-reload en desarrollo.

### Qué *no* suele ser

- No es necesariamente fallo del shell, de `node-pty` ni del IPC de escritura al PTY.

### Causas probables (varias pueden coexistir)

| Área | Descripción |
|------|-------------|
| **Compositing / canvas** | xterm dibuja en **canvas** dentro del renderer. En Electron, capas con **transparencia**, **`backdrop-filter`** (blur) o **vibrancy** del sistema mezcladas con esa zona hacen que el **bitmap del canvas deje de actualizarse** aunque el modelo interno de xterm siga correcto. |
| **Orden en el event loop** | xterm v5 aplaza parte del trabajo de `term.write()` con `setTimeout`. Un **`requestAnimationFrame` suelto** que llama a `refresh()` **antes** de que esa escritura termine puede repintar **un frame vacío o viejo**. Por eso el repintado útil debe enlazarse al **callback de `term.write()`** cuando la entrada viene del PTY. |
| **Foco / overlays** | Otro elemento captura el teclado o un overlay bloquea interacción: mismo síntoma visual para el usuario pero la causa es **foco** o **`pointer-events`**, no el canvas. |
| **`refresh()` sobre instancia disposed** | En React (p. ej. `StrictMode`), montajes y desmontajes dobles: si un RAF usa **`termRef`** apuntando a una terminal ya **`dispose()`**, se puede corromper el estado del renderer. |

### Mitigaciones implementadas en el código

| Ubicación | Qué hace |
|-----------|----------|
| `electron/main.ts` | En macOS, **no** usar `vibrancy` / `visualEffectState` en `BrowserWindow` cuando hay terminal canvas (comentarios en código). |
| `src/themes/presets.ts` | Eliminado el tema **Apple Liquid Glass** (`appleLiquidGlass`). Función **`normalizeThemeId()`**: si el `themeId` guardado ya no existe en `THEMES`, se usa `vscodeDark`. |
| `src/renderer/App.tsx` | Al cargar la config: **`normalizeThemeId(cfg.themeId)`**; si cambia el id, **`setConfig({ themeId })`** para persistir y evitar configs huérfanas. |
| `src/renderer/terminal/TerminalPane.tsx` | **`writePtyDataWithFollowScroll(term, data, afterParsed?)`**: siempre pasa **callback** a `term.write()`; ahí se hace scroll al fondo cuando corresponde y **`scheduleTerminalCanvasRepaint`** (tras procesar la escritura). El callback va envuelto en **`try/catch`** para que **`scrollToBottom()`** no reviente si el viewport aún no tiene `dimensions` (dispose / carrera). Repintado al teclear en **`term.onData`** con **`termAlive`** y **`termRef.current === term`** en RAFs. Limpieza: **`termAlive = false`**, cancelar RAF pendiente, **`termRef`/`fitRef` → null** antes de **`term.dispose()`**. Tras **`PTY_EXIT`**, **re-lanzar shell** en el mismo `sessionId` si el panel sigue montado (ver **§2**). |
| `src/renderer/terminal/TerminalPane.css` | **`isolation: isolate`** en `.terminal-container` para aislar la composición del área del canvas respecto al resto del chrome. |
| `src/renderer/main.tsx` | Sin hoja global “liquid glass”; los temas restantes no fuerzan transparencia en la raíz para ese caso. |

### Regresiones que ya vimos

- **Quitar solo el CSS del tema** sin **normalizar `themeId`** en disco dejó usuarios con `"appleLiquidGlass"` en `config.json` mientras el renderer ya no aplicaba mitigaciones solo para ese tema: conviene que **`normalizeThemeId` + persistencia** sigan siempre activos.
- Llamar **`scheduleTerminalCanvasRepaint()`** solo **después** de `writePtyDataWithFollowScroll` **sin** pasarlo como callback de **`term.write`** volvía a dejar el canvas desfasado respecto al buffer.

### Si vuelve el problema tras cambios de UI

1. Revisar **`backdrop-filter`** en elementos que envuelvan o floten sobre **`.terminal-container` / `.xterm`**.
2. Mantener fondos **opacos** en la cadena DOM que rodea el canvas del terminal.
3. Evitar en el contenedor directo del xterm **`transform`**, **`filter`** o **`will-change`** que fuercen capas GPU problemáticas en tu versión de Electron/Chromium.
4. Confirmar que **`writePtyDataWithFollowScroll`** sigue pasando el repintado **dentro** del callback de **`term.write()`**.

---

## 2. Terminal sin eco tras `[proceso terminado]` (PTY desaparece del mapa)

### Síntomas

- Tras el mensaje **`[proceso terminado — código …]`**, al teclear **no se ve nada** en xterm.
- A veces **sí** se actualizan sugerencias / “recientes” (el renderer sigue recibiendo **`term.onData`** y llama a **`ptyWrite`**, pero en **main** ya no hay proceso asociado al `sessionId`).
- Comandos raros en historial (fragmentos pegados) si el usuario sigue escribiendo “contra” un PTY inexistente.

### Causa

En **`electron/main.ts`**, al salir el proceso del shell, **`ptySessions.delete(sessionId)`** dejaba de haber destino para **`PTY_WRITE`**. El eco deja de llegar porque **no hay shell** que responda; no es un fallo del canvas en sí.

### Mitigación

| Archivo | Qué hace |
|---------|----------|
| `electron/main.ts` | En **`proc.onExit`**: solo se quita la entrada del **mapa de PTY**; **no** se llama a **`clearSessionCdState`** ahí, para que **`GET_SESSION_CWD`** siga devolviendo el cwd lógico al **recrear** el shell. **`killPty()`** (cierre explícito de pestaña / nuevo `pty:create`) **siempre** ejecuta **`clearSessionCdState`**, incluso si el proceso ya no estaba en el mapa. |
| `src/renderer/terminal/TerminalPane.tsx` | En el handler de **`PTY_EXIT`**: tras escribir el mensaje en xterm, **`getSessionCwd` → `ptyCreate` → `fitTerminalPreserveScroll` → `ptyResize`** con **`Math.max(1, cols/rows)`**, en **doble `requestAnimationFrame`**, con comprobaciones **`termAlive`**, **`termRef.current === term`** y **`containerRef.current?.isConnected`** para no respawnear si el panel ya se desmontó. |

### Regresión a evitar

- Volver a borrar el **cwd lógico** en **`onExit`** del PTY rompe el respawn con la carpeta correcta.
- Respawn **síncrono** inmediato tras salida puede chocar con xterm sin dimensiones: por eso el **doble rAF** y el **fit** antes del resize.

---

## 3. `TypeError: Cannot read properties of undefined (reading 'dimensions')` (xterm `Viewport.syncScrollArea`)

### Síntomas

- Error en consola del renderer apuntando a **`@xterm/xterm`** / **`Viewport.syncScrollArea`**.
- Suele aparecer al **redimensionar**, **scroll**, **cerrar pestaña** o **recrear el PTY** en carrera con el ciclo de vida de React.

### Causa

Llamadas a **`scrollToBottom`**, **`refresh`**, **`fit`** o listeners (**`ResizeObserver`**, scroll del viewport) sobre una instancia de **`Terminal`** ya **inválida** o con **0 filas/columnas**, o RAFs pendientes tras **`dispose()`**.

### Mitigaciones en `TerminalPane.tsx`

- **`termAlive`** al **inicio** del `useEffect` del terminal (antes de registrar listeners).
- **`updateTerminalScrollDown`**, **`scheduleScrollDownIndicator`**, **`scheduleTerminalCanvasRepaint`**, **`ResizeObserver`** y **`onPtyData` / `onPtyExit` / `onPtyError`**: comprobar **`termAlive`** y **`termRef.current === term`** antes de tocar xterm; **`try/catch`** donde aplique.
- **`fitTerminalPreserveScroll`**: envuelto en **`try/catch`**.
- **`ptyResize`**: usar **`Math.max(1, term.cols)`** y **`Math.max(1, term.rows)`** en todos los sitios que redimensionan el PTY.

---

## 4. Teclado no llega al shell (foco fuera del textarea de xterm)

### Síntomas

- No se escribe en el terminal **ni** se actualizan sugerencias (o solo una de las dos, según el caso).
- Tras usar la **barra de IA**, **modales** o botones de la **barra de título**, el foco puede quedarse en un **`role="button"`** o en **`document.body`**.

### Mitigación

| Archivo | Qué hace |
|---------|----------|
| `src/renderer/components/AiPanel.tsx` | Cabecera del panel IA: **`tabIndex={-1}`** para que no robe el foco del flujo de tabulación respecto al textarea de xterm (el atajo **⌘I** sigue abriendo/cerrando el chat). |
| `src/renderer/App.tsx` | Botones de la barra (tamaño de fuente, tema, ajustes) y **`TitlebarMusicControls`**: **`tabIndex={-1}`** donde corresponde. **`focusActiveTerminalTextarea()`** al cerrar **Ajustes** y **selector de tema** (y equivalente cuando haga falta) para devolver el foco al **`.xterm-helper-textarea`** de la pestaña activa. |

---

## 5. Migración de `themeId` obsoleto

Si `~/Library/Application Support/Covenant Gravity/config.json` (ruta típica en macOS) contiene **`themeId`** igual a un tema eliminado (p. ej. `appleLiquidGlass`) o a un id desconocido, al arrancar la app:

1. Se normaliza a **`vscodeDark`** en memoria.
2. Se llama a **`setConfig({ themeId: 'vscodeDark' })`** para **persistir** el cambio.

El usuario puede elegir otro tema en el modal de temas.

---

## Cómo ampliar este documento

Al cerrar un bug que sea **arquitectónico** (Electron, foco, persistencia, PTY), añadir aquí una sección corta con síntoma → causa → archivo/clase responsable de la mitigación.
