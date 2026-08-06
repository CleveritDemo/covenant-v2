# Covenant Gravity

Terminal de escritorio para macOS que reúne shells, archivos, Git y agentes de
programación en un mismo espacio de trabajo.

Construida con Electron, React, TypeScript, xterm.js y CodeMirror.

## Funcionalidades

- Pestañas persistentes con hasta cuatro paneles redimensionables y reordenables.
- Terminales reales mediante `node-pty`, con restauración de `cwd`, scrollback e
  historial de comandos.
- Paneles de agente para **Claude Code** y **Cursor Agent**, ejecutados mediante
  sus CLIs instalados localmente.
- Modos de permisos Ask, Auto y Plan, selector de modelo, cancelación y
  reanudación de conversaciones.
- Contextos reutilizables por pestaña: árbol de carpetas, archivos, símbolos,
  notas, estado de Git, dependencias o README.
- Explorador de archivos con búsqueda, operaciones de archivos y editor
  CodeMirror integrado.
- Panel Git para consultar cambios, hacer stage/unstage, commit, pull y push.
- Estado de GitHub Actions mediante token, variable de entorno o credenciales
  de Git.
- Temas, tamaño de fuente e interfaz en español o inglés.
- Controles opcionales de Spotify en la barra de título.

## Requisitos

- macOS. El empaquetado configurado actualmente genera una aplicación para
  Apple Silicon (`arm64`).
- Node.js y npm.
- Herramientas de línea de comandos de Xcode, necesarias para compilar
  dependencias nativas como `node-pty`.
- Opcional: Claude Code y/o Cursor Agent instalados, disponibles en `PATH` y
  autenticados desde su propio CLI.

## Desarrollo

```bash
git clone https://github.com/CleveritDemo/covenant-v2.git covenant-gravity
cd covenant-gravity
npm install
npm run dev
```

`npm install` recompila automáticamente `node-pty` para la versión de Electron
del proyecto. Si cambias de versión de Electron o aparece un error de ABI:

```bash
npm run rebuild:native
```

## Configuración

Abre **Ajustes** dentro de la aplicación para configurar:

- los comandos de Claude Code y Cursor Agent (`claude` y `agent` por defecto);
- el token de GitHub;
- el idioma;
- las playlists usadas por los controles de Spotify.

Los ajustes se guardan en:

```text
~/Library/Application Support/Covenant Gravity/config.json
```

También puedes crear `.env.local` a partir de `.env.example` para definir
`GITHUB_TOKEN` durante el desarrollo:

```bash
cp .env.example .env.local
```

Las credenciales de los agentes no se guardan en Covenant Gravity: cada CLI gestiona
su propia autenticación.

## Uso de agentes

1. Abre una terminal en la carpeta del proyecto.
2. Crea un panel de agente con `⌘A`.
3. Elige Claude Code o Cursor Agent.
4. Selecciona el modelo y el nivel de permisos.
5. Si lo necesitas, crea y asigna contextos compartidos desde la barra
   **Contextos**.
6. Escribe la tarea. El agente se ejecutará con el `cwd` mostrado en su panel.

Los contextos se materializan desde el disco al enviarse. Así, un contexto de
archivos, Git o dependencias refleja el estado actual del proyecto sin duplicar
su contenido en la sesión.

> El modo **Auto** permite que el CLI actúe sin solicitar confirmación. Úsalo
> solamente en carpetas de confianza.

## Atajos principales

En Windows/Linux se usa `Ctrl` en lugar de `⌘` cuando el atajo está disponible.

| Atajo | Acción |
|-------|--------|
| `⌘T` | Nueva pestaña |
| `⌘Y` | Dividir el panel activo |
| `⌘A` | Añadir un panel de agente |
| `⌘1` … `⌘9` | Cambiar de pestaña |
| `⌘W` | Cerrar el panel o la pestaña activa |
| `⌘E` | Mostrar u ocultar el explorador |
| `⌘P` | Abrir un archivo rápidamente |
| `⌘F` | Buscar en terminal e historial |
| `⌘G` | Abrir el panel Git |
| `⌘End` | Ir al final del terminal |

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Inicia Electron con recarga en desarrollo |
| `npm test` | Ejecuta la suite de Vitest |
| `npm run test:watch` | Ejecuta las pruebas en modo interactivo |
| `npm run build` | Compila main, preload y renderer |
| `npm run preview` | Abre una vista previa del build |
| `npm run dist` | Genera un DMG para macOS arm64 |
| `npm run dist:dir` | Genera la aplicación sin crear el DMG |
| `npm run rebuild:native` | Recompila `node-pty` para Electron |

Los artefactos compilados se escriben en `out/` y los paquetes en `dist/`.

## Actualizaciones

La app busca versiones nuevas en GitHub Releases al arrancar y cada hora. Cuando
hay una, aparece una píldora en la barra de título con la versión, las novedades
y un botón para instalar: descarga, cierra guardando la sesión y se relanza ya
actualizada. Detalles de operación y publicación en
[`docs/AUTO_UPDATER.md`](docs/AUTO_UPDATER.md).

## Arquitectura

```text
electron/
  main.ts                 Ventana, PTY, IPC y ciclo de vida
  preload.ts              API segura expuesta al renderer
  persistence.ts          Configuración, sesiones y conversaciones
  agentCliRuntime.ts      Procesos de Claude Code y Cursor Agent
  tabContextBuild.ts      Materialización de contextos
  fileExplorer*.ts        Operaciones del explorador
  gitSessionOps.ts        Operaciones Git

src/
  renderer/
    App.tsx               Pestañas, paneles y persistencia del layout
    agent/                Interfaz de agentes y contextos
    terminal/             xterm.js, herramientas y explorador
    components/           Modales y componentes compartidos
  shared/                 Tipos, esquemas y contratos IPC
  themes/                 Temas visuales
  i18n/                   Traducciones en español e inglés
```

El renderer no accede directamente a Node.js. Las operaciones privilegiadas
pasan por la API de `electron/preload.ts` y por canales IPC tipados hacia el
proceso principal.

## Verificación

```bash
npm test
npm run build
```
