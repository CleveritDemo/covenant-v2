# Changelog

El contenido de cada sección `## vX.Y.Z` acaba en dos sitios: en la página del
release de GitHub y, vía `latest*.yml`, en el modal "Novedades" del auto-updater
de la app. Escríbelas pensando en quien las va a leer desde la titlebar.

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
