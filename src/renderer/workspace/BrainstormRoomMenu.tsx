import React, { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Icon, type IconName } from '../components/ui'
import './BrainstormRoomMenu.css'

export interface BrainstormRoomMenuItem {
  key: string
  label: string
  icon: IconName
  danger?: boolean
  onSelect: () => void
}

export interface BrainstormRoomMenuProps {
  /** Rect del botón `⋯`: el menú se ancla a su esquina inferior derecha. */
  anchor: { right: number; bottom: number }
  items: BrainstormRoomMenuItem[]
  onClose: () => void
}

const MENU_WIDTH = 190
const MENU_MARGIN = 8

/**
 * Menú de acciones secundarias de una sala. En portal con coords fijas porque
 * la lista tiene `overflow: auto` y lo recortaría en la última fila.
 */
export const BrainstormRoomMenu: React.FC<BrainstormRoomMenuProps> = ({
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

  const left = Math.max(MENU_MARGIN, Math.min(anchor.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - MENU_MARGIN))
  const top = Math.min(anchor.bottom + 4, window.innerHeight - items.length * 34 - MENU_MARGIN)

  return createPortal(
    <div
      ref={menuRef}
      className="brainstorm-room-menu"
      role="menu"
      style={{ left: `${left}px`, top: `${Math.max(MENU_MARGIN, top)}px` }}
    >
      {items.map((item, index) => (
        <React.Fragment key={item.key}>
          {item.danger && index > 0 ? <hr className="brainstorm-room-menu__rule" /> : null}
          <button
            type="button"
            role="menuitem"
            className={item.danger
              ? 'brainstorm-room-menu__item brainstorm-room-menu__item--danger'
              : 'brainstorm-room-menu__item'}
            onClick={() => {
              onCloseRef.current()
              item.onSelect()
            }}
          >
            <Icon name={item.icon} size={14} />
            {item.label}
          </button>
        </React.Fragment>
      ))}
    </div>,
    document.body,
  )
}
