# Vista «Reporte» para los contextos de proyecto

Fecha: 2026-08-07

## Problema

`ContextContentPreviewModal` muestra dos lecturas distintas según el tipo de contexto:

- `agentResult` tiene el par **Reporte / Fuente** (commit 07d6672): resumen, actividad por día,
  notas y chips de consumidores.
- Todos los demás (`folderTree`, `git`, `deps`, `files`, `symbols`, `readme`, `notes`,
  `changelog`) se pintan como el `.md` crudo: marcadores `<!-- iaterminal:context {json} -->`,
  `<!-- iaterminal:auto -->` a la vista, y una línea de meta con jerga de parser
  (`0 keys · 0 annotated`).

El caso peor es `folderTree`: 148 líneas de rutas completas repetidas
(`crates/agent/src/acp/`) donde no se distingue la forma del proyecto.

## Objetivo

Que todo contexto tenga una lectura humana en la pestaña **Reporte**, con `folderTree` y `deps`
—los dos ilegibles hoy— renderizados de forma dedicada. **Fuente** sigue mostrando el `.md` tal
cual, que es el contrato que parsean `electron/tabContextBuild.ts` y `electron/aiAgentResults.ts`.

## No objetivos

- Editar las notas de un contexto de proyecto. Hoy sólo existe `mergeAnnotations`
  (`electron/main.ts:967`), pensado para que la IA anote por clave; escribir texto libre humano
  exigiría un canal IPC nuevo. El Reporte las muestra en **sólo lectura**.
- Persistir el estado de plegado del árbol entre aperturas del modal.
- Vistas ricas para `git`, `symbols` y `files`: caen en el renderizado genérico.
- Tocar `electron/tabContextBuild.ts`. La lógica nueva es de lectura y vive en el renderer.

## Arquitectura

Tres piezas, siguiendo el patrón del repo (lógica pura en `src/shared/`, React como driver fino).

### 1. `src/shared/contextReportDoc.ts` (nuevo)

Funciones puras sobre el string del `.md`. Sin React, sin `fs`. Los marcadores son los mismos
literales que usa `tabContextBuild.ts`: `<!-- iaterminal:auto -->` / `<!-- /iaterminal:auto -->`
y `<!-- iaterminal:notes -->` / `<!-- /iaterminal:notes -->`.

```ts
export interface ContextDoc {
  auto: string                                   // región iaterminal:auto (o el cuerpo entero si no hay)
  notes: string                                  // texto libre humano, sin las líneas de anotación
  annotations: { key: string; text: string }[]   // - `clave` — texto
}
export function parseContextDoc(raw: string): ContextDoc

export interface FolderNode { name: string; path: string; children: FolderNode[] }
export function parseFolderTree(auto: string): { root: string; nodes: FolderNode[] }

export interface DepsDoc {
  deps: { name: string; version: string }[]
  devDeps: { name: string; version: string }[]
  scripts: { name: string; command: string }[]
}
export function parseDeps(auto: string): DepsDoc | null   // null = manifiesto no-JSON

export interface GitDoc { branch: string; changes: { code: string; path: string }[]; diffStat: string }
export function parseGit(auto: string): GitDoc | null

export function splitFences(body: string): { fence: boolean; lang: string; text: string }[]

/** Recuento del meta, ya resuelto por kind; el componente sólo traduce las claves. */
export function contextReportCounts(
  kind: TabContextKind,
  doc: ContextDoc,
): { key: string; count: number }[]
```

Detalles que fija la implementación actual del generador:

- **Árbol** (`gatherShallowFolderTree`, `electron/agentMd.ts:120`): primera línea
  `<nombre>/  (project root; paths are relative to this folder)`, línea en blanco, y luego una
  línea por carpeta con **ruta relativa completa** e indentación de dos espacios por nivel.
  `parseFolderTree` toma la primera línea como `root`, deriva la profundidad de
  `indent / 2` y el nombre del último segmento de la ruta. La línea de truncado
  (`… (truncated: line limit)`) se conserva como nodo hoja con su texto tal cual.
- **Deps** (`buildAutoContent`, caso `deps`): es el manifiesto en bruto. Si `JSON.parse` funciona
  se leen `dependencies`, `devDependencies` y `scripts`; si no (`pyproject.toml`, `Cargo.toml`,
  `go.mod`…) devuelve `null` y el cuerpo cae al renderizado genérico.
- **Git** (`buildGit`, `electron/tabContextBuild.ts:432`): `Git status:\n<git status --short
  --branch>\n\nDiff stat:\n<git diff --stat HEAD>`. La rama sale de la línea `## rama...`, los
  cambios de las líneas `XY ruta`. Si el bloque es `(not a git repository or git unavailable)`
  devuelve `null`.
- **Recuentos** (`contextReportCounts`): `folderTree` cuenta nodos del árbol; `deps`, entradas
  de `parseDeps`; `git`, líneas de cambio; `files` y `symbols`, cabeceras `### <ruta>` que emiten
  `buildFiles` y `buildSymbols`, y `symbols` además las líneas `- …` de cada sección. Siempre se
  añade el recuento de anotaciones cuando hay alguna.
- **Anotaciones**: regex `/^-\s+`([^`]+)`\s+—\s+(.+)\s*$/gm`, la misma que `ANNOTATION_RE` en
  `tabContextBuild.ts`. Queda duplicada a propósito: unificarla obligaría a tocar el módulo de
  electron, que está fuera de alcance.

### 2. `src/renderer/workspace/ContextReport.tsx` + `ContextReport.css` (nuevos)

`<ContextReport context={TabContext} content={string} />`. Tres zonas:

1. **Meta**: sustituye `0 keys · 0 annotated` por un recuento con sentido según el kind —
   `148 carpetas`, `42 dependencias · 9 scripts`, `rama main · 8 cambios`, `12 archivos`,
   `86 símbolos en 12 archivos`. Los kinds sin recuento propio (`readme`, `notes`, `changelog`)
   no muestran nada salvo `N anotadas` cuando hay anotaciones.
2. **Cuerpo**, según `context.kind`:
   - `folderTree`: árbol plegable. Chevron por nodo con hijos, contador de subcarpetas,
     `useState<Set<string>>` con las rutas abiertas; al montar, abierto hasta profundidad 2.
   - `deps` (con `parseDeps` no nulo): bloque de dependencias (nombre + versión, dev marcadas)
     y bloque de scripts (nombre + comando).
   - Resto: `splitFences` sobre el cuerpo; los tramos con fence van a `<pre>` y el resto a
     `AiMarkdown`. El troceo es necesario porque `AiMarkdown` no soporta bloques de código
     (sólo h/hr/quote/ul/ol/p), y `files` y `readme` sí traen ` ``` `.
3. **Notas** (sólo lectura): el texto libre y la lista `clave → texto`, con chip de procedencia.
   Si no hay nada, no se pinta la sección.

Sin `className`/`style` en los componentes del UI kit; clases BEM propias (`context-report__…`)
en su CSS colocado, según `.cursor/rules/frontend-components.mdc`.

### 3. `src/renderer/workspace/ContextContentPreviewModal.tsx` (edición)

- El `SegmentedControl` deja de estar condicionado a `doc` y se muestra para cualquier contexto.
- En `report`: si el kind es `agentResult`, el `AgentResultsReport` actual, sin cambios; si no,
  `ContextReport`.
- En `source`: el `<pre>` de siempre.
- La línea de meta delega en `ContextReport` cuando la vista es `report` y no es `agentResult`.
- `countAutoKeys` / `countAnnotations` siguen alimentando el meta de la vista `source`.

### 4. i18n

Claves nuevas en `src/i18n/locales/en.ts` y `es.ts` bajo `tabContexts.report*`: recuentos
(con plural `_one` / `_other`), cabeceras de deps y scripts, título de notas y procedencia,
y el vacío de cada bloque. Ambos locales en el mismo commit.

## Flujo de datos

`previewTabContext` (IPC ya existente) → `preview.content` en `ContextPreviewBody` →
`parseContextDoc` → parser por kind → render. Nada nuevo cruza el puente de procesos: el modal
ya tiene el `.md` completo en memoria.

## Errores

- Contenido sin región `auto`: `parseContextDoc` devuelve el cuerpo entero como `auto`; el
  Reporte lo renderiza como genérico.
- Parser específico que falla o no aplica (`parseDeps`/`parseGit` → `null`, árbol vacío): se cae
  al renderizado genérico. Ningún parser lanza.
- `preview.status` `loading` / `empty` / `error`: los paneles actuales del modal, sin tocar.

## Pruebas

`src/shared/__tests__/contextReportDoc.test.ts` (vitest, entorno node):

- `parseContextDoc`: separa auto / notas / anotaciones; documento sin marcadores; notas con
  sólo anotaciones y sin texto libre.
- `parseFolderTree`: profundidad por indentación, nombre = último segmento, línea raíz, árbol
  vacío, línea de truncado.
- `parseDeps`: `package.json` con deps + devDeps + scripts; JSON sin esas claves; manifiesto no
  JSON → `null`.
- `parseGit`: rama y cambios de `--short --branch`; repo limpio; `(not a git repository…)` → `null`.
- `splitFences`: fence abierto sin cerrar, texto sin fences, fence con lenguaje.
- `contextReportCounts`: un caso por kind con recuento propio, más el de anotaciones.

Sin tests de componente: la regla del repo es concentrar cobertura en la lógica pura.

## Archivos

Nuevos: `src/shared/contextReportDoc.ts`, `src/shared/__tests__/contextReportDoc.test.ts`,
`src/renderer/workspace/ContextReport.tsx`, `src/renderer/workspace/ContextReport.css`.

Editados: `src/renderer/workspace/ContextContentPreviewModal.tsx`,
`src/i18n/locales/en.ts`, `src/i18n/locales/es.ts`.
