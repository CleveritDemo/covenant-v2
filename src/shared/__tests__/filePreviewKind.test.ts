import { describe, expect, it } from 'vitest'
import {
  filePreviewKindForPath,
  previewHasSource,
  previewNeedsBytes,
} from '../filePreviewKind'

describe('filePreviewKindForPath', () => {
  it.each([
    ['notas.md', 'markdown'],
    ['LEEME.markdown', 'markdown'],
    ['doc.mdx', 'markdown'],
    ['page.html', 'html'],
    ['page.htm', 'html'],
    ['logo.svg', 'svg'],
    ['foto.png', 'image'],
    ['foto.JPG', 'image'],
    ['anim.gif', 'image'],
    ['moderna.webp', 'image'],
    ['datos.csv', 'csv'],
    ['datos.tsv', 'csv'],
    ['libro.xlsx', 'xlsx'],
    ['viejo.xls', 'xlsx'],
    ['macro.xlsm', 'xlsx'],
    ['abierto.ods', 'xlsx'],
    ['contrato.docx', 'docx'],
    ['manual.pdf', 'pdf'],
  ] as const)('%s → %s', (path, kind) => {
    expect(filePreviewKindForPath(path)).toBe(kind)
  })

  it('la extensión se compara sin distinguir mayúsculas', () => {
    expect(filePreviewKindForPath('INFORME.PDF')).toBe('pdf')
  })

  it('usa la última extensión', () => {
    expect(filePreviewKindForPath('backup.csv.pdf')).toBe('pdf')
  })

  it('mira solo el nombre, no las carpetas', () => {
    expect(filePreviewKindForPath('/repo/docs.pdf/README.md')).toBe('markdown')
  })

  it('sin visor para código y texto plano', () => {
    for (const path of ['main.rs', 'index.ts', 'notas.txt', 'config.json']) {
      expect(filePreviewKindForPath(path)).toBeNull()
    }
  })

  it('un dotfile sin extensión no tiene visor', () => {
    // El punto está en la posición 0: es un archivo oculto, no una extensión.
    expect(filePreviewKindForPath('.gitignore')).toBeNull()
    expect(filePreviewKindForPath('.env')).toBeNull()
  })

  it('un archivo sin punto no tiene visor', () => {
    expect(filePreviewKindForPath('Makefile')).toBeNull()
  })
})

describe('capacidades del visor', () => {
  it('los formatos binarios piden bytes y no tienen fuente editable', () => {
    for (const kind of ['image', 'xlsx', 'docx', 'pdf'] as const) {
      expect(previewNeedsBytes(kind)).toBe(true)
      expect(previewHasSource(kind)).toBe(false)
    }
  })

  it('los formatos de texto se siguen pudiendo editar como fuente', () => {
    for (const kind of ['markdown', 'svg', 'html', 'csv'] as const) {
      expect(previewNeedsBytes(kind)).toBe(false)
      expect(previewHasSource(kind)).toBe(true)
    }
  })
})
