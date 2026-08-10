import React, { useMemo, useState } from 'react'
import type { TFunction } from 'i18next'
import type { TabContext, TabContextKind } from '@shared/tabContext'
import {
  contextReportCounts,
  countFolderNodes,
  parseContextDoc,
  parseFolderTree,
  splitFences,
  type ContextDoc,
  type FolderNode,
} from '@shared/contextReportDoc'
import { useT } from '@i18n/useT'
import { AiMarkdown } from '../components/AiMarkdown'
import { JsonTree, parseJsonTree } from '../components/JsonTree'
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
const ContextNotes: React.FC<{
  doc: ContextDoc
  /** Si el cuerpo principal ya es `doc.notes` (kind notes), no repetir el texto. */
  hideNotesText?: boolean
}> = ({ doc, hideNotesText = false }) => {
  const { t } = useT()
  const showNotesText = Boolean(doc.notes) && !hideNotesText
  if (!showNotesText && !doc.annotations.length) return null

  return (
    <section className="context-report__notes">
      <header>
        <h3>{t('tabContexts.reportNotesTitle')}</h3>
        <span className="context-report__prov">{t('tabContexts.reportNotesByAi')}</span>
      </header>
      {showNotesText ? (
        <div className="context-report__notes-text">
          {/* Mismo render que el cuerpo: markdown + fences en <pre>. */}
          <GenericBody auto={doc.notes} />
        </div>
      ) : null}
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

/**
 * Cuerpo por defecto: JSON en árbol plegable, fences en `<pre>`, el resto por
 * el markdown del chat. El JSON crudo (manifiestos, .mcp.json) caía en el
 * markdown y salía como una línea suelta por clave.
 */
const GenericBody: React.FC<{ auto: string }> = ({ auto }) => {
  const { t } = useT()
  const chunks = useMemo(
    () => splitFences(auto).map(chunk => ({ ...chunk, json: parseJsonTree(chunk.text) })),
    [auto],
  )
  if (!chunks.length) return <p className="context-report__empty">{t('tabContexts.reportEmpty')}</p>

  return (
    <>
      {chunks.map((chunk, index) => (
        chunk.json !== undefined
          ? <JsonTree key={index} value={chunk.json} />
          : chunk.fence
            ? <pre key={index} className="context-report__code">{chunk.text}</pre>
            : <AiMarkdown key={index} content={chunk.text} />
      ))}
    </>
  )
}

/** Rutas abiertas al montar: los dos primeros niveles. */
function initialOpenPaths(nodes: readonly FolderNode[], depth = 0): string[] {
  if (depth >= 2) return []
  return nodes.flatMap(node => [node.path, ...initialOpenPaths(node.children, depth + 1)])
}

const FolderTreeNode: React.FC<{
  node: FolderNode
  open: Set<string>
  onToggle: (path: string) => void
}> = ({ node, open, onToggle }) => {
  const { t } = useT()
  const expandable = node.children.length > 0
  const expanded = open.has(node.path)

  return (
    <li className="context-report__tree-node">
      <div className="context-report__tree-row">
        {expandable ? (
          <button
            type="button"
            className="context-report__tree-chevron"
            aria-expanded={expanded}
            aria-label={t('tabContexts.reportTreeToggle')}
            onClick={() => onToggle(node.path)}
          >
            {expanded ? '▾' : '▸'}
          </button>
        ) : (
          <span className="context-report__tree-chevron" aria-hidden />
        )}
        <span className={node.truncated ? 'context-report__tree-truncated' : 'context-report__tree-name'}>
          {node.truncated ? node.name : `${node.name}/`}
        </span>
        {expandable ? (
          <span className="context-report__tree-count">{countFolderNodes(node.children)}</span>
        ) : null}
      </div>
      {expandable && expanded ? (
        <ul className="context-report__tree">
          {node.children.map(child => (
            <FolderTreeNode key={child.path} node={child} open={open} onToggle={onToggle} />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

const FolderTreeBody: React.FC<{ auto: string }> = ({ auto }) => {
  const { root, nodes } = useMemo(() => parseFolderTree(auto), [auto])
  // El estado no se persiste: al reabrir el modal se vuelve a los dos niveles.
  const [open, setOpen] = useState(() => new Set(initialOpenPaths(nodes)))
  const toggle = (path: string): void => {
    setOpen(current => {
      const next = new Set(current)
      if (!next.delete(path)) next.add(path)
      return next
    })
  }

  if (!nodes.length) return <GenericBody auto={auto} />

  return (
    <div className="context-report__tree-wrap">
      {root ? <p className="context-report__tree-root">{root}</p> : null}
      <ul className="context-report__tree">
        {nodes.map(node => (
          <FolderTreeNode key={node.path} node={node} open={open} onToggle={toggle} />
        ))}
      </ul>
    </div>
  )
}

/** Cada kind con vista dedicada añade su caso; el resto cae en el genérico. */
const ContextBody: React.FC<{ kind: TabContextKind; auto: string }> = ({ kind, auto }) => {
  switch (kind) {
    case 'folderTree':
      return <FolderTreeBody auto={auto} />
    // `deps` no tiene vista propia: el manifiesto JSON lo pinta el árbol del
    // genérico (y Cargo.toml/go.mod, que no son JSON, caen a texto).
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
  // Custom Markdown: el contenido útil está en notes; auto es stub materialize.
  // El `|| doc.auto` no es defensivo de más: un .md de notas sin los marcadores
  // `iaterminal:notes` deja `doc.notes` vacío y sin él la vista decía «vacío»
  // teniendo el texto delante.
  const notesKind = context.kind === 'notes'
  const notesAsBody = notesKind && Boolean(doc.notes)
  const body = notesAsBody ? doc.notes : doc.auto

  return (
    <div className="context-report">
      <ContextBody kind={context.kind} auto={body} />
      {/* Solo se oculta si el cuerpo ES ese texto; si no, se perdería. */}
      <ContextNotes doc={doc} hideNotesText={notesAsBody} />
    </div>
  )
}
