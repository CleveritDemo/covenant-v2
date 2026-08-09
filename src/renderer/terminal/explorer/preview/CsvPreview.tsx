import React, { useMemo, useState } from 'react'
import { useT } from '@i18n/useT'
import {
  csvColumnCount,
  csvDelimiterForPath,
  csvEolForText,
  parseCsv,
  serializeCsv,
} from '@shared/csvTable'

/** Filas que se pintan; el resto sigue en memoria y se re-serializa al guardar. */
const MAX_RENDER_ROWS = 500

interface CsvPreviewProps {
  relPath: string
  content: string
  onChange?: (content: string) => void
}

/**
 * Vista de hoja de cálculo sobre un CSV/TSV, editable celda a celda.
 *
 * Una edición re-serializa la matriz COMPLETA —incluidas las filas más allá del
 * tope de pintado— y devuelve el texto nuevo por `onChange`; el estado dirty y
 * el ⌘S siguen siendo del panel, esta vista nunca toca el disco.
 */
export const CsvPreview: React.FC<CsvPreviewProps> = ({ relPath, content, onChange }) => {
  const { t } = useT()
  const [editing, setEditing] = useState<{ row: number; col: number } | null>(null)

  const delim = csvDelimiterForPath(relPath)
  const rows = useMemo(() => parseCsv(content, delim), [content, delim])
  const columns = useMemo(() => csvColumnCount(rows), [rows])
  const shown = rows.slice(0, MAX_RENDER_ROWS)

  const commit = (rowIndex: number, colIndex: number, value: string): void => {
    setEditing(null)
    const current = rows[rowIndex]?.[colIndex] ?? ''
    if (current === value) return
    const next = rows.map(r => [...r])
    // Las filas cortas se rellenan hasta la columna editada; si no, el valor
    // acabaría en una posición distinta al re-serializar.
    while (next[rowIndex].length <= colIndex) next[rowIndex].push('')
    next[rowIndex][colIndex] = value
    onChange?.(serializeCsv(next, { delim, eol: csvEolForText(content) }))
  }

  if (rows.length === 0) {
    return (
      <div className="file-preview__center file-preview__message">
        {t('fileExplorer.preview.emptyTable')}
      </div>
    )
  }

  return (
    <div className="file-preview__table-wrap">
      <table className="file-preview__table">
        <tbody>
          {shown.map((row, rowIndex) => (
            <tr key={rowIndex}>
              <th className="file-preview__table-gutter" scope="row">{rowIndex + 1}</th>
              {Array.from({ length: columns }, (_, colIndex) => {
                const value = row[colIndex] ?? ''
                const isEditing = editing?.row === rowIndex && editing.col === colIndex
                return (
                  <td key={colIndex} className="file-preview__table-cell">
                    {isEditing && onChange
                      ? (
                          <input
                            className="file-preview__table-input"
                            defaultValue={value}
                            autoFocus
                            onBlur={e => commit(rowIndex, colIndex, e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                commit(rowIndex, colIndex, e.currentTarget.value)
                              }
                              if (e.key === 'Escape') {
                                e.preventDefault()
                                setEditing(null)
                              }
                            }}
                          />
                        )
                      : (
                          <button
                            type="button"
                            className="file-preview__table-value"
                            disabled={!onChange}
                            onClick={() => setEditing({ row: rowIndex, col: colIndex })}
                          >
                            {value}
                          </button>
                        )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > shown.length && (
        <p className="file-preview__table-more">
          {t('fileExplorer.preview.moreRows', { count: rows.length - shown.length })}
        </p>
      )}
    </div>
  )
}
