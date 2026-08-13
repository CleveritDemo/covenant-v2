# Rework de la experiencia de Organizations

Fecha: 2026-08-12
Mockup aprobado: artifact `Organizations Rework`

## Problema

`OrganizationsModal.tsx` (2134 líneas) resuelve una relación maestro-detalle de tres niveles —org →
workspace → repos y personas— apilándola en una sola columna de ~630 px dentro de un modal `xl`.

1. **Cinco niveles de caja.** org → tab → acordeón de workspace → `orgs-form-zone` → `orgs-list` →
   acciones de ítem. Cada nivel dibuja borde y padding propios.
2. **Formularios permanentes.** `New organization`, `Add repo` y `Add member` ocupan espacio fijo
   para acciones ocasionales. `Add repo` se renderiza dos veces seguidas: título de la zona y label
   del campo.
3. **Lo destructivo domina.** `Leave organization` es un `Button variant="danger"` sólido en la
   cabecera del detalle, y cada repo repite un `Remove` del mismo rojo.
4. **Cuatro listas de personas.** `MembersSection` y `OrgAdminsSection` son tabs distintos;
   `assignees` y `admins` del workspace viven dentro del acordeón. Promover a alguien cruza dos
   pantallas.
5. **Filas sin señal.** Un workspace colapsado no dice cuántos repos ni cuántas personas tiene.
6. **Navegación de geometría variable.** A un member se le ocultan 2 de 4 tabs; la pantalla tiene
   silueta distinta según quién la abre.

## Diseño

### Shell

`TerminalModal size="xxl"` (`min(1100px, 98vw)` × `min(88%, 900px)`, la misma caja que Git y File
Explorer) con `bodyLayout="flush"`. El cuerpo es un grid de tres columnas de altura fija; **cada
columna scrollea por separado y el modal nunca scrollea entero**.

```
grid-template-columns: 212px 272px minmax(0, 1fr)
```

| Columna | Contenido |
|---|---|
| 1 · Rail | Lista de orgs (avatar-inicial + nombre + chip de rol si no es `member`), `+` que abre una fila de composición inline. Al pie: la cuenta con menú de Sign out. |
| 2 · Workspaces | Cabecera con el nombre de la org, botón de ajustes y `+`. Filas con `N repos · N people` y punto de "abierto en esta ventana". |
| 3 · Detalle | `WorkspaceDetailPanel` u `OrgSettingsPanel` según `detailView`. |

Las tres columnas se estrechan, nunca se ocultan: `176px 208px 1fr` bajo 900 px y `148px 176px 1fr`
bajo 720 px. La ventana admite hasta 600 px de ancho (`minWidth` en `electron/main.ts`), y esconder
la lista de workspaces dejaría al detalle sin forma de cambiar de workspace — habría que construir un
drill-in con su propia navegación de vuelta.

El bloque `@media` va **al final** de `OrganizationsModal.css`. `.orgs-col--mid` y `.orgs-col` tienen
la misma especificidad: con el bloque arriba, las reglas base lo pisan y la media query no aplica
nada. Verificado en la app a 1200 / 960 / 860 / 700 px de viewport CSS: tres columnas, sin desborde
del panel y sin scroll horizontal en ninguno.

### Columna 3 — WorkspaceDetailPanel

Reemplaza el acordeón. Header (nombre + `slug / workspace · N repos · N people` + Delete) y dos
secciones hermanas, sin anidar:

- **People** — una sola lista de chips que fusiona `assignees` y `admins`. El rol va como subtítulo
  del chip. Los dos siguen siendo campos distintos en la API (ver *Decisiones*); lo que se fusiona es
  la presentación. Un `Select` + `Add` al final de la lista añade como assignee o como admin según
  un `SegmentedControl` de dos valores, igual que hoy.
- **Repos** — lista con `repoFullName` y la carpeta como meta. `Add repo` es un botón que despliega
  la fila de URL + carpeta; colapsada por defecto.

### Columna 3 — OrgSettingsPanel

Reemplaza los tabs `Members`, `Admins` y `Contexts`. Se abre con el botón de ajustes de la columna 2
y se cierra con un botón de volver.

- **People** — una tabla: persona · rol · acción. El rol es un `Select` de `Admin` / `Member` que
  llama a `orgAdminAdd` / `orgAdminRemove`. `Owner` se muestra como texto, no es asignable.
  Debajo, un campo de login de GitHub + `Add` (el `MembersSection` actual).
  Si el backend responde 403, la sección muestra `membersAdminsOnly` en su lugar; **la entrada de
  navegación no desaparece**.
- **Global contexts** — `DefaultsSection` sin cambios de lógica.
- **Danger zone** — `Leave organization` como `Button variant="ghost"` con texto en `--danger`,
  deshabilitado para owners con el motivo escrito al lado. El rojo sólido queda solo en el
  `ConfirmTerminalModal`.

### Cmd+T — OrgWorkspaceTabPickerModal

El `<Select>` pasa a lista buscable: un `Input` de filtro, `Personal (local)` fijo arriba y los
workspaces agrupados por org. El filtro corre sobre `orgName`, `slug` y `name`. Enter confirma la
fila resaltada; ↑/↓ mueven el resalte.

## Decisiones resueltas

**Rol editable inline.** La API expone `memberAdd/Remove` y `orgAdminAdd/Remove`; no hay endpoint
para transferir la propiedad. El `Select` de rol ofrece solo `Admin` y `Member`; `Owner` se muestra
como texto plano y su fila no tiene acción de quitar.

**Assignees vs. workspace admins.** `canAccessOrgWorkspace` los trata igual para *acceso*, pero
`admins` además habilita gestionar el workspace. No se pueden colapsar en el modelo: se fusionan solo
en la presentación (una lista, el rol como subtítulo del chip) y siguen llamando a los cuatro
endpoints existentes.

**Popover.** No existe en el UI kit y no se crea uno. Crear org y crear workspace usan una fila de
composición inline que aparece al pulsar `+`; `Add repo` usa la fila existente, colapsada tras un
botón. Un componente de popover se justifica cuando haya un tercer consumidor.

## Lógica pura extraída

En `src/shared/`, con tests, siguiendo el patrón del repo:

- `orgPeople.ts`
  - `orgPeopleRows(members, orgAdmins)` → `{ login, avatarUrl?, role: 'owner'|'admin'|'member' }[]`,
    ordenado owner → admin → member y luego alfabético.
  - `workspacePeopleRows(assignees, admins)` → `{ login, role: 'admin'|'assignee' }[]`, sin
    duplicados; quien esté en ambos aparece una vez como `admin`.
- `orgWorkspaceCatalog.ts`
  - `matchesWorkspaceQuery(entry, query)` → filtro case-insensitive sobre `orgName`, `slug` y `name`.

## Alcance del diff

| Archivo | Cambio |
|---|---|
| `src/shared/orgPeople.ts` | nuevo |
| `src/shared/__tests__/orgPeople.test.ts` | nuevo |
| `src/shared/orgWorkspaceCatalog.ts` | `+ matchesWorkspaceQuery` |
| `src/renderer/components/WorkspaceDetailPanel.tsx` | nuevo — absorbe `WorkspacePeopleBlock` + `WorkspaceReposBlock` |
| `src/renderer/components/OrgSettingsPanel.tsx` | nuevo — absorbe `MembersSection` + `OrgAdminsSection` + `DefaultsSection` |
| `src/renderer/components/OrganizationsModal.tsx` | shell de 3 columnas; se van `OrgDetailPanel`, `OrgsRail`, `AuthBar`, `WorkspacesSection` |
| `src/renderer/components/OrganizationsModal.css` | reescrito |
| `src/renderer/components/OrgWorkspaceTabPickerModal.tsx` | lista buscable |
| `src/i18n/locales/{en,es}.ts` | claves nuevas; se retiran `detailTab*`, `formCreate*`, `formAdd*` |

**No cambia**: `covenantApi.ts`, ningún canal IPC, ningún handler de `electron/`, ni la forma de
`CovenantWorkspace` / `CovenantMember`. Todos los `handle*` async de `OrganizationsModal` se
conservan tal cual; lo que se reescribe es el árbol de render y el estado de navegación
(`detailTab: OrgDetailTab` → `detailView: 'workspace' | 'settings'` + `selectedWorkspaceId` elevado
al modal).

## Restricciones

- `npm run check:ui`: los componentes del kit no aceptan `className`/`style`; nada de `title=` en
  DOM ni sobre componentes que hacen spread — los tooltips van por `components/ui/Tooltip`.
- Ambos locales (`en`, `es`) se actualizan a la vez.
- `npm test` verde.
