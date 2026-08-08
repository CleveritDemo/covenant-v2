/**
 * Splash de `index.html` (markup + CSS inline, para pintar en el primer frame).
 * No se borra del DOM al arrancar: queda oculto para poder relanzarlo desde
 * Ajustes → Developer sin reiniciar la app.
 */

/**
 * Mínimo en pantalla: montar puede tardar 200ms y el parpadeo se ve peor que la
 * espera. Da además para la entrada de `Gravity` (`gravity-enter`, 2.4s).
 */
export const SPLASH_MIN_MS = 2_600

/** Debe coincidir con la transición de `#splash` en index.html. */
const FADE_MS = 500

function splashEl(): HTMLElement | null {
  return document.getElementById('splash')
}

function hide(el: HTMLElement): void {
  el.classList.add('is-done')
  setTimeout(() => el.classList.add('is-hidden'), FADE_MS)
}

/** Lo funde tras el mínimo en pantalla; llamar al montar la app. */
export function dismissSplash(): void {
  const el = splashEl()
  if (!el) return
  setTimeout(() => hide(el), Math.max(0, SPLASH_MIN_MS - performance.now()))
}

/** Lo vuelve a mostrar un ciclo completo (debug de la animación). */
export function replaySplash(): void {
  const el = splashEl()
  if (!el) return
  el.classList.remove('is-hidden', 'is-done')
  void el.offsetWidth // reinicia las animaciones CSS que estaban en display:none
  setTimeout(() => hide(el), SPLASH_MIN_MS)
}
