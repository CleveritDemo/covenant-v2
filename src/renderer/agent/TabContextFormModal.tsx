import React, { useEffect, useState } from 'react'
import type { TabContext, TabContextKind } from '@shared/tabContext'
import {
  applyCanonicalContextIdentity,
  collectAutoAnnotationKeys,
  contextDefinitionKey,
  normalizeContextFileName,
  suggestSymbolsIdentity,
} from '@shared/tabContext'
import { defaultColorForKind, defaultIconForKind } from '@shared/tabContextAppearance'
import { useT } from '@i18n/useT'
import { TerminalModal } from '../components/TerminalModal'
import { TabContextsEditor, type PreviewState } from './TabContextsEditor'

export type TabContextFormMode = 'create' | 'edit'

interface Props {
  open: boolean
  mode: TabContextFormMode
  /** Contexto a editar; en create se ignora. */
  context: TabContext | null
  contexts: TabContext[]
  cwd: string
  onRefresh: () => void
  onClose: () => void
}

function emptyContext(kind: TabContextKind = 'folderTree'): TabContext {
  return applyCanonicalContextIdentity({
    id: '',
    name: '',
    fileName: '',
    kind,
    icon: defaultIconForKind(kind),
    color: defaultColorForKind(kind),
    ...(kind === 'symbols' ? { symbolKinds: ['class', 'method'] as const } : {}),
  })
}

function comparable(value: string): string {
  return value.trim().normalize('NFKC').toLocaleLowerCase()
}

function contextDefinition(context: TabContext): string | null {
  return contextDefinitionKey(context)
}

function countAutoKeys(content: string): number {
  const auto = content.match(/<!-- iaterminal:auto -->([\s\S]*?)<!-- \/iaterminal:auto -->/)?.[1] ?? ''
  return collectAutoAnnotationKeys(auto).size
}

function countAnnotations(content: string): number {
  const notes = content.match(/<!-- iaterminal:notes -->([\s\S]*?)<!-- \/iaterminal:notes -->/)?.[1] ?? ''
  return [...notes.matchAll(/^-\s+`[^`]+`\s+—\s+/gm)].length
}

export const TabContextFormModal: React.FC<Props> = ({
  open,
  mode,
  context,
  contexts,
  cwd,
  onRefresh,
  onClose,
}) => {
  const { t } = useT()
  const [draft, setDraft] = useState<TabContext | null>(null)
  const [preview, setPreview] = useState<PreviewState>({ status: 'idle' })
  const [notesContent, setNotesContent] = useState('')
  const [resolvedCwdLabel, setResolvedCwdLabel] = useState('')

  const resolveCwd = async (): Promise<string> => {
    const resolved = (cwd ?? '').trim()
    setResolvedCwdLabel(resolved)
    return resolved
  }

  const loadHostOwnedContent = async (target: TabContext): Promise<void> => {
    if (target.kind !== 'notes' && target.kind !== 'changelog' && target.kind !== 'agentResult') {
      return
    }
    const workingCwd = await resolveCwd()
    if (!workingCwd) return
    try {
      const result = await window.api.previewTabContext({ context: target, cwd: workingCwd })
      if (target.kind === 'notes' && result.ok) {
        setNotesContent(result.notesContent ?? result.content)
        return
      }
      if (!result.ok) {
        setPreview({ status: 'error', message: result.error ?? t('tabContexts.previewError') })
        return
      }
      setPreview(result.content.trim()
        ? {
            status: 'success',
            content: result.content,
            filePath: result.filePath
              ?? (target.kind === 'agentResult'
                ? `.iaterminal/${target.fileName}`
                : '.iaterminal/changelog.md'),
          }
        : { status: 'empty', filePath: result.filePath })
    } catch (error) {
      if (target.kind === 'changelog' || target.kind === 'agentResult') {
        setPreview({
          status: 'error',
          message: error instanceof Error ? error.message : t('tabContexts.previewError'),
        })
      }
    }
  }

  useEffect(() => {
    if (!open) {
      setDraft(null)
      setPreview({ status: 'idle' })
      setNotesContent('')
      setResolvedCwdLabel('')
      return
    }
    const initial = mode === 'edit' && context ? { ...context } : emptyContext()
    setDraft(initial)
    setPreview(
      initial.kind === 'changelog' || initial.kind === 'agentResult'
        ? { status: 'loading' }
        : { status: 'idle' },
    )
    setNotesContent('')
    void loadHostOwnedContent(initial)
    // Seed once per open session; avoid re-seeding on every contexts refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, context?.id])

  const update = (patch: Partial<TabContext>): void => {
    setDraft(current => {
      if (!current) return current
      let next: TabContext = { ...current, ...patch }
      if (
        current.kind === 'symbols'
        && Object.prototype.hasOwnProperty.call(patch, 'rootPath')
        && patch.rootPath !== current.rootPath
      ) {
        const suggested = suggestSymbolsIdentity(patch.rootPath)
        const currentDerived = normalizeContextFileName(current.name || 'context')
        const shouldRename = !current.name.trim()
          || /^classes(\s|·|-)/i.test(current.name.trim())
          || current.fileName === 'context.md'
          || current.fileName === currentDerived
        if (shouldRename) {
          next = {
            ...next,
            name: suggested.name,
            fileName: normalizeContextFileName(suggested.name || suggested.fileStem),
          }
        }
      }
      return next
    })
    setPreview({ status: 'idle' })
  }

  const readOnlyChangelog = draft?.kind === 'changelog' &&
    contexts.some(item => item.id === draft.id)
  const readOnlyAgentResult = draft?.kind === 'agentResult'

  const duplicateMessage = (() => {
    if (!draft) return ''
    const others = contexts.filter(item => item.id !== draft.id)
    const fileName = normalizeContextFileName(
      draft.name || draft.fileName,
      draft.kind === 'changelog' ? 'changelog' : 'context',
    )
    if (others.some(item => comparable(item.name ?? '') === comparable(draft.name ?? ''))) {
      return t('tabContexts.nameDuplicate')
    }
    if (others.some(item =>
      normalizeContextFileName(item.fileName || item.name, item.id).toLowerCase() === fileName.toLowerCase()
    )) {
      return t('tabContexts.fileNameDuplicate')
    }
    const definition = contextDefinition(draft)
    if (definition && others.some(item => contextDefinition(item) === definition)) {
      return t('tabContexts.fileNameDuplicate')
    }
    return ''
  })()

  const normalizeDraft = (current: TabContext): TabContext => applyCanonicalContextIdentity({
    ...current,
    name: (current.name ?? '').trim() || (current.kind === 'changelog' ? 'AI Changelog' : current.name),
    ...(current.rootPath?.trim()
      ? { rootPath: current.rootPath.trim() === '.' ? undefined : current.rootPath.trim() }
      : { rootPath: undefined }),
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
    const previousFileName = mode === 'edit' && context?.fileName
      && normalizeContextFileName(context.fileName) !== normalized.fileName
      ? context.fileName
      : undefined
    try {
      const result = await window.api.materializeTabContext({
        context: normalized,
        cwd: workingCwd,
        ...(normalized.kind === 'notes' ? { content: notesContent ?? '' } : {}),
        ...(previousFileName ? { previousFileName } : {}),
      })
      if (!result.ok) {
        setPreview({ status: 'error', message: result.error ?? t('tabContexts.previewError') })
        return
      }
      onRefresh()
      onClose()
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
    if (draft.kind === kind) return
    if (kind === 'changelog') {
      setDraft(emptyContext('changelog'))
    } else {
      const keepName = draft.kind === 'changelog' ? '' : draft.name
      const keepRoot = draft.rootPath
      const base = emptyContext(kind)
      if (kind === 'symbols') {
        const suggested = suggestSymbolsIdentity(keepRoot)
        setDraft(applyCanonicalContextIdentity({
          ...base,
          name: keepName.trim() || suggested.name,
          rootPath: keepRoot,
          symbolKinds: ['class', 'method'],
        }))
      } else if (kind === 'notes') {
        setDraft(applyCanonicalContextIdentity({
          ...base,
          name: keepName || 'Notes',
          fileName: normalizeContextFileName(keepName || 'notes', 'notes'),
        }))
      } else {
        setDraft(applyCanonicalContextIdentity({
          ...base,
          name: keepName,
          rootPath: keepRoot,
        }))
      }
    }
    setNotesContent('')
    setPreview({ status: 'idle' })
  }

  if (!open || !draft) return null

  return (
    <TerminalModal
      open={open}
      onClose={onClose}
      title={mode === 'edit' ? t('tabContexts.editTitle') : t('tabContexts.createTitle')}
      titleId="tab-context-form-title"
      size="lg"
      bodyLayout="flush"
      zIndex={920}
    >
      <div className="tab-contexts tab-contexts--form">
        <TabContextsEditor
          draft={draft}
          contexts={contexts}
          preview={preview}
          notesContent={notesContent}
          resolvedCwdLabel={resolvedCwdLabel}
          projectCwd={cwd}
          duplicateMessage={duplicateMessage}
          readOnlyChangelog={Boolean(readOnlyChangelog)}
          readOnlyAgentResult={Boolean(readOnlyAgentResult)}
          onUpdate={update}
          onSelectKind={selectKind}
          onNotesContentChange={setNotesContent}
          onPreviewReset={() => setPreview({ status: 'idle' })}
          onLoadPreview={loadPreview}
          onRegenerate={regenerate}
          onSave={save}
          onPickRootError={message => setPreview({ status: 'error', message })}
          countAutoKeys={countAutoKeys}
          countAnnotations={countAnnotations}
        />
      </div>
    </TerminalModal>
  )
}
