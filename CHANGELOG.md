# Changelog

El contenido de cada sección `## vX.Y.Z` acaba en dos sitios: en la página del
release de GitHub y, vía `latest*.yml`, en el modal "Novedades" del auto-updater
de la app. Escríbelas pensando en quien las va a leer desde la titlebar.

## v0.39.30

- **Lo que escribes en un agente sigue ahí al volver**: si preparas un mensaje
  en el composer del plano —texto, imágenes pegadas o dibujadas y contextos
  arrastrados—, cambias a otro agente y vuelves, lo encuentras tal cual lo
  dejaste. Antes el borrador se borraba al cambiar de chip. Cada agente guarda
  el suyo, así que los contextos que sueltas para uno ya no aparecen en el
  siguiente.
- **El permiso Auto se avisa en ámbar, no en rojo de error**: elegir Auto tiene
  consecuencias, pero no es un fallo; la tarjeta seleccionada ahora se tiñe de
  ámbar (y de un ámbar más oscuro en los temas claros, para que se lea).

## v0.39.29

- **La cara de un contexto se elige entre 53 iconos, no 19**: los nuevos cubren
  lo que faltaba —base de datos, nube, bug, test, candado, clave, gráfico,
  calendario, etiqueta, cohete, Datadog— y están agrupados por el trabajo que
  describen: Código, Documentos, Datos, Equipo e IA, Herramientas. Los iconos de
  antes siguen ahí, así que ningún contexto guardado cambia de cara.
- **Buscador de iconos**: escribe "rama", "sql", "gráfico" o "apm" y la rejilla
  se queda con lo que corresponde. Entiende sinónimos en español e inglés y no
  distingue tildes ni mayúsculas. La rejilla scrollea sola, así que el nombre y
  el archivo del contexto ya no quedan fuera de la vista.
- **El bloque "Aspecto" plegado dice lo que elegiste**: muestra el icono sobre
  su color y el nombre del contexto, en vez de un icono suelto.
- **La confirmación de salida ya no se esconde detrás de otro modal**: si
  cierras la app con el formulario de contextos abierto, la pregunta se ve —y
  responde al Enter y al Esc— en vez de quedar por debajo.

## v0.39.28

- **La lista de salas de brainstorm se lee de un vistazo**: el asunto ocupa dos
  líneas antes de recortarse —era lo único que distinguía una sala y perdía el
  espacio contra cinco botones iguales— y debajo va su ficha: estado, rondas
  gastadas como medidor, quiénes hablaron y cuándo. Las salas se agrupan en "En
  curso / Esta semana / Antes", con buscador por asunto o agente.
- **Un botón que dice lo que va a pasar**: "En vivo" si la sala corre,
  "Reanudar" si está en pausa, "Abrir" si ya cerró. Editar, copiar ruta y
  eliminar se van al menú `⋯`, con eliminar aparte y en rojo.
- **"Al contexto"**: una sala cerrada se registra como contexto del proyecto de
  un clic —el cierre si lo hay, el acta completa si no—, así lo que se discutió
  queda disponible para los agentes sin copiar nada a mano. "Guardar como
  contexto" en la tarjeta de cierre escribe ese mismo archivo, y ahora el
  contexto aparece de inmediato en la pestaña en vez de solo en disco.
- **Editar una sala vuelve a ser lo mismo que crearla**: el formulario recupera
  el resultado esperado (ideas / decisión / plan / crítica), que antes se
  perdía al guardar, las rondas con su significado y el resumen de la tirada. Si
  la sala nunca arrancó, también se puede cambiar quién está en ella.
- **Cerrar la sala la minimiza en vez de matarla**: el runner vive fuera de la
  ventana, así que cerrarla ya no detiene la conversación. El botón de
  Brainstorms muestra un punto ámbar y un flyout con tema, ronda y quién habla.

## v0.39.27

- **Salir de una organización deja de prometer lo que no puede cumplir**: al
  owner ya no se le ofrece el botón, porque el servidor nunca lo deja irse — de
  una organización propia no se sale, se transfiere la propiedad. Antes el
  botón estaba activo, el modal preguntaba, y recién al confirmar aparecía un
  "forbidden" crudo. Si aun así el servidor rechaza la salida, el aviso ahora
  explica qué hacer.

## v0.39.26

- **Una réplica ya no cuenta como un agente más**: en Pulse, `backend-2` y
  `backend-3` se pliegan bajo su experto con los números sumados y un chip `×n`
  con el pico de copias en paralelo. Al desplegar la fila se ve qué hizo cada
  instancia, y las copias que gastaron un turno sin producir nada quedan
  marcadas. El contador de flota cuenta expertos, no copias.
- **Adjuntar un archivo que no está en el repo**: el campo de contextos gana
  "Importar archivos…", que copia lo que elijas dentro del proyecto y deja
  puesta la ruta relativa. Y cuando una ruta queda fuera del proyecto, ahora lo
  dice en vez de dejar el contexto vacío en silencio.
- **Delegaciones que se quedaban en "running" con el especialista parado**: las
  que están esperando turno dicen "en cola" y su punto no parpadea, y una
  subtarea que nunca llegó a arrancar deja de colgarse para siempre — se
  destraba sola al minuto.
- **El resultado de una delegación se lee como tarjeta**: quién contestó y cómo
  le fue arriba, el resumen con sus tablas renderizadas de verdad, y los
  archivos tocados abajo. Antes era un volcado con los pipes del markdown a la
  vista.
- **El chat distingue quién habla**: tu mensaje va apagado contra la derecha y
  la respuesta del agente a la izquierda con un acento en el filo, sin cajas.
- **Imágenes que se pueden mirar**: la miniatura de un adjunto —pegado o ya
  enviado— se abre en grande al clickearla, y el botón de quitar deja de taparla:
  aparece al pasar el mouse, fuera del borde.
- **Temas Credicorp**: ocho, en su propia sección del picker, con los colores del
  manual de marca. Y la lista del picker ahora scrollea, que con 32 temas ya
  hacía falta.

## v0.39.25

- **Un `.mcp.json` roto ya no deja al CLI sin servidores**: la escritura de la
  config MCP pasa por una validación en el main antes de tocar el disco. Si el
  JSON no parsea, no es un objeto o `mcpServers` viene mal formado, el archivo
  se queda como estaba en vez de guardarse a medias; los archivos
  desproporcionados también se rechazan. Release de plomería: no hay pantalla
  nueva todavía, la validación queda lista para la UI que la va a usar.

## v0.39.24

- **Varias conversaciones con el mismo agente**: el tacho deja de ser la única
  forma de empezar de cero. Cada agente lleva su lista de conversaciones en la
  barra del chat: `+` abre una nueva sin tocar la anterior, el selector retoma
  cualquiera con su historial *y* su sesión del CLI, y el lápiz la retitula.
  Borrar pasa a afectar solo a la conversación abierta. Lo que ya tenías se
  convierte en tu primera conversación, sin perder nada.
- **Una subtarea ya no le borra la memoria al especialista**: cuando el
  orquestador delegaba, el agente destino perdía el hilo de su propia
  conversación y tu siguiente mensaje arrancaba en frío. Ahora la subtarea corre
  en su CLI aparte y la conversación del agente sigue donde estaba.
- **La sala de brainstorm se lee como un acta**: estado visible por agente, voz
  dirigida a uno solo sin que el resto lo tome como orden, contexto que se puede
  sumar en caliente y un cierre con la decisión tomada en vez de un transcript
  suelto. El brief arranca con un working set de contextos y archivos.
- **↑/↓ recuperan lo que ya mandaste**: en el chat del plano, las flechas
  recorren tus mensajes anteriores como en una terminal.

## v0.39.23

- **Separador titlebar–tabs menos visible**: la línea entre la barra de título y las pestañas queda transparente, con menos ruido visual.

## v0.39.22

- **Refinamiento visual del plano**: mini-cards, terminales y badges más tenues; el acento marca solo lo activo, sin ruido.

## v0.39.21

- **Mini-card de agente sin bordes**: la face del plano queda limpia (sin anillo en la card ni en el status); el chat activo se marca solo con box-shadow accent.

## v0.39.20

- **Separación más limpia en la face del plano**: entre contextos y resultados de agentes hay un espacio claro, sin línea divisoria.

## v0.39.19

- **Contextos y resultados de agentes separados**: en la lista de contextos del agente, los contextos normales van primero y los resultados debajo, con un separador visual sutil entre ambos grupos.

## v0.39.18

- **Carpeta de repo al instante tras editar**: al guardar el nombre de carpeta local en Organizaciones, la fila se actualiza de inmediato (sin esperar el refresco) y la meta solo se muestra si hay nombre real (no espacios).

## v0.39.17

- **El chat del agente sobrevive al sync**: el historial se guarda por agente y workspace (no por paneId); al sincronizar o realinear el catálogo no se pierde el transcript. Migra automáticamente los archivos antiguos ligados al pane.

## v0.39.16

- **Editar carpeta de repos del workspace**: en Organizaciones, los gestores
  pueden cambiar o limpiar el nombre de carpeta local de un repo ya vinculado
  (sin quitarlo), y el cambio se guarda en el servidor.

## v0.39.15

- **Sincronizar workspace sin borrar extras locales**: el botón (antes «Actualizar»)
  usa `wipeLocal: false`; trae agentes/contextos del servidor y no elimina los
  locales adicionales. Copy ES/EN: «Sincronizar workspace» / «Sync workspace» y
  detalle de confirmación alineado.
- **Resultados de agente solo en la máquina**: asignaciones `iaterminal:result:*`
  se conservan al sincronizar/materializar y se excluyen al publicar al org.
- **Publicar cambios**: copy «Publicar cambios» / «Publish changes» (antes
  Subir/Upload).
- **Dot de actividad junto al nombre**: en el badge del plano el indicador busy
  va inline tras el nombre (ya no en esquina).

## v0.39.14

- **El nuevo agente ya no ofrece CLIs que no tienes**: la ventana de "Nuevo
  agente" muestra la versión instalada de cada CLI y deja bloqueado el que no
  está en el PATH, en vez de dejarte elegirlo y fallar al lanzar el pane. Lo
  mismo al duplicar un agente, que hereda su proveedor.

## v0.39.13

- **Dot de workspace con agentes en marcha**: la pestaña del workspace muestra
  actividad si cualquier agente dentro está ejecutando, en loop, delegado o
  esperando delegaciones — aunque mires otro pane.
- **Cola del composer sin tapar el chat**: los mensajes en cola quedan en el
  dock inferior, compactos y con scroll, sin cubrir el centro de la conversación.

## v0.39.12

- **Workspaces org en local-first**: agentes y contextos viven en la carpeta del
  proyecto (`.gravity`); al abrir o actualizar se materializan desde el servidor
  al disco, igual que en un workspace personal.
- **Subir cambios al workspace**: managers pueden publicar agentes y contextos
  locales al workspace de la organización con confirmación previa.
- **Actualizar workspace con aviso**: antes de reemplazar lo local por la versión
  remota pide confirmación, para no pisar cambios sin querer.

## v0.39.11

- **Repos org locales con carpeta configurada**: al detectar clones ya instalados
  se respeta el `folderName` del repo (si existe) en lugar del nombre remoto
  original, así no se vuelve a clonar ni se busca la carpeta equivocada.

## v0.39.10

- **Mensaje actual siempre a la vista**: el último mensaje largo del agente o del
  usuario ya no se pliega; solo los anteriores mantienen "Ver más" / "Ver menos".

## v0.39.9

- **El dictado ya no culpa al micrófono cuando fue un clic**: si sueltas el botón
  antes de que dé tiempo a grabar, el aviso te dice que lo mantengas pulsado en
  vez de mandarte a revisar el dispositivo y los permisos de macOS.
- **El error de micrófono mudo ahora trae el dato útil**: muestra el pico de audio
  medido, que distingue entre "no llegó nada" y "entra pero muy bajo".

## v0.39.8

- **Sesiones de agentes seguras en workspaces org**: los workspaces de
  organización ya no guardan ni reutilizan sesiones CLI de agentes entre usuarios.
- **Temas con más profundidad**: paletas oscuras con acentos más notorios y temas
  claros con fondos más cercanos al blanco, menos pastel pesado.

## v0.39.7

- **Errores de clonado que se entienden**: si un repo de organización no se puede
  clonar, el modal dice por qué — SAML SSO pendiente, token caducado, repo no
  encontrado o sin conexión — con botón "Autorizar en GitHub" cuando aplica y los
  detalles técnicos copiables detrás de un desplegable.
- **Respuestas largas plegadas**: los mensajes muy largos del agente se colapsan
  con "Ver más"; al desplegarlos el chat se mantiene pegado al final si ya lo
  estabas.
- **Markdown más completo**: títulos hasta seis niveles, listas anidadas, listas
  de tareas, negrita+cursiva, tachado y código con backticks múltiples. Las
  tablas y listas ya no se rompen si el texto trae líneas en blanco entre filas,
  así que los contextos `.md` escritos a mano se ven como tablas de verdad.
- **Selector Reporte/Fuente centrado**: el control ya no se lee descuadrado hacia
  la izquierda.

## v0.39.6

- **Cards de agentes más sobrias**: monogramas como texto simple y controles de
  drag/reordenamiento estilo ghost, sin borde.
- **Documentación de orquestación**: se elimina el archivo suelto de `docs`; la
  nota vive como contexto interno de la app.

## v0.39.5

- **Cards de agentes más estables**: altura mínima y espaciado para que el dot
  de trabajo y el botón de resultados queden bien posicionados.

## v0.39.4

- **Monogramas en cards de agentes**: las iniciales aparecen a la izquierda del
  nombre en el plano y en loops.
- **Réplicas locales en workspaces org**: las réplicas de delegación no se
  sincronizan al backend; solo los agentes originales se publican al workspace.

## v0.39.3

- **Tema Zelda — Breath of the Wild más evocador**: mezcla fondo profundo,
  azules de cielo y poder Sheikah, verdes de bosque y cafés de naturaleza.

## v0.39.2

- **Micrófono con permisos al día**: cada pulsación del botón de voz vuelve a
  revisar el permiso y lo solicita de nuevo si la app no lo tiene.
- **Workspaces de organización filtrados**: los miembros ven solo proyectos
  asignados al abrir organizaciones o crear una nueva tab; owners/admins siguen
  viendo todo.
- **Delegaciones réplica visibles**: las réplicas aparecen en Waiting con Stop,
  igual que los agentes base.
- **Composer más legible**: badges de agentes y burbujas de queue usan colores
  sólidos, sin transparencias.

## v0.39.1

- **Delegaciones más confiables**: los especialistas ya no se completan con el
  último mensaje viejo antes de empezar el turno nuevo.
- **Subtareas con sesión limpia**: las delegaciones arrancan sin reusar el hilo
  CLI anterior del pane, evitando respuestas de flujos pasados.
- **Estado visual y Stop del plano**: los agentes delegados se marcan en curso
  aunque todavía estén arrancando, y el Stop cancela la delegación correcta.

## v0.39.0

- **Brainstorm acepta voz humana en cualquier momento**: el mensaje entra al
  hilo y los siguientes agentes reaccionan; al pausar o parar no se pierde lo
  que estaba en cola.
- **Turnos cortos del brainstorm** (hasta ~50 palabras en el prompt); si el
  modelo se pasa, se muestra tal cual.
- **Icono de brainstorm más claro** (burbujas de mensajes) en la barra del plano.
- **Orquestador lineal**: espera a que cierren todas las delegaciones antes de
  tomar el siguiente mensaje humano.
- **Orquestador turbo**: puede tomar la cola mientras los especialistas siguen
  trabajando; las olas previas no se abortan y cada job recibe sus propios
  resultados.

## v0.38.0

- **En workspaces org, los customs (notes) ya no se espejan en `.gravity`**:
  viven en la API y llegan al agente por `contextContents`.
- **Los proyectos locales sin org** siguen guardando notes en `.gravity` como
  antes.

## v0.37.0

- **Los contextos custom (notes) de workspaces org llegan al agente** con su
  texto real, no con el stub vacío del `.gravity` local.
- **Results y demás archivos de `.gravity` se escriben en el proyecto**, no en
  el worktree del turno, así el results deja de quedar vacío donde lo miras.
- **Los results ya no se pisan** con el placeholder `(empty agent results)`.

## v0.36.0

- **La app corre sobre un Chromium mucho más nuevo.** Electron 33 → 43 (Chromium
  150): además de las correcciones de seguridad del motor, llegan las mejoras de
  rendimiento y de render de diez versiones de Chrome.
- **Cero avisos de seguridad pendientes.** Se cerraron los 62 que había:
  el lector de hojas de cálculo (que ahora procesa los XLSX que te mandan), el
  actualizador automático y toda la cadena de compilación y empaquetado.
- **La vista previa de un contexto de notas vuelve a mostrar su texto** cuando el
  archivo no trae los marcadores del host, en lugar de decir que está vacío.

## v0.35.1

- **Tooltips del modal Git y del Stop por fila** usan el componente de la app
  (sin `title` nativo).
- **Ajustes de tipado** en la ronda de orquestación y el estilo de trabajo del
  composer.

## v0.35.0

- **El modal Git pone el diff junto a la lista de archivos**; la columna derecha
  muestra solo GitHub Actions (sin pestañas Diff | Actions).
- **La ruta del repo se acorta** a los dos últimos niveles (tooltip con la
  completa).
- **El cuadro de diff aparece solo al seleccionar un archivo** y se oculta al
  deseleccionarlo.

## v0.34.0

- **Stop del composer solo en turno propio** (busy / loop): ya no aparece rojo
  solo por esperar delegaciones.
- **En Waiting, cada especialista tiene su Stop**: cancela solo esa delegación;
  el resto de la ola sigue.
- **Brainstorm en chat con burbujas**, turnos cortos (2–4 frases) y sin
  tools/contextos/skills en el CLI.
- **Sonido al arrancar el dictado** push-to-talk.

## v0.33.0

- **El modal de Ajustes tiene altura fija**: al cambiar de sección ya no crece
  ni se encoge; el panel derecho hace scroll.
- **Más aire bajo el buscador de Ajustes**, separado de la lista de secciones.

## v0.32.0

- **Eliminar contexto pide confirmación** (modal) desde assign, listado y al
  soltar un chip en la papelera.
- **Al arrastrar un contexto** aparece una papelera a la izquierda de los chips;
  soltar ahí abre el mismo confirm y borra.
- **Preview de Custom** muestra cuerpos org o texto plano sin marcadores
  `iaterminal:*` (ya no queda «sin contenido» con texto real).
- **Botón Eliminar** en el modal de asignación del plano.

## v0.31.0

- **Renombrar un contexto en un workspace org ya no crea un gemelo**: se
  mantiene el mismo `contextId` en la API (PUT in-place) con el nombre nuevo.

## v0.30.0

- **El dictado push-to-talk deja de crashear el helper macOS** al arrancar el mic
  (ya no llama `AVAudioEngine.prepare`).
- **Mientras mantienes el micrófono**, un overlay sobre el chat muestra ondas
  reactivas al nivel real del audio y el texto en vivo.
- **Mensajes más claros**: distingue mic sin señal, sin voz reconocida y fallos
  de arranque (ya no todo parece «plataforma»).
- **El indicador Waiting de la ola** pierde el marco tipo caja: texto ligero
  en el stream.

## v0.29.0

- **La preview de contextos Custom (Markdown) muestra el contenido humano**: deja de
  pintar el stub `(manual notes context)` y usa el Markdown de la sección notes.

## v0.28.0

- **El dictado push-to-talk cierra bien al soltar**: el helper macOS espera el
  resultado final en vez de cancelar a medias, y si no hubo voz avisa en lugar
  de no hacer nada.

## v0.27.0

- **El dictado del composer usa el reconocimiento de voz de macOS**
  (`SFSpeechRecognizer`), no la Web Speech de Chromium. Se acabó el error
  «Could not dictate» por `network` en Electron.

## v0.26.0

- **Dictado por voz en el composer (push-to-talk).** Si no hay texto, el botón
  de enviar es un micrófono: mantén pulsado para capturar con el reconocimiento
  de voz del sistema y, al soltar, se envía lo que dijiste.

## v0.25.0

- **Las hojas de cálculo entran como contexto.** Si tu PO entrega las historias
  de usuario en XLSX (o CSV), ahora se elige como tipo de contexto y llega al
  agente como una tabla por hoja, sin convertir nada a mano. Se cortan las hojas
  muy largas y se avisa cuántas filas quedaron fuera.
- **El panel de MCP de cada agente ya se explica solo.** Dice de qué archivo sale
  la lista, avisa cuando tu proyecto declara servidores que ese CLI no lee y a
  dónde hay que copiarlos, aclara que no marcar nada significa *sin acotar* (más
  acceso, no menos) y explica qué hace marcar en cada CLI.
- **Botón para crear el archivo de MCP que falta**, con las carpetas y un
  `mcpServers` vacío, en vez de mandarte a un archivo que no existe. Nunca
  sobrescribe uno que ya está.
- **Los contextos MCP recuperan su ícono propio** en lugar del de terminal.
- **Buscador en Ajustes.** Escribe y salta a la sección: ignora acentos y
  encuentra por etiquetas que no se ven («fuente» lleva a Tipografía, «rich
  presence» a Discord).
- **El modal de Ajustes ya no cambia de alto** al cambiar de sección.
- **El texto del chrome deja de quedarse resaltado** al arrastrar ventanas del
  plano o pulsar chips.
- **Más aire en «New context»**: los títulos de sección se separan de su
  contenido, y la lista de servidores MCP ya no va apelmazada.

## v0.24.0

- **El indicador de ola del orquestador (Waiting X/Y) es más compacto**: título
  y subtítulo en una línea, especialistas en chips horizontales y menos altura.

## v0.23.0

- **Al pulsar un contexto del plano se abre un modal**: fila de agentes para
  asignar o quitar, preview del contenido y botón Editar; ya no hay dropdown.
- **Modo turbo del orquestador es un switch** justo encima de clonar expertos.
- **Sombras más visibles en modo oscuro** en modales y ventanas/terminales.
- **El tema Zelda — Breath of the Wild** gana más color (verde, oro y silent
  princess), no solo celestes.

## v0.22.0

- **El orquestador gana estilo de trabajo Lineal o Turbo.** Lineal espera a que
  cierren las delegaciones antes del siguiente mensaje. Turbo deja seguir
  enviando en cuanto el orquestador queda libre, con olas en paralelo, y fuerza
  clonar expertos a demanda (sin poder apagarlo).

## v0.21.0

- **La barra de contextos del plano vuelve a ser solo íconos**: se quita el
  número de agentes asignados al lado de cada chip; el conteo sigue en el
  tooltip y en el menú de asignación.

## v0.20.0

- **Pulse se divide en dos secciones.** Arriba, «Human in the loop»: tu racha,
  los turnos que dirigiste, los commits y cuántos turnos te toma cerrar uno.
  Abajo, «Agentic engineering»: una fila por agente con sus turnos, sus tokens,
  su reparto Ask/Plan/Auto y su actividad de los últimos 30 días.
- **Pulse se filtra por workspace, repo y rango** (30d / 90d / todo). El heatmap
  se ajusta al rango elegido en vez de mostrar siempre doce meses.
- **Cada agente reporta lo que hizo**: commits que se le atribuyen, duración
  media del turno, delegaciones emitidas y recibidas, resultados escritos y
  turnos disparados por un loop. Lo que todavía no se mide se muestra como
  «sin dato», nunca como cero.
- **Arrastrar un contexto o un resultado al chat lo adjunta a ese turno.** Antes
  caía el id interno como texto dentro del campo; ahora aparece un chip con su
  ícono y su nombre, con ✕ para quitarlo, y se envía solo con ese mensaje sin
  cambiar la configuración del agente. Los resultados de agente se distinguen
  con borde punteado.
- **El editor gana plegado de código, menú contextual y el buscador nativo**
  (buscar/reemplazar con mayúsculas, regex y palabra completa) en lugar de la
  barra «Find in file…».
- **El JSON de los contextos se ve como árbol plegable** en la vista previa y en
  el modal de edición, en vez de una línea por clave.
- **La fuente de interfaz vuelve a aplicarse a toda la app.** Elegir una fuente
  de terminal ya no repinta Pulse, el panel Git, GitHub Actions ni los modales:
  en monoespaciada queda solo lo que es código o salida real.
- **La barra de contexto del plano se lee mejor**: la cuenta de agentes
  asignados va al lado del ícono y ya no lo tapa ni se recorta.
- **El aviso de «no puedes renombrar esta tab» usa el tooltip de la app**, con
  el tema y el retardo del resto, en vez del del sistema operativo.

## v0.19.0

- **Nueva sección Actualizaciones en Ajustes**: activar/desactivar actualizaciones
  automáticas (encendidas por defecto), buscar actualizaciones y forzar la
  instalación si hay una nueva.

## v0.18.0

- **Las réplicas de expertos creadas a demanda se eliminan** al terminar o
  abortar (pane, agente del catálogo y chats); el experto base no se toca.
- **El tema Zelda pasa a llamarse Breath of the Wild** (oscuro y light) con
  paleta actualizada.

## v0.17.0

- **El badge de actualización es más simple**: menos texto en la titlebar; al
  descargar muestra una barra de progreso en lugar del porcentaje en letras.
- **Nuevo tema Zelda — Bosque Profundo** (oscuro y light) en el picker de temas.

## v0.16.0

- **Renombrar una tab de workspace organizacional renombra el workspace en el
  servidor.** El nuevo nombre queda en Covenant, no solo en la pestaña local.
- **Solo pueden renombrar** el owner de la org, un org-admin, el creador del
  workspace o un workspace-admin; si no tienes permiso, ves un error claro.
- **Los títulos de las tabs org se alinean** con el nombre del catálogo/servidor,
  para que lo que ves en la barra coincida con Covenant.

## v0.15.0

- **En workspaces organizacionales, el contexto que arrastras a un agente ya no
  desaparece** al abrir su modal de configuración. Antes un refresh contra disco
  local borraba esas asignaciones.
- **Los results de otros agentes vuelven a verse en el modal**, en su propio
  grupo («Resultados de agentes»), listos para asignarlos.
- **La barra de arriba a la izquierda del plano es una sola pieza**: carpeta,
  loops y el resto de acciones van juntos, más compactos.
- **En el panel Git, elegir un archivo abre el diff al momento** (también si
  pulsas las stats +/-). El visor ya no se queda cargando en bucle al cambiar
  de archivo.

## v0.14.0

- **Los agentes de workspaces organizacionales se guardan de verdad en Covenant.**
  Al pulsar Listo en la configuración, la app espera el `PUT` al servidor; si
  falla, el modal no cierra y muestra el error. Ya no se finge éxito solo en
  memoria ni se escribe en `.gravity/agents` local.
- **Sin modo Ask.** Permisos del agente: solo Auto y Plan (Ask pasa a Auto).
- **Crear equipo vuelve bajo el logo.** En un tab vacío, debajo de Gravity
  aparece el botón para montar el equipo por defecto — en workspaces
  personales y organizacionales.
- **La barra de contextos del plano es solo íconos.** El nombre se ve al abrir
  el menú de asignación. Arriba del chat ya no hay picker de contextos: la
  asignación vive en el pool del plano.
- **Más claro el menú del modal de agente.** Las categorías del sidebar
  (Quién es / Cómo funciona) se leen más chicas que los ítems.
- **Clic fuera cierra el modal de editar contexto.**

## v0.13.0

- **La app se ve con tu fuente.** Ajustes → Apariencia estrena *Tipografía*, con
  un selector para la interfaz —menús, paneles y chat de agentes— y otro para
  las terminales, que arrastra también al editor y a los bloques de código. El
  cambio entra al momento, sin reiniciar, y «Predeterminada» devuelve las de
  siempre.
- **También la que compraste.** Bajo cada selector hay un campo donde escribir
  el nombre exacto de cualquier familia instalada —Comic Code, Berkeley Mono,
  MonoLisa…—, porque ninguna lista va a tenerlas todas. Te avisa si el nombre
  no está en el equipo, y en la de terminal si la fuente no es monoespaciada y
  va a descuadrar el cursor.
- **El desplegable solo enseña lo que tienes instalado**: comprueba una a una
  las fuentes del catálogo y esconde el resto, así que no eliges algo que luego
  no se aplica.
- El menú contextual del explorador pedía una fuente que no existía en la app y
  se pintaba con la que tocara.

## v0.12.0

- **El panel Git ya no está atado a un solo worktree.** Si el repo tiene varios,
  aparece un selector arriba a la izquierda con todos ellos —el principal
  primero, cada uno con su rama— y al elegir uno el estado, la lista de
  archivos, el diff y GitHub Actions pasan a ese worktree. Revisar qué tocó cada
  agente ya no obliga a cambiar de carpeta ni de pestaña.
- **La pestaña se queda donde está.** El selector solo cambia lo que inspeccionas:
  tus terminales, el explorador y los agentes siguen en la carpeta de siempre.
- **Los desplegables dejan de recortar.** El panel de los selectores usaba el
  ancho del botón, así que las opciones largas acababan en puntos suspensivos;
  ahora ese ancho es el mínimo y el panel crece con su contenido.

## v0.11.0

- **El explorador ya no solo abre texto.** Haz clic en un PDF, una hoja de
  cálculo, un documento de Word o una imagen y se ven, ahí mismo, sin salir a
  Finder. Hasta ahora cualquiera de esos archivos era un callejón sin salida
  que solo ofrecía "Mostrar en Finder".
- **Cada formato con su vista.** Los PDF usan el visor del propio Chromium; los
  `.xlsx`, `.xls` y `.ods` salen como tabla con una pestaña por hoja; los
  `.docx` se convierten a texto con sus títulos, listas y tablas; las imágenes
  (png, jpg, gif, webp, bmp, ico, avif) van sobre un tablero que deja ver la
  transparencia real; el Markdown se ve renderizado, el SVG dibujado y el HTML
  como lo pintaría un navegador.
- **Vista o Fuente, tú eliges.** Los formatos de texto —Markdown, HTML, SVG,
  CSV— ganan un control en la cabecera para saltar entre lo renderizado y el
  código, y editarlo sigue funcionando igual. Los binarios no lo muestran: su
  "fuente" no significa nada y tocarla los rompe.
- **Los CSV y TSV se editan como una hoja de cálculo.** Clic en una celda,
  escribe, Enter. Los números se guardan exactamente como estaban: un
  `9007199254740993` o un `3e-06` no se redondean ni se reescriben al tocar
  una celda de al lado.
- **Plegar todas las carpetas de una vez**, con un botón nuevo en la barra del
  explorador.
- **El ojo para las carpetas pesadas sale a la barra.** Mostrar u ocultar
  `node_modules`, `.git`, `dist`, `build` y compañía estaba escondido en el menú
  contextual; ahora se ve el estado de un vistazo y el tooltip dice exactamente
  qué esconde.
- **Tres plantillas de agente más**: product owner, backend y frontend, junto a
  tech lead, revisor e implementador. Siguen rellenando rol, objetivo y reglas
  solo mientras están vacíos.
- **Se arregló el "Could not load" al abrir un archivo.** Si cambiabas la
  carpeta raíz, la cabecera pasaba a la nueva pero el árbol seguía mostrando el
  contenido de la anterior, así que al abrir cualquier cosa buscaba una ruta que
  no existía.

## v0.10.0

- **El editor de archivos ya entiende el código, no solo lo colorea.** Abre un
  `.ts`, `.rs`, `.cs` o `.java` desde el explorador y tienes ⌘-clic para ir a la
  definición, ⌥⌘-clic para ver todas las referencias en un panel, hover con la
  firma y la documentación, F2 para renombrar un símbolo por todo el proyecto,
  errores subrayados según los ve el compilador de verdad, la bombilla del
  margen para aplicar su corrección, y autocompletado que sabe qué existe en
  lugar de repetir palabras que ya están en pantalla.
- **Ir a la definición cruza de archivo.** Si el símbolo vive en otro fichero
  del proyecto, el explorador lo abre y salta a la línea. El renombrado también
  cruza: cuando toca más de un archivo te dice cuántos antes de tocar nada.
- **Los servidores se bajan solos, cuando hacen falta y con tu permiso.** Al
  abrir el primer archivo de un lenguaje, el editor te dice qué va a descargar y
  cuánto ocupa, y no baja nada hasta que aceptas. Se verifica el hash de lo
  descargado antes de instalarlo.
- **Si falta Java o .NET, te dice dónde está.** En vez de fallar en seco, busca
  la versión que sí sirve en los sitios donde suele instalarse y te da el
  `export PATH=…` exacto para dejarla a mano, o el `brew install` si no hay
  ninguna. Un botón vuelve a comprobar sin reiniciar la app.
- **Todo esto se apaga y se gestiona desde Ajustes → Avanzado**, donde ves qué
  servidor tienes instalado, cuánto ocupa en disco y puedes borrarlo o
  instalarlo por adelantado. Nada de esto habla con ningún servicio externo: los
  servidores corren en tu máquina.
- **El árbol de archivos ya no parpadea.** Al expandir una carpeta se vaciaba
  entero y se repoblaba acto seguido, con un "Empty folder" de por medio, y con
  la raíz en una carpeta con movimiento —tu home, por ejemplo— eso se repetía
  solo, sin tocar nada, porque cualquier escritura de fondo de otra app
  disparaba una recarga. Ahora expandir no toca lo ya cargado y los cambios de
  carpetas que no tienes abiertas se ignoran.
- **En Pulse, las cifras grandes dejan de desbordar la tarjeta.** Por encima del
  millón se abrevian (52M) y el número exacto vive en el tooltip. El detalle de
  cada día del mapa de calor pasó del renglón de abajo a un tooltip anclado a la
  celda que estás mirando.

## v0.9.0

- **Gravity ya sabe cuánto la usas.** Hay un botón nuevo en la barra del plano,
  junto a Loops: abre **Pulse**, un panel con tu racha de días activos, los
  prompts de hoy comparados con tu media de los últimos treinta, el total de
  prompts, de commits y de tokens, y un mapa de calor de los últimos doce meses
  que puedes mirar por prompts, por commits o por los dos a la vez. Hasta ahora
  la app no guardaba ni una sola medición: lo único que contaba vivía en memoria
  y se perdía al cerrar.
- **Empieza en cero, a propósito.** No importa historial de ningún sitio, así
  que el panel estará vacío hasta que envíes tu primer prompt o hagas tu primer
  commit desde la app. No es un fallo: es que la cuenta arranca hoy.
- **Nada de esto sale de tu máquina.** Los eventos se guardan en un fichero
  local junto al resto de tu configuración. No hay envío a ningún servidor, ni
  hace falta estar identificado para que Pulse funcione.
- **El mapa de calor se tiñe con el acento de tu tema**, no con un verde fijo,
  y usa la variante que ya viene ajustada para que se lea en los temas claros.
- **Los selectores de contexto y de agente dejan el checkbox del sistema.** El
  azul lo pintaba el SO, así que sobrevivía intacto a los quince temas y gritaba
  más que el acento; ahora el estado lo lleva la propia fila, con icono por tipo
  y un contador n/total en cada cabecera de grupo.
- **En el pool de contextos el monograma pasó a ser el control**: relleno
  significa que el agente lo lee, hueco que no, y el tipo deja sitio al
  contador. La botonera del composer pierde la caja y el cristal: los chips van
  sueltos.

## v0.8.8

- **El panel git ya enseña qué cambió.** Hasta ahora te pedía un mensaje de
  commit para algo que no podías ver: el diff solo existía para la IA. Clic en
  cualquier archivo y su diff aparece a la derecha, con las líneas numeradas y
  coloreadas. Los que aún no están en git se enseñan enteros, como altas, en
  vez de salir en blanco.
- **Lo que entra en el commit está separado de lo que no.** La lista plana de
  antes se partió en dos secciones, "En el commit" y "Sin preparar", cada una
  con su total de líneas. Ya no hace falta la frase que avisaba de que no había
  nada preparado: se ve.
- **Los estados dejaron de ser jeroglíficos.** Aquellos `??`, `M ` y ` M` en
  crudo ahora son una letra con color —añadido, modificado, borrado,
  renombrado, sin seguimiento, conflicto— y el código original sigue ahí, en el
  tooltip. Las rutas muestran también su carpeta, así que dos `index.ts` de
  sitios distintos ya no se ven iguales.
- **Se pueden descartar los cambios de un archivo** sin salir al terminal,
  detrás de una confirmación que dice si va a volver a HEAD o a borrarlo del
  disco, que no es lo mismo.
- **La caja de commit ya no se va con el scroll.** Se quedó anclada abajo, con
  el resumen de lo que va a viajar ("3 archivos · +128 −34"), ⌘↵ para
  confirmar y un botón de commit + push. Si el commit falla, el mensaje que
  escribiste sigue ahí.
- **Pull y push dicen cuántos commits van y vienen** (`↑2 ↓0`), en vez de ser
  dos botones mudos, y push se apaga cuando no hay nada que subir.
- **Con muchos archivos hay un filtro**, y la lista se recorre con las flechas.
- **GitHub Actions deja de ocupar un tercio del panel** en repos que no son de
  GitHub: esa pestaña solo aparece cuando el remoto lo es.
- **El resultado del último comando aparece junto al botón que lo lanzó**, en
  una línea con ✓ o ✗ que se despliega si quieres la salida completa, en vez de
  apilarse al final del scroll donde nadie miraba.
- **Los tooltips son los de la app en todas partes.** Quedaban sitios con el
  gris del sistema, con su medio segundo de retardo y su tipografía ajena al
  tema; ahora todos son la burbuja de Gravity, y un chequeo en el build impide
  que vuelvan a colarse.
- **El scrollback restaurado ya no arrastra el prompt del shell muerto**: al
  reabrir una terminal salía pegado el prompt de la sesión anterior, como si
  hubiera algo escrito.
- **El selector de contextos enseña iconos de marca** (Jira, Atlassian, Port,
  MCP) en vez de un genérico para todo.
- **La lista de repos bajo el composer se revalida contra el disco**, así que
  ya no ofrece carpetas que ya no existen.

## v0.8.7

- **Réplicas de expertos opcionales.** El orquestador / product owner puede
  activar `allowExpertReplicas` para spawnear una copia del especialista cuando
  el pane base ya está ocupado, en paralelo y con su propio worktree.
- **Worktree-first sin pisar el cwd.** Cada delegación lleva worktree dedicado;
  con el flag en OFF, dos encargos al mismo agente en el mismo batch se
  serializan en FIFO: la segunda espera a que la primera termine y limpie el
  override antes de arrancar.
- **UI de awaiting en la ola.** Mientras el orquestador espera, se ve el
  progreso (quién corre, réplica, hint de worktree) en el indicador de
  delegación del plano y del chat rápido.

## v0.8.6

- **Los contextos ya no hay que arrastrarlos.** La barra de arriba a la derecha
  del plano dejó de ser una fila de iconos sin nombre: cada contexto muestra
  cómo se llama y a cuántos agentes se lo diste. Un clic abre la lista de
  agentes con casillas, así que se lo puedes dar a varios de una vez, sin
  cruzar el plano con el ratón. Arrastrarlo hasta un agente sigue funcionando
  igual, y "Editar" quedó al pie de esa misma lista.
- **La barra se recorre con el teclado.** Antes cada icono era una parada de
  tabulador y asignar exigía ratón sí o sí; ahora la barra entera es una sola
  parada y te mueves entre contextos con las flechas.
- **Al arrastrar un contexto ya no sale el recuadro blanco** de esquinas rectas
  detrás del chip.
- **La botonera del composer habla un solo idioma.** Contexto, Autoactualizar y
  loop se dibujaban distinto siendo lo mismo; ahora los tres comparten forma:
  apagado se ve como un fantasma neutro, encendido se rellena con el color de
  acento, y el botón de borrar la conversación se fue detrás de un separador
  para no tenerlo pegado al resto. El loop activo gira su icono en vez de
  parecer deshabilitado, y lo que sí está deshabilitado lo dice en el tooltip
  en vez de quedarse mudo.
- **"Self-improve" ahora se llama "Autoactualizar"**, que es lo que hace:
  actualizar las anotaciones de los contextos, no mejorar el prompt.

## v0.8.5

- **La app arranca con su propia animación.** En vez de una ventana en negro
  mientras carga, aparece la misma masa central con materia en caída libre que
  ya vive en el centro del plano. Toma los colores del tema que tengas puesto y
  respeta "Reducir movimiento" desde el primer fotograma.
- **Salir vuelve a preguntar.** Con terminales o agentes en marcha, cerrar la
  ventana (o ⌘Q) abre una confirmación que dice cuántos hay antes de cortarlos.
  La sesión, las pestañas y los scrollbacks se guardan igual al salir. No
  pregunta si no hay nada corriendo, ni mientras se instala una actualización.
- **⌘, abre Ajustes** (Ctrl+, en Windows y Linux), desde donde estés, incluida
  la terminal. Es el atajo que el aviso del token de GitHub ya prometía.
- **Buscar actualizaciones a mano**, en Ajustes → Novedades, para no depender
  del chequeo automático. Si hay versión nueva la instalas desde la titlebar,
  como siempre.
- **Ajustes → Developer**, para relanzar la animación de arranque y ver la
  confirmación de salida sin cerrar nada.

## v0.8.4

- **Ya no queda ningún tooltip del sistema.** El botón de resincronizar y los
  chips de repositorio del composer eran los dos últimos que seguían sacando el
  recuadro gris con retardo; ahora usan la burbuja de la app, como el resto.

## v0.8.3

- **Acotar skills y MCP ya no es solo cosa de Claude.** Se revisaron los nueve
  CLIs y cada uno acota por donde puede: Pi y Kimi aceptan la lista de skills
  permitidas, Opencode sabe apagarlas pero no elegirlas (y el modal lo dice, en
  vez de ofrecer una lista que no haría nada), Gemini acepta la lista de
  servidores MCP y Copilot la aplica al revés, apagando los que no están.
  Cursor, Hermes y Codex siguen sin poder, con el motivo a la vista.
- **Ojo si usas Pi, Kimi u Opencode:** ahora un agente sin skills configuradas
  arranca sin ninguna, igual que ya pasaba con Claude. Si las quieres, enciende
  el interruptor en Agente → Capabilities.
- **Contexto nuevo: servidores MCP.** Materializa el `.mcp.json` del proyecto
  con una sección por servidor, para que el agente sepa qué tiene a mano. Nunca
  escribe el valor de un token: de `env` y `headers` solo salen los nombres.
- **La ruedita y el "+" de contextos usan el tooltip de la app**, el mismo que
  los chips de al lado, en vez del recuadro del sistema.
- **El terminal ya no queda con líneas en blanco al expandirlo.** El reajuste
  que se hacía al abrir se perdía durante la animación del morph.

## v0.8.2

- **Fix: los agentes de workspaces organizacionales ahora se cargan desde el backend al reiniciar (antes aparecían como Claude Code).** Nuevo modal de carga durante la sincronización. Se unificó la lógica de muestreo de agentes y contextos.

## v0.8.0

- **Cada agente lleva sus propias skills y servidores MCP.** En la ficha del
  agente se elige qué skills de plugin y qué MCP puede usar; lo que no está en
  la lista no llega al CLI. No poner lista significa ninguna, no todas: el
  default es el que no cuesta tokens. Los proveedores sin flags verificados
  enseñan el control desactivado con el motivo, en vez de prometer un acotado
  que luego no se aplica.
- **Contextos de tipo skill.** Un `SKILL.md` se adjunta como contexto y se parte
  por sus encabezados, como cualquier markdown.
- **La vista previa de un contexto se ve renderizada.** El modal abre en "Vista"
  —markdown, sin los marcadores del formato— y "Fuente" enseña el `.md` tal
  cual. El modal además creció para que la previa respire.
- **Contexto nuevo desde el plano.** Un botón "+" abre directamente el
  formulario de creación, y la ruedita ya tiene tooltip.
- **Tablas en el chat.** El markdown del chat renderiza tablas con su propio
  scroll horizontal, y las notas del reporte de contexto se ven con el mismo
  markdown que el cuerpo en vez de como texto plano.
- **Se ve lo que cuesta un turno.** Las métricas de contexto salen del evento
  real del CLI y suman también los tokens que caen en caché, que es donde va el
  preámbulo.
- **Discord Rich Presence.** Ajustes → Avanzado → Discord, apagado por defecto.
  Publica el nombre del workspace, cuántas sesiones hay y si un agente está
  trabajando; nunca comandos, rutas, títulos ni salida.
- **"Novedades" se abre sola al actualizar.** Cabecera con la versión y, cuando
  el release no trae notas, un estado vacío con enlace a GitHub en vez de una
  URL pelada.
- **Renombrar un contexto cambiando solo mayúsculas ya funciona.**

## v0.6.8

- **Los botones de crear terminal y agente vuelven a las esquinas.** En el plano
  agéntico, el flotante de terminal queda abajo a la izquierda y el de agente
  abajo a la derecha, en vez de apilados en el mismo sitio.

## v0.6.7

- **El modal de contextos, rediseñado.** Pasa a dos paneles —edición a un lado,
  vista previa al otro—, los tipos se agrupan por quién escribe el cuerpo (el
  host o tú) en un único selector, el icono y el color se pliegan cuando no los
  tocas y ahora se ve el presupuesto que ese contexto consume en un envío.
- **Se acabaron los cambios que se perdían sin avisar.** Cerrar el modal o
  cambiar de contexto descartaba ediciones en silencio, y guardar tampoco era
  siempre explícito. Ahora el cierre pregunta y las dos acciones están a la
  vista.
- **Mostrar en Finder para el `.md` del contexto.** Disponible en cuanto el
  fichero existe en disco.
- **El modal ya no se queda sin salida.** En ventanas bajas no se podía llegar a
  los botones porque no scrolleaba, y ciertos estados dejaban el diálogo sin
  forma de cerrarlo.
- **Un repo que falla ya no tumba la sincronización entera.** Al arrancar, cada
  repo y cada agente de un workspace de organización se sincroniza por su
  cuenta.

## v0.6.6

- **Los repos de un workspace de organización se ponen al día al arrancar.**
  Si alguien añadía o quitaba repos desde otra máquina, la lista local se
  quedaba como estaba hasta volver a entrar al panel de organizaciones.

## v0.6.5

- **Borrar un agente de organización ahora es definitivo.** Desaparecía de la
  lista pero volvía al recargar. También se acotó el resaltado del acordeón, que
  se comía filas que no tocaban.

## v0.6.4

- **Restaurar la sesión ya no duplica agentes ni contextos.** Al abrir la app
  con pestañas de workspaces de organización, cada una volvía a cargarlos y
  aparecían repetidos.

## v0.6.3

- **Los workspaces de organización traen sus repos.** Se les puede fijar una
  carpeta por defecto, añadir repositorios por URL de git —clonados con tu
  token— y al abrir el workspace se cargan sus agentes y contextos. Los
  workspaces se editan en un acordeón, asignar personas es más directo y ya no
  se cuelan repos duplicados.
- **Abrir una pestaña nueva no espera a la red.** ⌘T comprobaba tus
  organizaciones y workspaces contra el servidor cada vez; ahora se cachean.
- **Se ve cuándo un agente está delegando.** El chat lo indica mientras el
  orquestador reparte subtareas, en vez de parecer parado.
- **«Descartar cambios» en Ajustes hace lo que dice.** Revierte al estado de
  apertura, lo persiste y avisa de que lo ha hecho.
- **Barra del plano reordenada:** abrir carpeta, explorador, git, loops y
  brainstorm, en ese orden.

## v0.6.2

- **Se acabaron los tooltips nativos.** Los cuadros amarillos del sistema
  aparecían con retardo, se quedaban colgados al mover el ratón entre paneles y
  no seguían el tema. Los controles que los usaban se apoyan ahora en su propia
  etiqueta o en el tooltip de la app.
- **Organizaciones, en español.** Quedaban etiquetas sin traducir en el panel de
  organizaciones — los contextos globales, la invitación a iniciar sesión y los
  campos de miembro y de contexto — que aparecían en inglés aunque tuvieras la
  interfaz en español. También la barra de contextos del chat.

## v0.6.1

- **El panel de organizaciones se navega.** Pasa a maestro-detalle: la lista de
  organizaciones queda a un lado y el detalle se reparte en pestañas
  —Workspaces, Miembros, Admins y Contextos— en vez de apilarlo todo en una
  columna.
- **Los desplegables se cierran al elegir.** Pulsar una opción cerraba el menú y
  volvía a abrirlo en el acto: el click atravesaba el popover y caía sobre el
  propio botón que lo despliega. Afectaba a todos los desplegables de la app.
- **Los agentes y contextos de un workspace de organización ya no se pierden.**
  Guardar exigía una carpeta de proyecto local, así que una pestaña respaldada
  sólo por la organización no persistía nada. Ahora se guardan contra el
  workspace.

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
