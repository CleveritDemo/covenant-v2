# Spec A — Capacidades por agente: kind `skill`, gate de skills nativas y MCP por spawn

Fecha: 2026-08-07
Deriva de: spec «resolución de capacidades por agente», borrador del 2026-08-07
Evidencia: `docs/superpowers/specs/2026-08-07-capacidades-agente-hallazgos.md`

## Problema

Un agente de Covenant Gravity hoy solo controla **una** de sus tres fuentes de capacidad. Los
contextos se asignan con `contextIds` (`ProjectAgentDefinition`, `.gravity/agents/<id>.json`).
Las otras dos no se controlan en absoluto:

- **Skills nativas del harness.** El proceso hereda todos los plugins instalados en la máquina.
  En este equipo son `superpowers`, `ponytail`, `frontend-design`, `context7` — decenas de skills
  con trigger dinámico por matching de `description`, ninguna elegida para ese agente.
- **Servidores MCP.** Lo mismo: el CLI carga la configuración MCP que encuentre.

El coste no es teórico: `claude plugin details superpowers` reporta **~688 tokens always-on
añadidos a cada sesión**, solo por ese plugin, más ~800–3.600 por skill al invocarse. Un agente
QA carga el arsenal de refactor de otro plugin en cada turno sin usarlo nunca.

Y falta un bucket de entrega para las skills propias (CDLC): hoy solo caben como `notes`, que se
adjunta **entero** en cada turno.

## Objetivo

Que la definición de un agente declare qué ve su proceso, y que Covenant lo traduzca a flags de
lanzamiento. Tres piezas, todas verificadas contra el `--help` real de los CLIs:

1. Un `TabContextKind` nuevo, `skill`, con entrega por catálogo.
2. Un gate de skills nativas por agente: apagado total, o allowlist por namespace de plugin.
3. Una allowlist de servidores MCP por agente.

Más la medición de tokens que justifica todo lo anterior.

## No objetivos

- **ACL por skill individual.** La unidad mínima es el namespace de plugin. `--plugin-dir` carga
  plugins enteros; no hay flag por skill suelta.
- **Filtrar las skills built-in del harness** (`dataviz`, `code-review`, `run`, `init`…). No son
  plugins y `--plugin-dir` no las toca. Solo el gate binario las alcanza.
- **Sincronizar el catálogo de plugins con CDLC.** La promoción es manual y deliberada.
- **Integrar el backend CDLC.** Este spec lee `SKILL.md` de disco; cómo llega ahí es otro spec.
- **Tocar `cwd`.** El diseño original proponía un `cwd` efímero con symlinks; resultó innecesario
  (ver «Mecanismo verificado») y habría roto seis puntos de la runtime (ver hallazgos).

## Mecanismo verificado

Todo se resuelve con flags por spawn. Comprobado con un lanzamiento real en un directorio vacío:

```
claude --setting-sources project \
       --plugin-dir ~/.claude/plugins/cache/claude-plugins-official/superpowers/6.2.0 \
       -p "List every skill name available to you"
```

Devolvió los 14 `superpowers:*` y **ninguna** de `ponytail:*`, `frontend-design:*` ni `context7`.
Las built-in del harness siguieron presentes.

| Capacidad | Flag | Efecto |
|---|---|---|
| Apagar skills nativas | `--disallowedTools Skill` | el proceso no puede invocar ninguna skill |
| Allowlist de namespace | `--setting-sources project` + un `--plugin-dir` por namespace | solo esos plugins son descubribles |
| Allowlist de MCP | `--mcp-config <file>` + `--strict-mcp-config` | ignora cualquier otra configuración MCP |

`--setting-sources project` es la mitad que importa: excluye el scope `user`, que es donde se
instalan los plugins (`~/.claude/plugins/cache/`). Sin esa exclusión, `--plugin-dir` solo suma.

## Diseño

### 1. Dónde vive la decisión

En `ProjectAgentDefinition` (`src/shared/projectAgentCatalog.ts:31`), junto a `contextIds`. **No
un archivo nuevo.** El eje que este repo separa es compartible-vs-local, no config-vs-manifest: la
definición se commitea con el repo del equipo, y `session.json` guarda solo el binding local.

```ts
export interface ProjectAgentDefinition {
  // … campos existentes, incluido contextIds
  /** Skills de plugin del harness. Omitido = ninguna (fail closed). */
  nativeSkills?: {
    enabled: boolean
    /** Namespaces de plugin permitidos, p. ej. ['superpowers']. Vacío = ninguno. */
    namespaces?: string[]
  }
  /** Servidores MCP permitidos por id. Omitido = ninguno. */
  mcpsAllowed?: string[]
}
```

Nombres en `camelCase` para seguir el archivo; el borrador usaba `snake_case`.

**Por defecto, ninguna.** Un agente sin `nativeSkills` no ve plugins. Es un cambio de
comportamiento respecto a hoy (donde ve todo) y es deliberado: el default seguro es el que no
cuesta tokens ni sorprende. Ver «Riesgos».

### 2. El kind `skill`

```ts
export type TabContextKind =
  | 'folderTree' | 'files' | 'symbols' | 'notes'
  | 'git' | 'deps' | 'readme' | 'changelog' | 'agentResult'
  | 'skill'   // NUEVO
```

Se añade a `ALL_CONTEXT_KINDS` y `CREATABLE_CONTEXT_KINDS`, y **a ninguno de los dos buckets**.
No hace falta el `SECTIONED_CONTEXT_KINDS` que proponía el borrador:

```ts
export function deliveryModeFor(kind: TabContextKind): ContextDelivery {
  return (CUSTOM_CONTEXT_KINDS as readonly TabContextKind[]).includes(kind) ? 'whole' : 'catalog'
}
```
(`src/shared/contextBudget.ts:28`)

Deriva por exclusión: lo que no es `CUSTOM` ya entrega `catalog`. Y el seccionado también sale
gratis — `sectionsForContext` (`src/shared/contextSections.ts`) cae al `else` final y usa
`markdownSections`, que parte por `##`/`###`. Un `SKILL.md` con encabezados se secciona solo.

**Origen del contenido:** `.gravity/skills/<id>/SKILL.md`, leído de disco como cualquier otro
contexto. `materializeTabContext` copia su cuerpo al `.md` del contexto con los marcadores
habituales. Cómo llega ese `SKILL.md` a la carpeta (CDLC, `git clone`, a mano) queda fuera.

**`install ≠ assign`:** que exista un `SKILL.md` en `.gravity/skills/` no lo activa en ningún
agente. Solo `contextIds` lo hace.

### 3. Traducción a flags

El punto de extensión ya existe: `AgentCliArgsInput` (`src/shared/agentCliProviders.ts:23`), que
cada proveedor traduce en su `args()`. Se le añaden dos campos:

```ts
export interface AgentCliArgsInput {
  // … prompt, cwd, mode, model, sessionId
  /** Rutas de plugin a cargar; vacío = ninguna. */
  pluginDirs?: string[]
  /** Ruta a un mcp.json efímero con solo los servidores permitidos. */
  mcpConfigPath?: string
}
```

Para `claude` (`:64`):

```ts
args: ({ prompt, mode, model, sessionId, pluginDirs, mcpConfigPath }) => [
  // … lo existente
  '--setting-sources', 'project',
  ...(pluginDirs ?? []).flatMap(dir => ['--plugin-dir', dir]),
  ...(mcpConfigPath ? ['--mcp-config', mcpConfigPath, '--strict-mcp-config'] : []),
]
```

`--disallowedTools` ya se usa para el modo `ask` (`:74`). Cuando además haya que apagar las
skills, hay que **fusionar** las dos listas y emitir el flag **una sola vez**; dos apariciones del
mismo flag no son equivalentes.

El `mcp.json` efímero lo escribe Covenant antes del spawn, filtrando la configuración conocida por
`mcpsAllowed`, en un temporal del proceso (no en `.gravity/`, que se commitea).

### 4. Los otros ocho proveedores

Estos flags son de `claude`. Los otros ocho (`cursor`, `copilot`, `codex`, …) no tienen
equivalente verificado.

**Fallar visible, no en silencio.** El criterio de aceptación dice «verificable por ausencia de la
tool `Skill`»; no enforcar y decir que sí es peor que no ofrecerlo. Se añade a la entrada del
registro una capacidad declarada:

```ts
/** Qué sabe acotar este CLI por spawn. */
capabilities?: { nativeSkills?: boolean; mcpAllowlist?: boolean }
```

La UI del agente deshabilita los controles que su proveedor no soporta, con el motivo a la vista.
Verificar el `--help` de cada CLI y rellenar la tabla es parte de la implementación, no una
suposición. El registro ya declara que «los flags están verificados contra el `--help` de cada
CLI»; esto mantiene esa promesa.

### 5. Medición

Criterio de aceptación 6, y la justificación de todo lo demás.

- **Ya existe la mitad.** `ContextDeliveryMetrics` (`electron/agentCliRuntime.ts:89`) cuenta
  `catalogChars`, `sectionsRequested`, `sectionsDelivered`, `sectionsPreattached`. Cuenta
  caracteres, no tokens, y no está expuesta por IPC.
- **El coste de plugins es consultable sin instrumentar.** `claude plugin details <name>` reporta
  always-on y on-invoke por componente. Con eso, la UI puede mostrar el coste de un namespace
  **antes** de permitirlo — que es la pregunta 7 del borrador, resuelta con datos y no con una
  heurística nueva.
- **Los tokens reales vienen del stream.** Los eventos NDJSON del CLI ya traen conteo de uso; hay
  que capturarlos en el normalizador y acumularlos por turno.

Entregable: una comparación antes/después sobre el mismo proyecto y el mismo prompt, con un agente
sin acotar y otro con `nativeSkills` apagado, documentada en el PR.

## Criterios de aceptación

1. Un agente con `nativeSkills.enabled = false` no puede invocar ninguna skill de plugin,
   verificable porque la tool `Skill` no está en su sesión.
2. Un agente con `namespaces: ['superpowers']` no ve `ponytail:*` aunque ambos estén instalados.
   **Ya verificado a mano; el test lo fija.**
3. Un contexto `skill` asignado por `contextIds` se entrega como `catalog`, nunca `whole`.
4. Poner un `SKILL.md` en `.gravity/skills/` no modifica el `contextIds` de ningún agente.
5. Un agente cuyo proveedor no soporta el gate muestra el control deshabilitado con el motivo, y
   **no** lanza como si estuviera acotado.
6. Medición de tokens por turno con y sin el mecanismo, documentada en el PR.

## Tests

Siguiendo la convención del repo — lógica pura en `src/shared/`, ops en `electron/`, nada de
componentes:

- `src/shared/__tests__/contextBudget.test.ts` — extender: `deliveryModeFor('skill')` es
  `catalog`. Una línea, y protege el punto 3 contra que alguien meta `skill` en `CUSTOM`.
- `src/shared/__tests__/agentCliProviders.test.ts` — que `claude` emita `--setting-sources
  project`, un `--plugin-dir` por namespace, y `--mcp-config` + `--strict-mcp-config` solo cuando
  hay ruta. Y el caso que más fácil se rompe: `mode: 'ask'` **más** skills apagadas emiten **un
  solo** `--disallowedTools` con las dos listas fusionadas.
- `electron/__tests__/mcpConfigFile.test.ts` — el `mcp.json` efímero contiene solo los servidores
  de `mcpsAllowed`, y se escribe fuera de `.gravity/`.
- `src/shared/__tests__/projectAgentCatalog.test.ts` — extender: un agente sin `nativeSkills`
  normaliza a «ninguna», no a «todas» (el default seguro).

## Orden de implementación

1. **Kind `skill`** — tres arrays y el caso de materialización. Con un `SKILL.md` puesto a mano ya
   se prueba de punta a punta; no depende de nada más.
2. **Gate binario** — `nativeSkills.enabled` + `--disallowedTools Skill` fusionado con el de
   `ask`. Cubre el criterio 1.
3. **Allowlist de namespace** — resolver namespace → ruta de plugin y emitir los `--plugin-dir`.
   Cubre el criterio 2.
4. **MCP** — el `mcp.json` efímero y sus dos flags.
5. **Capacidades por proveedor y UI** — la tabla, con el `--help` de cada CLI verificado.
6. **Medición** — exponer `ContextDeliveryMetrics` por IPC y capturar el uso del stream.

Los pasos 1 y 2 ya entregan valor y son los más baratos.

## Riesgos

- **Resolver namespace → ruta de plugin.** Hoy se hace leyendo
  `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/`, con la versión en la ruta. Un
  upgrade del plugin cambia la ruta. Existe `~/.claude/plugins/installed_plugins.json`; **leerlo
  antes de asumir el layout**.
- **`--setting-sources project` excluye más que plugins.** También deja fuera settings de usuario
  que el agente quizá esperaba. Hay que comprobar qué se pierde antes de aplicarlo a todos los
  agentes, no solo a los acotados.
- **El default seguro rompe expectativas.** Los agentes existentes pasan a no ver plugins. Es lo
  correcto, pero necesita una nota en el changelog y, probablemente, una migración que active
  explícitamente lo que hoy está implícito.
