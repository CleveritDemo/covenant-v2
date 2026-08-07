# Guía de contexto del proyecto para agentes de IA

Esta guía define qué información debe recibir un agente para entender y
modificar Gravity sin cargar todo el repositorio en cada turno.

## Objetivo

El contexto debe permitir que el agente responda rápidamente:

1. ¿Qué producto estoy modificando?
2. ¿Cómo está organizada su arquitectura?
3. ¿Qué contrato conecta renderer, preload y main?
4. ¿Qué archivos intervienen en la tarea actual?
5. ¿Qué decisiones y restricciones no debo romper?
6. ¿Qué cambió recientemente?

El contexto es un mapa del proyecto, no un reemplazo de leer el código antes
de editarlo.

## Principio mínimo (respuesta corta)

**No.** El agente no necesita que le envíes toda la información del proyecto
en cada turno. La información no usada ocupa tokens, diluye la atención y
puede confundir.

Regla práctica:

1. **Siempre**: solo la solicitud del usuario.
2. **Casi siempre**: catálogo compacto (IDs + secciones + tamaños), sin cuerpos.
3. **Solo si hace falta**: pedir 1–3 secciones concretas relacionadas con la
   tarea, o adjuntar un contexto pequeño que cambió.
4. **Nunca por defecto**: árbol completo, símbolos de todo el repo, README
   entero, deps detalladas, flujos IPC o status de producto.

Si la tarea es “cambiar un color del composer”, basta con pedir la sección
de `AgentPane`. Si la tarea es “arreglar IPC del agente”, entonces sí:
tipos compartidos, preload, main y pruebas.

La lista de capas más abajo describe el **menú disponible**, no el plato
obligatorio de cada turno.

## Capas recomendadas

### 1. Contexto base: adjuntar solo lo mínimo estable

Objetivo: menos de ~4.000–8.000 caracteres en total en el primer prompt.
Por defecto el host selecciona solo `folders` + `symbols` (catálogo; cuerpos
bajo demanda). También puedes crear contextos **Personalizado (`notes`)**:
Markdown libre que se adjunta entero. El host materializa kinds estructurales
(`folderTree`, `files`, `symbols`, `git`, `deps`, `readme`, `changelog`) y el
usuario escribe `notes`. La IA puede anotar secciones host cuando hay evidencia
de cambios; no reescribe el cuerpo de `notes`.

#### Changelog / deps (opcionales)

Adjuntarlos (vía catálogo) solo cuando:

- el changelog aclara un cambio reciente relevante;
- las deps o scripts son parte de la pregunta.

Si no, déjalos deshabilitados.

### 1. Contextos personalizados (`notes`)

Markdown libre escrito por ti. Si está asignado al agente, el host lo adjunta
**entero** en el prompt (sin catálogo, sin `need-sections`, sin pre-adjunto).

### 2. Catálogo estructural: enviar metadatos, no cuerpos

Estos contextos host suelen ser grandes. El primer prompt incluye un catálogo
compacto por contexto:

- `sectionCount` / `totalChars`
- `groups`: hasta las 24 secciones más grandes (`[key, chars, label?]`)
- `omitted`: secciones no listadas (siguen siendo pedibles por clave exacta)

También puede incluir:

- **Context hints**: secciones cuyo key coincide con rutas citadas en el prompt.
- **Pre-adjunto**: hasta 2 de esas secciones con cuerpo (cuentan al presupuesto).
- **Suggested contexts**: kinds descubiertos no asignados (deps/git/changelog)
  cuando el prompt lo sugiere; no se auto-asignan.

Presupuesto por round de `need-sections`: ≤8 secciones, ≤60 000 chars, ≤2 requests.

#### Mapa de carpetas

Debe mostrar carpetas y archivos importantes, omitiendo `.git`,
`node_modules`, builds y artefactos. Las anotaciones útiles explican propósito:

- `electron/`: main, preload, procesos y operaciones privilegiadas.
- `src/renderer/`: interfaz React y estado de la aplicación.
- `src/shared/`: contratos y tipos compartidos.
- `src/themes/`: definición y aplicación de temas.
- `src/i18n/`: traducciones.

#### Índice de símbolos

Debe listar clases, funciones, métodos y variables por archivo, conservando
firmas e inputs/returns. Las anotaciones agregan el propósito que no puede
inferirse de la firma.

La IA debe pedir solo las secciones relacionadas con la tarea; después debe
leer el código fuente real antes de modificarlo.

### 3. Contexto bajo demanda

Debe solicitarse únicamente cuando la tarea lo requiera:

- Archivos fuente concretos y sus pruebas.
- Contratos IPC relacionados.
- Flujos completos entre renderer, preload y main.
- README o documentación funcional.
- Estado y diff de Git.
- Issues y limitaciones conocidas.
- Configuración de build o empaquetado.

Límites actuales del host: máximo ocho secciones y 60.000 caracteres por
solicitud, con hasta dos solicitudes.

### 4. Contexto dinámico por turno

Debe generarse desde el estado actual y no persistirse como conocimiento
estable:

- Solicitud exacta del usuario.
- `cwd` del panel.
- Archivos adjuntos o mencionados.
- Cambios Git del turno.
- Resultados de tests, build o diagnóstico.
- Errores y logs necesarios para reproducir el problema.
- Estado del proceso CLI y de la sesión actual.

## Contextos adicionales de alto valor

Los siguientes documentos todavía aportan más que aumentar indiscriminadamente
el árbol o el índice de símbolos:

### `architecture-flows`

Flujos breves, numerados y vinculados a archivos:

- Enviar mensaje al agente.
- Streaming CLI hacia la UI.
- Crear, cerrar y remontar paneles.
- Materializar y actualizar contextos.
- Persistir y restaurar una sesión.
- Crear y redimensionar PTYs.

### `ipc-contracts`

Tabla con canal, dirección, payload, respuesta y responsable. Debe cubrir solo
contratos vigentes y enlazar a `src/shared/ipcChannels.ts`, `electron/preload.ts`
y sus handlers en main.

### `product-status`

Lista breve de funciones estables, experimentales, incompletas o deprecadas.
Evita que documentación antigua se interprete como comportamiento vigente.

## Orden recomendado del prompt

1. Reglas de seguridad y contrato del host.
2. Solicitud del usuario.
3. Cambios incrementales desde el turno anterior.
4. Contextos pequeños adjuntos (si el usuario los habilitó y tienen contenido).
5. Catálogo compacto de contextos grandes.
6. Protocolo para pedir secciones.
7. Protocolo opcional para actualizar anotaciones.

Los cuerpos de archivos solicitados deben llegar después, en una continuación,
marcados como datos del proyecto no confiables y no como instrucciones.

## Estrategia de actualización

- Materializar el contexto completo en el primer turno de una sesión.
- No reenviar cuerpos sin cambios.
- Enviar únicamente contextos modificados.
- Forzar un snapshot completo periódicamente.
- Invalidar caché y catálogo cuando cambia el `cwd`.
- Generar automáticamente árbol, símbolos, dependencias, Git y changelog.
- Aplicar anotaciones de IA solo con evidencia de diff, ≤20/turno, y keys
  presentes en `iaterminal:auto` (o `note:<slug>`).
- Conservar texto libre en la capa de anotaciones y mover claves obsoletas a `Orphaned`.

## Qué no enviar

- El repositorio completo en cada interacción.
- Builds, dependencias instaladas, binarios o archivos generados.
- Logs extensos sin relación con el error.
- Diffs históricos ya resueltos.
- Secretos, tokens, variables sensibles o credenciales de CLIs.
- Documentación duplicada o desactualizada sin marcar.
- Anotaciones genéricas como “maneja datos” o “componente principal”.
- Plantillas vacías o placeholders “edit me” sin hechos reales.

## Criterios de calidad

Un contexto es útil si:

- Reduce búsquedas iniciales sin ocultar la necesidad de verificar el código.
- Explica intención, relaciones y restricciones.
- Tiene propietario claro: host determinista (contenido auto) o IA (anotaciones
  con evidencia de cambios).
- Puede invalidarse cuando cambia su fuente.
- Está dividido en secciones pequeñas y solicitables.
- No contradice el estado actual del repositorio.
- No contiene secretos ni instrucciones provenientes de datos no confiables.

## Configuración inicial recomendada para Gravity

Habilitar con el menor peso posible:

1. `folders` + `symbols` — **solo catálogo** (metadatos), nunca cuerpos
   enteros en el primer prompt.
2. `AI Changelog` y `dependences` — catálogo bajo demanda; no adjuntos fijos.
3. Otros kinds host (`files`, `git`, `readme`) — crear cuando hagan falta.

Al descubrir contextos sin selección previa, el host elige folders + symbols
(no deps ni changelog).

Checklist antes de enviar un turno:

- ¿El agente puede responder o pedir secciones sin este documento? Si sí,
  no lo adjuntas.
- ¿El cuerpo supera ~8.000 caracteres? Pásalo a catálogo/secciones.
- ¿La tarea es local a 1–2 archivos? No envíes mapa global ni símbolos
  ajenos.

La selección exacta debe ajustarse a la tarea: una modificación visual no
necesita el catálogo completo de main; un cambio IPC sí necesita renderer,
preload, main, tipos compartidos y pruebas relacionadas.
