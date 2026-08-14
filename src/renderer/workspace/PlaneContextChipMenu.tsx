import React, { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Icon, type IconName } from '../components/ui'
import './PlaneContextChipMenu.css'

export interface PlaneContextChipMenuItem {
  key: string
  label: string
  icon: IconName
  danger?: boolean
  onSelect: () => void
}

export interface PlaneContextChipMenuProps {
  anchor: Pick<DOMRect, 'left' | 'top' | 'right' | 'bottom'>
  items: PlaneContextChipMenuItem[]
  onClose: () => void
}

const MENU_WIDTH = 148
const MENU_ITEM_HEIGHT = 28
const MENU_MARGIN = 8

/**
 * Menú contextual de un chip del pool. Portal al body para no recortarse en la
 * barra glass con overflow.
 */
export const PlaneContextChipMenu: React.FC<PlaneContextChipMenuProps> = ({
  anchor,
  items,
  onClose,
}) => {
  const menuRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onCloseRef.current()
      }
    }
    const onPointerDown = (event: MouseEvent): void => {
      if (menuRef.current?.contains(event.target as Node)) return
      onCloseRef.current()
    }
    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('mousedown', onPointerDown, true)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('mousedown', onPointerDown, true)
    }
  }, [])

  const left = Math.max(
    MENU_MARGIN,
    Math.min(anchor.left, window.innerWidth - MENU_WIDTH - MENU_MARGIN),
  )
  const top = Math.min(
    anchor.bottom + 4,
    window.innerHeight - items.length * MENU_ITEM_HEIGHT - MENU_MARGIN,
  )

  return createPortal(
    <div
      ref={menuRef}
      className="plane-context-chip-menu"
      role="menu"
      style={{ left: `${left}px`, top: `${Math.max(MENU_MARGIN, top)}px` }}
    >
      {items.map((item, index) => (
        <React.Fragment key={item.key}>
          {item.danger && index > 0 ? <hr className="plane-context-chip-menu__rule" /> : null}
          <button
            type="button"
            role="menuitem"
            className={item.danger
              ? 'plane-context-chip-menu__item plane-context-chip-menu__item--danger'
              : 'plane-context-chip-menu__item'}
            onClick={() => {
              onCloseRef.current()
              item.onSelect()
            }}
          >
            <Icon name={item.icon} size={12} />
            {item.label}
          </button>
        </React.Fragment>
      ))}
    </div>,
    document.body,
  )
}
