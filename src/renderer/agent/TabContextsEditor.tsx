import React from 'react'
import type { TabContext, TabContextKind, TabContextSymbolKind } from '@shared/tabContext'
import { normalizeContextFileName, CREATABLE_CONTEXT_KINDS } from '@shared/tabContext'
import {
  TAB_CONTEXT_COLORS,
  TAB_CONTEXT_ICON_NAMES,
  resolveContextColor,
  resolveContextIcon,
} from '@shared/tabContextAppearance'
import { useT } from '@i18n/useT'
import { Button } from '../components/ui/Button'
import { Icon } from '../components/ui/Icon'
import { appearanceIconName, KIND_ICONS } from './tabContextKindIcons'
import { TabContextRootPathField } from './TabContextRootPathField'

export type PreviewState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; content: string; filePath: string }
  | { status: 'empty'; filePath?: string }
  | { status: 'error'; message: string }

const KINDS: TabContextKind[] = [...CREATABLE_CONTEXT_KINDS]

interface Props {
  draft: TabContext
  contexts: TabContext[]
  preview: PreviewState
  notesContent: string
  resolvedCwdLabel: string
  projectCwd: string
  duplicateMessage: string
  readOnlyChangelog: boolean
  readOnlyAgentResult?: boolean
  onUpdate: (patch: Partial<TabContext>) => void
  onSelectKind: (kind: TabContextKind) => void
  onNotesContentChange: (content: string) => void
  onPreviewReset: () => void
  onLoadPreview: () => void
  onRegenerate: () => void
  onSave: () => void
  onPickRootError?: (message: string) => void
  countAutoKeys: (content: string) => number
  countAnnotations: (content: string) => number
}

export const TabContextsEditor: React.FC<Props> = ({
  draft,
  contexts,
  preview,
  notesContent,
  resolvedCwdLabel,
  projectCwd,
  duplicateMessage,
  readOnlyChangelog,
  readOnlyAgentResult = false,
  onUpdate,
  onSelectKind,
  onNotesContentChange,
  onPreviewReset,
  onLoadPreview,
  onRegenerate,
  onSave,
  onPickRootError,
  countAutoKeys,
  countAnnotations,
}) => {
  const { t } = useT()
  const hostOwnedReadOnly = readOnlyChangelog || readOnlyAgentResult

  return (
    <section className="tab-contexts__editor">
      {hostOwnedReadOnly ? (
        <div className="tab-contexts__kind-banner">
          <span className="tab-contexts__item-icon">
            <Icon name={readOnlyAgentResult ? 'bot' : 'history'} size={18} />
          </span>
          <div>
            <strong>
              {t(readOnlyAgentResult ? 'tabContexts.kind_agentResult' : 'tabContexts.kind_changelog')}
            </strong>
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
              onClick={() => onSelectKind(kind)}
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
            onUpdate({
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
          onChange={event => onUpdate({ fileName: event.target.value })}
        />
        <small>{`.iaterminal/${normalizeContextFileName(
          draft.fileName || draft.name || (draft.kind === 'changelog' ? 'changelog' : 'context'),
          draft.kind === 'changelog' ? 'changelog' : draft.id,
        )}`}</small>
      </label>

      {!hostOwnedReadOnly && (
        <>
          <fieldset className="tab-contexts__appearance">
            <legend>{t('tabContexts.icon')}</legend>
            <div className="tab-contexts__icon-grid" role="radiogroup" aria-label={t('tabContexts.icon')}>
              {TAB_CONTEXT_ICON_NAMES.map(icon => {
                const active = resolveContextIcon(draft) === icon
                return (
                  <button
                    key={icon}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    title={icon}
                    className={`tab-contexts__icon-swatch${active ? ' tab-contexts__icon-swatch--active' : ''}`}
                    style={{ color: resolveContextColor(draft) }}
                    onClick={() => onUpdate({ icon })}
                  >
                    <Icon name={appearanceIconName(icon)} size={15} />
                  </button>
                )
              })}
            </div>
          </fieldset>
          <fieldset className="tab-contexts__appearance">
            <legend>{t('tabContexts.color')}</legend>
            <div className="tab-contexts__color-grid" role="radiogroup" aria-label={t('tabContexts.color')}>
              {TAB_CONTEXT_COLORS.map(color => {
                const active = resolveContextColor(draft).toLowerCase() === color.toLowerCase()
                return (
                  <button
                    key={color}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    title={color}
                    className={`tab-contexts__color-swatch${active ? ' tab-contexts__color-swatch--active' : ''}`}
                    style={{ background: color }}
                    onClick={() => onUpdate({ color })}
                  />
                )
              })}
            </div>
          </fieldset>
        </>
      )}

      {draft.kind !== 'notes' && draft.kind !== 'changelog' ? (
        <TabContextRootPathField
          value={draft.rootPath ?? ''}
          projectCwd={projectCwd}
          onChange={rootPath => onUpdate({ rootPath })}
          onPickError={onPickRootError}
        />
      ) : null}

      {(draft.kind === 'files' || draft.kind === 'symbols') && (
        <label>
          <span>{t('tabContexts.paths')}</span>
          <textarea
            rows={5}
            value={(draft.paths ?? []).join('\n')}
            placeholder={t('tabContexts.pathsPlaceholder')}
            onChange={event => onUpdate({ paths: event.target.value.split(/\r?\n/) })}
          />
        </label>
      )}

      {draft.kind === 'symbols' && (
        <fieldset>
          <legend>{t('tabContexts.symbolKinds')}</legend>
          {(['class', 'method'] as TabContextSymbolKind[]).map(kind => (
            <label key={kind} className="tab-contexts__check">
              <input
                type="checkbox"
                checked={(draft.symbolKinds ?? ['class', 'method']).includes(kind)}
                onChange={event => {
                  const current = draft.symbolKinds ?? ['class', 'method']
                  onUpdate({ symbolKinds: event.target.checked
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
              onNotesContentChange(event.target.value)
              onPreviewReset()
            }}
          />
        </label>
      )}

      {(draft.kind === 'changelog' || draft.kind === 'agentResult') && (
        <p className="tab-contexts__cwd">
          {t(draft.kind === 'agentResult'
            ? 'tabContexts.agentResultReadOnly'
            : 'tabContexts.changelogReadOnly')}
        </p>
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
        <Button variant="secondary" disabled={preview.status === 'loading'} onClick={() => { void onLoadPreview() }}>
          {preview.status === 'loading' ? t('tabContexts.loading') : t('tabContexts.preview')}
        </Button>
        {draft.kind !== 'changelog' && draft.kind !== 'agentResult' && <Button
          variant="secondary"
          disabled={
            preview.status === 'loading' ||
            !(draft.name ?? '').trim() ||
            !(draft.fileName ?? '').trim() ||
            Boolean(duplicateMessage)
          }
          title={t('tabContexts.regenerateHint')}
          onClick={() => { void onRegenerate() }}
        >
          <Icon name="refresh" size={13} />
          {t('tabContexts.regenerate')}
        </Button>}
        {draft.kind !== 'agentResult' && (
          <Button
            disabled={
              Boolean(duplicateMessage) ||
              (draft.kind === 'changelog'
                ? false
                : !(draft.name ?? '').trim() || !(draft.fileName ?? '').trim())
            }
            onClick={() => { void onSave() }}
          >
            {t('tabContexts.save')}
          </Button>
        )}
      </div>
    </section>
  )
}
