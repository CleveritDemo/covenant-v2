/** Fuente única JS: atributo DOM (App ORa con OS) o matchMedia de respaldo. */
export function isReduceMotionActive(): boolean {
  if (typeof document !== 'undefined'
    && document.documentElement.getAttribute('data-reduce-motion') === 'true') {
    return true
  }
  return typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Aplica o quita data-reduce-motion según preferencia de app u OS. */
export function syncReduceMotionDomFlag(appReduceMotion: boolean): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return
  const osReduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const reduce = appReduceMotion || osReduce
  if (reduce) {
    document.documentElement.setAttribute('data-reduce-motion', 'true')
  } else {
    document.documentElement.removeAttribute('data-reduce-motion')
  }
  // El splash de index.html pinta antes de que exista la config: lo lee de aquí.
  try { localStorage.setItem('splashReduceMotion', String(reduce)) } catch { /* ignore */ }
}
