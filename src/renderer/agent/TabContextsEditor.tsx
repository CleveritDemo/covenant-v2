import React, { useState } from 'react'
import type { TabContext, TabContextKind, TabContextSymbolKind } from '@shared/tabContext'
import {
  canonicalContextFileName,
  normalizeContextFileName,
  CREATABLE_CONTEXT_KINDS,
  HOST_CONTEXT_KINDS,
} from '@shared/tabContext'
import { normalizeIssueKey } from '@shared/jiraIssue'
import { PROJECT_DIR } from '@shared/projectDir'
import { sectionsForContext } from '@shared/contextSections'
import { summarizeContextBudget } from '@shared/contextBudget'
import { useT } from '@i18n/useT'
import { Button, Input, SegmentedControl, SettingToggle, TextArea, Toggle } from '../components/ui'
import { Icon } from '../components/ui/Icon'
import { ContextReport } from '../workspace/ContextReport'
import { JiraMentionPicker } from '../workspace/JiraMentionPicker'
import { KIND_ICONS } from './tabContextKindIcons'
import { TabContextAppearancePopup } from './TabContextAppearancePopup'
import { TabContextBudgetMeter } from './TabContextBudgetMeter'
import { TabContextKindCard } from './TabContextKindCard'
import { TabContextRootPathField } from './TabContextRootPathField'

export type PreviewState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; content: string; filePath: string }
  | { status: 'empty'; filePath?: string }
  | { status: 'error'; message: string }

/**
 * Los tipos se agrupan por quién escribe el cuerpo, que es la distinción con
 * consecuencias: los host los materializa el pipeline desde el disco, `notes`
 * lo escribe la persona.
 */
const KIND_GROUPS: Array<{
  labelKey: 'tabContexts.group_host' | 'tabContexts.group_manual'
  kinds: TabContextKind[]
}> = [
  {
    labelKey: 'tabContexts.group_host',
    kinds: CREATABLE_CONTEXT_KINDS.filter(kind =>
      (HOST_CONTEXT_KINDS as readonly TabContextKind[]).includes(kind)),
  },
  {
    labelKey: 'tabContexts.group_manual',
    kinds: CREATABLE_CONTEXT_KINDS.filter(kind =>
      !(HOST_CONTEXT_KINDS as readonly TabContextKind[]).includes(kind)),
  },
]

interface Props {
  draft: TabContext
  contexts: TabContext[]
  preview: PreviewState
  notesContent: string
  /** Texto crudo del campo de clave `jira` (ver `TabContextFormModal.updateJiraKeyDraft`). */
  jiraKeyDraft: string
  resolvedCwdLabel: string
  projectCwd: string
  duplicateMessage: string
  /** Aviso de la última acción del panel (revelar, elegir carpeta); `''` = ninguno. */
  actionMessage: string
  readOnlyChangelog: boolean
  readOnlyAgentResult?: boolean
  onUpdate: (patch: Partial<TabContext>) => void
  onSelectKind: (kind: TabContextKind) => void
  onNotesContentChange: (content: string) => void
  onJiraKeyDraftChange: (raw: string) => void
  onPreviewReset: () => void
  /**
   * Canal de error de las acciones del panel izquierdo: carpeta raíz inválida
   * o fallo al revelar el .md. Vive aparte de la vista previa a propósito —
   * son fallos de acción, no de materialización, y mandarlos al panel derecho
   * dejaba el presupuesto y la vista previa borrados hasta la siguiente
   * edición. `''` limpia el aviso.
   */
  onActionError?: (message: string) => void
}

export const TabContextsEditor: React.FC<Props> = ({
  draft,
  contexts,
  preview,
  notesContent,
  jiraKeyDraft,
  resolvedCwdLabel,
  projectCwd,
  duplicateMessage,
  actionMessage,
  readOnlyChangelog,
  readOnlyAgentResult = false,
  onUpdate,
  onSelectKind,
  onNotesContentChange,
  onJiraKeyDraftChange,
  onPreviewReset,
  onActionError,
}) => {
  const { t } = useT()
  const [previewView, setPreviewView] = useState<'rendered' | 'source'>('rendered')
  /**
   * El input de búsqueda de Jira como estado, no como `useRef`: el picker
   * necesita re-renderizar cuando el elemento existe para colgarle el
   * `aria-activedescendant`, y una ref no dispara render.
   */
  const [jiraInputEl, setJiraInputEl] = useState<HTMLInputElement | null>(null)
  /** Término para el que el usuario ya cerró la lista (Escape o elección). */
  const [pickerDismissedFor, setPickerDismissedFor] = useState<string | null>(null)

  /**
   * Copia los archivos elegidos dentro del proyecto y agrega sus rutas. Los
   * contextos viajan con el repo: referenciar `~/Downloads` daría uno que solo
   * funciona en esta máquina, así que se importa en vez de apuntar afuera.
   */
  const importFiles = async (): Promise<void> => {
    onActionError?.('')
    const cwd = projectCwd.trim()
    if (!cwd) {
      onActionError?.(t('tabContexts.missingCwd'))
      return
    }
    const result = await window.api.importContextFiles({
      cwd,
      ...(draft.rootPath?.trim() ? { rootPath: draft.rootPath.trim() } : {}),
      title: t('tabContexts.importFilesTitle'),
    })
    if (!result.ok) {
      if (result.cancelled) return
      onActionError?.(
        result.error === 'file too large'
          ? t('tabContexts.importTooLarge')
          : result.error === 'root outside import folder'
            ? t('tabContexts.importRootConflict')
            : (result.error ?? t('tabContexts.previewError')),
      )
      return
    }
    const existing = (draft.paths ?? []).map(path => path.trim()).filter(Boolean)
    const merged = [...existing, ...result.paths.filter(path => !existing.includes(path))]
    onUpdate({ paths: merged })
  }
  const hostOwnedReadOnly = readOnlyChangelog || readOnlyAgentResult
  // Un contexto "guardado" es uno que ya está en el catálogo vivo del padre —
  // la vista previa (TAB_CONTEXT_PREVIEW) no escribe a disco, así que
  // preview.status === 'success' no implica que el .md exista todavía.
  // También hay que comparar el archivo: editar el nombre reescribe
  // `draft.fileName` en cada tecla mientras el `id` no cambia hasta save(), y
  // con solo el `id` el botón quedaba habilitado apuntando a un .md que
  // todavía no existe.
  const savedContext = contexts.find(item => item.id === draft.id)
  // `jira` aparte: el Input de Nombre (más abajo) reescribe `draft.fileName`
  // en cada tecla para todos los kinds, y para `jira` eso le hace perder el
  // subdirectorio `jira/` — el archivo real no cambia con el nombre, así que
  // comparar contra `draft.fileName` apagaría Revelar tras cualquier
  // renombrado aunque el .md siga exactamente donde estaba.
  const isSaved = Boolean(savedContext && (
    draft.kind === 'jira'
      ? savedContext.fileName === canonicalContextFileName('jira', { issueKey: draft.issueKey })
      : savedContext.fileName === draft.fileName
  ))

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
          <div className="tab-contexts__kind-groups" role="radiogroup" aria-label={t('tabContexts.kind')}>
            {KIND_GROUPS.map(group => (
              <div className="tab-contexts__kind-group" key={group.labelKey}>
                <span className="tab-contexts__kind-group-label">{t(group.labelKey)}</span>
                <div className="tab-contexts__kinds">
                  {group.kinds.map(kind => (
                    <TabContextKindCard
                      key={kind}
                      label={t(`tabContexts.kind_${kind}`)}
                      icon={KIND_ICONS[kind]}
                      selected={draft.kind === kind}
                      onSelect={() => onSelectKind(kind)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {draft.kind !== 'notes' && draft.kind !== 'changelog' && draft.kind !== 'jira' ? (
          <TabContextRootPathField
            value={draft.rootPath ?? ''}
            projectCwd={projectCwd}
            onChange={rootPath => onUpdate({ rootPath })}
            onPickError={onActionError}
          />
        ) : null}

        {(draft.kind === 'files' || draft.kind === 'symbols' || draft.kind === 'spreadsheet') && (
          <label>
            <span className="tab-contexts__paths-label">
              {t('tabContexts.paths')}
              <Button
                variant="secondary"
                size="sm"
                disabled={!projectCwd.trim()}
                onClick={() => { void importFiles() }}
              >
                {t('tabContexts.importFiles')}
              </Button>
            </span>
            <TextArea
              rows={5}
              value={(draft.paths ?? []).join('\n')}
              placeholder={t(draft.kind === 'spreadsheet'
                ? 'tabContexts.pathsPlaceholderSpreadsheet'
                : 'tabContexts.pathsPlaceholder')}
              onChange={event => onUpdate({ paths: event.target.value.split(/\r?\n/) })}
            />
          </label>
        )}

        {(draft.kind === 'files' || draft.kind === 'spreadsheet') && (
          <SettingToggle
            checked={draft.referenceOnly === true}
            onChange={checked => onUpdate({ referenceOnly: checked || undefined })}
            title={t('tabContexts.referenceOnly')}
            description={t('tabContexts.referenceOnlyHint')}
          />
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

        {draft.kind === 'jira' && (
          <label>
            <span>{t('tabContexts.jiraKeyLabel')}</span>
            {/*
              Buscador, no campo de clave: pedirle a alguien la clave exacta de
              memoria es el mismo trabajo que hace Jira. Reusa el picker del
              composer — mismo debounce, mismo teclado, misma IPC — desplegado
              hacia abajo porque aquí sí hay sitio.
            */}
            <div className="tab-contexts__jira-search">
              <Input
                ref={setJiraInputEl}
                value={jiraKeyDraft}
                placeholder={t('tabContexts.jiraKeyPlaceholder')}
                onChange={event => {
                  setPickerDismissedFor(null)
                  onJiraKeyDraftChange(event.target.value)
                }}
              />
              {projectCwd.trim() && jiraKeyDraft.trim() && jiraKeyDraft !== pickerDismissedFor
                ? (
                  <JiraMentionPicker
                    cwd={projectCwd}
                    query={jiraKeyDraft}
                    placement="down"
                    showEmptyState
                    focusElement={jiraInputEl}
                    onPick={issue => {
                      // La clave elegida cerraría y reabriría la lista con ese
                      // mismo término: se marca como descartada para ese valor.
                      setPickerDismissedFor(issue.key)
                      onJiraKeyDraftChange(issue.key)
                    }}
                    onDismiss={() => setPickerDismissedFor(jiraKeyDraft)}
                  />
                )
                : null}
            </div>
            <small>{t('tabContexts.jiraKeyHint')}</small>
          </label>
        )}

        {/* Nombre, archivo y aspecto van después de la configuración del tipo:
            elegir "Classes and methods" y tener que pasar por el nombre y los
            catorce iconos antes de indicar qué carpeta indexar es el
            formulario al revés (problema 3 del spec). */}
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
        <div className="tab-contexts__file-row">
          {/* `jira` vive bajo `jira/<CLAVE>.md`. El resto de kinds recompone
              el archivo desde `name` porque su Input de Nombre lo mantiene en
              sincro; para `jira` ese mismo Input sobrescribiría
              `draft.fileName` perdiendo el subdirectorio (Nombre es libre,
              como para cualquier otro kind — issue Bug de login). Se muestra
              directo desde el texto actual del campo de clave, no desde
              `draft.issueKey`: ese campo puede quedarse con la última
              derivación válida mientras el texto ya no deriva nada (ver
              `updateJiraKeyDraft`), y aquí no hay razón para mostrar un
              archivo fantasma (`jira/issue.md`) que Guardar tiene bloqueado. */}
          <span>{draft.kind === 'jira'
            ? (normalizeIssueKey(jiraKeyDraft)
                ? `${PROJECT_DIR}/${canonicalContextFileName('jira', { issueKey: normalizeIssueKey(jiraKeyDraft) })}`
                : '—')
            : `${PROJECT_DIR}/${normalizeContextFileName(
                draft.name || draft.fileName || (draft.kind === 'changelog' ? 'changelog' : 'context'),
                draft.kind === 'changelog' ? 'changelog' : 'context',
              )}`}</span>
          <Button
            variant="secondary"
            size="sm"
            disabled={!isSaved}
            onClick={() => {
              onActionError?.('')
              // Mismo motivo que `isSaved` arriba: `draft.fileName` puede
              // llevar el subdirectorio `jira/` perdido tras un renombrado
              // por el Input de Nombre. Usar el archivo canónico real evita
              // que Revelar, ya habilitado por `isSaved`, apunte a un
              // `.gravity/<nombre>.md` que nunca existió.
              const fileName = draft.kind === 'jira'
                ? canonicalContextFileName('jira', { issueKey: draft.issueKey })
                : draft.fileName
              void window.api.revealTabContext(projectCwd, fileName)
                .then(result => {
                  if (!result.ok) onActionError?.(result.error ?? t('tabContexts.revealError'))
                })
                // ipcMain.handle rechaza la promesa si el handler lanza: sin
                // este catch sería un unhandled rejection y el usuario no
                // vería nada.
                .catch(() => onActionError?.(t('tabContexts.revealError')))
            }}
          >
            {t('tabContexts.reveal')}
          </Button>
        </div>

        {!hostOwnedReadOnly && (
          <TabContextAppearancePopup draft={draft} onUpdate={onUpdate} />
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

        {actionMessage && (
          <div className="tab-contexts__preview-panel tab-contexts__preview-panel--error">
            <p>{actionMessage}</p>
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
          {preview.status === 'success' && (
            <span className="tab-contexts__output-view">
              <SegmentedControl
                size="sm"
                layout="scroll"
                label={t('tabContexts.preview')}
                value={previewView}
                options={[
                  { value: 'rendered', label: t('tabContexts.previewRendered') },
                  { value: 'source', label: t('tabContexts.previewSource') },
                ]}
                onChange={setPreviewView}
              />
            </span>
          )}
        </div>
        {preview.status === 'loading' && <p className="tab-contexts__output-msg">{t('tabContexts.loading')}</p>}
        {preview.status === 'idle' && (
          <p className="tab-contexts__output-msg">
            {/* Para `jira` el disparador no es el nombre, es elegir la issue. */}
            {t(draft.kind === 'jira' ? 'tabContexts.jiraPreviewIdle' : 'tabContexts.previewIdle')}
          </p>
        )}
        {preview.status === 'empty' && <p className="tab-contexts__output-msg">{t('tabContexts.previewEmpty')}</p>}
        {preview.status === 'error' && (
          <p className="tab-contexts__output-msg tab-contexts__output-msg--error">{preview.message}</p>
        )}
        {preview.status === 'success' && (
          previewView === 'source'
            ? <pre className="tab-contexts__preview">{preview.content}</pre>
            : (
              <div className="tab-contexts__preview-rendered">
                {/* Mismo Reporte que el modal de vista previa: árbol de carpetas,
                    dependencias y JSON plegable en vez de markdown crudo. Los
                    marcadores `<!-- iaterminal:* -->` solo se ven en "Source". */}
                <ContextReport context={draft} content={preview.content} />
              </div>
            )
        )}
      </aside>
    </div>
  )
}
