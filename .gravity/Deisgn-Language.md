# Deisgn Language
<!-- iaterminal:context {"version":1,"id":"iaterminal:notes:Deisgn-Language","name":"Deisgn Language","fileName":"Deisgn-Language.md","kind":"notes","icon":"sparkles","color":"#fb7185"} -->

<!-- iaterminal:auto -->
(manual notes context)
<!-- /iaterminal:auto -->

<!-- iaterminal:notes -->
Lenguaje de diseño Gravity
Nombre
Consola de orquestación — interfaces donde el usuario dirige y los agentes ejecutan, con calma y foco.

Propósito
Diseñas cualquier componente o pantalla de Gravity.

Gravity convierte al usuario en orquestador de agentes autónomos: él dirige; ellos ejecutan.

Toda interfaz debe ayudar a llegar al objetivo con foco y sin perder tiempo.

Principio rector
El control del usuario manda; la ejecución se percibe, no compite.

Intención, decisión y acción del usuario tienen prioridad visual.

El trabajo de los agentes y las herramientas informan estado y están al alcance, sin robar el foco.

Sensación: calma con poder — claro, práctico, sin distracciones.

Pilares del lenguaje
| Pilar | Significa |

|--------|-----------|

| Mando | Siempre se entiende qué puede hacer el usuario ahora |

| Presencia | Lo que ejecuta tiene identidad y estado legibles |

| Foco | Una idea y una acción primaria por vista |

| Quietud | Neutros, poco acento, movimiento solo con motivo |

| Oficio | Copy corto y directo; sin tono de formulario administrativo |

Sistema visual
Espacio

Respiración generosa donde manda el usuario; densidad mayor donde solo se informa.

Separar con espacio o borde fino, no con cajas ruidosas.

Superficie

Canvas neutro.

Paneles sobrios.

Elevación solo cuando algo se superpone al flujo (diálogo).

Sin sombras de adorno ni brillos vacíos.

Color

Neutros = base.

Acento = estado activo o acción que hace avanzar.

Peligro = destructivo.

Nunca color decorativo.

Tipo

Una familia de interfaz.

Título = decisión o entidad.

Meta = contexto secundario, más discreto.

Label/ayuda = pequeño, breve, apagado.

Forma

Radios moderados; bordes sutiles.

Controles compactos.

Badges/chips para identidad y estado, no para relleno.

Movimiento

Breve: entrada, cambio de estado, confirmación.

Progreso = estado legible, no animación constante.

Patrones de uso
Pantallas

Una idea principal.  
Orden: qué hago yo → qué está en curso → el resto.  
Máximo una acción primaria.  
Salir / cancelar siempre obvio.  
No partas un flujo simple en pasos de más.
Componentes

Una responsabilidad.  
Variantes por props (tamaño, estado, énfasis).  
Si el significado cambia, es otro componente.  
Debe entenderse en contexto sin explicación larga.
Controles

Primaria = avanzar.  
Secundaria/discreta = lo demás.  
Selectores de modo e interruptores para comportamiento.  
Formularios: label → control → ayuda breve si hace falta.
Texto

De oficio.

Nombra acciones y estados con precisión.

Vacíos que indiquen el siguiente paso útil.

Criterio de aceptación
¿Se entiende qué puede hacer el usuario ahora?  
¿Se entiende qué ocurre sin él?  
¿Hay una sola acción primaria?  
¿Algo distrae sin aportar control o claridad? → fuera o más suave.  
¿Ayuda a enfocar y no perder tiempo? Si no, no entra.
Prohibido
Ruido visual · muchas acciones fuertes · igualar peso de control y ejecución · color decorativo · textos largos innecesarios · hacer sentir al usuario operador de formularios en vez de orquestador.

El producto manda; cada pieza nueva se deriva de este lenguaje.
<!-- /iaterminal:notes -->
