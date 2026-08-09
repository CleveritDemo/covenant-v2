import React, { useEffect, useState } from 'react'
import { useT } from '@i18n/useT'
import { FilePreviewStatus } from './FilePreview'
import { useFileBytes } from './useFileBytes'

/** Celdas que se pintan por hoja; una hoja de 100k filas no debe colgar la app. */
const MAX_ROWS = 500
const MAX_COLS = 60

interface Sheet {
  name: string
  rows: string[][]
  truncatedRows: number
}

type Parsed =
  | { status: 'parsing' }
  | { status: 'ready'; sheets: Sheet[] }
  | { status: 'error'; message: string }

/**
 * Vista de un libro de cálculo: una pestaña por hoja y una tabla de sólo
 * lectura. SheetJS se carga con `import()` dinámico para que no entre en el
 * bundle inicial del renderer — sólo lo paga quien abre un .xlsx.
 */
export const XlsxPreview: React.FC<{ sessionId: string; relPath: string }> = ({
  sessionId,
  relPath,
}) => {
  const { t } = useT()
  const bytesState = useFileBytes(sessionId, relPath, 'xlsx')
  const [parsed, setParsed] = useState<Parsed>({ status: 'parsing' })
  const [active, setActive] = useState(0)

  useEffect(() => {
    if (bytesState.status !== 'ready') return
    let cancelled = false
    setParsed({ status: 'parsing' })
    setActive(0)

    void (async () => {
      try {
        const XLSX = await import('xlsx')
        if (cancelled) return
        const wb = XLSX.read(bytesState.bytes, { type: 'array' })
        const sheets: Sheet[] = wb.SheetNames.map(name => {
          // `header: 1` da una matriz cruda; `raw: false` deja el texto tal como
          // Excel lo muestra, que es lo que el usuario espera ver.
          const all = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[name], {
            header: 1,
            raw: false,
            defval: '',
          })
          return {
            name,
            rows: all.slice(0, MAX_ROWS).map(row => row.slice(0, MAX_COLS)),
            truncatedRows: Math.max(0, all.length - MAX_ROWS),
          }
        })
        setParsed(sheets.length
          ? { status: 'ready', sheets }
          : { status: 'error', message: t('fileExplorer.preview.emptyWorkbook') })
      } catch (e) {
        if (!cancelled) {
          setParsed({ status: 'error', message: e instanceof Error ? e.message : String(e) })
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [bytesState, t])

  if (bytesState.status !== 'ready') return <FilePreviewStatus state={bytesState} />
  if (parsed.status === 'parsing') {
    return <div className="file-preview__center file-preview__message">{t('fileExplorer.preview.loading')}</div>
  }
  if (parsed.status === 'error') {
    return (
      <div className="file-preview__center file-preview__message file-preview__message--error" role="alert">
        {t('fileExplorer.preview.error', { message: parsed.message })}
      </div>
    )
  }

  const sheet = parsed.sheets[Math.min(active, parsed.sheets.length - 1)]
  const columns = sheet.rows.reduce((max, row) => Math.max(max, row.length), 0)

  return (
    <div className="file-preview__sheet">
      {parsed.sheets.length > 1 && (
        <div className="file-preview__sheet-tabs" role="tablist">
          {parsed.sheets.map((s, i) => (
            <button
              key={s.name}
              type="button"
              role="tab"
              aria-selected={i === active}
              className={['file-preview__sheet-tab', i === active ? 'file-preview__sheet-tab--active' : '']
                .filter(Boolean).join(' ')}
              onClick={() => setActive(i)}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
      <div className="file-preview__table-wrap">
        <table className="file-preview__table">
          <tbody>
            {sheet.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                <th className="file-preview__table-gutter" scope="row">{rowIndex + 1}</th>
                {Array.from({ length: columns }, (_, colIndex) => (
                  <td key={colIndex} className="file-preview__table-cell">
                    <span className="file-preview__table-value">{row[colIndex] ?? ''}</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {sheet.truncatedRows > 0 && (
          <p className="file-preview__table-more">
            {t('fileExplorer.preview.moreRows', { count: sheet.truncatedRows })}
          </p>
        )}
      </div>
    </div>
  )
}
