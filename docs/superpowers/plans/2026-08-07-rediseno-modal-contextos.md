# Rediseño del modal de contextos — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el modal de contextos responda «¿qué le va a llegar al agente y cuánto pesa?» antes de guardar, en lugar de esconderlo tras un botón *Preview*.

**Architecture:** El seccionado —hoy privado en `electron/tabContextBuild.ts`— se mueve a `src/shared/contextSections.ts` para que el renderer calcule el mismo presupuesto que el pipeline real, sin duplicar heurísticas ni añadir IPC. Encima se apoya `src/shared/contextBudget.ts`, una función pura que traduce secciones a un resumen presentable. El modal pasa a dos paneles: configuración a la izquierda, presupuesto y vista previa permanente a la derecha.

**Tech Stack:** TypeScript, React 18, vitest (entorno `node` para lógica pura), i18next (`en` + `es`), CSS colocado con clases BEM.

**Spec:** `docs/superpowers/specs/2026-08-07-rediseno-modal-contextos-design.md`

## Global Constraints

- Los comentarios y la documentación se escriben **en español**; el código, en inglés.
- Los marcadores en disco (`<!-- iaterminal:auto -->`, `<!-- iaterminal:notes -->`, `<!-- iaterminal:context {json} -->`) **no se renombran** aunque la carpeta ya sea `.gravity`: viven dentro de los Markdown de los usuarios (ver `CLAUDE.md`).
- La lógica de decisión va en `src/shared/` como función pura; React es un driver fino. Un archivo de `src/renderer/` **no puede importar de `electron/`** — falla el typecheck de `tsconfig.web.json`.
- Los componentes del UI kit (`src/renderer/components/ui/**`) no aceptan `className` ni `style`. `npm run check:ui` falla si se les pasa. Las clases BEM internas de una feature (`tab-contexts__…`) sí están permitidas.
- Toda cadena visible pasa por i18n y **se añade a los dos locales** (`src/i18n/locales/en.ts` y `es.ts`) en el mismo commit.
- `npx tsc -b` arrastra ~36 errores previos en 11 archivos: **no es una puerta de paso/fallo**. Compara el número antes y después, no esperes cero.
- La suite completa es `npm test` (68 archivos, ~466 tests, ~5 s). Debe seguir verde después de cada tarea.
- El CSS de contextos vive en `src/renderer/agent/AgentPane.css` (reglas `.tab-contexts__*` entre las líneas ~1413 y ~1900). No se crea un archivo CSS nuevo salvo donde el plan lo diga.

## Estructura de archivos

| Archivo | Responsabilidad | Tarea |
|---|---|---|
| `src/shared/contextSections.ts` | **Nuevo.** Partir el `.md` materializado en secciones con clave y tamaño. Movido tal cual desde `electron/tabContextBuild.ts`. | 1 |
| `src/shared/contextBudget.ts` | **Nuevo.** De secciones a `{sections, chars, estimatedTokens, delivery, level, ratio}`. | 2 |
| `electron/tabContextBuild.ts` | Importa el seccionado desde `@shared` en vez de definirlo. | 1 |
| `src/renderer/agent/TabContextsEditor.tsx` | Reestructurado en dos paneles. | 3–6 |
| `src/renderer/agent/TabContextBudgetMeter.tsx` + `.css` | **Nuevo.** El medidor. Componente de feature, no del UI kit. | 4 |
| `src/renderer/agent/TabContextFormModal.tsx` | Debounce de la vista previa, pie de dos acciones, dismiss sin guardado silencioso. | 3, 7 |
| `src/renderer/agent/AgentPane.css` | Rejilla de dos columnas, chips agrupados, aspecto plegable. | 3, 5, 6 |
| `src/shared/ipcChannels.ts`, `electron/main.ts`, `electron/preload.ts` | Canal para revelar el `.md` en el Finder. | 8 |
| `src/i18n/locales/{en,es}.ts` | Cadenas nuevas, en cada tarea que las necesite. | 3–8 |

## Desviaciones respecto al spec

Dos, ambas para hacer menos código. Si el revisor prefiere lo que decía el spec, se revierten sin tocar el resto del plan.

1. **El spec pide un popover para «Aspecto»; este plan usa un `<details>` nativo.** Un popover dentro de un modal necesita posicionamiento, cierre al hacer clic fuera y trampa de foco, y pelea con el `overflow` del panel. `<details>`/`<summary>` da plegado, teclado y accesibilidad sin componente nuevo ni riesgo en `npm run check:ui`. Ahorra ~70 líneas y un componente del UI kit (tarea 6).
2. **Los chips se agrupan en dos grupos, no tres.** El diseño original dibujaba «Del repositorio / Escrito a mano / Fuente externa», pero hoy no existe ningún tipo de contexto externo. Se implementan los dos grupos que corresponden a los ocho tipos reales; si algún día se añade un tipo de otra procedencia, será una entrada más en el array de la tarea 5.

---

### Task 1: Mover el seccionado a `src/shared/`

El renderer necesita las mismas secciones que ve el pipeline. Contarlas aparte con una heurística propia daría números que no coinciden con la realidad para `folderTree`, `deps` y `git`, que usan partidores dedicados. Se mueve el código, no se reescribe.

**Files:**
- Create: `src/shared/contextSections.ts`
- Create: `src/shared/__tests__/contextSections.test.ts`
- Modify: `electron/tabContextBuild.ts` (borrar lo movido, importar desde `@shared`)

**Interfaces:**
- Consumes: `TabContext`, `TabContextKind`, `TabContextPreviewResult` de `@shared/tabContext`.
- Produces:
  - `const AUTO_START = '<!-- iaterminal:auto -->'`, `AUTO_END`, `NOTES_START`, `NOTES_END`
  - `const NOTES_SECTION_KEY = '__notes'`
  - `const MAX_REQUESTED_CONTEXT_CHARS = 60_000`
  - `interface ContextSectionDescriptor { key: string; label: string; chars: number }`
  - `interface ContextSection extends ContextSectionDescriptor { content: string }`
  - `function extractSection(text: string, start: string, end: string): string`
  - `function sectionsForContext(context: Pick<TabContext, 'kind'>, materialized: TabContextPreviewResult): ContextSection[]`

- [ ] **Step 1: Escribe el test de caracterización**

Crea `src/shared/__tests__/contextSections.test.ts`. Fija el comportamiento actual **antes** de mover nada, para que el movimiento sea verificable:

```ts
import { describe, expect, it } from 'vitest'
import { sectionsForContext, AUTO_START, AUTO_END } from '../contextSections'
import type { TabContext } from '../tabContext'

const kindOnly = (kind: TabContext['kind']): Pick<TabContext, 'kind'> => ({ kind })

/** Envuelve un cuerpo en el bloque auto, como lo escribe composeDocument(). */
const auto = (body: string): string => [AUTO_START, body, AUTO_END].join('\n')

const ok = (content: string) => ({ ok: true as const, content })

describe('sectionsForContext', () => {
  it('parte markdown por encabezados ## y ###, ignorando los de dentro de un fence', () => {
    const sections = sectionsForContext(kindOnly('readme'), ok(auto([
      '## Instalación',
      'npm install',
      '```md',
      '## Esto no es un encabezado',
      '```',
      '## Comandos',
      'npm test',
    ].join('\n'))))

    expect(sections.map(s => s.key)).toEqual(['Instalación', 'Comandos'])
    expect(sections[0].content).toContain('## Esto no es un encabezado')
  })

  it('descarta el contenido anterior al primer encabezado', () => {
    const sections = sectionsForContext(kindOnly('readme'), ok(auto([
      'Este preámbulo se pierde.',
      '## Solo esto',
      'cuerpo',
    ].join('\n'))))

    expect(sections).toHaveLength(1)
    expect(sections[0].content).not.toContain('preámbulo')
  })

  it('sin encabezados devuelve una única sección "all"', () => {
    const sections = sectionsForContext(kindOnly('readme'), ok(auto('texto suelto')))
    expect(sections.map(s => s.key)).toEqual(['all'])
  })

  it('folderTree parte por líneas sin sangría', () => {
    const sections = sectionsForContext(kindOnly('folderTree'), ok(auto([
      'electron/  (main y preload)',
      '  main.ts',
      'src/',
      '  renderer/',
    ].join('\n'))))

    expect(sections.map(s => s.key)).toEqual(['electron', 'src'])
    expect(sections[0].label).toBe('electron/  (main y preload)')
  })

  it('deps parte por clave de nivel superior del JSON', () => {
    const sections = sectionsForContext(kindOnly('deps'), ok(auto(
      JSON.stringify({ dependencies: { react: '18' }, scripts: { test: 'vitest' } }),
    )))
    expect(sections.map(s => s.key)).toEqual(['dependencies', 'scripts'])
  })

  it('git separa status de diff stat', () => {
    const sections = sectionsForContext(kindOnly('git'), ok(auto(
      'On branch main\n\nDiff stat:\n 1 file changed',
    )))
    expect(sections.map(s => s.key)).toEqual(['status', 'diff-stat'])
  })

  it('añade la sección de notas cuando el documento las trae', () => {
    const doc = [
      AUTO_START,
      '## Uno',
      'cuerpo',
      AUTO_END,
      '<!-- iaterminal:notes -->',
      '- `src/App.tsx` — punto de entrada',
      '<!-- /iaterminal:notes -->',
    ].join('\n')

    const sections = sectionsForContext(kindOnly('readme'), ok(doc))
    expect(sections.map(s => s.key)).toEqual(['Uno', '__notes'])
  })

  it('notes usa notesContent y no lleva sección de notas', () => {
    const sections = sectionsForContext(
      kindOnly('notes'),
      { ok: true, content: 'ignorado', notesContent: '## Reglas\ncuerpo' },
    )
    expect(sections.map(s => s.key)).toEqual(['Reglas'])
  })

  it('un materializado con error produce una sección "error"', () => {
    const sections = sectionsForContext(
      kindOnly('readme'),
      { ok: false, content: '', error: 'no existe' },
    )
    expect(sections.map(s => s.key)).toEqual(['error'])
    expect(sections[0].content).toContain('no existe')
  })

  it('cada sección reporta chars igual a la longitud de su contenido', () => {
    const sections = sectionsForContext(kindOnly('readme'), ok(auto('## Uno\ncuerpo')))
    expect(sections[0].chars).toBe(sections[0].content.length)
  })
})
```

- [ ] **Step 2: Ejecuta el test y verifica que falla**

Run: `npx vitest run src/shared/__tests__/contextSections.test.ts`
Expected: FAIL — `Failed to resolve import "../contextSections"`.

- [ ] **Step 3: Crea `src/shared/contextSections.ts` moviendo el código**

Mueve **verbatim** desde `electron/tabContextBuild.ts` a `src/shared/contextSections.ts`:

| Qué | Origen |
|---|---|
| `AUTO_START`, `AUTO_END` | líneas 58-59 |
| `NOTES_START`, `NOTES_END` | líneas 60-61 |
| `MAX_REQUESTED_CONTEXT_CHARS` | línea 75 |
| `NOTES_SECTION_KEY` | línea 77 |
| `extractSection` | línea 525 |
| `markdownSections` | línea 1268 |
| `folderTreeSections` | línea 1299 |
| `dependencySections` | línea 1316 |
| `gitSections` | línea ~1328 |
| `sectionsForContext` | línea 1341 |

Cambios al pegarlo, y ninguno más:

1. **Todo se exporta** (`export const`, `export function`).
2. `MaterializedContextSection` (definido en `tabContextBuild.ts:1159` como `extends TabContextSectionDescriptor`) se reemplaza por dos interfaces propias del módulo, para que `src/shared/` no dependa de un tipo que vive en `electron/`:

```ts
export interface ContextSectionDescriptor {
  key: string
  label: string
  chars: number
}

export interface ContextSection extends ContextSectionDescriptor {
  content: string
}
```

3. La firma de `sectionsForContext` se relaja de `context: TabContext` a `context: Pick<TabContext, 'kind'>` — solo lee `context.kind`, y así el renderer puede llamarla con un draft parcial.
4. Ningún `import` de `node:*`: estas funciones son de string puro. Si alguno se cuela, no se movió lo correcto.

Encabeza el archivo con:

```ts
/**
 * Partición del `.md` materializado en secciones pedibles.
 *
 * Vive en `src/shared/` porque lo necesitan los dos lados: `electron/` para armar
 * el catálogo del prompt, y el renderer para mostrar el presupuesto en el modal
 * de contextos. Duplicar las heurísticas daría cifras distintas de las reales.
 */
```

- [ ] **Step 4: Ejecuta el test y verifica que pasa**

Run: `npx vitest run src/shared/__tests__/contextSections.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Reconecta `electron/tabContextBuild.ts`**

Borra las definiciones movidas y añade el import:

```ts
import {
  AUTO_START,
  AUTO_END,
  NOTES_START,
  NOTES_END,
  NOTES_SECTION_KEY,
  MAX_REQUESTED_CONTEXT_CHARS,
  extractSection,
  sectionsForContext,
  type ContextSection,
} from '@shared/contextSections'
```

Dos ajustes necesarios:

- `MaterializedContextSection` (línea 1159) queda sin usos propios: sustitúyelo por `ContextSection` en `MaterializedContextData` y borra la interfaz.
- `TabContextSectionDescriptor` (línea 93) se sigue exportando desde `tabContextBuild.ts` porque lo consumen otros módulos; redefínelo como alias: `export type TabContextSectionDescriptor = ContextSectionDescriptor`.

- [ ] **Step 6: Ejecuta la suite completa**

Run: `npm test`
Expected: PASS. Los tests existentes de `electron/__tests__/tabContextBuild.test.ts` son la red de seguridad del movimiento — si alguno falla, el código no se movió verbatim.

- [ ] **Step 7: Verifica que el renderer puede importarlo**

Run: `npx tsc -b 2>&1 | grep -c "error TS"`
Expected: el mismo número que antes de la tarea (~36). Anótalo; si sube, el import cruzó una frontera que no debía.

- [ ] **Step 8: Commit**

```bash
git add src/shared/contextSections.ts src/shared/__tests__/contextSections.test.ts electron/tabContextBuild.ts
git commit -m "Mueve el seccionado de contextos a src/shared/

El renderer necesita las mismas secciones que ve el pipeline para poder
mostrar el presupuesto real en el modal. Contarlas aparte daría cifras
distintas para folderTree, deps y git, que usan partidores dedicados."
```

---

### Task 2: `src/shared/contextBudget.ts`

**Files:**
- Create: `src/shared/contextBudget.ts`
- Create: `src/shared/__tests__/contextBudget.test.ts`

**Interfaces:**
- Consumes: `ContextSectionDescriptor`, `MAX_REQUESTED_CONTEXT_CHARS` de `@shared/contextSections`; `CUSTOM_CONTEXT_KINDS`, `TabContextKind` de `@shared/tabContext`.
- Produces:
  - `type ContextDelivery = 'catalog' | 'whole'`
  - `type BudgetLevel = 'ok' | 'warn' | 'over'`
  - `interface ContextBudgetSummary { sections: number; chars: number; estimatedTokens: number; delivery: ContextDelivery; level: BudgetLevel; ratio: number }`
  - `function deliveryModeFor(kind: TabContextKind): ContextDelivery`
  - `function summarizeContextBudget(sections: readonly ContextSectionDescriptor[], kind: TabContextKind): ContextBudgetSummary`

- [ ] **Step 1: Escribe el test que falla**

Crea `src/shared/__tests__/contextBudget.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { deliveryModeFor, summarizeContextBudget } from '../contextBudget'
import { MAX_REQUESTED_CONTEXT_CHARS } from '../contextSections'
import { HOST_CONTEXT_KINDS } from '../tabContext'

/** Sección sintética del tamaño pedido; solo importa `chars`. */
const section = (chars: number) => ({ key: `k${chars}`, label: 'l', chars })

describe('deliveryModeFor', () => {
  it('notes y agentResult se adjuntan enteros', () => {
    expect(deliveryModeFor('notes')).toBe('whole')
    expect(deliveryModeFor('agentResult')).toBe('whole')
  })

  it('todos los kinds host viajan como catálogo', () => {
    for (const kind of HOST_CONTEXT_KINDS) {
      expect(deliveryModeFor(kind)).toBe('catalog')
    }
  })
})

describe('summarizeContextBudget', () => {
  it('cuenta secciones y suma caracteres', () => {
    const summary = summarizeContextBudget([section(100), section(250)], 'readme')
    expect(summary.sections).toBe(2)
    expect(summary.chars).toBe(350)
  })

  it('estima tokens como chars/4 redondeado hacia arriba', () => {
    expect(summarizeContextBudget([section(401)], 'readme').estimatedTokens).toBe(101)
  })

  it('una lista vacía es un presupuesto en cero, no un NaN', () => {
    const summary = summarizeContextBudget([], 'readme')
    expect(summary).toMatchObject({ sections: 0, chars: 0, estimatedTokens: 0, ratio: 0, level: 'ok' })
  })

  // Fronteras exactas: 55 % y 85 % de MAX_REQUESTED_CONTEXT_CHARS (60.000).
  it.each([
    [Math.floor(MAX_REQUESTED_CONTEXT_CHARS * 0.54), 'ok'],
    [Math.ceil(MAX_REQUESTED_CONTEXT_CHARS * 0.55), 'warn'],
    [Math.floor(MAX_REQUESTED_CONTEXT_CHARS * 0.84), 'warn'],
    [Math.ceil(MAX_REQUESTED_CONTEXT_CHARS * 0.85), 'over'],
  ])('%i caracteres → nivel %s', (chars, level) => {
    expect(summarizeContextBudget([section(chars)], 'readme').level).toBe(level)
  })

  it('satura ratio en 1 cuando se pasa del presupuesto', () => {
    const summary = summarizeContextBudget([section(MAX_REQUESTED_CONTEXT_CHARS * 3)], 'readme')
    expect(summary.ratio).toBe(1)
    expect(summary.level).toBe('over')
  })

  it('arrastra el modo de entrega del kind', () => {
    expect(summarizeContextBudget([section(10)], 'notes').delivery).toBe('whole')
    expect(summarizeContextBudget([section(10)], 'symbols').delivery).toBe('catalog')
  })
})
```

- [ ] **Step 2: Ejecuta el test y verifica que falla**

Run: `npx vitest run src/shared/__tests__/contextBudget.test.ts`
Expected: FAIL — `Failed to resolve import "../contextBudget"`.

- [ ] **Step 3: Implementa el módulo**

Crea `src/shared/contextBudget.ts`:

```ts
import type { TabContextKind } from './tabContext'
import { CUSTOM_CONTEXT_KINDS } from './tabContext'
import type { ContextSectionDescriptor } from './contextSections'
import { MAX_REQUESTED_CONTEXT_CHARS } from './contextSections'

/** Cómo llega el contexto al prompt: catálogo de claves, o cuerpo entero. */
export type ContextDelivery = 'catalog' | 'whole'

export type BudgetLevel = 'ok' | 'warn' | 'over'

export interface ContextBudgetSummary {
  sections: number
  chars: number
  /** Estimación cruda chars/4; la UI la rotula como estimación. */
  estimatedTokens: number
  delivery: ContextDelivery
  level: BudgetLevel
  /** chars / MAX_REQUESTED_CONTEXT_CHARS, saturado a 1. */
  ratio: number
}

const WARN_RATIO = 0.55
const OVER_RATIO = 0.85
/** Regla de dedo estándar; no vale la pena un tokenizer real para un medidor. */
const CHARS_PER_TOKEN = 4

/** Deriva de CUSTOM_CONTEXT_KINDS para no repetir la lista. */
export function deliveryModeFor(kind: TabContextKind): ContextDelivery {
  return (CUSTOM_CONTEXT_KINDS as readonly TabContextKind[]).includes(kind)
    ? 'whole'
    : 'catalog'
}

export function summarizeContextBudget(
  sections: readonly ContextSectionDescriptor[],
  kind: TabContextKind,
): ContextBudgetSummary {
  const chars = sections.reduce((total, section) => total + section.chars, 0)
  const rawRatio = chars / MAX_REQUESTED_CONTEXT_CHARS
  return {
    sections: sections.length,
    chars,
    estimatedTokens: Math.ceil(chars / CHARS_PER_TOKEN),
    delivery: deliveryModeFor(kind),
    level: rawRatio >= OVER_RATIO ? 'over' : rawRatio >= WARN_RATIO ? 'warn' : 'ok',
    ratio: Math.min(1, rawRatio),
  }
}
```

- [ ] **Step 4: Ejecuta el test y verifica que pasa**

Run: `npx vitest run src/shared/__tests__/contextBudget.test.ts`
Expected: PASS, 9 tests (el `it.each` cuenta como 4).

- [ ] **Step 5: Commit**

```bash
git add src/shared/contextBudget.ts src/shared/__tests__/contextBudget.test.ts
git commit -m "Añade contextBudget: de secciones a presupuesto presentable

Función pura para que el medidor del modal no viva dentro del componente.
deliveryModeFor deriva de CUSTOM_CONTEXT_KINDS en vez de repetir la lista."
```

---

### Task 3: Dos paneles y vista previa permanente

Después de esta tarea el modal ya tiene su forma nueva y *Preview* deja de existir como botón. El medidor llega en la tarea 4.

**Files:**
- Modify: `src/renderer/agent/TabContextsEditor.tsx`
- Modify: `src/renderer/agent/TabContextFormModal.tsx`
- Modify: `src/renderer/agent/AgentPane.css`
- Modify: `src/i18n/locales/en.ts`, `src/i18n/locales/es.ts`

**Interfaces:**
- Consumes: `PreviewState` (ya exportado por `TabContextsEditor.tsx:20`).
- Produces: nada nuevo para otras tareas; la clase `.tab-contexts__panes` es el contenedor donde las tareas 4-6 insertan sus piezas.

- [ ] **Step 1: Envuelve el editor en dos paneles**

En `TabContextsEditor.tsx`, el `<section className="tab-contexts__editor">` pasa a ser:

```tsx
<div className="tab-contexts__panes">
  <section className="tab-contexts__editor">
    {/* todo lo que hoy está en el editor, MENOS el bloque de preview
        de las líneas 241-270 */}
  </section>
  <aside className="tab-contexts__output">
    {/* aquí va el medidor en la tarea 4 */}
    <div className="tab-contexts__output-head">
      <span>{t('tabContexts.preview')}</span>
      {preview.status === 'success' && <small>{preview.filePath}</small>}
    </div>
    {preview.status === 'loading' && <p className="tab-contexts__output-msg">{t('tabContexts.loading')}</p>}
    {preview.status === 'idle' && <p className="tab-contexts__output-msg">{t('tabContexts.previewIdle')}</p>}
    {preview.status === 'empty' && <p className="tab-contexts__output-msg">{t('tabContexts.previewEmpty')}</p>}
    {preview.status === 'error' && (
      <p className="tab-contexts__output-msg tab-contexts__output-msg--error">{preview.message}</p>
    )}
    {preview.status === 'success' && (
      <pre className="tab-contexts__preview">{preview.content}</pre>
    )}
  </aside>
</div>
```

El bloque de `duplicateMessage` (líneas 235-239) se queda en el panel izquierdo, debajo de los campos: es un error de configuración, no de salida.

Las props `countAutoKeys` y `countAnnotations` dejan de usarse aquí: la línea `previewStats` desaparece porque el medidor de la tarea 4 la sustituye con cifras mejores. **No borres las props todavía** — se limpian en la tarea 4, cuando quede claro que nadie más las usa.

- [ ] **Step 2: Añade el CSS de los dos paneles**

En `src/renderer/agent/AgentPane.css`, junto a las demás reglas `.tab-contexts__*` (a partir de la línea ~1644):

```css
.tab-contexts__panes {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 340px);
  min-height: 430px;
  align-items: stretch;
}

.tab-contexts__output {
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: var(--bg-secondary);
  border-left: 1px solid var(--border);
}

.tab-contexts__output-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
  font-size: 11px;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.tab-contexts__output-head small {
  font-family: var(--font-mono, monospace);
  text-transform: none;
  letter-spacing: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tab-contexts__output-msg {
  padding: 12px;
  margin: 0;
  color: var(--text-muted);
  font-size: 12px;
}

.tab-contexts__output-msg--error { color: var(--danger); }

.tab-contexts__output .tab-contexts__preview {
  flex: 1;
  min-height: 0;
  overflow: auto;
  margin: 0;
  padding: 10px 12px;
}

@media (max-width: 900px) {
  .tab-contexts__panes { grid-template-columns: minmax(0, 1fr); }
  .tab-contexts__output { border-left: 0; border-top: 1px solid var(--border); }
}
```

- [ ] **Step 3: Ensancha el modal y quita el botón Preview**

En `TabContextFormModal.tsx`:

- Línea 423: `size="lg"` → `size="xl"`.
- En el `footer` (líneas 426-465), **borra el `<Button>` de Preview** (428-433). Los de Regenerate y Save se quedan por ahora; la tarea 7 rehace el pie entero.

- [ ] **Step 4: Dispara la vista previa con debounce**

En `TabContextFormModal.tsx`, después de la definición de `loadPreview` (termina en la línea 377), añade:

```tsx
  // La vista previa ya no es un botón: se recalcula sola. El debounce evita
  // materializar `symbols` sobre un repo grande en cada tecla; por debajo,
  // materializationSignature ya devuelve el resultado memorizado si el mtime
  // no cambió.
  useEffect(() => {
    if (!open || !draft) return
    const timer = setTimeout(() => { void loadPreview() }, 400)
    return () => clearTimeout(timer)
    // loadPreview se redefine en cada render; dependemos del contenido, no de él.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, draft, notesContent])
```

Nota para quien implemente: `draft` es un objeto nuevo en cada `update()`, así que la comparación por identidad de React basta para redisparar. No hace falta serializarlo.

- [ ] **Step 5: Añade las cadenas de i18n**

`src/i18n/locales/es.ts`, dentro del bloque `tabContexts` (empieza en la línea 250):

```ts
    previewIdle: 'Escribe un nombre para ver la vista previa.',
```

`src/i18n/locales/en.ts`, en el bloque equivalente:

```ts
    previewIdle: 'Name the context to see its preview.',
```

- [ ] **Step 6: Verifica en la app**

Run: `npm run dev`

Comprueba a mano, porque no hay test de componente:
1. Abrir un contexto existente muestra la vista previa **sin pulsar nada**.
2. Cambiar el nombre la recalcula tras ~400 ms, no en cada tecla.
3. El panel derecho no desborda: un `symbols` grande hace scroll dentro de su `<pre>`, la ventana no crece.
4. El modal no tiene ya un botón *Preview*.

**Mide antes de dar por buenos los 400 ms.** El spec pide una cifra, no una impresión. Con un contexto `symbols` sobre la raíz de este mismo repo, envuelve la llamada en la consola del renderer:

```js
const t0 = performance.now()
await window.api.previewTabContext({ context: draft, cwd })
console.log('materialize ms', performance.now() - t0)
```

Si la primera llamada supera ~350 ms, el debounce no basta: cambia el disparo a `blur` en los campos de texto y deja el efecto solo para el cambio de tipo. Anota la cifra en el mensaje del commit.

- [ ] **Step 7: Ejecuta la suite y el contrato de UI**

Run: `npm test && npm run check:ui`
Expected: ambos PASS.

- [ ] **Step 8: Commit**

```bash
git add src/renderer/agent/TabContextsEditor.tsx src/renderer/agent/TabContextFormModal.tsx src/renderer/agent/AgentPane.css src/i18n/locales/en.ts src/i18n/locales/es.ts
git commit -m "Divide el modal de contextos en dos paneles

La vista previa deja de ser un botón y pasa a ser el estado permanente
del panel derecho, con debounce de 400 ms sobre el draft."
```

---

### Task 4: El medidor de presupuesto

**Files:**
- Create: `src/renderer/agent/TabContextBudgetMeter.tsx`
- Create: `src/renderer/agent/TabContextBudgetMeter.css`
- Modify: `src/renderer/agent/TabContextsEditor.tsx`
- Modify: `src/renderer/agent/TabContextFormModal.tsx` (quitar props muertas)
- Modify: `src/i18n/locales/en.ts`, `src/i18n/locales/es.ts`

**Interfaces:**
- Consumes: `summarizeContextBudget` (tarea 2), `sectionsForContext` (tarea 1), `PreviewState`.
- Produces: `TabContextBudgetMeter: React.FC<{ summary: ContextBudgetSummary }>`

- [ ] **Step 1: Crea el componente**

`src/renderer/agent/TabContextBudgetMeter.tsx`:

```tsx
import React from 'react'
import type { ContextBudgetSummary } from '@shared/contextBudget'
import { useT } from '@i18n/useT'
import './TabContextBudgetMeter.css'

export interface TabContextBudgetMeterProps {
  summary: ContextBudgetSummary
}

const compact = (value: number): string =>
  value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(value)

/** Lo que recibirá el agente y cuánto pesa: la pregunta que el modal debe responder. */
export const TabContextBudgetMeter: React.FC<TabContextBudgetMeterProps> = ({ summary }) => {
  const { t } = useT()
  return (
    <div className="ctx-budget">
      <div className="ctx-budget__stats">
        <div className="ctx-budget__stat">
          <span className="ctx-budget__value">{summary.sections}</span>
          <span className="ctx-budget__key">{t('tabContexts.budgetSections')}</span>
        </div>
        <div className="ctx-budget__stat">
          <span className="ctx-budget__value">{compact(summary.chars)}</span>
          <span className="ctx-budget__key">{t('tabContexts.budgetChars')}</span>
        </div>
        <div className="ctx-budget__stat">
          <span className="ctx-budget__value">~{compact(summary.estimatedTokens)}</span>
          <span className="ctx-budget__key">{t('tabContexts.budgetTokens')}</span>
        </div>
      </div>
      <div
        className={`ctx-budget__meter ctx-budget__meter--${summary.level}`}
        role="progressbar"
        aria-valuenow={Math.round(summary.ratio * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t('tabContexts.budgetAria')}
      >
        <i style={{ width: `${Math.max(2, summary.ratio * 100)}%` }} />
      </div>
      <p className="ctx-budget__delivery">
        <span className={`ctx-budget__pill ctx-budget__pill--${summary.delivery}`}>
          {t(`tabContexts.delivery_${summary.delivery}`)}
        </span>
        {t(`tabContexts.deliveryHint_${summary.delivery}`)}
      </p>
    </div>
  )
}
```

El `style` inline de la barra está permitido: es geometría en tiempo de ejecución, el caso que las reglas de frontend admiten explícitamente. Y este componente **no es del UI kit** (vive en `agent/`, no en `components/ui/`), así que sus clases BEM propias son correctas.

- [ ] **Step 2: Crea el CSS**

`src/renderer/agent/TabContextBudgetMeter.css`:

```css
.ctx-budget {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
}

.ctx-budget__stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.ctx-budget__stat { display: flex; flex-direction: column; }

.ctx-budget__value {
  font-family: var(--font-mono, monospace);
  font-size: 16px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--text);
}

.ctx-budget__key { font-size: 10px; color: var(--text-muted); }

.ctx-budget__meter {
  height: 5px;
  border-radius: 3px;
  background: var(--surface-hover);
  overflow: hidden;
}

.ctx-budget__meter > i {
  display: block;
  height: 100%;
  border-radius: 3px;
  background: var(--accent);
  transition: width .28s ease;
}

.ctx-budget__meter--warn > i { background: #9c8a1d; }
.ctx-budget__meter--over > i { background: var(--danger); }

.ctx-budget__delivery {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  font-size: 11px;
  color: var(--text-muted);
}

.ctx-budget__pill {
  flex: none;
  font-size: 9px;
  font-weight: 600;
  letter-spacing: .07em;
  text-transform: uppercase;
  padding: 1px 5px;
  border-radius: 4px;
  border: 1px solid currentColor;
}

.ctx-budget__pill--catalog { color: var(--accent); }
.ctx-budget__pill--whole { color: #9c8a1d; }

@media (prefers-reduced-motion: reduce) {
  .ctx-budget__meter > i { transition: none; }
}
```

- [ ] **Step 3: Móntalo en el panel derecho**

En `TabContextsEditor.tsx`, dentro del `<aside className="tab-contexts__output">` y **antes** de `.tab-contexts__output-head`:

```tsx
{preview.status === 'success' && (
  <TabContextBudgetMeter
    summary={summarizeContextBudget(
      sectionsForContext(draft, { ok: true, content: preview.content }),
      draft.kind,
    )}
  />
)}
```

Imports nuevos:

```tsx
import { sectionsForContext } from '@shared/contextSections'
import { summarizeContextBudget } from '@shared/contextBudget'
import { TabContextBudgetMeter } from './TabContextBudgetMeter'
```

Para `notes`, `sectionsForContext` lee `materialized.notesContent`; la vista previa de un `notes` devuelve el documento entero en `content`, así que pásale también el campo:

```tsx
sectionsForContext(draft, {
  ok: true,
  content: preview.content,
  ...(draft.kind === 'notes' ? { notesContent } : {}),
})
```

- [ ] **Step 4: Borra lo que el medidor deja obsoleto**

- En `TabContextsEditor.tsx`: quita las props `countAutoKeys` y `countAnnotations` de la interfaz `Props` (líneas 44-45) y del destructuring.
- En `TabContextFormModal.tsx`: quita las dos props del JSX (líneas 483-484) y borra las funciones `countAutoKeys` (línea 51) y `countAnnotations` (línea 56), que se quedan sin llamadores.
- En los dos locales: borra la clave `previewStats`.

- [ ] **Step 5: Añade las cadenas de i18n**

`src/i18n/locales/es.ts`, bloque `tabContexts`:

```ts
    budgetSections: 'secciones',
    budgetChars: 'caracteres',
    budgetTokens: 'tokens estimados',
    budgetAria: 'Uso del presupuesto de contexto',
    delivery_catalog: 'Catálogo',
    delivery_whole: 'Entero',
    deliveryHint_catalog: 'solo claves y tamaños; la IA pide los cuerpos',
    deliveryHint_whole: 'se adjunta completo en cada turno',
```

`src/i18n/locales/en.ts`:

```ts
    budgetSections: 'sections',
    budgetChars: 'characters',
    budgetTokens: 'estimated tokens',
    budgetAria: 'Context budget usage',
    delivery_catalog: 'Catalog',
    delivery_whole: 'Whole',
    deliveryHint_catalog: 'keys and sizes only; the model requests bodies',
    deliveryHint_whole: 'attached in full on every turn',
```

- [ ] **Step 6: Verifica en la app**

Run: `npm run dev`

1. Un contexto `folderTree` muestra decenas de secciones y la píldora **Catálogo**.
2. Un contexto `notes` muestra 1 sección y la píldora **Entero**.
3. Un `symbols` sobre la raíz del proyecto pone la barra en ámbar o rojo — es el caso que justifica el medidor.
4. Las cifras cuadran con la realidad: compáralas con las secciones de la vista previa a la derecha.

- [ ] **Step 7: Ejecuta la suite y el contrato de UI**

Run: `npm test && npm run check:ui`
Expected: ambos PASS.

- [ ] **Step 8: Commit**

```bash
git add src/renderer/agent/TabContextBudgetMeter.tsx src/renderer/agent/TabContextBudgetMeter.css src/renderer/agent/TabContextsEditor.tsx src/renderer/agent/TabContextFormModal.tsx src/i18n/locales/en.ts src/i18n/locales/es.ts
git commit -m "Muestra el presupuesto del contexto en el modal

Secciones, caracteres, tokens estimados y modo de entrega, calculados con
las mismas funciones que usa el pipeline. Sustituye a previewStats, que
contaba claves anotadas en vez de coste."
```

---

### Task 5: Chips de tipo agrupados por origen

**Files:**
- Modify: `src/renderer/agent/TabContextsEditor.tsx`
- Modify: `src/renderer/agent/AgentPane.css`
- Modify: `src/i18n/locales/en.ts`, `src/i18n/locales/es.ts`

**Interfaces:**
- Consumes: `HOST_CONTEXT_KINDS`, `CREATABLE_CONTEXT_KINDS` de `@shared/tabContext`; `TabContextKindCard` (existente).
- Produces: nada para otras tareas.

- [ ] **Step 1: Sustituye la rejilla plana por grupos**

En `TabContextsEditor.tsx`, reemplaza la constante `KINDS` (línea 27) por:

```tsx
/**
 * Los tipos se agrupan por quién escribe el cuerpo, que es la distinción con
 * consecuencias: los host los materializa el pipeline desde el disco, `notes`
 * lo escribe la persona.
 */
const KIND_GROUPS: Array<{ labelKey: string; kinds: TabContextKind[] }> = [
  {
    labelKey: 'tabContexts.group_host',
    kinds: CREATABLE_CONTEXT_KINDS.filter(kind =>
      (HOST_CONTEXT_KINDS as readonly TabContextKind[]).includes(kind)),
  },
  {
    labelKey: 'tabContexts.group_manual',
    kinds: CREATABLE_CONTEXT_KINDS.filter(kind =>
      !(HOST_CONTEXT_KINDS as readonly TabContextKind[]).includes(kind)),
  },
]
```

Import: añade `HOST_CONTEXT_KINDS` a la línea 3.

Y el bloque de las líneas 84-94 pasa a:

```tsx
<div className="tab-contexts__kind-groups">
  {KIND_GROUPS.map(group => (
    <div className="tab-contexts__kind-group" key={group.labelKey}>
      <span className="tab-contexts__kind-group-label">{t(group.labelKey)}</span>
      <div className="tab-contexts__kinds" role="radiogroup" aria-label={t(group.labelKey)}>
        {group.kinds.map(kind => (
          <TabContextKindCard
            key={kind}
            label={t(`tabContexts.kind_${kind}`)}
            icon={KIND_ICONS[kind]}
            selected={draft.kind === kind}
            onSelect={() => onSelectKind(kind)}
          />
        ))}
      </div>
    </div>
  ))}
</div>
```

Cada grupo es su propio `radiogroup`, que es correcto semánticamente: son conjuntos distintos aunque la selección sea global. `aria-checked` en cada tarjeta ya lo pone `TabContextKindCard`.

- [ ] **Step 2: Añade el CSS de los grupos**

En `AgentPane.css`, junto a `.tab-contexts__kinds` (línea ~1659):

```css
.tab-contexts__kind-groups {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.tab-contexts__kind-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.tab-contexts__kind-group-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 10px;
  letter-spacing: .12em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.tab-contexts__kind-group-label::after {
  content: "";
  flex: 1;
  height: 1px;
  background: var(--border);
}
```

Si la regla existente de `.tab-contexts__kinds` fija `grid-template-columns: repeat(3, …)`, cámbiala a `display: flex; flex-wrap: wrap; gap: 6px;` para que los grupos de distinto tamaño no dejen huecos.

- [ ] **Step 3: Añade las cadenas de i18n**

`es.ts`:

```ts
    group_host: 'Del repositorio · los genera el host',
    group_manual: 'Escrito a mano',
```

`en.ts`:

```ts
    group_host: 'From the repository · host-generated',
    group_manual: 'Hand-written',
```

- [ ] **Step 4: Verifica en la app**

Run: `npm run dev`

1. Aparecen dos grupos con sus rótulos; los siete tipos host arriba y «Custom (Markdown)» abajo.
2. Seleccionar un tipo de un grupo deselecciona el del otro.
3. Con Tab se recorren los dos grupos y la selección con flechas funciona dentro de cada uno.

- [ ] **Step 5: Ejecuta la suite y el contrato de UI**

Run: `npm test && npm run check:ui`
Expected: ambos PASS.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/agent/TabContextsEditor.tsx src/renderer/agent/AgentPane.css src/i18n/locales/en.ts src/i18n/locales/es.ts
git commit -m "Agrupa los tipos de contexto por quién escribe el cuerpo

La rejilla plana escondía la única distinción con consecuencias: los kinds
host los materializa el pipeline desde el disco; notes lo escribe la
persona y se adjunta entero."
```

---

### Task 6: «Aspecto» plegado

Recupera el ~40 % del alto que hoy ocupan catorce iconos y doce colores siempre desplegados.

**Files:**
- Modify: `src/renderer/agent/TabContextsEditor.tsx`
- Modify: `src/renderer/agent/AgentPane.css`
- Modify: `src/i18n/locales/en.ts`, `src/i18n/locales/es.ts`

**Interfaces:**
- Consumes: `TabContextIconSwatch`, `TabContextColorSwatch` (existentes, sin cambios).
- Produces: nada para otras tareas.

- [ ] **Step 1: Envuelve los dos fieldset en un `<details>`**

En `TabContextsEditor.tsx`, el bloque de las líneas 123-160 pasa a:

```tsx
{!hostOwnedReadOnly && (
  <details className="tab-contexts__appearance-fold">
    <summary>
      <Icon name={appearanceIconName(resolveContextIcon(draft))} size={14} />
      {t('tabContexts.appearance')}
    </summary>
    <fieldset className="tab-contexts__appearance">
      <legend>{t('tabContexts.icon')}</legend>
      {/* la rejilla de iconos, sin cambios */}
    </fieldset>
    <fieldset className="tab-contexts__appearance">
      <legend>{t('tabContexts.color')}</legend>
      {/* la rejilla de colores, sin cambios */}
    </fieldset>
  </details>
)}
```

`<details>` nativo en vez del popover que pedía el spec: da plegado, teclado y accesibilidad sin componente nuevo, y no pelea con el `overflow` del panel. El `<summary>` muestra el icono actual, así que se ve la elección sin desplegar.

- [ ] **Step 2: Añade el CSS del plegado**

En `AgentPane.css`:

```css
.tab-contexts__appearance-fold {
  border: 1px solid var(--border);
  border-radius: var(--radius, 6px);
}

.tab-contexts__appearance-fold > summary {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  cursor: default;
  font-size: 12px;
  color: var(--text-muted);
  list-style: none;
  user-select: none;
}

/* Safari muestra el triángulo por defecto; lo quitamos en los dos motores. */
.tab-contexts__appearance-fold > summary::-webkit-details-marker { display: none; }

.tab-contexts__appearance-fold > summary::after {
  content: "▸";
  margin-left: auto;
  font-size: 10px;
  transition: transform .15s ease;
}

.tab-contexts__appearance-fold[open] > summary::after { transform: rotate(90deg); }

.tab-contexts__appearance-fold > summary:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.tab-contexts__appearance-fold[open] > summary { border-bottom: 1px solid var(--border); }

@media (prefers-reduced-motion: reduce) {
  .tab-contexts__appearance-fold > summary::after { transition: none; }
}
```

- [ ] **Step 3: Añade las cadenas de i18n**

`es.ts`: `appearance: 'Aspecto',`
`en.ts`: `appearance: 'Appearance',`

- [ ] **Step 4: Verifica en la app**

Run: `npm run dev`

1. El modal abre con «Aspecto» plegado y el icono actual visible en la cabecera.
2. Enter o Espacio sobre el `<summary>` lo despliega; el foco se ve.
3. Elegir un icono actualiza el que muestra el `<summary>`.
4. El panel izquierdo ya no necesita scroll para llegar a la carpeta raíz — que era el problema 3 del spec.

- [ ] **Step 5: Ejecuta la suite y el contrato de UI**

Run: `npm test && npm run check:ui`
Expected: ambos PASS.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/agent/TabContextsEditor.tsx src/renderer/agent/AgentPane.css src/i18n/locales/en.ts src/i18n/locales/es.ts
git commit -m "Pliega icono y color tras un details

Catorce iconos y doce colores siempre desplegados empujaban la
configuración real del tipo fuera de la vista. details nativo en vez de un
popover: plegado, teclado y accesibilidad sin componente nuevo."
```

---

### Task 7: Pie de dos acciones y cierre sin guardado silencioso

**Files:**
- Modify: `src/renderer/agent/TabContextFormModal.tsx`
- Modify: `src/i18n/locales/en.ts`, `src/i18n/locales/es.ts`

**Interfaces:**
- Consumes: `save()`, `regenerate()`, `handleDismiss()` existentes.
- Produces: nada para otras tareas.

- [ ] **Step 1: Sustituye el pie por dos acciones**

En `TabContextFormModal.tsx`, el `footer` (líneas 426-465) pasa a:

```tsx
      footer={(
        <>
          {isDirty && <small className="tab-contexts__dirty">{t('tabContexts.unsavedHint')}</small>}
          <Button variant="secondary" onClick={onClose}>
            {t('tabContexts.discard')}
          </Button>
          {draft.kind !== 'agentResult' && (
            <Button
              disabled={
                Boolean(duplicateMessage)
                || (draft.kind === 'changelog'
                  ? false
                  : !(draft.name ?? '').trim() || !(draft.fileName ?? '').trim())
              }
              onClick={() => { void save() }}
            >
              {t('tabContexts.saveContext')}
            </Button>
          )}
        </>
      )}
```

*Regenerate* desaparece: su función —rematerializar y reescribir el `.md`— la hace ya *Guardar contexto*, y para los contextos host la vista previa en vivo de la tarea 3 rematerializa en cada cambio. Borra también la función `regenerate` (líneas 297-341), que se queda sin llamadores, y las claves `regenerate` y `regenerateHint` de los dos locales.

- [ ] **Step 2: Calcula si hay cambios pendientes**

Antes del `return`, junto a `readOnlyChangelog` (línea 178):

```tsx
  // Comparación por valor contra el contexto de partida. En `create` cualquier
  // nombre escrito ya cuenta como cambio pendiente.
  const initial = mode === 'edit' && context ? context : null
  const isDirty = initial
    ? JSON.stringify(draft) !== JSON.stringify(initial)
    : Boolean((draft.name ?? '').trim())
```

Para `notes` el contenido no vive en `draft`; añade la comparación del textarea:

```tsx
  const isDirty = (initial
    ? JSON.stringify(draft) !== JSON.stringify(initial)
    : Boolean((draft.name ?? '').trim()))
    || (draft.kind === 'notes' && notesContent.trim().length > 0 && mode === 'create')
```

- [ ] **Step 3: Deja de guardar al cerrar**

Sustituye `handleDismiss` (líneas 281-295) por:

```tsx
  /**
   * Esc y clic fuera cierran solo si no hay nada que perder. Antes esto llamaba
   * a save(), un guardado que ningún botón anunciaba; y descartar en silencio
   * sería peor. Con cambios pendientes el modal se queda y el pie lo explica.
   */
  const handleDismiss = (): void => {
    if (!draftRef.current) {
      onClose()
      return
    }
    if (isDirtyRef.current) return
    onClose()
  }
```

Añade el ref junto a los demás (líneas 76-85), porque `handleDismiss` corre fuera del render:

```tsx
  const isDirtyRef = useRef(false)
  isDirtyRef.current = isDirty
```

`isDirty` se declara después de los refs; muévelo por encima de ellos o asigna el ref justo después de calcularlo. Lo que no vale es leer `isDirty` directamente dentro de `handleDismiss`.

- [ ] **Step 4: Añade las cadenas de i18n**

`es.ts`:

```ts
    discard: 'Descartar',
    saveContext: 'Guardar contexto',
    unsavedHint: 'Tienes cambios sin guardar.',
```

`en.ts`:

```ts
    discard: 'Discard',
    saveContext: 'Save context',
    unsavedHint: 'You have unsaved changes.',
```

Añade también el CSS del aviso en `AgentPane.css`:

```css
.tab-contexts__dirty {
  margin-right: auto;
  font-size: 11px;
  color: var(--text-muted);
}
```

- [ ] **Step 5: Verifica en la app**

Run: `npm run dev`

1. Abrir un contexto y cerrar con Esc **sin tocar nada**: cierra, y el `.md` no cambia (compruébalo con `git status` sobre `.gravity/`).
2. Cambiar el nombre y pulsar Esc: el modal **no** se cierra y el pie avisa.
3. *Descartar* cierra sin escribir, incluso con cambios.
4. *Guardar contexto* escribe y cierra.
5. Ya no hay botones *Preview* ni *Regenerate*.

- [ ] **Step 6: Ejecuta la suite y el contrato de UI**

Run: `npm test && npm run check:ui`
Expected: ambos PASS.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/agent/TabContextFormModal.tsx src/renderer/agent/AgentPane.css src/i18n/locales/en.ts src/i18n/locales/es.ts
git commit -m "Dos acciones en el modal de contextos y cierre sin guardado oculto

Esc y el clic fuera llamaban a save() sin que ningún botón lo anunciara.
Ahora cierran solo si no hay cambios. Regenerate desaparece: guardar ya
rematerializa, y la vista previa en vivo lo hace en cada cambio."
```

---

### Task 8: Mostrar el `.md` en el Finder

La más pequeña y la más prescindible: si el revisor prefiere no añadir un canal IPC por esto, se descarta la tarea entera sin tocar nada de lo anterior.

**Files:**
- Modify: `src/shared/ipcChannels.ts`
- Modify: `electron/main.ts`
- Modify: `electron/preload.ts`
- Modify: `src/renderer/agent/TabContextsEditor.tsx`
- Modify: `src/renderer/agent/AgentPane.css`
- Modify: `src/i18n/locales/en.ts`, `src/i18n/locales/es.ts`

**Interfaces:**
- Consumes: `PROJECT_DIR` de `@shared/projectDir`.
- Produces: `window.api.revealTabContext(cwd: string, fileName: string): Promise<{ ok: boolean; error?: string }>`

No se reutiliza `IPC.FILE_EXPLORER_REVEAL` (`main.ts:1123`) porque resuelve la ruta contra `explorerRootForSession(sessionId)`, y el modal tiene un `cwd`, no un `sessionId`.

- [ ] **Step 1: Declara el canal**

En `src/shared/ipcChannels.ts`, junto a los demás de contextos:

```ts
  TAB_CONTEXT_REVEAL: 'tabContext:reveal',
```

- [ ] **Step 2: Implementa el handler**

En `electron/main.ts`, junto a los otros handlers de `tabContext`:

```ts
  ipcMain.handle(IPC.TAB_CONTEXT_REVEAL, (_e, cwd: unknown, fileName: unknown) => {
    if (typeof cwd !== 'string' || !cwd.trim()) return { ok: false, error: 'cwd vacío' }
    if (typeof fileName !== 'string' || !fileName.trim()) return { ok: false, error: 'archivo vacío' }
    // El archivo tiene que quedar dentro de <cwd>/<projectDir>: el nombre llega
    // del renderer y no es de fiar.
    const root = resolve(cwd, projectDirName(cwd))
    const target = resolve(root, fileName)
    const rel = relative(root, target)
    if (rel.startsWith('..') || isAbsolute(rel)) {
      return { ok: false, error: 'ruta fuera del proyecto' }
    }
    if (!existsSync(target)) return { ok: false, error: 'el archivo no existe todavía' }
    shell.showItemInFolder(target)
    return { ok: true }
  })
```

`resolve`, `relative`, `isAbsolute`, `existsSync`, `shell` y `projectDirName` ya están importados en `main.ts`; verifica antes de añadir imports duplicados.

- [ ] **Step 3: Expón el método en preload**

En `electron/preload.ts`, junto a los demás de contextos:

```ts
  revealTabContext(cwd: string, fileName: string) {
    return ipcRenderer.invoke(IPC.TAB_CONTEXT_REVEAL, cwd, fileName)
  },
```

Añade la firma al tipo de `window.api` donde estén declaradas las demás.

- [ ] **Step 4: Sustituye la ruta muerta por una fila accionable**

En `TabContextsEditor.tsx`, el `<label>` del nombre de archivo (líneas 115-121) pasa a:

```tsx
<div className="tab-contexts__file-row">
  <span>{`${PROJECT_DIR}/${normalizeContextFileName(
    draft.name || draft.fileName || (draft.kind === 'changelog' ? 'changelog' : 'context'),
    draft.kind === 'changelog' ? 'changelog' : 'context',
  )}`}</span>
  <Button
    variant="secondary"
    size="sm"
    disabled={preview.status !== 'success'}
    onClick={() => { void window.api.revealTabContext(projectCwd, draft.fileName) }}
  >
    {t('tabContexts.reveal')}
  </Button>
</div>
```

Import de `Button` desde `'../components/ui'` (ya se importan `Input`, `TextArea`, `Toggle` en la línea 12). `ButtonSize` es `'xs' | 'sm' | 'md'` (`Button.tsx:5`), así que `size="sm"` es válido.

El botón se deshabilita mientras la vista previa no haya tenido éxito: antes de eso el archivo puede no existir en disco.

- [ ] **Step 5: CSS e i18n**

`AgentPane.css`:

```css
.tab-contexts__file-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 5px 8px;
  border: 1px dashed var(--border);
  border-radius: var(--radius, 6px);
}

.tab-contexts__file-row > span {
  font-family: var(--font-mono, monospace);
  font-size: 11px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

`es.ts`: `reveal: 'Mostrar en Finder',`
`en.ts`: `reveal: 'Show in Finder',`

- [ ] **Step 6: Verifica en la app**

Run: `npm run dev`

1. Guardar un contexto y pulsar *Mostrar en Finder* abre el Finder con el `.md` seleccionado.
2. En un contexto nuevo sin guardar, el botón está deshabilitado.
3. Comprueba la validación de ruta desde la consola del renderer:
   `await window.api.revealTabContext(cwd, '../../../etc/hosts')` → `{ ok: false, error: 'ruta fuera del proyecto' }`, y **no** abre nada.

- [ ] **Step 7: Ejecuta la suite y el contrato de UI**

Run: `npm test && npm run check:ui`
Expected: ambos PASS.

- [ ] **Step 8: Commit**

```bash
git add src/shared/ipcChannels.ts electron/main.ts electron/preload.ts src/renderer/agent/TabContextsEditor.tsx src/renderer/agent/AgentPane.css src/i18n/locales/en.ts src/i18n/locales/es.ts
git commit -m "Permite abrir el .md del contexto en el Finder

El archivo es el producto del contexto y lo que el equipo comparte por
git; la ruta era texto muerto. Canal propio en vez de FILE_EXPLORER_REVEAL,
que resuelve contra la raíz del explorador y no contra el cwd del panel."
```

---

## Verificación final

Después de la tarea 8, y contra el spec:

- [ ] `npm test` — verde, y con dos archivos de test más que al empezar.
- [ ] `npm run check:ui` — verde.
- [ ] `npx tsc -b 2>&1 | grep -c "error TS"` — el mismo número que antes de la tarea 1.
- [ ] Los siete problemas del spec, uno por uno: tipos agrupados (5), aspecto plegado (6), configuración del tipo por encima de la cosmética (6), medidor visible (4), dos acciones (7), ruta accionable (8), píldora de entrega (4).
- [ ] Un contexto de cada kind se crea, se guarda y se vuelve a abrir sin perder configuración — incluidos `changelog` y `agentResult`, que son de solo lectura y no deben mostrar el pie de guardado.
