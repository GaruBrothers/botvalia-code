# Real-Time Swarm Plan

## Objetivo

Convertir el sistema actual de agentes de BotValia en un equipo de trabajo real:

- el agente principal no debe quedarse bloqueado esperando respuestas lineales
- los subagentes deben poder hablar entre ellos en tiempo real
- deben poder hacerse preguntas, responderse y coordinar tareas sin pasar siempre por el líder
- el usuario debe ver progreso continuo y resultados parciales útiles

## Estado Validado Hoy

La base ya existe, pero todavía no es un swarm verdaderamente conversacional.

### Lo que ya está en el repo

- `src/tools/TeamCreateTool/TeamCreateTool.ts`
  Ya puede crear equipos y registrar contexto de team/leader.
- `src/tools/SendMessageTool/SendMessageTool.ts`
  Ya existe mensajería entre compañeros, incluyendo broadcast con `to: "*"`.
- `src/utils/attachments.ts`
  Ya entrega mensajes de mailbox al modelo como adjuntos de contexto.
- `src/utils/swarm/backends/InProcessBackend.ts`
  Ya hay backend in-process para compañeros en la misma app.
- `src/utils/swarm/backends/PaneBackendExecutor.ts`
  Ya hay backend basado en panes/mailbox para compañeros externos.
- `src/utils/swarm/permissionSync.ts`
  Ya usa mailbox para pedir y responder permisos entre líder y workers.
- `src/utils/swarm/teammatePromptAddendum.ts`
  Ya obliga a los teammates a usar `SendMessage` para comunicarse.

### Lo que ya quedó adelantado en Fase 1

- `src/utils/swarm/teamEvent.ts`
  Ya existe un envelope `team_event` v1 con serialización y parsing retrocompatible.
- `src/utils/swarm/teamConversationEvents.ts`
  Ya define un evento conversacional base con `kind`, `thread_id`, `reply_to`, `topic`, `priority` y `body`.
- `src/tools/SendMessageTool/SendMessageTool.ts`
  Ya puede emitir `team_event` estructurado hacia otro teammate.
- `src/utils/teammateMailbox.ts`
  Ya puede persistir y leer mensajes con envelope estructurado sin romper a los consumidores legacy.
- `src/hooks/useInboxPoller.ts`
  Ya formatea esos eventos para que el agente reciba contexto legible en vez de JSON crudo.
- `src/utils/swarm/mailboxWakeup.ts`
  Ya existe una primitiva de wakeup para mailbox.
- `src/utils/swarm/inProcessRunner.ts`
  Ya puede despertarse por escritura local al mailbox sin esperar siempre el sleep completo.
- `src/hooks/useInboxPoller.ts`
  Ya combina polling con wakeup local para reaccionar antes a mensajes del mailbox en el mismo proceso.
- `src/cli/print.ts`
  La ruta headless del líder ya combina lectura inmediata con wakeup local del mailbox para reducir latencia sin perder compatibilidad.

### Lo que todavía falta

- `src/coordinator/coordinatorMode.ts`
  El patrón principal sigue siendo coordinador -> worker -> notificación de vuelta.
- `src/tools/AgentTool/prompt.ts`
  La semántica sigue siendo “lanza agente y espera resultado”, no conversación multiagente sostenida.
- `src/tools/AgentTool/forkSubagent.ts`
  Los forks están explícitamente limitados para no convertirse en coordinadores ni crear nuevos subagentes.
- `src/utils/attachments.ts`
  El mailbox actual se consume por turnos del modelo; eso no es streaming peer-to-peer real.

## Diagnóstico Técnico

Hoy BotValia ya tiene:

- equipos
- IDs de agentes
- mailbox
- backends in-process y pane-based
- mensajería dirigida y broadcast

Pero no tiene todavía estas piezas críticas:

1. Un bus de eventos vivo.
2. Un scheduler que despierte agentes por mensajes entrantes sin depender de un nuevo turno del usuario.
3. Hilos de conversación entre agentes con `thread_id`, `reply_to`, `topic` y `correlation_id`.
4. Política de autonomía: cuándo un worker puede consultar a otro worker sin pasar por el líder.
5. UI/telemetría para ver qué agentes están hablando, quién bloquea a quién y qué rama del trabajo va ganando.

## Arquitectura Objetivo

### 1. Team Event Bus

Crear un bus interno de eventos para swarm con dos capas:

- `InMemoryTeamBus` para compañeros in-process
- `MailboxBridgeBus` para compañeros remotos o pane-based

Contrato sugerido:

```ts
type TeamEvent = {
  id: string
  teamId: string
  from: string
  to: string | '*'
  topic?: string
  threadId: string
  replyTo?: string
  kind: 'question' | 'answer' | 'task' | 'status' | 'handoff' | 'result'
  priority: 'low' | 'normal' | 'high'
  createdAt: number
  body: string
}
```

### 2. Wakeable Workers

Agregar un loop de espera activo para teammates:

- si entra un mensaje nuevo del bus, el worker se despierta
- si el worker está idle, consume el nuevo evento sin esperar al siguiente prompt del usuario
- si el worker está ocupado, el mensaje queda en su cola por `threadId`

Sitios candidatos:

- `src/utils/swarm/inProcessRunner.ts`
- `src/utils/swarm/spawnInProcess.ts`
- `src/utils/swarm/backends/InProcessBackend.ts`
- `src/utils/attachments.ts`

### 3. Peer-to-Peer Policy

Reglas nuevas:

- un worker puede consultar a otro worker si la pregunta está dentro del mismo `teamId`
- el líder sigue siendo la autoridad final frente al usuario
- las respuestas parciales pueden circular entre workers sin bloquear la respuesta final del líder
- los broadcasts quedan reservados para sincronización de estado, no para trabajo normal

### 4. Structured Team Memory

Cada conversación entre agentes debe persistirse por tema:

- `team/<team-id>/threads/<thread-id>.jsonl`
- `team/<team-id>/state.json`
- `team/<team-id>/routing.json`

Esto evita perder contexto cuando un agente responde horas después o el líder reinicia.

### 5. Swarm UI

Agregar un panel de observabilidad mínima:

- agentes activos
- quién está esperando a quién
- preguntas abiertas
- último modelo usado por cada agente
- fallback actual por agente

## Fases de Implementación

### Fase 1. Bus unificado sin romper compatibilidad

Objetivo:
- introducir `TeamEvent`
- adaptar `SendMessageTool` para escribir envelopes estructurados
- mantener compatibilidad con el mailbox de texto actual

Entregables:
- `src/utils/swarm/teamBus.ts`
- `src/utils/swarm/teamEventTypes.ts`
- adaptador texto <-> evento

Estado:
- parcialmente implementada
- `inProcessRunner`, `useInboxPoller` y `print.ts` ya usan wakeup local de mailbox para same-process
- falta un bus/wakeup compartido cross-process para tmux/panes y otros backends externos al proceso actual

### Fase 2. Despertar compañeros por evento

Objetivo:
- que un teammate in-process procese mensajes nuevos sin esperar otro prompt del usuario

Entregables:
- suscripción del `InProcessBackend`
- cola por agente
- dispatch por prioridad

### Fase 3. Conversación peer-to-peer real

Objetivo:
- preguntas y respuestas entre workers con `threadId` y `replyTo`

Entregables:
- `SendMessage` con `kind`, `thread_id`, `reply_to`, `topic`
- política de handoff y answer routing
- deduplicación de eventos

### Fase 4. Líder no bloqueante

Objetivo:
- que el líder siga trabajando o hablando con el usuario mientras el team conversa

Entregables:
- timeline de eventos
- status parciales
- resumen incremental para el líder

### Fase 5. Observabilidad y control

Objetivo:
- hacer el swarm depurable y usable en producción

Entregables:
- vista de topología del team
- métricas de latencia entre agentes
- contador de preguntas abiertas
- reintentos / timeouts / cooldowns

## Criterios de Aceptación

La función se considera lista cuando cumpla esto:

1. El líder crea un team y lanza 3 workers.
2. Worker A puede preguntarle algo a Worker B.
3. Worker B puede responderle directo a Worker A sin pasar por el usuario.
4. El líder recibe resúmenes de progreso, no sólo resultados finales.
5. Si un worker cae, otro puede retomar el `threadId`.
6. La UX sigue funcionando tanto in-process como pane-based.

## Riesgos

- `src/utils/attachments.ts` hoy mezcla polling, dedupe y entrega de inbox; si se toca sin aislar responsabilidades, es fácil meter carreras.
- El mailbox basado en archivos sirve como compatibilidad, pero no debe seguir siendo el plano principal para tiempo real.
- Los forks de `AgentTool` hoy están diseñados para no coordinar; conviene mantener esa restricción y enfocar el swarm real en `TeamCreate` + teammates.

## Recomendación de Producto

El siguiente paso con más retorno no es agregar más prompts a los agentes, sino construir primero la capa de `TeamEvent + wakeable workers`.

Sin eso, BotValia seguirá teniendo “workers paralelos” pero no un equipo que piense junto.

## Validación Manual

### Router free

```bash
bun run smoke:router:fallback
bun run smoke:router:fallback:json
```

Ese smoke verifica:

1. Que `routeSpec` gane sobre `fallbackModels`.
2. Que la cadena se deduplique.
3. Que el provider/modelo activo cambie correctamente en cada salto.

### Swarm fase 1

Prueba manual mínima esperada:

1. Crear un team con 2 o más workers.
2. Enviar un `team_event` de tipo `question` desde un agente hacia otro.
3. Verificar que el destinatario reciba texto formateado, no JSON crudo.
4. Responder con `team_event` tipo `answer` reutilizando `thread_id`.
5. Confirmar que el líder sigue viendo progreso por mailbox sin romper el flujo actual.
