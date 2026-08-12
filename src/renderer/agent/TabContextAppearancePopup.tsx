import React, { useEffect, useId, useRef, useState } from 'react'
import type { TabContext } from '@shared/tabContext'
import {
  TAB_CONTEXT_COLORS,
  filterContextIconGroups,
  resolveContextColor,
  resolveContextIcon,
} from '@shared/tabContextAppearance'
import { useT } from '@i18n/useT'
import { Icon } from '../components/ui/Icon'
import { appearanceIconName } from './tabContextKindIcons'
import { TabContextColorSwatch } from './TabContextColorSwatch'
import { TabContextIconSwatch } from './TabContextIconSwatch'
import './TabContextAppearancePopup.css'

export interface TabContextAppearancePopupProps {
  draft: Pick<TabContext, 'name' | 'kind' | 'icon' | 'color'>
  onUpdate: (patch: Partial<TabContext>) => void
}

/**
 * Selector de aspecto (icono + color) como popup bajo el trigger.
 * No empuja el formulario: flota con sombra de modal y cierra con Escape / clic fuera.
 */
export const TabContextAppearancePopup: React.FC<TabContextAppearancePopupProps> = ({
  draft,
  onUpdate,
}) => {
  const { t } = useT()
  const [open, setOpen] = useState(false)
  const [iconQuery, setIconQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const panelId = useId()
  const iconGroups = filterContextIconGroups(iconQuery)
  const chipColor = resolveContextColor(draft)
  const valueLabel = draft.name?.trim() || t(`tabContexts.kind_${draft.kind}`)

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      // TerminalModal también escucha Escape en window capture y se registra
      // antes: stopPropagation no lo frena. Marcamos defaultPrevented aquí y
      // el modal respeta data-escape-layer (ver panel) para no cerrarse.
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
    }
    const onPointerDown = (event: MouseEvent): void => {
      if (rootRef.current?.contains(event.target as Node)) return
      setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('mousedown', onPointerDown, true)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('mousedown', onPointerDown, true)
    }
  }, [open])

  return (
    <div className="tab-context-appearance-popup" ref={rootRef}>
      <button
        type="button"
        className="tab-context-appearance-popup__trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen(prev => !prev)}
      >
        <span
          className="tab-contexts__appearance-chip"
          style={{ '--chip-color': chipColor } as React.CSSProperties}
        >
          <Icon name={appearanceIconName(resolveContextIcon(draft))} size={15} />
        </span>
        <span className="tab-contexts__appearance-title" id={titleId}>
          {t('tabContexts.appearance')}
        </span>
        <small className="tab-contexts__appearance-value">{valueLabel}</small>
      </button>

      {open ? (
        <div
          id={panelId}
          className="tab-context-appearance-popup__panel"
          role="dialog"
          aria-labelledby={titleId}
          data-escape-layer=""
        >
          <fieldset className="tab-contexts__appearance">
            <legend>
              <span>{t('tabContexts.icon')}</span>
              <span className="tab-contexts__icon-search">
                <Icon name="search" size={12} />
                <input
                  type="search"
                  value={iconQuery}
                  placeholder={t('tabContexts.iconSearch')}
                  aria-label={t('tabContexts.iconSearch')}
                  onChange={event => setIconQuery(event.target.value)}
                />
              </span>
            </legend>
            <div
              className="tab-contexts__icon-scroll"
              role="radiogroup"
              aria-label={t('tabContexts.icon')}
            >
              {iconGroups.map(group => (
                <div className="tab-contexts__icon-group" key={group.id}>
                  <span className="tab-contexts__icon-group-label">
                    {t(`tabContexts.iconGroup_${group.id}`)}
                  </span>
                  <div className="tab-contexts__icon-grid">
                    {group.icons.map(icon => (
                      <TabContextIconSwatch
                        key={icon}
                        icon={appearanceIconName(icon)}
                        color={chipColor}
                        title={icon}
                        selected={resolveContextIcon(draft) === icon}
                        onSelect={() => onUpdate({ icon })}
                      />
                    ))}
                  </div>
                </div>
              ))}
              {iconGroups.length === 0 && (
                <p className="tab-contexts__icon-empty">
                  {t('tabContexts.iconNoResults', { query: iconQuery.trim() })}
                </p>
              )}
            </div>
          </fieldset>
          <fieldset className="tab-contexts__appearance">
            <legend><span>{t('tabContexts.color')}</span></legend>
            <div className="tab-contexts__color-grid" role="radiogroup" aria-label={t('tabContexts.color')}>
              {TAB_CONTEXT_COLORS.map(color => {
                const active = chipColor.toLowerCase() === color.toLowerCase()
                return (
                  <TabContextColorSwatch
                    key={color}
                    color={color}
                    selected={active}
                    onSelect={() => onUpdate({ color })}
                  />
                )
              })}
            </div>
          </fieldset>
        </div>
      ) : null}
    </div>
  )
}
