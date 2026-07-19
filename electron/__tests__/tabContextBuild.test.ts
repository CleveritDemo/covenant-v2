import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  buildAssignedContexts,
  buildContextCatalogPrompt,
  buildContextSectionCatalog,
  buildRequestedContextSections,
  deleteTabContext,
  discoverTabContexts,
  extractContextSectionRequest,
  materializeTabContext,
  mergeAnnotations,
  parseAnnotations,
  reconcileNotesWithAuto,
} from '../tabContextBuild'
import { appendAiChangelog } from '../aiChangelog'
import { normalizeAnnotation } from '../../src/shared/tabContext'

describe('tab context builders', () => {
  const dirs: string[] = []
  const tempCwd = (): string => {
    const dir = mkdtempSync(join(tmpdir(), 'ia-terminal-context-'))
    dirs.push(dir)
    return dir
  }
  afterEach(() => dirs.splice(0).forEach(dir => rmSync(dir, { recursive: true, force: true })))

  it('materializes layered notes and preserves them on refresh', () => {
    const cwd = tempCwd()
    const context = {
      id: 'notes',
      name: 'Decisiones',
      fileName: 'decisiones.md',
      kind: 'notes' as const,
    }
    const first = materializeTabContext(context, cwd, {
      content: '- `note:ipc` — Usar IPC tipado',
      write: true,
    })
    expect(first.ok).toBe(true)
    expect(first.content).toContain('<!-- iaterminal:notes -->')
    expect(first.content).toContain('Usar IPC tipado')

    const refreshed = materializeTabContext(context, cwd, { write: true })
    expect(refreshed.ok).toBe(true)
    expect(refreshed.notesContent).toContain('Usar IPC tipado')
    expect(readFileSync(join(cwd, '.iaterminal', 'decisiones.md'), 'utf8'))
      .toContain('Usar IPC tipado')
  })

  it('auto-discovers contexts preserving their registered names and configuration', () => {
    const cwd = tempCwd()
    const context = {
      id: 'arquitectura-id',
      name: 'Arquitectura y Decisiones — Núcleo',
      fileName: 'arquitectura.md',
      kind: 'symbols' as const,
      rootPath: 'src',
      paths: ['App.tsx'],
      symbolKinds: ['class', 'method'] as const,
    }
    materializeTabContext(context, cwd, { write: true })

    const result = discoverTabContexts(cwd)

    expect(result.ok).toBe(true)
    expect(result.contexts).toEqual([context])
    expect(readFileSync(join(cwd, '.iaterminal', 'arquitectura.md'), 'utf8'))
      .toContain('<!-- iaterminal:context ')
  })

  it('uses the H1 name for legacy Markdown without metadata', () => {
    const cwd = tempCwd()
    mkdirSync(join(cwd, '.iaterminal'), { recursive: true })
    writeFileSync(
      join(cwd, '.iaterminal', 'nombre-normalizado.md'),
      '# Nombre Original con Ñ y espacios\n\nNotas durables.',
      'utf8',
    )

    const result = discoverTabContexts(cwd)

    expect(result.ok).toBe(true)
    expect(result.contexts[0]).toMatchObject({
      name: 'Nombre Original con Ñ y espacios',
      fileName: 'nombre-normalizado.md',
      kind: 'notes',
    })
  })

  it('discovers the AI changelog as a reserved read-only context', () => {
    const cwd = tempCwd()
    mkdirSync(join(cwd, '.iaterminal'), { recursive: true })
    writeFileSync(join(cwd, '.iaterminal', 'changelog.md'), '# AI Changelog\n\n- Cambio', 'utf8')

    const context = discoverTabContexts(cwd).contexts.find(item => item.kind === 'changelog')!
    expect(context).toEqual({
      id: 'iaterminal:changelog',
      name: 'AI Changelog',
      fileName: 'changelog.md',
      kind: 'changelog',
    })
    expect(materializeTabContext(context, cwd, { write: true }).content)
      .toContain('# AI Changelog')
    expect(deleteTabContext(context, cwd).ok).toBe(true)
    expect(existsSync(join(cwd, '.iaterminal', 'changelog.md'))).toBe(false)
  })

  it('creates the changelog only when its context is explicitly saved', () => {
    const cwd = tempCwd()
    const context = {
      id: 'iaterminal:changelog',
      name: 'Historial del equipo',
      fileName: 'historial-ia.md',
      kind: 'changelog' as const,
    }

    materializeTabContext(context, cwd)
    expect(existsSync(join(cwd, '.iaterminal', 'historial-ia.md'))).toBe(false)

    const created = materializeTabContext(context, cwd, { write: true })
    expect(created.ok).toBe(true)
    expect(existsSync(join(cwd, '.iaterminal', 'historial-ia.md'))).toBe(true)
    expect(created.content).toContain('# Historial del equipo')
    expect(created.content).toContain('iaterminal:context')
    expect(discoverTabContexts(cwd).contexts).toEqual([context])
  })

  it('renames a changelog without losing entries and runtime follows metadata', () => {
    const cwd = tempCwd()
    const original = {
      id: 'iaterminal:changelog',
      name: 'Historial inicial',
      fileName: 'historial-inicial.md',
      kind: 'changelog' as const,
    }
    materializeTabContext(original, cwd, { write: true })
    appendAiChangelog(cwd, [
      { path: 'src/first.ts', description: 'Primer cambio registrado' },
    ], '2026-01-01T00:00:00.000Z')

    const renamed = {
      ...original,
      name: 'Historial compartido',
      fileName: 'historial-compartido.md',
    }
    materializeTabContext(renamed, cwd, { write: true })
    appendAiChangelog(cwd, [
      { path: 'src/second.ts', description: 'Segundo cambio registrado' },
    ], '2026-01-02T00:00:00.000Z')

    expect(existsSync(join(cwd, '.iaterminal', 'historial-inicial.md'))).toBe(false)
    const raw = readFileSync(join(cwd, '.iaterminal', 'historial-compartido.md'), 'utf8')
    expect(raw).toContain('# Historial compartido')
    expect(raw).toContain('Primer cambio registrado')
    expect(raw).toContain('Segundo cambio registrado')
    expect(discoverTabContexts(cwd).contexts).toEqual([renamed])
  })

  it('deletes a materialized context file from .iaterminal', () => {
    const cwd = tempCwd()
    const context = {
      id: 'to-delete',
      name: 'Temporal',
      fileName: 'temporal.md',
      kind: 'notes' as const,
    }
    materializeTabContext(context, cwd, { content: 'bye', write: true })
    expect(existsSync(join(cwd, '.iaterminal', 'temporal.md'))).toBe(true)

    const deleted = deleteTabContext(context, cwd)

    expect(deleted.ok).toBe(true)
    expect(existsSync(join(cwd, '.iaterminal', 'temporal.md'))).toBe(false)
    expect(discoverTabContexts(cwd).contexts).toEqual([])
  })

  it('preserves annotations when rematerializing symbols', () => {
    const cwd = tempCwd()
    mkdirSync(join(cwd, 'src'), { recursive: true })
    writeFileSync(join(cwd, 'src', 'App.tsx'), `
export class App {
  handleAddTab(title: string, activate?: boolean): Promise<string> {
    return Promise.resolve(title)
  }
}
`, 'utf8')
    const context = {
      id: 'symbols',
      name: 'Símbolos',
      fileName: 'symbols.md',
      kind: 'symbols' as const,
      paths: ['src/App.tsx'],
      symbolKinds: ['class', 'method'] as const,
    }
    materializeTabContext(context, cwd, { write: true })
    mergeAnnotations(context, cwd, [
      { key: 'src/App.tsx#class:App', text: 'Orquesta tabs y paneles' },
      { key: 'src/App.tsx#method:App.handleAddTab', text: 'Crea pestaña nueva' },
    ])

    writeFileSync(join(cwd, 'src', 'App.tsx'), `
export class App {
  handleAddTab(title: string): string {
    return title
  }
}
`, 'utf8')
    const refreshed = materializeTabContext(context, cwd, { write: true })
    expect(refreshed.ok).toBe(true)
    expect(refreshed.content).toContain('<!-- iaterminal:auto -->')
    expect(refreshed.content).toContain('signature:')
    expect(refreshed.content).toContain('Orquesta tabs y paneles')
    expect(refreshed.content).toContain('Crea pestaña nueva')
  })

  it('preserves markers and annotations when generated symbols exceed the limit', () => {
    const cwd = tempCwd()
    mkdirSync(join(cwd, 'src'), { recursive: true })
    const paths: string[] = []
    for (let fileIndex = 0; fileIndex < 12; fileIndex += 1) {
      const relativePath = `src/generated-${fileIndex}.ts`
      paths.push(relativePath)
      const declarations = Array.from(
        { length: 100 },
        (_, variableIndex) => `export const value_${fileIndex}_${variableIndex} = ${variableIndex}`,
      ).join('\n')
      writeFileSync(join(cwd, relativePath), declarations, 'utf8')
    }
    const context = {
      id: 'large-symbols',
      name: 'Símbolos grandes',
      fileName: 'large-symbols.md',
      kind: 'symbols' as const,
      paths,
      symbolKinds: ['variable'] as const,
    }

    materializeTabContext(context, cwd, { write: true })
    mergeAnnotations(context, cwd, [
      { key: 'src/generated-0.ts#variable:value_0_0', text: 'Valor inicial generado' },
    ])
    const refreshed = materializeTabContext(context, cwd, { write: true })

    expect(refreshed.content.length).toBeLessThanOrEqual(45_000)
    expect(refreshed.content).toContain('<!-- /iaterminal:auto -->')
    expect(refreshed.content).toContain('<!-- iaterminal:notes -->')
    expect(refreshed.content).toContain('Valor inicial generado')
    expect(refreshed.content).toContain('<!-- /iaterminal:notes -->')
  })

  it('removes a legacy notes layer only when it exactly duplicates auto', () => {
    const cwd = tempCwd()
    writeFileSync(join(cwd, 'unique.txt'), 'content', 'utf8')
    const context = {
      id: 'tree',
      name: 'Árbol',
      fileName: 'tree.md',
      kind: 'folderTree' as const,
    }
    const initial = materializeTabContext(context, cwd, { write: true })
    const auto = initial.content.match(
      /<!-- iaterminal:auto -->([\s\S]*?)<!-- \/iaterminal:auto -->/,
    )?.[1].trim() ?? ''
    const duplicated = initial.content.replace('(no annotations yet)', auto)
    writeFileSync(join(cwd, '.iaterminal', 'tree.md'), duplicated, 'utf8')

    const refreshed = materializeTabContext(context, cwd, { write: true })

    expect(refreshed.notesContent).toBe('')
    expect(refreshed.content.match(/unique\.txt/g)).toHaveLength(1)
    expect(refreshed.content).toContain('(no annotations yet)')
  })

  it('scans the root folder for symbols when no paths are listed', () => {
    const cwd = tempCwd()
    mkdirSync(join(cwd, 'src'), { recursive: true })
    writeFileSync(join(cwd, 'src', 'Widget.tsx'), `
export class Widget {
  render(): string { return 'ok' }
}
`, 'utf8')
    const context = {
      id: 'symbols-scan',
      name: 'Símbolos',
      fileName: 'symbols-scan.md',
      kind: 'symbols' as const,
      rootPath: 'src',
    }

    const result = materializeTabContext(context, cwd, { write: true })

    expect(result.ok).toBe(true)
    expect(result.content).toContain('src/Widget.tsx#class:Widget')
    expect(result.content).toContain('src/Widget.tsx#method:Widget.render')
  })

  it('merges annotations by key and truncates to 10 words', () => {
    const cwd = tempCwd()
    const context = {
      id: 'tree',
      name: 'Árbol',
      fileName: 'arbol.md',
      kind: 'folderTree' as const,
    }
    materializeTabContext(context, cwd, { write: true })
    mergeAnnotations(context, cwd, [
      { key: 'path:src', text: 'Código fuente principal' },
    ])
    const merged = mergeAnnotations(context, cwd, [
      {
        key: 'path:src',
        text: 'uno dos tres cuatro cinco seis siete ocho nueve diez once doce',
      },
      { key: 'path:electron', text: 'Proceso main de Electron' },
    ])
    expect(merged.ok).toBe(true)
    const notes = merged.notesContent ?? ''
    expect(notes).toContain('path:src')
    expect(notes).toContain('uno dos tres cuatro cinco seis siete ocho nueve diez')
    expect(notes).not.toContain('once')
    expect(notes).toContain('path:electron')
    expect(parseAnnotations(notes)).toHaveLength(2)
  })

  it('preserves human notes and the generated auto layer while merging', () => {
    const cwd = tempCwd()
    const context = {
      id: 'notes',
      name: 'Decisiones',
      fileName: 'decisiones.md',
      kind: 'notes' as const,
    }
    const initial = materializeTabContext(context, cwd, {
      content: 'No eliminar esta decisión humana.\n\n- `note:old` — Nota anterior',
      write: true,
    })
    const autoBefore = initial.content.match(
      /<!-- iaterminal:auto -->([\s\S]*?)<!-- \/iaterminal:auto -->/,
    )?.[1]

    const merged = mergeAnnotations(context, cwd, [
      { key: 'note:new', text: 'Cambio observado en esta interacción' },
    ])
    const autoAfter = merged.content.match(
      /<!-- iaterminal:auto -->([\s\S]*?)<!-- \/iaterminal:auto -->/,
    )?.[1]

    expect(merged.notesContent).toContain('No eliminar esta decisión humana.')
    expect(merged.notesContent).toContain('Nota anterior')
    expect(merged.notesContent).toContain('Cambio observado en esta interacción')
    expect(autoAfter).toBe(autoBefore)
  })

  it('moves missing symbol annotations to Orphaned', () => {
    const notes = reconcileNotesWithAuto(
      '- `src/App.tsx#class:App` — class `App`',
      [
        '- `src/App.tsx#class:App` — Orquesta tabs',
        '- `src/App.tsx#class:Gone` — Ya no existe',
      ].join('\n'),
    )
    expect(notes).toContain('Orquesta tabs')
    expect(notes).toContain('## Orphaned')
    expect(notes).toContain('src/App.tsx#class:Gone')
  })

  it('rejects annotations longer than 10 words at normalize time', () => {
    expect(normalizeAnnotation({
      key: 'x',
      text: 'uno dos tres cuatro cinco seis siete ocho nueve diez once',
    })).toEqual({
      key: 'x',
      text: 'uno dos tres cuatro cinco seis siete ocho nueve diez',
    })
  })

  it('adds write-back instructions only when auto improvement is enabled', () => {
    const cwd = tempCwd()
    const contexts = [
      { id: 'tree', name: 'Árbol', fileName: 'arbol.md', kind: 'folderTree' },
      { id: 'notes', name: 'Decisiones', fileName: 'decisiones.md', kind: 'notes' },
    ] as const
    const readOnlyPrompt = buildAssignedContexts([...contexts], cwd)
    const prompt = buildAssignedContexts([...contexts], cwd, {
      allowAnnotationUpdates: true,
    })
    expect(readOnlyPrompt).not.toContain('## Context maintenance')
    expect(readOnlyPrompt).not.toContain('```ia-terminal-context')
    expect(prompt).toContain('## Assigned tab contexts (authoritative)')
    expect(prompt).toContain('## Context maintenance')
    expect(prompt).toContain('```ia-terminal-context')
    expect(prompt).toContain('annotations')
    expect(prompt).toContain('must never be deleted')
    expect(prompt).toContain('owned exclusively by deterministic host generation')
    expect(readFileSync(join(cwd, '.iaterminal', 'arbol.md'), 'utf8')).toContain('iaterminal:auto')
  })

  it('builds a lightweight section catalog without embedding file contents', () => {
    const cwd = tempCwd()
    mkdirSync(join(cwd, 'src'), { recursive: true })
    writeFileSync(join(cwd, 'src', 'one.ts'), 'export const secretOne = 1', 'utf8')
    writeFileSync(join(cwd, 'src', 'two.ts'), 'export const secretTwo = 2', 'utf8')
    const context = {
      id: 'selected-files',
      name: 'Selected files',
      fileName: 'selected-files.md',
      kind: 'files' as const,
      paths: ['src/one.ts', 'src/two.ts'],
    }

    const catalog = buildContextSectionCatalog([context], cwd)
    const prompt = buildContextCatalogPrompt([context], cwd)

    expect(catalog[0].sections.map(section => section.key))
      .toEqual(['src/one.ts', 'src/two.ts'])
    expect(prompt).toContain('ia-terminal-need-sections')
    expect(prompt).toContain('"src/one.ts"')
    expect(prompt).not.toContain('secretOne')
    expect(prompt).not.toContain('secretTwo')
  })

  it('extracts requested section fences and sends only selected content', () => {
    const cwd = tempCwd()
    mkdirSync(join(cwd, 'src'), { recursive: true })
    writeFileSync(join(cwd, 'src', 'one.ts'), 'export const included = 1', 'utf8')
    writeFileSync(join(cwd, 'src', 'two.ts'), 'export const excluded = 2', 'utf8')
    const context = {
      id: 'selected-files',
      name: 'Selected files',
      fileName: 'selected-files.md',
      kind: 'files' as const,
      paths: ['src/one.ts', 'src/two.ts'],
    }
    const extracted = extractContextSectionRequest([
      '```ia-terminal-need-sections',
      '{"requests":[{"id":"selected-files","sections":["src/one.ts"]}]}',
      '```',
    ].join('\n'))
    const payload = buildRequestedContextSections([context], cwd, extracted.requests)

    expect(extracted.visibleText).toBe('')
    expect(extracted.requests).toEqual([
      { id: 'selected-files', sections: ['src/one.ts'] },
    ])
    expect(payload.sectionCount).toBe(1)
    expect(payload.prompt).toContain('included')
    expect(payload.prompt).not.toContain('excluded')
    expect(payload.prompt).toContain('section-key: src/one.ts')
  })

  it('reports unknown context sections without exposing other sections', () => {
    const cwd = tempCwd()
    const context = {
      id: 'dependencies',
      name: 'Dependencies',
      fileName: 'dependencies.md',
      kind: 'deps' as const,
    }
    writeFileSync(join(cwd, 'package.json'), JSON.stringify({
      scripts: { test: 'vitest' },
      dependencies: { react: '18' },
    }), 'utf8')

    const payload = buildRequestedContextSections([context], cwd, [
      { id: 'dependencies', sections: ['missing'] },
    ])

    expect(payload.sectionCount).toBe(0)
    expect(payload.prompt).toContain('Unknown section "missing"')
    expect(payload.prompt).not.toContain('"react"')
  })
})
