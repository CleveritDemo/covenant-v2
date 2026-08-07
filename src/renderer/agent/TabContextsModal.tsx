import React, { useEffect, useRef, useState } from 'react'
import type { TabContext } from '@shared/tabContext'
import { useT } from '@i18n/useT'
import { TerminalModal } from '../components/TerminalModal'
import { TabContextFormModal, type TabContextFormMode } from './TabContextFormModal'
import { TabContextsList } from './TabContextsList'
import { TabContextsListPreview } from './TabContextsListPreview'

interface Props {
  open: boolean
  /** Catálogo vivo leído desde `.iaterminal/*.md`. */
  contexts: TabContext[]
  /** Carpeta del proyecto (cwd de contextos y materialización). */
  cwd: string
  /** Al abrir, selecciona este contexto para editar. */
  focusContextId?: string | null
  onFocusContextConsumed?: () => void
  onRefresh: () => void
  onClose: () => void
}

type FormSession =
  | { mode: 'create' }
  | { mode: 'edit'; context: TabContext }

export const TabContextsModal: React.FC<Props> = ({
  open,
  contexts,
  cwd,
  focusContextId = null,
  onFocusContextConsumed,
  onRefresh,
  onClose,
}) => {
  const { t } = useT()
  const [formSession, setFormSession] = useState<FormSession | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [listError, setListError] = useState('')
  /** true si el form se abrió por focusContextId (plano); false si desde el listado. */
  const formOpenedFromFocusRef = useRef(false)

  useEffect(() => {
    if (!open) {
      setFormSession(null)
      setSelectedId(null)
      setListError('')
      formOpenedFromFocusRef.current = false
    }
  }, [open])

  useEffect(() => {
    if (!open || !focusContextId) return
    const target = contexts.find(context => context.id === focusContextId)
    if (!target) {
      if (contexts.length > 0) onFocusContextConsumed?.()
      return
    }
    formOpenedFromFocusRef.current = true
    setSelectedId(target.id)
    setFormSession({ mode: 'edit', context: target })
    onFocusContextConsumed?.()
  }, [open, focusContextId, contexts, onFocusContextConsumed])

  // Sin selección el panel derecho no dice nada útil: cae en el primero.
  // Después del efecto de focusContextId, que tiene prioridad sobre esto.
  useEffect(() => {
    if (!open || selectedId || focusContextId || contexts.length === 0) return
    setSelectedId(contexts[0].id)
  }, [open, selectedId, focusContextId, contexts])

  // La selección puede apuntar a un contexto ya borrado o renombrado.
  useEffect(() => {
    if (!selectedId || contexts.some(context => context.id === selectedId)) return
    setSelectedId(null)
  }, [selectedId, contexts])

  const resolveCwd = (): string => (cwd ?? '').trim()

  const removeContext = async (context: TabContext): Promise<void> => {
    const workingCwd = resolveCwd()
    if (!workingCwd) {
      setListError(t('tabContexts.missingCwd'))
      return
    }
    try {
      const result = await window.api.deleteTabContext({ context, cwd: workingCwd })
      if (!result.ok) {
        setListError(result.error ?? t('tabContexts.previewError'))
        return
      }
      if (formSession?.mode === 'edit' && formSession.context.id === context.id) {
        setFormSession(null)
      }
      if (selectedId === context.id) setSelectedId(null)
      setListError('')
      onRefresh()
    } catch (error) {
      setListError(error instanceof Error ? error.message : t('tabContexts.previewError'))
    }
  }

  const formMode: TabContextFormMode = formSession?.mode ?? 'create'
  const formContext = formSession?.mode === 'edit' ? formSession.context : null
  const selectedContext = selectedId
    ? contexts.find(context => context.id === selectedId) ?? null
    : null

  return (
    <>
      <TerminalModal
        open={open && formSession === null}
        onClose={onClose}
        title={t('tabContexts.title')}
        titleId="tab-contexts-title"
        size="xl"
        bodyLayout="flush"
        zIndex={900}
        closeOnBackdrop
      >
        <div className="tab-contexts tab-contexts--list">
          <TabContextsList
            contexts={contexts}
            selectedId={selectedId}
            onNew={() => {
              formOpenedFromFocusRef.current = false
              setFormSession({ mode: 'create' })
            }}
            onSelect={setSelectedId}
            onEdit={context => {
              formOpenedFromFocusRef.current = false
              setSelectedId(context.id)
              setFormSession({ mode: 'edit', context })
            }}
            onDelete={removeContext}
          />
          <TabContextsListPreview context={selectedContext} cwd={resolveCwd()} />
          {listError && (
            <p className="tab-contexts__list-error" role="alert">{listError}</p>
          )}
        </div>
      </TerminalModal>
      <TabContextFormModal
        open={open && formSession !== null}
        mode={formMode}
        context={formContext}
        contexts={contexts}
        cwd={cwd}
        onRefresh={onRefresh}
        onClose={() => {
          if (formOpenedFromFocusRef.current) {
            formOpenedFromFocusRef.current = false
            setFormSession(null)
            onClose()
            return
          }
          setFormSession(null)
        }}
      />
    </>
  )
}
