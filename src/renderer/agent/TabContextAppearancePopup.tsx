import React, { useId, useState } from 'react'
import type { TabContext } from '@shared/tabContext'
import {
  TAB_CONTEXT_COLORS,
  filterContextIconGroups,
  resolveContextColor,
  resolveContextIcon,
} from '@shared/tabContextAppearance'
import { useT } from '@i18n/useT'
import { TerminalModal } from '../components/TerminalModal'
import { Icon } from '../components/ui/Icon'
import { appearanceIconName } from './tabContextKindIcons'
import { TabContextColorSwatch } from './TabContextColorSwatch'
import { TabContextIconSwatch } from './TabContextIconSwatch'
import './TabContextAppearancePopup.css'

/** Por encima del formulario de contexto (z=920). */
const APPEARANCE_MODAL_Z = 940

export interface TabContextAppearancePopupProps {
  draft: Pick<TabContext, 'name' | 'kind' | 'icon' | 'color'>
  onUpdate: (patch: Partial<TabContext>) => void
}

/**
 * Selector de aspecto (icono + color) como modal anidado delante de todo.
 * El trigger vive en el formulario; el panel sale por portal con scrim propio.
 */
export const TabContextAppearancePopup: React.FC<TabContextAppearancePopupProps> = ({
  draft,
  onUpdate,
}) => {
  const { t } = useT()
  const [open, setOpen] = useState(false)
  const [iconQuery, setIconQuery] = useState('')
  const titleId = useId()
  const iconGroups = filterContextIconGroups(iconQuery)
  const chipColor = resolveContextColor(draft)
  const valueLabel = draft.name?.trim() || t(`tabContexts.kind_${draft.kind}`)

  return (
    <div className="tab-context-appearance-popup">
      <button
        type="button"
        className="tab-context-appearance-popup__trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? titleId : undefined}
        onClick={() => setOpen(true)}
      >
        <span
          className="tab-contexts__appearance-chip"
          style={{ '--chip-color': chipColor } as React.CSSProperties}
        >
          <Icon name={appearanceIconName(resolveContextIcon(draft))} size={15} />
        </span>
        <span className="tab-contexts__appearance-title">
          {t('tabContexts.appearance')}
        </span>
        <small className="tab-contexts__appearance-value">{valueLabel}</small>
      </button>

      <TerminalModal
        open={open}
        onClose={() => setOpen(false)}
        title={t('tabContexts.appearance')}
        titleId={titleId}
        size="md"
        zIndex={APPEARANCE_MODAL_Z}
        closeOnEscape
        closeOnBackdrop
        bodyLayout="spacious"
      >
        <div className="tab-context-appearance-popup__body">
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
      </TerminalModal>
    </div>
  )
}
