import React, { useEffect, useMemo, useState } from 'react'
import type { TFunction } from 'i18next'
import type { TabContext } from '@shared/tabContext'
import { collectAutoAnnotationKeys } from '@shared/tabContext'
import {
  formatLogTime,
  groupLogEntriesByDay,
  isAgentResultsDocEmpty,
  parseAgentResultsDoc,
  type AgentResultsDoc,
} from '@shared/agentResultsDoc'
import { APP_OVERLAY_MODAL_Z } from '@shared/overlayZIndex'
import { useT } from '@i18n/useT'
import { TerminalModal } from '../components/TerminalModal'
import { Button } from '../components/ui/Button'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import { TextArea } from '../components/ui/TextArea'
import type { PreviewState } from '../agent/TabContextsEditor'
import '../agent/AgentPane.css'
import './ContextContentPreviewModal.css'

export interface ContextContentPreviewModalProps {
  open: boolean
  context: TabContext | null
  cwd: string
  onClose: () => void
}

function countAutoKeys(content: string): number {
  const auto = content.match(/<!-- iaterminal:auto -->([\s\S]*?)<!-- \/iaterminal:auto -->/)?.[1] ?? ''
  return collectAutoAnnotationKeys(auto).size
}

function countAnnotations(content: string): number {
  const notes = content.match(/<!-- iaterminal:notes -->([\s\S]*?)<!-- \/iaterminal:notes -->/)?.[1] ?? ''
  return [...notes.matchAll(/^-\s+`[^`]+`\s+—\s+/gm)].length
}

/** `2026-08-06` → hoy / ayer / fecha local. Cadena vacía si el timestamp no era válido. */
function dayLabel(day: string, t: TFunction<'app'>): string {
  if (!day) return ''
  const today = new Date()
  const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  if (day === iso(today)) return t('tabContexts.resultsToday')
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (day === iso(yesterday)) return t('tabContexts.resultsYesterday')
  return new Date(`${day}T00:00`).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: today.getFullYear() === Number(day.slice(0, 4)) ? undefined : 'numeric',
  })
}

const RESULT_ID_PREFIX = 'iaterminal:result:'

/** `/Users/…/proyecto/.iaterminal/results/qa.md` → `.iaterminal/results/qa.md`. */
function shortPath(filePath: string | undefined): string {
  const path = filePath ?? ''
  const at = path.lastIndexOf('.iaterminal')
  return at > 0 ? path.slice(at) : path
}

/** Bloque que el agente debe escribir; ver buildAiAgentResultsInstruction(). */
const RESULTS_FENCE = [
  '```ia-terminal-results',
  '{"summary":"Current status or outcome",',
  ' "entries":["Optional short log line"]}',
  '```',
].join('\n')

interface ResultsConsumer {
  id: string
  name: string
}

/** Notas humanas del results: la única región que edita la persona. */
const ResultsNotes: React.FC<{
  notes: string | null
  onSave: (notes: string) => Promise<string | null>
}> = ({ notes, onSave }) => {
  const { t } = useT()
  const [draft, setDraft] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const editing = draft !== null

  const save = async () => {
    if (draft === null) return
    setSaving(true)
    const failure = await onSave(draft)
    setSaving(false)
    setError(failure ?? '')
    if (!failure) setDraft(null)
  }

  return (
    <section className="results-report__block">
      <header>
        <h3>{t('tabContexts.resultsNotesTitle')}</h3>
        <span className="results-report__prov results-report__prov--human">
          {t('tabContexts.resultsByHuman')}
        </span>
        <span className="results-report__spacer" />
        {editing ? (
          <>
            <Button size="xs" variant="ghost" disabled={saving} onClick={() => setDraft(null)}>
              {t('tabContexts.resultsNotesCancel')}
            </Button>
            <Button size="xs" variant="primary" disabled={saving} onClick={() => void save()}>
              {t('tabContexts.resultsNotesSave')}
            </Button>
          </>
        ) : (
          <Button size="xs" variant="ghost" onClick={() => setDraft(notes ?? '')}>
            {notes ? t('tabContexts.resultsNotesEdit') : t('tabContexts.resultsNotesAdd')}
          </Button>
        )}
      </header>
      {editing ? (
        <TextArea
          rows={4}
          value={draft}
          autoFocus
          disabled={saving}
          placeholder={t('tabContexts.resultsNotesPlaceholder')}
          onChange={event => setDraft(event.target.value)}
        />
      ) : (
        <p className={notes ? 'results-report__notes' : 'results-report__notes-empty'}>
          {notes ?? t('tabContexts.resultsNotesEmpty')}
        </p>
      )}
      {error ? <p className="results-report__error">{error}</p> : null}
    </section>
  )
}

/** Lectura humana del `results/<agente>.md`: resumen, actividad y notas. */
const AgentResultsReport: React.FC<{
  doc: AgentResultsDoc
  agentName: string
  consumers: readonly ResultsConsumer[]
  onSaveNotes: (notes: string) => Promise<string | null>
}> = ({ doc, agentName, consumers, onSaveNotes }) => {
  const { t } = useT()
  const groups = useMemo(() => groupLogEntriesByDay(doc.entries), [doc.entries])
  const name = agentName || t('tabContexts.resultsAgentFallback')

  if (isAgentResultsDocEmpty(doc)) {
    return (
      <div className="results-report results-report--empty">
        <h3>{t('tabContexts.resultsEmptyTitle', { name })}</h3>
        <p>{t('tabContexts.resultsEmptyBody', { name })}</p>
        <pre className="results-report__fence">{RESULTS_FENCE}</pre>
        <p>{t('tabContexts.resultsEmptyNotes')}</p>
        <ResultsNotes notes={null} onSave={onSaveNotes} />
      </div>
    )
  }

  return (
    <div className="results-report">
      <section className="results-report__latest">
        <h3>
          {t('tabContexts.resultsLatest')}
          {doc.entries[0] ? (
            <time dateTime={doc.entries[0].timestamp}>
              {dayLabel(groups[0]?.day ?? '', t)} · {formatLogTime(doc.entries[0].timestamp)}
            </time>
          ) : null}
        </h3>
        <p>{doc.summary ?? t('tabContexts.resultsNoSummary')}</p>
        {consumers.length ? (
          <p className="results-report__consumers">
            <span>{t('tabContexts.resultsConsumers')}</span>
            {consumers.map(consumer => (
              <span key={consumer.id} className="results-report__agent-chip">
                <i aria-hidden />
                {consumer.name}
              </span>
            ))}
          </p>
        ) : null}
      </section>

      {doc.entries.length ? (
        <section className="results-report__block">
          <header>
            <h3>{t('tabContexts.resultsActivity')}</h3>
            <span className="results-report__prov">{t('tabContexts.resultsByAgent')}</span>
          </header>
          {groups.map(group => (
            <div key={group.day || 'unknown'} className="results-report__day">
              {group.day ? <p className="results-report__day-label">{dayLabel(group.day, t)}</p> : null}
              <ul className="results-report__log">
                {group.entries.map(entry => (
                  <li key={`${entry.timestamp}-${entry.text}`}>
                    <time dateTime={entry.timestamp} title={entry.timestamp}>
                      {formatLogTime(entry.timestamp)}
                    </time>
                    <span className="results-report__spine" aria-hidden />
                    <span className="results-report__text">{entry.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ) : null}

      <ResultsNotes notes={doc.notes} onSave={onSaveNotes} />
    </div>
  )
}

/** Vista previa solo lectura del Markdown de un contexto (p. ej. results de agente). */
export const ContextContentPreviewModal: React.FC<ContextContentPreviewModalProps> = ({
  open,
  context,
  cwd,
  onClose,
}) => {
  const { t } = useT()
  const [preview, setPreview] = useState<PreviewState>({ status: 'idle' })
  const [view, setView] = useState<'report' | 'source'>('report')
  const [reload, setReload] = useState(0)
  const [consumers, setConsumers] = useState<ResultsConsumer[]>([])
  const isResults = context?.kind === 'agentResult'
  const agentId = isResults && context.id.startsWith(RESULT_ID_PREFIX)
    ? context.id.slice(RESULT_ID_PREFIX.length)
    : ''
  const doc = useMemo(
    () => (isResults && preview.status === 'success' ? parseAgentResultsDoc(preview.content) : null),
    [isResults, preview],
  )

  // Quién tiene este results entre sus contextIds (el dueño no cuenta).
  useEffect(() => {
    if (!open || !isResults || !cwd.trim()) {
      setConsumers([])
      return
    }
    let cancelled = false
    void window.api.listProjectAgents(cwd.trim()).then(agents => {
      if (cancelled) return
      setConsumers(agents
        .filter(agent => agent.id !== agentId && (agent.contextIds ?? []).includes(context.id))
        .map(agent => ({ id: agent.id, name: agent.name?.trim() || agent.id })))
    }).catch(() => {
      if (!cancelled) setConsumers([])
    })
    return () => {
      cancelled = true
    }
  }, [open, isResults, cwd, agentId, context?.id])

  const saveNotes = async (notes: string): Promise<string | null> => {
    if (!agentId || !cwd.trim()) return t('tabContexts.resultsNotesSaveFailed')
    const result = await window.api.setAiAgentResultsNotes({ cwd: cwd.trim(), agentId, notes })
    if (!result.ok) return result.error?.trim() || t('tabContexts.resultsNotesSaveFailed')
    setReload(value => value + 1)
    return null
  }

  useEffect(() => {
    if (!open || !context) {
      setPreview({ status: 'idle' })
      return
    }
    const workingCwd = cwd.trim()
    if (!workingCwd) {
      setPreview({ status: 'error', message: t('tabContexts.missingCwd') })
      return
    }
    let cancelled = false
    setPreview({ status: 'loading' })
    void window.api.previewTabContext({ context, cwd: workingCwd }).then(result => {
      if (cancelled) return
      if (!result.ok) {
        setPreview({
          status: 'error',
          message: result.error?.trim() || t('tabContexts.previewError'),
        })
        return
      }
      const content = result.content ?? ''
      if (!content.trim()) {
        setPreview({ status: 'empty', filePath: result.filePath })
        return
      }
      setPreview({
        status: 'success',
        content,
        filePath: result.filePath ?? context.fileName,
      })
    }).catch(error => {
      if (cancelled) return
      setPreview({
        status: 'error',
        message: error instanceof Error ? error.message : String(error),
      })
    })
    return () => {
      cancelled = true
    }
  }, [open, context, cwd, reload, t])

  const title = context
    ? `${context.name} · ${t(`tabContexts.kind_${context.kind}`)}`
    : t('tabContexts.preview')

  return (
    <TerminalModal
      open={open && Boolean(context)}
      onClose={onClose}
      title={title}
      titleId="context-content-preview-title"
      size="xl"
      bodyLayout="flush"
      closeOnBackdrop
      zIndex={APP_OVERLAY_MODAL_Z}
    >
      <div className="context-content-preview">
        {preview.status === 'idle' && (
          <p className="tab-contexts__preview-empty">{t('tabContexts.selectToPreview')}</p>
        )}
        {preview.status === 'loading' && (
          <div className="tab-contexts__preview-panel tab-contexts__preview-panel--loading">
            <p>{t('tabContexts.loading')}</p>
          </div>
        )}
        {preview.status === 'empty' && (
          <div className="tab-contexts__preview-panel tab-contexts__preview-panel--empty">
            <p>{t('tabContexts.previewEmpty')}</p>
            {preview.filePath ? <small>{preview.filePath}</small> : null}
          </div>
        )}
        {preview.status === 'error' && (
          <div className="tab-contexts__preview-panel tab-contexts__preview-panel--error">
            <p>{preview.message}</p>
          </div>
        )}
        {preview.status === 'success' && (
          <div className="tab-contexts__preview-panel tab-contexts__preview-panel--success">
            <div className="tab-contexts__preview-meta">
              {doc && view === 'report' ? (
                <small>
                  {doc.entries.length
                    ? t('tabContexts.resultsEntries', { count: doc.entries.length })
                    : ''}
                  {doc.notes ? `${doc.entries.length ? ' · ' : ''}${t('tabContexts.resultsHasNotes')}` : ''}
                </small>
              ) : (
                <small>{shortPath(preview.filePath)}</small>
              )}
              {doc ? (
                <SegmentedControl
                  size="sm"
                  layout="scroll"
                  label={t('tabContexts.resultsView')}
                  value={view}
                  onChange={setView}
                  options={[
                    { value: 'report', label: t('tabContexts.resultsViewReport') },
                    { value: 'source', label: t('tabContexts.resultsViewSource') },
                  ]}
                />
              ) : null}
              <small>
                {doc && view === 'report'
                  ? shortPath(preview.filePath)
                  : t('tabContexts.previewStats', {
                    auto: countAutoKeys(preview.content),
                    notes: countAnnotations(preview.content),
                  })}
              </small>
            </div>
            {doc && view === 'report' ? (
              <AgentResultsReport
                doc={doc}
                agentName={context?.name?.trim() || ''}
                consumers={consumers}
                onSaveNotes={saveNotes}
              />
            ) : (
              <pre className="tab-contexts__preview">{preview.content}</pre>
            )}
          </div>
        )}
      </div>
    </TerminalModal>
  )
}
