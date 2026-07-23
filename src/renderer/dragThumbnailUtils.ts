/** Miniatura flotante al reordenar pestañas: clona la propia tab de la barra. */
export function buildTabDragThumbnail(sourceTab: HTMLElement): HTMLElement {
  const w = sourceTab.offsetWidth
  const h = sourceTab.offsetHeight

  const root = document.createElement('div')
  root.style.cssText = [
    'position:fixed', 'top:-9999px', 'left:-9999px',
    `width:${w}px`, `height:${h}px`,
    'pointer-events:none',
    'box-shadow:0 8px 28px rgba(0,0,0,.55)',
    'border:1px solid color-mix(in srgb, var(--border,#2a2a42) 70%, transparent)',
  ].join(';')

  const clone = sourceTab.cloneNode(true) as HTMLElement
  clone.classList.remove('tab--drag-over-before', 'tab--drag-over-after')
  clone.style.cssText = [
    `width:${w}px`, `height:${h}px`,
    'min-width:unset', 'max-width:none',
    'flex-shrink:0', 'pointer-events:none',
    'margin:0', 'border-right:none',
  ].join(';')

  const close = clone.querySelector('.tab-close') as HTMLElement | null
  if (close) close.style.opacity = '1'

  root.appendChild(clone)
  return root
}
