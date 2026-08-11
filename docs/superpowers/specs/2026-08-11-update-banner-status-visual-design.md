# Update banner: personalidad Status + preview en Developer

Fecha: 2026-08-11

## Problema

El chip de actualización en la titlebar (`UpdateBanner`) es funcional pero plano:
pill + punto con pulse + botón Install. No comunica bien la etapa del updater
(`available` → `downloading` → `ready` / `error`) y no hay forma de revisarlo en
la app sin una release real.

## Objetivo

1. Rediseñar el chip con personalidad **C — Status / Informativo**: motion
   funcional (entrada lateral, pulse de “activo”, badge de etapa), sin glow ni
   sparks celebratorios.
2. Añadir en **Ajustes → Developer** un preview in-app (mismo patrón que splash /
   quit) para recorrer los estados sin tocar el auto-updater.

## No objetivos

- Cambiar IPC, `electron/selfUpdate.ts` ni el flujo real de descarga/instalación.
- Rediseñar el modal de Novedades (`TerminalModal` de notes).
- Personalidades A/B (sutil premium / celebratorio).
- Persistencia del preview ni flags en `config.json`.

## Decisiones

| Tema | Decisión |
|------|----------|
| Personalidad | C — Status / Informativo |
| Preview | Botón en Developer; estados fake solo en renderer |
| Al preview | Cerrar Settings para ver la titlebar |
| Ciclo | `available` → `downloading` → `ready` → idle (~2s por etapa; downloading anima %) |
| Reduced motion | Sin entrada/pulse/sheen si `prefers-reduced-motion: reduce` |

## Diseño visual (chip)

Layout (de izq. a der.), altura ~24px, centrado en titlebar como hoy:

1. **Punto de estado** — pulse por opacidad (no box-shadow expansivo).
2. **Versión** — `vX.Y.Z` (sigue abriendo notes si el estado lo permite).
3. **Badge de etapa** — píldora pequeña con label i18n corto (no reutilizar el
   copy del CTA):
   - `available` → “available” / “disponible”
   - `downloading` → “downloading” / “descargando” + barra % (como hoy)
   - `ready` → “restart” / “reiniciar” (etapa, distinto del botón Restart)
   - `error` → sin badge; mensaje + estilo danger (como hoy)
4. **CTA** — Install / Restart (`Button` kit, sin cambio de API).
5. **Dismiss** — icon close (oculto en downloading, como hoy).

Motion:

- Montaje: `translateX(-8px)` + fade (~400ms ease-out).
- Badge activo: micro scale opcional (~1.03) o solo contraste de color.
- Descarga: conservar track + fill + sheen existentes.
- Error: sin pulse animado (como hoy).

Tokens: seguir `--accent` / `--danger` / `--text` / `--font-ui` (sin colores hardcode
fuera de `color-mix` con vars del tema).

## Preview en Developer

Nuevo `SettingsField` bajo quit confirmation:

- Label / hint / botón i18n (`en` + `es`).
- Click: `onClose()` del modal → dispara `previewUpdateBanner()`.

### Mecánica renderer-only

Módulo pequeño (p. ej. `src/renderer/updateBannerPreview.ts`), análogo a `splash.ts`:

- Suscriptores / override de `UpdateState` que `UpdateBanner` consulta por encima
  del estado IPC real.
- Secuencia:
  1. `{ kind: 'available', version: '<appVersion o 0.0.0-preview>', notes: null }`
  2. `{ kind: 'downloading', version, percent }` con ticks ~0→100
  3. `{ kind: 'ready', version, notes: null }`
  4. clear override → vuelve al estado real de main
- Cancelar un preview en curso si se lanza otro.
- Install / dismiss durante preview: no deben llamar IPC destructivo; el preview
  limpia el override (dismiss) o no-op / limpia (install) para no reiniciar la app.

Comportamiento real del updater cuando no hay override: intacto.

## Archivos tocados (previsto)

- `src/renderer/components/UpdateBanner.tsx` — badge de etapa + override preview
- `src/renderer/components/UpdateBanner.css` — estilo C + entrada
- `src/renderer/updateBannerPreview.ts` — nuevo, secuencia fake
- `src/renderer/components/SettingsModal.tsx` — campo Developer + cerrar modal
- `src/i18n/locales/{en,es}.ts` — strings del badge y del preview
- Tests opcionales: secuencia pura del preview si se extrae a `src/shared/`

## Criterios de aceptación

- [ ] Chip en `available`/`ready` muestra badge de etapa y entrada lateral.
- [ ] Descarga sigue mostrando barra con % estable (sin reflow raro).
- [ ] Developer → Preview cierra Settings y cicla los tres estados en titlebar.
- [ ] Preview no descarga, no instala, no reinicia.
- [ ] Tras el ciclo, el chip refleja otra vez el `UpdateState` real (o desaparece si idle).
- [ ] `prefers-reduced-motion` desactiva animaciones ornamentales/de entrada.
- [ ] `npm run check:ui` sin regresiones del kit (sin `className`/`title` nuevos en ui/).
