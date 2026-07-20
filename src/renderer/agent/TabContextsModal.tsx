import React, { useEffect, useState } from 'react'
import type { TabContext, TabContextKind } from '@shared/tabContext'
import { normalizeContextFileName } from '@shared/tabContext'
import { useT } from '@i18n/useT'
import { TerminalModal } from '../components/TerminalModal'
import { TabContextsEditor, type PreviewState } from './TabContextsEditor'
import { TabContextsList } from './TabContextsList'

interface Props {
  open: boolean
  /** Catálogo vivo leído desde `.iaterminal/*.md`. */
  contexts: TabContext[]
  cwd: string
  paneId: string
  cwdSources: Array<{ paneId: string; label: string }>
  onRefresh: () => void
  onAssign: (contextId: string) => void
  onClose: () => void
}

function emptyContext(kind: TabContextKind = 'folderTree'): TabContext {
  if (kind === 'changelog') {
    return {
      id: 'iaterminal:changelog',
      name: 'AI Changelog',
      fileName: 'changelog.md',
      kind,
    }
  }
  return { id: crypto.randomUUID(), name: '', fileName: 'context.md', kind }
}

function comparable(value: string): string {
  return value.trim().normalize('NFKC').toLocaleLowerCase()
}

function normalizedRoot(value?: string): string {
  return comparable(value || '.').replace(/^\.\/+/, '').replace(/\/+$/, '') || '.'
}

function contextDefinition(context: TabContext): string | null {
  if (context.kind === 'notes' || context.kind === 'changelog') return null
  const paths = [...(context.paths ?? [])]
    .map(path => path.trim().replace(/^\.\/+/, ''))
    .filter(Boolean)
    .sort()
  const symbolKinds = context.kind === 'symbols'
    ? [...(context.symbolKinds ?? ['class', 'method', 'variable'])].sort()
    : []
  return JSON.stringify({
    kind: context.kind,
    rootPath: normalizedRoot(context.rootPath),
    paths,
    symbolKinds,
  })
}

function countAutoKeys(content: string): number {
  const auto = content.match(/<!-- iaterminal:auto -->([\s\S]*?)<!-- \/iaterminal:auto -->/)?.[1] ?? ''
  return [...auto.matchAll(/`([^`\n]+)`/g)].length
}

function countAnnotations(content: string): number {
  const notes = content.match(/<!-- iaterminal:notes -->([\s\S]*?)<!-- \/iaterminal:notes -->/)?.[1] ?? ''
  return [...notes.matchAll(/^-\s+`[^`]+`\s+—\s+/gm)].length
}

export const TabContextsModal: React.FC<Props> = ({
  open,
  contexts,
  cwd,
  paneId,
  cwdSources,
  onRefresh,
  onAssign,
  onClose,
}) => {
  const { t } = useT()
  const [draft, setDraft] = useState<TabContext | null>(null)
  const [preview, setPreview] = useState<PreviewState>({ status: 'idle' })
  const [notesContent, setNotesContent] = useState('')
  const [resolvedCwdLabel, setResolvedCwdLabel] = useState('')

  useEffect(() => {
    if (!open) {
      setDraft(null)
      setPreview({ status: 'idle' })
      setNotesContent('')
      setResolvedCwdLabel('')
    }
  }, [open])

  const resolveCwd = async (): Promise<string> => {
    let resolved = (cwd ?? '').trim()
    if (!resolved) {
      try {
        const fromPane = await window.api.getSessionCwd(paneId)
        resolved = (fromPane ?? '').trim()
      } catch { /* ignore */ }
    }
    if (!resolved && cwdSources[0]) {
      try {
        const fromSource = await window.api.getSessionCwd(cwdSources[0].paneId)
        resolved = (fromSource ?? '').trim()
      } catch { /* ignore */ }
    }
    setResolvedCwdLabel(resolved)
    return resolved
  }

  const update = (patch: Partial<TabContext>): void => {
    setDraft(current => current ? { ...current, ...patch } : current)
    setPreview({ status: 'idle' })
  }

  const readOnlyChangelog = draft?.kind === 'changelog' &&
    contexts.some(context => context.id === draft.id)

  const duplicateMessage = (() => {
    if (!draft) return ''
    const others = contexts.filter(context => context.id !== draft.id)
    const fileName = normalizeContextFileName(draft.fileName || draft.name, draft.id)
    if (others.some(context => comparable(context.name ?? '') === comparable(draft.name ?? ''))) {
      return t('tabContexts.nameDuplicate')
    }
    if (draft.kind === 'changelog' && others.some(context => context.kind === 'changelog')) {
      return t('tabContexts.definitionDuplicate')
    }
    if (others.some(context =>
      normalizeContextFileName(context.fileName, context.id).toLowerCase() === fileName.toLowerCase()
    )) {
      return t('tabContexts.fileNameDuplicate')
    }
    const definition = contextDefinition(draft)
    if (definition && others.some(context => contextDefinition(context) === definition)) {
      return t('tabContexts.definitionDuplicate')
    }
    return ''
  })()

  const normalizeDraft = (current: TabContext): TabContext => ({
    ...current,
    name: (current.name ?? '').trim() || (current.kind === 'changelog' ? 'AI Changelog' : ''),
    fileName: normalizeContextFileName(
      current.fileName || current.name || (current.kind === 'changelog' ? 'changelog' : 'context'),
      current.kind === 'changelog' ? 'changelog' : current.id,
    ),
    ...(current.rootPath?.trim() ? { rootPath: current.rootPath.trim() } : { rootPath: undefined }),
    ...(current.paths
      ? { paths: current.paths.map(path => (path ?? '').trim()).filter(Boolean) }
      : { paths: undefined }),
  })

  const save = async (): Promise<void> => {
    if (!draft) return
    if (draft.kind !== 'changelog' && !(draft.name ?? '').trim()) return
    if (duplicateMessage) {
      setPreview({ status: 'error', message: duplicateMessage })
      return
    }
    const workingCwd = await resolveCwd()
    if (!workingCwd) {
      setPreview({ status: 'error', message: t('tabContexts.missingCwd') })
      return
    }
    const normalized = normalizeDraft(draft)
    try {
      const result = await window.api.materializeTabContext({
        context: normalized,
        cwd: workingCwd,
        ...(normalized.kind === 'notes' ? { content: notesContent ?? '' } : {}),
      })
      if (!result.ok) {
        setPreview({ status: 'error', message: result.error ?? t('tabContexts.previewError') })
        return
      }
      onRefresh()
      onAssign(normalized.id)
      setDraft(null)
      setPreview({ status: 'idle' })
      setNotesContent('')
    } catch (error) {
      setPreview({
        status: 'error',
        message: error instanceof Error ? error.message : t('tabContexts.previewError'),
      })
    }
  }

  const regenerate = async (): Promise<void> => {
    if (!draft) return
    if (!(draft.name ?? '').trim() || draft.kind === 'changelog') return
    if (duplicateMessage) {
      setPreview({ status: 'error', message: duplicateMessage })
      return
    }
    setPreview({ status: 'loading' })
    const workingCwd = await resolveCwd()
    if (!workingCwd) {
      setPreview({ status: 'error', message: t('tabContexts.missingCwd') })
      return
    }
    const normalized = normalizeDraft(draft)
    try {
      const result = await window.api.materializeTabContext({
        context: normalized,
        cwd: workingCwd,
        ...(normalized.kind === 'notes' ? { content: notesContent ?? '' } : {}),
      })
      if (!result.ok) {
        setPreview({ status: 'error', message: result.error ?? t('tabContexts.previewError') })
        return
      }
      setDraft(normalized)
      if (normalized.kind === 'notes') {
        setNotesContent(result.notesContent ?? notesContent)
      }
      onRefresh()
      onAssign(normalized.id)
      const content = (result.content ?? '').trim()
      setPreview(content
        ? {
            status: 'success',
            content: result.content,
            filePath: result.filePath
              ?? `.iaterminal/${normalizeContextFileName(normalized.fileName, normalized.id)}`,
          }
        : { status: 'empty', filePath: result.filePath })
    } catch (error) {
      setPreview({
        status: 'error',
        message: error instanceof Error ? error.message : t('tabContexts.previewError'),
      })
    }
  }

  const removeContext = async (context: TabContext): Promise<void> => {
    const workingCwd = await resolveCwd()
    if (!workingCwd) {
      setPreview({ status: 'error', message: t('tabContexts.missingCwd') })
      return
    }
    try {
      const result = await window.api.deleteTabContext({ context, cwd: workingCwd })
      if (!result.ok) {
        setPreview({ status: 'error', message: result.error ?? t('tabContexts.previewError') })
        return
      }
      if (draft?.id === context.id) {
        setDraft(null)
        setNotesContent('')
        setPreview({ status: 'idle' })
      }
      onRefresh()
    } catch (error) {
      setPreview({
        status: 'error',
        message: error instanceof Error ? error.message : t('tabContexts.previewError'),
      })
    }
  }

  const editContext = async (context: TabContext): Promise<void> => {
    setDraft({ ...context })
    setPreview(context.kind === 'changelog' ? { status: 'loading' } : { status: 'idle' })
    setNotesContent('')
    if (context.kind === 'notes' || context.kind === 'changelog') {
      const workingCwd = await resolveCwd()
      if (!workingCwd) return
      try {
        const result = await window.api.previewTabContext({ context, cwd: workingCwd })
        if (context.kind === 'notes' && result.ok) {
          setNotesContent(result.notesContent ?? result.content)
        } else if (result.ok) {
          setPreview(result.content.trim()
            ? { status: 'success', content: result.content, filePath: result.filePath ?? '.iaterminal/changelog.md' }
            : { status: 'empty', filePath: result.filePath })
        } else {
          setPreview({ status: 'error', message: result.error ?? t('tabContexts.previewError') })
        }
      } catch (error) {
        if (context.kind === 'changelog') {
          setPreview({
            status: 'error',
            message: error instanceof Error ? error.message : t('tabContexts.previewError'),
          })
        }
      }
    }
  }

  const loadPreview = async (): Promise<void> => {
    if (!draft) return
    setPreview({ status: 'loading' })
    try {
      const workingCwd = await resolveCwd()
      if (!workingCwd) {
        setPreview({ status: 'error', message: t('tabContexts.missingCwd') })
        return
      }
      const result = await window.api.previewTabContext({
        context: draft,
        cwd: workingCwd,
        ...(draft.kind === 'notes' ? { content: notesContent ?? '' } : {}),
      })
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
        filePath: result.filePath ?? `.iaterminal/${normalizeContextFileName(draft.fileName || draft.name, draft.id)}`,
      })
    } catch (error) {
      setPreview({
        status: 'error',
        message: error instanceof Error ? error.message : t('tabContexts.previewError'),
      })
    }
  }

  const selectKind = (kind: TabContextKind): void => {
    if (!draft) return
    if (kind === 'changelog' && contexts.some(context => context.kind === 'changelog')) return
    if (draft.kind === kind) return
    if (kind === 'changelog') {
      setDraft(emptyContext('changelog'))
    } else {
      setDraft({
        ...emptyContext(kind),
        id: draft.kind === 'changelog' ? crypto.randomUUID() : draft.id,
        name: draft.kind === 'changelog' ? '' : draft.name,
        fileName: draft.kind === 'changelog'
          ? 'context.md'
          : draft.fileName,
      })
    }
    setNotesContent('')
    setPreview({ status: 'idle' })
  }

  return (
    <TerminalModal
      open={open}
      onClose={onClose}
      title={t('tabContexts.title')}
      titleId="tab-contexts-title"
      size="xl"
      bodyLayout="flush"
      zIndex={780}
    >
      <div className="tab-contexts">
        <TabContextsList
          contexts={contexts}
          activeDraftId={draft?.id}
          onNew={() => setDraft(emptyContext())}
          onEdit={editContext}
          onDelete={removeContext}
        />
        <TabContextsEditor
          draft={draft}
          contexts={contexts}
          preview={preview}
          notesContent={notesContent}
          resolvedCwdLabel={resolvedCwdLabel}
          duplicateMessage={duplicateMessage}
          readOnlyChangelog={Boolean(readOnlyChangelog)}
          onCreateNew={() => setDraft(emptyContext())}
          onUpdate={update}
          onSelectKind={selectKind}
          onNotesContentChange={setNotesContent}
          onPreviewReset={() => setPreview({ status: 'idle' })}
          onLoadPreview={loadPreview}
          onRegenerate={regenerate}
          onSave={save}
          countAutoKeys={countAutoKeys}
          countAnnotations={countAnnotations}
        />
      </div>
    </TerminalModal>
  )
}
