# Características de Covenant Gravity

## 1. Interfaz General

### 1.1 Barra de Título (Titlebar)
- Muestra información del estado de la aplicación
- Controles de reproducción Spotify integrados en la barra de título
- Selector de estado de ánimo musical (Focus, Chill, Energy, Ambient)
- Indicador visual del cliente Spotify (conectado/desconectado)
- Control de reproducción/pausa con indicador de estado en tiempo real

### 1.2 Pestañas (Tabs)
- Sistema de pestañas para organizar múltiples sesiones de terminal
- Cada pestaña es independiente con su propio historial y estado
- Agregar nuevas pestañas con botón dedicado
- Cerrar pestañas individuales o la ventana completa
- Máximo 4 paneles por pestaña (layout 2×2)
- Reordenación de pestañas mediante drag and drop
- Cada pestaña mantiene su directorio de trabajo (cwd) independiente

### 1.3 Pantalla Dividida (Split Layout)
- Soporte para división horizontal y vertical de paneles
- Redimensionamiento de paneles mediante separadores (gutters)
- Hasta 4 paneles simultáneamente por pestaña
- Cada panel es una terminal independiente con su propio PTY
- Reordenación de paneles mediante drag and drop
- Arrastre de miniaturas de paneles para visualizar contenido

## 2. Terminal (xterm.js)

### 2.1 Funcionalidades Básicas
- Terminal emulada completa usando xterm.js
- Soporte para secuencias ANSI de colores y estilos
- Sincronización automática del directorio de trabajo (cwd) con el explorador de archivos
- Historiales separados de comandos por panel
- Seguimiento automático de la salida terminal (auto-scroll al escribir)

### 2.2 Detección de Comandos
- Captura automática de comandos `cd` para actualizar el cwd de la sesión
- Historial persistente de directorios recientes accesibles desde la IA
- Ejecución de comandos sugeridos en el historial

### 2.3 Búsqueda en Terminal
- Búsqueda dentro del buffer de la terminal (scrollback)
- Modal de búsqueda con soporte de expresiones regulares
- Navegación entre resultados de búsqueda

### 2.4 Sugerencias de Comandos (Command Suggest)
- Autocompletado de comandos basado en historial
- Visualización de comandos recientes ejecutados

### 2.5 Redimensionamiento Inteligente
- Ajuste automático del terminal al tamaño de la ventana
- Refresco de dimensiones del PTY al redimensionar
- Programación de ajustes para evitar llamadas excesivas

### 2.6 Reinicio Automático
- Opción de reiniciar automáticamente el shell cuando termina (exit)
- Configurable en la sección de configuración

## 3. Panel de Inteligencia Artificial

### 3.1 Chat Interactivo
- Panel de chat bidireccional con modelos de IA
- Historial persistente de conversaciones
- Soporte para múltiples proveedores de IA:
  - **Ollama**: Local, sin restricciones de costo
  - **Anthropic**: Claude con API key
  - **OpenAI**: GPT-4, GPT-4o con API key

### 3.2 Mensajes de Chat
- Visualización de mensajes del usuario y asistente
- Renderizado de markdown en respuestas
- Soporte para bloques de código con sintaxis highlighting
- Iconos diferenciados para usuario/asistente
- Scroll automático al nuevo mensaje

### 3.3 Modo Thinking (Reflexión)
- Soporte para thinking mode en modelos que lo permiten
- Ollama: parámetro `think: true`
- Anthropic: extended thinking nativo
- Muestra bloques de pensamiento colapsables en las respuestas

### 3.4 Menciones de Archivos (@mentions)
- Escritura de `@archivo` para mencionar archivos del cwd
- Autocompletado emergente de rutas
- Búsqueda rápida de archivos por nombre
- Contexto de archivo adjunto en la solicitud

### 3.5 Selección de Texto
- Captura automática de texto seleccionado en el terminal
- Inclusión del contexto seleccionado en prompts del agente

### 3.6 Contexto Rico del Proyecto
- **Árbol de carpetas**: estructura superficial del proyecto
- **Archivo package.json**: metadatos del proyecto (si existe)
- **Estado de Git**: rama, cambios sin confirmar, diferencias
- **Archivo agent.md**: memoria persistente del proyecto para la IA
- **Líneas del terminal**: últimas líneas ejecutadas (configurable, hasta 200)
- **Archivos mencionados**: contesto de archivos específicos

### 3.7 Control de Contexto
- Control de líneas máximas de contexto terminal (10-2000)
- Selección dinámica de archivos relevantes
- Límite de caracteres en historial

## 4. Modo Agente

### 4.1 Activación del Modo Agente
- Checkbox para activar/desactivar modo agente en cabecera del panel
- Solo disponible cuando `agentMode` está habilitado en configuración
- Requiere confirmación de seguridad del usuario

### 4.2 Operaciones de Lectura (READ)
- Lectura de archivos relativos al cwd
- Soporte para rangos de líneas (ej: archivo:10-50)
- Lectura de línea específica (ej: archivo:25)
- Lectura de estructura de carpetas (`LIST`)
- Búsqueda de patrones con grep (`GREP`)
- Búsqueda con patrones globales (`GLOB`)

### 4.3 Operaciones de Escritura (WRITE)
- Creación y modificación de archivos
- Operaciones de parche (search/replace) en archivos existentes
- Validación de rutas relativas
- Prevención de escritura fuera del cwd
- Confirmación de operaciones de escritura críticas

### 4.4 Operaciones de Shell (RUN)
- Ejecución de comandos shell bajo el cwd
- Políticas de ejecución configurables:
  - **off**: Deshabilitado, no ejecuta comandos
  - **ask**: Pide confirmación antes de cada comando
  - **always**: Ejecuta sin preguntar (con cuidado)
- Captura de salida estándar y errores
- Timeout de ejecución para prevenir bloqueos

### 4.5 Operaciones de Git
- Lectura de estado Git
- Obtención de diffs para análisis
- Obtención de diffs por staging area

### 4.6 Protocolo de Comunicación del Agente
- Marcadores especiales para delimitar bloques (<<<AI_TERMINAL_*>>>)
- Parseo automático de bloques en orden
- Fallback para detectar patrones markdown comunes
- Extracción de archivos desde bloques de código

### 4.7 Bucle del Agente
- Modo loop: reaplicación automática hasta 10 iteraciones
- Detención manual con botón Stop
- Visualización del progreso del agente
- Recopilación de resultados de cada turno

### 4.8 Tool Calling Nativo (Preparado)
- Arquitectura preparada para tool calling de Anthropic/OpenAI
- Actualmente deshabilitado (protocolo de texto como fallback)
- Fácil activación cuando sea necesario
- Traducción automática entre formatos

## 5. Explorador de Archivos

### 5.1 Vista de Árbol
- Árbol jerárquico del directorio de trabajo
- Expansión/contracción de carpetas
- Iconos visuales para archivos y carpetas
- Indicadores de tipo de archivo
- Soporte para archivos ocultos (show/hide toggle)

### 5.2 Selección de Archivos
- Click para seleccionar
- Opción de abrir en click único o doble click
- Visualización del archivo seleccionado en el editor

### 5.3 Editor de Código Integrado
- Editor CodeMirror para archivos de texto
- Sintaxis highlighting para múltiples lenguajes:
  - TypeScript/JavaScript
  - Python
  - Rust
  - CSS/HTML
  - JSON/YAML
  - Markdown
  - SQL
  - Y muchos más
- Búsqueda dentro del archivo
- Guardado automático y manual
- Indicador de cambios no guardados

### 5.4 Operaciones de Archivo
- **Crear**: Nuevas carpetas y archivos
- **Renombrar**: Renombramiento de archivos/carpetas
- **Eliminar**: Con confirmación de seguridad
- **Copiar/Cortar/Pegar**: Operaciones del portapapeles
- **Mover**: Movimiento de archivos entre carpetas
- **Revelar en Finder**: Abrir en el explorador del sistema

### 5.5 Búsqueda Global
- Búsqueda de archivos en todo el proyecto
- Filtrado rápido por nombre de archivo
- Integración con ripgrep (rg)
- Resultados en tiempo real

### 5.6 Sincronización con el Sistema de Archivos
- Watchers en tiempo real para cambios
- Notificaciones de cambios externos
- Sincronización automática del árbol
- Actualización de estado de Git cuando cambian archivos

### 5.7 Integración de Estado de Git
- Indicadores visuales de estado Git en archivos:
  - Modificado
  - No seguido (untracked)
  - Ignorado
- Colores diferenciados para cada estado

### 5.8 Portapapeles y Drag-Drop
- Operaciones de copiar/cortar/pegar con el sistema
- Drag and drop de archivos
- Arrastre entre paneles del explorador

## 6. Git Integration

### 6.1 Estado del Repositorio
- Visualización del estado del repositorio
- Rama actual
- Cambios sin confirmar (Working tree changes)
- Cambios staged (Index changes)
- Archivos sin seguimiento (Untracked files)

### 6.2 Operaciones de Stage
- Stage de archivos individuales
- Stage de todos los cambios
- Unstage de archivos
- Unstage de todos

### 6.3 Commits
- Creación de commits con mensaje personalizado
- Sugerencia de mensajes de commit con IA
- Análisis de cambios para recomendaciones
- Validación de mensaje antes de confirmar

### 6.4 Operaciones Remotas
- Push a repositorio remoto
- Pull desde repositorio remoto
- Manejo de errores de red
- Timeout para operaciones remotas

### 6.5 Visualización de Diferencias (Diffs)
- Visualización de diferencias de archivos
- Diffs entre working tree e index
- Diffs del área staged
- Bloques de diff coloreados
- Límites de salida configurables

### 6.6 Panel de Git Modal
- UI completa para operaciones Git
- Listado de archivos con estado
- Diffs interactivos
- Operaciones de stage/unstage desde UI

## 7. GitHub Actions Integration

### 7.1 Visualización de Workflow Runs
- Listado de runs de GitHub Actions
- Estados del workflow (success, failure, pending)
- Información de flujo y rama
- Timestamps de ejecución
- Acciones de commit asociadas

### 7.2 Acceso a Información
- Integración con GitHub CLI (gh)
- Visualización de último run
- Historial de runs recientes
- Filtrado por workflow

## 8. Control de Configuración

### 8.1 Proveedor de IA
- Selector entre Ollama, Anthropic y OpenAI
- Configuración específica por proveedor
- Validación de API keys obligatorias
- URL base personalizable para Ollama

### 8.2 Modelo de IA
- Selector de modelo específico del proveedor
- Modelos por defecto recomendados
- Cambio dinámico del modelo

### 8.3 Política de Shell del Agente
- Selección entre off, ask, always
- Protección contra ejecución accidental
- Confirmación por comando en modo ask

### 8.4 Tamaño de Fuente
- Control del tamaño de fuente del terminal
- Rango: 9-24 puntos
- Aplicación inmediata
- Persistencia de preferencia

### 8.5 Tema Visual
- Selector de múltiples temas predefinidos
- Temas claros y oscuros
- Customización de colores xterm
- Aplicación en tiempo real

### 8.6 Contexto Máximo
- Control de líneas de terminal como contexto
- Rango: 10-2000 líneas
- Impacto en token usage de IA

### 8.7 Modos de Funcionamiento del Agente
- Activar/desactivar modo agente
- Activar/desactivar loop automático
- Configuración de política de shell

### 8.8 Thinking Mode
- Activar/desactivar reflexión en modelos que lo soportan
- Solo funciona en modelos compatibles
- Aumenta el tiempo de respuesta pero mejora la calidad

### 8.9 Integración de Spotify
- Configuración de IDs de playlist por mood
- URLs de Spotify o IDs de 22 caracteres
- Validación de playlists
- Mood por defecto

### 8.10 Idioma de Interfaz
- Selector entre Inglés y Español
- Traducción completa de UI
- Persistencia de preferencia

### 8.11 Reinicio Automático de Shell
- Opción para reiniciar shell al exit
- Mantiene la sesión activa
- Configurable por preferencia del usuario

## 9. Integración de Spotify

### 9.1 Requisitos
- Cliente de Spotify instalado en macOS
- Autenticación con cuenta Spotify
- Playlists públicas o del usuario

### 9.2 Controles de Reproducción
- Reproducir playlist seleccionada
- Pausa/reanudación de reproducción
- Indicador visual de estado (playing/paused)

### 9.3 Estados de Ánimo Musicales
- **Focus**: Para concentración profunda
- **Chill**: Música relajada
- **Energy**: Para productividad alta
- **Ambient**: Sonidos ambientales

### 9.4 Visualización
- Espectro visual animado mientras se reproduce
- Indicador de cliente no instalado
- Estado en tiempo real con refresh cada 2 segundos

## 10. Persistencia y Estado

### 10.1 Sesión de Terminal
- Guardado automático del layout de pestañas
- Persistencia de directorios de trabajo
- Recuperación de sesiones al abrir la app

### 10.2 Historial de Chat IA
- Guardado por panel/sesión
- Carga automática de historial anterior
- Límite de 20 mensajes recientes mantenidos
- Sincronización con filesystem

### 10.3 Historial de Comandos
- Guardado de comandos ejecutados (sin cd)
- Acceso rápido a comandos históricos
- Separación por sesión/panel

### 10.4 Scrollback del Terminal
- Serialización del contenido del terminal
- Persistencia entre sesiones
- Recuperación al abrir pestaña anterior

### 10.5 Log de Interacciones
- Registro de interacciones usuario-IA
- Límite de 120 entradas mantidas
- Análisis post-sesión

### 10.6 Archivo agent.md
- Memoria persistente por proyecto
- Lectura al inicio de conversación IA
- Actualización automática por IA si es necesario
- Bootstrap de archivos iniciales

### 10.7 Directorios Recientes (cd recent)
- Captura de últimas carpetas visitadas
- Árbol de navegación rápida
- Historial persistente por sesión

## 11. Temas Visuales

### 11.1 Temas Disponibles
- **VS Code Dark**: Tema oscuro estándar
- **Dracula**: Tema popular oscuro
- **Nord**: Colores nórdicos
- **One Dark Pro**: VS Code One Dark
- **Material Dark/Light**: Material Design
- Más temas adicionales

### 11.2 Personalización de Tema
- Variables CSS personalizables
- Colores xterm específicos
- Aplicación inmediata sin reinicio
- Modal de vista previa

### 11.3 Componentes Temáticos
- Terminal xterm temático
- Editor de código temático
- UI general temático
- Colores de acentos y bordes

## 12. Internacionalización (i18n)

### 12.1 Idiomas Soportados
- **Español**: Interfaz completa en español
- **Inglés**: Interfaz en inglés

### 12.2 Textos Traducidos
- Todos los elementos de UI
- Mensajes de error
- Tooltips y ayuda
- Labels de configuración

### 12.3 Cambio de Idioma
- Selector en configuración
- Aplicación inmediata sin reinicio
- Persistencia de preferencia

## 13. Modales y Overlays

### 13.1 Modal de Configuración
- Interfaz completa de configuración
- Secciones organizadas
- Validación de entrada
- Guardado de cambios

### 13.2 Modal de Selección de Tema
- Grid de temas con vista previa
- Filtrado de claros/oscuros
- Selección inmediata

### 13.3 Modal de Git
- Interfaz de operaciones Git
- Visualización de diffs
- Listado de cambios
- Sugerencias de commit

### 13.4 Modal de Búsqueda en Terminal
- Interfaz de búsqueda
- Navegación entre resultados
- Expresiones regulares

### 13.5 Modal de Confirmación de Terminal
- Confirmación para ejecutar comandos críticos
- Mensaje de advertencia personalizado
- Botones de confirmar/cancelar

### 13.6 Modal de Confirmación General
- Confirmación de operaciones destructivas
- Dialogs modulares

## 14. Seguridad y Protecciones

### 14.1 Aislamiento de Procesos
- Preload script para comunicación segura
- API bridge sin acceso directo a Node
- Validación de rutas relativas

### 14.2 Validación de Entrada
- Validación de rutas de archivo
- Sanitización de comandos shell
- Validación de configuración
- Comprobación de límites de tamaño

### 14.3 Prevención de Escritura Fuera del CWD
- Validación de rutas relativas
- Bloqueo de `..` en caminos de agente
- Resolución segura de rutas

### 14.4 Política de Ejecución de Shell
- Modos: off, ask, always
- Confirmación manual cuando es necesario
- Logging de comandos ejecutados

### 14.5 Timeout y Límites
- Timeout para operaciones Git (120s local, 900s remoto)
- Límite de tamaño de salida Git
- Límite de salida de shell
- Máximo de iteraciones del agente (10)

## 15. Funcionalidades de Interfaz de Usuario

### 15.1 Drag and Drop
- Arrastre de miniaturas de paneles
- Reordenación de pestañas
- Reordenación de paneles
- Feedback visual durante arrastre

### 15.2 Redimensionamiento
- Redimensionamiento de paneles split
- Redimensionamiento de secciones del explorador
- Persistencia de tamaños

### 15.3 Animaciones
- Transiciones suaves entre estados
- Colapso/expansión con animación
- Fade in/out de elementos

### 15.4 Accesibilidad
- Soporte para navegación por teclado
- Indicadores visuales de foco
- Tooltips y ayuda contextual

### 15.5 Error Boundaries
- Captura de errores de componentes
- Fallback UI para errores
- Logging de errores

### 15.6 Estados de Carga
- Spinners de carga
- Estados deshabilitados durante espera
- Feedback visual de operaciones asincrónicas

## 16. Capacidades Técnicas

### 16.1 Lenguajes de Programación Soportados en Editor
- TypeScript/JavaScript
- Python
- Rust
- Java/Kotlin
- C/C++
- CSS/SCSS/LESS
- HTML
- JSON/YAML/TOML
- Markdown
- SQL
- Graphql
- Y más...

### 16.2 Stack Tecnológico
- **Frontend**: React 18
- **Terminal**: xterm.js
- **Editor**: CodeMirror
- **Desktop**: Electron
- **Build**: Vite + electron-vite
- **Empaquetado**: electron-builder
- **Testing**: Vitest

### 16.3 Integración de APIs
- IPC Electron entre main y renderer
- APIs seguras via preload
- WebSockets para SSE (Server-Sent Events)
- HTTP para APIs de IA

## 17. Controles por Teclado

### 17.1 Atajos Globales
- Cierre de pestaña/ventana: ⌘W / Ctrl+W
- Búsqueda en terminal: configurable
- Cambio de tema: accesible desde configuración

### 17.2 Terminal
- Todos los atajos estándar de terminal
- Navegación de histórico
- Copy/paste estándar

### 17.3 Editor
- Atajos estándar de CodeMirror
- Búsqueda y reemplazo
- Indentación automática
- Completación de código

## 18. Información del Sistema

### 18.1 Metadatos del Proyecto
- Lectura de package.json
- Extracción de scripts
- Dependencias principales
- Versión del proyecto

### 18.2 Estado del Repositorio Git
- Rama actual
- Cambios sin confirmar
- Archivos staged
- Archivos sin seguimiento

### 18.3 Información de Terminal
- Líneas recientes ejecutadas
- Estado del shell actual
- Variables de entorno relevantes

## 19. Limitaciones y Validaciones

### 19.1 Límites de Datos
- Máximo 200 líneas de contexto del terminal (configurable)
- Máximo 4000 caracteres en historial de mensajes
- Máximo 120 entradas en log de interacciones
- Máximo 20 mensajes recientes en historial

### 19.2 Validaciones Obligatorias
- API key requerida para Anthropic/OpenAI
- URL válida para Ollama
- Tamaño de fuente: 9-24 puntos
- Contexto máximo: 10-2000 líneas
- Política de shell: off, ask o always

### 19.3 Protecciones
- Máximo 10 iteraciones en bucle de agente
- Timeout de git local: 120 segundos
- Timeout de git remoto: 900 segundos
- Máximo de salida git: 100KB
- Máximo de salida de shell: variable

## 20. Características Avanzadas

### 20.1 Contexto Dinámico de Proyecto
- Recopilación automática de contexto relevante
- Árbol superficial de carpetas
- Archivos package.json
- Estado actual de Git
- Historial de terminal reciente
- Archivos mencionados por el usuario

### 20.2 Memoria del Proyecto (agent.md)
- Archivo `.ai-terminal/agent.md` por proyecto
- Contiene instrucciones y contexto persistente
- Actualizable por la IA según sea necesario
- Cargado automáticamente en cada sesión

### 20.3 Sugerencias Inteligentes
- Sugerencias de commit basadas en cambios Git
- Análisis de diffs con IA
- Recomendaciones de arquitectura
- Proposiciones de mejora de código

### 20.4 Registro de Interacciones
- Log detallado de acciones usuario-IA
- Análisis post-sesión
- Patrones de uso
- Mejora continua

### 20.5 Sincronización de Contexto
- Sincronización automática de cwd entre terminal y IA
- Actualización de contexto en tiempo real
- Invalidación de caché cuando es necesario

---

**Última actualización**: 2026-06-19
