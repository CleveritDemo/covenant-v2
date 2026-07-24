# Design Language
<!-- iaterminal:context {"version":1,"id":"iaterminal:notes:Design-Language","name":"Design Language","fileName":"Design-Language.md","kind":"notes","icon":"sparkles","color":"#f472b6"} -->

<!-- iaterminal:auto -->


_(truncated by size limit; set a narrower Root folder)_
<!-- /iaterminal:auto -->

<!-- iaterminal:notes -->
# Design Language v2 — Guía de utilización

> Documento de referencia para humanos e IA. Objetivo: **rediseñar** toda la aplicación hacia el sistema en `src/components/ui/v2/` — reestructuración de páginas y componentes de dominio, no solo sustitución visual de primitivos — con coherencia visual, semántica y arquitectónica.

---

## 1. Intención del diseño

> **Patrón canónico de layout:** §6.11. **Variantes de ruta:** §6.13. **Proceso de rediseño legacy → v2:** §2.7. **Migración de modales:** §5.5.1. **Tipografía modal (obligatoria):** §5.5 + §6.12. Tokens: **§6** y **§3**.

El design language v2 busca **limpieza y pureza premium** y un **sistema homogéneo**: cualquier pantalla del sidebar debe sentirse parte del mismo producto. La interfaz es mayormente **sólida y legible**; el material líquido/vidrio aparece **solo donde el usuario actúa** — botones, menús, toggles, FABs.

### Dos capas de la UI

| Capa | Qué es | Material | Ejemplos |
|---|---|---|---|
| **Contenido** | Lo que el usuario lee, navega y comprende | Superficies sólidas o semi-opacas, tipografía clara, bordes suaves | `Card`, `PageHeaderV2`, textos, tablas, grids, `Input`, `Select`, layouts |
| **Controles interactivos** | Lo que el usuario pulsa, arrastra o despliega | Material líquido/vidrio (`LiquidSurface` → `LiquidPill` y composites) | Botones circulares, dropdowns, segmented controls, FABs, tiles seleccionables |

**Regla de oro:** si el elemento **no recibe click, hover o focus** como acción principal, **no debería ser líquido**. El vidrio comunica *“aquí puedes actuar”*, no decora el contenido.

### Principios visuales

| Principio | Qué significa en la UI |
|---|---|
| **Pureza** | Espacios respirados, jerarquía tipográfica clara, fondos calmados. El contenido manda; los controles son puntos de acción localizados. |
| **Líquido solo en interacción** | Translucidez, `backdrop-filter`, reflejos y deformación líquida **exclusivos de controles** (pills, dropdowns, groups, FABs). Cards, headers y formularios permanecen sobrios. |
| **Acentos de color** | El color no satura la pantalla. En contenido: badges puntuales y bordes sutiles. En controles: el acento tiñe el vidrio líquido al hover/activo. |
| **Efecto wow / envolvencia** | Microinteracciones en controles (squish, morph, cursor glow) y momentos puntuales (partículas en header, aurora en modal). El wow **no cubre** toda la página. |
| **Componentización extrema** | Cada patrón repetible vive en un componente. Las páginas **componen**, no estilizan. |

### Sensación que debe transmitir una pantalla v2

- El **contenido** se siente estable, premium y fácil de escanear — como papel de alta calidad, no como un panel de cristal.
- Los **controles** se sienten vivos: al pasar el mouse, el vidrio refleja el acento, se deforma y responde.
- Headers, modales y FABs pueden tener **presencia envolvente** (sombras, auroras, partículas), pero el cuerpo de la página sigue siendo legible y sobrio.

---

## 2. Reglas inviolables para rediseño

Estas reglas aplican a **todo código nuevo** y a **todo rediseño** de pantallas legacy.

> **Rediseño ≠ migración de componentes.** Cambiar `rsuite` por `Input` v2 en una página legacy **no** es rediseño. Rediseño es **rearmar la página** como orquestador v2 (§6.11), **reimaginar** cards/modales/filtros de dominio y **preservar toda la funcionalidad** existente.

### 2.1 Prohibido: `className` y estilos inline desde el consumidor

```tsx
// ❌ PROHIBIDO — el consumidor no estiliza
<LiquidPill className="mt-4 bg-red-500" />
<Input style={{ width: 300 }} />
<Card className="shadow-2xl" />

// ✅ CORRECTO — usar props semánticas del componente
<LiquidPill variant="rose" size="md" active />
<Input size="compact" variant="indigo" label="Nombre" />
<Card shadow="elevated" padding="comfortable" />
```

**Por qué:** los componentes v2 encapsulan su apariencia. Si falta una variante, **extiende el componente**, no lo parcheas desde fuera.

**Excepciones documentadas:** algunos layouts (`AppPageLayoutV2`, `Modal`, `Drawer`) exponen props de layout interno (`contentClassName`, `frameClassName`) — solo para composición de página, nunca para cambiar la estética del primitivo.

### 2.2 Prohibido: dependencias CSS externas a nivel de página

```tsx
// ❌ PROHIBIDO
import styles from "./MiPagina.module.css";
import styled from "styled-components";

// ❌ PROHIBIDO — Tailwind ad-hoc en páginas para recrear UI del sistema
<div className="rounded-full bg-white/20 backdrop-blur-md border border-white/30" />
```

**Regla:** el estilo líquido vive en `liquid-surface.module.css` y **solo debe usarse en controles interactivos**. El resto de componentes v2 (cards, inputs, modales, layouts) llevan su estética **dentro de su propio archivo**, sin copiar el material vidrio. Una página solo importa componentes v2 — nunca recrea vidrio con Tailwind ad-hoc.

### 2.3 `LiquidSurface` es la fuente de verdad del material líquido — solo para controles

El material vidrio/líquido **no define toda la app**. Define **cómo se ven y se sienten los controles interactivos** (botones, menús, toggles visuales).

```
LiquidSurface          ← único owner del CSS líquido (liquid-surface.module.css)
  └── LiquidPill       ← shape + size + layout icon/text
        ├── LiquidPillDropdown      ← menús de acciones / menú ⋯
        ├── LiquidSelectList        ← select de ítem único (valor + label)
        ├── LiquidPillExpandButton  ← acción con reveal
        ├── LiquidPillGroup         ← tabs / segmented control
        ├── LiquidPillGroupVertical ← listas de opciones
        ├── LiquidFixedCircleButton ← FABs
        └── LiquidSwitch            ← track pill + thumb circle (toggle)
              └── SwitcherV2        ← label / description / layout
```

- **Nunca** dupliques gradientes, sombras, bordes reactivos o animaciones de squish fuera de `LiquidSurface`.
- **Nunca** envuelvas cards, secciones de texto o contenedores de contenido en `LiquidSurface` por estética — usa `Card`, `AppPageLayoutV2`, etc.
- **Nunca** modifiques el aspecto líquido en un composite hijo; cambia `LiquidSurface` y el cambio se propaga a todos los controles.
- Usa `LiquidPill` (o un composite) para **cualquier control clickeable** que deba sentirse líquido.
- `LiquidSurface` con `interactive={false}` solo en casos excepcionales (showcase de variantes, preview interno del design system) — **no** en pantallas de producto.

### 2.4 Si no existe el componente idóneo, créalo o reimagínalo

Cuando encuentres un patrón que no encaja en ningún componente v2:

1. **Inventaria la funcionalidad** — qué hace el legacy (datos, filtros, acciones, permisos, navegación). El rediseño **no puede perder** ningún flujo.
2. **Busca** el composite más cercano en `src/components/ui/v2/`.
3. **Si el legacy es un bloque monolítico** (biblioteca con header propio, grid embebido, portal fullscreen), **descomponlo**: orquestador `*PageV2` + `*CardV2` + `*ModalContentV2` + estados de página.
4. **Crea** un nuevo archivo en `components/ui/v2/<dominio>/` siguiendo:
   - Convención de props (`variant`, `size`, `active`, `disabled`, `aria-label`).
   - Sin `className`/`style` expuestos al consumidor (`never` cuando aplique).
   - Z-index desde `z-index.ts`; animaciones desde `motion.ts`.
   - Contenido sólido (`Card`, tipografía §6.12); controles líquidos (`LiquidPill*`) según §6.11.6.
5. **Exporta** desde `index.ts` del dominio y, si es reutilizable, desde `components/ui/v2/index.ts`.
6. **No envuelvas** el legacy “tal cual” dentro de `MaintainerGridPageV2` — eso es wrapper, no rediseño.

**Foco extremo en componetización:** si un patrón aparece 2+ veces, debe ser componente. Las páginas son ensambladores, no diseñadores.

### 2.5 Regla de posicionamiento dual (dropdowns y expand buttons)

Componentes con estado colapsado/abierto (`LiquidPillDropdown`, `LiquidPillExpandButton`, `SidebarLiquidButton`):

| Estado | Posicionamiento | Z-index |
|---|---|---|
| **Colapsado / idle** | In-flow (`static`). No portal. No z-index. | `auto` |
| **Abierto / expandido** | Portal o `absolute` dentro de wrapper relativo | `Z_INDEX.DROPDOWN` (3000) |

Esto garantiza que un botón cerrado **nunca flote sobre el navbar** (`Z_INDEX.NAVBAR = 6000`).

### 2.6 Regla de material reactivo (`reactive`)

`reactive={true}` activa `backdrop-filter` y borde sensible al fondo. Requiere que el componente esté **in-tree** (no portaleado a `body`) para que el blur vea el contenido detrás.

- `LiquidFixedCircleButton`: default `portal={false}` cuando `reactive`.
- Si necesitas portal + reactive: usa `#app-main-scroll` como contenedor.

### 2.7 Proceso de rediseño legacy → v2

> **Este documento es la especificación.** Las implementaciones existentes en el codebase sirven como referencia práctica al codificar, pero **no se duplican aquí** — las reglas deben bastar para rediseñar cualquier pantalla en una sesión nueva sin depender de rutas concretas.

Procedimiento **obligatorio** para transformar una pantalla legacy en una pantalla v2 homogénea. Aplica a maintainer, usuario y widgets del sidebar.

#### 2.7.1 Qué es y qué no es rediseño

| Es rediseño v2 | No es rediseño v2 |
|---|---|
| Thin route → `*PageV2` orquestador con data, estados y slots §6.11 | Montar `MaintainerGridPageV2` y embeber el componente legacy dentro |
| Header único `PageHeaderV2` con 2–3 badges informativas | Header gradient custom, stats cards, título duplicado en hijo |
| Toolbar / meta bar / paginación en slots canónicos | Búsqueda y paginación `rsuite` dentro del hijo legacy |
| Grid o tabla con `*CardV2` / `MaintainerDataTableV2` de dominio | `GridCardConstructor`, filas ad-hoc, cards sueltas sin shell §6.6 |
| Preview / crear / editar en `Modal` v2 (`overlays`) | `usePortal`, drawer legacy, `SideModal` |
| CTAs de listado en `LiquidPill` (card, toolbar, paginación) | `Button` shadcn (`@/components/ui/*`) o `rsuite` en cards de listado |
| Componente faltante **creado** siguiendo §2.4 | Parche visual sobre legacy sin descomponer |

#### 2.7.2 Fases del rediseño (orden fijo)

```
① Auditoría funcional     → listar queries, mutaciones, filtros, permisos, navegación, empty/error
② Tipo de ruta            → elegir composite §6.11.2 + variante §6.13
③ Orquestador *PageV2     → mover data fetching y estado de página al orquestador
④ Shell de página         → MaintainerGridPageV2 | MaintainerListPageV2 + slots ①–⑩
⑤ Subcomponentes dominio  → *CardV2, *LoadingStateV2, *GuideDialogV2, *ModalContentV2
⑥ Overlays y FAB          → Modal/Dialog en overlays; crear en MaintainerFabStackV2 si aplica
⑦ Definition of Done      → checklist §2.7.4 — todos los ítems antes de dar por cerrado
```

**Regla de oro:** la ruta (`pages/app/...`) solo importa y monta `*PageV2`. Toda la lógica de presentación del listado vive en el orquestador, no en `components/_Pages/` ni en bibliotecas legacy.

#### 2.7.3 Inventario mínimo por capa

| Capa | Responsabilidad | Artefactos típicos |
|---|---|---|
| **Ruta thin** | Enrutar | `pages/app/<ruta>/index.tsx` → `<FooPageV2 />` |
| **Orquestador** | Data, filtros, paginación, permisos, slots | `FooMaintainerPageV2.tsx` / `FooUserPageV2.tsx` |
| **Layout composite** | Árbol fijo §6.11.1 | `MaintainerGridPageV2` o `MaintainerListPageV2` |
| **Ítem de listado** | Una entidad en grid/tabla | `FooCardV2.tsx` (shell §6.6–§6.7) |
| **Formulario / preview** | Contenido de modal | `FooCreateModalContentV2.tsx`, `FooPreviewModalContentV2.tsx` |
| **Estados** | Loading / empty / error | `FooLoadingStateV2.tsx` → `PageLoadingStateV2` |
| **Onboarding** | Guía opcional | `FooGuideDialogV2` → `InteractiveGuideDialogV2` |

Si el legacy mezclaba header + filtros + grid + portal en un solo archivo, **partir** según esta tabla.

#### 2.7.4 Definition of Done — rediseño completo

Una pantalla **solo está rediseñada** cuando cumple **todos** los ítems aplicables a su tipo de ruta (§6.13):

**Estructura (todas las rutas con `PageHeaderV2`):**

- [ ] Ruta thin; orquestador `*PageV2` posee data y estados (no delega layout a legacy).
- [ ] `MaintainerGridPageV2` o `MaintainerListPageV2` — sin layout ad-hoc ni wrappers de dominio en header.
- [ ] Orden de slots ①→⑩ respetado (§6.11.1).
- [ ] `PageHeaderV2`: `leadingIcon`, `particleIcon`, **2–3 badges `LiquidPill sm tinted`** (§6.11.3); icono grande, partículas y pills usan la variante del item principal del sidebar.
- [ ] Sin CTAs en header; crear → FAB; secundarias → toolbar.

**Listados (CRUD, lectura, tabla):**

- [ ] Toolbar según §6.11.5 cuando hay búsqueda o filtros (incl. filtros avanzados: `LiquidPill` circle + panel en `Card`).
- [ ] `PageMetaBarV2` cuando el listado muestra datos (paginado o carga completa).
- [ ] `PagePaginationFooterV2` si hay paginación server-side.
- [ ] Tres estados: loading inicial, empty/noResult, con datos (+ error con reintento si aplica).
- [ ] Contenido: grid `gap-4` 1/2/3 + `*CardV2` **o** `MaintainerDataTableV2` — no grid/fila legacy.

**Cards e interacción:**

- [ ] Cada ítem: `Card` shell §6.6 (`fullHeight`, hero `h-28` si aplica, meta pills `xs`).
- [ ] CTAs primarios de card/listado: `LiquidPill as="button"` — no `Button` shadcn en listados.
- [ ] Menú ⋯ / acciones secundarias: `LiquidPillDropdown`; confirmación destructiva: `Dialog` / `Modal` v2.
- [ ] Preview in-page: `Modal` en slot `overlays`, no portal ni drawer legacy.

**Calidad técnica:**

- [ ] Imports de UI desde `components/ui/v2` en orquestador y cards de dominio.
- [ ] Sin `rsuite`, CSS modules ni vidrio Tailwind ad-hoc en la página (§2.1–§2.3).
- [ ] Funcionalidad legacy verificada: mismos filtros, acciones, permisos y rutas de navegación.
- [ ] Exportaciones en `components/ui/v2/<dominio>/index.ts`.

#### 2.7.5 Señales de rediseño incompleto

Si aparece **cualquiera** de estos indicios, la pantalla sigue siendo legacy envuelta o parcial:

| Señal | Acción |
|---|---|
| 0–1 badges en header | Completar 2–3 badges §6.11.3 |
| Hijo legacy con header/filtros/paginación propios | Absorber en orquestador; reducir hijo a datos o eliminarlo |
| `@/components/ui/button`, `shadcn`, `TableActions`, `Avatar` legacy en capa v2 | Sustituir por primitivos v2 §6.11.6–§6.11.8 |
| `GridCardConstructor`, `GroowLoader` en orquestador | `*CardV2`, `PageLoadingStateV2` |
| Contador en badge sin `font-semibold` | Ajustar §6.11.3 |
| Iconos de badge header ≠ `h-4 w-4` | Ajustar §6.12 |

---

## 2.8 Iconografía — solo Lucide

**Contrato único para iconos de UI:**

```tsx
// ✅ JSX directo (preferido)
import { User, Search, Settings } from "lucide-react";
<User className="h-4 w-4" />

// ✅ Icono como prop tipada
import { LucideIconV2 } from "components/ui/v2";
<LucideIconV2 icon={User} size="md" />

// ✅ Módulos del sidebar (clave semántica)
import { ModuleIcon } from "components/ui/v2";
<ModuleIcon module="explore" size={28} />

// ✅ Ilustraciones / empty states / assets
import { MediaImage } from "components/ui/v2";
<MediaImage src="/svg/empty.svg" width={120} height={120} alt="" />
```

| Prohibido | Usar en su lugar |
|---|---|
| `components/Icon`, `icon-v2`, `IconLucide` | `lucide-react` |
| `ICONS_MODULES_PATHS` + `<img>` / `SVG` para menú | `ModuleIcon module="..."` |
| `text-xs` solo para tamaño de icono Lucide | `h-3 w-3` / `h-4 w-4` / tokens `LucideIconV2` |
| Font Awesome tuples `["fal","user"]` | import nombrado Lucide |

**Tamaños canónicos (`ICON_SIZES`):** `xs` 12 · `sm` 14 · `md` 16 · `lg` 24 · `xl` 40. En menús de sesión preferir **18px** (`h-[18px] w-[18px]`). Sidebar módulos: **28px** (`h-sidebar-icon`).

**Nombres dinámicos (datos legacy):** preferir `LucideIcon` en props. Si el backend sigue mandando un string, mapear con `STATIC_LUCIDE_ICONS[faToLucideName(name)]` — no introducir wrappers nuevos.

---

## 3. Tokens del sistema

### 3.1 Variantes de color (`CircleActionVariant`)

Definidas en `circle-action-variants.ts`. 14 variantes:

`ocean` · `sky` · `indigo` · `violet` · `fuchsia` · `rose` · `sunset` · `coral` · `emerald` · `mint` · `lime` · `cyan` · `gold` · `slate`

**Guía semántica:**

| Variante | Usar para |
|---|---|
| `slate` | Acciones neutras, iconografía secundaria, estados idle |
| `indigo` / `violet` | Acciones primarias de producto, CTAs principales |
| `ocean` / `sky` / `cyan` | Navegación, exploración, enlaces contextuales |
| `emerald` / `mint` / `lime` | Éxito, confirmación, progreso positivo |
| `rose` / `coral` / `sunset` | Destacados cálidos, celebración, alertas suaves |
| `gold` | Gamificación, XP, recompensas, premium |
| `fuchsia` | Destacados especiales, novedades |

### 3.2 Z-index (`z-index.ts`)

Importar siempre desde `@/components/ui/v2/z-index`. Escala:

```
12000  TOAST
11000  MODAL
10990  MODAL_BACKDROP
10800  DRAWER / SIDE_PANE
10790  DRAWER_BACKDROP
 6000  NAVBAR / SIDEBAR
 5600  QUICKIE_PANEL
 5500  FIXED_CIRCLE (FABs)
 5000  EXPLORE_REACTION
 3000  DROPDOWN / TOOLTIP / POPOVER (abiertos)
 auto  BASE (contenido, pills cerradas)
```

### 3.3 Movimiento (`motion.ts`)

| Token | Uso |
|---|---|
| `V2_MOTION.ease.standard` | Transiciones utilitarias |
| `V2_MOTION.ease.liquid` | Morphs grandes (dropdown open/close) |
| `V2_MOTION.ease.liquidSoft` | CTAs compactos |
| `V2_MOTION.ease.premiumReveal` | Reveal horizontal de labels (expand buttons) |

---

## 4. Árbol de decisión — ¿Qué componente usar?

```
¿El usuario interactúa con ello (click / hover / toggle)?
├── NO → capa de contenido
│   ├── Layout de página → AppPageLayoutV2 / *PageLayoutV2
│   ├── Contenedor de datos → Card / ExploreCardFrame
│   ├── Encabezado → PageHeaderV2
│   ├── Campo de formulario → Input / Textarea / Select / Checkbox / Switch
│   ├── CTA de formulario o modal → Button (LiquidPill tinted + selectionSolid) / ModalButtons en footer
│   ├── Overlay de contenido → Modal / Dialog
│   └── Estado vacío / carga → PageEmptyState / Loader / NoResult
│
└── SÍ → capa de control (material líquido / vidrio)
    ├── ¿Elige UN valor y debe verse el label elegido? → LiquidSelectList
    ├── ¿Elige VARIOS valores (chips / checklist)? → MultiSelectFilterV2 / TagPickerV2
    ├── ¿Ejecuta acciones (menú ⋯, exportar, editar…)? → LiquidPillDropdown
    ├── ¿Acción única con label en hover? → LiquidPillExpandButton
    ├── ¿Fijo en viewport (FAB)? → LiquidFixedCircleButton
    ├── ¿Tabs / segmented control? → LiquidPillGroup
    ├── ¿Botón circular suelto in-flow? → LiquidPill shape="circle"
    ├── ¿Trigger no circular (avatar, texto)? → GlassDropdown
    ├── ¿Tile seleccionable con icono grande? → GlassTile
    ├── ¿Chip / filtro toggle compacto? → GlassBadge / GlassBadgeGroup
    └── ¿Sidebar / rail legacy? → SidebarLiquidButton / CircleActionButton
```

### 4.1 Selectores líquidos — cuándo cada uno

| Intención | Componente | Trigger cerrado | Cardinalidad | Ejemplos |
|---|---|---|---|---|
| **Seleccionar un valor** (campo / filtro con valor visible) | `LiquidSelectList` | Pill con **label + chevron**; ancho = ítem más largo | **1** | Categoría AnonyBox, tipo de solicitud, prioridad en form |
| **Seleccionar varios valores** | `MultiSelectFilterV2` / `TagPickerV2` | Campo sólido v2 + chips / conteo | **N** | Tags, responsables múltiples, filtros multi-categoría |
| **Ejecutar acciones** (no “guardar un valor”) | `LiquidPillDropdown` | Círculo **solo ícono** (`MoreHorizontal`, `Filter`+etiqueta externa, etc.) | n/a (acciones) | Menú ⋯ de card, Editar/Clonar/Eliminar, Exportar |

**Regla rápida:**
- Si al elegir cambia un **dato del formulario o filtro** y el usuario debe **leer qué eligió** en el botón → `LiquidSelectList`.
- Si puede marcar **varios** a la vez → `MultiSelectFilterV2` / `TagPickerV2` (nunca `LiquidSelectList` ni `LiquidPillDropdown` para multi).
- Si el ítem del menú **dispara una acción** (navegar, mutar, abrir modal) y no deja un valor persistente en el trigger → `LiquidPillDropdown`.

**Prohibido cruzar roles:**
- No usar `LiquidPillDropdown` como select de formulario con label en el trigger.
- No usar `LiquidSelectList` para menús de tres puntos o acciones secundarias.
- No usar `LiquidSelectList` / `LiquidPillDropdown` para multi-selección.

---

## 5. Catálogo de componentes

Import path canónico: `import { ... } from "@/components/ui/v2"` o `components/ui/v2`.

### Familias por material

| Familia | Material | Rol |
|---|---|---|
| **Liquid\*** (`LiquidPill`, `LiquidPillDropdown`, …) | Vidrio líquido | Controles interactivos principales |
| **Glass\*** (`GlassBadge`, `GlassDropdown`, `GlassTile`) | Vidrio clásico | Controles interactivos alternativos / compactos |
| **Button**, **Input**, **Select**, … | Sólido / semi-opaco | Formularios y CTAs de acción explícita |
| **Card**, **PageHeaderV2**, layouts | Sólido premium | Contenedores y estructura de contenido |
| **Modal**, **Dialog** | Panel elevado (no líquido) | Overlays de contenido |

---

### 5.1 Controles interactivos — material líquido (`Liquid*`)

#### `LiquidSurface`
**Archivo:** `liquid-surface.tsx` + `liquid-surface.module.css`

**Qué es:** Primitivo interno del material vidrio/líquido. **No es un componente de página.**

**Cuándo usarlo:**
- Como base interna de `LiquidPill` y composites — **nunca directamente en pantallas de producto**.
- En showcase o documentación del design system para preview de variantes.

**Cuándo NO usarlo:**
- Cards, banners, secciones de contenido, wrappers de layout.
- Cualquier superficie que el usuario no pulse como control.
- Dropdowns, FABs, tabs → usa composites (`LiquidPillDropdown`, etc.).

**Props clave:** `variant`, `tone`, `shape`, `size`, `interactive`, `shadow`, `reactive`, `cursorGlow`, `bounceIntensity`.

---

#### `LiquidPill`
**Archivo:** `liquid-pill.tsx`

**Qué es:** Pill interactiva sobre `LiquidSurface`. Layout icon + text.

**Cuándo usarlo:**
- Chip de acción en toolbar de página (ej. filtro activo con icono de X).
- Botón circular de icono único (`shape="circle"`) embebido in-flow.
- Badge interactivo con feedback líquido.
- Base visual de todos los composites líquidos.

**Ejemplos concretos:**
- Botón "Compartir" con icono `Share2` en footer de card.
- Pill de estado "Activo" con `appearance="tinted"` y `variant="emerald"`.
- Icono circular de ayuda (`HelpCircle`) junto a un título.

**Props clave:** `variant`, `appearance`, `shape`, `size` (`xxs`–`2xl`), `icon`, `text`, `active`, `reactive`, `shadow`, `hoverBounce`, `hoverDeform`.

##### Estado seleccionado sólido — escalas / opciones únicas

**Use-case:** respuestas de escala en formularios y performance evaluation (`1–5`, NPS, opinión, Likert compacto) donde una opción seleccionada debe distinguirse inmediatamente de las opciones inactivas. El `appearance="tinted"` estándar puede ser demasiado sutil cuando todas las opciones son círculos iguales.

**Regla:** la opción seleccionada usa `LiquidPill` con `surfaceStyle="selectionSolid"`; las opciones inactivas quedan neutras (`variant="slate"`, `appearance="normal"`). No crear gradientes manuales ni `className` para pintar el estado.

```tsx
<LiquidPill
  as="button"
  type="button"
  shape="circle"
  size="xl"
  variant={isSelected ? "emerald" : "slate"}
  appearance={isSelected ? "tinted" : "normal"}
  active={isSelected}
  surfaceStyle={isSelected ? "selectionSolid" : undefined}
  shadow={isSelected ? "default" : "neutral"}
  aria-pressed={isSelected}
  onClick={selectOption}
>
  <span className="text-base font-semibold md:text-xl">{label}</span>
</LiquidPill>
```

**Cuándo usarlo:**
- `FormAnswerScale` y equivalentes de detalle/respuesta donde solo una opción puede estar seleccionada.
- Botones circulares de selección persistente que compiten visualmente con varias opciones inactivas.

**Cuándo NO usarlo:**
- Badges informativos (`PageHeaderV2.badges`, meta pills de card).
- Filtros de toolbar (`LiquidSelectList`, `LiquidPillDropdown`, `MultiSelectFilterV2`) — comunican selección o acciones según §4.1.
- CTAs de footer de card (`LiquidPill as="button" size="card-cta"`) salvo que sean selector persistente, no acción.

---

#### `LiquidPillDropdown`
**Archivo:** `liquid-pill-dropdown.tsx`

**Qué es:** Trigger circular/pill que morphs en panel de **acciones** (u opciones de toolbar donde el valor no se lee en el botón).

**Rol en el sistema:** control **accionable**. No es el select de formulario.

**Regla del trigger (obligatoria):** el botón colapsado muestra **solo un ícono** — nunca texto, placeholder ni etiqueta de la opción activa. La intención se comunica con:
- el **ícono** del trigger (`Filter`, `MoreHorizontal`, `ArrowDownUp`, etc. — ver §6.11.8);
- una **etiqueta externa** en la toolbar si hace falta contexto (p. ej. `<span>Ordenar por:</span>` junto al trigger);
- las **opciones con label** dentro del menú expandido.

**Prohibido en el trigger:** `showLabelWhenClosed`, `placeholder` visible en cerrado, `collapsedShape="pill"` solo para mostrar texto. Usar siempre `collapsedShape="circle"` + `icon` + `aria-label`.

**Cuándo usarlo:**
- **Menú de tres puntos** (`MoreHorizontal`) en fila de tabla o card → `icon={MoreHorizontal}`, `collapsedShape="circle"`, `size="sm"`.
- Acciones contextuales: Editar, Clonar, Copiar ID, Eliminar, Exportar, Importar, Duplicar.
- Filtro/orden en toolbar cuando el trigger es **solo ícono** y el valor no se muestra en el botón (etiqueta externa opcional).
- Selector de vista (lista/grid) con icono representativo, sin label de valor en cerrado.

**Ejemplos concretos:**
```tsx
// Tres puntos en card de evaluación
<LiquidPillDropdown
  icon={MoreHorizontal}
  items={[
    { value: "edit", label: "Editar", icon: Pencil, variant: "indigo" },
    { value: "duplicate", label: "Duplicar", icon: Copy, variant: "slate" },
    { value: "delete", label: "Eliminar", icon: Trash2, variant: "rose" },
  ]}
  value={null}
  onSelect={handleAction}
  size="sm"
  collapsedShape="circle"
  aria-label="Acciones de evaluación"
/>

// Ordenar / filtrar en toolbar (trigger solo ícono; etiqueta externa)
<div className="flex items-center gap-2">
  <span className="text-xs font-semibold text-slate-500">Estado</span>
  <LiquidPillDropdown
    icon={Filter}
    items={statusOptions}
    value={status}
    onSelect={setStatus}
    size="md"
    collapsedShape="circle"
    aria-label="Filtrar por estado"
  />
</div>
```

**Cuándo NO usarlo:**
- **Select de un valor con label visible** (categoría, tipo, prioridad en form) → `LiquidSelectList`.
- **Multi-selección** → `MultiSelectFilterV2` / `TagPickerV2`.
- Menú sobre avatar o trigger no circular → `GlassDropdown`.
- Navegación tab-like sin cierre → `LiquidPillGroup`.
- Más de ~10 opciones con búsqueda → `SelectPickerV2` o drawer.

---

#### `LiquidSelectList`
**Archivo:** `liquid-select-list.tsx`

**Qué es:** Select líquido de **ítem único**. Mismo morph / material que `LiquidPillDropdown` (`LiquidSurface`, frost, timings), con dos diferencias geométricas:
1. El panel abre **hacia abajo**.
2. El ancho del panel = ancho del trigger; el trigger usa el **ancho del label más largo** (placeholder + opciones) para que la flecha no salte al cambiar de valor.

**Rol en el sistema:** control de **selección** (valor persistente + label legible en cerrado).

**Trigger cerrado:** pill con **label (o placeholder) + chevron**. Props de superficie alineadas al dropdown (`variant`, `reactive`, `appearance`, `shadow`, `cursorGlow`, etc.).

**Cuándo usarlo:**
- Campos de formulario / modal donde el usuario elige **una** opción y debe verla en el botón (ej. categoría AnonyBox).
- Selectors de dominio con pocas opciones (≤ ~8–10) y material líquido.
- Cualquier “dropdown” que en realidad es un **`<select>`** de un valor.

**Ejemplo:**
```tsx
<LiquidSelectList
  value={category}
  onSelect={setCategory}
  variant="slate"
  size="sm"
  listSize="sm"
  collapsedShape="pill"
  reactive
  menuZIndex={Z_INDEX.MODAL + 100} // dentro de modal
  placeholder={t("Seleccione una categoría")}
  data={categories}
  labelKey="name"
  valueKey="category"
/>
```

**Cuándo NO usarlo:**
- Menú de acciones / tres puntos → `LiquidPillDropdown`.
- Elegir **varios** valores → `MultiSelectFilterV2` / `TagPickerV2`.
- Listas muy largas con búsqueda → `SelectPickerV2`.

**vs `LiquidPillDropdown`:** mismo look líquido; distinto **rol**. Dropdown = acciones (círculo + ícono). SelectList = valor único (pill + texto + chevron, abre abajo, ancho estable).

**vs `MultiSelectFilterV2` / `TagPickerV2`:** esos son multi-valor (chips / checklist). `LiquidSelectList` nunca acumula selecciones.

---

#### `MultiSelectFilterV2` / `TagPickerV2`
**Archivos:** `composites/multi-select-filter-v2.tsx` · `composites/tag-picker-v2.tsx`

**Qué es:** selectores de **varios valores** (familia de formularios / filtros sólidos v2, no morph de pill circular).

**Rol en el sistema:** control de **multi-selección**.

**Cuándo usarlo:**
- Tags, categorías múltiples, responsables, filtros “cualquiera de…”.
- Toolbars o paneles de filtros avanzados donde el valor es un **array**.
- Formularios que necesitan chips / conteo de seleccionados / buscar dentro de muchas opciones.

**Cuándo NO usarlo:**
- Un solo valor con UI líquida → `LiquidSelectList`.
- Menú de acciones → `LiquidPillDropdown`.

**Nota:** `SelectPickerV2` sigue siendo el select sólido v2 de un valor cuando el contexto es formulario denso / muchas opciones / búsqueda; en superficies líquidas compactas preferir `LiquidSelectList`.

---

#### `LiquidSwitch` / `SwitcherV2`
**Archivos:** `liquid-switch.tsx` (control) · `switcher-v2.tsx` (label + layout)

**Qué es:** Toggle binario con material líquido. Sigue el mismo contrato que `LiquidPill`: **no duplica CSS** — delega track y thumb a `LiquidSurface` / `LiquidPill`. Radix Switch aporta accesibilidad (`role="switch"`, teclado).

**Árbol de composición:**
```
LiquidSurface  ← track (pill, tone neutral/tinted según checked)
LiquidPill     ← thumb (circle xxs, appearance normal/tinted)
  ↑
LiquidSwitch   ← dimensiones + animación del thumb
  ↑
SwitcherV2     ← label, description, dense, labelPosition
```

**Mapeo de estado:**
| Estado | Track | Thumb |
|---|---|---|
| Off | `surfaceStyle="switchTrackRecessed"` (carril gris claro) | `reactive` + `shadow="floating"` (vidrio translúcido) |
| On | `surfaceStyle="switchTrackActive"` (tinte **oscuro** de la variante) | mismo thumb reactive |

El thumb usa **`reactive`**, `interactive`, `hoverDeform` y `hoverBounce` en un `LiquidPill` — **el mismo contrato que el trigger de `LiquidPillDropdown`**. No se parchea ni reexporta lógica de `LiquidSurface`; el dot recibe el hover directamente.

El thumb usa **`reactive`** con `surfaceStyle="default"` (no `solidTranslucent`) para que el `backdrop-filter` muestree el carril. `solidTranslucent` es opaco por diseño.

**Cuándo usarlo:**
- Toggles en formularios (`SwitcherV2` con label).
- Filtros booleanos en toolbar/modal (`SwitcherV2` `dense`, `labelPosition="left"`).
- Solo el control sin label → `LiquidSwitch` directo.

**Prohibido:** CSS propio de gradientes/sombras en `switcher-v2` o `liquid-switch` — cualquier ajuste visual va en `LiquidSurface`.

---

#### `LiquidPillExpandButton`
**Archivo:** `liquid-pill-expand-button.tsx`

**Qué es:** Botón circular que revela su label en hover/focus. Acción única (no menú).

**Cuándo usarlo:**
- FAB flotante (`MaintainerFabStackV2`) para **crear** (acción primaria).
- Botón "Ayuda" con icono `HelpCircle` en toolbar o card.
- Acción "Exportar" / "Descargar" en **toolbar** (`filters`, `PageToolbarV2.leftSlot`) o esquina de card (`expandTo="left"`).
- Botón de "Filtros" en barra de herramientas.

**Cuándo NO usarlo:**
- En `PageHeaderV2` — el header no lleva CTAs a la derecha.
- Acciones flotantes en viewport → `LiquidFixedCircleButton` (usar `MaintainerFabStackV2`).
- Menú de múltiples opciones → `LiquidPillDropdown`.
- Sidebar → `SidebarLiquidButton`.

**Ejemplos concretos:**
```tsx
// Exportar en toolbar (debajo del header)
<LiquidPillExpandButton
  icon={<Download />}
  label="Descargar"
  variant="slate"
  size="sm"
  expandTo="left"
  onClick={handleExport}
  aria-label="Descargar"
/>
```

---

#### `LiquidFixedCircleButton`
**Archivo:** `liquid-fixed-circle-button.tsx`

**Qué es:** FAB circular fijo al viewport. Composite de `LiquidPill` + posicionamiento.

**Cuándo usarlo:**
- **Acción primaria flotante** en páginas maintainer (crear, quickie).
- Botón de chat/soporte flotante.
- Acceso rápido a IA en esquina inferior.
- Segundo FAB apilado con distinto `offsetY` (ej. Quickie encima de Crear).

**Ejemplos concretos:**
```tsx
// FAB crear + FAB quickie apilados (maintainer CRUD)
<LiquidFixedCircleButton
  icon={<Plus />}
  variant="indigo"
  size="xl"
  reactive
  horizontal="right"
  vertical="bottom"
  offsetY={96}
  onClick={openCreate}
  aria-label="Crear evaluación"
/>
<LiquidFixedCircleButton
  icon={<Zap />}
  variant="gold"
  size="xl"
  reactive
  horizontal="right"
  vertical="bottom"
  onClick={openQuickie}
  aria-label="Evaluación rápida"
/>
```

**Props clave:** `horizontal`, `vertical`, `offsetX`, `offsetY`, `reactive`, `shadow="floating"`, `portal`, `size`.

**Cuándo NO usarlo:**
- Botones in-flow en headers → `LiquidPillExpandButton`.
- Navegación principal → sidebar/navbar.

---

#### `LiquidPillGroup`
**Archivo:** `liquid-pill-group.tsx`

**Qué es:** Segmented control horizontal con bubble deslizante.

**Cuándo usarlo:**
- Tabs de vista: "Activas / Archivadas / Borrador".
- Toggle de periodo: "Día / Semana / Mes".
- Filtro de tipo en toolbar: "Todos / Evaluaciones / Encuestas".
- Selector de modo de visualización en dashboard.

**Cuándo NO usarlo:**
- Menú desplegable con muchas opciones → `LiquidPillDropdown`.
- Navegación vertical → `LiquidPillGroupVertical`.

---

#### `LiquidPillGroupVertical`
**Archivo:** `liquid-pill-group-vertical.tsx`

**Qué es:** Lista vertical con bubble deslizante. Usado internamente por dropdowns y menús.

**Cuándo usarlo:**
- Menú lateral de categorías (3–8 items visibles).
- Lista de acciones en panel flotante custom.
- Navegación secundaria vertical en side pane.

**Cuándo NO usarlo directamente en páginas:**
- Preferir `LiquidPillDropdown` que ya lo compone internamente.

---

### 5.2 Controles interactivos — material glass (`Glass*`)

Componentes glass **también son interactivos**. Usar cuando el trigger no encaja en una pill líquida o se necesita un patrón más compacto/clásico.

#### `GlassBadge`
**Archivo:** `glass-badge.tsx`

**Qué es:** Pill glass con variante de color. Sin deformación líquida.

**Cuándo usarlo:**
- Tag de categoría no interactivo o semi-interactivo.
- Chip de "Nuevo", "Beta", "Pro".
- Filtro toggle simple sin bubble group.

---

#### `GlassBadgeGroup`
**Archivo:** `glass-badge-group.tsx`

**Qué es:** Segmented control estilo glass con bubble (alternativa a `LiquidPillGroup`).

**Cuándo usarlo:**
- Filtros en cards de Explore donde el estilo glass legacy encaja mejor.
- Selector de reacciones o categorías en feed.
- Cuando NO se necesita feedback líquido pero sí bubble animado.

**Preferir `LiquidPillGroup`** en pantallas maintainer nuevas. Reservar `GlassBadgeGroup` para contextos Explore/feed donde ya existe ese lenguaje.

---

#### `GlassDropdown`
**Archivo:** `glass-dropdown.tsx`

**Qué es:** Dropdown glass con trigger arbitrario (no tiene que ser pill).

**Cuándo usarlo:**
- Menú sobre **avatar de usuario** (perfil, configuración, logout).
- Dropdown sobre **texto/botón custom** que no es circular.
- Menú contextual en navbar con trigger de nombre de usuario.

**Cuándo NO usarlo:**
- Trigger es icono circular solo → `LiquidPillDropdown`.

---

#### `GlassTile`
**Archivo:** `glass-tile.tsx`

**Qué es:** Tile cuadrado/redondo con icono grande, label y opcional particle burst.

**Cuándo usarlo:**
- Selector de tipo de contenido (texto, imagen, video, encuesta).
- Grid de acciones rápidas en modal de creación.
- Picker de valor corporativo con efecto wow (`particleBurst`).
- Selector de emoji/reacción visual.

---

### 5.3 Contenido y formularios — material sólido

Estos componentes **no son vidrio**. Forman la base legible de la UI.

#### `Button`
**Archivo:** `button.tsx`

**Qué es:** CTA de acción. Las variantes sólidas (`primary` · `secondary` · `destructive` · `success` · `warning` · `outline`) renderizan **`LiquidPill`** con el mismo material que `ModalButtons`: `appearance="tinted"` + `surfaceStyle="selectionSolid"`.

| `variant` | `LiquidPill` |
|---|---|
| `primary` (default) | `indigo` |
| `destructive` | `rose` |
| `success` | `emerald` |
| `warning` | `gold` |
| `secondary` / `outline` | `slate` |
| `ghost` / `link` / `groowCard*` | HTML ligero (sin vidrio) |

**Cuándo usarlo:**
- CTAs sueltos ("Iniciar sesión", "Crear cuenta", "¡Entendido!", "Agregar al carrito").
- Acciones en body de página / card / dialog cuando no hay par Cancel+Submit.
- Flujos de auth (login, registro, recover).

**Cuándo NO usarlo:**
- Par Cancelar + Guardar en footer de modal → `ModalButtons`.
- Icon buttons en toolbars → `LiquidPill` circle.
- Menús de tres puntos → `LiquidPillDropdown`.
- FABs → `LiquidFixedCircleButton`.
- Filtros/tabs compactos → `LiquidPillGroup`.

**Nota:** no hace falta migrar call sites de `variant="primary"` uno a uno: el primitivo ya es líquido.

#### `Input` / `Textarea` / `PasswordInput` / `Select` / `Checkbox` / `Switch` / `RadioGroup` / `ImageUploaderV2` / `SwitcherV2`
**Cuándo usarlo:** Campos de formulario. Superficie semi-opaca, borde definido, focus ring — **sin** material líquido en el campo en sí.

**Toggle líquido:** `SwitcherV2` compone `LiquidSwitch` (track `LiquidSurface` + thumb `LiquidPill`). Hereda el material igual que `LiquidPill` — **sin CSS propio** en el switcher. Usar `dense` en toolbars y modales preview.

**Defaults v2:** `Input` y `Textarea` usan `size="sm"` por defecto. El wrapper incluye `my-1` para que labels flotantes no tapen el campo anterior.

**En modales v2:** uso **exclusivo** de esta familia para campos de formulario — ver tabla §5.5 «Inputs — uso exclusivo v2». No mezclar rsuite, shadcn ni HTML nativo en rediseño completo.

**Ejemplos:** búsqueda en maintainer, campos de modal de creación, login, configuración.

**Cuándo NO:** selector visual compacto con iconos → `LiquidPillDropdown`.

#### `ModalButtons`
**Archivo:** `modal-buttons.tsx`

**Cuándo usarlo:** Único control de acciones Cancelar + Guardar/Enviar/Eliminar en el **slot `footer`** del `Modal` v2 (no en el body).

**Material:** dos `LiquidPill` con `appearance="tinted"` + `surfaceStyle="selectionSolid"` + `size="md"` (siempre `md`; la prop `compact` solo reduce el `pt` del contenedor).

| Botón | `variant` | Notas |
|---|---|---|
| Cancelar | `slate` | `onCancel` / `onClose`; deshabilitado mientras `loading` |
| Submit | `indigo` (default) · `rose` (`destructive`) · `emerald` (`success`) · `gold` (`warning`) | vía `submitVariant`; spinner `Loader2` si `loading` |

**Submit fuera del `<form>`:** usar `submitButtonProps={{ form: "form-id" }}` o `onSubmit` que llame a `handleSubmit` / `requestSubmit()`. Si no hay `onSubmit`, el click busca el `form` por id o el `<form>` ancestro.

**Prohibido:** `Button` shadcn / rsuite en footer de formulario; filas sticky caseras (`pb-24`, `sticky bottom-0`) con Cancel/Save dentro del body — ver §5.5 «Footer de acciones».

---

### 5.4 Contenedores de contenido — material sólido

#### `Card` (+ `CardHeader`, `CardBody`, `CardFooter`, `CardWelcome`)
**Cuándo usarlo:**
- Contenedores de datos en auth, configuración, listados maintainer.
- **Cards de grid CRUD:** `size="full"`, `padding="none"`, `shadow="subtle"`, `fullHeight` — ver **§6.6**.
- Variante `explore` para cards del feed.
- `entranceAnimation`, `innerGlow`, `animatedBorder` para destacar cards puntuales — el wow es del borde/sombra, **no** vidrio líquido.

#### `ExploreCardFrame`
**Cuándo usarlo:** Wrapper de cards del feed Explore con borde coloreado por RGB.

#### `Accordion` / `Separator`
**Cuándo usarlo:** FAQ, secciones colapsables, divisores internos.

---

### 5.5 Overlays — paneles elevados (no líquidos)

**Regla:** en código nuevo usar **solo `Modal` v2** para formularios, wizards y confirmaciones con contenido. **No usar `SideModal`** ni drawers laterales para flujos de creación/edición — el patrón canónico es modal centrado.

#### `Modal`
**Archivo:** `modal.tsx`

**Qué es:** Panel centrado con backdrop blur, aurora decorativa (`DropdownAuroraGlow`), header con título y cierre líquido (`LiquidPill` rose), body scrollable y footer opcional.

**Cuándo usarlo:**
- Formularios de creación/edición (evaluaciones, configuración, confirmaciones con campos).
- Wizards y guías interactivas (`InteractiveGuideDialogV2`, `*GuideDialogV2`).
- Cualquier overlay que antes se resolvía con drawer lateral o SideModal.

**Cuándo NO usarlo:**
- Alertas de una línea → `Dialog`.
- **No crear variantes laterales** (`SideModal`) — extender `Modal` con props de layout si hace falta, no duplicar el overlay.

**Props clave:** `open`, `onClose`, `title`, `description`, `eyebrow`, `header` (slot custom), `size` (`xs` | `sm` | `md` | `lg` | `xl` | `full`), `footer`, `headerClassName`, `bodyClassName`, `panelClassName`, `bodyScrollFade`, `backdrop`, `keyboard`, `unstyledPanel` (panel transparente sin sombra — solo cuando el hijo trae shell propio; ver §5.5 sombra), `loading`, `animateHeight` y `bubbleReveal`.

**Apertura (enter pop) — invariante**

Todo `Modal` v2 reproduce el mismo pop de entrada (`modal-panel-enter` / `modal-v2-enter-pop`) al pasar `open` de `false` → `true`. **No es opt-in:** no hay prop para desactivarlo y **no** debe condicionarse a `unstyledPanel`, chrome, `bubbleReveal` ni al camino de montaje.

| Camino | ¿Tiene pop? | Notas |
|---|---|---|
| `<Modal open>` directo (`overlays`, `*ModalV2`) | Sí | Shell canónico |
| `openModal` → `modal.provider` → `Modal` | Sí | Incluye puente `ExploreModal` + `hideCloseButton` / `unstyledPanel` |
| `CenterModal` → `Modal` | Sí | Legacy; mismo shell |

Reglas:
- Un solo lugar implementa la animación: `components/ui/v2/modal.tsx`. Cualquier overlay nuevo debe usar ese `Modal` (o un wrapper que lo use), nunca un portal/panel custom.
- `loading` true→false **no** re-dispara el enter (solo el morph de `bubbleReveal` / altura).
- `unstyledPanel` quita borde/sombra/fondo del panel, **no** la animación de apertura (el wrapper transparente escala el hijo, p. ej. `ExploreModal`).
- No reimplementar scale/fade de apertura en `ExploreModal` ni en el contenido.

**Motion del Modal — tiempos y curvas (fuente: `modal.tsx` + `V2_MOTION`)**

| Momento | Duración | Curva | Notas |
|---|---|---|---|
| Enter pop (apertura) | **700 ms** (`MODAL_ENTER_MS`) | `cubic-bezier(0.12, 1.35, 0.28, 1)` | Scale 0.05 → overshoot → 1; invariante |
| Exit (cierre) | **340 ms** (`MODAL_EXIT_MS`) | `premiumReveal` | Opacity del panel |
| Morph alto + ancho (`bubbleReveal` reveal / height lock) | **860 ms** (`MODAL_HEIGHT_MORPH_MS`) | `liquidBounce` si `bubbleReveal`; si no, `premiumReveal` | Height + `max-width` a la vez (WAAPI en reveal) |
| Compact loading box | **168×296 px** | — | Spinner anillo degradado + `loadingLabel` |
| Backdrop enter | ~620 ms | `premiumReveal` | Alineado al enter |

No inventar keyframes de apertura/morph en el contenido. Preferir `prefers-reduced-motion` ya cubierto en el shell.

**Carga diferida y apertura del modal (`loading` + `bubbleReveal`)**

Aplica a **cualquier** Modal v2 que necesite datos async antes de mostrar el contenido útil: edición, detalle, **listados** (reacciones, vistas, rankings), resultados, etc. No es exclusivo de formularios.

El patrón canónico es:

1. Al activar la acción, montar inmediatamente el `Modal` y su contenido con `open={true}`, `loading={true}` y `bubbleReveal`.
2. Mientras carga, el shell muestra una **versión compacta** del panel con el **spinner de anillo en degradado** del Modal (`loadingLabel`). El flag `loading` debe permanecer `true` hasta que los datos estén listos (no limpiarlo en cleanups de effects por identidad de callback; preferir clear **one-way**: solo pasar a `false`).
3. Mantener el contenido del modal montado e invisible durante la consulta para evitar un segundo montaje y nuevas solicitudes `network-only`.
4. El hijo reporta el estado vía `onLoadingChange(loading)` (o equivalente). Al cambiar `loading` a `false`, revelar header/body/footer y dejar que el morph de altura existente anime desde el alto compacto hasta el del contenido.
5. El cierre mediante backdrop o tecla Escape sigue disponible durante la carga.
6. No publicar conteos / tabs / empty states al header mientras `loading === true` (evita flashes tipo “Sin datos todavía”).
7. **Al cerrar:** no poner `loading` / `contentLoading` en `true` en el `onClose` — el `Modal` sigue montado ~340 ms en la animación de salida y el spinner compacto parpadearía. Resetear loading solo al **reabrir** (`open` → `true`).

```tsx
const handleClose = () => {
  onClose(); // no setContentLoading(true) aquí
};

useEffect(() => {
  if (open) {
    setContentLoading(true); // reset solo al abrir
  }
}, [open, id]);
```

```tsx
const [modalState, setModalState] = useState<{ id: string } | null>(null);
const [contentLoading, setContentLoading] = useState(false);

const openEditModal = (id: string) => {
  setContentLoading(true);
  setModalState({ id });
};

const handleLoadingChange = (loading: boolean) => {
  if (!loading) setContentLoading(false); // one-way clear
};

<Modal
  open={Boolean(modalState)}
  onClose={closeModal}
  title="Editar formulario"
  size="xl"
  loading={contentLoading}
  bubbleReveal
  loadingLabel="Cargando contenido"
>
  {modalState ? (
    <EditModalContentV2
      id={modalState.id}
      onLoadingChange={handleLoadingChange}
    />
  ) : null}
</Modal>
```

**Referencias canónicas:** `FormsMaintainerPageV2` (editar formulario), `ExploreReactionsModalV2` (listado de reacciones).

**No hacer:**

- No usar la órbita de burbujas (`PageLoadingStateV2` / `visualOnly`) como loading de apertura del Modal — ese componente es para **páginas** o estados embedded cuando el shell **no** usa `bubbleReveal`.
- No abrir el Modal a tamaño final (`xl` / `lg`) y pintar `PageLoadingStateV2` en el body: eso es el anti-patrón que `bubbleReveal` reemplaza.
- No transformar una pill o una burbuja suelta en el modal.
- No desmontar el contenido al terminar la carga ni renderizar una instancia oculta y otra visible; esto puede duplicar queries y producir ciclos de loading.
- No reabrir el shell compacto en refetches posteriores (clear one-way de `loading`).
- No abrir primero un modal vacío a tamaño final y reemplazar luego su body: la apertura visual crece desde el panel compacto cuando los datos están listos.
- No forzar `loading={true}` en el cierre (flash del spinner durante el exit).

**Footer de acciones — slot `footer` obligatorio en formularios**

Cancelar / Guardar / Enviar / Eliminar van **solo** en `Modal` `footer` con `ModalButtons`. El body no lleva barra de acciones.

| Regla | Detalle |
|---|---|
| Slot | `footer={<ModalButtons … />}` en el shell (`*ModalV2` o `*PageV2`) |
| Contenido | `*ModalContentV2` con `hideFooter` / sin botones; solo campos |
| Footer dinámico | `onFooterChange` (Forms / SendForm) cuando tabs o estado interno cambian el footer |
| Submit desacoplado | `form` id + `submitButtonProps.form`, o `onSubmit` → `requestSubmit()` |
| Listados sin form | Sin `ModalButtons`; cierre = X rose del shell |
| Deuda | Inventario: `indice_modal_v2_footer_pendiente.md` · plan por olas: `plan_accion_modales_v2_dl.md` |

```tsx
<Modal
  open={open}
  onClose={onClose}
  title="Crear recurso"
  size="md"
  footer={
    <ModalButtons
      compact
      loading={saving}
      onCancel={onClose}
      submitButtonProps={{ form: "foo-form" }}
      submitLabel="Guardar"
    />
  }
>
  <FooCreateModalContentV2 hideHeader hideFooter formId="foo-form" />
</Modal>
```

**Prohibido:** `ModalButtons` (o Cancel/Save equivalentes) sticky dentro del body; duplicar footer en form + shell; `Button` shadcn en acciones de formulario.

**Tipografía modal — escala única obligatoria (todos los modales v2)**

Aplica a **cualquier** overlay `Modal` v2, `ExploreModal`, `Dialog` con contenido largo y shells `*ModalV2` — formulario, preview, listado con tabs, ranking, celebraciones, etc. **No inventar tamaños** fuera de esta tabla (ver también §6.12).

| Capa | Uso | Clases canónicas | Tamaño |
|---|---|---|---|
| **Eyebrow** | Contexto de módulo (`EXPLORAR`, dominio) | `text-[9px] font-semibold uppercase tracking-[0.16em] text-indigo-500/90 dark:text-indigo-300/80` | 9 px |
| **Título** | Título principal del modal | `text-[13px] font-semibold leading-snug text-slate-900 dark:text-zinc-50 sm:text-[15px]` | 13 px → 15 px |
| **Descripción header** | Conteo, subtítulo dinámico bajo el título | `mt-1 text-[11px] text-slate-500 dark:text-zinc-400 sm:text-xs` | 11 px → 12 px |
| **Primario body** | Nombre de persona, título de ítem en listas, label de campo destacado | `text-[13px] font-medium leading-snug text-slate-900 dark:text-zinc-50` | 13 px |
| **Secundario body** | Email, rol, metadata, hints, texto de apoyo en listas | `text-[9px] leading-snug text-slate-500 dark:text-zinc-400` | 9 px |
| **Métrica / pill** | Badge de cantidad (ranking, contadores en fila) | `text-[10px] font-semibold text-slate-600` + ícono **12px** | 10 px |
| **Emoji overlay** | Badge emoji sobre avatar (reacciones) | `text-[11px] leading-none` en círculo `h-4 w-4` | 11 px |
| **Toolbar body** | Etiquetas de filtros locales dentro del modal | `text-[9px] font-semibold uppercase tracking-wide text-slate-500` | 9 px |
| **Empty / loading (modal)** | Empty/`PageEmptyStateV2` embedded; carga de apertura = tipografía del spinner compacto del shell (`bubbleReveal`) | título `text-[13px] font-semibold` · descripción `text-[9px]` | 13 px / 9 px |

**Prohibido en body de modales v2 rediseñados:**

| Evitar | Usar |
|---|---|
| `text-sm` (14 px) en filas, metadata o hints | Primario `13px` o secundario `9px` según jerarquía |
| `text-base` / `text-lg` en listados del body | Primario `13px` |
| `text-[10px]` como secundario de fila | Secundario `9px` |
| Mezclar `text-sm` en nombre y `text-[10px]` en email | Nombre `13px` medium + email `9px` |
| Tamaños distintos entre modales del mismo patrón | Siempre esta escala |

**Jerarquía en filas de personas:** solo el **nombre** (o título de ítem) usa **primario 13px**; todo lo demás (email, rol, IDs, fechas) usa **secundario 9px** en línea propia o concatenado con ` · `.

**Tipografía del header** — misma escala (no duplicar valores distintos):

| Elemento | Clases |
|---|---|
| Eyebrow (contexto de módulo) | ver tabla «Tipografía modal» arriba |
| Título | ver tabla «Tipografía modal» arriba |
| Descripción (conteo, subtítulo dinámico) | ver tabla «Tipografía modal» arriba |

Usar props `title` / `description` / `eyebrow` del `Modal`, o el slot `header` con las mismas clases cuando haga falta composición (p. ej. tabs a la derecha).

**Aurora y transición header → body**

El panel incluye `DropdownAuroraGlow variant="modal"`. El header es `bg-transparent` para que el aurora se vea detrás. El body **no** debe tapar el aurora con blanco opaco plano en todo el alto — usar gradiente superior que continúe el fade:

```tsx
bodyClassName="bg-gradient-to-b from-transparent via-white/95 via-[10%] to-white/95 to-[16%] py-3 dark:via-zinc-950/95 dark:to-zinc-950/95 sm:py-3.5"
```

En listados largos activar `bodyScrollFade`: overlay superior que aparece al hacer scroll (`scrollTop` ~28px → opacidad 1) para que el contenido no se corte bruscamente bajo el borde del body.

**Pestañas / filtros en el header del modal**

Cuando el modal filtra una colección (reacciones, categorías, vistas), preferir **`LiquidPillGroup` en el header** — no una segunda toolbar dentro del body.

| Aspecto | Valor canónico |
|---|---|
| Ubicación | Slot `header` del `Modal`, alineado a la derecha (`justify-between`) |
| Control | `LiquidPillGroup` `size="sm"` |
| Contenedor | `rounded-full border border-slate-200/40 bg-white/40 p-0.5 shadow-[0_1px_2px_rgba(15,23,42,0.02)] backdrop-blur-[2px] dark:border-zinc-800/40 dark:bg-zinc-900/40` |
| Margen vs. cierre | `mr-8 shrink-0` — deja espacio al `LiquidPill` rose de cerrar |
| Sincronización | El cuerpo expone callback (`onTabChange`) que sube `items`, `active` y `setActive` al shell; el shell guarda estado y renderiza el grupo en `header` |
| Descripción dinámica | Conteo u otro resumen vía callback (`onCountChange`) → `description` del header con escala **modal-description** §5.5 |

**Ejemplo — tabs en header (listado filtrable):**

```tsx
const header = (
  <div className="flex w-full items-center justify-between gap-4">
    <div className="min-w-0 flex-1">
      <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-indigo-500/90">…</p>
      <h2 className="mt-0.5 text-[13px] font-semibold leading-snug sm:text-[15px]">…</h2>
      {description ? (
        <p className="mt-1 text-[11px] text-slate-500 sm:text-xs">{description}</p>
      ) : null}
    </div>
    {headerTabs ? (
      <div className="mr-8 shrink-0 rounded-full border border-slate-200/40 bg-white/40 p-0.5 backdrop-blur-[2px] …">
        <LiquidPillGroup items={headerTabs.items} activeValue={headerTabs.active} onChange={headerTabs.setActive} size="sm" />
      </div>
    ) : null}
  </div>
);

<Modal header={header} size="xl" bodyScrollFade panelClassName="flex max-h-[min(88vh,780px)] flex-col" … />
```

Si el mismo bloque se usa **fuera** de un modal embebido, las tabs pueden ir en el body (`LiquidPillGroup` `size="md"` alineado a la derecha). Dentro de `Modal` v2 rediseñado → **header**.

**Listado de personas en el body**

Dos variantes de fila según contexto. Referencias: `ExploreReactionsModalV2` + `ReactionUserRowV2` (`Reactions.tsx`); rankings Explore + `UserItemRanking` (`UserItemRanking.tsx`).

**Contenedor y fila (común a ambas variantes)**

| Aspecto | Valor canónico |
|---|---|
| Contenedor lista | `flex flex-col gap-1` — separación sutil entre filas |
| Fila | `flex items-center gap-2 rounded-lg px-1 py-1.5 sm:px-0.5` — sin card con fondo |
| Avatar | `UserAvatar` **32px**; badge emoji/estado (solo variante A) `absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-white text-[11px] shadow-sm dark:bg-zinc-800` |
| Enlace perfil | `<a target="_blank" rel="noreferrer">` con `UserTooltip` |
| Estados vacío / carga | Empty: `PageEmptyStateV2` embedded. **Apertura del Modal:** `bubbleReveal` + spinner del shell (§5.5) — no órbita `PageLoadingStateV2` en el body |

**Variante A — Fila reacciones (2 líneas)** — reacciones, asistentes, miembros con tabs

| Aspecto | Valor canónico |
|---|---|
| Orden | `avatar` → texto (sin badge métrica) |
| Línea 1 — nombre | `text-[13px] font-medium leading-snug capitalize text-slate-900 dark:text-zinc-50` + `truncate` |
| Línea 2 — email | `text-[9px] leading-snug text-slate-500 dark:text-zinc-400` + `truncate` |
| Rol | **No** en fila — el tooltip puede ampliar contexto |

**Variante B — Fila ranking (2 líneas + badge izquierda)** — rankings Explore (valores, coins, certificados, etc.)

| Aspecto | Valor canónico |
|---|---|
| Orden | **badge métrica** → `avatar` → texto |
| Badge métrica (izquierda) | pill `shrink-0` · `px-2 py-0.5 gap-1` · ícono módulo **12px** + cantidad · `text-[10px] font-semibold text-slate-600` |
| Línea 1 — nombre | `text-[13px] font-medium leading-snug capitalize` — **único texto grande** de la fila |
| Línea 2 — secundario | `text-[9px] leading-snug text-slate-500` · `{email} · {rol}` (fallback rol `Ciudadano`) + `truncate` |
| Contenedor texto | `leading-tight` — nombre en `<a>`, secundario en `<p>` separado |

```tsx
<div className="flex items-center gap-2 rounded-lg px-1 py-1.5">
  <div className="flex shrink-0 items-center gap-1 rounded-full border … px-2 py-0.5 text-[10px] font-semibold">
    <SVG width={12} height={12} /> <span>{cantidad}</span>
  </div>
  <UserAvatar size={32} />
  <div className="min-w-0 flex-1 leading-tight">
    <a className="block truncate text-[13px] font-medium capitalize …">{nombre}</a>
    <p className="truncate text-[9px] text-slate-500">{email} · {rol}</p>
  </div>
</div>
```

**Side card / preview compacto** (`compact` en widget): misma jerarquía que variante B (badge izquierda, nombre `13px`, email `9px`); el rol puede omitirse por espacio.

**Sombra del panel y scroll**

La sombra del modal debe verse **completa** en los cuatro lados — nunca “cortada” en el borde inferior.

| Regla | Detalle |
|---|---|
| Sombra en el panel que posee el scroll | El `box-shadow` vive en el **mismo elemento** que define `rounded-[24px]` y altura máxima del modal (`Modal` v2 o shell equivalente) |
| No anidar shells con sombra | Evitar panel con sombra **dentro** de otro contenedor con `overflow-y-auto` — el scroll del padre recorta la sombra del hijo |
| `overflow-hidden` | Solo en capas internas (aurora, bordes decorativos). **No** en la raíz del panel que lleva la sombra |
| Altura panel listados | `flex max-h-[min(88vh,780px)] flex-col` — scroll en body interno (`min-h-0 flex-1 overflow-y-auto`), no en wrapper externo |

**Patrón canónico (preferido):** `Modal` v2 con sombra en `modalSizeVariants` — referencia `ExploreReactionsModalV2`.

**Puente transitorio — `ExploreModal` + `openModal`:** rankings y celebraciones que aún montan `ExploreModal` dentro de `context/modal`. Si se mantiene este patrón hasta migrar a `*ModalV2` en `overlays`, **obligatorio**:

```tsx
openModal({
  hideCloseButton: true,
  size: "lg",
  panelClassName: "max-w-2xl overflow-visible",
  bodyClassName: "bg-transparent p-0 !overflow-visible",
  modalComponent: <ExploreModal … />,
});
```

`ExploreModal` debe usar `max-h-[min(88vh,780px)] flex flex-col` en la raíz (sin `overflow-hidden` en el nodo con sombra); body con `py-3 sm:py-3.5` (igual que `Modal` v2 listados). Header: ícono de módulo **inline 16px** junto al título — no columna lateral alta. Aurora y bordes decorativos en hijos con `overflow-hidden rounded-[inherit]`. El provider (`modal.provider.tsx`) aplica `!overflow-visible` por defecto en modales bare (`hideCloseButton` / shell autocontenido). El **enter pop** lo aporta el `Modal` exterior del provider (incluye `unstyledPanel`); no duplicar animación de apertura en `ExploreModal`.

**Objetivo de migración:** sustituir `openModal` + `ExploreModal` por `*ModalV2` + `Modal` v2 en `overlays` (mismo resultado visual que reacciones en feed v2).

**Inputs — uso exclusivo v2 en modales**

En modales rediseñados (formulario crear/editar, configuración, wizard), los campos de entrada deben ser **exclusivamente** primitivos v2 de §5.3:

| Tipo de campo | Componente obligatorio |
|---|---|
| Texto corto | `Input` `size="sm"` |
| Contraseña | `PasswordInput` |
| Texto largo | `Textarea` `size="sm"` |
| Select simple (líquido, valor visible) | `LiquidSelectList` |
| Select simple (formulario denso / búsqueda) | `Select` / `SelectPickerV2` |
| Multi-select / tags | `TagPickerV2` / `MultiSelectFilterV2` |
| Menú de acciones en el body | `LiquidPillDropdown` (no como campo de valor) |
| Boolean / toggle | `SwitcherV2` `dense` (o `Checkbox` / `Switch` v2 según contexto) |
| Radio | `RadioGroup` v2 |
| Imagen / archivo | `ImageUploaderV2` |
| Footer guardar | `ModalButtons` → `LiquidPill` tinted + `selectionSolid` (Cancel `slate` · Submit `indigo`/`rose`/…) |

**Prohibido** en modales v2 rediseñados: `Input` rsuite, inputs shadcn (`@/components/ui/input`), `<input>` / `<textarea>` HTML sueltos, `Form.Control` legacy, `Button` shadcn o acciones sticky en el body (usar slot `footer`).

**Excepción temporal:** pickers rsuite sin equivalente v2 — puente con `menuStyle={{ zIndex: Z_INDEX.MODAL + 100 }}` hasta migrar. No es estado final.

Modales de **solo preview o listado** (sin formulario) no llevan `Input`; llevan listas, cards, toolbar líquida y estados §5.5.1.

**Tamaños recomendados:**

| Caso | `size` |
|---|---|
| Confirmación / formulario compacto | `sm` o `md` |
| Formulario estándar (crear/editar entidad) | `md` |
| Wizard / contenido ancho | `lg` o `xl` |

**Ejemplo — modal de creación:**
```tsx
<Modal
  open={createOpen}
  onClose={handleCloseCreate}
  title={t("Crear recurso")}
  size="md"
  panelClassName="max-h-[min(88vh,680px)]"
  headerClassName="px-4 py-2.5 sm:px-5 sm:py-3"
  bodyClassName="px-4 py-3 sm:px-5 sm:py-3.5"
  footer={
    <ModalButtons
      compact
      loading={saving}
      onCancel={handleCloseCreate}
      submitButtonProps={{ form: "foo-create-form" }}
      submitLabel={t("Guardar")}
    />
  }
>
  <FooCreateModalContentV2 hideHeader hideFooter formId="foo-create-form" onClose={handleCloseCreate} />
</Modal>
```

**Formularios dentro del modal:**
- **Regla:** solo primitivos de entrada v2 (tabla «Inputs — uso exclusivo v2» arriba). Sin rsuite/shadcn/HTML suelto en rediseño completo.
- **Tipografía:** labels de campo → **primario 13px** (`font-medium`); hints / texto de ayuda bajo el campo → **secundario 9px**; mismos tamaños que filas de personas.
- Campos: `Input` / `Textarea` / `Select` / `SelectPickerV2` / `TagPickerV2` v2 con `size="sm"` por defecto.
- Upload: `ImageUploaderV2`.
- Toggles: `SwitcherV2` (material líquido).
- Footer de acciones: **solo** slot `footer` + `ModalButtons` (§5.5 «Footer de acciones»); `compact` en layouts densos.
- Pickers rsuite (`TagPicker`, etc.) — **solo puente temporal**; el menú debe quedar **por encima del modal** (`z-index` > `Z_INDEX.MODAL`). Usar `menuStyle={{ zIndex: Z_INDEX.MODAL + 100 }}` y reglas en `overwrite-rsuite.scss`.

#### `Dialog`
**Cuándo usarlo:** Alertas y confirmaciones cortas sin scroll largo.

**Tipografía:** título → misma escala que **Título modal** (`13px` / `15px` sm); mensaje principal → **primario 13px**; texto secundario o nota al pie → **secundario 9px**.

#### `Drawer` / `SidePane` (legacy)
**Cuándo usarlo:** Solo en pantallas **aún no migradas**. No usar en flujos v2 nuevos.

#### `Popover` / `Tooltip`
**Cuándo usarlo:** Información contextual breve. Panel sólido pequeño.

**Nota:** dentro de un modal, el **contenido** es sólido; los **controles** del formulario mezclan inputs v2 con familia `Liquid*` (`ModalButtons`, `LiquidPillDropdown`, `SwitcherV2`). No usar `Button` shadcn en footer de formulario.

#### 5.5.1 Migración de overlays legacy → Modal v2

Guía para convertir drawers, portales, modales rsuite/shadcn y providers legacy al patrón v2. Sintetiza dos formas canónicas observadas en implementaciones recientes:

| Variante | Rol del shell `Modal` | Rol del cuerpo `*ModalContentV2` |
|---|---|---|
| **Formulario** (crear / editar) | `size="md"`, título fijo, padding compacto | Campos v2 exclusivos §5.3, `ModalButtons`, mutaciones |
| **Preview con listado** (detalle embebido) | `size="xl"`, título + `description` dinámicos | Toolbar interna (`LiquidPill*`), estados loading/empty, grid de `*CardV2` |
| **Listado personas con tabs** (C) | `size="xl"`, `header` custom con tabs + `description` dinámica, `bodyScrollFade` | Filas **2 líneas** (nombre + email); callbacks `onTabChange` / `onCountChange` |
| **Ranking Explore sin tabs** (D) | `Modal` v2 en `overlays` **o** `ExploreModal` + `openModal` (puente) | Filas **variante B** §5.5 (badge izquierda, nombre grande, email · rol compacto); `description` con conteo; sin `LiquidPillGroup` en header |

##### Qué es “modal rediseñado” (Definition of Done)

Un modal **no está rediseñado** si solo se cambió el contenedor exterior. Cumple cuando:

1. **Shell** — `Modal` v2 (no drawer, portal fullscreen, `HeaderModal`, rsuite Modal, SideModal).
2. **Montaje** — declarado en slot **`overlays`** del orquestador `*PageV2` (fuera del scroll).
3. **Capas** — wrapper `*…ModalV2` (open/onClose/título/tamaño) + `*…ModalContentV2` (lógica y UI del cuerpo).
4. **Controles** — según tipo (ver inputs abajo).
5. **Funcionalidad** — mismos flujos que el legacy (guardar, preview, filtros, permisos).
6. **Tipografía** — escala única §5.5 (header + body); sin `text-sm` / tamaños ad-hoc en listados.
7. **Footer de formulario** — acciones solo en slot `footer` + `ModalButtons` (§5.5); sin sticky en body.
8. **Enter / loading** — enter pop del shell; si hay fetch al abrir → `bubbleReveal` + clear one-way; no `loading` al cerrar.

##### Mapeo legacy → v2

| Legacy | Sustituto v2 | Notas |
|---|---|---|
| `openDrawer` / `useDrawer` | `Modal` + estado `open` en orquestador | Pasar `onClose` al contenido; eliminar dependencia del drawer provider |
| `usePortal` / portal fullscreen | `Modal` `size="xl"` o `full` | Preview de ítems, multimedia, etc. |
| `context/modal` (`openModal`) | `Modal` en `overlays` | El provider legacy no se usa en flujos v2 nuevos. **Excepción puente:** `ExploreModal` con `hideCloseButton` + `bodyClassName: !overflow-visible` (ver §5.5 sombra) hasta migrar |
| `HeaderModal` | props `title` / `description` / `eyebrow` de `Modal` | Cierre líquido automático en header |
| `SideModal` / panel lateral | `Modal` centrado | No recrear paneles laterales |
| `ModalAlert` (shadcn) / alerta 1 línea | `Dialog` `size="sm"` | Confirmación destructiva: `Button destructive` en footer |
| Modal rsuite | `Modal` v2 | — |

##### Arquitectura — dos archivos por flujo

```
*FooModalV2.tsx              ← shell: open, onClose, title, description, size, panelClassName
└── *FooModalContentV2.tsx ← cuerpo: queries, toolbar interna, formulario, cards, estados
```

**Shell (wrapper):**

```tsx
<Modal
  open={open}
  onClose={onClose}
  title={title}
  description={description}   // opcional; útil en previews con contexto dinámico
  size="md"                   // formulario | "xl" preview listado
  panelClassName="max-h-[min(88vh,680px)]"
  headerClassName="px-4 py-2.5 sm:px-5 sm:py-3"
  bodyClassName="px-4 py-3 sm:px-5 sm:py-3.5"
  footer={formFooter}         // formularios: ModalButtons; listados: omitir
>
  <FooModalContentV2 {...contentProps} hideFooter onClose={onClose} />
</Modal>
```

**Montaje en página:**

```tsx
<MaintainerGridPageV2
  overlays={
    <FooModalV2 open={previewOpen} onClose={() => setPreviewOpen(false)} item={selected} />
  }
>
  …
</MaintainerGridPageV2>
```

**Reset al cerrar:** limpiar estado derivado cuando `open === false` (conteos, selección, drafts).

##### Variante A — Formulario crear / editar

Patrón maintainer CRUD (modal disparado desde FAB o card).

| Aspecto | Valor canónico |
|---|---|
| `size` | `md` (compacto) · `lg` si wizard ancho |
| `panelClassName` | `max-h-[min(88vh,680px)]` |
| Contenido | `*CreateModalContentV2` / `*UpdateModalContentV2` |
| Header interno del form | `hideHeader={true}` — el título lo pone `Modal` |
| Footer | Slot `footer` + `ModalButtons` `compact` (Cancel `slate` · Submit según `submitVariant`) — **no** en el body |

##### Variante B — Preview con listado embebido

Patrón preview al seleccionar un ítem (blip, fila, card): cuerpo con datos async + filtros locales.

| Aspecto | Valor canónico |
|---|---|
| `size` | `xl` · `panelClassName="flex max-h-[min(88vh,780px)] flex-col"` |
| Header | `title` + `description` construidos desde datos del cuerpo (p. ej. conteo vía callback `onCountChange`) |
| Toolbar **dentro del body** | fila con `LiquidPillDropdown` (ordenar, **trigger solo ícono**), `SwitcherV2` (toggle), `LiquidPillGroup sm` (vista lista/grid) |
| Body | `bodyClassName` con gradiente aurora → blanco (ver §5.5); `bodyScrollFade` si el listado puede scrollear |
| Apertura / loading | Si el preview consulta datos al abrir: **`bubbleReveal` + `loading`** (§5.5). Empty post-load: `PageEmptyStateV2` embedded |
| Listado | grid de `*CardV2` o filas; CTAs de ítem con `LiquidPill` / `Button` outline según §6.11.6 |

##### Variante C — Listado de personas con tabs en header

Patrón para reacciones, asistentes, miembros filtrables, etc. Referencia: `ExploreReactionsModalV2`.

| Aspecto | Valor canónico |
|---|---|
| `size` | `xl` |
| `panelClassName` | `flex max-h-[min(88vh,780px)] flex-col` |
| `headerClassName` | `px-4 py-2.5 sm:px-5 sm:py-3` |
| `bodyClassName` | gradiente aurora → blanco (§5.5) + `py-3 sm:py-3.5` |
| `bodyScrollFade` | `true` en listas que superan el alto del panel |
| **Apertura / loading** | **`bubbleReveal` + `loading` + `loadingLabel`** — spinner compacto del Modal; el hijo reporta con `onLoadingChange` (clear one-way). **No** `PageLoadingStateV2` en el body |
| Header | slot `header`: eyebrow + título + descripción (conteo) a la izquierda; `LiquidPillGroup sm` en cápsula vidrio a la derecha |
| Tabs | **No** duplicar tabs en el body cuando `onTabChange` está conectado al shell — el cuerpo solo filtra y notifica |
| Listado | filas **variante A** §5.5 (avatar 32px, `gap-1` entre filas, `py-2` por fila); sin cards con fondo por fila |
| Empty (post-load) | `PageEmptyStateV2` `embedded` — solo cuando `loading === false` |
| Conteo en header | publicar `onCountChange` **solo** cuando la query terminó (no en el mount vacío) |
| Reset al cerrar | limpiar tabs, contadores y `contentLoading` en `onClose` del shell |
| Montaje preferido | `Modal` v2 local en `overlays` o componente padre — **no** `openModal` sin shell (rutas legacy `MessageReaction` pendientes) |

##### Variante D — Ranking Explore (sin tabs)

Patrón para rankings de valores, coins, certificados, celebraciones. Referencia: `FullRankingCorporateValue` + `UserItemRanking` + `ExploreModal`.

| Aspecto | Valor canónico |
|---|---|
| `size` | `lg` · `panelClassName="max-w-2xl"` (listado estrecho sin tabs) |
| Header | eyebrow `EXPLORAR` + título con ícono módulo **inline 16px** + `description` con conteo (`N usuarios`) |
| Tabs | **No** — listado único sin `LiquidPillGroup` |
| `bodyScrollFade` | recomendado al migrar a `Modal` v2; opcional en `ExploreModal` puente |
| Listado | filas **variante B** §5.5 (badge izquierda → avatar → nombre `13px` + email · rol `9px`); `gap-1` · `py-1.5` por fila |
| Badge métrica | **Izquierda** de la persona (antes del avatar) — ícono del módulo + cantidad |
| Montaje canónico | `*RankingModalV2` con `Modal` v2 en `overlays` |
| Montaje puente | `openModal` + `ExploreModal` + `hideCloseButton: true` + `!overflow-visible` en body (§5.5 sombra) |

**Diferencias C vs D (checklist visual):**

| Aspecto | C — Reacciones / tabs | D — Ranking Explore |
|---|---|---|
| Shell | `Modal` v2 directo | `Modal` v2 directo (objetivo) · `ExploreModal` (puente) |
| Tabs header | `LiquidPillGroup` | No |
| Fila persona | 2 líneas: nombre `13px` + email `9px` | 2 líneas: nombre `13px` + email · rol `9px` + badge izquierda |
| `bodyScrollFade` | Sí | Sí al usar `Modal` v2 |
| Sombra | En panel `Modal` | En panel con sombra; evitar doble contenedor con scroll |

##### ¿Migrar también los inputs?

**Sí — obligatorio en rediseño completo.** Los modales con formulario usan **exclusivamente** primitivos de entrada v2 (§5.3 y tabla «Inputs — uso exclusivo v2» en §5.5). Cambiar solo el shell y dejar campos legacy dentro **es un paso intermedio**, no el estado final.

| Capa del modal | Componente v2 | Obligatorio en rediseño completo |
|---|---|---|
| Texto corto | `Input` `size="sm"` | ✅ |
| Contraseña | `PasswordInput` | ✅ |
| Texto largo | `Textarea` `size="sm"` | ✅ |
| Toggle / boolean | `SwitcherV2` `dense` | ✅ |
| Archivo / imagen | `ImageUploaderV2` | ✅ |
| Select simple (líquido) | `LiquidSelectList` | ✅ |
| Select simple (denso / search) | `SelectPickerV2` / `Select` v2 | ✅ |
| Tags / multi-select | `TagPickerV2` / `MultiSelectFilterV2` | ✅ |
| Acciones / menú ⋯ | `LiquidPillDropdown` | ✅ (no como select de valor) |
| Radio | `RadioGroup` v2 | ✅ |
| Footer guardar | `ModalButtons` → `LiquidPill` tinted + `selectionSolid` | ✅ |
| Filtros / orden en toolbar del body | `LiquidPillDropdown`, `LiquidPillGroup`, `SwitcherV2` | ✅ |
| Tabs de filtro en header (listado personas) | `LiquidPillGroup` `sm` en slot `header` | ✅ |
| Pickers rsuite (`TagPicker`, etc.) | Puente **temporal** | ⚠️ solo si no existe picker v2 equivalente; `menuStyle={{ zIndex: Z_INDEX.MODAL + 100 }}` |
| `Input` rsuite / shadcn / HTML suelto | — | ❌ en modales rediseñados |
| `Button` shadcn / sticky Cancel-Save en body | Slot `footer` + `ModalButtons` | ❌ |

**Regla práctica:** al migrar un formulario legacy dentro del modal, sustituir campo a campo por primitivos §5.3. Si el formulario es grande, el `*ModalContentV2` puede ser un thin wrapper que pasa `onClose`, `hideHeader`, `compact` al formulario mientras se migran los campos internos — pero el **objetivo** es que el formulario use **solo** primitivos v2 de entrada.

**Excepción:** modales de **solo preview o listado** (sin formulario) no llevan `Input`; llevan toolbar líquida, filas de personas, cards y estados.

##### Tamaños y padding — referencia rápida

| Tipo de modal | `size` | `panelClassName` | Notas |
|---|---|---|---|
| Confirmación / alerta | — | usar `Dialog` sm | — |
| Crear / editar entidad | `md` | `max-h-[min(88vh,680px)]` | inputs v2 exclusivos |
| Preview listado / detalle rico | `xl` | `flex max-h-[min(88vh,780px)] flex-col` | toolbar en body; `bodyScrollFade` si aplica |
| Listado personas con tabs | `xl` | `flex max-h-[min(88vh,780px)] flex-col` | tabs en `header`; filas 2 líneas; `bodyScrollFade` |
| Ranking Explore sin tabs | `lg` | `max-w-2xl` + altura §5.5 | variante B §5.5; sin tabs; sombra §5.5 |
| Wizard / tabla ancha | `lg` · `full` | según contenido | — |

Header/body: mismas clases compactas que §6.10 (Modal de formulario / listado).

##### Checklist — migración de un modal legacy

- [ ] Identificar variante: **formulario** (A), **preview listado** (B), **listado personas con tabs** (C) o **ranking Explore** (D).
- [ ] Reemplazar mecanismo de apertura (drawer/portal/provider) por estado `open` en orquestador.
- [ ] Crear `*ModalV2` (shell) + `*ModalContentV2` (cuerpo).
- [ ] Montar en prop **`overlays`** del composite de página.
- [ ] Elegir `size` y `panelClassName` según tabla anterior.
- [ ] Formulario: **solo** inputs v2 + **`footer` + `ModalButtons`** (`LiquidPill` `selectionSolid`); sin botones sticky en body; pickers rsuite solo puente temporal con z-index.
- [ ] Preview: toolbar interna con familia `Liquid*`; loading/empty/card v2 en body.
- [ ] Listado personas (C): filas 2 líneas §5.5, tabs `LiquidPillGroup` en `header`, `bodyScrollFade`, gradiente body aurora → blanco, `Modal` v2 directo, **`bubbleReveal` + `loading`** (no `PageLoadingStateV2` en body).
- [ ] Ranking Explore (D): filas variante B §5.5 (badge izquierda, nombre `13px`, secundario `9px`), conteo en `description`, panel `lg` / `max-w-2xl`; sombra en panel único (§5.5); si usa `openModal` + `ExploreModal`, `!overflow-visible` en body.
- [ ] Confirmaciones destructivas: `Dialog`, no `Modal`.
- [ ] Verificar cierre (Esc, backdrop, botón rose), scroll del body, **sombra completa del panel** (sin recorte inferior) y z-index de menús desplegables.
- [ ] **Enter pop:** al abrir se ve el scale de `Modal` v2 (también con `openModal` / `unstyledPanel` / `ExploreModal`); no reimplementar fade/scale en el contenido.
- [ ] **Cierre sin flash de loading:** no setear `loading={true}` en `onClose`; reset solo al reabrir.
- [ ] **Motion:** morph post-`bubbleReveal` ~860 ms `liquidBounce` (alto + ancho); no keyframes custom en el contenido.
- [ ] **Tipografía §5.5:** header (9 / 13 / 11 px), body primario 13px, secundario 9px, pills 10px — en **todos** los textos del modal.
- [ ] Eliminar imports y providers legacy del flujo migrado.

---

### 5.6 Layout y páginas

> **Estructura completa de una página:** ver **§6** (capas, anatomía, cards, CTAs, layout §6.11).

#### `AppPageLayoutV2`
**Cuándo usarlo:** **Toda página autenticada v2.** Configura spectrum band, padding, frame opcional.

#### `PageHeaderV2`
**Cuándo usarlo:**
- **Único header** de páginas del sidebar (maintainer y usuario): título, descripción, badges, partículas.
- **No crear** wrappers `*PageHeaderV2` por dominio — componer `PageHeaderV2` inline en la prop `header` del composite o en la página.
- `showParticles` + `particleIcon`: **obligatorio** en rutas del sidebar (por defecto `showParticles={true}`; requiere `particleIcon` del módulo).
- `leadingIcon` (`h-10 w-10`) + color de dominio para identidad visual.
- `titleSuffix`: botón ayuda (`LiquidPill` circle xxs) u otro control **no accional** (no CTAs de crear/exportar).
- `paddingTopClassName="pt-20"`: por defecto; alinea bajo navbar fijo.

**No usar en header:**
- `rightAction` — **deprecado y no se renderiza**. Crear → `MaintainerFabStackV2`; exportar/descargar/filtros secundarios → `PageToolbarV2`, prop `filters` o fila bajo toolbar.

**Tipo para composites:** `PageHeaderV2Config` = props de header sin `paddingTopClassName` ni `rightAction`.

#### `PageHeader` (legacy)
**Cuándo usarlo:** Solo en migración gradual. Preferir `PageHeaderV2`.

#### `MaintainerPageV2`
**Cuándo usarlo:** **Plantilla CRUD** — header + búsqueda + filtros + grid/list + paginación + empty state. Preferir `MaintainerGridPageV2` / `MaintainerListPageV2` (§6.11).

#### `PageFilters`
**Cuándo usarlo:** Grilla de filtros con toggle "Avanzados" en páginas de listado.

#### `PageEmptyState`
**Cuándo usarlo:** Pantalla vacía con icono, título, descripción y CTA.

#### `NoResult`
**Cuándo usarlo:** Búsqueda/filtro sin resultados (distinto de empty state — aquí **sí hay datos**, solo no coinciden).

#### `Loader`
**Cuándo usarlo:** Spinner centrado con texto opcional durante fetch.

#### `SuccessView`
**Cuándo usarlo:** Pantalla de confirmación post-acción ("¡Guardado!", "¡Enviado!").

---

### 5.7 Navegación

#### `AppNavbar` / `PublicNavbar`
**Cuándo usarlo:** Top navigation autenticada y pública. No reimplementar navbar en páginas.

#### `NavbarUserSearch`
**Cuándo usarlo:** Búsqueda de usuarios en navbar con morph aurora. Modos `inline` e `icon`.

#### `NotificationCenter` / `NotificationButton`
**Cuándo usarlo:** Campana de notificaciones en navbar.

#### `SessionMenu` / `AvatarMenu`
**Cuándo usarlo:** Menú de sesión del usuario (perfil, logout, onboarding pill).

#### `Sidebar` / `SidebarIconRailV2`
**Cuándo usarlo:** Navegación lateral principal. Rail de iconos con flyouts.

#### `SidebarLiquidButton`
**Cuándo usarlo:** Items de menú sidebar con expand líquido y partículas.

#### `CircleActionButton` (legacy)
**Cuándo usarlo:** Íconos del sidebar rail en migración gradual (`context="sidebar"`). Control interactivo glass/frost legacy. Preferir `SidebarLiquidButton` en código nuevo.

#### `SidebarExplorePanel`
**Cuándo usarlo:** Panel explore integrado en sidebar.

---

### 5.8 Datos y listas

#### `Pagination`
**Cuándo usarlo:** Paginación de listados maintainer. Usa `LiquidPill` para botones de página.

#### `SortList`
**Cuándo usarlo:** Reordenamiento drag-and-drop de items (orden de preguntas, fases de career).

#### `Avatar`
**Cuándo usarlo:** Avatar v2 con imagen o iniciales. Para listados simples.

#### `PostAuthor`
**Cuándo usarlo:** Bloque autor + timestamp en cards de feed/comentarios.

---

### 5.9 Dominio Explore

| Componente | Cuándo usarlo |
|---|---|
| `ExplorePageLayoutV2` | Layout completo del feed Explore |
| `ExploreTimelinePanelV2` | Panel central del timeline |
| `ExploreSidePanelV2` | Panel lateral desktop |
| `ExploreMobileSidePanelV2` | Panel lateral mobile |
| `EventCard` | Card de evento en timeline |
| `FeedCardFooter` | Footer de acciones en card (reacciones, comentarios) |
| `ExploreEmptyStateV2` | Feed sin contenido |
| `ReactionFloaties` | Efectos efímeros de reacción (z-index EXPLORE_REACTION) |

---

### 5.10 Dominio Home

| Componente | Cuándo usarlo |
|---|---|
| `HomePageLayoutV2` | Layout del dashboard home |
| `HomeHeroHeaderV2` | Hero principal con métricas |
| `HomeMetricCardV2` | Card de métrica numérica |
| `HomeProgressCardV2` | Card de progreso con ring |
| `HomeTabsV2` | Tabs del dashboard |
| `HomeExpandableCardV2` | Card expandible con detalle |
| `HomeEmptyStateV2` / `HomeLoadingStateV2` | Estados de carga/vacío |

---

### 5.11 Dominio — convención de archivos por módulo

Cada módulo rediseñado vive en `components/ui/v2/<dominio>/` con nombres predecibles:

| Artefacto | Convención | Rol |
|---|---|---|
| Orquestador maintainer | `<Dominio>MaintainerPageV2.tsx` | Layout §6.11 + data + estados |
| Orquestador usuario | `<Dominio>UserPageV2.tsx` o `<Dominio>PageV2.tsx` | Variante §6.13 listado lectura |
| Card de ítem | `<Dominio>CardV2.tsx` | Shell §6.6–§6.7 |
| Modal crear | `<Dominio>CreateModalContentV2.tsx` | Formulario en `Modal` |
| Modal editar | `<Dominio>UpdateModalContentV2.tsx` | Idem |
| Loading | `<Dominio>LoadingStateV2.tsx` | Wrapper de `PageLoadingStateV2` |
| Guía | `<Dominio>GuideDialogV2.tsx` | Wrapper de `InteractiveGuideDialogV2` |
| Barrel | `index.ts` | Exports públicos del dominio |

**Patrón:** orquestador + header inline + `*CardV2` + modales de dominio + estados. Ver **§6.8–§6.9** y proceso **§2.7**.

---

### 5.12 Composites auxiliares

| Componente | Cuándo usarlo |
|---|---|
| `ComposeActions` | Footer de publicación en composer (Explore) |
| `ComposeSection` / `ComposeDivider` | Secciones del composer |
| `ComposeHelpTrigger` | Botón de ayuda en composer |
| `SearchInputAuroraGlow` | Input de búsqueda con glow aurora (navbar) |
| `DropdownAuroraGlow` | Glow decorativo en modales |
| `CardColorEclipse` | Eclipse de color decorativo en cards |
| `ProgressRing` | Anillo de progreso circular |
| `AuthPageLayout` | Layout de login/registro con aurora |
| `AuthLink` | Enlace estilizado en flujos auth |
| `XPNotification` | Toast de XP ganado (z-index TOAST) |

---

### 5.13 Utilidades

| Export | Uso |
|---|---|
| `Z_INDEX` | Capas de stacking |
| `V2_MOTION` | Curvas de animación |
| `CIRCLE_ACTION_VARIANTS` | Lista de variantes de color |
| `resolveCircleActionVariant` | Normalizar variante |
| `fieldVariantClasses` / `FieldVariant` | Colores de campos de formulario |
| `resolveCorporateValueVisual` | Mapeo valor corporativo → variante visual |
| `useSidebarNavigation` | Hook de navegación sidebar |

---

## 6. Estructura canónica de página v2

Toda pantalla v2 sigue **capas fijas**. La página (`pages/`) solo monta un componente de dominio; la estructura visual vive en `components/ui/v2/`.

### 6.1 Capas del sistema (de afuera hacia adentro)

```
ManagerProLayout                          ← shell global (navbar, sidebar, scroll)
└── #app-main-scroll
    └── #manager-container
        └── pages/app/.../index.tsx       ← thin route: solo importa *PageV2
            └── *PageV2                    ← orquestador de la pantalla
                └── AppPageLayoutV2        ← padding, spectrum band, frame opcional
                    ├── [Header]
                    ├── [Toolbar]
                    ├── [Meta / resumen]
                    ├── [Contenido principal]
                    ├── [Footer / paginación]
                    └── [Overlays + FABs]  ← fuera del flujo scroll del contenido
```

| Capa | Dónde vive | Responsabilidad |
|---|---|---|
| **Shell app** | `ManagerProLayout` | Navbar, sidebar, `#app-main-scroll`, offset del navbar. **No tocar desde páginas v2.** |
| **Ruta** | `src/pages/app/**/index.tsx` | `"use client"` + render de un solo `*PageV2`. Sin lógica de negocio ni layout propio. |
| **Layout de página** | `AppPageLayoutV2` | Padding exterior (`p-3 md:p-6`), spectrum band bajo navbar, frame interno opcional. |
| **Header** | `PageHeaderV2` (inline; sin wrappers de dominio) | Título, descripción, badges, partículas. **Sin botones** — acciones en FAB/toolbar. |
| **Toolbar** | Composición inline o `MaintainerPageV2` | Búsqueda (`Input`), filtros (`LiquidPillDropdown`, `LiquidPillGroup`), chips activos. |
| **Meta bar** | Composición maintainer | Obligatorio en listados con datos (§6.11.4). Omitir en widgets/canvas. |
| **Contenido** | Grid / lista / tabla | Cards de dominio (`*CardV2`), filas, timeline. Material **sólido**. |
| **Estados** | `*LoadingStateV2`, empty inline, `PageEmptyState`, `NoResult` | Carga inicial, vacío absoluto, sin resultados de búsqueda. |
| **Footer de página** | `Pagination` + pills informativas | Solo si hay más de una página. |
| **Acciones globales** | `LiquidFixedCircleButton` | Crear, quick actions. In-tree cuando `reactive`. |
| **Overlays** | `Modal` v2, guías, tooltips | Formularios crear/editar, onboarding. Siempre `Modal` v2 — no `SideModal`. |

### 6.2 Anatomía — página maintainer CRUD

Ver árbol de slots **§6.11.1** y capas **§6.8**.

```
*MaintainerPageV2 (dominio)
│
├── MaintainerListPageV2          ← listas / tablas con búsqueda y paginación
│   o MaintainerGridPageV2        ← grids custom o contenido embebido sin toolbar estándar
│   │
│   ├── [Contenedor de página]    min-h-screen + max-w-7xl + space-y-6 (interno al composite)
│   │
│   ├── *GuideDialogV2            onboarding (condicional, vía overlays o beforeContent)
│   │
│   ├── PageHeaderV2              vía prop header (PageHeaderV2Config o ReactNode)
│   │   ├── leadingIcon           h-10 w-10 + color dominio
│   │   ├── title + titleSuffix   ayuda opcional (LiquidPill circle xxs)
│   │   ├── description
│   │   ├── badges                totales, filtro activo, páginas (LiquidPill sm)
│   │   ├── showParticles         true por defecto en sidebar
│   │   └── particleIcon          icono Lucide del módulo (obligatorio para partículas)
│   │
│   ├── PageToolbarV2             búsqueda + filtros + acciones secundarias (export, etc.)
│   │
│   ├── [Estado / contenido]
│   │   ├── PageLoadingStateV2    → carga inicial sin datos
│   │   ├── PageEmptyStateV2      → vacío / noResult
│   │   └── [Con datos]
│   │       ├── PageMetaBarV2     (opcional)
│   │       ├── Grid / Table / *CardV2
│   │       └── PagePaginationFooterV2
│   │
│   └── helpTooltips              onboarding contextual (opcional)
│
├── overlays                      Dialog + Modal v2 (fuera del scroll)
└── MaintainerFabStackV2          acción primaria crear (+ quickie opcional)
```

**Reglas de esta anatomía:**

1. El **header no desaparece** durante loading — solo el cuerpo cambia de estado.
2. El **loading inicial** (`PageLoadingStateV2`) solo cuando no hay datos cacheados; refetch mantiene el grid visible.
3. **Empty state** ≠ **NoResult**: vacío = no hay registros; no result = búsqueda/filtro sin coincidencias (`PageEmptyStateV2` con `variant`).
4. La **acción primaria de crear** va en **`MaintainerFabStackV2` (`fab`)**, no en el header.
5. **Exportar, descargar, invitaciones** y filtros secundarios van en **`PageToolbarV2` / prop `filters`** — nunca en el header.

#### Filtros en toolbar — Layout en una línea

**Estructura:**
```tsx
<div className="flex flex-nowrap items-center gap-2">
  {/* Filtro 1: SelectPickerV2 (Usuario/Responsable) */}
  <SelectPickerV2
    placeholder={t("Usuario")}
    cleanable
    size="filter"  {/* ✅ OBLIGATORIO */}
  />
  
  {/* Filtro 2: TagPickerV2 (Tags/Categorías) */}
  <TagPickerV2
    placeholder={t("Tags")}
    cleanable
    size="filter"  {/* ✅ OBLIGATORIO */}
  />
</div>
```

**Reglas:**
- ✅ **Contenedor principal:** `flex flex-nowrap items-center gap-2` (mantiene una línea horizontal)
- ✅ **CADA picker debe tener `size="filter"`** — aplica automáticamente w-64 h-11 para alineación perfecta con el Input de búsqueda
- ✅ **Sin `className` para tamaños**: Usar prop `size="filter"` en SelectPickerV2, TagPickerV2, MultiSelectFilterV2, Input, etc.
- ✅ **Sin `<div className="w-64">` wrappers**: El tamaño se aplica directamente en los pickers
- ✅ **`gap-2`**: Espaciado consistente entre filtros (§6.10 = 8px)
- ✅ **`cleanable`**: Siempre presente en SelectPickerV2, TagPickerV2, MultiSelectFilterV2 para limpiar filtros

**Tamaños disponibles en pickers (SelectPickerV2, TagPickerV2):**
- `"filter"` (DEFAULT) — w-64 h-11 (256px width, 44px height) ✅ Para filtros en toolbar
- `"sm"` — h-11 w-full — Para otros contextos compactos
- `"md"` — h-11 w-full — Para contextos medianos
- `"lg"` — h-11 w-full — Para contextos amplios

**Resultado visual:** 
```
┌───────────────────────────────────────────────────┐
│ 🔍 Búsqueda...  [Usuario ▼] [Tags ▼]   │
│ (w-64)         (w-64)      (w-64)     │
│ (size="sm") (size="filter") (size="filter") │
└───────────────────────────────────────────────────┘
```

**Ejemplo real (Action Plans — /app/maintainers/actionplan):**

Filtros con `size="filter"` se alinean perfectamente:

```tsx
<div className="flex flex-nowrap items-center gap-2">
  <SelectPickerV2
    placeholder={t("Usuario")}
    cleanable
    size="filter"  {/* ✅ Aplica w-64 h-11 automáticamente */}
  />
  <TagPickerV2
    placeholder={t("Tags")}
    cleanable
    size="filter"  {/* ✅ Aplica w-64 h-11 automáticamente */}
  />
</div>
```

6. **Modales, diálogos y FABs** se declaran en props `overlays` / `fab` del composite — nunca dentro del contenedor scrollable.
7. **`headerPaddingTopClassName="pt-20"`** (default en composites) + **`particleIcon`** en todas las rutas del sidebar.
8. **Espaciado vertical** entre bloques de página: ver **§6.10**.

#### Estructura integral de página CRUD del sidebar

**Composición end-to-end** (referencia real: `/app/maintainers/appreciation`):

```
Página = MaintainerGridPageV2[
  ① HEADER (PageHeaderV2)
     ├─ leadingIcon (Lucide h-10 w-10 + color dominio)
     ├─ title + description
     ├─ titleSuffix (botón help circle xxs opcional)
     ├─ badges (3× LiquidPill sm + icon, métricas del dominio)
     └─ particleIcon (obligatorio en sidebar)
  
  ② TOOLBAR (PageToolbarV2)
     ├─ Búsqueda Input (searchValue + onSearchChange)
     ├─ Chip búsqueda activa (LiquidPill emerald auto-visible si search !== "")
     └─ filters (LiquidPillDropdown o múltiples pickers en flex-nowrap)
  
  ③ CONTENT (Grid responsive)
     ├─ Loading state (PageLoadingStateV2 o custom)
     ├─ Empty state (PageEmptyStateV2)
     ├─ No result state (cuando búsqueda/filtro sin coincidencias)
     └─ Cards grid (1/2/3 cols según viewport, gap-4)
        └─ Cada card (*CardV2):
           ① HERO (h-28): imagen o gradient + LiquidPillDropdown (MoreHorizontal) absolute right-3 top-3
           ② BODY (flex-1): meta pills + título + descripción + CardAuthorV2
           ③ FOOTER: CTA o divider
  
  ④ META BAR (PageMetaBarV2 si aplica)
     └─ Resumen: ícono + texto dinámico
  
  ⑤ FAB (MaintainerFabStackV2)
     └─ Botón primario crear + quickie modal opcional
  
  ⑥ MODALES/DIALOGS
     └─ Preview, edit, delete confirmations
]
```

**Props requeridos en MaintainerGridPageV2:**

| Prop | Ejemplo | Obligatorio |
|------|---------|-----|
| `header` | `{ title, description, leadingIcon, badges, titleSuffix?, particleIcon }` | ✅ |
| `toolbar` | `<PageToolbarV2 searchValue={...} filters={...} />` | ✅ |
| `loading` | `boolean` | ✅ |
| `isEmpty` | `boolean` | ✅ |
| `emptyState` | `<PageEmptyStateV2 variant={search ? "noResult" : "empty"} />` | ✅ |
| `loadingState` | `<*LoadingStateV2 />` | ⚠️ Recomendado |
| `metaBar` | `<PageMetaBarV2 icon={...} summary={...} />` | ⚠️ Opcional |
| `fab` | `<MaintainerFabStackV2 ... />` | ⚠️ Para CRUD create |
| `children` | `<div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">...</div>` | ✅ |

**Ejemplo real (Appreciation maintainer):**

```tsx
export function AppreciationMaintainerPageV2() {
  // ... queries, filters, pagination

  return (
    <MaintainerGridPageV2
      header={{
        title: t("Evaluaciones"),
        description: t("Crea evaluaciones para tu organización de forma rápida"),
        leadingIcon: (
          <ClipboardList className="h-10 w-10 shrink-0 text-indigo-600 dark:text-indigo-300" />
        ),
        titleSuffix: renderGuide ? (
          <LiquidPill
            as="button"
            type="button"
            variant="indigo"
            appearance="tinted"
            shape="circle"
            size="xxs"
            icon={<CircleHelp className="h-3.5 w-3.5" />}
            onClick={handleOpenGuide}
          />
        ) : undefined,
        badges: (
          <>
            <LiquidPill
              variant="indigo"
              appearance="tinted"
              size="sm"
              icon={<ClipboardList className="h-4 w-4" />}
              text={
                <>
                  <span className="font-semibold text-current">{totalQuestions}</span> {t("evaluaciones")}
                </>
              }
            />
            <LiquidPill
              variant="emerald"
              appearance="tinted"
              size="sm"
              icon={<Filter className="h-4 w-4" />}
              text={activeFilterLabel}
            />
            <LiquidPill
              variant="sky"
              appearance="tinted"
              size="sm"
              icon={<BarChart3 className="h-4 w-4" />}
              text={
                <>
                  <span className="font-semibold text-current">{totalPageDisplay}</span> {t("páginas")}
                </>
              }
            />
          </>
        ),
        particleIcon: ClipboardList,
      }}
      toolbar={
        <PageToolbarV2
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder={t("Buscar evaluaciones")}
          clearSearchLabel={t("Limpiar búsqueda")}
          filters={
            <LiquidPillDropdown
              items={filterItems}
              value={active}
              onSelect={setActive}
              icon={<Filter className="h-4 w-4" />}
              variant={active === "all" ? "indigo" : "emerald"}
              active
              size="md"
              collapsedShape="circle"
            />
          }
        />
      }
      loading={showListLoading}
      isEmpty={isEmpty}
      emptyState={
        <PageEmptyStateV2
          variant={search ? "noResult" : "empty"}
          icon={<ClipboardList className="h-8 w-8" />}
          title={search ? t("No se encontraron evaluaciones") : t("Aún no tienes evaluaciones creadas")}
          onClearSearch={search ? () => setSearch("") : undefined}
        />
      }
      metaBar={<PageMetaBarV2 icon={ClipboardList} summary={`${appreciations.length} evaluaciones`} />}
      fab={
        <MaintainerFabStackV2
          fab={{ icon: Plus, label: t("Crear evaluación") }}
          onClick={openCreate}
        />
      }
    >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {appreciations.map((appreciation) => (
          <AppreciationCardV2
            key={appreciation.id}
            data={appreciation}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        ))}
      </div>
    </MaintainerGridPageV2>
  );
}
```

**Cada card (*CardV2) sigue §6.6:**

```
① HERO (h-28, relative)
   ├─ Imagen/gradient background
   └─ LiquidPillDropdown (MoreHorizontal sm circle) absolute right-3 top-3

② BODY (flex-1 p-3)
   ├─ Meta pills (LiquidPill xs tinted, NO onClick)
   ├─ Título (h3 text-base font-semibold)
   ├─ Descripción (p text-sm)
   └─ CardAuthorV2 (firstName, lastName, avatarUrl)

③ FOOTER (border-t p-3)
   └─ CTA: LiquidPill as="button" size="card-cta"
```

#### MaintainerListPageV2 (listas CRUD)

Cuando el dominio es tabla o lista paginada con búsqueda estándar:

```tsx
<MaintainerListPageV2
  header={{
    leadingIcon: <ClipboardList className="h-10 w-10 shrink-0 text-indigo-600 dark:text-indigo-300" />,
    title,
    description,
    badges: <LiquidPill ... />,
    particleIcon: ClipboardList,
  }}
  searchValue={search}
  onSearchChange={setSearch}
  filters={
    <>
      {/* acciones secundarias: export, invitaciones, etc. */}
      <LiquidPillExpandButton icon={<Download />} label="Descargar" ... />
      <LiquidPillDropdown ... />
    </>
  }
  loading={loading}
  isEmpty={isEmpty}
  emptyState={<PageEmptyStateV2 ... />}
  currentPage={page}
  totalPages={totalPages}
  onPageChange={setPage}
  overlays={<>...</>}
  fab={<MaintainerFabStackV2 createAriaLabel="..." onCreate={...} />}
>
  <Table ... />
</MaintainerListPageV2>
```

#### MaintainerGridPageV2 (grid / contenido embebido)

Cuando el cuerpo es grid de cards, widget legacy o sub-layout sin toolbar de búsqueda:

```tsx
<MaintainerGridPageV2
  header={{
    leadingIcon: <ClipboardList className="h-10 w-10 shrink-0 text-indigo-600 dark:text-indigo-300" />,
    title,
    description,
    badges: <>...</>,
    particleIcon: ClipboardList,
    titleSuffix: <LiquidPill as="button" ... />, // ayuda opcional
  }}
  toolbar={...}           // opcional
  loading={loading}
  isEmpty={isEmpty}
  emptyState={<PageEmptyStateV2 ... />}
  overlays={<>...</>}
  fab={<MaintainerFabStackV2 ... />}
>
  <div className="grid ...">{items.map(...)}</div>
</MaintainerGridPageV2>
```

### 6.3 Variantes de layout por tipo de página (taxonomía — 8 tipos)

Toda ruta producto debe usar **exactamente uno** de estos shells:

| Tipo | Layout composite | Cuándo | Max width |
|---|---|---|---|
| **List CRUD** | `MaintainerListPageV2` | Listas con búsqueda + paginación (sin tabla densa) | `max-w-7xl` |
| **List + Table** | `MaintainerListPageV2` + `MaintainerDataTableV2` | CRUD tabular maintainer | `max-w-7xl` |
| **Grid CRUD** | `MaintainerGridPageV2` | Cards en grid | `max-w-7xl` |
| **Detail / Edit** | `DetailPageLayoutV2` | Sub-rutas detalle, editores, quiz | `max-w-7xl` |
| **Feed / Home** | `ExplorePageLayoutV2` / `HomePageLayoutV2` | Explore; dashboard con **`PageHeaderV2`** (no `HomeHeroHeaderV2`) | frame home |
| **Auth** | `AuthPageLayout` | Login, register, recovery | centrado |
| **Public** | `PublicPageLayoutV2` | Portal, errores, perfil público | `max-w-lg`–`max-w-4xl` |
| **Form wizard** | `FormPageLayoutV2` | Builder encuestas, onboarding, CV wizard | `max-w-3xl` |

| Tipo (legacy) | Layout composite | `AppPageLayoutV2` | Header |
|---|---|---|---|
| **Maintainer CRUD (lista/tabla)** | `MaintainerListPageV2` | `withFrame={false}` (interno) | `PageHeaderV2` + `showParticles` + `pt-20` |
| **Maintainer CRUD (grid/cards)** | `MaintainerGridPageV2` | `withFrame={false}` (interno) | `PageHeaderV2` inline + partículas + `pt-20` |
| **Maintainer genérico legacy** | `MaintainerPageV2` | `withFrame={false}` | via prop `header` — migrar a composites |
| **Home / dashboard** | `HomePageLayoutV2` | `withFrame={true}` (default) | **`PageHeaderV2`** (~~`HomeHeroHeaderV2`~~ deprecated) |
| **Explore** | `ExplorePageLayoutV2` | `withFrame={false}`, `outerPadding="none"` | Sin header clásico; timeline + side panel |
| **Auth** | `AuthPageLayout` | N/A (fuera del shell autenticado) | Título dentro del layout auth |

#### Excepciones — layouts especiales (Phase 4)

Algunos dominios **no encajan** en el toolbar estándar de `MaintainerListPageV2`. Usar el composite más cercano y documentar la excepción:

| Caso | Composite | Notas |
|---|---|---|
| **Explore / feed social** | `ExplorePageLayoutV2` | Sin `PageHeaderV2`. Panel timeline + side panel fijo. Ver §Explore abajo. |
| **Home / dashboard** | `HomePageLayoutV2` | Frame visible, secciones modulares, hero propio. |
| **Config / settings embebido** | `MaintainerGridPageV2` | Header + contenido de formulario o tabs (`VacationConfigPageV2`, reglas por país). Sin búsqueda. |
| **Wrapper legacy sin rediseñar** | `MaintainerGridPageV2` | Solo transitorio: biblioteca legacy embebida. **Objetivo:** absorber en orquestador §2.7. |
| **Sub-rutas de detalle** | Custom o `AppPageLayoutV2` | `TeamDetailPageV2`, etc.: `PageHeaderV2` contextual + partículas + botón back fuera del header. |
| **Challenge / contenido mixto** | `MaintainerGridPageV2` | Header + `ChallengeContentV2` embebido; sin empty/toolbar de lista. |

**Regla:** aun en excepciones, respetar **`overlays`** para modales, **`fab`** para crear cuando aplique, **`showParticles`** + **`pt-20`** en header clásico, e imports desde `components/ui/v2/maintainer/`.

#### Maintainer genérico con `MaintainerPageV2`

Cuando el dominio no necesita customización extra, componer directamente:

```tsx
<MaintainerPageV2
  header={{ title, description, badges, particleIcon: Icon }}
  searchValue={search}
  onSearchChange={setSearch}
  filters={<LiquidPillDropdown ... />}
  resultsLabel={`${count} resultados`}
  loading={loading}
  emptyState={<PageEmptyState ... />}
  currentPage={page}
  totalPages={totalPages}
  onPageChange={setPage}
>
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {items.map((item) => <FooCardV2 key={item.id} data={item} />)}
  </div>
</MaintainerPageV2>
```

#### Explore (layout especial)

Explore **no usa** `PageHeaderV2`. Su shell es propio:

```
ExplorePageLayoutV2
├── ExploreTimelinePanelV2      (contenido principal)
├── ExploreSidePanelV2          (desktop)
└── ExploreMobileSidePanelV2    (mobile, fixed)
```

### 6.4 Convención de archivos por dominio

```
src/pages/app/maintainers/<dominio>/index.tsx
  └── export default () => <DominioMaintainerPageV2 />

src/components/ui/v2/<dominio>/
  ├── index.ts                          ← exports públicos
  ├── <Dominio>MaintainerPageV2.tsx     ← orquestador (layout + data + estados + header inline)
  ├── <Dominio>CardV2.tsx               ← card del grid/lista
  ├── <Dominio>CreateModalContentV2.tsx ← formulario dentro de Modal v2
  ├── <Dominio>LoadingStateV2.tsx       ← skeleton/spinner de carga
  ├── <Dominio>GuideDialogV2.tsx      ← onboarding (opcional)
  └── <Dominio>HelpTooltipsV2.tsx       ← tooltips contextuales (opcional)
```

**Thin route — obligatorio:**

```tsx
"use client";

import { FooMaintainerPageV2 } from "components/ui/v2/foo";

export default function FooPage() {
  return <FooMaintainerPageV2 />;
}
```

### 6.5 Checklist al crear o rediseñar una página v2

> **Proceso completo:** §2.7. **Layout:** §6.11.

- [ ] Ruta thin → solo monta `*PageV2` (§2.7.2).
- [ ] Orquestador con data, filtros, estados y slots — no wrapper sobre legacy (§2.7.1).
- [ ] Layout: `MaintainerGridPageV2` o `MaintainerListPageV2` (§6.11.2).
- [ ] Orden de slots ①→⑩ (§6.11.1).
- [ ] Header: `PageHeaderV2` inline, **2–3 badges sm con iconos** (§6.11.3), `particleIcon`; icono grande y partículas coloreados con la variante del item principal del sidebar.
- [ ] Sin CTAs en header; FAB + toolbar según tipo de ruta (§6.13).
- [ ] Toolbar / meta bar / paginación según §6.11.4–§6.11.5 y §6.13.
- [ ] Contenido: `*CardV2` en grid o `MaintainerDataTableV2` (§6.6–§6.7, §6.11.7).
- [ ] Loading, empty, noResult, error (§2.7.4).
- [ ] Modales en `overlays`; formularios en `*ModalContentV2`.
- [ ] Componentes de dominio faltantes creados (§2.4).
- [ ] Definition of Done §2.7.4 completa antes de cerrar el rediseño.

### 6.6 Estructura canónica de `*CardV2` (maintainer)

Las cards de listado maintainer usan **`Card` v2 como shell sólido** y **`LiquidPill` / `LiquidPillDropdown` como controles** dentro (§6.6–§6.7).

```
*CardV2
└── Card                          size="full" padding="none" shadow="subtle" entranceAnimation fullHeight
    └── <article> flex flex-col h-full min-h-[360px]
        │
        ├── [Hero / media]          h-28, imagen o gradiente + overlay oscuro inferior
        │   ├── thumbnail | icono fallback
        │   ├── gradient overlay (from-black/32)
        │   └── [Controles flotantes] absolute right-3 top-3
        │       ├── QuickieButton (opcional, rol isi)
        │       └── LiquidPillDropdown (MoreHorizontal, sm, circle, reactive)
        │
        ├── [Cuerpo]                flex-1 flex-col p-3
        │   ├── [Meta pills]        LiquidPill xs tinted — tipo, contadores (NO clickeables)
        │   ├── [Título]            h3 line-clamp-2 font-semibold
        │   ├── [Descripción]       p line-clamp-3 (texto plano)
        │   └── [Autor]             avatar mini + "Por {nombre}" (opcional)
        │
        └── [Footer acciones]       border-t + grid grid-cols-2 gap-2
            └── LiquidPill as="button" × N   ← CTAs primarios de la card
```

**Props recomendadas del shell `Card`:**

| Prop | Valor maintainer | Por qué |
|---|---|---|
| `size` | `"full"` | Ocupa el ancho del grid |
| `padding` | `"none"` | El padding lo controla el `<article>` interno |
| `shadow` | `"subtle"` | Elevación ligera en grid denso |
| `entranceAnimation` | `true` | Entrada suave al montar |
| `fullHeight` | `true` | Cards alineadas en altura dentro del grid |

#### Etiquetado de personas responsables — `CardAuthorV2`

**Uso:** Etiqueta cualquier persona responsable, creador, autor, líder o responsable de la entidad en la card. Ubicación: parte inferior del cuerpo (flex-1), antes del footer. Componente opcional según dominio.

**Rol:** Mostrar identidad + responsabilidad de forma compacta (avatar mini + nombre).

**Estructura:** Avatar (18×18 px) + texto "Por {nombre} {apellido}"

**Patrones de etiquetado:**

| Caso de uso | Prop `firstName` | Prop `lastName` | Prop `avatarUrl` | Rol |
|---|---|---|---|---|
| **Autor/creador** | `data.creator?.name` | `data.creator?.lastname` | `data.creator?.profileImage` | Quién creó la entidad (Appreciations, Multimedia) |
| **Líder de equipo** | `leader?.name` | `leader?.lastname` | `leader?.profileImage` | Quién lidera el equipo (Teams) |
| **Responsable** | `owner?.name` | `owner?.lastname` | `owner?.profileImage` | Quién es responsable de la tarea/recurso |
| **Instructor/profesor** | `instructor?.name` | `instructor?.lastname` | `instructor?.profileImage` | Quién imparte el contenido |

```tsx
<CardAuthorV2
  firstName={data.uploadedBy?.name}    {/* Obligatorio: triggerea render */}
  lastName={data.uploadedBy?.lastname}
  avatarUrl={data.uploadedBy?.profileImage}
/>
```

**Props de `CardAuthorV2`:**

| Prop | Tipo | Requerido | Notas |
|---|---|---|---|
| `firstName` | `string \| null` | **Sí** | Si es falsy, no renderiza nada (componente opcional) |
| `lastName` | `string \| null` | No | Se omite si es falsy |
| `avatarUrl` | `string \| null` | No | URL de imagen; si no hay, renderiza fallback con iniciales |

**Tipografía (§6.12):**

| Elemento | Clase | Px | Peso | Color | Notas |
|---|---|---|---|---|---|
| Wrapper | `text-[10px]` | 10 | 400 | `text-slate-400 dark:text-zinc-500` | Toda la línea |
| Label ("Por") | sin cambios | 10 | 400 | hereda wrapper | Siempre "Por" |
| Nombre+apellido | `font-medium` | 10 | 500 | `text-slate-500 dark:text-zinc-400` | Resaltado |

**Avatar fallback:**
- Dimensiones: `18×18 px`
- Shape: `rounded-full`
- Fondo: `bg-slate-200/70 dark:bg-zinc-800`
- Iniciales: primer carácter de `firstName` + primer carácter de `lastName` (máx 2 chars)
- Tipografía: `text-[9px] font-semibold text-slate-500 dark:text-zinc-500`
- Opacidad imagen: `opacity-75` (ligero tint)

**Ejemplos visuales:**

```
/* Con imagen */
┌─ [Avatar] — Por Juan García

/* Sin imagen (fallback iniciales) */
┌─ [JG] — Por Juan García

/* firstName vacío */
(no renderiza — componente es 100% opcional)
```

**Reglas de la card:**

1. **Contenido sólido, controles líquidos** — el `Card` es material sólido; solo botones/menús son vidrio.
2. **Menú contextual arriba a la derecha** — acciones secundarias (editar, clonar, eliminar) van en `LiquidPillDropdown`, no como botones sueltos en el hero.
3. **Meta pills informativas** — badges de tipo/conteo con `LiquidPill` `size="xs"` sin `onClick` (decorativas).
4. **CTAs primarios abajo** — acciones de navegación frecuente (Distribuir, Preguntas) van en el **footer** de la card, no en el header de página.
5. **Confirmación destructiva** — eliminar abre `ModalAlert` (legacy) o `Dialog`/`Modal` v2; nunca inline sin confirmar.
6. **Lógica de permisos** — filtrar items del dropdown según `isCreatedBy` / `isAdminUser` antes de renderizar.

### 6.7 CTAs dentro de la card

Hay **dos zonas de acción** con roles distintos:

| Zona | Componente | Rol |
|---|---|---|
| **Hero (secundarias)** | `LiquidPillDropdown` | Menú overflow: editar, clonar, copiar ID, eliminar |
| **Footer (primarias)** | `LiquidPill as="button"` | Navegación o acción principal por card |

#### Patrón footer CTA — navegación/acción desde card

Los CTAs primarios del footer de cards usan **`LiquidPill as="button"` con `size="card-cta"`**, igual que en `/app/maintainers/appreciation`. Mantener el look líquido tintado estándar; no usar variantes sólidas/gradientes para estos CTAs salvo excepción documentada del dominio.

Dos CTAs en grid 50/50 con `LiquidPill`:

```tsx
<div className="mt-3 border-t border-slate-200/70 p-3 dark:border-zinc-800/80">
  <div className="grid grid-cols-2 gap-2">
    {/* CTA 1 — Primaria (sky) */}
    <LiquidPill
      as="button"
      type="button"
      variant="sky"
      appearance="tinted"
      shadow="neutral"
      size="card-cta"
      icon={<Send className="h-3.5 w-3.5" />}
      text={t("Distribuir")}
      aria-label={t("Distribuir")}
      onClick={() => push(`${asPath}/distributions/${id}`)}
    />
    {/* CTA 2 — Secundaria (indigo) */}
    <LiquidPill
      as="button"
      type="button"
      variant="indigo"
      appearance="tinted"
      shadow="neutral"
      size="card-cta"
      icon={<ClipboardList className="h-3.5 w-3.5" />}
      text={t("Preguntas")}
      aria-label={t("Preguntas")}
      onClick={() => push(`${asPath}/${id}`)}
    />
  </div>
</div>
```

**Props de `LiquidPill` en footer CTA:**

| Prop | Valor | Notas |
|---|---|---|
| `as` | `"button"` | Obligatorio para CTAs clickeables |
| `type` | `"button"` | Evita submits accidentales dentro de cards/form wrappers |
| `variant` | semántico | `indigo` primario · `sky` navegación · `emerald` positivo/enviar · `violet` plantilla · `rose` destructivo si aplica |
| `appearance` | `"tinted"` | Activa color de variante |
| `shadow` | `"neutral"` | Mantiene el CTA integrado al footer, sin elevación excesiva |
| `size` | `"card-cta"` | Footer CTA: `h-9 w-full justify-center px-2 text-[11px] font-semibold` |
| `icon` | `h-3.5 w-3.5` Lucide | Tamaño fijo |
| `text` | label corto | 1–3 palabras |
| Grid | `grid-cols-2 gap-2` | 2 CTAs; con 1 solo CTA usar `grid-cols-1` |
| Wrapper | `mt-3 border-t border-slate-200/70 p-3 dark:border-zinc-800/80` | Delimita footer del contenido |

**Variantes:** usa las mismas variantes semánticas del sistema (`emerald`, `sky`, `indigo`, `violet`, `rose`, `gold`, `slate`, etc.).

**Cuándo usarlo:**
- CTAs primarios de footer de card (`Enviar`, `Editar`, `Canjear`, `Postular`, `Distribuir`, `Ver detalle`, `Preguntas`).
- Uno o dos CTAs visibles de card, siempre dentro del footer.
- Ocultar el CTA si el usuario no tiene permiso o la acción no está disponible; no renderizar botones disabled salvo que haya una razón UX explícita.

**Cuándo NO usarlo:**
- Acciones secundarias/locales: usar `CircleActionButton` o `LiquidPillDropdown`.
- Toolbars/header/FABs: usar familia `Liquid*` correspondiente.
- Formularios/modales: usar `Button` sólido o `ModalButtons`.
- Badges/meta pills: usar `LiquidPill xs` sin `onClick`.
- Filtros/tabs/toolbar: usar `LiquidSelectList` (un valor visible), `LiquidPillDropdown` (acciones / trigger solo ícono), `LiquidPillGroup`, `MultiSelectFilterV2` o `SwitcherV2` según §4.1.

#### Patrón alternativo — `CircleActionButton` (acciones locales)

Para acciones de editar/eliminar con reveal de label al hover:

```tsx
<div className="grid grid-cols-2 gap-2 border-t pt-3">
  <CircleActionButton variant="indigo" size="sm" expandable anchor="left" label={t("Editar")} onClick={handleEdit}>
    <Pencil className="h-4 w-4" />
  </CircleActionButton>
  <CircleActionButton variant="rose" size="sm" expandable anchor="left" label={t("Eliminar")} onClick={openConfirm}>
    <Trash2 className="h-4 w-4" />
  </CircleActionButton>
</div>
```

**Cuándo usar cada patrón:**

| Patrón | Usar cuando |
|---|---|
| `LiquidPill as="button" size="card-cta"` en footer | CTAs de **navegación** o acción principal con label siempre visible (Enviar, Editar, Distribuir, Ver detalle, Preguntas) |
| `CircleActionButton expandable` | Acciones **locales** con icono dominante y label en hover (Editar, Eliminar, Copiar ID) |
| `LiquidPillDropdown` en hero | **Menú overflow** con 3+ acciones secundarias |

#### Menú contextual — `LiquidPillDropdown` (acciones secundarias en hero)

**Ubicación:** `absolute right-3 top-3` en el hero de la card.

**Regla:** El dropdown es el **ÚNICO botón del hero**. Todas las acciones secundarias (editar, clonar, copiar ID, eliminar) van aquí.

**Estructura de items:**

| Acción | Icono | Variante | Condicionalidad |
|---|---|---|---|
| Editar | `Pencil` | `indigo` | ✅ Siempre (creador) |
| Distribuir / Enviar | `Send` | `sky` | ✅ Siempre (creador) |
| Clonar | `Copy` | `emerald` | ✅ Siempre |
| Copiar ID | `KeySquare` | `slate` | ✅ Siempre |
| Eliminar | `Trash2` | `rose` | ⚠️ Solo si `isCreatedBy \| isAdminUser` |

**Ejemplo real — Card de Evaluación (Appreciation):**

```tsx
const actionItems = useMemo<LiquidPillDropdownItem[]>(() => {
  const items: LiquidPillDropdownItem[] = [
    {
      value: "edit",
      label: t("Editar"),
      icon: Pencil,
      variant: "indigo"
    },
    {
      value: "distribute",
      label: t("Distribuir"),
      icon: Send,
      variant: "sky"
    },
    {
      value: "clone",
      label: t("Clonar"),
      icon: Copy,
      variant: "emerald"
    },
    {
      value: "copy-id",
      label: t("Copiar ID"),
      icon: KeySquare,
      variant: "slate"
    }
  ];

  // ⚠️ Acción destructiva — condicional por permisos
  if (isCreatedBy || isAdminUser) {
    items.push({
      value: "delete",
      label: t("Eliminar"),
      icon: Trash2,
      variant: "rose"
    });
  }

  return items;
}, [isAdminUser, isCreatedBy, t]);

const handleActionSelect = (value: string) => {
  if (value === "edit") handleEditAppreciation();
  if (value === "distribute") handleDistribute();
  if (value === "clone") handleCloneAppreciation();
  if (value === "copy-id") handleCopy(appreciationId ?? "");
  if (value === "delete") setDeleteOpen(true); // ← Abre Dialog de confirmación
};

// ✅ En el hero de la card
<div className="absolute right-3 top-3">
  <LiquidPillDropdown
    items={actionItems}
    onSelect={handleActionSelect}
    icon={<MoreHorizontal className="h-4 w-4" />}
    variant="slate"
    size="sm"
    collapsedShape="circle"
    reactive
    aria-label={t("Opciones")}
  />
</div>
```

**Props obligatorios:**

| Prop | Valor | Por qué |
|---|---|---|
| `items` | Array de `LiquidPillDropdownItem[]` | Acciones disponibles |
| `onSelect` | `(value: string) => void` | Manejar selección |
| `icon` | `<MoreHorizontal className="h-4 w-4" />` | Icono estándar §6.11.8 |
| `variant` | `"slate"` | Neutral, no destaca excesivamente |
| `size` | `"sm"` | Compacto en hero |
| `collapsedShape` | `"circle"` | Forma redondeada |
| `reactive` | `true` | Material reactivo, vidrio con backdrop-filter |
| `aria-label` | `t("Opciones")` | Accesibilidad |

**Estructura de `LiquidPillDropdownItem`:**

```tsx
interface LiquidPillDropdownItem {
  value: string;           // ID único para onSelect
  label: string;           // Texto visible en menú
  icon: LucideIcon;        // Icono Lucide (solo la función, no JSX)
  variant: CircleActionVariant; // Color semántico (§3.1)
}
```
```

### 6.8 Capas de una página de listado

Mapa **genérico** de qué componente v2 ocupa cada zona. Aplica a cualquier dominio rediseñado; la convención de nombres de archivos está en §6.4.

#### Capa orquestador (`*PageV2`)

| Zona (slot §6.11) | Componente v2 | Notas |
|---|---|---|
| ② Header | `PageHeaderV2` inline | `leadingIcon`, `badges` (2–3× `LiquidPill` sm), `particleIcon`, `titleSuffix` ayuda opcional |
| ③ Toolbar | `PageToolbarV2` | `Input size="sm"` · chip búsqueda activa (`LiquidPill` emerald) · filtros en `filters` o `leftSlot` |
| Filtro principal | `LiquidPillDropdown` | `Filter`, `collapsedShape="circle"`, variante según filtro activo |
| Filtros avanzados | `LiquidPill` circle + `Card` | Toggle + panel con pickers v2 (`TagPickerV2`, `SelectPickerV2`, etc.) |
| ④ Loading | `*LoadingStateV2` → `PageLoadingStateV2` | Solo carga inicial sin datos en pantalla |
| ④ Empty | `PageEmptyStateV2` | `empty` vs `noResult` según haya filtros activos |
| ⑤ Meta bar | `PageMetaBarV2` | Resumen + info de página si hay paginación |
| ⑥ Contenido grid | `*CardV2` × N | Un componente por entidad del dominio |
| ⑥ Contenido tabla | `MaintainerDataTableV2` | Columnas + `LiquidPillDropdown` en acciones |
| ⑦ Paginación | `PagePaginationFooterV2` | Si paginación server-side |
| ⑨ Overlays | `Modal` / `Dialog` v2 | Crear, editar, preview, confirmación destructiva |
| ⑩ FAB | `MaintainerFabStackV2` | Crear (+ quickie opcional) — solo maintainer CRUD |

#### Capa card (`*CardV2`)

| Zona | Componente v2 | Rol |
|---|---|---|
| Shell | `Card` | `full`, `padding="none"`, `shadow="subtle"`, `fullHeight`, `entranceAnimation` |
| Hero | imagen / gradiente + overlay | `h-28`; controles en `absolute right-3 top-3` |
| Menú contextual | `LiquidPillDropdown` | `MoreHorizontal`, sm, circle, reactive |
| Meta | `LiquidPill` xs tinted | Tipo, contadores — **sin onClick** |
| Footer CTAs | `LiquidPill as="button"` xs | 1–2 acciones primarias de navegación |

#### Capa modal formulario (`*CreateModalContentV2`, `*EditModalContentV2`)

| Campo | Componente v2 | Tipografía |
|---|---|---|
| Texto corto | `Input` sm, variante de dominio | label **13px** · hint **9px** |
| Texto largo | `Textarea` sm | label **13px** · hint **9px** |
| Archivos | `ImageUploaderV2` sm | label **13px** |
| Tags / selects | Pickers v2; `menuStyle` con z-index > `MODAL` | label **13px** |
| Toggles | `SwitcherV2` dense | label **13px** · description **9px** |
| Footer | `ModalButtons` compact | hereda `Button` sm |

### 6.9 Implementar un dominio rediseñado

**Paso 1 — Estructura de archivos**

```
components/ui/v2/<dominio>/
  <Dominio>MaintainerPageV2.tsx
  <Dominio>CardV2.tsx            ← Card shell + hero + body + footer CTAs
  <Dominio>CreateModalContentV2.tsx
  <Dominio>LoadingStateV2.tsx
  index.ts
```

**Paso 2 — Página (`*MaintainerPageV2`)**

1. Contenedor `max-w-7xl space-y-6` (vía `MaintainerGridPageV2` / `MaintainerListPageV2`).
2. Espaciado detallado: **§6.10** (tokens, mapa vertical, FAB, modal).
3. Header **inline** en prop `header` (`PageHeaderV2Config`): `leadingIcon`, `title`, `description`, `badges`, `particleIcon`, `titleSuffix` (ayuda).
4. Toolbar: `PageToolbarV2` (`Input size="sm"` + `LiquidPillDropdown` filtros) + acciones secundarias en `filters`.
5. Grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`.
6. Estados: loading inicial → empty → grid + paginación.
7. FAB crear → `MaintainerFabStackV2` + `Modal` v2 con `*CreateModalContentV2`.

**Paso 3 — Header (solo `PageHeaderV2`, sin wrapper de dominio)**

Componer directamente en la prop `header` del composite:
- `leadingIcon` con icono Lucide `h-10 w-10`. El color visual lo resuelve `PageHeaderV2` desde la variante del **item principal del sidebar**; no usar el color del subitem como fuente de verdad.
- `badges`: 2–3 `LiquidPill` sm tinted (total registros, filtro activo, páginas), siempre con iconos Lucide `h-4 w-4`.
- `particleIcon`: icono Lucide del módulo (partículas activas por defecto). Las partículas heredan el color del **item principal del sidebar**.
- `titleSuffix`: botón ayuda con `LiquidPill` circle xxs si hay guía — **no** CTAs de crear/exportar.

**Paso 4 — Card (`*CardV2`)**

Seguir anatomía §6.6:
- `Card` shell con props estándar.
- Hero con imagen o gradiente del color de dominio (`domain-colors.ts` / variante tinted).
- Dropdown contextual con items filtrados por permisos.
- Meta pills xs con icono + contador.
- Footer con 1–2 `LiquidPill as="button"` para rutas principales.

**Paso 5 — Modal crear (`*CreateModalContentV2`)**

- Thin wrapper sobre formulario de dominio.
- Pasar `onClose`, `hideHeader={true}`, `compact` al form.
- Formulario usa `Input`/`Textarea` sm, `ModalButtons` compact.
- Pickers rsuite: `menuStyle={{ zIndex: Z_INDEX.MODAL + 100 }}`.

**Paso 6 — Ruta thin**

```tsx
// pages/app/maintainers/<dominio>/index.tsx
"use client";
import { FooMaintainerPageV2 } from "components/ui/v2/foo";
export default function FooPage() {
  return <FooMaintainerPageV2 />;
}
```

**Checklist de dominio rediseñado:**

- [ ] Header con 2–3 badges de contexto (`LiquidPill` sm).
- [ ] Búsqueda `Input sm` + filtro según §6.11.5 y tipo de ruta §6.13.
- [ ] Grid responsive 1/2/3 columnas o tabla v2.
- [ ] Card con hero + dropdown + footer CTAs (si aplica grid).
- [ ] FAB + Modal v2 para crear en maintainer CRUD (no drawer).
- [ ] Loading no oculta header ni datos ya cargados.
- [ ] Paginación con `PagePaginationFooterV2` si aplica.
- [ ] Exports en `index.ts` del dominio.
- [ ] Definition of Done §2.7.4 cumplida.

### 6.10 Espaciado entre componentes

El espaciado v2 usa **escala Tailwind estándar** (múltiplos de 4 px). No inventar valores arbitrarios salvo alturas mínimas de estado (`min-h-[360px]`, etc.).

#### Escala base usada en páginas maintainer

| Token | px | Uso principal |
|---|---|---|
| `gap-2` / `space-x-2` | 8 | Icono + texto inline; pills adyacentes; chips toolbar |
| `gap-3` | 12 | Stack FAB secundario; filas toolbar en mobile |
| `gap-4` | 16 | **Grid de cards**; icono leading + bloque título en header |
| `gap-5` | 20 | Separación fila título ↔ badges en header |
| `space-y-6` | 24 | **Ritmo vertical entre secciones de página** (header → toolbar → contenido → paginación) |
| `p-3` / `py-3` | 12 | Padding compacto (meta bar, card body, modal body mobile) |
| `p-4` / `px-4` | 16 | Modal header/body base |
| `p-6` / `md:p-6` | 24 | Padding exterior de página (`AppPageLayoutV2`) |
| `pt-20` | 80 | Offset bajo navbar fijo en header maintainer |
| `mb-3` / `mb-4` / `mt-5` | 12 / 16 / 20 | Separaciones internas en empty, loading, paginación |

#### Mapa vertical — página maintainer grid (listado CRUD)

```
AppPageLayoutV2                    p-3 md:p-6          ← margen respecto al scroll (#app-main-scroll)
└── contenedor                     max-w-7xl space-y-6
    │
    ├── [Guía onboarding]          (opcional, sin margen extra — ya cuenta en space-y-6)
    │
    ├── PageHeaderV2               pt-20 pb-3 md:pb-4 px-1 md:px-0
    │   ├── fila título            gap-5 (columnas) · gap-4 (icono+título) · gap-2/3 (título+suffix)
    │   ├── descripción            mt-2 bajo el título
    │   └── badges                 mt-5 · gap-2 entre LiquidPill sm
    │
    ├── PageToolbarV2              gap-3 (filas mobile) · gap-2 (controles inline)
    │   ├── chip búsqueda activa   gap-2 en grupo izquierdo
    │   └── search + filtro        gap-2 · Input md:w-80
    │
    ├── [Estado loading]           min-h-[260px] py-10 · mb-4 loader · mb-2 título
    ├── [Estado empty]             min-h-[360px] · mb-4 icono · mt-2 descripción · mt-5 acciones · gap-2
    │
    ├── PageMetaBarV2              py-3 · gap-2 (filas) · gap-2 icono+texto
    │
    ├── Grid *CardV2               gap-4 · grid-cols-1 sm:2 lg:3
    │
    └── PagePaginationFooterV2     pt-4 (border-t) · mb-3 fila info · gap-2
```

**Regla de oro:** los bloques hermanos del contenedor (`header`, `toolbar`, `metaBar`, `grid`, `paginationFooter`) **no llevan `mt-*` propio** — el espaciado lo resuelve `space-y-6` del wrapper `max-w-7xl`.

#### Por componente

##### `AppPageLayoutV2` (exterior)

| Prop / clase | Valor | Estándar maintainer |
|---|---|---|
| `outerPadding` default | `p-3 md:p-6` | Sí (`withFrame={false}`) |
| Frame interno (Home) | `p-6` en content | No aplica en maintainer |

##### `PageHeaderV2`

| Zona | Clases | Notas |
|---|---|---|
| Offset navbar | `paddingTopClassName="pt-20"` | Default en `PageHeaderV2` y composites |
| Partículas | `showParticles={true}` (default) + `particleIcon` | Obligatorio en rutas sidebar; color automático desde la variante del item principal del sidebar |
| Padding inferior | `pb-3 md:pb-4` | Separación visual antes de toolbar |
| Padding horizontal | `px-1 md:px-0` | Alineación con contenido en mobile |
| Icono leading | `gap-4` respecto al bloque título | Icono `h-10 w-10`; color automático desde la variante del item principal del sidebar |
| Título + suffix ayuda | `gap-2 md:gap-3` | `LiquidPill` circle xxs en suffix |
| Descripción | `mt-2` | `max-w-2xl`, `leading-6` |
| Fila badges | `mt-5` + `gap-2` | 2–3 `LiquidPill` `size="sm"` tinted |

##### `PageToolbarV2`

| Zona | Clases | Notas |
|---|---|---|
| Layout filas | `flex-col gap-3 md:flex-row md:items-center md:justify-between` | Mobile: búsqueda debajo |
| Grupo izquierdo | `gap-2` | Chip búsqueda activa o `leftSlot` |
| Grupo derecho | `gap-2` | `Input size="sm"` + `LiquidPillDropdown` |
| Ancho búsqueda | `w-full md:w-80` | Default toolbar |

##### `PageMetaBarV2`

| Zona | Clases | Notas |
|---|---|---|
| Contenedor | `py-3` + `border-y` | Separador sólido entre toolbar y grid |
| Filas responsive | `gap-2 sm:flex-row sm:items-center sm:justify-between` | |
| Icono + resumen | `gap-2` | Icono `h-4 w-4` |
| Info página | `gap-2` | Icono Info `h-3.5 w-3.5`, texto `text-xs` |

##### Grid de contenido

| Contexto | Clases | Estándar |
|---|---|---|
| Grid maintainer CRUD | `grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3` | 6–12 ítems/página típico |
| Grid pantallas anchas | `gap-4 sm:grid-cols-2 2xl:grid-cols-3` | Variante opcional |

El **gap entre cards (`gap-4` = 16 px)** es independiente del **ritmo de sección (`space-y-6` = 24 px)**.

##### `PagePaginationFooterV2`

| Zona | Clases | Notas |
|---|---|---|
| Separador superior | `border-t pt-4` | Solo si `totalPages > 1` |
| Fila rango + pill | `mb-3` + `gap-2 sm:flex-row sm:justify-between` | |
| Paginador | `Pagination` centrado, `siblingCount={2}` | Sin margen extra inferior |

##### Estados (`PageLoadingStateV2` / `PageEmptyStateV2`)

| Estado | Clases clave | Comportamiento |
|---|---|---|
| Loading | `min-h-[260px] py-10` · loader `mb-4` · título `mb-2` | No colapsa header |
| Empty | `min-h-[360px]` · icono `mb-4` (h-16 w-16) · título · `mt-2` desc · `mt-5` acciones `gap-2` | Copy distinto si `noResult` |

##### FAB flotante (`MaintainerFabStackV2`)

| Constante | Valor | Cálculo |
|---|---|---|
| `MAINTAINER_FAB_OFFSET` | 24 px | `offsetX` y `offsetY` del botón crear |
| `MAINTAINER_FAB_SIZE` | 56 px | `LIQUID_PILL_CIRCLE_DIAMETER.xl` |
| `MAINTAINER_FAB_STACK_GAP` | 12 px | Entre FAB crear y FAB quickie |
| Quickie `offsetY` | 92 px | `24 + 56 + 12` |

Los FAB **no participan** en `space-y-6` — se posicionan fixed fuera del flujo scroll.

##### Modal de formulario (crear / editar)

| Zona | Clases | Notas |
|---|---|---|
| Panel | `max-h-[min(88vh,680px)]` | Evita overflow en viewports bajos |
| Header modal | `px-4 py-2.5 sm:px-5 sm:py-3` | Más compacto que página |
| Body modal | `px-4 py-3 sm:px-5 sm:py-3.5` | Formulario con `ModalButtons` compact |

##### Modal de listado (personas / colección filtrable — variante C)

| Zona | Clases | Notas |
|---|---|---|
| Panel | `flex max-h-[min(88vh,780px)] flex-col` | Columna flex para scroll en body |
| Header modal | `px-4 py-2.5 sm:px-5 sm:py-3` | Tabs opcionales a la derecha (`mr-8` vs. cierre) |
| Body modal | gradiente aurora → blanco + `py-3 sm:py-3.5` | Ver §5.5; activar `bodyScrollFade` |
| Lista | contenedor `gap-1` · fila `py-1.5 gap-2` | Avatar 32px; fila **2 líneas** (nombre `13px` + email `9px`) |

##### Modal de ranking Explore (variante D)

| Zona | Clases | Notas |
|---|---|---|
| Panel | `max-w-2xl` + `max-h-[min(88vh,780px)] flex flex-col` | Sombra en raíz del panel — ver §5.5 |
| Header | eyebrow + título con ícono inline 16px + `description` conteo | Sin tabs |
| Body | gradiente aurora → blanco · `py-3 sm:py-3.5` | scroll interno `min-h-0 flex-1 overflow-y-auto` |
| Lista | contenedor `gap-1` · fila `py-1.5 gap-2` | badge izquierda → avatar 32px → nombre `13px` + `{email} · {rol}` `9px` |

##### Card en grid (resumen — detalle §6.6)

| Zona | Espaciado |
|---|---|
| Hero controles | `absolute right-3 top-3` |
| Cuerpo card | `p-3` |
| Meta pills | `gap-2` implícito en flex wrap |
| Footer CTAs | `mt-3 border-t pt-2.5` · `grid grid-cols-2 gap-2` |

#### Qué no mezclar

| Evitar | Usar en su lugar |
|---|---|
| `mt-6` manual entre header y toolbar | `space-y-6` en contenedor |
| `gap-6` en grid de cards | `gap-4` (estándar maintainer grid) |
| `pt-4` en header maintainer con navbar | `pt-20` |
| Padding extra en `PageMetaBarV2` | Solo `py-3` + bordes |
| `rightAction` / botones en header | Toolbar (`filters`) o `MaintainerFabStackV2` |
| Wrapper `*PageHeaderV2` por dominio | `PageHeaderV2` inline en prop `header` |
| FAB con margen inline | `MaintainerFabStackV2` + offsets constantes |

#### Checklist de espaciado

- [ ] Contenedor `max-w-7xl space-y-6` dentro de `AppPageLayoutV2`.
- [ ] Header `pt-20`, `particleIcon`, badges `mt-5 gap-2` — sin CTAs en header.
- [ ] Toolbar `PageToolbarV2` (gap-3 / gap-2).
- [ ] Meta bar `py-3` con border-y antes del grid.
- [ ] Grid `gap-4` responsive 1/2/3 columnas.
- [ ] Paginación `pt-4` + `mb-3` en fila info.
- [ ] FAB vía `MaintainerFabStackV2` (24 px offset, 12 px stack gap).
- [ ] Modal crear con padding compact documentado arriba.

### 6.11 Layout obligatorio — páginas del sidebar

> **Regla madre:** toda página autenticada del sidebar con `PageHeaderV2` monta el **mismo árbol de componentes y el mismo orden de slots** (§6.11.1). No reordenar capas, no omitir badges del header, no poner CTAs en el header.

Composite de layout: `MaintainerGridPageV2` (grid de cards o widget) o `MaintainerListPageV2` (tabla/lista con toolbar integrado).

#### 6.11.1 Árbol de layout — orden fijo de componentes

```
ManagerProLayout                         ← shell global (NO modificar desde páginas)
└── #app-main-scroll
    └── pages/app/<dominio>/index.tsx    ← thin route: solo exporta *PageV2
        └── *MaintainerPageV2            ← orquestador de dominio (data + estados)
            └── MaintainerGridPageV2     ← grid de cards o widget
                │   o MaintainerListPageV2  ← tabla/lista con toolbar+meta+paginación integrados
                │
                └── AppPageLayoutV2 (withFrame={false})
                    └── div.max-w-7xl.space-y-6   ← contenedor único de la página
                        │
                        ├── ① beforeContent          [opcional] guía onboarding
                        ├── ② PageHeaderV2           [OBLIGATORIO] vía prop `header`
                        ├── ③ toolbar                [OBLIGATORIO en CRUD] PageToolbarV2 o custom
                        ├── ④ cuerpo (uno de):
                        │      ├── PageLoadingStateV2     carga inicial sin datos
                        │      ├── PageEmptyStateV2       vacío / noResult
                        │      └── [con datos]
                        │            ├── ⑤ PageMetaBarV2      [OBLIGATORIO si paginado]
                        │            ├── ⑥ contenido            grid | MaintainerDataTableV2
                        │            └── ⑦ PagePaginationFooterV2 [si totalPages > 1]
                        │
                        ├── ⑧ helpTooltips           [opcional]
                        │
                        ├── ⑨ overlays               [fuera del scroll] Modal / Dialog
                        └── ⑩ fab                    [fuera del scroll] MaintainerFabStackV2
```

**Slots que NUNCA van dentro del contenedor scrollable:** `overlays`, `fab`.

**Slots que NUNCA van en el header:** botones crear, exportar, filtros de listado (van en ③ toolbar o ⑩ fab).

#### 6.11.2 Qué composite usar

| Tipo de página | Composite | Contenido ⑥ | Meta ⑤ | Paginación ⑦ |
|---|---|---|---|---|
| **CRUD grid de cards** | `MaintainerGridPageV2` | `grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3` + `*CardV2` | `PageMetaBarV2` vía prop `metaBar` | `PagePaginationFooterV2` vía prop `paginationFooter` |
| **CRUD tabla densa** | `MaintainerListPageV2` o `MaintainerGridPageV2` | `MaintainerDataTableV2` | props `metaSummary` + `metaIcon` (integrado) | props `currentPage` / `totalPages` (integrado) |
| **Listado lectura (usuario)** | `MaintainerGridPageV2` | grid o lista + `*CardV2` | `PageMetaBarV2` (sin `pageInfo` si no hay paginación) | ❌ |
| **Widget / canvas embebido** | `MaintainerGridPageV2` | widget custom | ❌ omitir | ❌ omitir |
| **Detalle / editor** | `DetailPageLayoutV2` | formulario o tabs | ❌ | ❌ |
| **Config sin listado** | `MaintainerGridPageV2` | formulario embebido | ❌ | ❌ |

**Preferir `MaintainerListPageV2`** cuando el dominio es tabla o lista paginada estándar. **Preferir `MaintainerGridPageV2`** cuando el cuerpo es grid de cards o widget no tabular.

#### 6.11.3 Pills debajo del título — `PageHeaderV2.badges` (OBLIGATORIO)

Las **badges del header** son `LiquidPill` informativas que viven **dentro de `PageHeaderV2`**, debajo del título/descripción (`mt-5`, `gap-2`). **No** confundir con `PageMetaBarV2` (slot ⑤).

| Regla | Detalle |
|---|---|
| **Cuándo** | **Obligatorio** en toda ruta autenticada del sidebar con listado o dashboard de módulo. |
| **Cantidad** | **Siempre 2 o 3** pills. Nunca 0; nunca más de 3. |
| **Componente** | `LiquidPill` · `size="sm"` · `appearance="tinted"` · **sin `onClick`** (informativas). |
| **Color** | Usar la variante del **item principal del sidebar** de la ruta. Si la página está dentro de un dropdown, no usar el color del subitem. |
| **Icono** | Lucide `h-4 w-4` en cada pill. Obligatorio: ninguna pill de header sin icono. |
| **Número destacado** | Contador envuelto en `<span className="font-semibold text-current">`. |

**Semántica de las 3 slots (adaptar al dominio):**

| Slot | Variante | Icono | Contenido semántico |
|---|---|---|---|
| **1 — Total** | Variante del item principal del sidebar | icono del módulo | Conteo global del recurso |
| **2 — Estado / filtro** | Misma variante del item principal del sidebar | `Filter` o icono del filtro activo | Filtro activo, ámbito o estado contextual |
| **3 — Scope / paginación** | Misma variante del item principal del sidebar | `BarChart3`, `Grid3X3` o métrica del dominio | Páginas, cuadrantes, emitidos, vigentes, etc. |

El slot 3 **no tiene que ser “páginas”** — debe ser la métrica secundaria más útil del módulo. En rutas sin paginación, usar una métrica de ámbito (fechas, categorías, alcance).

**Regla de color:** las pills justo debajo del header no comunican estados semánticos por color; comunican pertenencia al módulo. Por eso las 2–3 pills usan la **misma variante del item principal del sidebar**. Ejemplo: si el item principal es `Eval de desempeño` y su variante es `rose`, todas las pills del header son `variant="rose"`, aunque sus textos sean “Activas”, “Completadas” o “Pendientes”.

```tsx
badges: (
  <>
    <LiquidPill variant="rose" appearance="tinted" size="sm"
      icon={<ModuleIcon className="h-4 w-4" />}
      text={<><span className="font-semibold text-current">{total}</span> {t("recursos")}</>}
    />
    <LiquidPill variant="rose" appearance="tinted" size="sm"
      icon={<Filter className="h-4 w-4" />} text={activeFilterLabel} />
    <LiquidPill variant="rose" appearance="tinted" size="sm"
      icon={<BarChart3 className="h-4 w-4" />}
      text={<><span className="font-semibold text-current">{scopeMetric}</span> {t("páginas")}</>}
    />
  </>
)
```

**`titleSuffix` (opcional):** un solo `LiquidPill` `shape="circle"` `size="xxs"` `variant="indigo"` con `CircleHelp h-3.5 w-3.5` — solo ayuda/guía, nunca CTAs.

#### 6.11.4 Meta bar bajo toolbar — `PageMetaBarV2` (slot ⑤)

Franja **entre toolbar y contenido**, separada con `border-y py-3`. Resume el listado paginado.

| Regla | Detalle |
|---|---|
| **Cuándo es OBLIGATORIO** | Cualquier listado que muestra datos al usuario (paginado server-side **o** carga completa en cliente). |
| **Cuándo omitir** | Widgets sin listado (canvas), detalle, config, formulario embebido. |
| **Componente** | `PageMetaBarV2` |
| **Icono** | Lucide del contexto de listado · `h-4 w-4` · `iconClassName="text-indigo-500"` |
| **Summary** | `text-sm font-medium` — `"Mostrando X de Y <recurso>"` |
| **Page info** | `text-xs` — `"Página N de M"` (columna derecha con icono `Info h-3.5 w-3.5`) |

```tsx
metaBar={
  <PageMetaBarV2
    icon={Grid3X3}
    summary={<>{t("Mostrando")} {visible} {t("de")} {total} {t("evaluaciones")}</>}
    pageInfo={<>{t("Página")} {page} {t("de")} {totalPages}</>}
  />
}
```

#### 6.11.5 Toolbar (slot ③) — controles permitidos

| Control | Componente | Cuándo | Props canónicas |
|---|---|---|---|
| Búsqueda | `Input` | Listados con filtro por texto | `size="sm"`, `variant="subtle"`, `leftIcon` Search `h-3.5 w-3.5`, ancho `w-64` |
| Chip búsqueda activa | `LiquidPill` | Cuando `searchValue.length > 0` | `as="button"`, `sm`, `emerald tinted`, icono Search `h-3 w-3`, texto `"${term}"` |
| Filtro principal | `LiquidPillDropdown` | 2–8 opciones de filtro | `size="md"`, `collapsedShape="circle"`, icono **`Filter`**, variante según filtro activo |
| Tabs de vista | `LiquidPillGroup` | Cambio de modo (no menú) | `size="md"`, items con variant por tab |
| Exportar / descargar | `LiquidPillExpandButton` | Acción secundaria toolbar | icono **`Download`**, `expandTo="left"`, `size="sm"` |
| Toggle filtros avanzados | `LiquidPill` circle | Panel expandible de filtros | `size="md"`, icono **`Filter`**, indigo si activo / slate idle |

**Prohibido en toolbar:** `Button` sólido grande, `rsuite` Dropdown, links sueltos sin componente v2.

#### 6.11.6 Qué botón usar y cuándo — matriz de decisión

| Intención del usuario | Componente | Material | Ubicación | Ejemplo real |
|---|---|---|---|---|
| **Crear** recurso principal | `MaintainerFabStackV2` → `LiquidFixedCircleButton` xl indigo | líquido fijo | slot ⑩ fab, esquina inferior derecha | Crear evaluación, crear certificado |
| **Quickie / acción rápida** | segundo FAB xl gold en stack | líquido fijo | encima del FAB crear (`offsetY=92`) | Evaluación rápida |
| **Navegar / acceso rápido desde card** | `LiquidPill as="button" size="xs"` tinted | líquido | **footer card, grid 2 cols** | "Distribuir" (sky) + "Preguntas" (indigo) en card Appreciation |
| **Menú overflow** (editar, clonar, copiar ID, borrar) | `LiquidPillDropdown sm circle` | líquido | **hero card `absolute right-3 top-3`** | Menú en Appreciation: Editar (indigo), Distribuir (sky), Clonar (emerald), Copiar ID (slate), Eliminar (rose) |
| **Guardar / confirmar** formulario | `Button variant="primary" sm/md` | sólido | footer modal → `ModalButtons` | Guardar en modal de Editar |
| **Cancelar** formulario | `Button variant="ghost/secondary" sm` | sólido | footer modal | Cancelar en modal |
| **Eliminar** (confirmación destructiva) | `Button variant="destructive" sm` | sólido | `Dialog` size sm | Confirmar eliminación en Dialog |
| **Cerrar modal** | `LiquidPill circle sm rose` (automático en `Modal`) | líquido | header modal (automático) | Botón ✕ en Modal |
| **Ayuda / guía** | `LiquidPill circle xxs indigo` | líquido | `titleSuffix` del header página | Icono ? en PageHeaderV2 |
| **Filtro / ordenar** | `LiquidPillDropdown` circle **solo ícono** | líquido | toolbar página o toolbar de modal (+ etiqueta externa si aplica) | `ArrowDownUp` / `Filter` en trigger; labels en menú |
| **Toggle on/off** | `SwitcherV2` | líquido en toggle | formularios, filtros modal | Switch en formulario editar |
| **Paginar** | `Pagination` → `LiquidPill circle sm` | líquido | `PagePaginationFooterV2` | Botones página numérica |
| **Métrica informativa** (celda, badge) | `LiquidPill xs tinted **sin onClick**` | líquido decorativo | celdas tabla, badges header, meta pills card | "Evaluación" + "Preguntas 5" en body de card Appreciation |
| **Zoom / controles canvas** | `LiquidPill circle md slate` | líquido | panel flotante (`VerticalControlsV2`) | Controles zoom en canvas |

**Regla madre:** CTAs de **formulario/modal** = `Button` sólido. CTAs de **toolbar/card/nav/paginación** = familia `Liquid*`. **Nunca** `Button` primario en header ni en footer de card de listado.

#### 6.11.7 Tabla — cuándo `MaintainerDataTableV2`

| Usar grid de cards (`*CardV2`) | Usar `MaintainerDataTableV2` |
|---|---|
| Entidades con imagen, descripción, 1–2 CTAs de navegación | Filas densas, muchas columnas, sort |
| `pageSize` 6–12, card `min-h-[360px]` | Paginación integrada en tabla opcional |
| Menú overflow en hero de card | Columna acciones fija derecha con `LiquidPillDropdown` |
| — | Métricas por fila como `LiquidPill xs` en celdas |

**Tabla canónica:**

```tsx
<MaintainerDataTableV2<RowType>
  data={rows}
  columns={columns}
  rowKey="id"
  sort={sort}
  onSortChange={handleSort}
  getRowActions={(row) => actionItems}
  emptyState={<PageEmptyStateV2 variant="empty" title={t("Sin datos")} />}
  pagination={{
    currentPage, totalPages, totalItems, pageSize,
    onPageChange, rangeLabel, perPageLabel,
  }}
/>
```

**Columnas de métricas:** `LiquidPill xs tinted shadow="neutral"` — **no clickeables**.

**Columna acciones:** `LiquidPillDropdown` · `size="sm"` · `collapsedShape="circle"` · icono **`MoreHorizontal h-4 w-4`** · `variant="slate"`.

#### 6.11.8 Dropdowns — iconos estándar por acción

**Regla del trigger:** `LiquidPillDropdown` cerrado = **solo ícono circular** (`collapsedShape="circle"`). El texto de la opción activa vive en el menú, no en el botón. Si la toolbar necesita contexto, usar etiqueta externa (`Ordenar por:`, `Estado:`, etc.) a la izquierda del trigger.

Usar **siempre** estos iconos Lucide en items de `LiquidPillDropdown` para coherencia cross-app:

| Acción | Icono | Variante item | Dónde |
|---|---|---|---|
| Filtrar (trigger cerrado) | `Filter` | indigo/emerald según activo | Toolbar |
| Menú overflow (trigger) | `MoreHorizontal` | slate | Card hero, fila tabla |
| Editar | `Pencil` | indigo | Item menú |
| Eliminar | `Trash2` | rose | Item menú (condicional permisos) |
| Clonar / duplicar | `Copy` | emerald | Item menú |
| Distribuir / enviar | `Send` | sky | Item menú o footer card |
| Copiar ID | `KeySquare` | slate | Item menú |
| Ver detalle | `Eye` | indigo | Item menú / tabla |
| Ordenar (trigger) | `ArrowDownUp` | slate | Toolbar modal |
| Todas (filtro) | `List` | indigo | Item filtro |
| Creadas por mí | `User` | emerald | Item filtro |
| Exportar (expand, no dropdown) | `Download` | slate | Toolbar |

**Props trigger menú contextual (card/tabla):**

```tsx
<LiquidPillDropdown
  items={actionItems}
  onSelect={handleActionSelect}
  icon={<MoreHorizontal className="h-4 w-4" />}
  variant="slate"
  size="sm"
  collapsedShape="circle"
  reactive
  aria-label={t("Opciones")}
/>
```

**Props trigger ordenar (toolbar / modal preview):**

```tsx
<div className="flex items-center gap-2">
  <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
    {t("Ordenar por")}:
  </span>
  <LiquidPillDropdown
    items={sortOptions}
    value={sortBy}
    onSelect={setSortBy}
    icon={<ArrowDownUp className="h-4 w-4" />}
    variant="slate"
    size="sm"
    collapsedShape="circle"
    menuZIndex={Z_INDEX.MODAL + 100}
    aria-label={t("Ordenar por")}
  />
</div>
```

**Props trigger filtro toolbar (estándar):**

```tsx
<LiquidPillDropdown
  items={filterItems}
  value={active}
  onSelect={setActive}
  icon={<Filter className="h-4 w-4" />}
  variant={active === "all" ? "indigo" : "emerald"}
  active
  size="md"
  collapsedShape="circle"
  aria-label={t("Filtrar evaluaciones")}
/>
```

#### 6.11.9 Plantilla mínima — orquestador CRUD grid

```tsx
export function FooMaintainerPageV2() {
  return (
    <MaintainerGridPageV2
      header={{
        leadingIcon: <FooIcon className="h-10 w-10 shrink-0 text-indigo-600 dark:text-indigo-300" />,
        title: t("Foo"),
        description: t("Descripción del módulo"),
        badges: (/* 3× LiquidPill sm — ver §6.11.3 */),
        particleIcon: FooIcon,
      }}
      toolbar={
        <PageToolbarV2
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder={t("Buscar…")}
          clearSearchLabel={t("Limpiar búsqueda")}
          filters={(/* LiquidPillDropdown Filter — §6.11.8 */)}
        />
      }
      loading={loading && !items.length}
      loadingState={<FooLoadingStateV2 title={t("Cargando…")} description="…" />}
      isEmpty={!loading && !items.length}
      emptyState={<PageEmptyStateV2 variant={search ? "noResult" : "empty"} … />}
      metaBar={<PageMetaBarV2 icon={Grid3X3} summary={…} pageInfo={…} />}
      paginationFooter={
        <PagePaginationFooterV2
          currentPage={page}
          totalPages={totalPages}
          totalItems={total}
          pageSize={9}
          onPageChange={setPage}
          rangeLabel={…}
          perPageLabel={`${t("Items por página")}: 9`}
        />
      }
      overlays={
        <Modal open={createOpen} onClose={…} title={t("Crear")} size="md" …>
          <FooCreateModalContentV2 onClose={…} />
        </Modal>
      }
      fab={
        <MaintainerFabStackV2
          createAriaLabel={t("Crear")}
          onCreate={() => setCreateOpen(true)}
          quickieVisible={isBubbleVisible}
          onQuickie={openQuickie}
        />
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => <FooCardV2 key={item.id} data={item} />)}
      </div>
    </MaintainerGridPageV2>
  );
}
```

#### 6.11.10 Checklist — paridad estructural

Complementa **Definition of Done §2.7.4**.

- [ ] Thin route → un solo `*PageV2` orquestador.
- [ ] Composite `MaintainerGridPageV2` o `MaintainerListPageV2` (nunca layout ad-hoc ni legacy embebido).
- [ ] Orden de slots ①→⑩ (§6.11.1).
- [ ] `PageHeaderV2` con `leadingIcon`, `particleIcon`, **2–3 badges sm** (§6.11.3).
- [ ] Sin CTAs en header.
- [ ] Toolbar según §6.11.5 y tipo de ruta §6.13.
- [ ] `PageMetaBarV2` en listados con datos (§6.11.4).
- [ ] Grid `gap-4` 1/2/3 + `*CardV2` **o** `MaintainerDataTableV2` (§6.11.7).
- [ ] `PagePaginationFooterV2` si paginación server-side.
- [ ] `MaintainerFabStackV2` para crear (maintainer CRUD).
- [ ] Modales en `overlays`.
- [ ] Iconos de dropdown §6.11.8.

### 6.12 Tipografía por zona

Escala tipográfica única del sistema — aplica en **todas** las páginas v2.

#### Modales y overlays — escala obligatoria

> **Regla:** todo `Modal` v2, `ExploreModal`, `Dialog` y `*ModalV2` usa **exclusivamente** esta escala en header y body. Detalle completo, prohibiciones y filas de personas: **§5.5 «Tipografía modal»**. No mezclar con tamaños de página (`text-sm`, `text-base`) dentro del body del modal.

| Token | Clases | px | Peso | Color |
|---|---|---|---|---|
| `modal-eyebrow` | `text-[9px] font-semibold uppercase tracking-[0.16em]` | 9 | 600 | `text-indigo-500/90` |
| `modal-title` | `text-[13px] sm:text-[15px] font-semibold leading-snug` | 13→15 | 600 | `text-slate-900 dark:text-zinc-50` |
| `modal-description` | `text-[11px] sm:text-xs` | 11→12 | 400 | `text-slate-500 dark:text-zinc-400` |
| `modal-body-primary` | `text-[13px] font-medium leading-snug` | 13 | 500 | `text-slate-900 dark:text-zinc-50` |
| `modal-body-secondary` | `text-[9px] leading-snug` | 9 | 400 | `text-slate-500 dark:text-zinc-400` |
| `modal-metric-pill` | `text-[10px] font-semibold` + ícono 12px | 10 | 600 | `text-slate-600` en pill |
| `modal-emoji-badge` | `text-[11px] leading-none` en `h-4 w-4` | 11 | 400 | sobre avatar |
| `modal-empty-title` | `text-[13px] font-semibold` | 13 | 600 | estados dentro del modal |
| `modal-empty-description` | `text-[9px] leading-snug` | 9 | 400 | estados dentro del modal |

**Aplica en:** formularios crear/editar, previews con listado, reacciones (variante A), rankings (variante B), celebraciones, certificados, vistas, asistentes, confirmaciones `Dialog`.

#### Páginas y resto del sistema

| Zona | Clases Tailwind | Tamaño efectivo | Peso | Color |
|---|---|---|---|---|
| **Título de página** (`PageHeaderV2`) | `text-2xl md:text-4xl font-semibold tracking-tight` | 24 px → 36 px | 600 | `text-slate-950 dark:text-white` |
| **Descripción de página** | `text-sm md:text-base leading-6` | 14 px → 16 px | 400 | `text-slate-600 dark:text-zinc-300` |
| **Badges header** (`LiquidPill sm`) | hereda pill | ~13 px | 500–600 (número en `font-semibold`) | variante tinted |
| **Toolbar labels** | `text-xs font-semibold` | 12 px | 600 | `text-slate-500 dark:text-zinc-400` |
| **Meta bar** | `text-sm font-medium` | 14 px | 500 | `text-slate-700 dark:text-zinc-200` |
| **Meta bar info secundaria** | `text-xs font-medium` | 12 px | 500 | `text-slate-500 dark:text-zinc-400` |
| **Título modal** | `modal-title` — ver tabla modales arriba | 13 px → 15 px | 600 | `text-slate-900 dark:text-zinc-50` |
| **Descripción modal** | `modal-description` | 11 px → 12 px | 400 | `text-slate-500 dark:text-zinc-400` |
| **Eyebrow modal** | `modal-eyebrow` | 9 px | 600 | `text-indigo-500/90` |
| **Nombre usuario (fila modal)** | `modal-body-primary` + `capitalize` | 13 px | 500 | `text-slate-900 dark:text-zinc-50` |
| **Email / secundario fila modal** | `modal-body-secondary` | 9 px | 400 | `text-slate-500 dark:text-zinc-400` |
| **Badge métrica ranking** | `modal-metric-pill` | 10 px | 600 | pill `bg-slate-100/80` |
| **Badge emoji fila modal** | `modal-emoji-badge` | 11 px | 400 | círculo sobre avatar |
| **Título card CRUD** | `text-base font-semibold leading-tight` | 16 px | 600 | `text-slate-950 dark:text-white` |
| **Cuerpo card CRUD** | `text-sm leading-6` | 14 px | 400 | `text-slate-600 dark:text-zinc-400` |
| **Meta card (autor, ID)** | `text-[10px]` | 10 px | 400–600 | `text-slate-400 dark:text-zinc-500` |
| **CTA footer card** | `text-[11px] font-semibold` | 11 px | 600 | hereda pill |
| **Celdas tabla** | texto plano / pills xs | 12–14 px | 400 | contexto |
| **Paginación rango** | `text-sm` | 14 px | 400 | `text-slate-600 dark:text-zinc-400` |
| **Números en pills paginación** | `text-xs font-medium` | 12 px | 500 | hereda pill |
| **Empty state título** | `text-lg font-semibold` | 18 px | 600 | `text-slate-950 dark:text-white` |
| **Empty state descripción** | `text-sm leading-6` | 14 px | 400 | `text-slate-600 dark:text-zinc-400` |
| **Loading state título** | `text-base font-semibold` | 16 px | 600 | `text-slate-950 dark:text-white` |
| **Actividad usuario (modal)** | `modal-body-secondary` | 9 px | 400 | `text-slate-500 dark:text-zinc-400` |
| **Zoom % (VerticalControlsV2)** | `text-[10px] font-medium` | 10 px | 500 | `text-slate-500 dark:text-zinc-300` |

**Iconografía Lucide:** leading icon del header `h-10 w-10` · badges `h-4 w-4` · toolbar/meta `h-3.5`–`h-4 w-4` · pills xs `h-3 w-3`.

### 6.13 Variantes de ruta — qué slots activar

Todas las rutas del sidebar comparten el **mismo shell** (`MaintainerGridPageV2` o `MaintainerListPageV2` → `AppPageLayoutV2` → `max-w-7xl space-y-6`). La diferencia está en **qué slots se activan** según el tipo de pantalla — no en otro design language.

| Slot / prop | CRUD grid paginado | CRUD tabla | Listado lectura (usuario) | Widget / canvas | Detalle / config |
|---|---|---|---|---|---|
| `header` + 2–3 badges | ✅ | ✅ | ✅ | ✅ | ✅ (sin badges de listado si no aplica) |
| `toolbar` | ✅ `PageToolbarV2` | ✅ integrado en `MaintainerListPageV2` | ✅ si hay búsqueda/filtro | ✅ tabs o filtros de canvas | ❌ |
| `metaBar` | ✅ resumen + `pageInfo` | ✅ | ✅ resumen; omitir `pageInfo` sin paginación | ❌ | ❌ |
| `paginationFooter` | ✅ server-side | ✅ | ❌ | ❌ | ❌ |
| `loadingState` / `emptyState` | ✅ composites dominio | ✅ | ✅ | inline o composites | según flujo |
| `overlays` | ✅ modales CRUD/preview | ✅ | ✅ preview opcional | ✅ modales de ítem | ✅ |
| `fab` | ✅ crear (+ quickie opcional) | ✅ | ❌ | ❌ | ❌ |

#### CRUD grid paginado (maintainer)

Orquestador con data fetching, filtros y paginación. Contenido en grid `gap-4` 1/2/3 + `*CardV2`.

| Zona | Detalle |
|---|---|
| Toolbar | `Input sm subtle` + `LiquidPillDropdown` Filter circle md · filtros avanzados opcionales (§6.11.5) |
| Meta bar | icono de listado · `"Mostrando X de Y"` + `"Página N de M"` |
| Grid | `pageSize` 6–12 típico · cards §6.6 |
| FAB | `MaintainerFabStackV2` → `Modal` crear |
| Modal formulario | `size="md"`, `panelClassName="max-h-[min(88vh,680px)]"` |

#### CRUD tabla (maintainer)

Preferir `MaintainerListPageV2` cuando el listado es denso. Acciones por fila: `LiquidPillDropdown` — no menús legacy.

#### Listado lectura (usuario, sin paginación)

Carga completa en una query o filtrado client-side. **Mismas reglas de header** (2–3 badges). Sin FAB. Card de ítem obligatoria (`*CardV2`), no filas ad-hoc.

| Regla | Detalle |
|---|---|
| Badge slot 3 | Métrica de ámbito (emitidos, vigentes, categorías) — no “páginas” |
| Toolbar | Opcional; si hay búsqueda, `PageToolbarV2` |
| Meta bar | `"Mostrando X de Y <recurso>"` sin `pageInfo` |
| CTA de ítem | `LiquidPill as="button"` en footer de card — no `Button` shadcn en listados |

#### Widget / canvas embebido

Header con 3 badges (métricas del widget). Toolbar = cambio de vista (`LiquidPillGroup`) o filtros locales. Sin meta bar ni paginación a nivel página.

| Subzona típica | Componentes |
|---|---|
| Filtros del canvas | `PageToolbarV2` + panel en `Card` + pickers v2 |
| Controles flotantes | `VerticalControlsV2` · `LiquidPill` circle md slate |
| Ítems interactivos | `LiquidPill` tinted → abre `Modal` preview |
| Tabla auxiliar | `MaintainerDataTableV2` + pills xs + `LiquidPillDropdown` |

#### Detalle / config

`DetailPageLayoutV2` o formulario embebido. Header sin badges de listado si no hay conteo. Sin toolbar de búsqueda salvo sub-listados.

> **Señales de rediseño incompleto:** §2.7.5. **Checklist estructural:** §6.11.10 + Definition of Done §2.7.4.

---

## 7. Patrones de composición por escenario

En todos los patrones: **estructura y contenido = sólido**; **acciones puntuales = líquido/glass**.

### 7.1 Página maintainer CRUD

```
AppPageLayoutV2 (withFrame=false)
└── MaintainerListPageV2 | MaintainerGridPageV2
    ├── PageHeaderV2 (header inline: title, description, badges, particleIcon)
    ├── PageToolbarV2 (search + filtros + export/descargar si aplica)
    ├── Grid de *CardV2
    ├── PageEmptyStateV2 | PageLoadingStateV2
    ├── PagePaginationFooterV2
    └── MaintainerFabStackV2 (crear) → abre Modal v2
```

### 7.2 Card maintainer con CTAs (ver §6.6–§6.7)

```
Card (full, padding=none, shadow=subtle, fullHeight)
└── article flex-col
    ├── Hero + LiquidPillDropdown (menú ⋯)
    ├── Body: LiquidPill xs (meta) + título + descripción
    └── Footer: grid 2 cols → LiquidPill as="button" (CTAs primarios)
```

Alternativa footer con acciones locales: `CircleActionButton expandable` (acciones con icono dominante + label en hover).

### 7.3 Formulario en modal

```
Modal (size="md")
├── Input / Textarea / ImageUploaderV2 / SwitcherV2 (size="sm")
├── Pickers rsuite con menuStyle z-index > MODAL
└── ModalButtons (compact en formularios densos)
```

### 7.4 Toolbar de filtros

```
<div> // composición, sin estilos
  <LiquidPillGroup items={statusTabs} />
  <LiquidPillDropdown icon={Filter} items={categoryOptions} />
  <LiquidPillExpandButton icon={Download} label="Exportar" expandTo="left" />
</div>
```

---

## 8. Cómo crear un componente v2 nuevo

### Checklist

- [ ] ¿Existe algo similar? Extiende antes de duplicar.
- [ ] ¿Es un **control interactivo** (click/hover/toggle)? Solo entonces considerar material líquido/glass.
- [ ] ¿Es contenido o formulario? Usar componentes sólidos (`Card`, `Input`, `Button`).
- [ ] Si es control líquido: compon sobre `LiquidPill` / `LiquidSurface`.
- [ ] Props semánticas (`variant`, `size`, `active`, `disabled`).
- [ ] `className?: never` y `style?: never` en props públicas.
- [ ] Z-index de `z-index.ts`.
- [ ] Animaciones de `motion.ts`.
- [ ] `"use client"` si usa hooks o interactividad.
- [ ] Export en `index.ts`.
- [ ] Entrada en este documento.

### Plantilla de composite líquido

```tsx
"use client";

import { LiquidPill } from "./liquid-pill";
import { Z_INDEX } from "./z-index";

export interface MiCompositeProps {
  variant?: CircleActionVariant;
  size?: LiquidPillSize;
  onClick?: () => void;
  disabled?: boolean;
  "aria-label": string;
  // className?: never;  ← bloquear estilos externos
}

export function MiComposite({ ... }: MiCompositeProps) {
  // 1. Estado local mínimo
  // 2. LiquidPill / LiquidSurface como superficie
  // 3. Posicionamiento dual si aplica (idle static, open elevated)
  // 4. Portal solo cuando abierto, si aplica
  return ( ... );
}
```

---

## 9. Anti-patrones — NO hacer

| Anti-patrón | Alternativa v2 |
|---|---|
| `rsuite` Dropdown/Button en pantallas nuevas | `LiquidPillDropdown`, `Button` |
| Botón circular custom con Tailwind | `LiquidPill shape="circle"` |
| FAB con `position:fixed` manual | `LiquidFixedCircleButton` |
| Modal rsuite / drawer legacy para crear/editar | `Modal` v2 |
| SideModal / panel lateral custom para formularios | `Modal` v2 |
| Header de página con `<h1>` + botones sueltos | `PageHeaderV2` (sin botones; acciones en FAB/toolbar) |
| Wrapper `*PageHeaderV2` por dominio | `PageHeaderV2` inline en prop `header` |
| `rightAction` en header | `MaintainerFabStackV2` (crear) + `filters` (secundarias) |
| Empty state inline con divs | `PageEmptyState` |
| Tres puntos con `<Dropdown>` legacy | `LiquidPillDropdown` + `MoreHorizontal` |
| Tabs con `<Tabs>` sin estilo v2 | `LiquidPillGroup` |
| **Card o sección de contenido envuelta en vidrio líquido** | `Card` sólido; vidrio solo en controles dentro |
| **Todo botón convertido a LiquidPill** | `Button` sólido para CTAs de formulario/modal |
| Estilos glass copiados en cada archivo | `LiquidPill` / `GlassBadge` — solo en controles |
| `z-index: 9999` | `Z_INDEX.*` |
| Página sin layout v2 | `AppPageLayoutV2` |

---

## 10. Mapa de rediseño — resumen operativo

Seguir el proceso completo **§2.7** (fases, inventario por capa, Definition of Done). Este apartado es un índice rápido:

| Fase §2.7 | Acciones clave |
|---|---|
| ① Auditoría funcional | Queries, mutaciones, filtros, permisos, navegación — **nada se pierde** |
| ② Tipo de ruta | Elegir slots activos según **§6.13** |
| ③ Orquestador | Thin route + `*PageV2` posee data y estados |
| ④ Shell | `MaintainerGridPageV2` o `MaintainerListPageV2` + slots ①–⑩ **§6.11.1** |
| ⑤ Dominio | `*CardV2`, `*ModalContentV2`, `*LoadingStateV2`, `*GuideDialogV2` |
| ⑥ Overlays / FAB | `Modal` v2 en `overlays`; crear en `MaintainerFabStackV2` si CRUD — ver **§5.5.1** |
| ⑦ Cierre | **§2.7.4** + **§6.11.10** — no dar por rediseñada una página que solo envuelve legacy |

**Sustituciones de primitivos** (cuando el layout ya está correcto): §9 anti-patrones · modales **§5.5.1** · controles §6.11.6 · formularios §6.8 capa modal · componentes nuevos §8.

**Regla:** si el paso ④ no está hecho, sustituir `rsuite` por `Input` v2 **no cuenta** como rediseño.

---

## 11. Referencia rápida de archivos

```
src/components/ui/v2/
├── liquid-surface.tsx          ← Material líquido (solo controles interactivos)
├── liquid-surface.module.css   ← CSS líquido (único lugar; no usar en contenido)
├── liquid-pill.tsx             ← Pill base
├── liquid-pill-dropdown.tsx
├── liquid-pill-expand-button.tsx
├── liquid-fixed-circle-button.tsx
├── liquid-pill-group.tsx
├── liquid-pill-group-vertical.tsx
├── circle-action-variants.ts   ← Paleta de 14 variantes
├── z-index.ts                  ← Escala de capas
├── motion.ts                   ← Curvas de animación
├── layout/
│   ├── AppPageLayoutV2.tsx
│   ├── DetailPageLayoutV2.tsx
│   └── FormPageLayoutV2.tsx
├── public/
│   ├── PublicPageLayoutV2.tsx
│   └── ErrorPageV2.tsx
├── domain-colors.ts            ← Mapa leadingIcon por dominio
├── maintainer/
│   ├── maintainer-list-page-v2.tsx
│   ├── maintainer-grid-page-v2.tsx
│   ├── maintainer-data-table-v2.tsx
│   └── MaintainerPageV2.tsx    ← legacy; migrar a composites
├── modal.tsx                   ← Overlay centrado (único estándar para formularios)
├── modal-buttons.tsx
├── image-uploader-v2.tsx
├── liquid-switch.tsx           ← track + thumb (LiquidSurface / LiquidPill)
├── switcher-v2.tsx             ← label + layout sobre LiquidSwitch
├── index.ts                    ← Exports públicos
├── composites/                 ← Piezas compuestas reutilizables
├── navbar/                     ← Sistema navbar
├── sidebar/                    ← Sistema sidebar
├── explore/                    ← Dominio Explore
├── home/                       ← Dominio Home
└── <dominio>/                  ← Un folder por módulo rediseñado (§5.11)
```


## 12. Gate de calidad v2 (CI)

Objetivo: `npm run v2-gate` con reglas en FAIL estricto y allowlists vacías.

| Área | Criterio de cierre |
|---|---|
| Tablas maintainer | `MaintainerDataTableV2` en orquestadores; tablas legacy = 0 en rutas rediseñadas |
| Primitivos prohibidos en `ui/v2/**` | `HeaderModal`, `ModalAndDrawerButtons`, `GroowLoader` = 0 |
| Páginas sidebar | Orquestador `*PageV2` + Definition of Done §2.7.4 |
| Modales / previews | Drawer y portal legacy → `Modal` v2 en slot `overlays` |
| Wrappers legacy | `MaintainerGridPageV2` + hijo monolítico → absorber en orquestador |
| Público / auth / home | Layouts v2 (`PublicPageLayoutV2`, `HomePageLayoutV2`, etc.) |
<!-- /iaterminal:notes -->
