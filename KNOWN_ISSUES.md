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
| `src/renderer/terminal/terminalCanvasRepaint.ts` | **`repaintTerminalCanvas`**: `syncScrollArea` + `refresh` + `clearTextureAtlas` tras fit/refit, botón ↓ o salida PTY. |
| `src/renderer/terminal/terminalFitScheduler.ts` | Tras ajustar scroll en `fitTerminalPreserveScroll`, llama a **`repaintTerminalCanvas`** para evitar canvas negro sin cambio de filas visibles. |
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

## 6. Chat IA: salto de scroll al terminar la respuesta

### Síntomas

- Al finalizar el streaming en el panel IA expandido, la lista de mensajes (`.ai-messages`) **salta hacia arriba** en lugar de quedarse al fondo.
- Suele ocurrir con **thinking** activo: al colapsarse el bloque `<details>` el contenido pierde altura en el mismo instante en que el efecto de scroll intentaba animar.

### Causa

| Área | Descripción |
|------|-------------|
| **Scroll animado** | `scrollTo({ behavior: 'smooth' })` al pasar `isStreaming` a `false` compite con un `scrollHeight` que acaba de encogerse; Chromium/Electron puede resetear `scrollTop` a `0` antes de animar. |
| **Layout del thinking** | `AiThinkingBlock` cerraba el `<details>` en el mismo frame que el scroll final. |
| **Refit del xterm (secundario)** | Si el dock IA colapsado cambia de altura y el terminal hace `fit()`, restaurar `viewportY` antiguo alejaba el viewport del prompt cuando el usuario seguía la salida. |

### Mitigaciones

| Archivo | Qué hace |
|---------|----------|
| `src/renderer/components/ai/aiMessagesScroll.ts` | Scroll instantáneo al fondo, clamp de `scrollTop`, doble `rAF`; `wasStreamingRef` fuerza un último scroll al terminar. |
| `src/renderer/components/AiThinkingBlock.tsx` | Colapsa el bloque thinking **dos frames** después de fin de streaming. |
| `src/renderer/terminal/terminalFitScheduler.ts` | Tras `fit()`, si `shouldStickTerminalToBottom` es true, usa `followTerminalOutput` en lugar de `scrollToLine(savedTop)`. |
| `src/renderer/terminal/TerminalPane.tsx` | Al cambiar `--terminal-ai-dock-reserve` (dock colapsado), programa un `refit` del xterm en el frame siguiente para realinear scroll tras el cambio de padding. |
| `src/renderer/components/ai/useAiMessagesFollowScroll.ts` | Hook del auto-scroll del chat (streaming + último frame al terminar). |

---

## 7. Terminal xterm: salto al inicio del scrollback con agente / salida PTY

### Síntomas

- Mientras un **agente** (o cualquier proceso) escribe salida en la terminal, el viewport **salta al principio** del scrollback (línea más antigua visible).
- Suele coincidir con el **dock IA colapsado** creciendo al streamear la respuesta del chat (cada mensaje nuevo cambia `--terminal-ai-dock-reserve` → `fit()` del xterm).

### Causa

| Área | Descripción |
|------|-------------|
| **Desfase buffer / DOM** | Durante streaming, xterm puede dejar el scrollbar DOM abajo mientras `viewportY` en el buffer va retrasado respecto a `baseY`. |
| **`fit()` tras resize del dock** | `fitTerminalPreserveScroll` solo miraba `shouldFollowTerminalOutput` (buffer). Si el buffer iba retrasado, restauraba `scrollToLine(savedTop)` con `savedTop === 0` → salto al inicio. |
| **`syncScrollArea` en repintado** | Cada chunk PTY programaba `repaintTerminalCanvas` → `syncScrollArea`, compitiendo con el auto-follow del callback de `term.write`. |
| **`writePtyDataWithFollowScroll` solo miraba buffer** | Con lag buffer/DOM no seguía la salida y podía marcar `userDetached` vía `updateFollowDetachedState`. |

### Mitigaciones

| Archivo | Qué hace |
|---------|----------|
| `src/renderer/terminal/terminalFollowScroll.ts` | **`shouldStickTerminalToBottom`**: además del buffer, si el DOM está abajo y el usuario no se desenganchó, mantener el prompt tras `fit()`. **`writePtyDataWithFollowScroll`** y **`updateFollowDetachedState`** usan el mismo criterio para no marcar `userDetached` ni dejar de seguir durante lag buffer/DOM. |
| `src/renderer/terminal/terminalFitScheduler.ts` | Usa `shouldStickTerminalToBottom` antes de decidir `followTerminalOutput` vs `scrollToLine`. Repintado tras stick omite `syncScrollArea`. |
| `src/renderer/terminal/terminalCanvasRepaint.ts` | Omite `syncScrollArea` mientras hay auto-follow activo, scroll programático o **`shouldStickTerminalToBottom`**. |
| `src/renderer/terminal/terminalWheelScroll.ts` | `reconcileTerminalScrollIfDomAtBottom` también respeta `shouldStickTerminalToBottom` para no competir con el follow. |
| `src/renderer/terminal/TerminalPane.tsx` | El scheduler de repintado recibe `followState`; `runScrollSync` usa `shouldStickTerminalToBottom`. |

---

## 8. Terminal xterm: oscilación arriba/abajo del scroll al streamear un agente

### Síntomas

- Con un **agente** (Claude Code u otro TUI) streameando salida en la terminal, el viewport **salta arriba y abajo** varias veces por segundo (no un salto único como §7, sino oscilación continua).
- Empeora con el **dock IA colapsado** creciendo a cada token (refits en ráfaga).

### Causa

| Área | Descripción |
|------|-------------|
| **`syncScrollArea` post-write** | El repintado tras cada chunk PTY (`scheduleAfterWrite`) solo omitía `syncScrollArea` si `shouldStickTerminalToBottom` era true **en ese instante** (2 rAF después del write). Mid-stream hay ventanas donde el buffer va retrasado > slack **y** el `scrollHeight` DOM acaba de crecer (DOM ya no «abajo») → stick evalúa false → `syncScrollArea(true)` alinea el `scrollTop` con el `viewportY` retrasado = **salto arriba**; el callback del siguiente `term.write` vuelve a bajar = oscilación por frame. |
| **`clearTextureAtlas` por chunk** | Re-rasterizar todos los glifos en cada chunk PTY tira frames, agranda el desfase buffer/DOM y amplía esas ventanas. |
| **ResizeObserver del contenedor sin coalescer** | El debounce de 80 ms del dock (`scheduleRefitAfterDockLayout`) era inútil: el cambio de `--terminal-ai-dock-reserve` también dispara el ResizeObserver del contenedor → `fitScheduler.schedule()` **por frame** → reflow + `ptyResize` (SIGWINCH) por token → el TUI redibuja entero → más churn de scroll. |

### Mitigaciones

| Archivo | Qué hace |
|---------|----------|
| `src/renderer/terminal/terminalCanvasRepaint.ts` | Los repintados **post-write nunca** llaman a `syncScrollArea` (la posición pertenece al follow del callback de `term.write` y al sync interno de xterm). `clearTextureAtlas` en post-write como mucho cada `ATLAS_CLEAR_MIN_INTERVAL_MS` (500 ms); `schedule()` (fit/tema/tab) mantiene el comportamiento completo de §1. |
| `src/renderer/terminal/terminalFitScheduler.ts` | `schedule()` coalesce ráfagas: un fit como mucho cada `FIT_BURST_COALESCE_MS` (100 ms) cuando llegan resizes continuos; `runNow()` sigue siendo inmediato y cancela el fit en ráfaga pendiente. |

### Regresión a evitar

- Volver a sincronizar el viewport (`syncScrollArea`) desde el camino post-write «solo cuando no hay stick»: el estado de stick es transitorio durante streaming y la ventana false reintroduce la oscilación.

---

## Cómo ampliar este documento

Al cerrar un bug que sea **arquitectónico** (Electron, foco, persistencia, PTY), añadir aquí una sección corta con síntoma → causa → archivo/clase responsable de la mitigación.
