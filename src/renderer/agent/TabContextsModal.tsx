import React, { useEffect, useRef, useState } from 'react'
import type { TabContext } from '@shared/tabContext'
import type { ProjectAgentDefinition } from '@shared/projectAgentCatalog'
import { toggleAgentContextId } from '@shared/tabContextAgentUsage'
import { useT } from '@i18n/useT'
import { TerminalModal } from '../components/TerminalModal'
import { ConfirmTerminalModal } from '../components/ConfirmTerminalModal'
import { TabContextFormModal, type TabContextFormMode } from './TabContextFormModal'
import { TabContextsList } from './TabContextsList'
import { TabContextsListPreview } from './TabContextsListPreview'

interface Props {
  open: boolean
  /** Catálogo vivo leído desde `.gravity/*.md`. */
  contexts: TabContext[]
  /** Agentes del proyecto: CLI y rol para las filas de results. */
  agents?: ProjectAgentDefinition[]
  /** Carpeta del proyecto (cwd de contextos y materialización). */
  cwd: string
  /** Al abrir, selecciona este contexto para editar. */
  focusContextId?: string | null
  onFocusContextConsumed?: () => void
  /** Al abrir, salta directo al formulario de creación. */
  openCreate?: boolean
  onRefresh: () => void
  /** Un agente cambió sus `contextIds` desde el listado; el dueño del catálogo lo aplica. */
  onAgentSaved?: (agent: ProjectAgentDefinition) => void
  /** Progreso del alta de contexto para el coach del onboarding. */
  onFormDraftChange?: (draft: { kindPicked: boolean; nameFilled: boolean }) => void
  onClose: () => void
}

type FormSession =
  | { mode: 'create' }
  | { mode: 'edit'; context: TabContext }

export const TabContextsModal: React.FC<Props> = ({
  open,
  contexts,
  agents,
  cwd,
  focusContextId = null,
  onFocusContextConsumed,
  openCreate = false,
  onRefresh,
  onAgentSaved,
  onFormDraftChange,
  onClose,
}) => {
  const { t } = useT()
  const [formSession, setFormSession] = useState<FormSession | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [listError, setListError] = useState('')
  const [pendingDelete, setPendingDelete] = useState<TabContext | null>(null)
  /** true si el form se abrió por focusContextId (plano); false si desde el listado. */
  const formOpenedFromFocusRef = useRef(false)

  useEffect(() => {
    if (!open) {
      setFormSession(null)
      setSelectedId(null)
      setListError('')
      setPendingDelete(null)
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

  // Entrada directa desde el «+» del plano: cerrar el form cierra todo el modal.
  useEffect(() => {
    if (!open || !openCreate) return
    formOpenedFromFocusRef.current = true
    setFormSession({ mode: 'create' })
  }, [open, openCreate])

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

  /** Aplica o quita el contexto al agente sin salir del listado. */
  const toggleAgentContext = async (
    agent: ProjectAgentDefinition,
    context: TabContext,
  ): Promise<void> => {
    const workingCwd = resolveCwd()
    if (!workingCwd) {
      setListError(t('tabContexts.missingCwd'))
      return
    }
    try {
      const result = await window.api.upsertProjectAgent(
        workingCwd,
        toggleAgentContextId(agent, context.id),
      )
      if (!result.ok) {
        setListError(result.error ?? t('tabContexts.previewError'))
        return
      }
      setListError('')
      onAgentSaved?.(result.agent)
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
            agents={agents}
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
            onDelete={setPendingDelete}
          />
          <TabContextsListPreview
            context={selectedContext}
            cwd={resolveCwd()}
            agents={agents}
            {...(onAgentSaved
              ? { onToggleAgent: (agent, context) => { void toggleAgentContext(agent, context) } }
              : {})}
          />
          {listError && (
            <p className="tab-contexts__list-error" role="alert">{listError}</p>
          )}
        </div>
      </TerminalModal>
      {/* zIndex 920: encima del listado (900), como el form. Con 710 el
          confirm quedaba tapado y la papelera parecía no hacer nada. */}
      <ConfirmTerminalModal
        open={Boolean(pendingDelete)}
        zIndex={920}
        message={t('tabs.planeConfirmDeleteContextMessage', {
          name: pendingDelete?.name ?? '',
        })}
        detail={t('tabs.planeConfirmDeleteContextDetail')}
        onConfirm={() => {
          const target = pendingDelete
          setPendingDelete(null)
          if (target) void removeContext(target)
        }}
        onCancel={() => setPendingDelete(null)}
      />
      <TabContextFormModal
        open={open && formSession !== null}
        mode={formMode}
        context={formContext}
        contexts={contexts}
        cwd={cwd}
        onRefresh={onRefresh}
        {...(onFormDraftChange ? { onDraftChange: onFormDraftChange } : {})}
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
