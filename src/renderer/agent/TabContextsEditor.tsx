import React from 'react'
import type { TabContext, TabContextKind, TabContextSymbolKind } from '@shared/tabContext'
import { normalizeContextFileName, CREATABLE_CONTEXT_KINDS } from '@shared/tabContext'
import {
  TAB_CONTEXT_COLORS,
  TAB_CONTEXT_ICON_NAMES,
  resolveContextColor,
  resolveContextIcon,
} from '@shared/tabContextAppearance'
import { PROJECT_DIR } from '@shared/projectDir'
import { sectionsForContext } from '@shared/contextSections'
import { summarizeContextBudget } from '@shared/contextBudget'
import { useT } from '@i18n/useT'
import { Input, TextArea, Toggle } from '../components/ui'
import { Icon } from '../components/ui/Icon'
import { appearanceIconName, KIND_ICONS } from './tabContextKindIcons'
import { TabContextBudgetMeter } from './TabContextBudgetMeter'
import { TabContextColorSwatch } from './TabContextColorSwatch'
import { TabContextIconSwatch } from './TabContextIconSwatch'
import { TabContextKindCard } from './TabContextKindCard'
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
  onPickRootError?: (message: string) => void
}

export const TabContextsEditor: React.FC<Props> = ({
  draft,
  contexts: _contexts,
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
  onPickRootError,
}) => {
  const { t } = useT()
  const hostOwnedReadOnly = readOnlyChangelog || readOnlyAgentResult

  return (
    <div className="tab-contexts__panes">
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
              <small>{`${PROJECT_DIR}/${draft.fileName}`}</small>
            </div>
          </div>
        ) : (
          <div className="tab-contexts__kinds" role="radiogroup" aria-label={t('tabContexts.kind')}>
            {KINDS.map(kind => (
              <TabContextKindCard
                key={kind}
                label={t(`tabContexts.kind_${kind}`)}
                icon={KIND_ICONS[kind]}
                selected={draft.kind === kind}
                onSelect={() => onSelectKind(kind)}
              />
            ))}
          </div>
        )}

        <label>
          <span>{t('tabContexts.name')}</span>
          <Input
            value={draft.name}
            placeholder={draft.kind === 'changelog' ? 'AI Changelog' : t('tabContexts.namePlaceholder')}
            onChange={event => {
              const name = event.target.value
              const fallback = draft.kind === 'changelog' ? 'changelog' : 'context'
              onUpdate({
                name,
                fileName: normalizeContextFileName(name || fallback, fallback),
              })
            }}
          />
          {draft.kind === 'changelog' && (
            <small>{t('tabContexts.changelogCreateHint')}</small>
          )}
        </label>
        <label>
          <span>{t('tabContexts.fileName')}</span>
          <small>{`${PROJECT_DIR}/${normalizeContextFileName(
            draft.name || draft.fileName || (draft.kind === 'changelog' ? 'changelog' : 'context'),
            draft.kind === 'changelog' ? 'changelog' : 'context',
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
                    <TabContextIconSwatch
                      key={icon}
                      icon={appearanceIconName(icon)}
                      color={resolveContextColor(draft)}
                      title={icon}
                      selected={active}
                      onSelect={() => onUpdate({ icon })}
                    />
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
                    <TabContextColorSwatch
                      key={color}
                      color={color}
                      selected={active}
                      onSelect={() => onUpdate({ color })}
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
            <TextArea
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
            {(['class', 'method'] as TabContextSymbolKind[]).map(kind => {
              const checked = (draft.symbolKinds ?? ['class', 'method']).includes(kind)
              return (
                <Toggle
                  key={kind}
                  checked={checked}
                  label={t(`tabContexts.symbol_${kind}`)}
                  onChange={next => {
                    const current = draft.symbolKinds ?? ['class', 'method']
                    onUpdate({
                      symbolKinds: next
                        ? [...new Set([...current, kind])]
                        : current.filter(item => item !== kind),
                    })
                  }}
                />
              )
            })}
          </fieldset>
        )}

        {draft.kind === 'notes' && (
          <label>
            <span>{t('tabContexts.notes')}</span>
            <small>{t('tabContexts.customHint')}</small>
            <TextArea
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

        {duplicateMessage && (
          <div className="tab-contexts__preview-panel tab-contexts__preview-panel--error">
            <p>{duplicateMessage}</p>
          </div>
        )}
      </section>
      <aside className="tab-contexts__output">
        {preview.status === 'success' && (
          <TabContextBudgetMeter
            summary={summarizeContextBudget(
              sectionsForContext(draft, {
                ok: true,
                content: preview.content,
                ...(draft.kind === 'notes' ? { notesContent } : {}),
              }),
              draft.kind,
            )}
          />
        )}
        <div className="tab-contexts__output-head">
          <span>{t('tabContexts.preview')}</span>
          {preview.status === 'success' && <small>{preview.filePath}</small>}
        </div>
        {preview.status === 'loading' && <p className="tab-contexts__output-msg">{t('tabContexts.loading')}</p>}
        {preview.status === 'idle' && <p className="tab-contexts__output-msg">{t('tabContexts.previewIdle')}</p>}
        {preview.status === 'empty' && <p className="tab-contexts__output-msg">{t('tabContexts.previewEmpty')}</p>}
        {preview.status === 'error' && (
          <p className="tab-contexts__output-msg tab-contexts__output-msg--error">{preview.message}</p>
        )}
        {preview.status === 'success' && (
          <pre className="tab-contexts__preview">{preview.content}</pre>
        )}
      </aside>
    </div>
  )
}
