/**
 * Parseo y serialización de CSV/TSV.
 *
 * A propósito NO se usa SheetJS aquí: una vista editable tiene que devolver
 * intactas las celdas que nadie tocó, y SheetJS parsea a valores tipados —
 * "3e-06" se convierte en 0.000003 y los enteros grandes pierden precisión.
 * Las celdas se quedan como strings crudos.
 */

/** Parser estilo RFC 4180: comillas, `""` escapado, saltos y delimitadores dentro de comillas. */
export function parseCsv(text: string, delim = ','): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false
  let i = 0

  const endCell = (): void => {
    row.push(cell)
    cell = ''
  }
  const endRow = (): void => {
    endCell()
    rows.push(row)
    row = []
  }

  while (i < text.length) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      cell += ch
      i++
      continue
    }
    if (ch === '"' && cell === '') {
      inQuotes = true
      i++
      continue
    }
    if (ch === delim) {
      endCell()
      i++
      continue
    }
    if (ch === '\r') {
      if (text[i + 1] === '\n') i++
      endRow()
      i++
      continue
    }
    if (ch === '\n') {
      endRow()
      i++
      continue
    }
    cell += ch
    i++
  }
  // Un salto de línea final no debe producir una fila fantasma.
  if (cell !== '' || row.length > 0) endRow()
  return rows
}

/**
 * Serializador de comillas mínimas: una celda se entrecomilla sólo si contiene
 * el delimitador, una comilla o un salto. Las comillas superfluas del archivo
 * original se normalizan; los valores se preservan exactos.
 */
export function serializeCsv(
  rows: string[][],
  opts: { delim?: string; eol?: string } = {},
): string {
  const delim = opts.delim ?? ','
  const eol = opts.eol ?? '\n'
  const esc = (s: string): string =>
    s.includes(delim) || s.includes('"') || s.includes('\n') || s.includes('\r')
      ? `"${s.replace(/"/g, '""')}"`
      : s
  return rows.map(r => r.map(esc).join(delim)).join(eol)
}

/** `\t` para .tsv, `,` para el resto. */
export function csvDelimiterForPath(path: string): string {
  return /\.tsv$/i.test(path) ? '\t' : ','
}

/** Fin de línea dominante del texto, para no convertir un archivo CRLF a LF al guardar. */
export function csvEolForText(text: string): string {
  return text.includes('\r\n') ? '\r\n' : '\n'
}

/** Ancho de la fila más larga; las filas cortas se rellenan al pintar. */
export function csvColumnCount(rows: string[][]): number {
  return rows.reduce((max, row) => Math.max(max, row.length), 0)
}
