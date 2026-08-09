import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { TabSession } from '../App'
import { useT } from '@i18n/useT'
import { ConfirmTerminalModal } from './ConfirmTerminalModal'
import { TabItem } from './TabItem'
import { TabAddButton } from './TabAddButton'
import { buildTabDragThumbnail } from '../dragThumbnailUtils'
import { dropPlaceFromPointer, isDragLeaveForContainer } from '../arrayReorder'
import './TabBar.css'

interface Props {
  tabs: TabSession[]
  activeTabId: string
  onSelect: (id: string) => void
  onAdd: () => void
  onClose: (id: string) => void
  onRename: (id: string, name: string) => void
  onReorder: (dragId: string, dropId: string, place: 'before' | 'after') => void
  busyTabIds: Set<string>
  /** False = no iniciar edición inline (p. ej. workspace org sin permiso). */
  canRenameTab?: (tab: TabSession) => boolean
}

/** Expuesto a `App` para que ⌘W use el mismo modal que la cruz de la pestaña. */
export interface TabBarHandle {
  requestCloseTab: (tabId: string) => void
}

export const TabBar = forwardRef<TabBarHandle, Props>(function TabBar({
  tabs, activeTabId, onSelect, onAdd, onClose, onRename, onReorder, busyTabIds,
  canRenameTab,
}, ref) {
  const { t } = useT()
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [dragOverPlace, setDragOverPlace] = useState<'before' | 'after'>('before')
  const [editingTabId, setEditingTabId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [closeTabConfirm, setCloseTabConfirm] = useState<{ id: string; title: string } | null>(null)
  const inlineRenameRef = useRef<HTMLInputElement>(null)
  const skipBlurCommitRef = useRef(false)

  useEffect(() => {
    if (!editingTabId) return
    const el = inlineRenameRef.current
    if (!el) return
    el.focus()
    el.select()
  }, [editingTabId])

  const beginEditTab = useCallback((tab: TabSession): void => {
    if (canRenameTab && !canRenameTab(tab)) return
    onSelect(tab.id)
    setEditingTabId(tab.id)
    setEditDraft(tab.title)
  }, [canRenameTab, onSelect])

  const commitInlineRename = useCallback((): void => {
    if (!editingTabId) return
    const id = editingTabId
    const next = editDraft.trim()
    setEditingTabId(null)
    if (next) onRename(id, next)
  }, [editingTabId, editDraft, onRename])

  const cancelInlineRename = useCallback((): void => {
    skipBlurCommitRef.current = true
    setEditingTabId(null)
  }, [])

  useImperativeHandle(ref, () => ({
    requestCloseTab: (tabId: string): void => {
      const match = tabs.find(t => t.id === tabId)
      if (match) setCloseTabConfirm({ id: match.id, title: match.title })
    },
  }), [tabs])

  return (
    <>
      <div className="tabbar">
        <div className="tabbar-scroll">
          {tabs.map((tab, index) => {
            const titleEditable = !canRenameTab || canRenameTab(tab)
            return (
              <TabItem
                key={tab.id}
                tab={tab}
                tabNumber={index + 1}
                isActive={tab.id === activeTabId}
                isDragOver={dragOverId === tab.id && dragId !== tab.id}
                dragOverPlace={dragOverId === tab.id && dragId !== tab.id ? dragOverPlace : null}
                isBusy={busyTabIds.has(tab.id)}
                isEditing={editingTabId === tab.id}
                titleEditable={titleEditable}
                editDraft={editDraft}
                editInputRef={inlineRenameRef}
                skipBlurCommitRef={skipBlurCommitRef}
                onSelect={() => onSelect(tab.id)}
                onStartEdit={e => {
                  e.preventDefault()
                  e.stopPropagation()
                  beginEditTab(tab)
                }}
                onEditDraftChange={setEditDraft}
                onEditCommit={commitInlineRename}
                onEditCancel={cancelInlineRename}
                onClose={() => setCloseTabConfirm({ id: tab.id, title: tab.title })}
                onDragStart={e => {
                  if (editingTabId) { e.preventDefault(); return }
                  setDragId(tab.id)
                  e.dataTransfer.effectAllowed = 'move'
                  const tabEl = e.currentTarget as HTMLElement
                  const thumb = buildTabDragThumbnail(tabEl)
                  document.body.appendChild(thumb)
                  e.dataTransfer.setDragImage(
                    thumb,
                    tabEl.offsetWidth / 2,
                    tabEl.offsetHeight / 2,
                  )
                  requestAnimationFrame(() => { document.body.removeChild(thumb) })
                }}
                onDragOver={e => {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                  const place = dropPlaceFromPointer(e.clientX, (e.currentTarget as HTMLElement).getBoundingClientRect())
                  if (dragOverId !== tab.id) setDragOverId(tab.id)
                  if (dragOverPlace !== place) setDragOverPlace(place)
                }}
                onDrop={e => {
                  e.preventDefault()
                  if (dragId && dragId !== tab.id) {
                    const place = dropPlaceFromPointer(e.clientX, (e.currentTarget as HTMLElement).getBoundingClientRect())
                    onReorder(dragId, tab.id, place)
                  }
                  setDragId(null)
                  setDragOverId(null)
                }}
                onDragEnd={() => { setDragId(null); setDragOverId(null) }}
                onDragLeave={e => {
                  if (!isDragLeaveForContainer(e.currentTarget as HTMLElement, e.relatedTarget)) return
                  if (dragOverId === tab.id) setDragOverId(null)
                }}
              />
            )
          })}
        </div>
        <TabAddButton onClick={onAdd} />
      </div>

      <ConfirmTerminalModal
        open={closeTabConfirm !== null}
        message={closeTabConfirm ? t('tabs.confirmCloseMessage', { title: closeTabConfirm.title }) : ''}
        detail={t('tabs.confirmCloseDetail')}
        onConfirm={() => {
          if (closeTabConfirm) onClose(closeTabConfirm.id)
          setCloseTabConfirm(null)
        }}
        onCancel={() => setCloseTabConfirm(null)}
      />
    </>
  )
})
