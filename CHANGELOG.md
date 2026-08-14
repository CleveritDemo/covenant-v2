# Changelog

El contenido de cada sección `## vX.Y.Z` acaba en dos sitios: en la página del
release de GitHub y, vía `latest*.yml`, en el modal "Novedades" del auto-updater
de la app. Escríbelas pensando en quien las va a leer desde la titlebar.

## v0.58.0

- **Pulse ahora se abre como vista a pantalla completa del plano en vez de modal**, con Escape para cerrar.
- **Abrir Pulse, el mapa de wiki o una sala cierra automáticamente a los otros dos**, así nunca quedan dos superpuestos.

## v0.57.0

- **El agente se reconoce igual en las tres vistas**: la tarjeta del plano es ahora la misma que se sienta en una sala y la que habla en ella. Monograma, marca del CLI, chip de orquestador y los contextos que trae leídos —con su icono y su color— en lugar de tres dibujos distintos del mismo agente.
- **Los contextos del invitado, en fila**: al convocar una sala se veían como texto corrido y cortado («Front Rules · Workspace logic · AI…»). Ahora cada uno es una fila con su icono, así que se ve de un vistazo con qué material se sienta cada quien.
- **El estado dice qué hace ese agente aquí**: «sin asiento» y «turno 2» al convocar; «hablando · 2/4» y «done · 4/4» en la sala viva, con el contador dentro del estado en vez de en otra esquina.
- **Fix la última línea del turno se cortaba**: la tarjeta de la sala viva tenía tope de alto, y con los contextos dentro lo primero en caerse era justo la frase con la que se quedó el agente.
- **Fix el velo del asiento se cortaba en el borde**: abrir un asiento atenuaba el acta pero dejaba la columna de asientos —y el canto de su borde— por encima. Ahora atenúa las tres columnas por igual.

## v0.56.0

- **Alta de sala en una frase**: la configuración deja de ser cinco paneles repartidos en tres columnas y pasa a leerse como una frase editable —«Quiero que Karl y María me den ideas en unos 5 min, leyendo CT-133»—. Cada palabra resaltada abre su control debajo, y la frase ya viene respondida: se puede arrancar sin tocar nada.
- **Las plantillas dejan de ser lo primero**: las once ceremonias viven dentro de la decisión que reemplazan, la salida, y se presentan por para qué sirven en vez de por su nombre de manual. La conversación abierta pasa a ser cuatro formatos con nombre propio: ideas, decisión, plan y crítica.
- **Duración en tres paradas**: rápida, equilibrada o a fondo, con las rondas y los minutos estimados a la vista, en lugar de un desplegable con un número sin unidad.
- **Un solo aviso de lo que falta**: «faltan participantes» salía dos veces y escribir el objetivo no se avisaba en ningún lado. Ahora se dice una vez y entero, y ese mismo hueco pasa a mostrar el coste cuando ya no falta nada.
- **El borrador sobrevive a cerrar el módulo**: tocar el toggle sin querer ya no cuesta el objetivo, los invitados ni el material. Se limpia al arrancar la sala o al cambiar de proyecto.
- **La espera del turno se puede leer**: entre conceder el turno y la primera palabra pueden pasar treinta segundos. En vez de una línea fija, una tarjeta con el reloj, el material que está leyendo y tres pasos que avanzan con hechos: turno preparado, CLI arrancado, escribiendo.
- **Lo que el turno escribe en el wiki, como tarjeta**: el JSON de las ops ya no aparece en mitad de la conversación. Se ve qué páginas tocó y de qué tipo, y pulsar una la abre; si no está en el wiki, lo dice.
- **Todos hablan el mismo idioma**: el turno pedía la respuesta sin fijar idioma, así que una sala podía salir mitad en español y mitad en inglés. Ahora responden en el idioma del objetivo.
- **La sala se ve trabajando**: spinner mientras el turno está en marcha y las mismas partículas que el piso del plano enciende cuando un agente trabaja.
- **Fix contextos de Jira vacíos**: una issue recién adjuntada nacía sin contenido y así se quedaba hasta el primer turno que la usara. Ahora se rellena al crearla o al abrirla, y los archivos que ya estaban vacíos se curan solos.
- **Fix chips con el id crudo**: un contexto recién creado mostraba `iaterminal:jira:ct-128` en vez de su nombre.

## v0.55.0

- **Asistente de primer uso**: wizard de cinco pasos (bienvenida, CLIs, carpeta, equipo, primer mensaje).
- **Apertura única tras el splash**: se muestra una sola vez cuando termina el fundido de arranque.
- **Relanzable desde Ajustes → Developer**: replay del onboarding sin perder ajustes pendientes.
- **Flush al relanzar**: el replay desde Ajustes confirma el autosave con debounce antes de desmontar.
- **Equipo creado solo si hubo escritura**: el CTA no marca éxito si el bootstrap no creó agentes.
- **Error legible si falla la detección de CLIs**: aviso con reintento en lugar de lista vacía muda.

## v0.54.1

- **Modales wiki al mismo lado del nodo**: nodo a la izquierda abre a la izquierda; a la derecha, a la derecha.
- **Varios modales a la vez**: abrir una página ya no cierra las otras (tope 3; no se evictan).
- **Entrada desde el nodo**: el modal crece desde la proyección del nodo y se acopla al borde.

## v0.54.0

- **Loops: la cadena es la interfaz**: se acabó el asistente Agent→Interaction→Wait. Los pasos viven en una pista, el retorno del ciclo se dibuja con su intervalo, un paso nuevo se añade en línea y el objetivo se edita en la propia fila; mientras la cadena corre se ve el paso activo y el estado de cada agente.
- **Bandeja en el picker de contextos**: lo que el agente carga en cada turno va arriba en chips, y el catálogo se filtra por texto y por tipo en vez de ser una lista plana.
- **Quién consume cada contexto**: cada fila del picker muestra los monogramas de los agentes que ya lo cargan, o el tag «sin usar» si no lo usa nadie.
- **Mapa wiki con implode propio**: al abrir, el canvas del grafo hace el gesto de entrada (scale/blur 2.4s); ya no se incrusta el logo Gravity.
- **Mismo piso que el plano**: el mapa wiki comparte grilla y partículas musicales; las partículas busy del piso no corren con el mapa abierto.
- **Partículas busy del plano**: vuelven a aparecer en el panel principal cuando cualquier agente del plano está busy / loop / delegando.
- **Unir mensajes limpia chips**: el merge une el texto y elimina de la cola (y del espejo del plano) los mensajes absorbidos.
- **Chat oculto con terminal expandida**: si una terminal ocupa la columna central, el stream del quick chat no se superpone al xterm.
- **Pool de contextos**: orden de la barra glass → configurar → crear, con tabindex alineado.
- **Curador wiki**: clear del historial en toolbar propio (no overlay sobre burbujas); respuesta visible vs cuerpos wiki separados en el prompt.
- **Modales de página wiki**: posiciones aleatorias (sin perímetro fijo) respetando dead-zone del curador; cuerpo legible vía texto plano + AiMarkdown.

## v0.53.1

- **Fix rayos wiki en light**: el rayo visual sigue oscuro, pero la PointLight viajera y el wash emissive son blancos y aclaran los nodos al disparar (corrige v0.53.0 que oscurecía nodos en light).

## v0.53.0

- **Rayos wiki en light**: rayo visual oscuro con PointLight oscura viajera y wash emissive oscuro durante firing; los nodos se aclaran al paso de la luz; toggles live dark↔light sin regresión en dark.
- **Toggles por regla de agente**: switch por regla en Rules; las deshabilitadas no van al prompt ni al turno CLI; persisten en el catálogo del agente.
- **Chrome del plano sobre el chat**: barra superior y pool de contextos comparten z-index 210 para quedar siempre encima del chat del plano.
- **Cristal del plano en dark**: `--plane-glass-strong` más translúcido para mejor contraste con el mapa wiki detrás.
- **Tooltip más suave**: transición de aparición del tooltip del kit un poco más lenta y legible.

## v0.52.0

- **Cola del plano sin duplicados**: un turno encolado no aparece dos veces; el × del chip elimina el turno y limpia preferSend asociado.
- **Miniaturas en chips de cola**: las imágenes del composer se muestran como thumbnail data URL en la cola del plano y no se rompen al despachar otros turnos.
- **Vista previa legible en cola**: chips muestran resumen del turno (delegación, follow-up, etc.) en lugar de texto crudo.
- **Unir mensajes por bloques**: merge une runs consecutivos de chips seleccionados, no traga chips de delegaciones intermedias.
- **Turbo sin resúmenes vacíos**: resultados de delegación en turbo muestran texto real del registry, no «(empty response)»; cards con nombre de catálogo y ola `2/∞`.
- **Chat del plano siempre visible**: z-index 200 sobre mapa/wiki; dock wiki no se desmonta al abrir mapa; curador wiki en 400.
- **Historial curador al colapsar**: scroll al colapsar composer wiki; historial colapsado ~10vh.
- **Modales wiki repartidos**: al abrir varias páginas, posiciones iniciales perimetrales (no solo centro).
- **Wiki badges Reciente**: top-10 páginas recientes muestran badge «Reciente» (no «Hoy»).
- **Menú en chips de contexto**: menú contextual en chips del pool de contextos del plano.
- **Pool contextos**: mejoras de asignación y layout del pool en el plano.
- **Curador wiki en config**: preferencias del curador wiki persistidas en AppConfig (electron wikiCurator/wikiStore).

## v0.51.0

- **Modales wiki movibles**: las páginas del mapa se abren en un modal que puedes arrastrar; varias a la vez con posiciones repartidas desde el centro y la posición se guarda al soltar.
- **Ícono del mapa wiki**: el botón de la barra usa el grafo wiki en lugar del cerebro.
- **Más partículas con agente ocupado**: el aurora del composer duplica densidad mientras un agente está en curso.
- **Rayos con luz viajera**: un foco recorre cada arista desde el origen; la escena se oscurece y los nodos brillan al paso de la luz.
- **Nodo origen al disparar**: el nodo que emite rayos gana brillo y un pulso de escala mientras dispara, con o sin música; reduce motion intacto.
- **Curador `/init` reforzado**: el init asegura la wiki en disco, admite hasta 24 operaciones por turno y el prompt pide un catálogo más amplio cuando el repo lo justifica.

## v0.50.0

- **Menos lag al enviar un turno**: el runtime ya no escanea todo el repo con SHA antes del spawn; el changelog se valida con git diff al cerrar el turno.
- **Explorador más liviano mientras corre un agente**: el file watcher se pausa durante el turno y refresca al terminar; Stop libera la pausa sin dejar el watcher colgado.
- **Crear wiki con feedback claro**: spinner mientras carga o crea, overlay de error con reintentar, encuadre automático de cámara al abrir y auto-/init del curador tras el bootstrap.
- **Plano con cristal opaco**: barras, FABs y contextos usan glass sin blur; solo el input del composer mantiene el efecto de cristal.
- **Resync org con fases visibles**: al bajar un workspace org el overlay indica si está clonando repos, agentes, contextos o wiki.

## v0.49.0

- **Rayos del mapa wiki siempre brillantes**: opacidad y luces al máximo en cada disparo; sin atenuación por música ni flicker ambiental.
- **Rayos blancos**: core, halo, glow, flashes y luces puntuales en blanco; nodos conservan color por tipo.
- **Música solo mueve el foco**: cada beat enciende el siguiente nodo origen (sus rayos salientes juntos); la música no cambia el estilo visual de los rayos.

## v0.48.0

- **Menos presión al streamear respuestas**: los deltas del asistente se acumulan ~200 ms antes de actualizar el chat; el texto sigue llegando en tiempo real con menos re-renders.
- **Plano más tranquilo mientras escribe un agente**: el estado publicado al plano se throttlea cada 500 ms en vez de ~150 ms; busy, loops y delegación siguen publicándose al instante.

## v0.47.0

- **Nodos del mapa wiki más volumétricos**: esferas con sombreado real y luces cuando reduce motion está desactivado; con reduce motion el look plano se conserva.
- **Rayos que salen todos juntos desde cada nodo**: cada nodo enciende a la vez todos sus enlaces salientes; sin música el ritmo es aleatorio por nodo; con música del tema, todos los nodos pulsan al beat.
- **Mapa wiki vivo sobre el plano**: grilla y partículas siguen visibles detrás del grafo; fit automático al abrir y picking intacto.

## v0.46.0

- **Guardado de chat con debounce**: el transcript se persiste cada ~500 ms durante streaming, no en cada token; flush al cerrar turno, cambiar de thread o cerrar el pane.
- **Tabs en reposo sin perder terminales**: en tabs inactivos se pausan partículas del plano y el render del chat de agentes; los PTY siguen vivos y al volver al tab la terminal muestra la salida acumulada.
- **Plano liviano en tabs ocultos**: el estado global del plano recibe solo snippet y flags (busy, loop, delegación), no el transcript completo; al volver al tab se re-sincroniza el quick chat.
- **Markdown incremental en streaming**: solo se re-parsea el tramo en vivo; mensajes cerrados no se re-renderizan en cada delta.

## v0.45.0

- **La sala de brainstorming ocupa la pantalla**: convocar una sala, seguirla y releer su acta abrían modales uno encima de otro. Ahora las salas guardadas, el alta y la sala en marcha son tres vistas del mismo sitio, sobre el plano, y la barra de la esquina —carpeta, explorador, git, wiki— sigue a mano en todas.
- **Varias salas a la vez**: puedes convocar una sala mientras otra corre. El botón lleva la cuenta de las que siguen vivas y su desplegable dice en qué ronda va cada una y quién habla. Cerrar la vista ya no detiene nada: la sala sigue y al volver está el acta entera.
- **Escuchar a uno solo**: pulsa un asiento y se abre con sus turnos nada más, como abrir un agente en el plano. Lo que escribas ahí se publica en la sala dirigido a él, así que el acta no se queda con huecos.
- **El orden de habla se arrastra**: los invitados sentados se reordenan arrastrándolos, y ese orden es el turno en que hablan.
- **Un agente puede sentarse en dos salas**: cada sala es una conversación aparte y nada de lo que diga en una llega a la otra. Se avisa al invitarlo, en su asiento y en la cola de turnos.
- **Menos ruido al leer una sala**: al abrirla ya estás al final del acta en vez de recorrerla en un scroll animado, la tarjeta de cierre enseña la decisión y guarda el resto tras un enlace, y cada asiento muestra la última línea que dijo.
- **Se va la mesa de invitados**: sentar agentes arrastrándolos al lienzo era un tercer camino para hacer lo que el alta hace en una pantalla.
- **Saber qué contexto usa cada agente**: el gestor de contextos listaba todos los `.md` del proyecto en un scroll alfabético sin decir quién los carga. Ahora tiene buscador, filtro por agente —con «Sin usar» para los que no lee nadie— y filtro por tipo; cada fila enseña la cara de los agentes que lo cargan, y desde la ficha del contexto se lo aplicas o se lo quitas a cualquiera sin entrar en su configuración.
- **Los selectores de pestañas se ven bien**: el recuadro de la opción elegida se estiraba a lo ancho de su hueco, así que una palabra corta quedaba flotando en medio de un rectángulo enorme, y sus esquinas no encajaban con las del marco. Ahora se ajusta al texto. Se nota en el resultado de una sala, en Pulse, en la configuración de un agente y en el editor de archivos, entre otros.
- **La issue se ve nada más añadirla**: al crear un contexto de Jira desde el gestor, el ticket que acabas de ver en la vista previa ya queda dentro. Antes se guardaba vacío, y si no se lo asignabas a ningún agente seguía vacío para siempre.
- **Buscar issues también al crear una sala**: el buscador de Jira estaba en el formulario de editar una sala pero no en el de crearla, que es por donde se entra. Ahora escribes `#` en el objetivo, eliges la issue, y además de quedar citada se suma al material de la sala.
- **Mencionar issues ya no puede tumbar la ventana**: si la app se quedaba a medias entre dos versiones, abrir un formulario con buscador de issues cerraba el diálogo entero. Ahora el buscador simplemente no aparece y todo lo demás sigue funcionando.
- **La rueda del ratón se queda donde estás mirando**: al desplazar la lista de contextos del plano se movían los agentes del fondo en vez de la lista. Cualquier desplegable con scroll propio se queda ahora con la rueda.
## v0.44.0

- **Curador de la wiki con historial local**: los turnos quedan en un panel scrolleable por proyecto; al limpiar historial desaparece también el bloque vivo y no se duplican errores del CLI.
- **CLI y modelo del curador al alcance**: los selects de proveedor y modelo viven encima del input como pills del plano (misma columna de 640px que el composer de agentes); el popover solo nombre y reglas.
- **`/init` en el curador**: el comando arranca el modo init del prompt para sembrar o rehacer la wiki sin mezclarlo con un turno normal.
- **Indicadores de delegación con nombre del catálogo**: la ola awaiting y el mensaje «Delegado a» muestran nombre · rol del agente (réplicas siguen con tag R2), no el slug interno del JSON.
- **Mapa wiki sobre el plano vivo**: el grafo se monta como overlay del PlaneMap con canvas transparente; grilla, partículas y atmósfera siguen visibles y el stage de ventanas se oculta sin desmontarse.
- **Rayos del mapa que iluminan nodos**: materiales Lambert, luces puntuales por descarga, glow volumétrico y núcleo teñido por el color del nodo de origen.

## v0.43.0

- **Wiki como sustrato index-first en el prompt**: el índice compacto incluye resúmenes por página y la directiva de consultar la wiki antes de explorar el repo.
- **Olvido del bloque wiki al borrarla del disco**: si eliminas `.gravity/wiki`, el contexto wiki deja de inyectarse en los turnos siguientes.
- **Guía de contradicciones en el ingest**: el material de ingest orienta cómo detectar y resolver contradicciones entre páginas.
- **Lint de salud de la wiki para el curador**: páginas huérfanas, links rotos y rutas muertas con resolución monorepo, visibles en el turno del curador.
- **Mapa wiki con encuadre completo al abrir**: la cámara encuadra el grafo entero al montar, sin pisar la navegación posterior.
- **Rayos más pequeños con iluminación no plana**: gradiente por vértice en el núcleo, peak aleatorio por disparo y flicker en core y halo (glow estable).
- **Dispose de réplicas diferido al cierre de ola turbo**: R2/R3 siguen visibles hasta que termina la ola; el cleanup corre en batch en `wave_complete`.
- **Test de partículas determinista**: la grilla 6×6 del mapa usa RNG fijado en el bloque live para evitar flakes en CI.

## v0.42.0

- **Wiki de proyecto en el prompt de todos los agentes**: si existe `.gravity/wiki` en disco, cada agente recibe el índice compacto, el log y el ingest en su contexto, sin que tengas que asignar la wiki manualmente como contexto.
- **En turbo, un mensaje encolado no se ejecuta dos veces**: si el orquestador está ocupado y reenvías el mismo mensaje al liberarse, la cola lo deduplica y no vuelve a correr el turno duplicado.

## v0.41.2

- **Instalar un language server ya te dice qué pasa**: si la instalación falla, el error se ve en la fila en vez de que el botón parezca muerto; y cuando el problema es el runtime (por ejemplo jdtls, que necesita Java 21), la fila avisa la versión que hace falta, la que encontró, dónde tienes una válida fuera del PATH y cambia el botón por Comprobar de nuevo. El aviso de runtime del editor pasa a usar el mismo componente.

## v0.41.1

- **Interlineado de la terminal, a tu medida**: las filas ya no van tan holgadas; el default es cómodo (1.2). En Ajustes → Apariencia → Tipografía puedes pasar a compacto o holgado, y se aplica al momento.

## v0.41.0

- **Cancelar una sincronización o publicación con Espacio**: mientras el workspace de org sincroniza o publica, el overlay dice el atajo y Espacio corta la operación. Lo que llegue después ya no reabre el modal ni con éxito ni con error de wiki, y una operación vieja no puede apagar el aviso de otra más nueva. Vale para los cuatro caminos que sincronizan: sincronizar, publicar, crear la pestaña de org y asignarle carpeta. El clonado de repositorios sigue sin cancelación.
- **Nodos del mapa neuronal sin halo**: cada página se dibuja como una esfera limpia con el color de su tipo, sin la aureola luminosa que la envolvía. Los rayos eléctricos entre nodos y los destellos en los extremos siguen igual.

## v0.40.9

- **El bucle de delegaciones fallidas queda cerrado de verdad**: en 0.40.8 el pane olvidaba el fallo justo al cerrar el turno, así que si el aviso normal se perdía y entraba la reconciliación del especialista parado, la delegación muerta volvía a cerrarse como correcta y el orquestador la repetía. Ahora el fallo describe el turno anterior y sobrevive al cierre: solo lo limpia el siguiente turno o tu stop.

## v0.40.8

- **Una delegación que falla ya no se repite en bucle**: cuando el CLI de un especialista no arranca, el texto del error dejaba de ser un error y pasaba por resultado válido, así que el orquestador volvía a mandar la misma delegación una y otra vez. Ahora el pane publica que el turno murió por fallo, la delegación se cierra como fallida y el orquestador recibe la instrucción de contarlo en vez de reintentar solo. Además, un follow-up ya despachado no vuelve a la cola; si quieres reintentar, basta con pedirlo tú.
- **Se ve cuándo la wiki de org no sincroniza**: si al sincronizar o publicar un workspace la wiki falla, el modal lo dice con el motivo en vez de quedarse callado. Los textos de sincronizar y publicar ahora nombran la wiki junto a agentes y contextos.
- **El fallo al arrancar un CLI se reporta como fallo**: si el proceso muere con código de error y no llegó a hablar, el turno muestra el motivo del arranque fallido y no un turno mudo.

## v0.40.7

- **Los links del chat abren tu navegador**: hacer click en una URL que escribe un agente ya no levanta una ventana de la propia app; ahora se abre en el navegador por defecto del sistema, igual que los links de la terminal. Ninguna ventana nueva puede volver a nacer dentro de Covenant.

## v0.40.6

- **El catálogo +N scrollea de verdad**: rueda sobre la lista de contextos ya no mueve las cards de agentes de detrás; el plano le cede el wheel a ese popover.

## v0.40.5

- **Sin techo de agentes y terminales por pestaña**: crear un agente o un terminal ya no se corta a los diez paneles. Los botones del plano solo se bloquean si falta carpeta de proyecto, el arranque de equipo crea todos los agentes del catálogo y al recargar la sesión no se recorta ningún panel.
- **Cursor deja de pedir confiar en la carpeta**: los turnos headless con Cursor pasan `--trust`, así que ni los agentes del panel ni el curador de la wiki se cortan con el error de carpeta no confiada.
- **Los agentes escriben mejor la wiki**: agentes y curador comparten ahora la misma política de escritura, con ejemplos de cada tipo de página —narrar, localizar, decidir, flujo, inventario—, la obligación de enlazar con [[slug]] y de citar rutas reales de archivo en vez de ensayos largos.

## v0.40.4

- **Si una réplica se queda sin pending ni registry, el pane se cierra igual**: se reconoce por el binding local o el id de la copia. El merge fallido sin conflicto ya aborta el merge en el repo base antes de borrar el worktree.

## v0.40.3

- **Jira, GitHub y Covenant detrás de un proxy corporativo**: en redes con proxy de empresa o inspección TLS, «Conectar» de Jira fallaba con un «Failed to fetch» que no explicaba nada, aunque la misma llamada funcionara desde la terminal. Las llamadas de red de la app ahora usan el proxy y los certificados del sistema, igual que el navegador, y cuando algo falla el mensaje dice el motivo real. Vale también para GitHub Actions, el inicio de sesión de Covenant, el sondeo de servidores MCP y la descarga de servidores de lenguaje.

## v0.40.2

- **Líneas del mapa wiki más visibles**: las conexiones entre nodos se leen claro en ambos modos — 0.55 con reduce motion (única capa de conexiones) y 0.45 sin él, siempre debajo de los rayos eléctricos.

## v0.40.1

- **Wiki de org totalmente sincronizada**: el log se descarga al sincronizar, crear o abrir workspaces de org; el curador, el upload manual del workspace y el CTA del mapa suben cambios al backend; tras reinicio con caché fría se propagan deletes y la entrada nueva del turno sin duplicar (matching multiset con reglas de truncación).
- **Workspaces de org: FABs y conversaciones**: crear terminal o agente usa el cwd efectivo y explica el motivo si sigue bloqueado; se puede pedir una conversación nueva con el agente ocupado sin abortar el turno (se aplica al terminar).
- **Mapa de la wiki**: con reduce motion off, rayos eléctricos iluminan las líneas base; con reduce motion on solo quedan líneas estáticas; al volver de otra pestaña el canvas ya no queda negro y se limpian listeners.

## v0.40.0

- **Jira Cloud, dentro de Gravity**: se conecta el sitio desde Ajustes (las credenciales se guardan cifradas por sitio) y a partir de ahí una issue es un contexto más: se da de alta pegando su clave, se materializa en `.gravity/jira/` con descripción, estado, sprint y los diez últimos comentarios, y se refresca sola cuando el snapshot vence. Tus notas sobre la issue conviven con esa región automática y no se pisan al refrescar.
- **Mencionar issues mientras escribes**: el composer trae un picker de búsqueda para citar una issue sin salir del chat, y el mismo buscador está disponible en las cuatro superficies donde tiene sentido. El chip de la issue muestra su estado y desde cuándo son los datos, sin necesidad de pasar el ratón por encima.
- **Salas de brainstorm**: arrancar una sala cabe en una pantalla, la sala en vivo refleja lo que está pasando de verdad y se puede cerrar con un resumen que no es un telegrama. Un mismo agente puede cubrir varios roles de la ceremonia.
- **La barra de contextos del plano deja de crecer**: mostraba un chip por cada contexto del proyecto y, pasados unos cuantos, los últimos se escondían en un scroll invisible. Ahora enseña hasta seis —primero los que algún agente está usando, marcados con un punto— y el resto se pliega en un botón que abre un buscador con los nombres. Se pueden seguir arrastrando sobre un agente desde ahí.
- **Ver las notas de versión cuando quieras**: Ajustes tiene un botón para abrir el modal de novedades sin esperar a la próxima actualización.
- **La fuente del terminal deja de colarse en el chrome**: cambiarla ya solo afecta al terminal, no al resto de la interfaz.

## v0.39.72

- **Modal de organizaciones reordenado**: los ajustes de la org y el detalle de cada workspace viven ahora en paneles propios, con el estado de cada sección a la vista, para que se entienda de un vistazo qué está configurado y qué falta.

## v0.39.71

- **Pulse deja de listar GUIDs en «Repo»**: los turnos que un especialista hacía en su worktree de delegación se etiquetaban con el identificador de la delegación en vez del repositorio; ahora se atribuyen al repo de verdad, y los que ya estaban mal guardados dejan de ensuciar el selector sin perder su sitio en los totales.
- **El selector de «Workspace» muestra el nombre**: donde antes salía el identificador interno del workspace ahora se lee su nombre.

## v0.39.70

- **Contextos de org aislados por workspace**: notes y demás contextos con el mismo nombre ya no se mezclan entre workspaces distintos.

## v0.39.69

- **Partículas del plano más discretas**: radios base más pequeños para que el campo moleste menos sin perder bandas ni beat.

## v0.39.68

- **Los modelos de Gemini, Opencode y Pi vuelven a listarse**: el selector decía "Proveedor no válido" en esos tres CLIs y encima ofrecía los modelos de Claude. Ahora Opencode y Pi listan los suyos preguntándole al propio CLI, y Gemini trae su catálogo. Codex, Kimi y Hermes se quedan en "Predeterminado", pero ya sin marcar error.

## v0.39.67

- **Tarjetas de ceremonia sin caja**: las once dejan de leerse como parches sobre el panel; ahora solo las separa su banda de etapa, y la elegida se tiñe del acento.
- **Las etiquetas de las salas usan la fuente de la interfaz**: el chrome de las salas y de su lista heredaba la fuente que tengas puesta en el terminal, así que con una fuente manuscrita salía manuscrito.

## v0.39.66

- **Las salas corren ceremonias ágiles**: al crear una sala eliges primero la ceremonia —Three Amigos, Example Mapping, Specification Workshop y siete más— y de ahí salen su objetivo, sus entregables y el gate que decide si la historia queda lista. Brainstorming sigue estando, como conversación abierta.
- **Rol de ceremonia en cada agente**: se elige de una lista, y la sala sienta a quien toca en cada ceremonia. Si un agente no lo tiene puesto, se deduce de su rol escrito y la sala avisa de que lo dedujo.
- **Cierre con el entregable de la ceremonia**: el último turno escribe lo que esa ceremonia pide, y el Specification Workshop muestra el checklist AI-Ready de 11 campos con lo que falta.

## v0.39.64

- **Música en temas Credicorp**: los ocho temas Credicorp usan ahora `default.mp3`.

## v0.39.63

- **Partículas al ritmo del BPM**: se mueven más rápido con tempos altos y mantienen el pulso visual de tamaño y brillo.

## v0.39.62

- **Aspecto abre como modal**: icono y color salen delante de todo con scrim propio, no embebidos en la columna del formulario.

## v0.39.61

- **Aspecto de contextos en popup**: icono y color se eligen en un panel flotante bajo el trigger, sin empujar el formulario; Escape cierra solo el popup.

## v0.39.60

- **Partículas más orgánicas**: aparecen en una grilla 6×6 responsive, con posición aleatoria y sin perder bandas ni beat.
- **Sonido centraliza audio**: música de temas y sonidos del sistema (dictado y fin de agente) viven juntos en Ajustes › Sonido.
- **Picker de temas más simple**: solo enciende o apaga el audio del tema; el volumen queda en Sonido.

## v0.39.59

- **Los sonidos de la interfaz se pueden apagar**: nuevo interruptor en Ajustes › Apariencia › Sonidos de la interfaz que silencia el aviso de fin de turno de agente y el del dictado, sin tocar el audio del tema.
- **Aviso claro cuando un CLI no habla MCP**: en vez de ofrecer herramientas que nunca llegarán, el panel dice qué pasa y qué alternativas hay.

## v0.39.58

- **Partículas musicales más elegantes**: el beat pulsa con envelope suave y las bandas de frecuencia se reparten por toda la pantalla.

## v0.39.57

- **Los agentes ven las variables de entorno del sistema**: abrir Gravity desde el Dock ya no les esconde lo que exportas en tu `~/.zshrc` (claves de API, proxies, ajustes de cada CLI); hasta ahora solo heredaban el PATH y las terminales eran las únicas con el entorno completo.
- **El aviso de dictado deja de repetir el nombre de la app** y la mesa usa la tipografía de la interfaz.

## v0.39.56

- **Rail de adjuntos más discreto**: sin separador vertical, thumbs más chicas (28px) con borde sutil y menos padding para que no agranden el campo.

## v0.39.55

- **Adjuntos del composer más compactos**: los thumbnails van a la derecha del texto, con scroll horizontal y sin subir el dock.

## v0.39.54

- **Theme picker visual**: preview mini Covenant, cards por mood/color y audio compacto dentro del modal.
- **Toolbar/titlebar**: play/pausa integrado en ondas, botones org/settings cuadrados, trigger de temas con Button del kit, reloj entre temas y organizaciones.
- **Composer del plano**: thumbnails de capturas dentro del campo, bajo el texto y centrados.

## v0.39.53

- **Delegaciones en curso se actualizan fila por fila**: la QuickChat del plano ya marca cada agente como terminado sin esperar a toda la ola.
- **Dragon Ball Z ya tiene música**: el tema oscuro y Light usan el nuevo `dragonballz.mp3`.
- **Audio de tema más simple**: la titlebar queda solo con play/pausa; volumen y switch de audio viven en Apariencia.
- **Spotify legacy fuera del schema activo**: se limpian moods/playlists antiguos y sus tests se migran al audio interno.

## v0.39.51

- **Cambiar de tema arranca su música**: si Música está activada, el nuevo tema empieza a sonar aunque el anterior estuviera pausado; al abrir la app no hay autoplay.

## v0.39.50

- **Brainstorm se minimiza sin apagarse**: click fuera lo manda al dock, el botón lo reabre y puedes continuar otra ronda con guía humana.
- **Música interna por tema**: salen Spotify y moods; la titlebar reproduce MP3 locales según el tema y Settings guarda volumen/estado.
- **Más temas y reloj local**: entran Vikings, Ragnarok Online, Metroid, Pokémon, Dragon Ball Z y Saint Seiya con variantes Light; Zelda queda más corto y la titlebar muestra la hora.
- **Sonido al terminar un agente**: `finish.mp3` suena una vez cuando un turno cierra correctamente, sin sonar en abortos ni retries.

## v0.39.49

- **Los agentes de una sala de brainstorm sí pueden usar sus MCP**: el turno heredaba una config vacía, así que decían no tener acceso a Jira.
- **La sala deja de atarles las manos**: se acabaron el tope de 50 palabras y la prohibición de llamar tools; si el turno necesita datos reales, los va a buscar.
- **La mesa tiene más sitio donde soltar**: el dropzone es bastante más alto y arrastrar un agente ya no pide puntería.

## v0.39.48

- **Un MCP remoto ya no dice «lista» si pide login**: si Atlassian (u otro OAuth) responde 401, ves «hay que conectar» y pasos para autenticar en Copilot.
- **El agente con MCP marcados sabe que debe usarlos**: el turno le dice que busque en Jira por esas tools y que no invente que no tiene acceso.
- **Si falta conectar, el chat del agente lo avisa** arriba, sin tener que abrir Capacidades.

## v0.39.47

- **La config de MCP se edita dentro de Covenant**, sin salir a buscar el JSON.
- **Las salas de brainstorm usan un solo icono** (las dos burbujas) en el toolbar, el modal y la context bar.
- **Arrastrar una card a la mesa de brainstorm se ve como se debe**: la card conserva el asa y llega con las esquinas redondeadas.

## v0.39.46

- **El menú del selector se queda pegado al disparador**: al abrir hacia arriba o hacia abajo ya no se va al techo.
- **Un especialista idle se reusa**: aunque tenga chat abierto o hilos extra; spawn solo si está ocupado, en loop, con + pendiente o si pides réplica.

## v0.39.45

- **El espacio entre agentes del plano queda parejo**: cards cortas y largas dejan el mismo aire; la perspectiva 3D ya no deforma los huecos.

## v0.39.44

- **Tus conversaciones no se pisan con las delegaciones**: si estás en un hilo de un especialista, el trabajo del orquestador va a una réplica; el + sigue disponible salvo que ese pane esté en stream.
- **El reporte de resultados se lee como una nota**: desenlace corto, qué pediste y los cambios en lista; el historial ya no es un bloque técnico.
- **Las partículas busy viven en el piso del plano**: misma capa que la grilla, detrás del composer y los paneles.

## v0.39.43

- **El instalador de Windows se publica aunque GitHub TLS falle al re-descargar Electron** (v0.39.42 no llegó a salir por eso).
- **Cada turno inyecta hasta 3 resultados recientes** de los agentes del tab (qué se pidió, qué cambió, resumen), para no saturar el prompt.

## v0.39.42

- **Cada turno inyecta hasta 3 resultados recientes** de los agentes del tab (qué se pidió, qué cambió, resumen), para no saturar el prompt.

## v0.39.41

- **Los agentes del mismo tab se enteran del trabajo reciente**: cada turno inyecta hasta 5 resultados recientes de los compañeros (qué se pidió, qué cambió, resumen), para no repetir trabajo.
- **El registro de resultados es más concreto**: request + cambios de código + summary; el hint de "emitir resultados" lo deja claro.
- **Resume de CLI también en workspaces org**: la sesión Cursor/Claude se conserva en memoria entre turnos; al guardar session.json se quita para no viajar en el snapshot compartido.

## v0.39.40

- **Aurora del composer bajo el glass**: el campo de partículas vive dentro del composer (mismo stacking) y el input usa blur suave; en working se transparenta para leer el campo sin pelear con el texto.
- **Fade del chat sin comer el hilo**: el gap de la última burbuja pasa al scroll; el velo inferior solo cubre clearance + solape corto, sin sumar aire extra al shell.
- **Brand del hero solo en splash**: GravityHeroCanvas deja el wordmark apagado por defecto (animación de entrada con reduce-motion), y los confirms/busy no lo muestran.

## v0.39.39

- **Chip de update con etapas**: el badge de la titlebar muestra available / downloading / restart con motion discreto, y en Developer puedes previsualizarlo sin tocar el updater.
- **Herramientas MCP como estantería**: en Capabilities cada servidor es una fila con estado y acción (añadir al CLI, acotar herramientas), en vez de un muro de texto/JSON.
- **Instalador de Windows en el release**: el setup NSIS vuelve a publicarse con el nombre correcto y el job comprueba que cada `latest*.yml` tenga sus binarios antes de subir.

## v0.39.38

- **Splash espera el plano estable**: el overlay no se va hasta el primer layout listo (con tope y settle breve); al cambiar de tab durante el boot ya no se cuelga.
- **Overlays hero unificados**: salida y estados busy del workspace org usan HeroConfirmOverlay (confirm|busy) sobre GravityHeroCanvas; se elimina QuitConfirmModal.
- **Chat del plano sin tapar el hilo**: clearance del composer medido con ResizeObserver + MutationObserver; fade inferior con overlap clamp; cola visible sin agente y wrap libre en pending-row.
- **Confirmaciones y peligro más claros**: botón danger sólido; quitar default de org pasa a secondary; modal de salida tipográfico con recuento de terminales.
- **Boot más rápido a la UI**: contextos de tab antes de pintar; GC de worktrees y clone de repos org ya no bloquean el splash.

## v0.39.37

- **La mesa de brainstorm ya se ve, se cierra y acepta los agentes**: salió
  coja en la v0.39.34. Quedaba por debajo del chat del plano —el texto del chat
  se leía encima y el cierre no recibía el clic— y arrastrar un agente no hacía
  nada, porque agarrarlo por el asa movía su tarjeta por la columna en vez de
  llevarla a la mesa. Ahora la mesa va por delante, la tarjeta entera se
  arrastra (mientras la mesa está abierta el asa desaparece y el cursor lo
  anuncia), y la ventana lleva la barra de título de siempre, con su botón rojo
  y Esc para cerrar.

## v0.39.36

- **Delegaciones del chat y del plano más claras**: el indicador y el placeholder quedan centrados, sin burbuja sólida, para que se lean como estado y no como mensaje.
- **Adjuntos por encima de agentes y más aire bajo el hilo**: las miniaturas van antes de los badges de agentes, y el dock/quick chat dejan más espacio para que no tapen el composer.
- **Cola y estado visual más discretos**: la cola pendiente y los estados en curso pesan menos, sin competir con lo que escribes.

## v0.39.35

- **Scrollbar más fino y discreto**: la barra de desplazamiento global queda más sutil (2px, sin radio), con menos ruido visual.
- **Publicación segura del release**: el release de GitHub solo se publica cuando los assets de macOS, Linux y Windows están listos.

## v0.39.34

- **Los invitados de un brainstorm se sientan en una mesa, no en una rejilla de
  casillas**: al crear una sala aparece una mesa en el plano, junto a la columna
  de agentes, y arrastras a quien quieras dentro. El número del asiento es el
  orden de habla, así que ya no hay que recordar en qué orden hiciste clic: se
  reordena arrastrando, con ⌘ y las flechas, o sentando desde los chips de
  "Disponibles". El modal queda en un solo paso —tema, rondas y resultado
  esperado— y las réplicas del turbo no se sientan, que es lo que la sala hacía
  por su cuenta al arrancar mientras el contador decía otra cosa.

## v0.39.33

- **Mientras el orquestador arma una delegación ya no ves JSON crudo**: en el stream aparece un indicador “Armando delegación…” (órbita) en cuanto empieza el fence `ia-terminal-delegate`; al terminar el turno el fence sigue oculto como siempre.
- **Las capturas del chat se abren nítidas**: el preview guardado pasa de ~96px a ~1280px (WebP), y el modal de la miniatura usa tamaño `xl` a pantalla completa. Las miniaturas del hilo siguen pequeñas; los mensajes viejos con thumb 96px no cambian solos.
- **Las tablas del markdown del agente se leen sin romperse**: el wrap scrollea en horizontal, anchos por contenido, headers y código en `nowrap`, celdas sin heredar cortes raros.
- **La cinta del composer del plano cobra vida al trabajar**: partículas aurora cuando hay busy / loop / delegaciones en curso; idle más sobrio.
- **Burbujas del asistente y tarjetas de delegación sin marco**: se quita el filo izquierdo; el estado de la tarjeta de resultado vive en el label, no en un borde.
- **ChatBubble unificado**: el stream sigue transparente; la variante solid (tipografía chica, delegación y assembling) usa `color-mix` de surface al 70% con transparente.
- **El plano respira bajo el stage**: partículas ambientales lentas en el PlaneMap; se apagan con `prefers-reduced-motion`.

## v0.39.32

- **Mientras el orquestador arma una delegación ya no ves JSON crudo**: en el stream aparece un indicador “Armando delegación…” (órbita) en cuanto empieza el fence `ia-terminal-delegate`; al terminar el turno el fence sigue oculto como siempre.
- **Las capturas del chat se abren nítidas**: el preview guardado pasa de ~96px a ~1280px (WebP), y el modal de la miniatura usa tamaño `xl` a pantalla completa. Las miniaturas del hilo siguen pequeñas; los mensajes viejos con thumb 96px no cambian solos.
- **Las tablas del markdown del agente se leen sin romperse**: el wrap scrollea en horizontal, anchos por contenido, headers y código en `nowrap`, celdas sin heredar cortes raros.
- **La cinta del composer del plano cobra vida al trabajar**: partículas aurora cuando hay busy / loop / delegaciones en curso; idle más sobrio.
- **Burbujas del asistente y tarjetas de delegación sin marco**: se quita el filo izquierdo; el estado de la tarjeta de resultado vive en el label, no en un borde.

## v0.39.31

- **Las réplicas del turbo ya se distinguen entre sí**: cuando el orquestador
  clona a un experto ocupado, la copia conserva su nombre —Frontend sigue
  siendo Frontend— y se marca con el número que ya lleva por dentro: **R2**,
  **R3**, en ámbar de "esto es temporal". El experto original muestra **+2**
  mientras haya copias suyas trabajando. Antes todas se llamaban "Frontend
  (replica)" y no había forma de saber cuál era cuál, ni en las tarjetas del
  plano, ni en los chips del chat, ni en la lista de espera.
- **El confirm de borrar un contexto vuelve a verse**: quedaba por debajo del
  listado "Contextos de este workspace", así que la papelera parecía no hacer
  nada.

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
