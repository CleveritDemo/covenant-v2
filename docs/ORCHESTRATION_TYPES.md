# Tipos de orquestación

| Aspecto | Orquestación lineal | Orquestación turbo |
|---|---|---|
| Modelo mental | Un flujo a la vez. | Varios jobs vivos en paralelo. |
| Secuencia | Delegar → esperar → integrar → responder. | Delegar → aceptar nuevos pedidos cuando el orquestador pueda iniciar turno → integrar cada resultado en su job. |
| Nuevo mensaje humano | Espera a que termine la ola actual de delegaciones antes de iniciar otro flujo. | Entra inmediatamente como nuevo job solo si el orquestador no está busy y puede iniciar turno; si no, queda en cola local. |
| Delegaciones anteriores | Normalmente ya terminaron antes del siguiente turno humano. | Pueden seguir vivas mientras el usuario manda otro mensaje; no se abortan por defecto. |
| Qué bloquea el nuevo turno | La ola pendiente del flujo lineal. | El propio estado del orquestador: `busy`, `delegationWorkActive`, `systemFollowUpsPending` o `loopActive`. |
| Qué no bloquea en turbo | No aplica: lineal espera la ola. | `awaitingDelegations` no bloquea por sí solo; por eso pueden convivir jobs anteriores con nuevos mensajes humanos. |
| Resultados de agentes | Vuelven al único flujo activo. | Vuelven al `orchestrationJobId` dueño, aunque lleguen intercalados con otros jobs. |
| Cancelación | Afecta el flujo/ola actual. | Debe afectar solo la delegación o job seleccionado. |
| Agente lento | Bloquea el avance del usuario. | No bloquea otros pedidos si el orquestador está libre para iniciar turno. |
| Réplicas | Menos necesarias. | Útiles para no bloquear agentes base cuando hay trabajo paralelo. |
| Riesgo principal | Lentitud o bloqueo. | Mezclar, perder o atribuir mal resultados entre jobs. |
| Ventaja principal | Orden y predictibilidad. | Velocidad y paralelismo. |
| Caso ideal | Tareas dependientes o delicadas. | Tareas independientes o usuario iterando rápido. |
