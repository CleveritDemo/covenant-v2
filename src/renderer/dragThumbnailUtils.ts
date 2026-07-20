export const PANE_DRAG_THUMB_W = 280
export const PANE_DRAG_THUMB_HEADER_H = 24
export const PANE_DRAG_THUMB_CONTENT_H = 128

/**
 * Captura los canvas de xterm como bitmap plano.
 * No clonar el DOM de xterm: los contextos WebGL en cloneNode/setDragImage
 * provocan VALIDATION_ERROR_DESERIALIZATION_FAILED y matan el renderer en Electron.
 */
export function snapshotXtermCanvases(root: HTMLElement): HTMLCanvasElement | null {
  const screen =
    root.querySelector('.xterm .xterm-screen') ??
    root.querySelector('.xterm-screen')
  if (!screen) return null

  const canvases = Array.from(screen.querySelectorAll('canvas')).filter(
    c => c.width > 0 && c.height > 0,
  )
  if (canvases.length === 0) return null

  const w = canvases[0]!.width
  const h = canvases[0]!.height

  const out = document.createElement('canvas')
  out.width = w
  out.height = h
  const ctx = out.getContext('2d')
  if (!ctx) return null

  const bg = getComputedStyle(root).backgroundColor
  ctx.fillStyle = bg && bg !== 'rgba(0, 0, 0, 0)' ? bg : '#0d0d14'
  ctx.fillRect(0, 0, w, h)

  for (const canvas of canvases) {
    try {
      ctx.drawImage(canvas, 0, 0)
    } catch {
      /* canvas WebGL sin snapshot legible */
    }
  }

  return out
}

function appendScaledSnapshot(
  contentEl: HTMLElement,
  snapshot: HTMLCanvasElement,
  maxW: number,
  maxH: number,
): void {
  const scale = Math.min(maxW / snapshot.width, maxH / snapshot.height)
  const img = document.createElement('img')
  img.draggable = false
  img.src = snapshot.toDataURL('image/png')
  img.style.cssText = [
    'position:absolute', 'top:0', 'left:0',
    `width:${snapshot.width}px`, `height:${snapshot.height}px`,
    `transform:scale(${scale})`, 'transform-origin:top left',
    'pointer-events:none',
  ].join(';')
  contentEl.appendChild(img)
}

function appendPlaceholder(contentEl: HTMLElement): void {
  const placeholder = document.createElement('div')
  placeholder.style.cssText =
    'width:100%;height:100%;display:flex;align-items:center;justify-content:center'
  placeholder.innerHTML =
    '<span style="color:var(--text-muted,#7878a8);font-family:monospace;font-size:22px;opacity:.4">&gt;_</span>'
  contentEl.appendChild(placeholder)
}

function findActivePaneCell(paneId: string): HTMLElement | null {
  const escaped = CSS.escape(paneId)
  return document.querySelector(
    `.tab-terminal-group--active .tab-terminal-pane-cell[data-pane-id="${escaped}"]`,
  )
}

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

/** Miniatura flotante al reordenar paneles (HTML5 setDragImage). */
export function buildPaneDragThumbnail(paneId: string): HTMLElement {
  const cell = findActivePaneCell(paneId)
  const pane = cell?.querySelector('.terminal-pane') as HTMLElement | null
  const label =
    cell?.querySelector('.pane-toolbar__folder-label')?.textContent?.trim() || 'Terminal'

  const root = document.createElement('div')
  root.style.cssText = [
    'position:fixed', 'top:-9999px', 'left:-9999px',
    `width:${PANE_DRAG_THUMB_W}px`,
    'border-radius:8px', 'overflow:hidden',
    'box-shadow:0 10px 32px rgba(0,0,0,.72)',
    'background:var(--bg,#0d0d14)',
    'pointer-events:none',
    'border:1px solid rgba(255,255,255,.1)',
  ].join(';')

  const header = document.createElement('div')
  header.style.cssText = [
    `height:${PANE_DRAG_THUMB_HEADER_H}px`,
    'background:color-mix(in srgb, var(--bg,#0d0d14) 52%, transparent)',
    'border-bottom:1px solid color-mix(in srgb, var(--border,#2a2a42) 42%, transparent)',
    'display:flex', 'align-items:center', 'justify-content:center',
    'padding:0 10px',
    'font-family:var(--font-mono, ui-monospace, monospace)',
    'font-size:11px',
    'color:color-mix(in srgb, var(--text-muted,#7878a8) 90%, var(--text,#e2e2f0))',
    'white-space:nowrap', 'overflow:hidden', 'text-overflow:ellipsis',
  ].join(';')
  header.textContent = label
  root.appendChild(header)

  const contentEl = document.createElement('div')
  contentEl.style.cssText = [
    `width:${PANE_DRAG_THUMB_W}px`, `height:${PANE_DRAG_THUMB_CONTENT_H}px`,
    'overflow:hidden', 'position:relative',
    'background:var(--bg,#0d0d14)',
  ].join(';')

  const snapshot = pane ? snapshotXtermCanvases(pane) : null
  if (snapshot) {
    appendScaledSnapshot(contentEl, snapshot, PANE_DRAG_THUMB_W, PANE_DRAG_THUMB_CONTENT_H)
  } else {
    appendPlaceholder(contentEl)
  }

  root.appendChild(contentEl)
  return root
}
