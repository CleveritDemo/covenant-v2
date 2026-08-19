import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useT } from '@i18n/useT'
import { TerminalModal } from '../components/TerminalModal'
import { Button } from '../components/ui'
import { Icon, type IconName } from '../components/ui/Icon'
import { arrowHeadPoints, boxFromDrag, ellipseFromDrag } from './sketchGeometry'
import {
  sketchFontSize,
  sketchTextFont,
  sketchTextLineHeight,
  sketchTextLines,
} from './sketchText'
import './SketchModal.css'

export type SketchTool = 'pen' | 'line' | 'arrow' | 'rect' | 'ellipse' | 'text' | 'eraser'

/**
 * Espacio lógico de dibujo; el backing store es 2× para que el trazo quede
 * nítido en retina y el modelo reciba más píxeles (el chip reescala al mostrar).
 */
const CANVAS_WIDTH = 720
const CANVAS_HEIGHT = 400
const HISTORY_CAP = 50
/**
 * ponytail: el lienzo es blanco en cualquier tema y la goma pinta blanco.
 * Es lo correcto para el modelo (los screenshots que se anotan vienen sobre
 * fondo claro). Un lienzo tematizado obligaría a repintar todo el historial al
 * cambiar de tema; si algún día hace falta, ahí está el techo.
 */
const CANVAS_BG = '#ffffff'

const COLORS = ['#1a1a2e', '#e5484d', '#f5a524', '#30a46c', '#3e63dd', '#8e4ec6', '#889096']
/** Grosor lógico y diámetro del punto que lo representa en la barra. */
const WIDTHS: Array<[stroke: number, dot: number]> = [[2, 3], [3, 5], [6, 8]]
const DEFAULT_WIDTH = 3

const TOOLS: Array<{ tool: SketchTool; icon: IconName; shortcut: string }> = [
  { tool: 'pen', icon: 'pencil', shortcut: 'p' },
  { tool: 'line', icon: 'line', shortcut: 'l' },
  { tool: 'arrow', icon: 'arrow', shortcut: 'a' },
  { tool: 'rect', icon: 'square', shortcut: 'r' },
  { tool: 'ellipse', icon: 'circle', shortcut: 'o' },
  { tool: 'text', icon: 'text', shortcut: 't' },
  { tool: 'eraser', icon: 'eraser', shortcut: 'e' },
]

const SHORTCUT_TO_TOOL: Record<string, SketchTool> = Object.fromEntries(
  TOOLS.map(item => [item.shortcut, item.tool]),
)

interface DragState {
  drawing: boolean
  startX: number
  startY: number
  lastX: number
  lastY: number
  /** Snapshot previo al arrastre: las formas se previsualizan encima de él. */
  base: ImageData | null
}

export interface SketchModalProps {
  open: boolean
  onClose: () => void
  /** El PNG dibujado. El modal no sabe nada del composer. */
  onAttach: (blob: Blob) => void
}

/** Ajusta la altura del textarea al contenido. */
function resizeSketchTextInput(el: HTMLTextAreaElement): void {
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

/**
 * Lienzo para dibujar o anotar un screenshot y adjuntarlo como imagen.
 * El estado de dibujo vive en refs: un trazo no debe re-renderizar React.
 */
export const SketchModal: React.FC<SketchModalProps> = ({ open, onClose, onAttach }) => {
  const { t } = useT()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const textInputRef = useRef<HTMLTextAreaElement>(null)
  const suppressTextBlurCommitRef = useRef(false)
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  const undoRef = useRef<ImageData[]>([])
  const redoRef = useRef<ImageData[]>([])
  const dragRef = useRef<DragState>({
    drawing: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    base: null,
  })

  const [tool, setTool] = useState<SketchTool>('pen')
  const [color, setColor] = useState(COLORS[0]!)
  const [width, setWidth] = useState(DEFAULT_WIDTH)
  const [draft, setDraft] = useState<{ x: number; y: number; value: string } | null>(null)
  const [scale, setScale] = useState(1)
  // Solo para habilitar/deshabilitar undo y redo; el historial vive en refs.
  const [historySize, setHistorySize] = useState({ undo: 0, redo: 0 })

  const syncHistory = useCallback((): void => {
    setHistorySize({ undo: undoRef.current.length, redo: redoRef.current.length })
  }, [])

  const paintBackground = useCallback((context: CanvasRenderingContext2D): void => {
    context.fillStyle = CANVAS_BG
    context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    context.lineCap = 'round'
    context.lineJoin = 'round'
  }, [])

  // El canvas se monta con el portal, así que cada apertura arranca en blanco.
  useEffect(() => {
    if (!open) return
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) return
    context.setTransform(1, 0, 0, 1, 0, 0)
    context.scale(2, 2)
    ctxRef.current = context
    paintBackground(context)
    undoRef.current = []
    redoRef.current = []
    setHistorySize({ undo: 0, redo: 0 })
    setTool('pen')
    setColor(COLORS[0]!)
    setWidth(DEFAULT_WIDTH)
    setDraft(null)
    setScale(1)
  }, [open, paintBackground])

  useEffect(() => {
    if (!open) return
    const canvas = canvasRef.current
    if (!canvas) return
    const updateScale = (): void => {
      const rect = canvas.getBoundingClientRect()
      setScale(rect.width / CANVAS_WIDTH)
    }
    updateScale()
    const observer = new ResizeObserver(updateScale)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [open])

  useEffect(() => {
    if (draft == null) return
    const el = textInputRef.current
    if (!el) return
    el.focus()
    resizeSketchTextInput(el)
  }, [draft?.x, draft?.y])

  /** Snapshot plano del lienzo entero antes de cada mutación. Sin modelo de objetos. */
  const snapshot = useCallback((): ImageData | null => {
    const context = ctxRef.current
    const canvas = canvasRef.current
    if (!context || !canvas) return null
    const data = context.getImageData(0, 0, canvas.width, canvas.height)
    undoRef.current.push(data)
    if (undoRef.current.length > HISTORY_CAP) undoRef.current.shift()
    redoRef.current = []
    syncHistory()
    return data
  }, [syncHistory])

  const undo = useCallback((): void => {
    const context = ctxRef.current
    const canvas = canvasRef.current
    if (!context || !canvas) return
    const previous = undoRef.current.pop()
    if (!previous) return
    redoRef.current.push(context.getImageData(0, 0, canvas.width, canvas.height))
    context.putImageData(previous, 0, 0)
    syncHistory()
  }, [syncHistory])

  const redo = useCallback((): void => {
    const context = ctxRef.current
    const canvas = canvasRef.current
    if (!context || !canvas) return
    const next = redoRef.current.pop()
    if (!next) return
    undoRef.current.push(context.getImageData(0, 0, canvas.width, canvas.height))
    context.putImageData(next, 0, 0)
    syncHistory()
  }, [syncHistory])

  const applyStroke = useCallback((context: CanvasRenderingContext2D): void => {
    context.strokeStyle = tool === 'eraser' ? CANVAS_BG : color
    context.lineWidth = tool === 'eraser' ? width * 5 : width
  }, [tool, color, width])

  const positionFrom = (event: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } => {
    const rect = event.currentTarget.getBoundingClientRect()
    return {
      x: (event.clientX - rect.left) * (CANVAS_WIDTH / rect.width),
      y: (event.clientY - rect.top) * (CANVAS_HEIGHT / rect.height),
    }
  }

  const commitText = useCallback((): void => {
    if (!draft) return
    const lines = sketchTextLines(draft.value)
    if (lines.length === 0) {
      setDraft(null)
      return
    }
    const context = ctxRef.current
    if (!context) {
      setDraft(null)
      return
    }
    snapshot()
    const fontPx = sketchFontSize(width)
    context.fillStyle = color
    context.font = sketchTextFont(fontPx)
    context.textBaseline = 'top'
    const lineHeight = sketchTextLineHeight(fontPx)
    lines.forEach((line, index) => {
      context.fillText(line, draft.x, draft.y + index * lineHeight)
    })
    setDraft(null)
  }, [draft, color, width, snapshot])

  const drawShape = (context: CanvasRenderingContext2D, x: number, y: number): void => {
    const drag = dragRef.current
    if (!drag.base) return
    // putImageData ignora la transform: coordenadas en píxeles del backing store.
    context.putImageData(drag.base, 0, 0)
    applyStroke(context)
    context.beginPath()
    if (tool === 'line' || tool === 'arrow') {
      context.moveTo(drag.startX, drag.startY)
      context.lineTo(x, y)
      if (tool === 'arrow') {
        const [left, right] = arrowHeadPoints(drag.startX, drag.startY, x, y, width)
        context.moveTo(x, y)
        context.lineTo(left.x, left.y)
        context.moveTo(x, y)
        context.lineTo(right.x, right.y)
      }
    } else if (tool === 'rect') {
      const box = boxFromDrag(drag.startX, drag.startY, x, y)
      context.rect(box.x, box.y, box.width, box.height)
    } else {
      const oval = ellipseFromDrag(drag.startX, drag.startY, x, y)
      context.ellipse(oval.cx, oval.cy, oval.rx, oval.ry, 0, 0, Math.PI * 2)
    }
    context.stroke()
  }

  const selectTool = useCallback((next: SketchTool): void => {
    commitText()
    setTool(next)
  }, [commitText])

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>): void => {
    if (tool === 'text') {
      event.preventDefault()
      commitText()
      const point = positionFrom(event)
      suppressTextBlurCommitRef.current = true
      setDraft({ x: point.x, y: point.y, value: '' })
      return
    }
    const context = ctxRef.current
    if (!context) return
    event.preventDefault()
    const base = snapshot()
    const point = positionFrom(event)
    dragRef.current = {
      drawing: true,
      startX: point.x,
      startY: point.y,
      lastX: point.x,
      lastY: point.y,
      base: tool === 'pen' || tool === 'eraser' ? null : base,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    if (tool === 'pen' || tool === 'eraser') {
      // Un clic seco debe dejar punto: segmento mínimo con lineCap redondo.
      applyStroke(context)
      context.beginPath()
      context.moveTo(point.x, point.y)
      context.lineTo(point.x + 0.01, point.y)
      context.stroke()
    }
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>): void => {
    const context = ctxRef.current
    const drag = dragRef.current
    if (!context || !drag.drawing) return
    const point = positionFrom(event)
    if (tool === 'pen' || tool === 'eraser') {
      applyStroke(context)
      context.beginPath()
      context.moveTo(drag.lastX, drag.lastY)
      context.lineTo(point.x, point.y)
      context.stroke()
      drag.lastX = point.x
      drag.lastY = point.y
      return
    }
    drawShape(context, point.x, point.y)
  }

  const stopDrawing = (): void => {
    dragRef.current.drawing = false
    dragRef.current.base = null
  }

  const handleTextKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      setDraft(null)
      return
    }
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault()
      commitText()
    }
  }

  const handleTextBlur = (): void => {
    if (suppressTextBlurCommitRef.current) {
      suppressTextBlurCommitRef.current = false
      return
    }
    commitText()
  }

  // Atajos de herramienta y ⌘Z / ⇧⌘Z. Esc y el trap de foco ya los hace el modal.
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return
      const mod = event.metaKey || event.ctrlKey
      if (mod && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) redo()
        else undo()
        return
      }
      if (mod || event.altKey) return
      const next = SHORTCUT_TO_TOOL[event.key.toLowerCase()]
      if (next) {
        event.preventDefault()
        selectTool(next)
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [open, undo, redo, selectTool])

  // ⌘V pega una imagen centrada sobre el lienzo, para anotarla en el sitio.
  useEffect(() => {
    if (!open) return
    const onPaste = (event: ClipboardEvent): void => {
      const item = Array.from(event.clipboardData?.items ?? [])
        .find(entry => entry.type.startsWith('image/'))
      if (!item) return
      event.preventDefault()
      const file = item.getAsFile()
      if (!file) return
      const url = URL.createObjectURL(file)
      const image = new Image()
      image.onload = () => {
        const context = ctxRef.current
        if (context) {
          snapshot()
          const imageScale = Math.min(
            CANVAS_WIDTH / image.width,
            CANVAS_HEIGHT / image.height,
            1,
          )
          const w = image.width * imageScale
          const h = image.height * imageScale
          context.drawImage(image, (CANVAS_WIDTH - w) / 2, (CANVAS_HEIGHT - h) / 2, w, h)
        }
        URL.revokeObjectURL(url)
      }
      image.onerror = () => URL.revokeObjectURL(url)
      image.src = url
    }
    window.addEventListener('paste', onPaste, true)
    return () => window.removeEventListener('paste', onPaste, true)
  }, [open, snapshot])

  const handleClear = (): void => {
    setDraft(null)
    const context = ctxRef.current
    if (!context) return
    snapshot()
    paintBackground(context)
  }

  const handleAttach = (): void => {
    commitText()
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.toBlob(blob => {
      if (blob) onAttach(blob)
      onClose()
    }, 'image/png')
  }

  const draftFontPx = sketchFontSize(width) * scale

  return (
    <TerminalModal
      open={open}
      onClose={onClose}
      title={t('sketch.title')}
      size="xl"
      bodyLayout="flush"
      footer={(
        <div className="sketch-modal__footer">
          <Button variant="ghost" size="sm" onClick={handleClear}>
            {t('sketch.clear')}
          </Button>
          <span className="sketch-modal__hint">{t('sketch.pasteHint')}</span>
          <Button variant="secondary" size="sm" onClick={onClose}>
            {t('sketch.cancel')}
          </Button>
          <Button variant="primary" size="sm" onClick={handleAttach}>
            {t('sketch.attach')}
          </Button>
        </div>
      )}
    >
      <div className="sketch-modal__toolbar" role="toolbar" aria-label={t('sketch.title')}>
        {TOOLS.map(item => {
          const label = `${t(`sketch.tool.${item.tool}`)} — ${item.shortcut.toUpperCase()}`
          return (
            <Button
              key={item.tool}
              variant="icon"
              size="xs"
              pressed={tool === item.tool}
              aria-label={label}
              onClick={() => selectTool(item.tool)}
            >
              <Icon name={item.icon} size={13} />
            </Button>
          )
        })}

        <span className="sketch-modal__sep" aria-hidden="true" />

        {COLORS.map(value => (
          <button
            key={value}
            type="button"
            className="sketch-modal__swatch"
            style={{ '--sketch-swatch': value } as React.CSSProperties}
            data-on={color === value ? '' : undefined}
            aria-pressed={color === value}
            aria-label={t('sketch.color', { color: value })}
            onClick={() => setColor(value)}
          />
        ))}

        <span className="sketch-modal__sep" aria-hidden="true" />

        {WIDTHS.map(([stroke, dot]) => (
          <button
            key={stroke}
            type="button"
            className="sketch-modal__width"
            data-on={width === stroke ? '' : undefined}
            aria-pressed={width === stroke}
            aria-label={t('sketch.width', { n: stroke })}
            onClick={() => setWidth(stroke)}
          >
            <i style={{ width: `${dot}px`, height: `${dot}px` }} />
          </button>
        ))}

        <span className="sketch-modal__history">
          <Button
            variant="icon"
            size="xs"
            disabled={historySize.undo === 0}
            aria-label={t('sketch.undo')}
            onClick={undo}
          >
            <Icon name="undo" size={13} />
          </Button>
          <Button
            variant="icon"
            size="xs"
            disabled={historySize.redo === 0}
            aria-label={t('sketch.redo')}
            onClick={redo}
          >
            <Icon name="redo" size={13} />
          </Button>
        </span>
      </div>

      <div className="sketch-modal__canvas-frame">
        <canvas
          ref={canvasRef}
          className="sketch-modal__canvas"
          width={CANVAS_WIDTH * 2}
          height={CANVAS_HEIGHT * 2}
          data-tool={tool}
          aria-label={t('sketch.canvasLabel')}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={stopDrawing}
          onPointerCancel={stopDrawing}
        />
        {draft != null && (
          <textarea
            ref={textInputRef}
            data-escape-layer
            className="sketch-modal__text-input"
            value={draft.value}
            aria-label={t('sketch.textLabel')}
            style={{
              left: `${(draft.x / CANVAS_WIDTH) * 100}%`,
              top: `${(draft.y / CANVAS_HEIGHT) * 100}%`,
              fontSize: `${draftFontPx}px`,
              lineHeight: 1.25,
              color,
              caretColor: color,
            }}
            onChange={event => {
              const { value } = event.target
              setDraft(current => (current ? { ...current, value } : null))
              resizeSketchTextInput(event.target)
            }}
            onKeyDown={handleTextKeyDown}
            onBlur={handleTextBlur}
          />
        )}
      </div>
    </TerminalModal>
  )
}
