import React, { useMemo } from 'react'
import type { TFunction } from 'i18next'
import type { TabContext, TabContextKind } from '@shared/tabContext'
import {
  contextReportCounts,
  parseContextDoc,
  splitFences,
  type ContextDoc,
} from '@shared/contextReportDoc'
import { useT } from '@i18n/useT'
import { AiMarkdown } from '../components/AiMarkdown'
import './ContextReport.css'

/** Texto de la primera `<small>` del meta: `148 carpetas · 3 anotadas`. */
export function contextReportMetaText(
  kind: TabContextKind,
  doc: ContextDoc,
  t: TFunction<'app'>,
): string {
  return contextReportCounts(kind, doc)
    .map(count => t(
      `tabContexts.reportCount_${count.key}` as 'tabContexts.reportCount_folders',
      { count: count.count },
    ))
    .join(' · ')
}

/** Notas humanas y anotaciones por clave. Solo lectura: escribirlas exige un IPC nuevo. */
const ContextNotes: React.FC<{ doc: ContextDoc }> = ({ doc }) => {
  const { t } = useT()
  if (!doc.notes && !doc.annotations.length) return null

  return (
    <section className="context-report__notes">
      <header>
        <h3>{t('tabContexts.reportNotesTitle')}</h3>
        <span className="context-report__prov">{t('tabContexts.reportNotesByAi')}</span>
      </header>
      {doc.notes ? <p className="context-report__notes-text">{doc.notes}</p> : null}
      {doc.annotations.length ? (
        <dl className="context-report__annotations">
          {doc.annotations.map(annotation => (
            <div key={annotation.key}>
              <dt>{annotation.key}</dt>
              <dd>{annotation.text}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  )
}

/** Cuerpo por defecto: fences en `<pre>`, el resto por el markdown del chat. */
const GenericBody: React.FC<{ auto: string }> = ({ auto }) => {
  const { t } = useT()
  const chunks = useMemo(() => splitFences(auto), [auto])
  if (!chunks.length) return <p className="context-report__empty">{t('tabContexts.reportEmpty')}</p>

  return (
    <>
      {chunks.map((chunk, index) => (
        chunk.fence
          ? <pre key={index} className="context-report__code">{chunk.text}</pre>
          : <AiMarkdown key={index} content={chunk.text} />
      ))}
    </>
  )
}

/** Cada kind con vista dedicada añade su caso; el resto cae en el genérico. */
const ContextBody: React.FC<{ kind: TabContextKind; auto: string }> = ({ kind, auto }) => {
  switch (kind) {
    default:
      return <GenericBody auto={auto} />
  }
}

/** Lectura humana de un contexto de proyecto; `agentResult` tiene la suya aparte. */
export const ContextReport: React.FC<{ context: TabContext; content: string }> = ({
  context,
  content,
}) => {
  const doc = useMemo(() => parseContextDoc(content), [content])

  return (
    <div className="context-report">
      <ContextBody kind={context.kind} auto={doc.auto} />
      <ContextNotes doc={doc} />
    </div>
  )
}
