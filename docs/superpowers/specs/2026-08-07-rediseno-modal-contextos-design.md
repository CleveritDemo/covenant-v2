# Rediseño del modal de contextos

Fecha: 2026-08-07

Mockup interactivo y diagnóstico visual:
<https://claude.ai/code/artifact/eefb584c-d5c6-4ea0-bce7-495078ffae9c>

## Problema

Toda la arquitectura de contextos existe para gastar menos tokens: catálogo compacto,
`need-sections`, techos de 8 secciones y 60.000 caracteres por ronda
(`docs/AI_PROJECT_CONTEXT_GUIDE.md`). El formulario que los crea no menciona ninguna de esas
cifras.

Siete problemas concretos en `TabContextsEditor.tsx` y `TabContextFormModal.tsx`:

1. **Los ocho tipos pesan lo mismo.** Una rejilla plana de botones idénticos que esconde la única
   distinción con consecuencias: `HOST_CONTEXT_KINDS` los materializa el host desde el disco,
   `notes` lo escribe la persona, `agentResult` lo escribe un agente
   (`src/shared/tabContext.ts:13-18`).
2. **Icono y color ocupan ~40 % del alto.** Catorce iconos y doce colores siempre desplegados
   (`TabContextsEditor.tsx:126-160`) para dos decisiones cosméticas que se toman una vez.
3. **La configuración del tipo va al final.** El orden actual es tipo → nombre → archivo →
   cosmética → configuración. Elegir «Classes and methods» y tener que pasar por catorce iconos
   antes de indicar qué carpeta indexar es el formulario al revés.
4. **El presupuesto es invisible.** Ni secciones, ni caracteres, ni cuánto de los 60.000 se ocupa.
   La cifra existe —`buildContextSectionCatalog` la calcula— pero solo aparece al pulsar
   *Preview*, en un panel aparte, después de haber decidido.
5. **Tres acciones sin jerarquía.** *Preview*, *Regenerate* y *Save*, del mismo tamaño y en fila;
   cuál escribe en disco no se deduce de mirarlas. Encima `handleDismiss`
   (`TabContextFormModal.tsx:281-295`) llama a `save()` al cerrar con Esc o clic fuera, algo que
   ningún botón anuncia.
6. **La ruta del `.md` es texto muerto.** El archivo es el producto del contexto —lo que el equipo
   comparte por git— y no se puede abrir ni revelar en el Finder.
7. **Nada dice cómo llegará al prompt.** `notes` se adjunta entero; `folderTree` viaja como
   catálogo y el modelo pide secciones. Es la diferencia entre cientos y decenas de miles de
   tokens por turno, y la decisión se toma en este formulario sin que el formulario la nombre.

## Objetivo

Que el modal responda una pregunta antes de guardar: **¿qué le va a llegar al agente, y cuánto
pesa?** Todo lo demás —nombre, icono, color— es secundario respecto a eso y hoy está delante.

## No objetivos

- **Calcular nada nuevo.** Los números salen de funciones que ya se llaman:
  `sectionsForContext` devuelve las secciones con su tamaño y `buildContextSectionCatalog` las
  agrupa. El rediseño deja de esconderlas, no las inventa.
- **Tocar `electron/`.** El rediseño es de renderer más una función pura en `src/shared/`.
- **Cambiar el formato en disco, los ids canónicos ni el pipeline de prompts.**
- **Editar contextos `changelog` o `agentResult`.** Siguen siendo de solo lectura.
- **Añadir el tipo `mcp`.** Va en su propio spec (ver «Relación con MCP»).

## Arquitectura

### 1. `src/shared/contextBudget.ts` (nuevo)

La única lógica no trivial del rediseño, extraída como función pura para que sea testeable — el
patrón del repo. Sin React, sin `fs`.

```ts
export type ContextDelivery = 'catalog' | 'whole'
export type BudgetLevel = 'ok' | 'warn' | 'over'

export interface ContextBudgetSummary {
  sections: number
  chars: number
  /** Estimación cruda chars/4; se rotula como estimación en la UI. */
  estimatedTokens: number
  delivery: ContextDelivery
  level: BudgetLevel
  /** chars / MAX_SECTION_REQUEST_CHARS, saturado a 1. */
  ratio: number
}

export function deliveryModeFor(kind: TabContextKind): ContextDelivery
export function summarizeContextBudget(
  sections: readonly { chars: number }[],
  kind: TabContextKind,
): ContextBudgetSummary
```

`deliveryModeFor` deriva de `CUSTOM_CONTEXT_KINDS` (`tabContext.ts:18`): esos kinds se adjuntan
enteros, el resto viaja como catálogo. No se duplica la lista.

Umbrales de `level`: `ok` bajo el 55 % del presupuesto, `warn` entre 55 % y 85 %, `over` por
encima. El presupuesto de referencia son los 60.000 caracteres por ronda de `need-sections`.

### 2. `TabContextsEditor.tsx` — dos paneles

```
┌─ configuración ──────────────────┬─ salida ──────────────┐
│ Tipos, agrupados por origen      │ Presupuesto (en vivo) │
│   Del repositorio · host         │   secciones           │
│   Escrito a mano                 │   caracteres          │
│   Fuente externa                 │   tokens estimados    │
│                                  │   barra + píldora     │
│ Configuración del tipo           ├───────────────────────┤
│   (root, rutas, symbolKinds…)    │ Vista previa          │
│                                  │   permanente,         │
│ Nombre + botón «Aspecto»         │   con debounce        │
│ Ruta · Mostrar en Finder         │                       │
└──────────────────────────────────┴───────────────────────┘
```

Los cambios, cada uno contra su hallazgo:

| Cambio | Resuelve |
|---|---|
| Tipos agrupados por origen, en chips | 1 |
| Icono y color detrás de un botón «Aspecto» | 2 |
| Configuración del tipo justo bajo los chips | 3 |
| Medidor de secciones, caracteres y tokens | 4 |
| Dos acciones: *Descartar* y *Guardar contexto* | 5 |
| Ruta con «Mostrar en Finder» | 6 |
| Píldora *Catálogo* / *Entero* junto al medidor | 7 |

**`Preview` deja de ser un botón** y pasa a ser el estado permanente del panel derecho.
`Regenerate` desaparece como acción separada: guardar ya materializa.

### 3. Popover de aspecto (componente nuevo del UI kit)

Icono y color pasan de dos `fieldset` siempre abiertos a un botón que abre un popover.
Restricción de `.cursor/rules/frontend-components.mdc`: **props tipadas, sin `className` ni
`style`**. `npm run check:ui` debe pasar.

### 4. `TabContextFormModal.tsx`

- Pie con dos acciones en lugar de tres.
- Preview con debounce (ver «Rendimiento»).
- `handleDismiss` deja de guardar en silencio.

## Cambios de comportamiento

Dos, y no son de maquetación. Conviene decidirlos explícitamente:

**Cerrar con Esc o clic fuera deja de guardar.** Hoy `handleDismiss` llama a `save()`
(`TabContextFormModal.tsx:294`). Pasa a: con cambios pendientes, preguntar; sin cambios, cerrar.
El guardado implícito al descartar es la clase de comportamiento que hace que la gente no se
atreva a cerrar un diálogo.

**Ya no hay `Regenerate`.** Su función —rematerializar y reescribir el `.md`— la hace *Guardar
contexto*. Para los contextos host la vista previa en vivo ya rematerializa, así que el botón
pierde su razón de ser.

## Rendimiento

El medidor en vivo es el único riesgo real. Materializar `symbols` sobre un repo grande cuesta, y
hoy eso solo pasa al pulsar *Preview*.

Mitigación en dos capas: debounce sobre los campos de texto, más el caché existente por
`materializationSignature` (`tabContextBuild.ts:1377`), que devuelve el resultado memorizado
cuando el mtime no cambió.

Si eso no basta, el escape es recalcular solo al cambiar de tipo o al salir de un campo (`blur`)
en vez de en cada tecla. **Medir antes de decidir**: la señal es el tiempo de
`materializeTabContext` para un contexto `symbols` sobre este mismo repo.

## Tests

`src/shared/__tests__/contextBudget.test.ts`:

- `deliveryModeFor`: `notes` y `agentResult` → `whole`; los siete host kinds → `catalog`.
- `summarizeContextBudget`: suma de caracteres y conteo de secciones; los tres umbrales de
  `level` en sus fronteras (54 %, 55 %, 84 %, 85 %); `ratio` saturado a 1 cuando se pasa;
  lista de secciones vacía.

No hay tests de componente: `CLAUDE.md` concentra la cobertura en `src/shared/` y `electron/`, y
favorece extraer lógica antes que testear React. Por eso el presupuesto sale del componente y vive
en `contextBudget.ts`.

Además, `npm run check:ui` es parte de la definición de terminado: el popover de aspecto es
justo el tipo de componente que tienta a pasar un `className`.

## Relación con MCP

Independiente. Este rediseño se puede implementar y mergear solo, y el spec de MCP
(`2026-08-07-mcp-como-contexto-design.md`, en esta misma carpeta) también, sobre un modal sin
rediseñar.

Ahora bien, el orden importa. Un contexto `mcp` pide cuatro campos que ningún otro pide (servidor,
herramienta, argumentos, frecuencia de refresco) y trae dos estados propios («sin credenciales»,
«el último refresco falló, estás viendo el snapshot de las 14:02»). En la columna vertical actual
son cuatro filas más empujando la cosmética todavía más abajo, y los estados no tienen dónde
vivir. En el panel de configuración caben, y los estados van al medidor, que es donde ya está
mirando quien va a guardar.

**Recomendación: este spec primero.** Si se invierte, MCP paga el coste de encajar en un
formulario que se va a rehacer.

## Coste estimado

| Archivo | Qué pasa | ~líneas |
|---|---|---|
| `src/shared/contextBudget.ts` | Nuevo, puro | +45 |
| `TabContextsEditor.tsx` | Reestructurado en dos paneles | +180 / −90 |
| `TabContextsEditor.css` | Rejilla de dos columnas, chips, medidor | +140 |
| `TabContextFormModal.tsx` | Pie de dos acciones, dismiss, debounce | +40 / −25 |
| Popover de aspecto | Componente nuevo del UI kit | +70 |
| `src/i18n/locales/{en,es}.ts` | Cadenas nuevas en los dos idiomas | +30 |

Ningún archivo de `electron/` cambia.
