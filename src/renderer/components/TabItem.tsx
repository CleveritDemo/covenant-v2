import React, { useCallback, useRef } from 'react'
import type { TabSession } from '../App'
import { useT } from '@i18n/useT'
import { Icon } from './ui/Icon'
import { Tooltip } from './ui/Tooltip'
import { PlaneBusyDot } from '../workspace/PlaneBusyDot'

interface TabItemProps {
  tab: TabSession
  /** Posición 1-based en la barra (⌘1…⌘9) */
  tabNumber: number
  isActive: boolean
  isDragOver: boolean
  dragOverPlace: 'before' | 'after' | null
  isBusy: boolean
  isEditing: boolean
  /** Si false, el título no es editable (workspace org sin permiso). */
  titleEditable?: boolean
  editDraft: string
  editInputRef: React.RefObject<HTMLInputElement>
  onSelect: () => void
  onStartEdit: (e: React.MouseEvent) => void
  onEditDraftChange: (value: string) => void
  onEditCommit: () => void
  onEditCancel: () => void
  onClose: () => void
  onDragStart: (e: React.DragEvent) => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
  onDragEnd: () => void
  onDragLeave: (e: React.DragEvent) => void
  skipBlurCommitRef: React.MutableRefObject<boolean>
}

export const TabItem: React.FC<TabItemProps> = ({
  tab,
  tabNumber,
  isActive,
  isDragOver,
  dragOverPlace,
  isBusy,
  isEditing,
  titleEditable = true,
  editDraft,
  editInputRef,
  onSelect,
  onStartEdit,
  onEditDraftChange,
  onEditCommit,
  onEditCancel,
  onClose,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onDragLeave,
  skipBlurCommitRef,
}) => {
  const { t } = useT()
  const canEditTitle = isActive && titleEditable

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (canEditTitle && (e.key === 'Enter' || e.key === ' ')) {
      if (!isEditing) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
  }, [canEditTitle, isEditing])

  const handleMouseEnter = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const distances = {
      left: x,
      right: rect.width - x,
      top: y,
      bottom: rect.height - y,
    }
    const side = (Object.entries(distances).sort((a, b) => a[1] - b[1])[0]?.[0] ?? 'left') as
      | 'left'
      | 'right'
      | 'top'
      | 'bottom'
    const style = e.currentTarget.style

    if (side === 'left') {
      style.setProperty('--tab-fill-bg-position', 'left top')
      style.setProperty('--tab-fill-bg-size', '0% 100%')
      style.setProperty('--tab-fill-bg-hover-size', '100% 100%')
      style.setProperty('--tab-fill-border-origin', 'left center')
      return
    }
    if (side === 'right') {
      style.setProperty('--tab-fill-bg-position', 'right top')
      style.setProperty('--tab-fill-bg-size', '0% 100%')
      style.setProperty('--tab-fill-bg-hover-size', '100% 100%')
      style.setProperty('--tab-fill-border-origin', 'right center')
      return
    }

    style.setProperty('--tab-fill-bg-position', side === 'top' ? 'left top' : 'left bottom')
    style.setProperty('--tab-fill-bg-size', '100% 0%')
    style.setProperty('--tab-fill-bg-hover-size', '100% 100%')
    style.setProperty('--tab-fill-border-origin', x < rect.width / 2 ? 'left center' : 'right center')
  }, [])

  return (
    <div
      className={[
        'tab',
        isActive ? 'tab--active' : '',
        isDragOver && dragOverPlace === 'before' ? 'tab--drag-over-before' : '',
        isDragOver && dragOverPlace === 'after' ? 'tab--drag-over-after' : '',
      ].filter(Boolean).join(' ')}
      draggable={!isEditing}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onDragLeave={onDragLeave}
      onClick={() => { if (!isEditing) onSelect() }}
      onMouseEnter={handleMouseEnter}
    >
      {isBusy ? (
        <span className="tab-busy" aria-label={t('tabs.spinnerAriaLabel')}>
          <PlaneBusyDot />
        </span>
      ) : (
        <span className="tab-icon" aria-hidden="true">
          <Icon
            name={
              tab.paneKinds?.[tab.activePaneId] === 'agent' ||
              Object.values(tab.paneKinds ?? {}).includes('agent')
                ? 'workspace'
                : 'terminal'
            }
            size={11}
          />
        </span>
      )}

      {isEditing ? (
        <input
          ref={editInputRef}
          className="tab-title tab-title-input"
          value={editDraft}
          aria-label={t('tabs.tabNameAriaLabel')}
          onChange={e => onEditDraftChange(e.target.value)}
          onBlur={() => {
            if (skipBlurCommitRef.current) {
              skipBlurCommitRef.current = false
              return
            }
            onEditCommit()
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); onEditCommit() }
            if (e.key === 'Escape') { e.preventDefault(); onEditCancel() }
          }}
          onClick={e => e.stopPropagation()}
          onMouseDown={e => e.stopPropagation()}
          spellCheck={false}
          maxLength={40}
        />
      ) : (
        // `Tooltip` con content vacío devuelve solo los children, así que el
        // envoltorio no cuesta nada cuando no hay pista que mostrar.
        <Tooltip content={isActive && !titleEditable ? t('tabs.tabNameLockedOrgHint') : ''}>
          <span
            className={['tab-title', canEditTitle ? 'tab-title--editable' : ''].filter(Boolean).join(' ')}
            role={canEditTitle ? 'button' : undefined}
            tabIndex={canEditTitle ? 0 : undefined}
            onClick={canEditTitle ? onStartEdit : undefined}
            onKeyDown={canEditTitle ? handleKeyDown : undefined}
          >
            {tab.title}
          </span>
        </Tooltip>
      )}

      {!isEditing && (
        <span className="tab-number" aria-label={t('tabs.tabAriaLabel', { n: tabNumber })}>
          {tabNumber}
        </span>
      )}

      <TabCloseButton title={t('tabs.closeTabTitle')} onClose={onClose} />
    </div>
  )
}

interface TabCloseButtonProps {
  title: string
  onClose: () => void
}

const TabCloseButton: React.FC<TabCloseButtonProps> = ({ title, onClose }) => (
  <span
    className="tab-close"
    role="button"
    onClick={e => { e.stopPropagation(); onClose() }}
  >
    <Icon name="close" size={10} />
  </span>
)
