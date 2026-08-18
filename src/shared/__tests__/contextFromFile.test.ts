import { describe, expect, it } from 'vitest'
import {
  isSingleFileDraft,
  planContextsFromFiles,
  singleFileContextName,
} from '../contextFromFile'
import type { TabContext } from '../tabContext'

const filesContext = (
  overrides: Partial<TabContext> & Pick<TabContext, 'id' | 'name'>,
): TabContext => ({
  fileName: 'context/App.tsx.md',
  kind: 'files',
  paths: ['src/App.tsx'],
  ...overrides,
})

describe('singleFileContextName', () => {
  it('devuelve el último segmento tras normalizar barras', () => {
    expect(singleFileContextName('src/renderer/App.tsx')).toBe('App.tsx')
    expect(singleFileContextName('src\\renderer\\App.tsx')).toBe('App.tsx')
  })
})

describe('isSingleFileDraft', () => {
  const draft = {
    kind: 'files' as const,
    paths: ['src/App.tsx'],
    rootPath: '',
    referenceOnly: true as const,
  }

  it('es true solo con files, referencia viva, raíz vacía y una ruta', () => {
    expect(isSingleFileDraft(draft)).toBe(true)
    expect(isSingleFileDraft({ ...draft, rootPath: undefined })).toBe(true)
    expect(isSingleFileDraft({ ...draft, paths: ['src/App.tsx', '  '] })).toBe(true)
  })

  it('es false si falta cualquiera de las cuatro condiciones', () => {
    expect(isSingleFileDraft({ ...draft, kind: 'spreadsheet' })).toBe(false)
    expect(isSingleFileDraft({ ...draft, referenceOnly: false })).toBe(false)
    expect(isSingleFileDraft({ ...draft, referenceOnly: undefined })).toBe(false)
    expect(isSingleFileDraft({ ...draft, rootPath: 'src' })).toBe(false)
    expect(isSingleFileDraft({ ...draft, paths: [] })).toBe(false)
    expect(isSingleFileDraft({ ...draft, paths: ['src/A.tsx', 'src/B.tsx'] })).toBe(false)
    expect(isSingleFileDraft({ ...draft, paths: ['  '] })).toBe(false)
  })
})

describe('planContextsFromFiles', () => {
  it('crea un contexto files por archivo con referencia viva', () => {
    const plan = planContextsFromFiles(['src/App.tsx'], [])
    expect(plan.skipped).toEqual([])
    expect(plan.created).toHaveLength(1)
    expect(plan.created[0]).toMatchObject({
      kind: 'files',
      name: 'App.tsx',
      paths: ['src/App.tsx'],
      referenceOnly: true,
    })
  })

  it('nombra distinto dos archivos con el mismo basename en carpetas distintas', () => {
    const plan = planContextsFromFiles(
      ['src/App.tsx', 'electron/App.tsx'],
      [],
    )
    expect(plan.created).toHaveLength(2)
    expect(plan.created[0]?.name).toBe('App.tsx')
    expect(plan.created[1]?.name).toBe('electron/App.tsx')
  })

  it('omite un archivo que ya tiene contexto files de una sola ruta', () => {
    const existing = [filesContext({
      id: 'iaterminal:files:App-tsx',
      name: 'App.tsx',
      paths: ['src/App.tsx'],
    })]
    const plan = planContextsFromFiles(['src/App.tsx'], existing)
    expect(plan.created).toEqual([])
    expect(plan.skipped).toEqual([{ path: 'src/App.tsx', contextId: existing[0].id }])
  })

  it('devuelve un plan vacío cuando no hay rutas válidas', () => {
    expect(planContextsFromFiles(['', '   '], [])).toEqual({ created: [], skipped: [] })
  })

  it('normaliza rutas con barras invertidas', () => {
    const plan = planContextsFromFiles(['src\\App.tsx'], [])
    expect(plan.created[0]?.paths).toEqual(['src/App.tsx'])
  })

  it('escala el nombre cuando colisiona con un contexto existente', () => {
    const existing = [filesContext({
      id: 'iaterminal:files:App-tsx',
      name: 'App.tsx',
      paths: ['other/App.tsx'],
    })]
    const plan = planContextsFromFiles(['src/App.tsx'], existing)
    expect(plan.created).toHaveLength(1)
    expect(plan.created[0]?.name).toBe('src/App.tsx')
  })
})
