import React, { useEffect, useState } from 'react'
import type { TabContext, TabContextKind, TabContextSymbolKind } from '@shared/tabContext'
import { normalizeContextFileName } from '@shared/tabContext'
import { useT } from '@i18n/useT'
import { TerminalModal } from '../components/TerminalModal'
import { Button } from '../components/ui/Button'
import { Icon, type IconName } from '../components/ui/Icon'

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

type PreviewState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; content: string; filePath: string }
  | { status: 'empty'; filePath?: string }
  | { status: 'error'; message: string }

const KINDS: TabContextKind[] = [
  'folderTree', 'files', 'symbols', 'notes', 'git', 'deps', 'readme', 'changelog',
]

export const KIND_ICONS: Record<TabContextKind, IconName> = {
  folderTree: 'folder',
  files: 'files',
  symbols: 'code',
  notes: 'note',
  git: 'git-branch',
  deps: 'package',
  readme: 'book',
  changelog: 'history',
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
    let resolved = cwd.trim()
    if (!resolved) {
      try { resolved = (await window.api.getSessionCwd(paneId)).trim() } catch { /* ignore */ }
    }
    if (!resolved && cwdSources[0]) {
      try {
        resolved = (await window.api.getSessionCwd(cwdSources[0].paneId)).trim()
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
    if (others.some(context => comparable(context.name) === comparable(draft.name))) {
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
    name: current.name.trim() || (current.kind === 'changelog' ? 'AI Changelog' : ''),
    fileName: normalizeContextFileName(
      current.fileName || current.name || (current.kind === 'changelog' ? 'changelog' : 'context'),
      current.kind === 'changelog' ? 'changelog' : current.id,
    ),
    ...(current.rootPath?.trim() ? { rootPath: current.rootPath.trim() } : { rootPath: undefined }),
    ...(current.paths
      ? { paths: current.paths.map(path => path.trim()).filter(Boolean) }
      : { paths: undefined }),
  })

  const save = async (): Promise<void> => {
    if (!draft) return
    if (draft.kind !== 'changelog' && !draft.name.trim()) return
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
        ...(normalized.kind === 'notes' ? { content: notesContent } : {}),
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
    if (!draft?.name.trim() || draft.kind === 'changelog') return
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
        ...(normalized.kind === 'notes' ? { content: notesContent } : {}),
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
      const content = result.content.trim()
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
        ...(draft.kind === 'notes' ? { content: notesContent } : {}),
      })
      if (!result.ok) {
        setPreview({ status: 'error', message: result.error ?? t('tabContexts.previewError') })
        return
      }
      const content = result.content.trim()
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
        <aside className="tab-contexts__list">
          <Button variant="secondary" onClick={() => setDraft(emptyContext())}>
            <Icon name="plus" size={14} />
            {t('tabContexts.new')}
          </Button>
          {contexts.length === 0 && (
            <p className="tab-contexts__empty">{t('tabContexts.empty')}</p>
          )}
          {contexts.map(context => (
            <div
              key={context.id}
              className={`tab-contexts__item${draft?.id === context.id ? ' tab-contexts__item--active' : ''}`}
            >
              <button onClick={() => { void editContext(context) }}>
                <span className="tab-contexts__item-icon">
                  <Icon name={KIND_ICONS[context.kind]} size={17} />
                </span>
                <span className="tab-contexts__item-text">
                  <strong>{context.name}</strong>
                  <span>{t(`tabContexts.kind_${context.kind}`)}</span>
                  <span className="tab-contexts__item-file">{context.fileName}</span>
                </span>
              </button>
              <button
                className="tab-contexts__delete"
                title={t('tabContexts.delete')}
                onClick={() => { void removeContext(context) }}
              >
                <Icon name="trash" size={13} />
              </button>
            </div>
          ))}
        </aside>

        <section className="tab-contexts__editor">
          {!draft ? (
            <div className="tab-contexts__welcome">
              <span className="tab-contexts__welcome-icon">
                <Icon name="sparkles" size={30} />
              </span>
              <strong>{t('tabContexts.selectOrCreate')}</strong>
              <p>{t('tabContexts.welcomeHint')}</p>
              <Button onClick={() => setDraft(emptyContext())}>
                <Icon name="plus" size={14} />
                {t('tabContexts.new')}
              </Button>
            </div>
          ) : (
            <>
              {readOnlyChangelog ? (
                <div className="tab-contexts__kind-banner">
                  <span className="tab-contexts__item-icon">
                    <Icon name="history" size={18} />
                  </span>
                  <div>
                    <strong>{t('tabContexts.kind_changelog')}</strong>
                    <small>{draft.fileName}</small>
                  </div>
                </div>
              ) : (
                <div className="tab-contexts__kinds" role="radiogroup" aria-label={t('tabContexts.kind')}>
                  {KINDS.map(kind => (
                    <button
                      key={kind}
                      type="button"
                      disabled={kind === 'changelog' && contexts.some(context => context.kind === 'changelog')}
                      role="radio"
                      aria-checked={draft.kind === kind}
                      title={t(`tabContexts.kind_${kind}`)}
                      className={`tab-contexts__kind-card${draft.kind === kind ? ' tab-contexts__kind-card--active' : ''}`}
                      onClick={() => {
                        if (kind === 'changelog' && contexts.some(context => context.kind === 'changelog')) return
                        if (draft.kind === kind) return
                        // Changelog usa identidad fija; no heredar name/file vacíos del borrador.
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
                      }}
                    >
                      <Icon name={KIND_ICONS[kind]} size={16} />
                      <span>{t(`tabContexts.kind_${kind}`)}</span>
                    </button>
                  ))}
                </div>
              )}

              <label>
                <span>{t('tabContexts.name')}</span>
                <input
                  value={draft.name}
                  placeholder={draft.kind === 'changelog' ? 'AI Changelog' : t('tabContexts.namePlaceholder')}
                  onChange={event => {
                    const name = event.target.value
                    const currentDerived = normalizeContextFileName(draft.name || 'context')
                    const changelogDerived = normalizeContextFileName(draft.name || 'changelog')
                    update({
                      name,
                      ...(!draft.fileName
                        || draft.fileName === 'context.md'
                        || draft.fileName === 'changelog.md'
                        || draft.fileName === currentDerived
                        || draft.fileName === changelogDerived
                        ? {
                            fileName: normalizeContextFileName(
                              name || (draft.kind === 'changelog' ? 'changelog' : 'context'),
                            ),
                          }
                        : {}),
                    })
                  }}
                />
                {draft.kind === 'changelog' && (
                  <small>{t('tabContexts.changelogCreateHint')}</small>
                )}
              </label>
              <label>
                <span>{t('tabContexts.fileName')}</span>
                <input
                  value={draft.fileName ?? normalizeContextFileName(
                    draft.name || (draft.kind === 'changelog' ? 'changelog' : 'context'),
                  )}
                  placeholder={draft.kind === 'changelog' ? 'ai-changelog.md' : 'project-structure.md'}
                  onChange={event => update({ fileName: event.target.value })}
                />
                <small>{`.iaterminal/${normalizeContextFileName(
                  draft.fileName || draft.name || (draft.kind === 'changelog' ? 'changelog' : 'context'),
                  draft.kind === 'changelog' ? 'changelog' : draft.id,
                )}`}</small>
              </label>

              {draft.kind !== 'notes' && draft.kind !== 'changelog' && (
                <label>
                  <span>{t('tabContexts.rootPath')}</span>
                  <input
                    value={draft.rootPath ?? ''}
                    placeholder={t('tabContexts.rootPlaceholder')}
                    onChange={event => update({ rootPath: event.target.value })}
                  />
                </label>
              )}

              {(draft.kind === 'files' || draft.kind === 'symbols') && (
                <label>
                  <span>{t('tabContexts.paths')}</span>
                  <textarea
                    rows={5}
                    value={(draft.paths ?? []).join('\n')}
                    placeholder={t('tabContexts.pathsPlaceholder')}
                    onChange={event => update({ paths: event.target.value.split(/\r?\n/) })}
                  />
                </label>
              )}

              {draft.kind === 'symbols' && (
                <fieldset>
                  <legend>{t('tabContexts.symbolKinds')}</legend>
                  {(['class', 'method', 'variable'] as TabContextSymbolKind[]).map(kind => (
                    <label key={kind} className="tab-contexts__check">
                      <input
                        type="checkbox"
                        checked={(draft.symbolKinds ?? ['class', 'method', 'variable']).includes(kind)}
                        onChange={event => {
                          const current = draft.symbolKinds ?? ['class', 'method', 'variable']
                          update({ symbolKinds: event.target.checked
                            ? [...new Set([...current, kind])]
                            : current.filter(item => item !== kind) })
                        }}
                      />
                      {t(`tabContexts.symbol_${kind}`)}
                    </label>
                  ))}
                </fieldset>
              )}

              {draft.kind === 'notes' && (
                <label>
                  <span>{t('tabContexts.notes')}</span>
                  <small>{t('tabContexts.customHint')}</small>
                  <textarea
                    rows={8}
                    value={notesContent}
                    placeholder={t('tabContexts.notesPlaceholder')}
                    onChange={event => {
                      setNotesContent(event.target.value)
                      setPreview({ status: 'idle' })
                    }}
                  />
                </label>
              )}

              {draft.kind === 'changelog' && (
                <p className="tab-contexts__cwd">{t('tabContexts.changelogReadOnly')}</p>
              )}

              {resolvedCwdLabel && (
                <p className="tab-contexts__cwd">{t('tabContexts.cwdLabel', { cwd: resolvedCwdLabel })}</p>
              )}

              {duplicateMessage && preview.status !== 'error' && (
                <div className="tab-contexts__preview-panel tab-contexts__preview-panel--error">
                  <p>{duplicateMessage}</p>
                </div>
              )}

              {preview.status !== 'idle' && (
                <div className={`tab-contexts__preview-panel tab-contexts__preview-panel--${preview.status}`}>
                  {preview.status === 'loading' && (
                    <p>{t('tabContexts.loading')}</p>
                  )}
                  {preview.status === 'empty' && (
                    <>
                      <p>{t('tabContexts.previewEmpty')}</p>
                      {preview.filePath && <small>{preview.filePath}</small>}
                    </>
                  )}
                  {preview.status === 'error' && (
                    <p>{preview.message}</p>
                  )}
                  {preview.status === 'success' && (
                    <>
                      <div className="tab-contexts__preview-meta">
                        <small>{preview.filePath}</small>
                        <small>
                          {t('tabContexts.previewStats', {
                            auto: countAutoKeys(preview.content),
                            notes: countAnnotations(preview.content),
                          })}
                        </small>
                      </div>
                      <pre className="tab-contexts__preview">{preview.content}</pre>
                    </>
                  )}
                </div>
              )}

              <div className="tab-contexts__actions">
                <Button variant="secondary" disabled={preview.status === 'loading'} onClick={() => void loadPreview()}>
                  {preview.status === 'loading' ? t('tabContexts.loading') : t('tabContexts.preview')}
                </Button>
                {draft.kind !== 'changelog' && <Button
                  variant="secondary"
                  disabled={
                    preview.status === 'loading' ||
                    !draft.name.trim() ||
                    !draft.fileName.trim() ||
                    Boolean(duplicateMessage)
                  }
                  title={t('tabContexts.regenerateHint')}
                  onClick={() => { void regenerate() }}
                >
                  <Icon name="refresh" size={13} />
                  {t('tabContexts.regenerate')}
                </Button>}
                <Button
                  disabled={
                    Boolean(duplicateMessage) ||
                    (draft.kind === 'changelog'
                      ? false
                      : !draft.name.trim() || !draft.fileName.trim())
                  }
                  onClick={() => { void save() }}
                >
                  {t('tabContexts.saveAndAssign')}
                </Button>
              </div>
            </>
          )}
        </section>
      </div>
    </TerminalModal>
  )
}
