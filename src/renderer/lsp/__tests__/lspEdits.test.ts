import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  applyTextEdits,
  applyWorkspaceEdit,
  countFiles,
  editsByUri,
  type LspEdit,
  type WorkspaceEdit,
} from '../edits'

const edit = (line: number, from: number, to: number, newText: string): LspEdit => ({
  range: { start: { line, character: from }, end: { line, character: to } },
  newText,
})

describe('applyTextEdits', () => {
  it('aplica un solo edit', () => {
    expect(applyTextEdits('const foo = 1', [edit(0, 6, 9, 'bar')])).toBe('const bar = 1')
  })

  it('aplica varios edits de la misma línea sin corrimientos', () => {
    // Los dos rangos están en coordenadas del texto ORIGINAL: aplicarlos de
    // izquierda a derecha corrompería el segundo. El orden descendente lo evita.
    const out = applyTextEdits('foo + foo', [edit(0, 0, 3, 'barbaz'), edit(0, 6, 9, 'barbaz')])
    expect(out).toBe('barbaz + barbaz')
  })

  it('aplica edits en varias líneas', () => {
    const text = 'let foo = 1\nlet bar = foo\n'
    const out = applyTextEdits(text, [edit(0, 4, 7, 'renamed'), edit(1, 10, 13, 'renamed')])
    expect(out).toBe('let renamed = 1\nlet bar = renamed\n')
  })

  it('sin edits devuelve el texto tal cual', () => {
    expect(applyTextEdits('sin cambios', [])).toBe('sin cambios')
  })

  it('un carácter más allá del fin de línea se acota a esa línea', () => {
    expect(applyTextEdits('ab\ncd', [edit(0, 2, 99, 'X')])).toBe('abX\ncd')
  })
})

describe('editsByUri / countFiles', () => {
  it('lee la forma `changes`', () => {
    const we: WorkspaceEdit = { changes: { 'file:///a.rs': [edit(0, 0, 1, 'x')] } }
    expect(Object.keys(editsByUri(we))).toEqual(['file:///a.rs'])
    expect(countFiles(we)).toBe(1)
  })

  it('aplana `documentChanges` acumulando por uri', () => {
    const we: WorkspaceEdit = {
      documentChanges: [
        { textDocument: { uri: 'file:///a.rs' }, edits: [edit(0, 0, 1, 'x')] },
        { textDocument: { uri: 'file:///a.rs' }, edits: [edit(1, 0, 1, 'y')] },
        { textDocument: { uri: 'file:///b.rs' }, edits: [edit(0, 0, 1, 'z')] },
      ],
    }
    expect(editsByUri(we)['file:///a.rs']).toHaveLength(2)
    expect(countFiles(we)).toBe(2)
  })

  it('no cuenta uris con lista de edits vacía', () => {
    expect(countFiles({ changes: { 'file:///a.rs': [], 'file:///b.rs': [edit(0, 0, 1, 'x')] } })).toBe(1)
  })
})

describe('applyWorkspaceEdit', () => {
  const api = {
    lspReadFile: vi.fn(),
    lspWriteFile: vi.fn(),
  }
  // @ts-expect-error window.api es el bridge del preload; el test sólo necesita
  // los dos métodos de archivo.
  globalThis.window = { api }

  afterEach(() => {
    api.lspReadFile.mockReset()
    api.lspWriteFile.mockReset()
  })

  const host = (activeUri: string | null, applied: LspEdit[][]) => ({
    serverId: 7,
    activeUri: () => activeUri,
    applyToActiveView: (edits: LspEdit[]) => { applied.push(edits) },
  })

  it('manda el archivo activo a la vista y el resto a disco', async () => {
    api.lspReadFile.mockResolvedValue({ ok: true, content: 'let foo = 1\n' })
    api.lspWriteFile.mockResolvedValue({ ok: true })
    const applied: LspEdit[][] = []

    const result = await applyWorkspaceEdit({
      changes: {
        'file:///active.rs': [edit(0, 4, 7, 'bar')],
        'file:///other.rs': [edit(0, 4, 7, 'bar')],
      },
    }, host('file:///active.rs', applied))

    expect(result).toEqual({ files: 2, edits: 2 })
    expect(applied).toHaveLength(1)
    expect(api.lspWriteFile).toHaveBeenCalledWith(7, '/other.rs', 'let bar = 1\n')
    // El archivo activo NO se toca en disco: es el buffer vivo quien manda.
    expect(api.lspWriteFile).toHaveBeenCalledTimes(1)
  })

  it('un fallo de lectura aborta antes de tocar el buffer vivo', async () => {
    api.lspReadFile.mockResolvedValue({ ok: false, error: 'fuera del workspace' })
    const applied: LspEdit[][] = []

    await expect(applyWorkspaceEdit({
      changes: {
        'file:///active.rs': [edit(0, 4, 7, 'bar')],
        'file:///other.rs': [edit(0, 4, 7, 'bar')],
      },
    }, host('file:///active.rs', applied))).rejects.toThrow(/fuera del workspace/)

    expect(applied).toEqual([])
    expect(api.lspWriteFile).not.toHaveBeenCalled()
  })

  it('un fallo de escritura se propaga en vez de perderse en silencio', async () => {
    api.lspReadFile.mockResolvedValue({ ok: true, content: 'x' })
    api.lspWriteFile.mockResolvedValue({ ok: false, error: 'EACCES' })

    await expect(applyWorkspaceEdit(
      { changes: { 'file:///other.rs': [edit(0, 0, 1, 'y')] } },
      host(null, []),
    )).rejects.toThrow(/EACCES/)
  })
})
