import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { utils as xlsxUtils, write as writeXlsxBuffer } from 'xlsx'
import { materializeTabContext } from '../tabContextBuild'

describe('buildSpreadsheet csv verbatim', () => {
  const dirs: string[] = []
  const tempCwd = (): string => {
    const dir = mkdtempSync(join(tmpdir(), 'ia-terminal-spreadsheet-'))
    dirs.push(dir)
    return dir
  }
  afterEach(() => dirs.splice(0).forEach(dir => rmSync(dir, { recursive: true, force: true })))

  const spreadsheet = (cwd: string, paths: string[]) => materializeTabContext({
    id: 'historias',
    name: 'Historias',
    fileName: 'historias.md',
    kind: 'spreadsheet' as const,
    paths,
  }, cwd)

  it('pasa un .csv verbatim: fecha ISO y campo entrecomillado con coma', () => {
    const cwd = tempCwd()
    mkdirSync(join(cwd, 'docs'), { recursive: true })
    writeFileSync(
      join(cwd, 'docs', 'gente.csv'),
      'nombre,alta\n"Pérez, Ana",2026-08-18\n',
      'utf8',
    )

    const result = spreadsheet(cwd, ['docs/gente.csv'])

    expect(result.ok).toBe(true)
    expect(result.content).toContain('### docs/gente.csv\n```csv')
    expect(result.content).not.toMatch(/### docs\/gente\.csv · /)
    expect(result.content).toContain('2026-08-18')
    expect(result.content).toContain('"Pérez, Ana"')
  })

  it('quita el BOM inicial de un .csv', () => {
    const cwd = tempCwd()
    mkdirSync(join(cwd, 'docs'), { recursive: true })
    writeFileSync(
      join(cwd, 'docs', 'bom.csv'),
      '\uFEFFnombre\nAna\n',
      'utf8',
    )

    const result = spreadsheet(cwd, ['docs/bom.csv'])

    expect(result.ok).toBe(true)
    expect(result.content).not.toContain('\uFEFF')
    expect(result.content).toContain('nombre\nAna')
  })

  it('recorta un .csv de más de 5000 líneas y anota las filas descartadas', () => {
    const cwd = tempCwd()
    mkdirSync(join(cwd, 'docs'), { recursive: true })
    const lines = Array.from({ length: 5001 }, (_, index) => String(index))
    writeFileSync(join(cwd, 'docs', 'largo.csv'), `${lines.join('\n')}\n`, 'utf8')

    const result = spreadsheet(cwd, ['docs/largo.csv'])

    expect(result.ok).toBe(true)
    expect(result.content).toContain('4999')
    expect(result.content).not.toMatch(/\n5000\n/)
    expect(result.content).toContain('(1 more row(s) not included; raise the limit or split the sheet)')
  })

  it('un .xlsx sigue emitiendo un bloque por hoja con cabecera ruta · hoja', () => {
    const cwd = tempCwd()
    mkdirSync(join(cwd, 'docs'), { recursive: true })
    const book = xlsxUtils.book_new()
    xlsxUtils.book_append_sheet(book, xlsxUtils.aoa_to_sheet([['A'], ['1']]), 'Uno')
    xlsxUtils.book_append_sheet(book, xlsxUtils.aoa_to_sheet([['B'], ['2']]), 'Dos')
    writeFileSync(
      join(cwd, 'docs', 'libro.xlsx'),
      writeXlsxBuffer(book, { type: 'buffer', bookType: 'xlsx' }) as Buffer,
    )

    const result = spreadsheet(cwd, ['docs/libro.xlsx'])

    expect(result.ok).toBe(true)
    expect(result.content).toContain('### docs/libro.xlsx · Uno')
    expect(result.content).toContain('### docs/libro.xlsx · Dos')
  })

  it('un .csv inexistente no lanza y deja el texto de no disponible', () => {
    const cwd = tempCwd()
    const result = spreadsheet(cwd, ['docs/no-esta.csv'])
    expect(result.ok).toBe(true)
    expect(result.content).toContain('docs/no-esta.csv')
    expect(result.content).toContain('(not found)')
  })

  it('un .csv ilegible no lanza y deja el texto de no disponible', () => {
    const cwd = tempCwd()
    mkdirSync(join(cwd, 'docs'), { recursive: true })
    const path = join(cwd, 'docs', 'cerrado.csv')
    writeFileSync(path, 'nombre\nAna\n', 'utf8')
    chmodSync(path, 0)

    const result = spreadsheet(cwd, ['docs/cerrado.csv'])

    expect(result.ok).toBe(true)
    expect(result.content).toContain('docs/cerrado.csv')
    expect(result.content).toMatch(/\(could not read: /)
    chmodSync(path, 0o644)
  })
})
