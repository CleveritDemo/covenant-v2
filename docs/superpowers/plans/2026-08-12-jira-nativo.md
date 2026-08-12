# Jira nativo (fases 1 y 2) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que una issue de Jira sea un contexto de primera clase en Gravity — materializada como Markdown seccionado en `.gravity/jira/<KEY>.md`, refrescada desde Jira Cloud antes del turno, y adjuntable desde el composer escribiendo su clave.

**Architecture:** Un `TabContextKind` nuevo, `'jira'`, que atraviesa el pipeline de contextos existente sin modificarlo: el host escribe el `.md` y `materializeTabContext` sigue siendo síncrono y sigue leyendo disco. La única pieza async nueva vive en el handler de `IPC.AGENT_CLI_START`, antes de `startAgentTurn`. La app lee Jira por REST v3 desde `electron/`; el MCP del CLI se queda como está, para las escrituras del agente. Toda la lógica decidible es pura en `src/shared/`.

**Tech Stack:** TypeScript, React 18, Electron (`fetch` nativo + `safeStorage`), vitest (entorno `node` para lógica pura, `jsdom` con docblock para componentes), i18next (`en` + `es`), CSS colocado con clases BEM.

**Spec:** `docs/superpowers/specs/2026-08-12-jira-nativo-design.md`
**Precedente de diseño:** `docs/superpowers/specs/2026-08-07-mcp-como-contexto-design.md`

## Global Constraints

- Los comentarios y la documentación se escriben **en español**; el código, en inglés.
- Tres grafos separados: `electron/` (privilegiado), `src/renderer/` (React, sin Node), `src/shared/` (puro). Un archivo de `src/renderer/` **no puede** importar de `electron/`, y `src/shared/` **no puede** importar `node:*` ni de `electron/`. Lo enforce `tsconfig.web.json`.
- Los componentes del UI kit (`src/renderer/components/ui/**`) no aceptan `className` ni `style`; se estilan con props tipadas. `npm run check:ui` falla si se les pasa. Las clases BEM internas de una feature sí están permitidas.
- Tooltips siempre con `components/ui/Tooltip`, nunca con el atributo `title`. `npm run check:ui` también falla por eso.
- Toda cadena visible pasa por i18n y **se añade a los dos locales** (`src/i18n/locales/en.ts` y `es.ts`) en el mismo commit. El `t()` está tipado sobre las claves de `en.ts`: una clave que falte allí **no compila**.
- Nunca escribas un literal `.gravity`. Usa `PROJECT_DIR` (`src/shared/projectDir.ts`) o `projectDirPath(cwd, …)` (`electron/projectDir.ts`), que respeta proyectos legacy en `.iaterminal`.
- Añadir una ruta IPC son cuatro sitios, todos obligatorios: la constante en `src/shared/ipcChannels.ts`, el handler en `electron/main.ts`, el método en `electron/preload.ts`, y el llamador.
- **No se añaden dependencias.** El cliente de Jira usa el `fetch` global de Node 20+/Electron.
- **Ningún cambio de firma en el pipeline de contextos.** Si acabas volviendo `async` a `materializeTabContext`, `sectionsForContext` o `composePrompt`, el diseño se salió del carril: para y avisa.
- **El token de Jira nunca se escribe en `.gravity/jira.json` ni en un `.md`.** Vive cifrado con `safeStorage`, siguiendo `electron/covenantSession.ts`.
- `npx tsc -b` arrastra **78 errores previos** ajenos a este trabajo. **No es una puerta de paso/fallo**: el número debe seguir en 78. Si sube, mira qué introdujiste.
- Baseline de la suite al empezar: **194 archivos (193 verdes, 1 skipped) / 1714 tests (1709 verdes, 5 skipped)**. Debe subir, porque este plan añade tests.
- **Trampa del entorno:** el `grep` de este shell resuelve a `ugrep -I` y **salta archivos con bytes NUL en silencio**. Además, `rg -rn "algo"` **no** es «recursivo + números de línea»: `-r` es `--replace`. Usa `rg -n --text "algo"`.
- **No puedes verificar en la app:** `npm run dev` no termina en una sesión no interactiva. Verifica leyendo el código y con tests, y lista en tu informe lo que requiera la app abierta.

## Estructura de archivos

| Archivo | Responsabilidad | Tarea |
|---|---|---|
| `src/shared/jiraIssue.ts` | **Nuevo.** Puro: tipos de issue, `normalizeIssueKey`, `parseIssueKeys`, `mentionQueryAt`, `isSnapshotStale` | 1, 9 |
| `src/shared/jiraIssueDoc.ts` | **Nuevo.** Puro: `adfToText`, `issueAutoMarkdown`, `withJiraAutoBlock` | 2 |
| `src/shared/jiraConfig.ts` | **Nuevo.** Puro: `parseJiraConfig` con defaults | 3 |
| `electron/jiraConfig.ts` | **Nuevo.** Lee `.gravity/jira.json`; credenciales con `safeStorage` | 3 |
| `electron/jiraClient.ts` | **Nuevo.** REST v3: `jiraMyself`, `jiraSearch`, `jiraGetIssue`; caché con TTL | 4 |
| `src/shared/tabContext.ts` | El kind `jira` en los cuatro arrays, ids y nombres canónicos | 5 |
| `src/shared/tabContextAppearance.ts` | `KIND_DEFAULT_ICON` / `KIND_DEFAULT_COLOR` para `jira` | 5 |
| `src/renderer/agent/tabContextKindIcons.ts` | `KIND_ICONS.jira` | 5 |
| `electron/tabContextBuild.ts` | Rama `jira`: ruta `jira/<KEY>.md`, materializar leyendo disco, descubrir la carpeta | 5 |
| `electron/jiraContextRefresh.ts` | **Nuevo.** `refreshStaleJiraContexts(contexts, cwd)` | 6 |
| `electron/agentCliRuntime.ts` | Exportar `resolveWorkingDirectory`; añadir el preámbulo de issues adjuntas | 6 |
| `src/shared/mcpCapabilityPrompt.ts` | `buildJiraAttachedPrompt`, junto a la frase que ya promete acceso a Jira | 6 |
| `electron/main.ts` | `stopAgentRun` antes del `await`; el refresco; los tres handlers IPC | 6, 7 |
| `src/shared/ipcChannels.ts`, `electron/preload.ts` | Canales `JIRA_*` | 7 |
| `src/renderer/components/JiraConnectionField.tsx` + css | **Nuevo.** Conexión en Ajustes | 8 |
| `src/renderer/agent/TabContextFormModal.tsx` | Campo «clave de issue» para el kind `jira` | 9 |
| `src/renderer/workspace/JiraMentionPicker.tsx` + css | **Nuevo.** Picker inline del composer | 10 |
| `src/renderer/workspace/PlaneChatComposer.tsx` | El disparador de mención | 10 |
| `src/renderer/workspace/JiraIssueChip.tsx` + css | **Nuevo.** Chip con tarjeta al pasar el cursor | 11 |

**Fase 1 = tareas 1–9** (entregable solo: la issue como contexto, sin mención).
**Fase 2 = tareas 10–11** (mención y tarjeta).

---

### Task 1: Tipos de issue y parseo de claves

**Files:**
- Create: `src/shared/jiraIssue.ts`
- Test: `src/shared/__tests__/jiraIssue.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `interface JiraIssueRef { key: string; summary: string; status: string; issueType: string; assignee: string | null }`
  - `interface JiraComment { author: string; created: string; body: string }`
  - `interface JiraIssueSnapshot extends JiraIssueRef { priority: string | null; sprint: string | null; updated: string; url: string; description: string; acceptanceCriteria: string | null; comments: JiraComment[]; subtasks: JiraIssueRef[]; links: Array<{ type: string; key: string; summary: string }> }`
  - `function normalizeIssueKey(raw: string): string`
  - `function parseIssueKeys(text: string, projectKeys: readonly string[]): string[]`
  - `function isSnapshotStale(mtimeMs: number, refreshSeconds: number, nowMs: number): boolean`

- [ ] **Step 1: Escribe los tests que fallan**

Crea `src/shared/__tests__/jiraIssue.test.ts`. El caso que más importa es el filtro por `projectKeys`: sin él, `UTF-8` y `CVE-2023-30533` se leen como issues.

```ts
import { describe, expect, it } from 'vitest'
import { isSnapshotStale, normalizeIssueKey, parseIssueKeys } from '../jiraIssue'

describe('normalizeIssueKey', () => {
  it('mayúsculas y sin espacios', () => {
    expect(normalizeIssueKey('  grav-412 ')).toBe('GRAV-412')
  })

  it('lo que no es una clave devuelve cadena vacía', () => {
    expect(normalizeIssueKey('no soy una clave')).toBe('')
    expect(normalizeIssueKey('GRAV-')).toBe('')
    expect(normalizeIssueKey('-412')).toBe('')
  })
})

describe('parseIssueKeys', () => {
  const keys = ['GRAV', 'COV']

  it('encuentra las claves de los proyectos declarados', () => {
    const text = 'arregla GRAV-412 y revisa cov-7 antes del release'
    expect(parseIssueKeys(text, keys)).toEqual(['GRAV-412', 'COV-7'])
  })

  it('ignora prefijos que no están declarados: ese es el filtro que evita falsos positivos', () => {
    const text = 'usa UTF-8, mira CVE-2023-30533 y el SHA-256 del bundle'
    expect(parseIssueKeys(text, keys)).toEqual([])
  })

  it('sin projectKeys no hay disparador', () => {
    expect(parseIssueKeys('GRAV-412', [])).toEqual([])
  })

  it('deduplica conservando el primer orden de aparición', () => {
    expect(parseIssueKeys('GRAV-412 y otra vez GRAV-412 y COV-1', keys))
      .toEqual(['GRAV-412', 'COV-1'])
  })

  it('no parte una clave dentro de una palabra ni de una URL', () => {
    expect(parseIssueKeys('XGRAV-412 y foo/GRAV-412x', keys)).toEqual([])
  })

  it('sí la reconoce dentro de una URL de Jira', () => {
    expect(parseIssueKeys('https://x.atlassian.net/browse/GRAV-412', keys)).toEqual(['GRAV-412'])
  })
})

describe('isSnapshotStale', () => {
  const now = 1_000_000

  it('un archivo recién escrito no está vencido', () => {
    expect(isSnapshotStale(now - 60_000, 900, now)).toBe(false)
  })

  it('pasado refreshSeconds sí lo está', () => {
    expect(isSnapshotStale(now - 901_000, 900, now)).toBe(true)
  })

  it('sin archivo (mtime 0) siempre está vencido', () => {
    expect(isSnapshotStale(0, 900, now)).toBe(true)
  })

  it('refreshSeconds 0 desactiva el refresco automático', () => {
    expect(isSnapshotStale(now - 10_000_000, 0, now)).toBe(false)
  })
})
```

- [ ] **Step 2: Corre el test y verifica que falla**

Run: `npx vitest run src/shared/__tests__/jiraIssue.test.ts`
Expected: FAIL — `Failed to resolve import "../jiraIssue"`.

- [ ] **Step 3: Escribe la implementación mínima**

Crea `src/shared/jiraIssue.ts`:

```ts
/**
 * Tipos y parseo de issues de Jira. Puro: vive acá porque lo necesitan los dos
 * lados — `electron/` para materializar el `.md` y el renderer para el picker
 * del composer, que debe reconocer exactamente las mismas claves.
 */

export interface JiraIssueRef {
  key: string
  summary: string
  status: string
  issueType: string
  assignee: string | null
}

export interface JiraComment {
  author: string
  /** ISO 8601 tal como lo devuelve Jira. */
  created: string
  body: string
}

export interface JiraIssueSnapshot extends JiraIssueRef {
  priority: string | null
  sprint: string | null
  /** ISO 8601 del `fields.updated` de Jira; la cabecera del `.md` lo muestra. */
  updated: string
  url: string
  description: string
  /** Campo custom si el proyecto lo tiene; si no, null y no se escribe la sección. */
  acceptanceCriteria: string | null
  comments: JiraComment[]
  subtasks: JiraIssueRef[]
  links: Array<{ type: string; key: string; summary: string }>
}

const KEY_RE = /^([A-Z][A-Z0-9]*)-(\d+)$/

/** `' grav-412 '` → `'GRAV-412'`. Cadena vacía si no es una clave. */
export function normalizeIssueKey(raw: string): string {
  const candidate = (raw ?? '').trim().toUpperCase()
  return KEY_RE.test(candidate) ? candidate : ''
}

/**
 * Claves presentes en el texto, **acotadas a los proyectos declarados**. Sin ese
 * filtro `UTF-8`, `SHA-256` o `CVE-2023-30533` se leerían como issues.
 * Los bordes `(?<![A-Z0-9])` / `(?![\w-])` evitan partir palabras y sufijos.
 */
export function parseIssueKeys(text: string, projectKeys: readonly string[]): string[] {
  const allowed = new Set(
    projectKeys.map(key => key.trim().toUpperCase()).filter(Boolean),
  )
  if (!allowed.size) return []

  const found: string[] = []
  const seen = new Set<string>()
  const re = /(?<![A-Z0-9])([A-Z][A-Z0-9]*)-(\d+)(?![\w-])/gi
  for (const match of (text ?? '').matchAll(re)) {
    const project = match[1].toUpperCase()
    if (!allowed.has(project)) continue
    const key = `${project}-${match[2]}`
    if (seen.has(key)) continue
    seen.add(key)
    found.push(key)
  }
  return found
}

/**
 * `refreshSeconds` a 0 desactiva el refresco: el snapshot es manual.
 * `mtimeMs` a 0 significa «no hay archivo», y eso siempre se refresca.
 */
export function isSnapshotStale(mtimeMs: number, refreshSeconds: number, nowMs: number): boolean {
  if (!mtimeMs) return true
  if (refreshSeconds <= 0) return false
  return nowMs - mtimeMs >= refreshSeconds * 1000
}
```

- [ ] **Step 4: Corre el test y verifica que pasa**

Run: `npx vitest run src/shared/__tests__/jiraIssue.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add src/shared/jiraIssue.ts src/shared/__tests__/jiraIssue.test.ts
git commit -m "feat(jira): tipos de issue y parseo de claves acotado a projectKeys"
```

---

### Task 2: El documento de la issue (auto + notes)

**Files:**
- Create: `src/shared/jiraIssueDoc.ts`
- Test: `src/shared/__tests__/jiraIssueDoc.test.ts`

**Interfaces:**
- Consumes: `JiraIssueSnapshot`, `JiraComment` de `src/shared/jiraIssue.ts` (tarea 1).
- Produces:
  - `function adfToText(node: unknown): string`
  - `function issueAutoMarkdown(issue: JiraIssueSnapshot, maxComments: number): string`
  - `function withJiraAutoBlock(raw: string, metadataLine: string, auto: string): string`

**Contexto que el implementador necesita:** la API v3 de Jira devuelve `fields.description` en
**ADF** (Atlassian Document Format), un árbol JSON — no texto. Sin `adfToText` el `.md` acaba con
`[object Object]`. Y el archivo tiene dos regiones: `iaterminal:auto`, que regenera el host, y
`iaterminal:notes`, que escriben la persona o el agente. Esta tarea es el espejo de
`withAgentResultsNotes()` (`src/shared/agentResultsDoc.ts:106`): allá se reemplaza `notes` y
sobrevive `auto`; acá se reemplaza `auto` y **sobrevive `notes`**.

- [ ] **Step 1: Escribe los tests que fallan**

Crea `src/shared/__tests__/jiraIssueDoc.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { JiraIssueSnapshot } from '../jiraIssue'
import { adfToText, issueAutoMarkdown, withJiraAutoBlock } from '../jiraIssueDoc'

const issue: JiraIssueSnapshot = {
  key: 'GRAV-412',
  summary: 'Loop chain se queda colgada si el agente B muere',
  status: 'In Progress',
  issueType: 'Bug',
  assignee: 'Rodrigo',
  priority: 'High',
  sprint: 'Sprint 34',
  updated: '2026-08-12T09:40:00.000Z',
  url: 'https://x.atlassian.net/browse/GRAV-412',
  description: 'El FIFO no libera el slot.',
  acceptanceCriteria: 'La cadena avanza aunque B muera.',
  comments: [
    { author: 'Ana', created: '2026-08-11T10:00:00.000Z', body: 'reproducido' },
    { author: 'Luis', created: '2026-08-11T11:00:00.000Z', body: 'mira loopChainFifo' },
    { author: 'Ana', created: '2026-08-11T12:00:00.000Z', body: 'confirmado' },
  ],
  subtasks: [
    { key: 'GRAV-413', summary: 'test de regresión', status: 'To Do', issueType: 'Sub-task', assignee: null },
  ],
  links: [{ type: 'blocks', key: 'GRAV-400', summary: 'Refactor del orquestador' }],
}

describe('adfToText', () => {
  it('aplana párrafos y texto', () => {
    const adf = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Hola ' }, { type: 'text', text: 'mundo' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Segundo' }] },
      ],
    }
    expect(adfToText(adf)).toBe('Hola mundo\n\nSegundo')
  })

  it('los ítems de lista salen como viñetas', () => {
    const adf = {
      type: 'doc',
      content: [{
        type: 'bulletList',
        content: [
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'uno' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'dos' }] }] },
        ],
      }],
    }
    expect(adfToText(adf)).toBe('- uno\n- dos')
  })

  it('una cadena plana (API v2 o campo ya renderizado) pasa tal cual', () => {
    expect(adfToText('texto plano')).toBe('texto plano')
  })

  it('null o basura devuelve cadena vacía, no una excepción', () => {
    expect(adfToText(null)).toBe('')
    expect(adfToText(42)).toBe('')
  })
})

describe('issueAutoMarkdown', () => {
  it('la cabecera lleva clave, título, estado y fecha de actualización', () => {
    const md = issueAutoMarkdown(issue, 10)
    expect(md).toContain('## Resumen')
    expect(md).toContain('GRAV-412 · Loop chain se queda colgada si el agente B muere')
    expect(md).toContain('Estado: In Progress · Tipo: Bug · Prioridad: High')
    expect(md).toContain('Actualizada: 2026-08-12T09:40:00.000Z')
  })

  it('cada bloque es una sección `##`: son las claves que pide el modelo', () => {
    const headings = issueAutoMarkdown(issue, 10).match(/^## .+$/gm)
    expect(headings).toEqual([
      '## Resumen',
      '## Descripción',
      '## Criterios de aceptación',
      '## Comentarios',
      '## Enlaces y subtareas',
    ])
  })

  it('maxComments recorta por los más recientes', () => {
    const md = issueAutoMarkdown(issue, 2)
    expect(md).toContain('Luis')
    expect(md).toContain('confirmado')
    expect(md).not.toContain('reproducido')
  })

  it('sin criterios de aceptación no se escribe la sección vacía', () => {
    const md = issueAutoMarkdown({ ...issue, acceptanceCriteria: null }, 10)
    expect(md).not.toContain('## Criterios de aceptación')
  })
})

describe('withJiraAutoBlock', () => {
  const meta = '<!-- iaterminal:context {"id":"iaterminal:jira:grav-412","kind":"jira"} -->'

  it('sobre un archivo inexistente crea el documento completo con notes vacías', () => {
    const doc = withJiraAutoBlock('', meta, '## Resumen\nGRAV-412')
    expect(doc).toContain(meta)
    expect(doc).toContain('<!-- iaterminal:auto -->')
    expect(doc).toContain('<!-- /iaterminal:auto -->')
    expect(doc).toContain('<!-- iaterminal:notes -->')
  })

  it('AL REFRESCAR, las notas sobreviven intactas', () => {
    const first = withJiraAutoBlock('', meta, '## Resumen\nviejo')
    const annotated = first.replace(
      '<!-- iaterminal:notes -->\n',
      '<!-- iaterminal:notes -->\nla carrera está en loopChainFifo\n',
    )
    const refreshed = withJiraAutoBlock(annotated, meta, '## Resumen\nnuevo')
    expect(refreshed).toContain('la carrera está en loopChainFifo')
    expect(refreshed).toContain('nuevo')
    expect(refreshed).not.toContain('viejo')
  })

  it('no duplica la región auto al refrescar dos veces', () => {
    let doc = withJiraAutoBlock('', meta, '## Resumen\nuno')
    doc = withJiraAutoBlock(doc, meta, '## Resumen\ndos')
    doc = withJiraAutoBlock(doc, meta, '## Resumen\ntres')
    expect(doc.match(/<!-- iaterminal:auto -->/g)).toHaveLength(1)
    expect(doc.match(/<!-- iaterminal:notes -->/g)).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Corre el test y verifica que falla**

Run: `npx vitest run src/shared/__tests__/jiraIssueDoc.test.ts`
Expected: FAIL — `Failed to resolve import "../jiraIssueDoc"`.

- [ ] **Step 3: Escribe la implementación mínima**

Crea `src/shared/jiraIssueDoc.ts`:

```ts
/**
 * El `.md` de una issue: cómo se escribe y cómo se refresca sin pisar las notas.
 *
 * Dos regiones, igual que `results/<agent>.md`: `iaterminal:auto` la regenera el
 * host desde Jira, `iaterminal:notes` la escriben la persona o el agente. Este
 * módulo es el espejo de `withAgentResultsNotes()`: allá sobrevive `auto`, acá
 * sobrevive `notes`.
 */

import { AUTO_END, AUTO_START, NOTES_END, NOTES_START } from './contextSections'
import type { JiraIssueSnapshot } from './jiraIssue'

const AUTO_RE = /<!--\s*iaterminal:auto\s*-->[\s\S]*?<!--\s*\/iaterminal:auto\s*-->/
const NOTES_PLACEHOLDER = '(no annotations yet)'

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null

/**
 * ADF (Atlassian Document Format) → texto. La API v3 devuelve `description` y
 * los comentarios como árbol JSON; sin esto el `.md` acabaría con `[object Object]`.
 * Solo se aplanan los nodos que aparecen en un ticket normal.
 */
export function adfToText(node: unknown): string {
  if (typeof node === 'string') return node
  const record = asRecord(node)
  if (!record) return ''

  const children = Array.isArray(record.content) ? record.content : []
  const join = (separator: string): string =>
    children.map(child => adfToText(child)).filter(Boolean).join(separator)

  switch (record.type) {
    case 'text':
      return typeof record.text === 'string' ? record.text : ''
    case 'hardBreak':
      return '\n'
    case 'paragraph':
    case 'heading':
      return join('')
    case 'listItem':
      return `- ${join(' ')}`
    case 'bulletList':
    case 'orderedList':
      return join('\n')
    case 'codeBlock':
      return `\`\`\`\n${join('')}\n\`\`\``
    default:
      return join('\n\n')
  }
}

function commentBlock(issue: JiraIssueSnapshot, maxComments: number): string {
  // Los más recientes: Jira los devuelve en orden ascendente.
  const recent = maxComments > 0 ? issue.comments.slice(-maxComments) : issue.comments
  if (!recent.length) return ''
  const body = recent
    .map(comment => `**${comment.author}** · ${comment.created}\n${comment.body.trim()}`)
    .join('\n\n')
  return `## Comentarios\n${body}`
}

function linksBlock(issue: JiraIssueSnapshot): string {
  const lines = [
    ...issue.subtasks.map(sub => `- Subtarea \`${sub.key}\` · ${sub.summary} · ${sub.status}`),
    ...issue.links.map(link => `- ${link.type} \`${link.key}\` · ${link.summary}`),
    `- Jira: ${issue.url}`,
  ]
  return `## Enlaces y subtareas\n${lines.join('\n')}`
}

/**
 * El cuerpo de `iaterminal:auto`. Cada `##` es una clave de sección pedible por
 * `need-sections`, así que el corte por bloques es la unidad de presupuesto.
 */
export function issueAutoMarkdown(issue: JiraIssueSnapshot, maxComments: number): string {
  const meta = [
    `Estado: ${issue.status}`,
    `Tipo: ${issue.issueType}`,
    ...(issue.priority ? [`Prioridad: ${issue.priority}`] : []),
  ].join(' · ')
  const people = [
    `Asignada a: ${issue.assignee ?? 'sin asignar'}`,
    ...(issue.sprint ? [`Sprint: ${issue.sprint}`] : []),
    `Actualizada: ${issue.updated}`,
  ].join(' · ')

  const blocks = [
    `## Resumen\n${issue.key} · ${issue.summary}\n${meta}\n${people}`,
    `## Descripción\n${issue.description.trim() || '(sin descripción)'}`,
    ...(issue.acceptanceCriteria?.trim()
      ? [`## Criterios de aceptación\n${issue.acceptanceCriteria.trim()}`]
      : []),
    commentBlock(issue, maxComments),
    linksBlock(issue),
  ]
  return blocks.filter(Boolean).join('\n\n')
}

/**
 * Reemplaza SOLO la región `auto`. Si el archivo no existe todavía, escribe el
 * documento completo con una región `notes` vacía lista para anotar.
 */
export function withJiraAutoBlock(raw: string, metadataLine: string, auto: string): string {
  const region = `${AUTO_START}\n${auto.trim()}\n${AUTO_END}`
  if (raw.trim() && AUTO_RE.test(raw)) return raw.replace(AUTO_RE, region)
  return [
    metadataLine,
    region,
    '',
    `${NOTES_START}\n${NOTES_PLACEHOLDER}\n${NOTES_END}`,
    '',
  ].join('\n')
}
```

- [ ] **Step 4: Corre el test y verifica que pasa**

Run: `npx vitest run src/shared/__tests__/jiraIssueDoc.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add src/shared/jiraIssueDoc.ts src/shared/__tests__/jiraIssueDoc.test.ts
git commit -m "feat(jira): documento de la issue con region auto refrescable y notes persistente"
```

---

### Task 3: Configuración del proyecto y credenciales

**Files:**
- Create: `src/shared/jiraConfig.ts`
- Create: `electron/jiraConfig.ts`
- Test: `src/shared/__tests__/jiraConfig.test.ts`
- Test: `electron/__tests__/jiraConfig.test.ts`

**Interfaces:**
- Consumes: `projectDirPath` de `electron/projectDir.ts`.
- Produces:
  - `interface JiraProjectConfig { site: string; projectKeys: string[]; defaultJql: string; refreshSeconds: number; maxComments: number }`
  - `function parseJiraConfig(raw: unknown): JiraProjectConfig | null` (`src/shared/jiraConfig.ts`)
  - `interface JiraCredentials { site: string; email: string; apiToken: string }`
  - `function readJiraConfig(cwd: string): JiraProjectConfig | null` (`electron/jiraConfig.ts`)
  - `function writeJiraConfig(cwd: string, config: JiraProjectConfig): void`
  - `function readJiraCredentials(site: string): JiraCredentials | null`
  - `function writeJiraCredentials(credentials: JiraCredentials): void`

- [ ] **Step 1: Escribe el test puro que falla**

Crea `src/shared/__tests__/jiraConfig.test.ts`. Lo importante: un `site` inválido invalida todo el
config — sin sitio no hay nada que llamar, y aceptarlo a medias produce URLs rotas.

```ts
import { describe, expect, it } from 'vitest'
import { parseJiraConfig } from '../jiraConfig'

describe('parseJiraConfig', () => {
  it('rellena los defaults documentados', () => {
    expect(parseJiraConfig({ site: 'https://x.atlassian.net' })).toEqual({
      site: 'https://x.atlassian.net',
      projectKeys: [],
      defaultJql: 'assignee = currentUser() AND sprint in openSprints()',
      refreshSeconds: 900,
      maxComments: 10,
    })
  })

  it('normaliza el sitio: sin barra final y en minúsculas', () => {
    expect(parseJiraConfig({ site: 'HTTPS://X.Atlassian.net/' })?.site)
      .toBe('https://x.atlassian.net')
  })

  it('las claves de proyecto se normalizan a mayúsculas y se deduplican', () => {
    expect(parseJiraConfig({ site: 'https://x.atlassian.net', projectKeys: ['grav', 'GRAV', 'cov'] })?.projectKeys)
      .toEqual(['GRAV', 'COV'])
  })

  it('sin site no hay config: null', () => {
    expect(parseJiraConfig({ projectKeys: ['GRAV'] })).toBeNull()
    expect(parseJiraConfig({ site: 'no-es-una-url' })).toBeNull()
    expect(parseJiraConfig(null)).toBeNull()
  })

  it('un site que no es https se rechaza: el token viaja en la cabecera', () => {
    expect(parseJiraConfig({ site: 'http://x.atlassian.net' })).toBeNull()
  })

  it('nunca expone un campo de credencial aunque el archivo lo traiga', () => {
    const parsed = parseJiraConfig({ site: 'https://x.atlassian.net', apiToken: 'secreto' })
    expect(JSON.stringify(parsed)).not.toContain('secreto')
  })

  it('valores fuera de rango vuelven al default', () => {
    const parsed = parseJiraConfig({ site: 'https://x.atlassian.net', refreshSeconds: -5, maxComments: 999 })
    expect(parsed?.refreshSeconds).toBe(900)
    expect(parsed?.maxComments).toBe(50)
  })
})
```

- [ ] **Step 2: Corre el test y verifica que falla**

Run: `npx vitest run src/shared/__tests__/jiraConfig.test.ts`
Expected: FAIL — `Failed to resolve import "../jiraConfig"`.

- [ ] **Step 3: Escribe `src/shared/jiraConfig.ts`**

```ts
/**
 * `.gravity/jira.json`: qué sitio, qué proyectos y cada cuánto refrescar.
 *
 * Este archivo se commitea, así que **no tiene campo de credencial**: el par
 * email + API token vive cifrado con `safeStorage` (ver `electron/jiraConfig.ts`).
 * El parseo es puro porque el renderer también lo lee, para saber si debe
 * activar el picker de menciones.
 */

export interface JiraProjectConfig {
  /** Base del sitio Cloud, sin barra final. Siempre https. */
  site: string
  /** Prefijos válidos; acotan el reconocimiento de claves. */
  projectKeys: string[]
  defaultJql: string
  /** 0 desactiva el refresco automático. */
  refreshSeconds: number
  maxComments: number
}

export const DEFAULT_JIRA_JQL = 'assignee = currentUser() AND sprint in openSprints()'
export const DEFAULT_REFRESH_SECONDS = 900
export const DEFAULT_MAX_COMMENTS = 10
const MAX_COMMENTS_CAP = 50

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null

function normalizeSite(raw: unknown): string {
  if (typeof raw !== 'string' || !raw.trim()) return ''
  try {
    const url = new URL(raw.trim())
    // http dejaría viajar el Basic auth en claro.
    if (url.protocol !== 'https:') return ''
    return `${url.protocol}//${url.host.toLowerCase()}`
  } catch {
    return ''
  }
}

function clamp(raw: unknown, fallback: number, min: number, max: number): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return fallback
  if (raw < min || raw > max) return raw > max ? max : fallback
  return Math.round(raw)
}

export function parseJiraConfig(raw: unknown): JiraProjectConfig | null {
  const record = asRecord(raw)
  if (!record) return null
  const site = normalizeSite(record.site)
  if (!site) return null

  const keys = Array.isArray(record.projectKeys) ? record.projectKeys : []
  const projectKeys: string[] = []
  for (const entry of keys) {
    if (typeof entry !== 'string') continue
    const key = entry.trim().toUpperCase()
    if (key && !projectKeys.includes(key)) projectKeys.push(key)
  }

  return {
    site,
    projectKeys,
    defaultJql: typeof record.defaultJql === 'string' && record.defaultJql.trim()
      ? record.defaultJql.trim()
      : DEFAULT_JIRA_JQL,
    refreshSeconds: clamp(record.refreshSeconds, DEFAULT_REFRESH_SECONDS, 0, 86_400),
    maxComments: clamp(record.maxComments, DEFAULT_MAX_COMMENTS, 0, MAX_COMMENTS_CAP),
  }
}
```

- [ ] **Step 4: Corre el test y verifica que pasa**

Run: `npx vitest run src/shared/__tests__/jiraConfig.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Escribe el test de disco que falla**

Crea `electron/__tests__/jiraConfig.test.ts`. Sigue el estilo del repo: directorios temporales
reales, sin mocks de `fs`.

```ts
import { describe, expect, it, vi } from 'vitest'
import { mkdtempSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

vi.mock('electron', () => ({
  app: { getPath: () => tmpdir() },
  safeStorage: {
    isEncryptionAvailable: () => false,
    encryptString: (value: string) => Buffer.from(value),
    decryptString: (buffer: Buffer) => buffer.toString(),
  },
}))

const { readJiraConfig, writeJiraConfig } = await import('../jiraConfig')

describe('readJiraConfig', () => {
  it('sin archivo devuelve null, no lanza', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gravity-jira-'))
    expect(readJiraConfig(dir)).toBeNull()
  })

  it('ida y vuelta por disco', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gravity-jira-'))
    writeJiraConfig(dir, {
      site: 'https://x.atlassian.net',
      projectKeys: ['GRAV'],
      defaultJql: 'project = GRAV',
      refreshSeconds: 300,
      maxComments: 5,
    })
    expect(readJiraConfig(dir)?.projectKeys).toEqual(['GRAV'])
    expect(readJiraConfig(dir)?.refreshSeconds).toBe(300)
  })

  it('el archivo escrito no contiene ningún campo de credencial', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gravity-jira-'))
    writeJiraConfig(dir, {
      site: 'https://x.atlassian.net',
      projectKeys: [],
      defaultJql: 'project = GRAV',
      refreshSeconds: 900,
      maxComments: 10,
    })
    const raw = readFileSync(join(dir, '.gravity', 'jira.json'), 'utf8')
    expect(raw).not.toMatch(/token|password|secret/i)
  })

  it('un JSON corrupto devuelve null en vez de romper el turno', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gravity-jira-'))
    writeJiraConfig(dir, {
      site: 'https://x.atlassian.net',
      projectKeys: [],
      defaultJql: 'x',
      refreshSeconds: 900,
      maxComments: 10,
    })
    const { writeFileSync } = require('fs') as typeof import('fs')
    writeFileSync(join(dir, '.gravity', 'jira.json'), '{ roto', 'utf8')
    expect(readJiraConfig(dir)).toBeNull()
  })
})
```

- [ ] **Step 6: Corre el test y verifica que falla**

Run: `npx vitest run electron/__tests__/jiraConfig.test.ts`
Expected: FAIL — `Failed to resolve import "../jiraConfig"`.

- [ ] **Step 7: Escribe `electron/jiraConfig.ts`**

```ts
/**
 * Disco y credenciales de Jira.
 *
 * `.gravity/jira.json` es del proyecto y se commitea. El par email + API token
 * es del usuario y va cifrado con `safeStorage` en userData, indexado por sitio
 * — mismo patrón que `electron/covenantSession.ts`.
 */

import { app, safeStorage } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { parseJiraConfig, type JiraProjectConfig } from '../src/shared/jiraConfig'
import { projectDirPath } from './projectDir'

export interface JiraCredentials {
  site: string
  email: string
  apiToken: string
}

const CONFIG_FILE = 'jira.json'
const STORE_FILE = 'jira-credentials.json'

function configPath(cwd: string): string {
  return projectDirPath(cwd, CONFIG_FILE)
}

export function readJiraConfig(cwd: string): JiraProjectConfig | null {
  const path = configPath(cwd)
  if (!existsSync(path)) return null
  try {
    return parseJiraConfig(JSON.parse(readFileSync(path, 'utf8')))
  } catch {
    // Un JSON roto no puede tumbar el turno: se comporta como «sin Jira».
    return null
  }
}

export function writeJiraConfig(cwd: string, config: JiraProjectConfig): void {
  const path = configPath(cwd)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
}

function storePath(): string {
  return join(app.getPath('userData'), STORE_FILE)
}

type StoredCredentials = Record<string, { email: string; apiToken: string }>

function readStore(): StoredCredentials {
  const path = storePath()
  if (!existsSync(path)) return {}
  try {
    const raw = readFileSync(path, 'utf8')
    const payload = JSON.parse(raw) as { encrypted?: string; plain?: StoredCredentials }
    if (payload.encrypted && safeStorage.isEncryptionAvailable()) {
      return JSON.parse(safeStorage.decryptString(Buffer.from(payload.encrypted, 'base64')))
    }
    return payload.plain ?? {}
  } catch {
    return {}
  }
}

function writeStore(store: StoredCredentials): void {
  const json = JSON.stringify(store)
  const payload = safeStorage.isEncryptionAvailable()
    ? { encrypted: safeStorage.encryptString(json).toString('base64') }
    : { plain: store }
  writeFileSync(storePath(), JSON.stringify(payload), 'utf8')
}

export function readJiraCredentials(site: string): JiraCredentials | null {
  const entry = readStore()[site]
  if (!entry?.email || !entry.apiToken) return null
  return { site, email: entry.email, apiToken: entry.apiToken }
}

export function writeJiraCredentials(credentials: JiraCredentials): void {
  const store = readStore()
  store[credentials.site] = { email: credentials.email, apiToken: credentials.apiToken }
  writeStore(store)
}
```

- [ ] **Step 8: Corre los dos tests y verifica que pasan**

Run: `npx vitest run src/shared/__tests__/jiraConfig.test.ts electron/__tests__/jiraConfig.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 9: Commit**

```bash
git add src/shared/jiraConfig.ts electron/jiraConfig.ts src/shared/__tests__/jiraConfig.test.ts electron/__tests__/jiraConfig.test.ts
git commit -m "feat(jira): jira.json del proyecto y credenciales cifradas por sitio"
```

---

### Task 4: Cliente REST de Jira Cloud

**Files:**
- Create: `electron/jiraClient.ts`
- Test: `electron/__tests__/jiraClient.test.ts`

**Interfaces:**
- Consumes: `JiraCredentials` (tarea 3); `JiraIssueRef`, `JiraIssueSnapshot` (tarea 1); `adfToText` (tarea 2).
- Produces:
  - `function jiraMyself(cred: JiraCredentials): Promise<{ ok: boolean; displayName?: string; error?: string }>`
  - `function jiraSearch(cred: JiraCredentials, jql: string, max?: number): Promise<JiraIssueRef[]>`
  - `function jiraGetIssue(cred: JiraCredentials, key: string, maxComments: number): Promise<JiraIssueSnapshot>`
  - `function clearJiraCache(): void`

**Contexto:** tres endpoints de la API v3, auth `Basic base64(email:apiToken)`, timeout 10 s con
`AbortSignal.timeout(10_000)`. La caché por clave con TTL de 60 s existe por una razón concreta: en
el plano agéntico seis agentes pueden llevar la misma issue, y sin caché eso son seis GET por turno.

- [ ] **Step 1: Escribe los tests que fallan**

Crea `electron/__tests__/jiraClient.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearJiraCache, jiraGetIssue, jiraMyself, jiraSearch } from '../jiraClient'

const cred = { site: 'https://x.atlassian.net', email: 'a@b.c', apiToken: 'tok' }

const issuePayload = {
  key: 'GRAV-412',
  fields: {
    summary: 'Loop chain colgada',
    status: { name: 'In Progress' },
    issuetype: { name: 'Bug' },
    assignee: { displayName: 'Rodrigo' },
    priority: { name: 'High' },
    updated: '2026-08-12T09:40:00.000Z',
    description: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'El FIFO no libera.' }] }] },
    comment: {
      comments: [
        { author: { displayName: 'Ana' }, created: '2026-08-11T10:00:00.000Z', body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'reproducido' }] }] } },
      ],
    },
    subtasks: [],
    issuelinks: [],
  },
}

function stubFetch(handler: (url: string, init: RequestInit) => unknown): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
    const body = handler(url, init)
    return { ok: true, status: 200, json: async () => body } as unknown as Response
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

beforeEach(() => { clearJiraCache() })
afterEach(() => { vi.unstubAllGlobals() })

describe('jiraMyself', () => {
  it('manda Basic auth con email:token en base64', async () => {
    const fetchMock = stubFetch(() => ({ displayName: 'Rodrigo' }))
    const result = await jiraMyself(cred)
    expect(result).toEqual({ ok: true, displayName: 'Rodrigo' })
    const init = fetchMock.mock.calls[0][1] as RequestInit
    const auth = (init.headers as Record<string, string>).Authorization
    expect(auth).toBe(`Basic ${Buffer.from('a@b.c:tok').toString('base64')}`)
  })

  it('un 401 devuelve un error legible, no una excepción', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) } as unknown as Response)))
    const result = await jiraMyself(cred)
    expect(result.ok).toBe(false)
    expect(result.error).toContain('401')
  })

  it('una red caída devuelve error, no rechaza la promesa', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ENOTFOUND') }))
    await expect(jiraMyself(cred)).resolves.toMatchObject({ ok: false })
  })
})

describe('jiraSearch', () => {
  it('mapea la respuesta a JiraIssueRef', async () => {
    stubFetch(() => ({ issues: [issuePayload] }))
    const refs = await jiraSearch(cred, 'project = GRAV', 8)
    expect(refs).toEqual([{
      key: 'GRAV-412',
      summary: 'Loop chain colgada',
      status: 'In Progress',
      issueType: 'Bug',
      assignee: 'Rodrigo',
    }])
  })

  it('escapa el JQL en la query string', async () => {
    const fetchMock = stubFetch(() => ({ issues: [] }))
    await jiraSearch(cred, 'summary ~ "a b"', 8)
    expect(fetchMock.mock.calls[0][0]).toContain('jql=summary+%7E+%22a+b%22')
  })

  it('una respuesta sin issues devuelve lista vacía', async () => {
    stubFetch(() => ({}))
    await expect(jiraSearch(cred, 'x', 8)).resolves.toEqual([])
  })
})

describe('jiraGetIssue', () => {
  it('aplana el ADF de descripción y comentarios', async () => {
    stubFetch(() => issuePayload)
    const issue = await jiraGetIssue(cred, 'GRAV-412', 10)
    expect(issue.description).toBe('El FIFO no libera.')
    expect(issue.comments[0]).toEqual({
      author: 'Ana',
      created: '2026-08-11T10:00:00.000Z',
      body: 'reproducido',
    })
    expect(issue.url).toBe('https://x.atlassian.net/browse/GRAV-412')
  })

  it('sin asignado no inventa un nombre', async () => {
    stubFetch(() => ({ ...issuePayload, fields: { ...issuePayload.fields, assignee: null } }))
    expect((await jiraGetIssue(cred, 'GRAV-412', 10)).assignee).toBeNull()
  })

  it('la segunda llamada dentro del TTL no vuelve a la red', async () => {
    const fetchMock = stubFetch(() => issuePayload)
    await jiraGetIssue(cred, 'GRAV-412', 10)
    await jiraGetIssue(cred, 'GRAV-412', 10)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('un 404 lanza un error con la clave, para que el refresco lo registre', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) } as unknown as Response)))
    await expect(jiraGetIssue(cred, 'GRAV-999', 10)).rejects.toThrow(/GRAV-999/)
  })
})
```

- [ ] **Step 2: Corre el test y verifica que falla**

Run: `npx vitest run electron/__tests__/jiraClient.test.ts`
Expected: FAIL — `Failed to resolve import "../jiraClient"`.

- [ ] **Step 3: Escribe la implementación mínima**

Crea `electron/jiraClient.ts`:

```ts
/**
 * Cliente REST de Jira Cloud (API v3). Tres endpoints, `fetch` nativo, sin SDK.
 *
 * Por qué no el MCP de Atlassian desde acá: añadiría una dependencia, el flujo
 * OAuth del server remoto, y devuelve texto pensado para un modelo en vez de un
 * objeto que la UI pueda pintar. El MCP sigue siendo el camino del agente para
 * escribir; este es el de la app para leer.
 */

import { adfToText } from '../src/shared/jiraIssueDoc'
import type { JiraComment, JiraIssueRef, JiraIssueSnapshot } from '../src/shared/jiraIssue'
import type { JiraCredentials } from './jiraConfig'

const TIMEOUT_MS = 10_000
/** Seis agentes con la misma issue en un turno son un GET, no seis. */
const CACHE_TTL_MS = 60_000

const cache = new Map<string, { at: number; issue: JiraIssueSnapshot }>()

export function clearJiraCache(): void {
  cache.clear()
}

function authHeaders(cred: JiraCredentials): Record<string, string> {
  const basic = Buffer.from(`${cred.email}:${cred.apiToken}`).toString('base64')
  return { Authorization: `Basic ${basic}`, Accept: 'application/json' }
}

async function getJson(cred: JiraCredentials, path: string): Promise<unknown> {
  const response = await fetch(`${cred.site}${path}`, {
    headers: authHeaders(cred),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`Jira ${response.status}`)
  return response.json()
}

const asRecord = (value: unknown): Record<string, any> =>
  (value && typeof value === 'object' ? value : {}) as Record<string, any>

function refFrom(raw: unknown): JiraIssueRef {
  const issue = asRecord(raw)
  const fields = asRecord(issue.fields)
  return {
    key: String(issue.key ?? ''),
    summary: String(fields.summary ?? ''),
    status: String(asRecord(fields.status).name ?? ''),
    issueType: String(asRecord(fields.issuetype).name ?? ''),
    assignee: fields.assignee ? String(asRecord(fields.assignee).displayName ?? '') || null : null,
  }
}

export async function jiraMyself(
  cred: JiraCredentials,
): Promise<{ ok: boolean; displayName?: string; error?: string }> {
  try {
    const me = asRecord(await getJson(cred, '/rest/api/3/myself'))
    return { ok: true, displayName: String(me.displayName ?? '') }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export async function jiraSearch(
  cred: JiraCredentials,
  jql: string,
  max = 8,
): Promise<JiraIssueRef[]> {
  const query = new URLSearchParams({
    jql,
    maxResults: String(max),
    fields: 'summary,status,issuetype,assignee',
  })
  const payload = asRecord(await getJson(cred, `/rest/api/3/search/jql?${query}`))
  const issues = Array.isArray(payload.issues) ? payload.issues : []
  return issues.map(refFrom)
}

function sprintNameFrom(fields: Record<string, any>): string | null {
  // El sprint es un campo custom cuyo id varía por instancia; se busca el que
  // traiga objetos con `name` y `state`, que es la forma estable del agile field.
  for (const value of Object.values(fields)) {
    if (!Array.isArray(value)) continue
    const active = value.find(entry => asRecord(entry).state === 'active')
    const name = asRecord(active ?? value[value.length - 1]).name
    if (typeof name === 'string' && name) return name
  }
  return null
}

export async function jiraGetIssue(
  cred: JiraCredentials,
  key: string,
  maxComments: number,
): Promise<JiraIssueSnapshot> {
  const cacheKey = `${cred.site}:${key}`
  const hit = cache.get(cacheKey)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.issue

  let payload: Record<string, any>
  try {
    payload = asRecord(await getJson(cred, `/rest/api/3/issue/${encodeURIComponent(key)}`))
  } catch (error) {
    throw new Error(`${key}: ${error instanceof Error ? error.message : String(error)}`)
  }

  const fields = asRecord(payload.fields)
  const rawComments = Array.isArray(asRecord(fields.comment).comments)
    ? asRecord(fields.comment).comments as unknown[]
    : []
  const comments: JiraComment[] = rawComments.map(raw => {
    const comment = asRecord(raw)
    return {
      author: String(asRecord(comment.author).displayName ?? ''),
      created: String(comment.created ?? ''),
      body: adfToText(comment.body),
    }
  })

  const issue: JiraIssueSnapshot = {
    ...refFrom(payload),
    priority: fields.priority ? String(asRecord(fields.priority).name ?? '') || null : null,
    sprint: sprintNameFrom(fields),
    updated: String(fields.updated ?? ''),
    url: `${cred.site}/browse/${key}`,
    description: adfToText(fields.description),
    acceptanceCriteria: null,
    comments: maxComments > 0 ? comments.slice(-maxComments) : comments,
    subtasks: (Array.isArray(fields.subtasks) ? fields.subtasks : []).map(refFrom),
    links: (Array.isArray(fields.issuelinks) ? fields.issuelinks : []).map(raw => {
      const link = asRecord(raw)
      const target = asRecord(link.outwardIssue ?? link.inwardIssue)
      return {
        type: String(asRecord(link.type).name ?? 'relates'),
        key: String(target.key ?? ''),
        summary: String(asRecord(target.fields).summary ?? ''),
      }
    }).filter(link => link.key),
  }

  cache.set(cacheKey, { at: Date.now(), issue })
  return issue
}
```

> `acceptanceCriteria` queda en `null`: el campo es custom y su id cambia por instancia. Cablearlo
> exigiría un `GET /field` y un ajuste más; se deja para cuando alguien lo pida. La sección no se
> escribe si es `null` (ya cubierto por el test de la tarea 2).

- [ ] **Step 4: Corre el test y verifica que pasa**

Run: `npx vitest run electron/__tests__/jiraClient.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add electron/jiraClient.ts electron/__tests__/jiraClient.test.ts
git commit -m "feat(jira): cliente REST v3 con basic auth, timeout y cache por issue"
```

---

### Task 5: El kind `jira` en el pipeline de contextos

**Files:**
- Modify: `src/shared/tabContext.ts`
- Modify: `src/shared/tabContextAppearance.ts:143-171`
- Modify: `src/renderer/agent/tabContextKindIcons.ts:9-22`
- Modify: `electron/tabContextBuild.ts:529-542` (`contextFilePath`), `materializeTabContext`, descubrimiento
- Test: `src/shared/__tests__/tabContextJira.test.ts`
- Test: `electron/__tests__/tabContextBuildJira.test.ts`

**Interfaces:**
- Consumes: nada de tareas previas (el kind es independiente del cliente).
- Produces:
  - `'jira'` en `TabContextKind`, `HOST_CONTEXT_KINDS`, `CREATABLE_CONTEXT_KINDS`, `ALL_CONTEXT_KINDS`
  - `CanonicalContextOptions.issueKey?: string`
  - `TabContext.issueKey?: string`
  - `canonicalContextId('jira', { issueKey })` → `iaterminal:jira:grav-412`
  - `canonicalContextFileName('jira', { issueKey })` → `jira/GRAV-412.md`

**Contexto:** `agentResult` ya vive en un subdirectorio (`results/<agent>.md`) con una rama
dedicada en `contextFilePath` (`electron/tabContextBuild.ts:531`) y en `canonicalContextFileName`
(`src/shared/tabContext.ts:141`). `jira` copia ese patrón exacto. **El kind va en
`HOST_CONTEXT_KINDS`**: lo materializa el host, no una persona.

- [ ] **Step 1: Escribe los tests que fallan**

Crea `src/shared/__tests__/tabContextJira.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  ALL_CONTEXT_KINDS,
  CREATABLE_CONTEXT_KINDS,
  HOST_CONTEXT_KINDS,
  canonicalContextFileName,
  canonicalContextId,
  canonicalContextName,
} from '../tabContext'
import { defaultIconForKind } from '../tabContextAppearance'

describe('kind jira', () => {
  it('está en los tres arrays que lo hacen visible y materializable', () => {
    expect(HOST_CONTEXT_KINDS).toContain('jira')
    expect(CREATABLE_CONTEXT_KINDS).toContain('jira')
    expect(ALL_CONTEXT_KINDS).toContain('jira')
  })

  it('el id canónico se deriva de la clave, en minúsculas', () => {
    expect(canonicalContextId('jira', { issueKey: 'GRAV-412' })).toBe('iaterminal:jira:grav-412')
  })

  it('el archivo vive bajo jira/, como results/ para agentResult', () => {
    expect(canonicalContextFileName('jira', { issueKey: 'GRAV-412' })).toBe('jira/GRAV-412.md')
  })

  it('sin clave no revienta: cae a un stem genérico', () => {
    expect(canonicalContextFileName('jira', {})).toBe('jira/issue.md')
  })

  it('el nombre visible es la clave', () => {
    expect(canonicalContextName('jira', { issueKey: 'GRAV-412' })).toBe('GRAV-412')
  })

  it('el icono por defecto es el de Jira, que ya existe en el kit', () => {
    expect(defaultIconForKind('jira')).toBe('jira')
  })
})
```

Crea `electron/__tests__/tabContextBuildJira.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { materializeTabContext } from '../tabContextBuild'
import type { TabContext } from '../../src/shared/tabContext'

const context: TabContext = {
  id: 'iaterminal:jira:grav-412',
  name: 'GRAV-412',
  fileName: 'jira/GRAV-412.md',
  kind: 'jira',
  issueKey: 'GRAV-412',
}

function projectWithIssue(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'gravity-jira-ctx-'))
  mkdirSync(join(dir, '.gravity', 'jira'), { recursive: true })
  writeFileSync(join(dir, '.gravity', 'jira', 'GRAV-412.md'), body, 'utf8')
  return dir
}

describe('materializeTabContext con kind jira', () => {
  it('lee el archivo del disco tal cual: no llama a nadie', () => {
    const dir = projectWithIssue('<!-- iaterminal:auto -->\n## Resumen\nGRAV-412\n<!-- /iaterminal:auto -->')
    const result = materializeTabContext(context, dir)
    expect(result.ok).toBe(true)
    expect(result.content).toContain('## Resumen')
    expect(result.filePath).toBe(join(dir, '.gravity', 'jira', 'GRAV-412.md'))
  })

  it('sin snapshot todavía devuelve ok:false, no una excepción', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gravity-jira-ctx-'))
    expect(materializeTabContext(context, dir).ok).toBe(false)
  })
})
```

- [ ] **Step 2: Corre los tests y verifica que fallan**

Run: `npx vitest run src/shared/__tests__/tabContextJira.test.ts electron/__tests__/tabContextBuildJira.test.ts`
Expected: FAIL — `'jira'` no es asignable a `TabContextKind`, y `materializeTabContext` no conoce la rama.

- [ ] **Step 3: Añade el kind en `src/shared/tabContext.ts`**

En los cuatro arrays del principio del archivo, añade `'jira'`:

```ts
export type TabContextKind =
  | 'folderTree'
  // …
  | 'agentResult'
  | 'skill'
  | 'jira'

export const HOST_CONTEXT_KINDS: readonly TabContextKind[] = [
  'folderTree', 'files', 'symbols', 'git', 'deps', 'readme', 'changelog', 'mcp', 'spreadsheet',
  'jira',
] as const

export const CREATABLE_CONTEXT_KINDS: readonly TabContextKind[] = [
  'folderTree', 'files', 'symbols', 'notes', 'git', 'deps', 'readme', 'changelog', 'mcp', 'spreadsheet',
  'skill', 'jira',
] as const

export const ALL_CONTEXT_KINDS: readonly TabContextKind[] = [
  'folderTree', 'files', 'symbols', 'notes', 'git', 'deps', 'readme', 'changelog', 'mcp', 'spreadsheet',
  'agentResult', 'skill', 'jira',
] as const
```

En `CanonicalContextOptions` añade el campo:

```ts
export interface CanonicalContextOptions {
  rootPath?: string
  fileStem?: string
  agentId?: string
  name?: string
  /** Clave de la issue (`GRAV-412`) para el kind `jira`. */
  issueKey?: string
}
```

En `defaultCreatableStem`, antes del `default`:

```ts
    case 'jira':
      return (options.issueKey ?? '').trim().toLowerCase() || 'issue'
```

En `canonicalContextFileName`, junto a la rama de `agentResult`:

```ts
  if (kind === 'jira') {
    const issueKey = (options.issueKey ?? '').trim().toUpperCase() || 'ISSUE'
    return `jira/${normalizeContextFileName(issueKey, 'issue')}`
  }
```

En `canonicalContextName`, dentro del `switch`:

```ts
    case 'jira':
      return (options.issueKey ?? '').trim().toUpperCase() || 'Jira issue'
```

Y en la interfaz `TabContext`:

```ts
  /** Clave de la issue para el kind `jira`; la usa el refresco. */
  issueKey?: string
  /** Override por contexto del refresco de `jira.json`; 0 lo desactiva. */
  refreshSeconds?: number
```

- [ ] **Step 4: Añade la cara visual**

En `src/shared/tabContextAppearance.ts`, `KIND_DEFAULT_ICON` y `KIND_DEFAULT_COLOR`:

```ts
  skill: 'sparkles',
  jira: 'jira',
```

```ts
  skill: '#e879f9',
  jira: '#2684ff',
```

En `src/renderer/agent/tabContextKindIcons.ts`, `KIND_ICONS`:

```ts
  skill: 'sparkles',
  jira: 'jira',
```

- [ ] **Step 5: Añade la rama en `electron/tabContextBuild.ts`**

En `contextFilePath` (`:529`), después de la rama de `agentResult`:

```ts
  if (context.kind === 'jira') {
    const issueKey = (context.issueKey || basename(context.fileName || context.name, '.md'))
      .trim()
      .toUpperCase()
    return join(dir, 'jira', normalizeContextFileName(issueKey, 'issue'))
  }
```

En `materializeTabContext`, junto a las ramas que solo leen disco (misma forma que la rama de
`agentResult`), antes del camino genérico:

```ts
    if (normalizedInput.kind === 'jira') {
      // El snapshot lo escribe `refreshStaleJiraContexts` antes del turno; acá
      // solo se lee, para que la cadena siga siendo síncrona.
      const filePath = contextFilePath(normalizedInput, cwd)
      if (!existsSync(filePath)) {
        return { ok: false, content: '', error: `Sin snapshot de ${normalizedInput.issueKey ?? 'la issue'}.` }
      }
      return { ok: true, content: readFileSync(filePath, 'utf8'), filePath }
    }
```

En el descubrimiento (`:878`, donde se recorre `results/`), añade el mismo recorrido para `jira/`
de modo que las issues ya materializadas aparezcan en el pool:

```ts
    const jiraDir = join(dir, 'jira')
    if (existsSync(jiraDir) && statSync(jiraDir).isDirectory()) {
      for (const entry of readdirSync(jiraDir, { withFileTypes: true })
        .filter(item => item.isFile() && item.name.toLowerCase().endsWith('.md'))) {
        discovered.push(`jira/${normalizeContextFileName(entry.name)}`)
      }
    }
```

> Lee las líneas 870-900 antes de editar: el nombre real del acumulador (`discovered` arriba) y la
> forma exacta del push deben copiarse de la rama de `results/`, no inventarse.

- [ ] **Step 6: Corre los tests y verifica que pasan**

Run: `npx vitest run src/shared/__tests__/tabContextJira.test.ts electron/__tests__/tabContextBuildJira.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 7: Corre la suite completa — este cambio toca `Record<TabContextKind, …>`**

Run: `npm test`
Expected: verde. Los `Record<TabContextKind, X>` que falten dan error de tipo, no de test; corre
también `npx tsc -b` y confirma que sigue en **78** errores.

- [ ] **Step 8: Commit**

```bash
git add src/shared/tabContext.ts src/shared/tabContextAppearance.ts src/renderer/agent/tabContextKindIcons.ts electron/tabContextBuild.ts src/shared/__tests__/tabContextJira.test.ts electron/__tests__/tabContextBuildJira.test.ts
git commit -m "feat(jira): kind de contexto jira materializado desde .gravity/jira/"
```

---

### Task 6: Refresco del snapshot antes del turno

**Files:**
- Create: `electron/jiraContextRefresh.ts`
- Modify: `electron/agentCliRuntime.ts:680` (exportar `resolveWorkingDirectory`), `:705` (el preámbulo)
- Modify: `src/shared/mcpCapabilityPrompt.ts`
- Modify: `electron/main.ts:1874-1922` (el handler de `AGENT_CLI_START`)
- Test: `electron/__tests__/jiraContextRefresh.test.ts`
- Test: `src/shared/__tests__/mcpCapabilityPrompt.test.ts` (añadir al existente)

**Interfaces:**
- Consumes: `readJiraConfig`, `readJiraCredentials` (tarea 3); `jiraGetIssue` (tarea 4); `issueAutoMarkdown`, `withJiraAutoBlock` (tarea 2); `isSnapshotStale` (tarea 1).
- Produces:
  - `function refreshStaleJiraContexts(contexts: readonly TabContext[], cwd: string, deps?: { fetchIssue?: typeof jiraGetIssue }): Promise<void>`
  - `export function resolveWorkingDirectory(requested: string, fallback: string): string` en `electron/agentCliRuntime.ts`
  - `function buildJiraAttachedPrompt(issueKeys: readonly string[]): string` en `src/shared/mcpCapabilityPrompt.ts`

**Contexto crítico — la carrera:** `startAgentTurn` hoy empieza llamando a
`stopAgentRun(request.paneId)`. Si metes un `await` antes, el turno anterior sigue vivo hasta 10 s
durante el refresco. La mitigación es llamar a `stopAgentRun(request.paneId)` **en el handler,
antes del `await`**. `startAgentTurn` volverá a llamarlo y es idempotente (sale con `if (!run) return`).

- [ ] **Step 1: Escribe los tests que fallan**

Crea `electron/__tests__/jiraContextRefresh.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, utimesSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type { TabContext } from '../../src/shared/tabContext'
import type { JiraIssueSnapshot } from '../../src/shared/jiraIssue'

vi.mock('electron', () => ({
  app: { getPath: () => tmpdir() },
  safeStorage: {
    isEncryptionAvailable: () => false,
    encryptString: (value: string) => Buffer.from(value),
    decryptString: (buffer: Buffer) => buffer.toString(),
  },
}))

const { writeJiraConfig, writeJiraCredentials } = await import('../jiraConfig')
const { refreshStaleJiraContexts } = await import('../jiraContextRefresh')

const snapshot: JiraIssueSnapshot = {
  key: 'GRAV-412',
  summary: 'nuevo título',
  status: 'Done',
  issueType: 'Bug',
  assignee: 'Rodrigo',
  priority: null,
  sprint: null,
  updated: '2026-08-12T09:40:00.000Z',
  url: 'https://x.atlassian.net/browse/GRAV-412',
  description: 'cuerpo nuevo',
  acceptanceCriteria: null,
  comments: [],
  subtasks: [],
  links: [],
}

const context: TabContext = {
  id: 'iaterminal:jira:grav-412',
  name: 'GRAV-412',
  fileName: 'jira/GRAV-412.md',
  kind: 'jira',
  issueKey: 'GRAV-412',
}

function project(): string {
  const dir = mkdtempSync(join(tmpdir(), 'gravity-jira-refresh-'))
  mkdirSync(join(dir, '.gravity', 'jira'), { recursive: true })
  writeJiraConfig(dir, {
    site: 'https://x.atlassian.net',
    projectKeys: ['GRAV'],
    defaultJql: 'project = GRAV',
    refreshSeconds: 900,
    maxComments: 10,
  })
  writeJiraCredentials({ site: 'https://x.atlassian.net', email: 'a@b.c', apiToken: 'tok' })
  return dir
}

const issuePath = (dir: string): string => join(dir, '.gravity', 'jira', 'GRAV-412.md')

describe('refreshStaleJiraContexts', () => {
  it('sin snapshot previo lo crea', async () => {
    const dir = project()
    await refreshStaleJiraContexts([context], dir, { fetchIssue: async () => snapshot })
    expect(readFileSync(issuePath(dir), 'utf8')).toContain('nuevo título')
  })

  it('un snapshot fresco no se vuelve a pedir', async () => {
    const dir = project()
    writeFileSync(issuePath(dir), '<!-- iaterminal:auto -->\n## Resumen\nviejo\n<!-- /iaterminal:auto -->', 'utf8')
    const fetchIssue = vi.fn(async () => snapshot)
    await refreshStaleJiraContexts([context], dir, { fetchIssue })
    expect(fetchIssue).not.toHaveBeenCalled()
  })

  it('un snapshot vencido se refresca y conserva las notas', async () => {
    const dir = project()
    writeFileSync(
      issuePath(dir),
      [
        '<!-- iaterminal:auto -->',
        '## Resumen',
        'viejo',
        '<!-- /iaterminal:auto -->',
        '',
        '<!-- iaterminal:notes -->',
        'la carrera está en loopChainFifo',
        '<!-- /iaterminal:notes -->',
      ].join('\n'),
      'utf8',
    )
    const old = new Date(Date.now() - 3_600_000)
    utimesSync(issuePath(dir), old, old)

    await refreshStaleJiraContexts([context], dir, { fetchIssue: async () => snapshot })

    const body = readFileSync(issuePath(dir), 'utf8')
    expect(body).toContain('nuevo título')
    expect(body).toContain('la carrera está en loopChainFifo')
    expect(body).not.toContain('viejo')
  })

  it('si Jira falla, el snapshot anterior queda intacto y no se lanza', async () => {
    const dir = project()
    writeFileSync(issuePath(dir), '<!-- iaterminal:auto -->\n## Resumen\nviejo\n<!-- /iaterminal:auto -->', 'utf8')
    const old = new Date(Date.now() - 3_600_000)
    utimesSync(issuePath(dir), old, old)

    await refreshStaleJiraContexts([context], dir, {
      fetchIssue: async () => { throw new Error('502') },
    })
    expect(readFileSync(issuePath(dir), 'utf8')).toContain('viejo')
  })

  it('sin credenciales no hace nada y no lanza', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'gravity-jira-refresh-'))
    const fetchIssue = vi.fn(async () => snapshot)
    await refreshStaleJiraContexts([context], dir, { fetchIssue })
    expect(fetchIssue).not.toHaveBeenCalled()
  })

  it('ignora los contextos que no son jira', async () => {
    const dir = project()
    const fetchIssue = vi.fn(async () => snapshot)
    await refreshStaleJiraContexts(
      [{ id: 'x', name: 'Git', fileName: 'git.md', kind: 'git' }],
      dir,
      { fetchIssue },
    )
    expect(fetchIssue).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Corre el test y verifica que falla**

Run: `npx vitest run electron/__tests__/jiraContextRefresh.test.ts`
Expected: FAIL — `Failed to resolve import "../jiraContextRefresh"`.

- [ ] **Step 3: Escribe `electron/jiraContextRefresh.ts`**

```ts
/**
 * El único paso async del feature: refrescar los snapshots vencidos ANTES de
 * componer el turno.
 *
 * Jira escribe el archivo; el pipeline de contextos sigue haciendo lo único que
 * sabe hacer, leer disco. De ahí salen dos propiedades: si Jira está caído el
 * snapshot anterior sigue sirviendo, y la caché por mtime solo invalida cuando
 * el archivo cambió de verdad.
 */

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { isSnapshotStale } from '../src/shared/jiraIssue'
import { issueAutoMarkdown, withJiraAutoBlock } from '../src/shared/jiraIssueDoc'
import { canonicalContextId, type TabContext } from '../src/shared/tabContext'
import { readJiraConfig, readJiraCredentials } from './jiraConfig'
import { jiraGetIssue } from './jiraClient'
import { projectDirPath } from './projectDir'

interface RefreshDeps {
  fetchIssue?: typeof jiraGetIssue
}

export async function refreshStaleJiraContexts(
  contexts: readonly TabContext[],
  cwd: string,
  deps: RefreshDeps = {},
): Promise<void> {
  const pending = contexts.filter(context => context.kind === 'jira' && context.issueKey)
  if (!pending.length) return

  const config = readJiraConfig(cwd)
  if (!config) return
  const credentials = readJiraCredentials(config.site)
  if (!credentials) return

  const fetchIssue = deps.fetchIssue ?? jiraGetIssue
  const now = Date.now()

  for (const context of pending) {
    const issueKey = (context.issueKey ?? '').toUpperCase()
    const filePath = projectDirPath(cwd, 'jira', `${issueKey}.md`)
    const mtimeMs = existsSync(filePath) ? statSync(filePath).mtimeMs : 0
    const refreshSeconds = context.refreshSeconds ?? config.refreshSeconds
    if (!isSnapshotStale(mtimeMs, refreshSeconds, now)) continue

    try {
      const issue = await fetchIssue(credentials, issueKey, config.maxComments)
      const metadataLine = `<!-- iaterminal:context ${JSON.stringify({
        id: canonicalContextId('jira', { issueKey }),
        kind: 'jira',
        icon: 'jira',
      })} -->`
      const previous = mtimeMs ? readFileSync(filePath, 'utf8') : ''
      const next = withJiraAutoBlock(
        previous,
        metadataLine,
        issueAutoMarkdown(issue, config.maxComments),
      )
      mkdirSync(dirname(filePath), { recursive: true })
      writeFileSync(filePath, next, 'utf8')
    } catch {
      // Jira caído o clave inexistente: el snapshot anterior sigue en disco y el
      // turno funciona igual. Nunca se propaga: esto corre en el camino del turno.
    }
  }
}
```

> Ojo: `projectDirPath(cwd, 'jira', `${issueKey}.md`)` debe coincidir byte a byte con lo que calcula
> `contextFilePath` en la tarea 5. Si divergen, el refresco escribe un archivo que nadie lee.
> El `join` importado arriba solo se usa si `projectDirPath` no acepta varios segmentos — verifica
> `electron/projectDir.ts:21`, que sí los acepta, y elimina el import sobrante.

- [ ] **Step 4: Corre el test y verifica que pasa**

Run: `npx vitest run electron/__tests__/jiraContextRefresh.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Exporta `resolveWorkingDirectory`**

En `electron/agentCliRuntime.ts:680`, cambia:

```ts
function resolveWorkingDirectory(requested: string, fallback: string): string {
```

por:

```ts
export function resolveWorkingDirectory(requested: string, fallback: string): string {
```

- [ ] **Step 6: Engancha el refresco en el handler**

En `electron/main.ts`, el handler de `IPC.AGENT_CLI_START` (`:1874`) termina hoy con
`startAgentTurn(win, request, readConfig(), app.getPath('home'))`. Sustituye esa última línea por:

```ts
    // Matar el turno anterior ANTES del await: si no, sigue vivo durante el
    // refresco. `startAgentTurn` vuelve a llamarlo y es idempotente.
    stopAgentRun(request.paneId)
    const home = app.getPath('home')
    const cwd = resolveWorkingDirectory(request.cwd ?? '', home)
    void refreshStaleJiraContexts(request.contexts ?? [], cwd)
      .finally(() => {
        if (win.isDestroyed()) return
        startAgentTurn(win, request, readConfig(), home)
      })
```

Añade los imports que falten arriba del archivo:

```ts
import { refreshStaleJiraContexts } from './jiraContextRefresh'
import { resolveWorkingDirectory, startAgentTurn, stopAgentRun } from './agentCliRuntime'
```

> `stopAgentRun` y `startAgentTurn` ya están importados; comprueba la línea de import existente y
> añade solo lo que falte en vez de duplicarla. Verifica también el nombre real del campo de cwd en
> `AgentCliStartRequest` (`src/shared/agentCliTypes.ts`) antes de escribir `request.cwd`.

- [ ] **Step 7: Escribe el test del preámbulo que falla**

Sin esto hay dos fuentes de verdad: el agente recibe la issue adjunta **y** una frase que le dice
que tiene Jira por MCP, así que la busca otra vez. Añade a
`src/shared/__tests__/mcpCapabilityPrompt.test.ts`:

```ts
import { buildJiraAttachedPrompt } from '../mcpCapabilityPrompt'

describe('buildJiraAttachedPrompt', () => {
  it('nombra las issues adjuntas y prohíbe volver a buscarlas', () => {
    const prompt = buildJiraAttachedPrompt(['GRAV-412', 'COV-7'])
    expect(prompt).toContain('GRAV-412')
    expect(prompt).toContain('COV-7')
    expect(prompt).toMatch(/do not/i)
  })

  it('sin issues adjuntas no añade nada al turno', () => {
    expect(buildJiraAttachedPrompt([])).toBe('')
  })
})
```

- [ ] **Step 8: Implementa el preámbulo**

En `src/shared/mcpCapabilityPrompt.ts` — el mismo archivo que ya afirma que el agente **sí** tiene
acceso a Jira, para que las dos frases no puedan contradecirse:

```ts
/**
 * Issues que ya vienen adjuntas como contexto. Sin esto el agente las busca por
 * MCP igualmente: el preámbulo de capacidades le dice que tiene Jira, y no sabe
 * que el snapshot ya está en su prompt.
 */
export function buildJiraAttachedPrompt(issueKeys: readonly string[]): string {
  const keys = issueKeys.map(key => key.trim()).filter(Boolean)
  if (!keys.length) return ''
  return [
    '## Jira issues attached',
    'These issues are already attached as context, with a fresh snapshot:',
    keys.map(key => `- \`${key}\``).join('\n'),
    'Do not fetch them again through MCP. Request their sections if you need more detail.',
  ].join('\n')
}
```

En `electron/agentCliRuntime.ts`, junto a `mcpCapabilityPrompt` (`:705`):

```ts
  const jiraAttachedPrompt = buildJiraAttachedPrompt(
    (Array.isArray(request.contexts) ? request.contexts : [])
      .filter(context => context.kind === 'jira' && context.issueKey)
      .map(context => context.issueKey as string),
  )
```

Y añádelo al array de bloques que `composePrompt` une, inmediatamente después de
`mcpCapabilityPrompt`. Localiza ese array leyendo el resto de la función: los bloques vacíos ya se
filtran, así que una cadena vacía no deja un hueco.

- [ ] **Step 9: Corre la suite completa**

Run: `npm test`
Expected: verde, con los 8 tests nuevos sumados.

- [ ] **Step 10: Commit**

```bash
git add electron/jiraContextRefresh.ts electron/agentCliRuntime.ts electron/main.ts src/shared/mcpCapabilityPrompt.ts electron/__tests__/jiraContextRefresh.test.ts src/shared/__tests__/mcpCapabilityPrompt.test.ts
git commit -m "feat(jira): refrescar snapshots vencidos y declarar las issues adjuntas en el turno"
```

---

### Task 7: Los tres canales IPC

**Files:**
- Modify: `src/shared/ipcChannels.ts`
- Modify: `electron/main.ts`
- Modify: `electron/preload.ts`
- Test: `electron/__tests__/jiraIpc.test.ts`

**Interfaces:**
- Consumes: `jiraMyself`, `jiraSearch` (tarea 4); `readJiraConfig`, `writeJiraConfig`, `readJiraCredentials`, `writeJiraCredentials` (tarea 3).
- Produces:
  - `IPC.JIRA_STATUS: 'jira:status'` → `(cwd: string) => Promise<{ configured: boolean; site: string; projectKeys: string[]; connected: boolean }>`
  - `IPC.JIRA_CONNECT: 'jira:connect'` → `(cwd: string, input: { site: string; email: string; apiToken: string; projectKeys: string[] }) => Promise<{ ok: boolean; displayName?: string; error?: string }>`
  - `IPC.JIRA_SEARCH: 'jira:search'` → `(cwd: string, query: string) => Promise<JiraIssueRef[]>`
  - En `window.api`: `jiraStatus`, `jiraConnect`, `jiraSearch`

> Tres canales, no cuatro: leer una issue suelta desde el renderer no hace falta — la tarjeta se
> pinta con el `JiraIssueRef` que ya trae la búsqueda, y el detalle completo se ve abriendo el `.md`
> en el preview que ya existe.

- [ ] **Step 1: Escribe el test que falla**

Crea `electron/__tests__/jiraIpc.test.ts`. Comprueba lo único que puede romperse en silencio: que
los tres canales estén declarados y expuestos en el preload.

```ts
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { IPC } from '../../src/shared/ipcChannels'

describe('canales de Jira', () => {
  it('están declarados con su prefijo', () => {
    expect(IPC.JIRA_STATUS).toBe('jira:status')
    expect(IPC.JIRA_CONNECT).toBe('jira:connect')
    expect(IPC.JIRA_SEARCH).toBe('jira:search')
  })

  it('el preload los expone: sin esto el renderer no los alcanza', () => {
    const preload = readFileSync(join(__dirname, '..', 'preload.ts'), 'utf8')
    for (const method of ['jiraStatus', 'jiraConnect', 'jiraSearch']) {
      expect(preload).toContain(`${method}:`)
    }
  })

  it('el main registra un handler por canal', () => {
    const main = readFileSync(join(__dirname, '..', 'main.ts'), 'utf8')
    for (const channel of ['JIRA_STATUS', 'JIRA_CONNECT', 'JIRA_SEARCH']) {
      expect(main).toContain(`IPC.${channel}`)
    }
  })
})
```

- [ ] **Step 2: Corre el test y verifica que falla**

Run: `npx vitest run electron/__tests__/jiraIpc.test.ts`
Expected: FAIL — `IPC.JIRA_STATUS` es `undefined`.

- [ ] **Step 3: Declara los canales**

En `src/shared/ipcChannels.ts`, junto a los demás grupos:

```ts
  JIRA_STATUS: 'jira:status',
  JIRA_CONNECT: 'jira:connect',
  JIRA_SEARCH: 'jira:search',
```

- [ ] **Step 4: Registra los handlers en `electron/main.ts`**

Imports que necesita este bloque (añádelos a los existentes, sin duplicar líneas):

```ts
import { parseJiraConfig, type JiraProjectConfig } from '../src/shared/jiraConfig'
import { normalizeIssueKey } from '../src/shared/jiraIssue'
import { jiraMyself, jiraSearch } from './jiraClient'
import {
  readJiraConfig,
  readJiraCredentials,
  writeJiraConfig,
  writeJiraCredentials,
} from './jiraConfig'
```

Junto a los otros `ipcMain.handle`:

```ts
  ipcMain.handle(IPC.JIRA_STATUS, (_event, cwd: unknown) => {
    if (typeof cwd !== 'string') return { configured: false, site: '', projectKeys: [], connected: false }
    const config = readJiraConfig(cwd)
    if (!config) return { configured: false, site: '', projectKeys: [], connected: false }
    return {
      configured: true,
      site: config.site,
      projectKeys: config.projectKeys,
      connected: Boolean(readJiraCredentials(config.site)),
    }
  })

  ipcMain.handle(IPC.JIRA_CONNECT, async (_event, cwd: unknown, input: unknown) => {
    if (typeof cwd !== 'string' || !input || typeof input !== 'object') {
      return { ok: false, error: 'Solicitud de conexión inválida.' }
    }
    const { site, email, apiToken, projectKeys } = input as Record<string, unknown>
    if (typeof site !== 'string' || typeof email !== 'string' || typeof apiToken !== 'string') {
      return { ok: false, error: 'Solicitud de conexión inválida.' }
    }
    const config = parseJiraConfig({
      site,
      projectKeys: Array.isArray(projectKeys) ? projectKeys : [],
    })
    if (!config) return { ok: false, error: 'El sitio debe ser una URL https de Atlassian.' }

    const credentials = { site: config.site, email, apiToken }
    const probe = await jiraMyself(credentials)
    if (!probe.ok) return probe
    // Solo se persiste lo que ya se probó: nada de credenciales muertas en disco.
    writeJiraCredentials(credentials)
    writeJiraConfig(cwd, config)
    return probe
  })

  ipcMain.handle(IPC.JIRA_SEARCH, async (_event, cwd: unknown, query: unknown) => {
    if (typeof cwd !== 'string' || typeof query !== 'string') return []
    const config = readJiraConfig(cwd)
    if (!config) return []
    const credentials = readJiraCredentials(config.site)
    if (!credentials) return []
    const jql = buildJiraQuickJql(query, config)
    try {
      return await jiraSearch(credentials, jql, 8)
    } catch {
      return []
    }
  })
```

Y el helper, arriba del bloque de handlers en el mismo archivo:

```ts
/**
 * Texto del picker → JQL. Una clave exacta busca esa issue; cualquier otra cosa
 * es texto libre acotado a los proyectos declarados. El `~` de Jira exige comillas,
 * y las comillas del usuario romperían el JQL, así que se eliminan.
 */
function buildJiraQuickJql(query: string, config: JiraProjectConfig): string {
  const key = normalizeIssueKey(query)
  if (key) return `key = ${key}`
  const safe = query.replace(/["\\]/g, ' ').trim()
  const scope = config.projectKeys.length
    ? `project in (${config.projectKeys.join(', ')}) AND `
    : ''
  if (!safe) return `${scope}${config.defaultJql}`.replace(/^ AND /, '')
  return `${scope}summary ~ "${safe}*" ORDER BY updated DESC`
}
```

- [ ] **Step 5: Expón los métodos en `electron/preload.ts`**

```ts
    jiraStatus: (cwd: string) => ipcRenderer.invoke(IPC.JIRA_STATUS, cwd),
    jiraConnect: (cwd: string, input: {
      site: string
      email: string
      apiToken: string
      projectKeys: string[]
    }) => ipcRenderer.invoke(IPC.JIRA_CONNECT, cwd, input),
    jiraSearch: (cwd: string, query: string) => ipcRenderer.invoke(IPC.JIRA_SEARCH, cwd, query),
```

- [ ] **Step 6: Corre el test y verifica que pasa**

Run: `npx vitest run electron/__tests__/jiraIpc.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 7: Commit**

```bash
git add src/shared/ipcChannels.ts electron/main.ts electron/preload.ts electron/__tests__/jiraIpc.test.ts
git commit -m "feat(jira): canales IPC de estado, conexion y busqueda"
```

---

### Task 8: Conexión desde Ajustes

**Files:**
- Create: `src/renderer/components/JiraConnectionField.tsx`
- Create: `src/renderer/components/JiraConnectionField.css`
- Modify: `src/renderer/components/SettingsModal.tsx` (categorías, índice de búsqueda y panel)
- Modify: `src/i18n/locales/en.ts`, `src/i18n/locales/es.ts`
- Test: `src/renderer/components/__tests__/jiraConnectionField.test.tsx`

**Interfaces:**
- Consumes: `window.api.jiraStatus`, `window.api.jiraConnect` (tarea 7).
- Produces: `const JiraConnectionField: React.FC<{ cwd: string }>`

**Contexto:** `GitHubTokenField` (`src/renderer/components/GitHubTokenField.tsx`, montado en
`SettingsModal.tsx:415`) es el precedente exacto de «credencial de un servicio externo en Ajustes».
Copia su estructura: categoría en el array de `CATEGORIES`, entrada en el índice de búsqueda de
ajustes, y una `<SettingsSection>` en el panel. **Diferencia importante:** el token de GitHub se
guarda en `config.json`; el de Jira **no** — va por `jiraConnect`, que lo cifra. No lo añadas a
`configSchema.ts`.

- [ ] **Step 1: Escribe el test que falla**

Crea `src/renderer/components/__tests__/jiraConnectionField.test.tsx`:

```tsx
/** @vitest-environment jsdom */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { JiraConnectionField } from '../JiraConnectionField'

const jiraStatus = vi.fn()
const jiraConnect = vi.fn()

beforeEach(() => {
  jiraStatus.mockReset().mockResolvedValue({ configured: false, site: '', projectKeys: [], connected: false })
  jiraConnect.mockReset().mockResolvedValue({ ok: true, displayName: 'Rodrigo' })
  ;(window as unknown as { api: unknown }).api = { jiraStatus, jiraConnect }
})

describe('JiraConnectionField', () => {
  it('sin conectar pide sitio, email y token', async () => {
    render(<JiraConnectionField cwd="/repo" />)
    await waitFor(() => expect(jiraStatus).toHaveBeenCalledWith('/repo'))
    expect(screen.getByLabelText('jira.siteLabel')).toBeTruthy()
    expect(screen.getByLabelText('jira.emailLabel')).toBeTruthy()
    expect(screen.getByLabelText('jira.tokenLabel')).toBeTruthy()
  })

  it('conectar manda los cuatro campos y muestra a quién autenticó', async () => {
    render(<JiraConnectionField cwd="/repo" />)
    await waitFor(() => expect(jiraStatus).toHaveBeenCalled())

    fireEvent.change(screen.getByLabelText('jira.siteLabel'), { target: { value: 'https://x.atlassian.net' } })
    fireEvent.change(screen.getByLabelText('jira.emailLabel'), { target: { value: 'a@b.c' } })
    fireEvent.change(screen.getByLabelText('jira.tokenLabel'), { target: { value: 'tok' } })
    fireEvent.change(screen.getByLabelText('jira.projectKeysLabel'), { target: { value: 'GRAV, COV' } })
    fireEvent.click(screen.getByText('jira.connectAction'))

    await waitFor(() => expect(jiraConnect).toHaveBeenCalledWith('/repo', {
      site: 'https://x.atlassian.net',
      email: 'a@b.c',
      apiToken: 'tok',
      projectKeys: ['GRAV', 'COV'],
    }))
    await screen.findByText(/Rodrigo/)
  })

  it('un fallo de conexión se muestra y no se traga', async () => {
    jiraConnect.mockResolvedValue({ ok: false, error: 'Jira 401' })
    render(<JiraConnectionField cwd="/repo" />)
    await waitFor(() => expect(jiraStatus).toHaveBeenCalled())
    fireEvent.change(screen.getByLabelText('jira.siteLabel'), { target: { value: 'https://x.atlassian.net' } })
    fireEvent.click(screen.getByText('jira.connectAction'))
    await screen.findByText(/401/)
  })

  it('el input del token no expone el valor en claro', async () => {
    render(<JiraConnectionField cwd="/repo" />)
    await waitFor(() => expect(jiraStatus).toHaveBeenCalled())
    expect(screen.getByLabelText('jira.tokenLabel').getAttribute('type')).toBe('password')
  })
})
```

> El `t()` de los tests del repo devuelve la clave tal cual, por eso los textos esperados son
> `jira.siteLabel` y no la traducción. Comprueba cómo lo hacen los tests vecinos
> (`src/renderer/components/__tests__/settingsNav.test.tsx`) antes de escribir el tuyo.

- [ ] **Step 2: Corre el test y verifica que falla**

Run: `npx vitest run src/renderer/components/__tests__/jiraConnectionField.test.tsx`
Expected: FAIL — `Failed to resolve import "../JiraConnectionField"`.

- [ ] **Step 3: Añade las cadenas a los dos locales**

En `src/i18n/locales/en.ts`:

```ts
  jira: {
    section: 'Jira',
    siteLabel: 'Site',
    siteHint: 'Your Atlassian Cloud URL, e.g. https://acme.atlassian.net',
    emailLabel: 'Account email',
    tokenLabel: 'API token',
    tokenHint: 'Created at id.atlassian.com. Stored encrypted on this machine, never in the repo.',
    projectKeysLabel: 'Project keys',
    projectKeysHint: 'Comma-separated, e.g. GRAV, COV. Only these prefixes are read as issue keys.',
    connectAction: 'Connect',
    connectedAs: 'Connected as {{name}}',
    disconnectedHint: 'Not connected. Issues cannot be attached as context yet.',
  },
```

En `src/i18n/locales/es.ts`, las mismas claves:

```ts
  jira: {
    section: 'Jira',
    siteLabel: 'Sitio',
    siteHint: 'La URL de tu Atlassian Cloud, p. ej. https://acme.atlassian.net',
    emailLabel: 'Email de la cuenta',
    tokenLabel: 'API token',
    tokenHint: 'Se crea en id.atlassian.com. Se guarda cifrado en este equipo, nunca en el repo.',
    projectKeysLabel: 'Claves de proyecto',
    projectKeysHint: 'Separadas por coma, p. ej. GRAV, COV. Solo esos prefijos se leen como claves.',
    connectAction: 'Conectar',
    connectedAs: 'Conectado como {{name}}',
    disconnectedHint: 'Sin conectar. Todavía no se pueden adjuntar issues como contexto.',
  },
```

- [ ] **Step 4: Escribe el componente**

Crea `src/renderer/components/JiraConnectionField.tsx`. Usa `SettingsField` del mismo directorio y
los componentes del kit (`Input`, `Button`); no pases `className` ni `style` a ninguno de ellos.

```tsx
import React, { useCallback, useEffect, useState } from 'react'
import { useT } from '@i18n/useT'
import { Button, Input } from './ui'
import { SettingsField } from './SettingsSection'
import './JiraConnectionField.css'

interface JiraStatus {
  configured: boolean
  site: string
  projectKeys: string[]
  connected: boolean
}

export interface JiraConnectionFieldProps {
  /** Proyecto activo: `jira.json` es suyo, no de la app. */
  cwd: string
}

/**
 * Conexión a Jira Cloud. El token se manda a `jiraConnect`, que lo prueba contra
 * `/myself` antes de cifrarlo; nunca pasa por `config.json`.
 */
export const JiraConnectionField: React.FC<JiraConnectionFieldProps> = ({ cwd }) => {
  const { t } = useT()
  const [site, setSite] = useState('')
  const [email, setEmail] = useState('')
  const [apiToken, setApiToken] = useState('')
  const [projectKeys, setProjectKeys] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [connectedAs, setConnectedAs] = useState('')

  useEffect(() => {
    let cancelled = false
    void window.api.jiraStatus(cwd).then((status: JiraStatus) => {
      if (cancelled || !status.configured) return
      setSite(status.site)
      setProjectKeys(status.projectKeys.join(', '))
    })
    return () => { cancelled = true }
  }, [cwd])

  const connect = useCallback(async () => {
    setBusy(true)
    setError('')
    const result = await window.api.jiraConnect(cwd, {
      site: site.trim(),
      email: email.trim(),
      apiToken,
      projectKeys: projectKeys.split(',').map(key => key.trim()).filter(Boolean),
    })
    setBusy(false)
    if (result.ok) {
      setConnectedAs(result.displayName ?? '')
      // El token ya está cifrado en disco; no hay razón para conservarlo en memoria.
      setApiToken('')
      return
    }
    setError(result.error ?? '')
  }, [cwd, site, email, apiToken, projectKeys])

  return (
    <div className="jira-connection">
      <SettingsField label={t('jira.siteLabel')} hint={t('jira.siteHint')} htmlFor="jira-site">
        <Input id="jira-site" value={site} onChange={event => setSite(event.target.value)} />
      </SettingsField>
      <SettingsField label={t('jira.emailLabel')} htmlFor="jira-email">
        <Input id="jira-email" value={email} onChange={event => setEmail(event.target.value)} />
      </SettingsField>
      <SettingsField label={t('jira.tokenLabel')} hint={t('jira.tokenHint')} htmlFor="jira-token">
        <Input
          id="jira-token"
          type="password"
          value={apiToken}
          onChange={event => setApiToken(event.target.value)}
        />
      </SettingsField>
      <SettingsField
        label={t('jira.projectKeysLabel')}
        hint={t('jira.projectKeysHint')}
        htmlFor="jira-projects"
      >
        <Input
          id="jira-projects"
          value={projectKeys}
          onChange={event => setProjectKeys(event.target.value)}
        />
      </SettingsField>
      <div className="jira-connection__actions">
        <Button onClick={() => void connect()} disabled={busy || !site.trim()}>
          {t('jira.connectAction')}
        </Button>
        {connectedAs
          ? <span className="jira-connection__ok">{t('jira.connectedAs', { name: connectedAs })}</span>
          : <span className="jira-connection__hint">{t('jira.disconnectedHint')}</span>}
      </div>
      {error ? <p className="jira-connection__error">{error}</p> : null}
    </div>
  )
}
```

Crea `src/renderer/components/JiraConnectionField.css`:

```css
.jira-connection {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.jira-connection__actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.jira-connection__ok { color: var(--success, #4ade80); font-size: 12px; }
.jira-connection__hint { color: var(--fg-dim); font-size: 12px; }
.jira-connection__error { color: var(--danger, #f87171); font-size: 12px; margin: 0; }
```

> `Input` extiende `React.InputHTMLAttributes` menos `className` y `size`
> (`src/renderer/components/ui/Input.tsx:7`), así que `type`, `id` y `value` pasan tal cual. Lo que
> **no** puedes pasarle es `className` ni `style`.

- [ ] **Step 5: Monta la sección en `SettingsModal.tsx`**

Copia el patrón de la categoría `github` en tres sitios del archivo:

```ts
  { id: 'jira', icon: 'jira', labelKey: 'jira.section' },
```

```ts
  { category: 'jira', anchor: 'settings-jira', titleKey: 'jira.section', termKeys: ['jira.siteLabel', 'jira.tokenHint'] },
```

```tsx
          {category === 'jira' && (
            <SettingsSection title={t('jira.section')} anchor="settings-jira">
              <JiraConnectionField cwd={activeCwd} />
            </SettingsSection>
          )}
```

> `activeCwd` es el nombre que uses para el cwd de la pestaña activa: mira qué prop ya recibe
> `SettingsModal` para eso antes de inventar una. Si no recibe ninguna, pásala desde `App.tsx`
> siguiendo cómo se pasan las demás.

- [ ] **Step 6: Corre el test y las verificaciones de UI**

Run: `npx vitest run src/renderer/components/__tests__/jiraConnectionField.test.tsx && npm run check:ui`
Expected: PASS, 4 tests, y `check:ui` sin violaciones.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/components/JiraConnectionField.tsx src/renderer/components/JiraConnectionField.css src/renderer/components/SettingsModal.tsx src/i18n/locales/en.ts src/i18n/locales/es.ts src/renderer/components/__tests__/jiraConnectionField.test.tsx
git commit -m "feat(jira): conexion a Jira Cloud desde Ajustes"
```

---

### Task 9: Alta de un contexto `jira` desde el gestor — **cierra la fase 1**

**Files:**
- Modify: `src/renderer/agent/TabContextFormModal.tsx`
- Modify: `src/i18n/locales/en.ts`, `src/i18n/locales/es.ts`
- Test: `src/renderer/agent/__tests__/tabContextFormJira.test.tsx`

**Interfaces:**
- Consumes: `normalizeIssueKey` (tarea 1); `canonicalContextId`, `canonicalContextFileName`, `canonicalContextName` con `issueKey` (tarea 5).
- Produces: nada para tareas posteriores.

**Contexto:** el modal ya tiene ramas por kind (`kind === 'symbols'` añade `symbolKinds`,
`kind === 'notes'` manda `content`). `jira` añade una: un campo de clave que, al normalizar,
alimenta los tres helpers canónicos. Sin clave válida, el botón de guardar queda deshabilitado —
un contexto `jira` sin clave no se puede refrescar nunca.

- [ ] **Step 1: Escribe el test que falla**

Crea `src/renderer/agent/__tests__/tabContextFormJira.test.tsx`:

```tsx
/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest'
import { jiraDraftFromKey } from '../TabContextFormModal'

describe('jiraDraftFromKey', () => {
  it('deriva id, archivo y nombre de la clave', () => {
    expect(jiraDraftFromKey('grav-412')).toEqual({
      id: 'iaterminal:jira:grav-412',
      name: 'GRAV-412',
      fileName: 'jira/GRAV-412.md',
      kind: 'jira',
      issueKey: 'GRAV-412',
    })
  })

  it('una clave inválida devuelve null: sin clave no hay contexto que refrescar', () => {
    expect(jiraDraftFromKey('no soy una clave')).toBeNull()
    expect(jiraDraftFromKey('')).toBeNull()
  })
})
```

- [ ] **Step 2: Corre el test y verifica que falla**

Run: `npx vitest run src/renderer/agent/__tests__/tabContextFormJira.test.tsx`
Expected: FAIL — `jiraDraftFromKey` no está exportado.

- [ ] **Step 3: Añade el helper y el campo**

En `src/renderer/agent/TabContextFormModal.tsx`, exporta el helper (arriba del componente):

```tsx
import { normalizeIssueKey } from '@shared/jiraIssue'
import { canonicalContextFileName, canonicalContextId, canonicalContextName } from '@shared/tabContext'
import type { TabContext } from '@shared/tabContext'

/** Clave → contexto `jira` listo para guardar. `null` si la clave no es válida. */
export function jiraDraftFromKey(raw: string): TabContext | null {
  const issueKey = normalizeIssueKey(raw)
  if (!issueKey) return null
  return {
    id: canonicalContextId('jira', { issueKey }),
    name: canonicalContextName('jira', { issueKey }),
    fileName: canonicalContextFileName('jira', { issueKey }),
    kind: 'jira',
    issueKey,
  }
}
```

Dentro del formulario, junto a las otras ramas por kind, un campo de clave que aplica el helper al
draft y deshabilita el guardado cuando devuelve `null`:

```tsx
{draft.kind === 'jira' && (
  <SettingsField label={t('tabContexts.jiraKeyLabel')} hint={t('tabContexts.jiraKeyHint')} htmlFor="jira-key">
    <Input
      id="jira-key"
      value={issueKeyDraft}
      onChange={event => {
        const next = event.target.value
        setIssueKeyDraft(next)
        const derived = jiraDraftFromKey(next)
        if (derived) setDraft(current => ({ ...current, ...derived }))
      }}
    />
  </SettingsField>
)}
```

> `setDraft` / `SettingsField` / `Input` son los nombres del archivo actual: léelo antes de pegar y
> ajusta a cómo se llaman de verdad. El punto que no puede cambiar es que el guardado quede
> bloqueado si `jiraDraftFromKey` devuelve `null`.

- [ ] **Step 4: Añade las cadenas a los dos locales**

`en.ts`, dentro de `tabContexts`:

```ts
    jiraKeyLabel: 'Issue key',
    jiraKeyHint: 'For example GRAV-412. The snapshot refreshes before each turn.',
```

`es.ts`:

```ts
    jiraKeyLabel: 'Clave de la issue',
    jiraKeyHint: 'Por ejemplo GRAV-412. El snapshot se refresca antes de cada turno.',
```

- [ ] **Step 5: Corre el test y la suite**

Run: `npx vitest run src/renderer/agent/__tests__/tabContextFormJira.test.tsx && npm test && npm run check:ui`
Expected: PASS. La suite completa debe estar verde y `check:ui` limpio.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/agent/TabContextFormModal.tsx src/i18n/locales/en.ts src/i18n/locales/es.ts src/renderer/agent/__tests__/tabContextFormJira.test.tsx
git commit -m "feat(jira): alta de contexto jira pegando la clave de la issue"
```

**Fin de la fase 1.** En este punto la feature es usable: se conecta Jira en Ajustes, se crea el
contexto con la clave, el snapshot se refresca solo antes de cada turno, y la issue se arrastra a
un agente como cualquier otro contexto.

---

### Task 10: Mención de issues en el composer

**Files:**
- Modify: `src/shared/jiraIssue.ts` (añadir `mentionQueryAt`)
- Create: `src/renderer/workspace/JiraMentionPicker.tsx`
- Create: `src/renderer/workspace/JiraMentionPicker.css`
- Modify: `src/renderer/workspace/PlaneChatComposer.tsx`
- Modify: `src/i18n/locales/en.ts`, `src/i18n/locales/es.ts`
- Test: `src/shared/__tests__/jiraMention.test.ts`
- Test: `src/renderer/workspace/__tests__/jiraMentionPicker.test.tsx`

**Interfaces:**
- Consumes: `window.api.jiraSearch` (tarea 7); `JiraIssueRef` (tarea 1); `jiraDraftFromKey` (tarea 9).
- Produces:
  - `function mentionQueryAt(text: string, caret: number, projectKeys: readonly string[]): string | null` en `src/shared/jiraIssue.ts`
  - `const JiraMentionPicker: React.FC<{ cwd: string; query: string; onPick: (issue: JiraIssueRef) => void; onDismiss: () => void }>`

- [ ] **Step 1: Escribe el test puro que falla**

Crea `src/shared/__tests__/jiraMention.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { mentionQueryAt } from '../jiraIssue'

const keys = ['GRAV', 'COV']
const at = (text: string) => mentionQueryAt(text, text.length, keys)

describe('mentionQueryAt', () => {
  it('un prefijo de proyecto con guion abre el picker', () => {
    expect(at('arregla GRAV-')).toBe('GRAV-')
    expect(at('arregla GRAV-41')).toBe('GRAV-41')
  })

  it('minúsculas también', () => {
    expect(at('arregla grav-41')).toBe('GRAV-41')
  })

  it('un prefijo desconocido no abre nada', () => {
    expect(at('usa UTF-')).toBeNull()
    expect(at('mira CVE-2023')).toBeNull()
  })

  it('solo el token pegado al cursor cuenta', () => {
    expect(mentionQueryAt('GRAV-412 ya está', 'GRAV-412 ya está'.length, keys)).toBeNull()
  })

  it('el cursor en medio del texto mira lo que hay a su izquierda', () => {
    const text = 'antes GRAV-4 después'
    expect(mentionQueryAt(text, 'antes GRAV-4'.length, keys)).toBe('GRAV-4')
  })

  it('sin projectKeys no hay picker en ningún caso', () => {
    expect(mentionQueryAt('GRAV-4', 6, [])).toBeNull()
  })

  it('un @ suelto abre la búsqueda libre', () => {
    expect(at('revisa @deadlock')).toBe('deadlock')
    expect(at('revisa @')).toBe('')
  })
})
```

- [ ] **Step 2: Corre el test y verifica que falla**

Run: `npx vitest run src/shared/__tests__/jiraMention.test.ts`
Expected: FAIL — `mentionQueryAt is not a function`.

- [ ] **Step 3: Implementa `mentionQueryAt` en `src/shared/jiraIssue.ts`**

```ts
/**
 * Qué está escribiendo el usuario justo antes del cursor, si es una mención.
 * Devuelve el término de búsqueda, `''` para un `@` recién tecleado, o `null`
 * si no hay nada que buscar. Vive acá y no en el componente porque es la regla
 * que decide cuándo la app interrumpe al usuario: se testea sin React.
 */
export function mentionQueryAt(
  text: string,
  caret: number,
  projectKeys: readonly string[],
): string | null {
  if (!projectKeys.length) return null
  const before = (text ?? '').slice(0, Math.max(0, caret))

  const mention = before.match(/(?:^|\s)@([\w-]*)$/)
  if (mention) return mention[1]

  const partial = before.match(/(?:^|\s)([A-Za-z][A-Za-z0-9]*)-(\d*)$/)
  if (!partial) return null
  const project = partial[1].toUpperCase()
  if (!projectKeys.some(key => key.trim().toUpperCase() === project)) return null
  return `${project}-${partial[2]}`
}
```

- [ ] **Step 4: Corre el test y verifica que pasa**

Run: `npx vitest run src/shared/__tests__/jiraMention.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Escribe el test del picker**

Crea `src/renderer/workspace/__tests__/jiraMentionPicker.test.tsx`:

```tsx
/** @vitest-environment jsdom */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { JiraMentionPicker } from '../JiraMentionPicker'

const jiraSearch = vi.fn()

const refs = [
  { key: 'GRAV-412', summary: 'Loop chain colgada', status: 'In Progress', issueType: 'Bug', assignee: 'Rodrigo' },
  { key: 'GRAV-407', summary: 'Timeout de PTY', status: 'In Review', issueType: 'Bug', assignee: null },
]

beforeEach(() => {
  jiraSearch.mockReset().mockResolvedValue(refs)
  ;(window as unknown as { api: unknown }).api = { jiraSearch }
})

describe('JiraMentionPicker', () => {
  it('busca y lista las coincidencias', async () => {
    render(<JiraMentionPicker cwd="/repo" query="GRAV-4" onPick={vi.fn()} onDismiss={vi.fn()} />)
    await waitFor(() => expect(jiraSearch).toHaveBeenCalledWith('/repo', 'GRAV-4'))
    await screen.findByText('Loop chain colgada')
    expect(screen.getByText('GRAV-407')).toBeTruthy()
  })

  it('Enter elige la fila activa', async () => {
    const onPick = vi.fn()
    render(<JiraMentionPicker cwd="/repo" query="GRAV-4" onPick={onPick} onDismiss={vi.fn()} />)
    await screen.findByText('Loop chain colgada')
    fireEvent.keyDown(window, { key: 'ArrowDown' })
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(onPick).toHaveBeenCalledWith(refs[1])
  })

  it('Escape cierra sin elegir', async () => {
    const onDismiss = vi.fn()
    render(<JiraMentionPicker cwd="/repo" query="GRAV-4" onPick={vi.fn()} onDismiss={onDismiss} />)
    await screen.findByText('Loop chain colgada')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onDismiss).toHaveBeenCalled()
  })

  it('sin resultados no pinta una lista vacía flotando', async () => {
    jiraSearch.mockResolvedValue([])
    const { container } = render(
      <JiraMentionPicker cwd="/repo" query="ZZZ" onPick={vi.fn()} onDismiss={vi.fn()} />,
    )
    await waitFor(() => expect(jiraSearch).toHaveBeenCalled())
    await waitFor(() => expect(container.querySelector('.jira-mention__list')).toBeNull())
  })
})
```

- [ ] **Step 6: Corre el test y verifica que falla**

Run: `npx vitest run src/renderer/workspace/__tests__/jiraMentionPicker.test.tsx`
Expected: FAIL — `Failed to resolve import "../JiraMentionPicker"`.

- [ ] **Step 7: Escribe el picker**

Crea `src/renderer/workspace/JiraMentionPicker.tsx`:

```tsx
import React, { useEffect, useRef, useState } from 'react'
import type { JiraIssueRef } from '@shared/jiraIssue'
import { useT } from '@i18n/useT'
import './JiraMentionPicker.css'

const DEBOUNCE_MS = 200

export interface JiraMentionPickerProps {
  cwd: string
  /** Término vigente; el composer lo recalcula en cada tecla. */
  query: string
  onPick: (issue: JiraIssueRef) => void
  onDismiss: () => void
}

/**
 * Lista flotante de issues sobre el composer. No se pinta si no hay resultados:
 * un panel vacío tapando el texto es peor que no interrumpir.
 */
export const JiraMentionPicker: React.FC<JiraMentionPickerProps> = ({
  cwd,
  query,
  onPick,
  onDismiss,
}) => {
  const { t } = useT()
  const [results, setResults] = useState<JiraIssueRef[]>([])
  const [active, setActive] = useState(0)
  // El orden de respuesta no está garantizado: solo la última búsqueda pinta.
  const requestRef = useRef(0)

  useEffect(() => {
    const token = ++requestRef.current
    const timer = setTimeout(() => {
      void window.api.jiraSearch(cwd, query).then((issues: JiraIssueRef[]) => {
        if (token !== requestRef.current) return
        setResults(issues)
        setActive(0)
      })
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [cwd, query])

  useEffect(() => {
    if (!results.length) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setActive(current => Math.min(current + 1, results.length - 1))
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        setActive(current => Math.max(current - 1, 0))
      } else if (event.key === 'Enter') {
        event.preventDefault()
        onPick(results[active])
      } else if (event.key === 'Escape') {
        event.preventDefault()
        onDismiss()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [results, active, onPick, onDismiss])

  if (!results.length) return null

  return (
    <ul className="jira-mention__list" aria-label={t('jira.mentionListLabel')}>
      {results.map((issue, index) => (
        <li key={issue.key}>
          <button
            type="button"
            className={[
              'jira-mention__item',
              index === active ? 'jira-mention__item--active' : '',
            ].filter(Boolean).join(' ')}
            onMouseEnter={() => setActive(index)}
            onClick={() => onPick(issue)}
          >
            <span className="jira-mention__key">{issue.key}</span>
            <span className="jira-mention__summary">{issue.summary}</span>
            <span className="jira-mention__status">{issue.status}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}
```

Crea `src/renderer/workspace/JiraMentionPicker.css`:

```css
.jira-mention__list {
  position: absolute;
  bottom: 100%;
  left: 0;
  right: 0;
  margin: 0 0 6px;
  padding: 0;
  list-style: none;
  z-index: 20;
  max-height: 220px;
  overflow-y: auto;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
}

.jira-mention__item {
  display: flex;
  align-items: baseline;
  gap: 10px;
  width: 100%;
  padding: 7px 12px;
  background: none;
  border: 0;
  text-align: left;
  color: var(--fg);
  cursor: pointer;
  font: inherit;
}

.jira-mention__item--active,
.jira-mention__item:focus-visible { background: var(--tab-active-bg); }

.jira-mention__key { font-family: var(--font-mono); font-size: 12px; color: var(--accent); }
.jira-mention__summary { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.jira-mention__status { font-size: 11px; color: var(--fg-dim); white-space: nowrap; }
```

Añade las cadenas a los dos locales, dentro de `jira`:

```ts
    mentionListLabel: 'Jira issues',      // en.ts
```

```ts
    mentionListLabel: 'Issues de Jira',   // es.ts
```

- [ ] **Step 8: Engánchalo en el composer**

En `src/renderer/workspace/PlaneChatComposer.tsx`: guarda las `projectKeys` del proyecto (una
llamada a `window.api.jiraStatus(cwd)` en un `useEffect`), calcula la query en cada cambio del
textarea, y al elegir adjunta el contexto:

```tsx
const [jiraProjectKeys, setJiraProjectKeys] = useState<string[]>([])
const [mentionQuery, setMentionQuery] = useState<string | null>(null)

useEffect(() => {
  let cancelled = false
  void window.api.jiraStatus(cwd).then(status => {
    if (!cancelled && status.connected) setJiraProjectKeys(status.projectKeys)
  })
  return () => { cancelled = true }
}, [cwd])

// En el onChange del textarea, después de la lógica existente:
setMentionQuery(mentionQueryAt(event.target.value, event.target.selectionStart ?? 0, jiraProjectKeys))
```

Y el render, dentro del contenedor que ya tiene `position: relative`:

```tsx
{mentionQuery !== null && (
  <JiraMentionPicker
    cwd={cwd}
    query={mentionQuery}
    onDismiss={() => setMentionQuery(null)}
    onPick={issue => {
      const context = jiraDraftFromKey(issue.key)
      if (context) onAttachContext(context)
      setMentionQuery(null)
    }}
  />
)}
```

> `onAttachContext` es el nombre que uses para la vía por la que el composer ya adjunta un contexto
> al draft (mira `planeContextDrag` / `ComposerDraft.contextIds` en el archivo). No inventes una
> nueva: la mención debe terminar exactamente donde termina arrastrar un chip.

- [ ] **Step 9: Corre los tests y las verificaciones**

Run: `npx vitest run src/renderer/workspace/__tests__/jiraMentionPicker.test.tsx && npm test && npm run check:ui`
Expected: PASS en todo.

- [ ] **Step 10: Commit**

```bash
git add src/shared/jiraIssue.ts src/renderer/workspace/JiraMentionPicker.tsx src/renderer/workspace/JiraMentionPicker.css src/renderer/workspace/PlaneChatComposer.tsx src/i18n/locales/en.ts src/i18n/locales/es.ts src/shared/__tests__/jiraMention.test.ts src/renderer/workspace/__tests__/jiraMentionPicker.test.tsx
git commit -m "feat(jira): mencionar issues en el composer con picker de busqueda"
```

---

### Task 11: Chip de issue con tarjeta

**Files:**
- Create: `src/renderer/workspace/JiraIssueChip.tsx`
- Create: `src/renderer/workspace/JiraIssueChip.css`
- Modify: `src/renderer/workspace/PlaneContextCard.tsx`
- Modify: `src/i18n/locales/en.ts`, `src/i18n/locales/es.ts`
- Test: `src/renderer/workspace/__tests__/jiraIssueChip.test.tsx`

**Interfaces:**
- Consumes: `JiraIssueRef` (tarea 1); `Tooltip` de `src/renderer/components/ui`.
- Produces: `const JiraIssueChip: React.FC<{ issueKey: string; summary: string; status: string; stale: boolean; onOpen: () => void }>`

**Contexto:** el hover **debe** usar `components/ui/Tooltip`; el atributo `title` está prohibido y
`npm run check:ui` falla por él. El chip muestra la frescura porque un snapshot viejo presentado
como actual es peor que no tenerlo.

- [ ] **Step 1: Escribe el test que falla**

Crea `src/renderer/workspace/__tests__/jiraIssueChip.test.tsx`:

```tsx
/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { JiraIssueChip } from '../JiraIssueChip'

describe('JiraIssueChip', () => {
  it('muestra la clave y el estado', () => {
    render(<JiraIssueChip issueKey="GRAV-412" summary="Loop chain colgada" status="In Progress" stale={false} onOpen={vi.fn()} />)
    expect(screen.getByText('GRAV-412')).toBeTruthy()
    expect(screen.getByText('In Progress')).toBeTruthy()
  })

  it('un snapshot vencido se marca en vez de fingir estar al día', () => {
    const { container } = render(
      <JiraIssueChip issueKey="GRAV-412" summary="x" status="Done" stale onOpen={vi.fn()} />,
    )
    expect(container.querySelector('.jira-chip--stale')).toBeTruthy()
  })

  it('el clic abre el snapshot completo', () => {
    const onOpen = vi.fn()
    render(<JiraIssueChip issueKey="GRAV-412" summary="x" status="Done" stale={false} onOpen={onOpen} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onOpen).toHaveBeenCalled()
  })

  it('no usa el atributo title: el tooltip es el del kit', () => {
    const { container } = render(
      <JiraIssueChip issueKey="GRAV-412" summary="x" status="Done" stale={false} onOpen={vi.fn()} />,
    )
    expect(container.querySelector('[title]')).toBeNull()
  })
})
```

- [ ] **Step 2: Corre el test y verifica que falla**

Run: `npx vitest run src/renderer/workspace/__tests__/jiraIssueChip.test.tsx`
Expected: FAIL — `Failed to resolve import "../JiraIssueChip"`.

- [ ] **Step 3: Escribe el chip**

Crea `src/renderer/workspace/JiraIssueChip.tsx`:

```tsx
import React from 'react'
import { useT } from '@i18n/useT'
import { Icon } from '../components/ui/Icon'
import { Tooltip } from '../components/ui/Tooltip'
import './JiraIssueChip.css'

export interface JiraIssueChipProps {
  issueKey: string
  summary: string
  status: string
  /** Snapshot vencido: se marca en vez de presentarlo como actual. */
  stale: boolean
  onOpen: () => void
}

export const JiraIssueChip: React.FC<JiraIssueChipProps> = ({
  issueKey,
  summary,
  status,
  stale,
  onOpen,
}) => {
  const { t } = useT()
  return (
    <Tooltip content={summary} hint={stale ? t('jira.staleHint') : status}>
      <button
        type="button"
        className={['jira-chip', stale ? 'jira-chip--stale' : ''].filter(Boolean).join(' ')}
        onClick={onOpen}
      >
        <Icon name="jira" size={12} />
        <span className="jira-chip__key">{issueKey}</span>
        <span className="jira-chip__status">{status}</span>
      </button>
    </Tooltip>
  )
}
```

Crea `src/renderer/workspace/JiraIssueChip.css`:

```css
.jira-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 8px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--bg-secondary);
  color: var(--fg);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.jira-chip:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.jira-chip--stale { border-style: dashed; opacity: .75; }
.jira-chip__key { font-family: var(--font-mono); color: var(--accent); }
.jira-chip__status { color: var(--fg-dim); }
```

Cadenas en los dos locales, dentro de `jira`:

```ts
    staleHint: 'Snapshot out of date — it refreshes on the next turn.',   // en.ts
```

```ts
    staleHint: 'Snapshot desactualizado: se refresca en el próximo turno.',  // es.ts
```

- [ ] **Step 4: Úsalo en la tarjeta del pool**

En `src/renderer/workspace/PlaneContextCard.tsx`, cuando `context.kind === 'jira'`, renderiza
`JiraIssueChip` en lugar del nombre plano, con `onOpen` apuntando al preview que la tarjeta ya
abre para los demás kinds.

> Lee el componente antes: ya recibe una vía para abrir `ContextContentPreviewModal`. Reúsala, no
> añadas una segunda.

- [ ] **Step 5: Corre los tests y las verificaciones**

Run: `npx vitest run src/renderer/workspace/__tests__/jiraIssueChip.test.tsx && npm test && npm run check:ui`
Expected: PASS en todo.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/workspace/JiraIssueChip.tsx src/renderer/workspace/JiraIssueChip.css src/renderer/workspace/PlaneContextCard.tsx src/i18n/locales/en.ts src/i18n/locales/es.ts src/renderer/workspace/__tests__/jiraIssueChip.test.tsx
git commit -m "feat(jira): chip de issue con estado y frescura visible"
```

---

## Verificación final

- [ ] `npm test` — verde, por encima de 1714 tests (este plan añade ~83).
- [ ] `npx tsc -b` — sigue en **78** errores. Si subió, es tuyo.
- [ ] `npm run check:ui` — sin violaciones.
- [ ] `command grep -ran "\.gravity" electron/jira*.ts src/shared/jira*.ts` — **cero resultados**: la
      ruta se resuelve siempre con `projectDirPath` / `PROJECT_DIR`.
- [ ] `command grep -ran "apiToken" src/shared src/renderer` — solo el campo del formulario y el tipo
      del preload; ningún `apiToken` en un `.md`, en `jira.json` ni en `config.json`.
- [ ] Las claves nuevas existen en `en.ts` **y** en `es.ts` con la misma forma.
- [ ] `materializeTabContext`, `sectionsForContext` y `composePrompt` siguen siendo síncronas.

**Requiere la app abierta (repórtalo, no lo des por verificado):** que el picker aparezca al
teclear una clave, que el chip se adjunte al turno, que el snapshot se refresque tras 15 minutos y
que un Jira caído no bloquee el envío.
