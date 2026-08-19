import React from 'react'
import { useT } from '@i18n/useT'

export interface BrainstormModuleTabsProps {
  tab: 'rooms' | 'new'
  /** Actas guardadas del proyecto: el número invita a mirarlas. */
  roomsCount: number
  onRooms: () => void
  onNew: () => void
}

/**
 * Las dos entradas del módulo, en su chrome: la biblioteca y el alta.
 *
 * Antes eran un chip «Salas guardadas» que abría un modal, es decir, otra
 * ventana para algo que es parte del módulo. Como pestañas dicen la verdad: son
 * dos vistas de lo mismo, y volver cuesta un clic en el sitio donde se fue.
 */
export const BrainstormModuleTabs: React.FC<BrainstormModuleTabsProps> = ({
  tab,
  roomsCount,
  onRooms,
  onNew,
}) => {
  const { t } = useT()
  return (
    <span className="brainstorm-overlay__tabs" role="tablist" data-onboarding="brainstorm-module-tabs">
      <button
        type="button"
        role="tab"
        aria-selected={tab === 'rooms'}
        className={[
          'brainstorm-overlay__tab',
          tab === 'rooms' ? 'brainstorm-overlay__tab--on' : '',
        ].filter(Boolean).join(' ')}
        onClick={onRooms}
      >
        {roomsCount > 0
          ? t('tabs.brainstormsSavedCount', { count: String(roomsCount) })
          : t('tabs.brainstormsSaved')}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={tab === 'new'}
        className={[
          'brainstorm-overlay__tab',
          tab === 'new' ? 'brainstorm-overlay__tab--on' : '',
        ].filter(Boolean).join(' ')}
        onClick={onNew}
      >
        {t('tabs.brainstormsCreateNew')}
      </button>
    </span>
  )
}
