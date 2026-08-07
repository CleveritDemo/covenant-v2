# Changelog

El contenido de cada sección `## vX.Y.Z` acaba en dos sitios: en la página del
release de GitHub y, vía `latest*.yml`, en el modal "Novedades" del auto-updater
de la app. Escríbelas pensando en quien las va a leer desde la titlebar.

## v0.6.2

- **Se acabaron los tooltips nativos.** Los cuadros amarillos del sistema
  aparecían con retardo, se quedaban colgados al mover el ratón entre paneles y
  no seguían el tema. Los controles que los usaban se apoyan ahora en su propia
  etiqueta o en el tooltip de la app.
- **Organizaciones, en español.** Quedaban etiquetas sin traducir en el panel de
  organizaciones — los contextos globales, la invitación a iniciar sesión y los
  campos de miembro y de contexto — que aparecían en inglés aunque tuvieras la
  interfaz en español. También la barra de contextos del chat.

## v0.6.0

- **Organizaciones y workspaces compartidos.** Puedes iniciar sesión en Covenant
  con tu cuenta de GitHub y crear organizaciones: añadir miembros por su login,
  repartir permisos por rol y definir contextos globales que todos los proyectos
  de la organización comparten. La sesión se guarda cifrada en el llavero del
  sistema, no en texto plano.
- **Saber qué versión llevas ya no obliga a salir de la app.** Ajustes tiene una
  categoría nueva, Novedades: arriba la versión instalada y debajo el historial
  de cambios completo, el mismo que ves en la página del release. Hasta ahora las
  notas sólo aparecían en el banner del auto-updater, y una vez lo cerrabas no
  había forma de volver a leerlas.
- **El riel de categorías de Ajustes se lee.** La categoría activa se pintaba con
  un acento demasiado claro para su etiqueta, y las inactivas en un gris que se
  desvanecía sobre el fondo; en los temas claros ninguna de las dos llegaba al
  mínimo de contraste. Ahora la activa usa el acento oscurecido que ya se
  aplicaba a los botones sólidos y las inactivas suben de tono.

## v0.5.0

- **Los contextos se leen, ya no se descifran.** Abrir un contexto mostraba el
  Markdown en crudo, con los marcadores `iaterminal:*` y un recuento en jerga de
  parser. Ahora todos tienen el par Reporte/Fuente que hasta ahora solo tenían
  los resultados de agente: el Reporte enseña el contenido limpio y las notas y
  anotaciones que haya escrito la IA; Fuente sigue mostrando el `.md` tal cual.
- **La estructura de carpetas se explora, no se lee línea a línea.** Un contexto
  de tipo Estructura de carpetas se pinta como árbol plegable, con el número de
  subcarpetas de cada rama y los dos primeros niveles abiertos, en vez de como
  una lista de rutas completas repetidas.
- **Las dependencias se ven como dependencias.** Un contexto de tipo
  Dependencias muestra la lista con su versión, las de desarrollo marcadas, y
  los scripts con su comando, en lugar del `package.json` en bruto. Los
  manifiestos que no son JSON (`Cargo.toml`, `go.mod`, `pyproject.toml`) siguen
  mostrándose como texto.
- **La carpeta del proyecto pasa a llamarse `.gravity`.** Los proyectos que ya
  tengan `.iaterminal` la siguen usando: no se renombra nada en tu repo, y los
  agentes, contextos y resultados que ya tenías siguen donde estaban. Los
  proyectos nuevos se crean con `.gravity`.
- Los chips del pool de contextos comparten un solo tooltip, así que dejan de
  aparecer varios a la vez al recorrerlos.

## v0.4.0

- **La actualización automática ya se aplica.** Al pulsar Instalar, la app se
  cerraba antes de que el instalador terminase de copiar la versión nueva: no
  se relanzaba y, al abrirla otra vez, seguía en la versión vieja ofreciendo la
  misma actualización una y otra vez.
- El updater deja traza en `updater.log`, dentro de la carpeta de configuración,
  para que un fallo de instalación se pueda diagnosticar.

> Si vienes de la 0.3.0 o anterior, esta hay que instalarla a mano desde el
> `.dmg` (con la app cerrada). El fallo estaba en el código que *aplica* la
> actualización, así que la versión que ya tienes instalada no puede
> arreglarse a sí misma. A partir de la 0.4.0 el botón Instalar funciona.

## v0.3.0

- **Ajustes se navega en vez de scrollearse**: cinco categorías en un riel
  lateral, en lugar de seis secciones apiladas en una sola columna.
- **Los CLIs de agente dicen si están instalados**: cada proveedor muestra si
  su ejecutable está en el PATH y con qué versión, tanto en Ajustes como al
  elegir proveedor. Antes escribías el comando a ciegas y el fallo aparecía al
  lanzar el agente.
- **Ajustes se guarda solo al cambiar.** Antes Escape guardaba y Cancelar
  descartaba; ahora Escape, el clic fuera y «Listo» hacen lo mismo, el pie
  lleva la hora del último guardado y «Descartar cambios» vuelve al estado de
  apertura.
- **Los errores aparecen junto al campo**: una playlist de Spotify mal pegada
  lo dice en su tarjeta al salir del campo, y ya no impide guardar el resto.
  El token de GitHub muestra de quién es y qué scopes tiene.
- **Modal de configuración del agente rediseñado**: índice lateral con
  contadores, chips accionables en la cabecera (Auto marcado en rojo por ser
  el ajuste con más radio de daño), Orquestación como sección propia, rejilla
  de proveedores, plantillas de objetivo por rol y reordenado de reglas.
- **Desplegables propios**: los `<select>` nativos los pintaba macOS ignorando
  el tema de la app. Ahora respetan el tema y se manejan con el teclado.

## v0.2.0

- Auto-updater contra GitHub Releases: chequeo silencioso al arrancar y cada
  hora, píldora en la titlebar con la versión nueva, notas de la versión y un
  botón para instalar y reiniciar.
- Windows pasa de ejecutable portable a instalador NSIS (requisito para poder
  auto-actualizarse).
- macOS publica además un `.zip` junto al `.dmg` — es el artefacto del que tira
  Squirrel.Mac para actualizar.

## v0.1.0

- Primera release pública de Covenant Gravity.
