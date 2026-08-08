# Capacidades por agente (Spec A) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la definición de un agente declare qué skills de plugin y qué servidores MCP ve su proceso, y que Covenant lo traduzca a flags de lanzamiento; más un `TabContextKind` nuevo, `skill`, con entrega por catálogo.

**Architecture:** Todo el control es por flags de spawn, verificados contra el `--help` real de `claude`: `--disallowedTools Skill` apaga las skills, `--setting-sources project` + `--plugin-dir` deja solo los namespaces permitidos, y `--mcp-config` + `--strict-mcp-config` acotan los servidores MCP. La decisión vive en `ProjectAgentDefinition` junto a `contextIds`; la lógica de resolución es pura en `src/shared/`; `electron/` solo lee disco y escribe el `mcp.json` efímero. El `cwd` no se toca.

**Tech Stack:** TypeScript, React 18, Electron, vitest (entorno `node` para lógica pura), i18next (`en` + `es`), CSS colocado con clases BEM.

**Spec:** `docs/superpowers/specs/2026-08-07-capacidades-agente-A-design.md`
**Evidencia previa:** `docs/superpowers/specs/2026-08-07-capacidades-agente-hallazgos.md`

## Global Constraints

- Los comentarios y la documentación se escriben **en español**; el código, en inglés.
- Tres grafos separados: `electron/` (privilegiado), `src/renderer/` (React, sin Node), `src/shared/` (puro). Un archivo de `src/renderer/` **no puede** importar de `electron/`, y `src/shared/` **no puede** importar `node:*` ni de `electron/`. Lo enforce `tsconfig.web.json`.
- Los componentes del UI kit (`src/renderer/components/ui/**`) no aceptan `className` ni `style`; se estilan con props tipadas. `npm run check:ui` falla si se les pasa. Las clases BEM internas de una feature sí están permitidas.
- Toda cadena visible pasa por i18n y **se añade a los dos locales** (`src/i18n/locales/en.ts` y `es.ts`) en el mismo commit. El `t()` está tipado sobre las claves de `en.ts`: una clave que falte allí **no compila**.
- Nunca escribas un literal `.gravity`. Usa `PROJECT_DIR` (`src/shared/projectDir.ts`) o `projectDirPath(cwd, …)` (`electron/projectDir.ts`), que respeta proyectos legacy en `.iaterminal`.
- `npx tsc -b` arrastra **35 errores previos** ajenos a este trabajo. **No es una puerta de paso/fallo**: el número debe seguir en 35. Si sube, mira qué introdujiste.
- Baseline de la suite al empezar: **104 archivos / 770 tests**, verde. Debe subir, porque este plan añade tests.
- Añadir una ruta IPC son cuatro sitios, todos obligatorios: la constante en `src/shared/ipcChannels.ts`, el handler en `electron/main.ts`, el método en `electron/preload.ts`, y el llamador.
- **Trampa del entorno:** el `grep` de este shell resuelve a `ugrep -I` y **salta archivos con bytes NUL en silencio**; hay al menos un `.tsx` así en el repo. Un `grep` vacío **no prueba** que algo no tenga usos: usa `command grep -a` o `rg --text`.
- **No puedes verificar en la app:** `npm run dev` no termina en una sesión no interactiva. Verifica leyendo el código y con tests, y lista en tu informe lo que requiera la app abierta.

## Estructura de archivos

| Archivo | Responsabilidad | Tarea |
|---|---|---|
| `src/shared/projectAgentCatalog.ts` | `nativeSkills` / `mcpsAllowed` en la definición y su parseo | 1 |
| `src/shared/tabContext.ts` | el kind `skill` en los tres arrays | 2 |
| `electron/tabContextBuild.ts` | materializar un `skill` desde `.gravity/skills/<id>/SKILL.md` | 2 |
| `src/shared/agentCliProviders.ts` | traducir capacidades a flags; tabla de `capabilities` | 3, 5, 6, 7 |
| `src/shared/installedPlugins.ts` | **Nuevo.** Puro: parsear `installed_plugins.json` y resolver namespace → ruta | 4 |
| `electron/pluginDirs.ts` | **Nuevo.** Leer el JSON de disco y delegar en el puro | 4 |
| `electron/mcpConfigFile.ts` | **Nuevo.** Escribir el `mcp.json` efímero | 6 |
| `src/shared/agentCliTypes.ts` | campos nuevos en `AgentCliStartRequest` | 5 |
| `electron/agentCliRuntime.ts` | resolver capacidades antes del spawn | 5, 6 |
| `src/renderer/agent/AgentConfigSettingsPane.tsx` | la sección de capacidades | 7 |
| `electron/main.ts`, `electron/preload.ts`, `src/shared/ipcChannels.ts` | canal de métricas | 8 |

---

### Task 1: Campos de capacidad en la definición del agente

**Files:**
- Modify: `src/shared/projectAgentCatalog.ts`
- Test: `src/shared/__tests__/projectAgentCatalog.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `interface AgentNativeSkills { enabled: boolean; namespaces?: string[] }`
  - `ProjectAgentDefinition.nativeSkills?: AgentNativeSkills`
  - `ProjectAgentDefinition.mcpsAllowed?: string[]`
  - `function sanitizeNativeSkills(raw: unknown): AgentNativeSkills | undefined`
  - `function sanitizeMcpsAllowed(raw: unknown): string[] | undefined`

- [ ] **Step 1: Escribe los tests que fallan**

Añade al final de `src/shared/__tests__/projectAgentCatalog.test.ts`. El caso que más importa es el default seguro: un agente sin el campo normaliza a «ninguna», no a «todas».

```ts
import { parseProjectAgentDefinition } from '../projectAgentCatalog'

describe('capacidades del agente', () => {
  const base = { id: 'backend', provider: 'claude', permissionMode: 'ask' }

  it('sin nativeSkills el campo queda ausente — el llamador lo lee como ninguna', () => {
    const def = parseProjectAgentDefinition(base)
    expect(def?.nativeSkills).toBeUndefined()
  })

  it('acepta enabled con lista de namespaces', () => {
    const def = parseProjectAgentDefinition({
      ...base,
      nativeSkills: { enabled: true, namespaces: ['superpowers', 'ponytail'] },
    })
    expect(def?.nativeSkills).toEqual({ enabled: true, namespaces: ['superpowers', 'ponytail'] })
  })

  it('enabled false descarta los namespaces: no hay allowlist que aplicar', () => {
    const def = parseProjectAgentDefinition({
      ...base,
      nativeSkills: { enabled: false, namespaces: ['superpowers'] },
    })
    expect(def?.nativeSkills).toEqual({ enabled: false })
  })

  it('descarta namespaces que no son strings no vacíos', () => {
    const def = parseProjectAgentDefinition({
      ...base,
      nativeSkills: { enabled: true, namespaces: ['superpowers', '', '  ', 42, null] },
    })
    expect(def?.nativeSkills).toEqual({ enabled: true, namespaces: ['superpowers'] })
  })

  it('deduplica namespaces conservando el orden', () => {
    const def = parseProjectAgentDefinition({
      ...base,
      nativeSkills: { enabled: true, namespaces: ['b', 'a', 'b'] },
    })
    expect(def?.nativeSkills?.namespaces).toEqual(['b', 'a'])
  })

  it('nativeSkills que no es objeto se ignora entero', () => {
    expect(parseProjectAgentDefinition({ ...base, nativeSkills: 'true' })?.nativeSkills)
      .toBeUndefined()
    expect(parseProjectAgentDefinition({ ...base, nativeSkills: { namespaces: ['x'] } })?.nativeSkills)
      .toBeUndefined()
  })

  it('mcpsAllowed filtra vacíos y deduplica; lista vacía no se persiste', () => {
    expect(parseProjectAgentDefinition({ ...base, mcpsAllowed: ['jira', '', 'jira', 'figma'] })?.mcpsAllowed)
      .toEqual(['jira', 'figma'])
    expect(parseProjectAgentDefinition({ ...base, mcpsAllowed: [] })?.mcpsAllowed).toBeUndefined()
    expect(parseProjectAgentDefinition({ ...base, mcpsAllowed: 'jira' })?.mcpsAllowed).toBeUndefined()
  })
})
```

- [ ] **Step 2: Ejecuta y verifica que falla**

Run: `npx vitest run src/shared/__tests__/projectAgentCatalog.test.ts`
Expected: FAIL — `nativeSkills` no existe en el tipo ni en el parseo.

- [ ] **Step 3: Implementa**

En `src/shared/projectAgentCatalog.ts`, junto a `ProjectAgentDefinition` (línea ~30):

```ts
/** Skills de plugin del harness visibles para este agente. */
export interface AgentNativeSkills {
  enabled: boolean
  /**
   * Namespaces de plugin permitidos (`superpowers`, `ponytail`…). Solo tiene
   * sentido con `enabled: true`. Ausente o vacío = ninguno.
   */
  namespaces?: string[]
}
```

Y dentro de `ProjectAgentDefinition`:

```ts
  /**
   * Omitido = el agente no ve ninguna skill de plugin. El default seguro es
   * el que no cuesta tokens: `claude plugin details superpowers` reporta ~688
   * tokens always-on solo por ese plugin.
   */
  nativeSkills?: AgentNativeSkills
  /** Servidores MCP permitidos por id. Omitido = ninguno. */
  mcpsAllowed?: string[]
```

Los sanitizadores, antes de `parseProjectAgentDefinition`:

```ts
/** Lista de strings no vacíos, recortados, sin duplicados y en orden de aparición. */
function uniqueStrings(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  for (const item of raw) {
    if (typeof item !== 'string') continue
    const value = item.trim()
    if (value) seen.add(value)
  }
  return [...seen]
}

export function sanitizeNativeSkills(raw: unknown): AgentNativeSkills | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const data = raw as Record<string, unknown>
  if (typeof data.enabled !== 'boolean') return undefined
  // Con el gate apagado no hay allowlist que aplicar: guardarla sería estado
  // muerto que después miente en la UI.
  if (!data.enabled) return { enabled: false }
  const namespaces = uniqueStrings(data.namespaces)
  return namespaces.length ? { enabled: true, namespaces } : { enabled: true }
}

export function sanitizeMcpsAllowed(raw: unknown): string[] | undefined {
  const list = uniqueStrings(raw)
  return list.length ? list : undefined
}
```

Y en `parseProjectAgentDefinition`, justo antes del `return def` final (después de `acceptDelegations`):

```ts
  const nativeSkills = sanitizeNativeSkills(data.nativeSkills)
  if (nativeSkills) def.nativeSkills = nativeSkills
  const mcpsAllowed = sanitizeMcpsAllowed(data.mcpsAllowed)
  if (mcpsAllowed) def.mcpsAllowed = mcpsAllowed
```

- [ ] **Step 4: Propaga al clon**

`cloneProjectAgentDefinition` (línea ~316) copia campo por campo. Añade, siguiendo el mismo estilo de spread condicional que usa para `monogram` y `role`:

```ts
    ...(source.nativeSkills ? { nativeSkills: { ...source.nativeSkills } } : {}),
    ...(source.mcpsAllowed ? { mcpsAllowed: [...source.mcpsAllowed] } : {}),
```

Copia **profunda** de los dos: son objeto y array, y compartir la referencia haría que editar el clon mutara el original.

- [ ] **Step 5: Ejecuta y verifica que pasa**

Run: `npx vitest run src/shared/__tests__/projectAgentCatalog.test.ts`
Expected: PASS, 7 tests nuevos.

- [ ] **Step 6: Suite completa y typecheck**

Run: `npm test && npx tsc -b 2>&1 | grep -c "error TS"`
Expected: suite verde; el conteo en **35**.

- [ ] **Step 7: Commit**

```bash
git add src/shared/projectAgentCatalog.ts src/shared/__tests__/projectAgentCatalog.test.ts
git commit -m "Añade nativeSkills y mcpsAllowed a la definición del agente

Omitidos significan ninguna capacidad, no todas: el default seguro es el
que no cuesta tokens. Un gate apagado descarta su allowlist en vez de
guardarla como estado muerto."
```

---

### Task 2: El kind `skill`

**Files:**
- Modify: `src/shared/tabContext.ts`
- Modify: `electron/tabContextBuild.ts`
- Test: `src/shared/__tests__/contextBudget.test.ts`
- Test: `electron/__tests__/tabContextBuild.test.ts`

**Interfaces:**
- Consumes: `deliveryModeFor` (`src/shared/contextBudget.ts:28`), `sectionsForContext` (`src/shared/contextSections.ts`).
- Produces: `TabContextKind` incluye `'skill'`; un contexto `skill` se materializa desde `<projectDir>/skills/<id>/SKILL.md`.

- [ ] **Step 1: Escribe el test de entrega**

En `src/shared/__tests__/contextBudget.test.ts`, dentro del `describe('deliveryModeFor')`:

```ts
  it('skill viaja como catálogo, nunca entero', () => {
    expect(deliveryModeFor('skill')).toBe('catalog')
  })
```

Este test es barato y protege lo que más fácil se rompe: que alguien meta `skill` en `CUSTOM_CONTEXT_KINDS` y lo convierta en un adjunto entero por turno.

- [ ] **Step 2: Ejecuta y verifica que falla**

Run: `npx vitest run src/shared/__tests__/contextBudget.test.ts`
Expected: FAIL — `'skill'` no es asignable a `TabContextKind`.

- [ ] **Step 3: Añade el kind**

En `src/shared/tabContext.ts`, líneas 1-28. Añade `| 'skill'` a `TabContextKind`, y el literal `'skill'` a `ALL_CONTEXT_KINDS` y `CREATABLE_CONTEXT_KINDS`. **No lo añadas a `HOST_CONTEXT_KINDS` ni a `CUSTOM_CONTEXT_KINDS`**: `deliveryModeFor` deriva por exclusión y esa ausencia es justo lo que le da `catalog`.

Añade también su caso en `defaultCreatableStem` y en `canonicalContextName`:

```ts
    case 'skill':
      return 'skill'
```
```ts
    case 'skill':
      return (options.name ?? '').trim() || 'Skill'
```

- [ ] **Step 4: Verifica que el test de entrega pasa**

Run: `npx vitest run src/shared/__tests__/contextBudget.test.ts`
Expected: PASS.

- [ ] **Step 5: Escribe el test de materialización**

En `electron/__tests__/tabContextBuild.test.ts`. Mira primero cómo los tests vecinos montan un proyecto temporal (`mkdtempSync`) y sigue ese patrón exacto en vez de inventar otro.

```ts
it('materializa un skill desde SKILL.md y lo secciona por encabezados', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'gravity-skill-'))
  mkdirSync(join(cwd, '.gravity', 'skills', 'afp-zero'), { recursive: true })
  writeFileSync(
    join(cwd, '.gravity', 'skills', 'afp-zero', 'SKILL.md'),
    ['## Cuándo usarla', 'Al migrar AFP.', '## Pasos', '1. Leer el contrato.'].join('\n'),
  )

  const context: TabContext = {
    id: 'iaterminal:skill:afp-zero',
    name: 'afp-zero',
    fileName: 'afp-zero.md',
    kind: 'skill',
  }
  const result = materializeTabContext(context, cwd)

  expect(result.ok).toBe(true)
  expect(result.content).toContain('## Cuándo usarla')
  expect(result.content).toContain('## Pasos')
  expect(sectionsForContext(context, result).map(s => s.key))
    .toEqual(['Cuándo usarla', 'Pasos'])
})

it('un skill sin SKILL.md en disco no revienta: cuerpo vacío, ok true', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'gravity-skill-'))
  const result = materializeTabContext(
    { id: 'iaterminal:skill:nada', name: 'nada', fileName: 'nada.md', kind: 'skill' },
    cwd,
  )
  expect(result.ok).toBe(true)
  expect(result.content).toContain('(empty)')
})

// Criterio de aceptación 4: install ≠ assign.
it('un SKILL.md en disco no aparece como contexto descubierto', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'gravity-skill-'))
  mkdirSync(join(cwd, '.gravity', 'skills', 'afp-zero'), { recursive: true })
  writeFileSync(join(cwd, '.gravity', 'skills', 'afp-zero', 'SKILL.md'), '## Uno\ncuerpo')

  // discoverTabContexts escanea `.gravity/*.md`, no subcarpetas: instalar una
  // skill no la asigna a nadie. Solo contextIds lo hace.
  const found = discoverTabContexts(cwd)
  expect(found.contexts.some(context => context.kind === 'skill')).toBe(false)
})
```

`discoverTabContexts` ya está exportado desde `electron/tabContextBuild.ts`; importa lo que falte en la cabecera del archivo de test.

- [ ] **Step 6: Ejecuta y verifica que falla**

Run: `npx vitest run electron/__tests__/tabContextBuild.test.ts -t "skill"`
Expected: FAIL — el kind cae al `default` y devuelve `(empty)` incluso con el archivo puesto.

- [ ] **Step 7: Implementa la materialización**

En `electron/tabContextBuild.ts`, dentro del `switch` de construcción de cuerpo (el que termina en el `default: return '(empty)'` de la línea ~957), añade:

```ts
    case 'skill': {
      // El SKILL.md vive en <projectDir>/skills/<id>/SKILL.md. El id del
      // contexto es `iaterminal:skill:<stem>`; el stem es la carpeta.
      const stem = context.id.replace(/^iaterminal:skill:/, '')
        || context.fileName.replace(/\.md$/i, '')
      const path = projectDirPath(root, 'skills', stem, 'SKILL.md')
      return existsSync(path) ? readFileSync(path, 'utf8').trim() || '(empty)' : '(empty)'
    }
```

Usa `projectDirPath` (ya importado en el archivo), **nunca** un literal `.gravity`: hay proyectos legacy en `.iaterminal`.

**No toques `sectionsForContext`**: cae al `else` final y usa `markdownSections`, que parte por `##`/`###`. El seccionado sale gratis.

- [ ] **Step 8: Ejecuta y verifica que pasa**

Run: `npx vitest run electron/__tests__/tabContextBuild.test.ts -t "skill"`
Expected: PASS, 2 tests.

- [ ] **Step 9: i18n del kind nuevo**

`src/i18n/locales/es.ts`, bloque `tabContexts`: `kind_skill: 'Skill',`
`src/i18n/locales/en.ts`: `kind_skill: 'Skill',`

Y el icono por defecto en `src/shared/tabContextAppearance.ts` (`KIND_DEFAULT_ICON`) y `src/renderer/agent/tabContextKindIcons.ts` (`KIND_ICONS`). Usa `'sparkles'`, que ya está en el allowlist `TAB_CONTEXT_ICON_NAMES`, y un color de `TAB_CONTEXT_COLORS`. Si falta alguno de los dos mapas, `tsc` lo dirá: son `Record<TabContextKind, …>` exhaustivos.

- [ ] **Step 10: Suite completa y contrato de UI**

Run: `npm test && npm run check:ui && npx tsc -b 2>&1 | grep -c "error TS"`
Expected: suite verde, `check:ui` OK, conteo en **35**.

- [ ] **Step 11: Commit**

```bash
git add src/shared/tabContext.ts src/shared/tabContextAppearance.ts src/renderer/agent/tabContextKindIcons.ts electron/tabContextBuild.ts src/shared/__tests__/contextBudget.test.ts electron/__tests__/tabContextBuild.test.ts src/i18n/locales/en.ts src/i18n/locales/es.ts
git commit -m "Añade el TabContextKind skill

Entrega por catálogo sin código nuevo: deliveryModeFor deriva por
exclusión de CUSTOM_CONTEXT_KINDS, y sectionsForContext cae a
markdownSections, que parte el SKILL.md por sus encabezados."
```

---

### Task 3: Gate binario de skills nativas

**Files:**
- Modify: `src/shared/agentCliProviders.ts`
- Test: `src/shared/__tests__/agentCliProviders.test.ts` (nuevo)

**Interfaces:**
- Consumes: nada de tareas previas.
- Produces: `AgentCliArgsInput.disableSkills?: boolean`.

- [ ] **Step 1: Escribe el test que falla**

Crea `src/shared/__tests__/agentCliProviders.test.ts`. El caso crítico es el tercero: `--disallowedTools` ya existe para el modo `ask`, y dos apariciones del mismo flag no equivalen a una con las dos listas.

```ts
import { describe, expect, it } from 'vitest'
import { AGENT_CLI_PROVIDERS } from '../agentCliProviders'

const claudeArgs = (over: Partial<Parameters<typeof AGENT_CLI_PROVIDERS.claude.args>[0]> = {}) =>
  AGENT_CLI_PROVIDERS.claude.args({ prompt: 'hola', cwd: '/repo', mode: 'auto', ...over })

/** Valor que sigue a la primera aparición de `flag`, o undefined. */
const valueOf = (args: string[], flag: string): string | undefined => {
  const at = args.indexOf(flag)
  return at === -1 ? undefined : args[at + 1]
}
const countOf = (args: string[], flag: string): number =>
  args.filter(arg => arg === flag).length

describe('claude · gate de skills', () => {
  it('sin disableSkills no emite --disallowedTools en modo auto', () => {
    expect(countOf(claudeArgs(), '--disallowedTools')).toBe(0)
  })

  it('disableSkills en modo auto deniega solo Skill', () => {
    const args = claudeArgs({ disableSkills: true })
    expect(countOf(args, '--disallowedTools')).toBe(1)
    expect(valueOf(args, '--disallowedTools')).toBe('Skill')
  })

  it('modo ask + disableSkills fusionan en UN solo flag', () => {
    const args = claudeArgs({ mode: 'ask', disableSkills: true })
    expect(countOf(args, '--disallowedTools')).toBe(1)
    expect(valueOf(args, '--disallowedTools'))
      .toBe('Edit,Write,NotebookEdit,Bash,MultiEdit,Skill')
  })

  it('modo ask sin disableSkills conserva la lista original', () => {
    expect(valueOf(claudeArgs({ mode: 'ask' }), '--disallowedTools'))
      .toBe('Edit,Write,NotebookEdit,Bash,MultiEdit')
  })
})
```

- [ ] **Step 2: Ejecuta y verifica que falla**

Run: `npx vitest run src/shared/__tests__/agentCliProviders.test.ts`
Expected: FAIL — `disableSkills` no existe en `AgentCliArgsInput`.

- [ ] **Step 3: Implementa**

En `src/shared/agentCliProviders.ts`, añade a `AgentCliArgsInput` (línea ~23):

```ts
  /** Deniega la tool `Skill`: el proceso no puede invocar ninguna skill. */
  disableSkills?: boolean
```

Junto a `withModel` (línea ~55), un helper que fusiona:

```ts
/**
 * `--disallowedTools` una sola vez con todo lo denegado. Emitir el flag dos
 * veces no equivale a una lista fusionada.
 */
const disallowedTools = (mode: AgentPermissionMode, disableSkills?: boolean): string[] => {
  const tools = [
    // Ask: sin escritura. Claude no tiene --mode ask; en -p no hay UI de
    // confirmación, así que bloqueamos herramientas que mutan el workspace.
    ...(mode === 'ask' ? ['Edit', 'Write', 'NotebookEdit', 'Bash', 'MultiEdit'] : []),
    ...(disableSkills ? ['Skill'] : []),
  ]
  return tools.length ? ['--disallowedTools', tools.join(',')] : []
}
```

Y en la entrada `claude` (línea ~64), sustituye la línea del modo `ask` por la llamada al helper:

```ts
    args: ({ prompt, mode, model, sessionId, disableSkills }) => [
      '-p',
      prompt,
      '--output-format',
      'stream-json',
      '--verbose',
      '--include-partial-messages',
      ...(sessionId ? ['--resume', sessionId] : []),
      ...disallowedTools(mode, disableSkills),
      ...(mode === 'auto' ? ['--permission-mode', 'bypassPermissions'] : []),
      ...(mode === 'plan' ? ['--permission-mode', 'plan'] : []),
      ...withModel('--model', model),
    ],
```

- [ ] **Step 4: Ejecuta y verifica que pasa**

Run: `npx vitest run src/shared/__tests__/agentCliProviders.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Suite completa y typecheck**

Run: `npm test && npx tsc -b 2>&1 | grep -c "error TS"`
Expected: suite verde; conteo en **35**.

- [ ] **Step 6: Commit**

```bash
git add src/shared/agentCliProviders.ts src/shared/__tests__/agentCliProviders.test.ts
git commit -m "Añade el gate binario de skills al provider claude

--disallowedTools se emite una sola vez con las listas del modo ask y del
gate fusionadas: dos apariciones del mismo flag no equivalen a una."
```

---

### Task 4: Resolver namespace de plugin → ruta de instalación

**Files:**
- Create: `src/shared/installedPlugins.ts`
- Create: `src/shared/__tests__/installedPlugins.test.ts`
- Create: `electron/pluginDirs.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `interface InstalledPluginEntry { name: string; marketplace: string; installPath: string; scope: string }`
  - `function parseInstalledPlugins(raw: unknown): InstalledPluginEntry[]`
  - `function resolvePluginDirs(namespaces: readonly string[], installed: readonly InstalledPluginEntry[]): string[]`
  - `function readInstalledPlugins(home: string): InstalledPluginEntry[]` (en `electron/pluginDirs.ts`)

- [ ] **Step 1: Escribe los tests que fallan**

Crea `src/shared/__tests__/installedPlugins.test.ts`. La forma real del archivo, tomada de `~/.claude/plugins/installed_plugins.json` en esta máquina:

```ts
import { describe, expect, it } from 'vitest'
import { parseInstalledPlugins, resolvePluginDirs } from '../installedPlugins'

/** Forma real de ~/.claude/plugins/installed_plugins.json (version 2). */
const raw = {
  version: 2,
  plugins: {
    'superpowers@claude-plugins-official': [{
      scope: 'user',
      installPath: '/home/u/.claude/plugins/cache/claude-plugins-official/superpowers/6.2.0',
      version: '6.2.0',
    }],
    'frontend-design@claude-code-plugins': [{
      scope: 'user',
      installPath: '/home/u/.claude/plugins/cache/claude-code-plugins/frontend-design/1.1.0',
      version: '1.1.0',
    }],
  },
}

describe('parseInstalledPlugins', () => {
  it('parte la clave en nombre y marketplace', () => {
    const list = parseInstalledPlugins(raw)
    expect(list).toHaveLength(2)
    expect(list[0]).toMatchObject({
      name: 'superpowers',
      marketplace: 'claude-plugins-official',
      scope: 'user',
    })
  })

  it('tolera basura sin lanzar', () => {
    expect(parseInstalledPlugins(null)).toEqual([])
    expect(parseInstalledPlugins({ plugins: 'no' })).toEqual([])
    expect(parseInstalledPlugins({ plugins: { 'sinArroba': [{ installPath: '/x' }] } })).toEqual([])
    expect(parseInstalledPlugins({ plugins: { 'a@b': [{ scope: 'user' }] } })).toEqual([])
  })
})

describe('resolvePluginDirs', () => {
  const installed = parseInstalledPlugins(raw)

  it('devuelve la ruta del namespace pedido', () => {
    expect(resolvePluginDirs(['superpowers'], installed))
      .toEqual(['/home/u/.claude/plugins/cache/claude-plugins-official/superpowers/6.2.0'])
  })

  it('ignora namespaces que no están instalados, sin lanzar', () => {
    expect(resolvePluginDirs(['ponytail'], installed)).toEqual([])
  })

  it('conserva el orden pedido y no duplica', () => {
    expect(resolvePluginDirs(['frontend-design', 'superpowers', 'frontend-design'], installed))
      .toEqual([
        '/home/u/.claude/plugins/cache/claude-code-plugins/frontend-design/1.1.0',
        '/home/u/.claude/plugins/cache/claude-plugins-official/superpowers/6.2.0',
      ])
  })

  it('lista vacía devuelve vacío', () => {
    expect(resolvePluginDirs([], installed)).toEqual([])
  })
})
```

- [ ] **Step 2: Ejecuta y verifica que falla**

Run: `npx vitest run src/shared/__tests__/installedPlugins.test.ts`
Expected: FAIL — `Failed to resolve import "../installedPlugins"`.

- [ ] **Step 3: Implementa el módulo puro**

Crea `src/shared/installedPlugins.ts`:

```ts
/**
 * Lectura del inventario de plugins del harness.
 *
 * La ruta de instalación lleva la versión dentro
 * (`…/cache/<marketplace>/<plugin>/<version>`), así que **no se puede
 * construir**: un upgrade del plugin la cambia. Se lee siempre del
 * `installed_plugins.json`, que es el índice que mantiene el propio harness.
 *
 * Puro: sin `fs`. Quien lo lea de disco vive en `electron/pluginDirs.ts`.
 */

export interface InstalledPluginEntry {
  /** Nombre del plugin, que es el namespace de sus skills (`superpowers`). */
  name: string
  marketplace: string
  installPath: string
  /** `user` | `project` | `local`, tal como lo escribe el harness. */
  scope: string
}

export function parseInstalledPlugins(raw: unknown): InstalledPluginEntry[] {
  if (!raw || typeof raw !== 'object') return []
  const plugins = (raw as Record<string, unknown>).plugins
  if (!plugins || typeof plugins !== 'object') return []

  const out: InstalledPluginEntry[] = []
  for (const [key, value] of Object.entries(plugins as Record<string, unknown>)) {
    const at = key.lastIndexOf('@')
    if (at <= 0) continue
    const name = key.slice(0, at)
    const marketplace = key.slice(at + 1)
    if (!name || !marketplace || !Array.isArray(value)) continue
    for (const item of value) {
      if (!item || typeof item !== 'object') continue
      const entry = item as Record<string, unknown>
      if (typeof entry.installPath !== 'string' || !entry.installPath.trim()) continue
      out.push({
        name,
        marketplace,
        installPath: entry.installPath,
        scope: typeof entry.scope === 'string' ? entry.scope : 'user',
      })
    }
  }
  return out
}

/** Rutas de los namespaces pedidos, en ese orden, sin duplicados. */
export function resolvePluginDirs(
  namespaces: readonly string[],
  installed: readonly InstalledPluginEntry[],
): string[] {
  const dirs: string[] = []
  for (const namespace of namespaces) {
    for (const entry of installed) {
      if (entry.name !== namespace) continue
      if (!dirs.includes(entry.installPath)) dirs.push(entry.installPath)
    }
  }
  return dirs
}
```

- [ ] **Step 4: Ejecuta y verifica que pasa**

Run: `npx vitest run src/shared/__tests__/installedPlugins.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: El lector de disco**

Crea `electron/pluginDirs.ts`:

```ts
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { parseInstalledPlugins, type InstalledPluginEntry } from '@shared/installedPlugins'

/**
 * Inventario de plugins del harness. Si el archivo no existe o está corrupto,
 * devuelve vacío: un agente sin plugins resolubles arranca sin ninguno, que es
 * el default seguro, en vez de fallar el turno.
 */
export function readInstalledPlugins(home: string): InstalledPluginEntry[] {
  const path = join(home, '.claude', 'plugins', 'installed_plugins.json')
  if (!existsSync(path)) return []
  try {
    return parseInstalledPlugins(JSON.parse(readFileSync(path, 'utf8')) as unknown)
  } catch {
    return []
  }
}
```

- [ ] **Step 6: Suite completa y typecheck**

Run: `npm test && npx tsc -b 2>&1 | grep -c "error TS"`
Expected: suite verde; conteo en **35**.

- [ ] **Step 7: Commit**

```bash
git add src/shared/installedPlugins.ts src/shared/__tests__/installedPlugins.test.ts electron/pluginDirs.ts
git commit -m "Resuelve namespace de plugin a ruta de instalación

La ruta lleva la versión dentro, así que no se puede construir: se lee del
installed_plugins.json que mantiene el harness. Un archivo ausente o
corrupto resuelve a ningún plugin, no a todos."
```

---

### Task 5: Allowlist de namespace en el lanzamiento

**Files:**
- Modify: `src/shared/agentCliProviders.ts`
- Modify: `src/shared/agentCliTypes.ts`
- Modify: `electron/agentCliRuntime.ts`
- Test: `src/shared/__tests__/agentCliProviders.test.ts`

**Interfaces:**
- Consumes: `AgentNativeSkills` (Task 1), `readInstalledPlugins` + `resolvePluginDirs` (Task 4), `disallowedTools` (Task 3).
- Produces: `AgentCliArgsInput.pluginDirs?: string[]`; `AgentCliStartRequest.nativeSkills?: AgentNativeSkills`.

- [ ] **Step 1: Escribe los tests que fallan**

Añade a `src/shared/__tests__/agentCliProviders.test.ts`:

```ts
describe('claude · allowlist de namespace', () => {
  it('siempre excluye el scope de usuario', () => {
    // Sin esto, --plugin-dir solo suma: los plugins de ~/.claude/plugins
    // seguirían siendo descubribles y la allowlist no acotaría nada.
    expect(valueOf(claudeArgs(), '--setting-sources')).toBe('project')
  })

  it('emite un --plugin-dir por ruta, en orden', () => {
    const args = claudeArgs({ pluginDirs: ['/p/superpowers', '/p/ponytail'] })
    expect(countOf(args, '--plugin-dir')).toBe(2)
    const at = args.indexOf('--plugin-dir')
    expect(args.slice(at, at + 4))
      .toEqual(['--plugin-dir', '/p/superpowers', '--plugin-dir', '/p/ponytail'])
  })

  it('sin rutas no emite ningún --plugin-dir', () => {
    expect(countOf(claudeArgs({ pluginDirs: [] }), '--plugin-dir')).toBe(0)
    expect(countOf(claudeArgs(), '--plugin-dir')).toBe(0)
  })
})
```

- [ ] **Step 2: Ejecuta y verifica que falla**

Run: `npx vitest run src/shared/__tests__/agentCliProviders.test.ts`
Expected: FAIL — no hay `--setting-sources` ni `pluginDirs`.

- [ ] **Step 3: Implementa en el provider**

En `AgentCliArgsInput`:

```ts
  /** Rutas de plugin a cargar solo para este spawn. Vacío = ninguna. */
  pluginDirs?: string[]
```

Y en la entrada `claude`, tras `--include-partial-messages`:

```ts
      // Excluye el scope `user`, que es donde el harness instala los plugins
      // (~/.claude/plugins/cache). Sin esta exclusión, --plugin-dir solo suma
      // y la allowlist no acota nada. Verificado con un spawn real.
      '--setting-sources', 'project',
      ...(pluginDirs ?? []).flatMap(dir => ['--plugin-dir', dir]),
```

Y añade `pluginDirs` al destructuring de `args`.

- [ ] **Step 4: Ejecuta y verifica que pasa**

Run: `npx vitest run src/shared/__tests__/agentCliProviders.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Lleva la capacidad en la petición**

En `src/shared/agentCliTypes.ts`, dentro de `AgentCliStartRequest` (línea 20):

```ts
  /** Skills de plugin visibles; omitido = ninguna. */
  nativeSkills?: AgentNativeSkills
  /** Servidores MCP permitidos por id; omitido = ninguno. */
  mcpsAllowed?: string[]
```

Importa `AgentNativeSkills` de `./projectAgentCatalog`.

En `src/renderer/agent/AgentPane.tsx:998`, donde se arma el `request`, añade los dos campos desde el `meta` del agente, siguiendo el estilo de spread condicional de las líneas vecinas:

```ts
      ...(meta.nativeSkills ? { nativeSkills: meta.nativeSkills } : {}),
      ...(meta.mcpsAllowed ? { mcpsAllowed: meta.mcpsAllowed } : {}),
```

**Haz lo mismo en el `retryRequest` de la línea ~1119**, o un reintento lanzaría sin acotar.

- [ ] **Step 6: Resuelve en el runtime**

En `electron/agentCliRuntime.ts`, en `commandAndArgs` (línea ~720), antes del `return`:

```ts
  const nativeSkills = request.nativeSkills
  const pluginDirs = nativeSkills?.enabled
    ? resolvePluginDirs(nativeSkills.namespaces ?? [], readInstalledPlugins(home))
    : []
```

`commandAndArgs` no recibe `home` hoy: añádelo como parámetro y pásalo desde los dos llamadores (`startPhase` en `startAgentTurn`, y `runAgentCliSpawn`), que ya lo tienen.

Y pásalo a `spec.args`:

```ts
      disableSkills: nativeSkills?.enabled !== true,
      pluginDirs,
```

`!== true` y no `=== false`: un agente **sin** `nativeSkills` también queda apagado. Ese es el default seguro de la Task 1, y aquí es donde se hace efectivo.

- [ ] **Step 7: Suite completa, contrato de UI y typecheck**

Run: `npm test && npm run check:ui && npx tsc -b 2>&1 | grep -c "error TS"`
Expected: suite verde, `check:ui` OK, conteo en **35**.

- [ ] **Step 8: Commit**

```bash
git add src/shared/agentCliProviders.ts src/shared/agentCliTypes.ts src/shared/__tests__/agentCliProviders.test.ts electron/agentCliRuntime.ts src/renderer/agent/AgentPane.tsx
git commit -m "Acota las skills de plugin por agente al lanzar

--setting-sources project excluye el scope de usuario, donde el harness
instala los plugins; --plugin-dir vuelve a añadir solo los namespaces
permitidos. Un agente sin nativeSkills queda apagado, no abierto."
```

---

### Task 6: Allowlist de servidores MCP

**Files:**
- Create: `electron/mcpConfigFile.ts`
- Create: `electron/__tests__/mcpConfigFile.test.ts`
- Modify: `src/shared/agentCliProviders.ts`
- Modify: `electron/agentCliRuntime.ts`
- Test: `src/shared/__tests__/agentCliProviders.test.ts`

**Interfaces:**
- Consumes: `AgentCliStartRequest.mcpsAllowed` (Task 5).
- Produces:
  - `AgentCliArgsInput.mcpConfigPath?: string`
  - `function writeScopedMcpConfig(allowed: readonly string[], source: unknown, tmpDir: string): string | null`

- [ ] **Step 1: Escribe los tests del archivo efímero**

Crea `electron/__tests__/mcpConfigFile.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { mkdtempSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { writeScopedMcpConfig } from '../mcpConfigFile'

const source = {
  mcpServers: {
    jira: { command: 'jira-mcp' },
    figma: { command: 'figma-mcp' },
    secreto: { command: 'otro' },
  },
}

describe('writeScopedMcpConfig', () => {
  it('escribe solo los servidores permitidos', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gravity-mcp-'))
    const path = writeScopedMcpConfig(['jira'], source, dir)
    expect(path).toBeTruthy()
    const written = JSON.parse(readFileSync(path!, 'utf8')) as Record<string, unknown>
    expect(written).toEqual({ mcpServers: { jira: { command: 'jira-mcp' } } })
  })

  it('ignora ids permitidos que no existen en la fuente', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gravity-mcp-'))
    const path = writeScopedMcpConfig(['jira', 'inexistente'], source, dir)
    const written = JSON.parse(readFileSync(path!, 'utf8')) as { mcpServers: Record<string, unknown> }
    expect(Object.keys(written.mcpServers)).toEqual(['jira'])
  })

  it('sin permitidos devuelve null: no hay nada que acotar', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gravity-mcp-'))
    expect(writeScopedMcpConfig([], source, dir)).toBeNull()
  })

  it('una fuente inválida produce un config vacío, no una excepción', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gravity-mcp-'))
    const path = writeScopedMcpConfig(['jira'], null, dir)
    const written = JSON.parse(readFileSync(path!, 'utf8')) as { mcpServers: Record<string, unknown> }
    expect(written.mcpServers).toEqual({})
  })

  it('escribe fuera del proyecto: la ruta está bajo el tmpDir dado', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gravity-mcp-'))
    expect(writeScopedMcpConfig(['jira'], source, dir)!.startsWith(dir)).toBe(true)
  })
})
```

El último test protege algo que importa: el archivo **no** puede acabar en `.gravity/`, que se commitea al repo del equipo.

- [ ] **Step 2: Ejecuta y verifica que falla**

Run: `npx vitest run electron/__tests__/mcpConfigFile.test.ts`
Expected: FAIL — `Failed to resolve import "../mcpConfigFile"`.

- [ ] **Step 3: Implementa**

Crea `electron/mcpConfigFile.ts`:

```ts
import { writeFileSync } from 'fs'
import { join } from 'path'

/**
 * `mcp.json` efímero con solo los servidores permitidos para un agente.
 *
 * Va a un temporal del proceso, **nunca** a la carpeta del proyecto: esa se
 * commitea al repo del equipo y esto es config de un spawn concreto.
 */
export function writeScopedMcpConfig(
  allowed: readonly string[],
  source: unknown,
  tmpDir: string,
): string | null {
  if (!allowed.length) return null

  const all = (source && typeof source === 'object'
    ? (source as Record<string, unknown>).mcpServers
    : undefined)
  const servers = all && typeof all === 'object' ? all as Record<string, unknown> : {}

  const scoped: Record<string, unknown> = {}
  for (const id of allowed) {
    if (id in servers) scoped[id] = servers[id]
  }

  const path = join(tmpDir, 'mcp.json')
  writeFileSync(path, JSON.stringify({ mcpServers: scoped }, null, 2), 'utf8')
  return path
}
```

- [ ] **Step 4: Ejecuta y verifica que pasa**

Run: `npx vitest run electron/__tests__/mcpConfigFile.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Los flags en el provider, con su test**

Añade a `src/shared/__tests__/agentCliProviders.test.ts`:

```ts
describe('claude · allowlist de MCP', () => {
  it('con ruta emite --mcp-config y --strict-mcp-config', () => {
    const args = claudeArgs({ mcpConfigPath: '/tmp/x/mcp.json' })
    expect(valueOf(args, '--mcp-config')).toBe('/tmp/x/mcp.json')
    expect(args).toContain('--strict-mcp-config')
  })

  it('sin ruta no emite ninguno de los dos', () => {
    const args = claudeArgs()
    expect(countOf(args, '--mcp-config')).toBe(0)
    expect(args).not.toContain('--strict-mcp-config')
  })
})
```

En `AgentCliArgsInput`:

```ts
  /** Ruta a un mcp.json efímero con solo los servidores permitidos. */
  mcpConfigPath?: string
```

Y en la entrada `claude`, tras los `--plugin-dir`:

```ts
      // --strict-mcp-config es la mitad que acota: sin él, este config se suma
      // a los demás en vez de sustituirlos.
      ...(mcpConfigPath ? ['--mcp-config', mcpConfigPath, '--strict-mcp-config'] : []),
```

- [ ] **Step 6: Conecta el runtime**

En `electron/agentCliRuntime.ts`, junto a la resolución de `pluginDirs` de la Task 5:

```ts
  const mcpConfigPath = request.mcpsAllowed?.length
    ? writeScopedMcpConfig(request.mcpsAllowed, readProjectMcpConfig(cwd), mkdtempSync(join(tmpdir(), 'gravity-mcp-')))
    : null
```

`readProjectMcpConfig(cwd)` no existe: impleméntalo en `electron/mcpConfigFile.ts` leyendo `<cwd>/.mcp.json` con `existsSync` + `JSON.parse` dentro de un `try`, devolviendo `null` si falla. Es el archivo estándar del harness y **no** va bajo `projectDirPath`.

Pasa `...(mcpConfigPath ? { mcpConfigPath } : {})` a `spec.args`.

- [ ] **Step 7: Suite completa y typecheck**

Run: `npm test && npx tsc -b 2>&1 | grep -c "error TS"`
Expected: suite verde; conteo en **35**.

- [ ] **Step 8: Commit**

```bash
git add electron/mcpConfigFile.ts electron/__tests__/mcpConfigFile.test.ts src/shared/agentCliProviders.ts src/shared/__tests__/agentCliProviders.test.ts electron/agentCliRuntime.ts
git commit -m "Acota los servidores MCP por agente

Un mcp.json efímero en un temporal del proceso, más --strict-mcp-config
para que sustituya la configuración existente en vez de sumarse. Nunca
en la carpeta del proyecto, que se commitea."
```

---

### Task 7: Capacidades por proveedor y UI

**Files:**
- Modify: `src/shared/agentCliProviders.ts`
- Modify: `src/renderer/agent/AgentConfigSettingsPane.tsx`
- Modify: `src/i18n/locales/en.ts`, `src/i18n/locales/es.ts`
- Test: `src/shared/__tests__/agentCliProviders.test.ts`

**Interfaces:**
- Consumes: `AGENT_CLI_PROVIDERS`, `AgentNativeSkills` (Task 1).
- Produces: `function providerCapabilities(provider: AgentCliProvider): { nativeSkills: boolean; mcpAllowlist: boolean }`.

- [ ] **Step 1: Escribe el test que falla**

Añade a `src/shared/__tests__/agentCliProviders.test.ts`:

```ts
import { providerCapabilities } from '../agentCliProviders'

describe('capacidades por proveedor', () => {
  it('claude soporta las dos', () => {
    expect(providerCapabilities('claude')).toEqual({ nativeSkills: true, mcpAllowlist: true })
  })

  it('los proveedores sin flags verificados no soportan ninguna', () => {
    // Fallar visible, no en silencio: la UI deshabilita lo que no puede
    // acotar en vez de prometerlo.
    expect(providerCapabilities('cursor')).toEqual({ nativeSkills: false, mcpAllowlist: false })
  })
})
```

- [ ] **Step 2: Ejecuta y verifica que falla**

Run: `npx vitest run src/shared/__tests__/agentCliProviders.test.ts`
Expected: FAIL — `providerCapabilities` no existe.

- [ ] **Step 3: Implementa**

En `src/shared/agentCliProviders.ts`, añade al tipo de entrada del registro:

```ts
  /**
   * Qué sabe acotar este CLI por spawn. Omitido = nada.
   * Solo se marca `true` con el flag verificado contra el `--help` del CLI,
   * igual que el resto de la tabla.
   */
  capabilities?: { nativeSkills?: boolean; mcpAllowlist?: boolean }
```

En la entrada `claude`: `capabilities: { nativeSkills: true, mcpAllowlist: true },`

Los otros ocho se quedan sin el campo. Y el accesor:

```ts
export function providerCapabilities(
  provider: AgentCliProvider,
): { nativeSkills: boolean; mcpAllowlist: boolean } {
  const caps = AGENT_CLI_PROVIDERS[provider].capabilities
  return {
    nativeSkills: caps?.nativeSkills === true,
    mcpAllowlist: caps?.mcpAllowlist === true,
  }
}
```

- [ ] **Step 4: Ejecuta y verifica que pasa**

Run: `npx vitest run src/shared/__tests__/agentCliProviders.test.ts`
Expected: PASS.

- [ ] **Step 5: La sección de la UI**

`AgentConfigSettingsPane.tsx` está organizado por secciones (`section === 'engine'`, `'permissions'`, `'orchestration'`). **Lee primero** cómo `'permissions'` (línea ~222) monta las suyas y sigue ese patrón exacto.

Añade `'capabilities'` a `AgentConfigSettingsSection` y una rama nueva con:

- Un `SettingToggle` para `nativeSkills.enabled`, deshabilitado si `!providerCapabilities(meta.provider).nativeSkills`, con el motivo visible.
- Con el toggle encendido, un `TextArea` con un namespace por línea (`superpowers`, `ponytail`…), que escribe a `nativeSkills.namespaces`. Un selector con el catálogo real de plugins instalados necesitaría un canal IPC sobre `readInstalledPlugins` que este plan no incluye; el `TextArea` es la entrega de esta tarea, no un provisional.
- Un bloque equivalente para `mcpsAllowed`, deshabilitado si `!providerCapabilities(meta.provider).mcpAllowlist`.

`SettingToggle` es del UI kit: **sin `className` ni `style`**. `npm run check:ui` falla si se los pasas.

- [ ] **Step 6: i18n en los dos locales**

`src/i18n/locales/es.ts`:

```ts
    capabilities: 'Capacidades',
    nativeSkills: 'Skills de plugin',
    nativeSkillsHint: 'Sin esto, el agente hereda todos los plugins instalados en la máquina.',
    nativeSkillsUnsupported: '{{provider}} no permite acotar las skills al lanzar.',
    namespaces: 'Plugins permitidos (uno por línea)',
    mcpsAllowed: 'Servidores MCP permitidos (uno por línea)',
    mcpsUnsupported: '{{provider}} no permite acotar los servidores MCP al lanzar.',
```

`src/i18n/locales/en.ts`:

```ts
    capabilities: 'Capabilities',
    nativeSkills: 'Plugin skills',
    nativeSkillsHint: 'Without this, the agent inherits every plugin installed on the machine.',
    nativeSkillsUnsupported: '{{provider}} cannot scope skills at launch.',
    namespaces: 'Allowed plugins (one per line)',
    mcpsAllowed: 'Allowed MCP servers (one per line)',
    mcpsUnsupported: '{{provider}} cannot scope MCP servers at launch.',
```

Ponlas en el bloque que ya usa `AgentConfigSettingsPane` (mira qué prefijo usan sus `t()` actuales y respétalo).

- [ ] **Step 7: Suite completa, contrato de UI y typecheck**

Run: `npm test && npm run check:ui && npx tsc -b 2>&1 | grep -c "error TS"`
Expected: suite verde, `check:ui` OK, conteo en **35**.

- [ ] **Step 8: Commit**

```bash
git add src/shared/agentCliProviders.ts src/shared/__tests__/agentCliProviders.test.ts src/renderer/agent/AgentConfigSettingsPane.tsx src/i18n/locales/en.ts src/i18n/locales/es.ts
git commit -m "Declara capacidades por proveedor y las expone en el modal

Los ocho CLIs sin flags verificados muestran el control deshabilitado con
el motivo: prometer un acotado que no se aplica es peor que no ofrecerlo."
```

---

### Task 8: Medición de coste

**Files:**
- Modify: `src/shared/ipcChannels.ts`
- Modify: `electron/main.ts`
- Modify: `electron/preload.ts`
- Modify: `electron/agentCliRuntime.ts`
- Test: `electron/__tests__/contextDeliveryMetrics.test.ts` (nuevo)

**Interfaces:**
- Consumes: `ContextDeliveryMetrics` (`electron/agentCliRuntime.ts:89`).
- Produces: `window.api.getContextDeliveryMetrics(): Promise<ContextDeliveryMetrics & { inputTokens: number; outputTokens: number }>`.

- [ ] **Step 1: Escribe el test que falla**

Crea `electron/__tests__/contextDeliveryMetrics.test.ts`:

```ts
import { describe, expect, it, beforeEach } from 'vitest'
import {
  clearContextDeliveryMetrics,
  getContextDeliveryMetrics,
  recordTurnUsage,
} from '../agentCliRuntime'

describe('métricas de entrega de contexto', () => {
  beforeEach(() => clearContextDeliveryMetrics())

  it('acumula tokens de varios turnos', () => {
    recordTurnUsage({ inputTokens: 1200, outputTokens: 300 })
    recordTurnUsage({ inputTokens: 800, outputTokens: 150 })
    expect(getContextDeliveryMetrics()).toMatchObject({ inputTokens: 2000, outputTokens: 450 })
  })

  it('ignora valores que no son números finitos', () => {
    recordTurnUsage({ inputTokens: Number.NaN, outputTokens: 10 })
    expect(getContextDeliveryMetrics()).toMatchObject({ inputTokens: 0, outputTokens: 10 })
  })

  it('clear deja los contadores en cero', () => {
    recordTurnUsage({ inputTokens: 5, outputTokens: 5 })
    clearContextDeliveryMetrics()
    expect(getContextDeliveryMetrics()).toMatchObject({ inputTokens: 0, outputTokens: 0 })
  })
})
```

- [ ] **Step 2: Ejecuta y verifica que falla**

Run: `npx vitest run electron/__tests__/contextDeliveryMetrics.test.ts`
Expected: FAIL — `recordTurnUsage` no existe.

- [ ] **Step 3: Implementa el acumulador**

En `electron/agentCliRuntime.ts`, extiende `ContextDeliveryMetrics` (línea 89) con `inputTokens: number` y `outputTokens: number`, añádelos al objeto `contextDeliveryMetrics` (línea 97) inicializados a 0, y añade:

```ts
/** Suma el uso reportado por el CLI en el evento final de un turno. */
export function recordTurnUsage(usage: { inputTokens?: number; outputTokens?: number }): void {
  if (Number.isFinite(usage.inputTokens)) {
    contextDeliveryMetrics.inputTokens += usage.inputTokens as number
  }
  if (Number.isFinite(usage.outputTokens)) {
    contextDeliveryMetrics.outputTokens += usage.outputTokens as number
  }
}
```

Asegúrate de que `clearContextDeliveryMetrics` (línea 109) también pone los dos a 0.

- [ ] **Step 4: Ejecuta y verifica que pasa**

Run: `npx vitest run electron/__tests__/contextDeliveryMetrics.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Captura el uso del stream**

`normalizeClaudeEvent` (`electron/agentCliRuntime.ts:307`) ya recibe los eventos NDJSON. El evento `result` de Claude trae `usage.input_tokens` / `usage.output_tokens`. **Léelo del evento real antes de escribir el mapeo** — imprime un evento en un turno de prueba y confirma la forma; no asumas los nombres.

Llama a `recordTurnUsage` desde donde se procesa el evento final del turno.

- [ ] **Step 6: Expón por IPC**

Los cuatro sitios:

`src/shared/ipcChannels.ts`: `CONTEXT_METRICS_GET: 'contextMetrics:get',`

`electron/main.ts`, junto a los handlers de contexto:

```ts
  ipcMain.handle(IPC.CONTEXT_METRICS_GET, () => getContextDeliveryMetrics())
```

`electron/preload.ts`:

```ts
  getContextDeliveryMetrics() {
    return ipcRenderer.invoke(IPC.CONTEXT_METRICS_GET)
  },
```

El llamador es la comparación manual del paso siguiente; no hace falta UI en esta tarea.

- [ ] **Step 7: La comparación antes/después**

Es el criterio de aceptación 6 y **no se puede automatizar** aquí: necesita la app corriendo. Documenta en tu informe el procedimiento exacto para quien tenga la app abierta:

1. Un agente sin `nativeSkills`, un prompt fijo, `clearContextDeliveryMetrics()` antes, `getContextDeliveryMetrics()` después.
2. El mismo agente con `nativeSkills: { enabled: true, namespaces: ['superpowers'] }`, mismo prompt.
3. La diferencia de `inputTokens` es el coste del plugin. Contrástala con lo que reporta `claude plugin details superpowers` (~688 always-on) como comprobación de cordura.

- [ ] **Step 8: Suite completa y typecheck**

Run: `npm test && npm run check:ui && npx tsc -b 2>&1 | grep -c "error TS"`
Expected: suite verde, `check:ui` OK, conteo en **35**.

- [ ] **Step 9: Commit**

```bash
git add src/shared/ipcChannels.ts electron/main.ts electron/preload.ts electron/agentCliRuntime.ts electron/__tests__/contextDeliveryMetrics.test.ts
git commit -m "Acumula tokens por turno y expone las métricas de contexto

ContextDeliveryMetrics ya contaba catálogo y secciones pero no salía de
main ni contaba tokens. Es la medición que justifica todo el mecanismo."
```

---

## Verificación final

- [ ] `npm test` — verde, con **cinco** archivos de test más que al empezar (`agentCliProviders`, `installedPlugins`, `mcpConfigFile`, `contextDeliveryMetrics`, más los casos añadidos a tres existentes).
- [ ] `npm run check:ui` — verde.
- [ ] `npx tsc -b 2>&1 | grep -c "error TS"` — **35**, igual que al empezar.
- [ ] Los seis criterios de aceptación del spec, uno por uno.
- [ ] Con la app abierta: un agente `claude` con `nativeSkills` apagado no puede invocar skills; otro con `namespaces: ['superpowers']` no ve `ponytail:*`; un agente `cursor` muestra los dos controles deshabilitados con su motivo.
- [ ] La comparación de tokens antes/después, documentada en el PR.
