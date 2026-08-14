import React, { useEffect, useId, useRef, useState } from 'react'
import { PlaneBusyDot } from '../../workspace/PlaneBusyDot'
import { Icon } from './Icon'
import './Select.css'

export type SelectSize = 'sm' | 'md'
/**
 * `ghost` es para barras de acciones donde todo es fantasma hasta encenderse:
 * ahí una caja con borde es el único elemento que rompe la gramática.
 */
export type SelectVariant = 'default' | 'ghost' | 'badge'

export interface SelectOption {
  value: string
  label: string
  /** Segunda línea de la opción, p. ej. el id real del modelo. */
  hint?: string
  /** Punto luminoso a la izquierda del label (p. ej. hilo trabajando). */
  busy?: boolean
}

export interface SelectProps {
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  size?: SelectSize
  variant?: SelectVariant
  disabled?: boolean
  /** Se muestra cuando `value` no corresponde a ninguna opción. */
  placeholder?: string
  id?: string
  title?: string
  'aria-label'?: string
}

/** Dónde cabe el panel: debajo salvo que el disparador esté pegado al borde inferior.
 *  `top`/`bottom` siempre van explícitos: el UA de [popover] deja inset:0 y, si
 *  omitimos top al abrir hacia arriba, el panel se clava al techo del viewport. */
function panelPlacement(trigger: DOMRect): {
  top: number | 'auto'
  bottom: number | 'auto'
  maxHeight: number
} {
  const GAP = 4
  const below = window.innerHeight - trigger.bottom - GAP * 2
  const above = trigger.top - GAP * 2
  if (below < 180 && above > below) {
    return {
      top: 'auto',
      bottom: window.innerHeight - trigger.top + GAP,
      maxHeight: Math.min(above, 320),
    }
  }
  return { top: trigger.bottom + GAP, bottom: 'auto', maxHeight: Math.min(below, 320) }
}

/**
 * Listbox propio en lugar de `<select>`: en macOS el desplegable nativo lo pinta
 * el sistema y no respeta el tema de la app.
 *
 * El panel usa la Popover API (`popover="auto"`), así que vive en el top layer:
 * no lo recorta el `overflow` de los modales y el cierre por clic fuera y Escape
 * los da el navegador.
 */
export const Select: React.FC<SelectProps> = ({
  value,
  options,
  onChange,
  size = 'md',
  variant = 'default',
  disabled = false,
  placeholder,
  id,
  title,
  'aria-label': ariaLabel,
}) => {
  const panelId = `select-panel-${useId().replace(/:/g, '')}`
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [box, setBox] = useState<React.CSSProperties>({})
  const [active, setActive] = useState(0)

  const selectedIndex = options.findIndex(option => option.value === value)
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null
  /** El listener nativo de `toggle` se registra una vez; lee el índice por ref. */
  const selectedIndexRef = useRef(selectedIndex)
  selectedIndexRef.current = selectedIndex

  // `toggle` del popover por listener nativo: React 18 aún no lo tipa para un div.
  useEffect(() => {
    const panel = panelRef.current
    if (!panel) return
    const onToggle = (event: Event): void => {
      const nowOpen = (event as ToggleEvent).newState === 'open'
      setOpen(nowOpen)
      if (!nowOpen) return
      const trigger = triggerRef.current?.getBoundingClientRect()
      if (trigger) {
        const { top, bottom, maxHeight } = panelPlacement(trigger)
        // Ancho del disparador como mínimo, pero el panel crece con su contenido
        // (un disparador estrecho no debe recortar cada opción a puntos suspensivos).
        setBox({
          top,
          bottom,
          left: trigger.left,
          right: 'auto',
          minWidth: trigger.width,
          maxWidth: Math.max(trigger.width, Math.min(460, window.innerWidth - trigger.left - 8)),
          maxHeight,
        })
      }
      setActive(selectedIndexRef.current >= 0 ? selectedIndexRef.current : 0)
      // El panel toma el foco para que las flechas funcionen sin tabular por las opciones.
      requestAnimationFrame(() => panel.focus())
    }
    panel.addEventListener('toggle', onToggle)
    return () => panel.removeEventListener('toggle', onToggle)
  }, [])

  // El cursor de teclado sigue visible al recorrer una lista larga. El resaltado
  // del ratón es :hover en CSS, así que mover el ratón no mueve el scroll.
  useEffect(() => {
    if (!open) return
    panelRef.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  /**
   * Cierre fiable: en Electron/Chromium, hidePopover() durante el click de una
   * opción puede fallar o el click “cae” al invoker (popovertarget=toggle) y
   * reabre. setOpen(false) defiende el aria-expanded; preventDefault en
   * pointerdown de la opción evita el re-toggle.
   */
  const close = (): void => {
    setOpen(false)
    const panel = panelRef.current
    if (!panel) return
    try {
      if (typeof panel.hidePopover === 'function') panel.hidePopover()
    } catch {
      /* popover ya cerrado / no soportado */
    }
  }

  const pick = (option: SelectOption): void => {
    onChange(option.value)
    close()
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    const last = options.length - 1
    if (last < 0) return
    switch (event.key) {
      case 'ArrowDown': event.preventDefault(); setActive(i => Math.min(i + 1, last)); break
      case 'ArrowUp': event.preventDefault(); setActive(i => Math.max(i - 1, 0)); break
      case 'Home': event.preventDefault(); setActive(0); break
      case 'End': event.preventDefault(); setActive(last); break
      case 'Enter':
      case ' ': event.preventDefault(); pick(options[active]); break
      default: break
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className={`select select--${size} select--${variant}`}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        popovertarget={panelId}
      >
        <span className="select__value" data-placeholder={selected ? undefined : true}>
          {selected ? (
            <span className="select__value-row">
              {selected.busy ? <PlaneBusyDot size="sm" /> : null}
              <span className="select__value-label">{selected.label}</span>
            </span>
          ) : (placeholder ?? value)}
        </span>
        <Icon name="chevron-down" size={variant === 'ghost' || variant === 'badge' ? 12 : 14} aria-hidden />
      </button>

      <div
        ref={panelRef}
        id={panelId}
        popover="auto"
        className="select-panel"
        style={box}
        role="listbox"
        tabIndex={-1}
        aria-label={ariaLabel ?? title}
        onKeyDown={handleKeyDown}
      >
        {options.map((option, index) => (
          <div
            key={option.value}
            role="option"
            aria-selected={option.value === value}
            className="select-panel__option"
            data-active={index === active || undefined}
            data-index={index}
            onPointerDown={event => {
              // Evita que el click cierre+reabra vía el invoker debajo del top layer.
              event.preventDefault()
            }}
            onClick={event => {
              event.preventDefault()
              event.stopPropagation()
              pick(option)
            }}
          >
            <span className="select-panel__check">
              {option.value === value ? <Icon name="check" size={12} aria-hidden /> : null}
            </span>
            <span className="select-panel__text">
              <span className="select-panel__label-row">
                {option.busy ? <PlaneBusyDot size="sm" /> : null}
                <span className="select-panel__label">{option.label}</span>
              </span>
              {option.hint ? <span className="select-panel__hint">{option.hint}</span> : null}
            </span>
          </div>
        ))}
      </div>
    </>
  )
}
