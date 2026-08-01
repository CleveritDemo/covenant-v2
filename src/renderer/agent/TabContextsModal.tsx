import React, { useEffect, useRef, useState } from 'react'
import type { TabContext } from '@shared/tabContext'
import { collectAutoAnnotationKeys } from '@shared/tabContext'
import { useT } from '@i18n/useT'
import { TerminalModal } from '../components/TerminalModal'
import { TabContextFormModal, type TabContextFormMode } from './TabContextFormModal'
import { TabContextsList } from './TabContextsList'
import { TabContextsListPreview } from './TabContextsListPreview'
import type { PreviewState } from './TabContextsEditor'

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

function countAutoKeys(content: string): number {
  const auto = content.match(/<!-- iaterminal:auto -->([\s\S]*?)<!-- \/iaterminal:auto -->/)?.[1] ?? ''
  return collectAutoAnnotationKeys(auto).size
}

function countAnnotations(content: string): number {
  const notes = content.match(/<!-- iaterminal:notes -->([\s\S]*?)<!-- \/iaterminal:notes -->/)?.[1] ?? ''
  return [...notes.matchAll(/^-\s+`[^`]+`\s+—\s+/gm)].length
}

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
  const [preview, setPreview] = useState<PreviewState>({ status: 'idle' })
  const [listError, setListError] = useState('')
  /** true si el form se abrió por focusContextId (plano); false si desde el listado. */
  const formOpenedFromFocusRef = useRef(false)

  useEffect(() => {
    if (!open) {
      setFormSession(null)
      setSelectedId(null)
      setPreview({ status: 'idle' })
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

  useEffect(() => {
    if (!open || !selectedId) {
      setPreview({ status: 'idle' })
      return
    }
    const target = contexts.find(context => context.id === selectedId)
    if (!target) {
      setSelectedId(null)
      setPreview({ status: 'idle' })
      return
    }
    const workingCwd = (cwd ?? '').trim()
    if (!workingCwd) {
      setPreview({ status: 'error', message: t('tabContexts.missingCwd') })
      return
    }
    let cancelled = false
    setPreview({ status: 'loading' })
    void (async () => {
      try {
        const result = await window.api.previewTabContext({
          context: target,
          cwd: workingCwd,
        })
        if (cancelled) return
        if (!result.ok) {
          setPreview({ status: 'error', message: result.error ?? t('tabContexts.previewError') })
          return
        }
        const content = (result.content ?? '').trim()
        if (!content) {
          setPreview({ status: 'empty', filePath: result.filePath })
          return
        }
        setPreview({
          status: 'success',
          content: result.content,
          filePath: result.filePath ?? `.iaterminal/${target.fileName}`,
        })
      } catch (error) {
        if (cancelled) return
        setPreview({
          status: 'error',
          message: error instanceof Error ? error.message : t('tabContexts.previewError'),
        })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, selectedId, contexts, cwd, t])

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
      if (selectedId === context.id) {
        setSelectedId(null)
        setPreview({ status: 'idle' })
      }
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
          <TabContextsListPreview
            context={selectedContext}
            preview={preview}
            countAutoKeys={countAutoKeys}
            countAnnotations={countAnnotations}
          />
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
