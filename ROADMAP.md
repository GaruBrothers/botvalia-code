# Runtime UI Roadmap

Este roadmap refleja la integración real entre `BotValia-CodeUI` y el runtime actual del CLI.

## Estado actual

La UI web nueva ya quedó conectada al runtime real para estas capacidades existentes hoy en el backend:

- `list_sessions`
- `get_session_detail`
- `send_message`
- `interrupt`
- `subscribe_runtime`
- `subscribe_session`
- `unsubscribe`

También está consumiendo lo que ya expone el runtime en lectura:

- `sessionId`, `cwd`, `status`, `messageCount`, `taskCount`
- `mainLoopModel`, `mainLoopModelForSession`
- `swarm.teamName`, `swarm.isLeader`, `swarm.teammateNames`
- `tasks`
- `swarmThreads`
- `swarmWaitingEdges`
- eventos live de runtime y de sesión

## Fase 0

Objetivo: reemplazo total de la UI antigua por `BotValia-CodeUI`.

Estado:
- completado

Incluye:
- `/runtime open` vuelve a levantar UI web real
- `/runtime ui` vuelve a exponer la UI web
- la app Next.js se lanza desde el CLI
- la UI se conecta al WebSocket del runtime actual por query param
- sesiones vivas, detalle, conversación, refresh, reconnect e interrupt ya están cableados

Archivos base:
- [src/runtime/runtimeInspectorServer.ts](/C:/Users/jhcamachov/Documents/GitHub/PERSONAL/botvalia-code/src/runtime/runtimeInspectorServer.ts)
- [src/commands/runtime/runtime.ts](/C:/Users/jhcamachov/Documents/GitHub/PERSONAL/botvalia-code/src/commands/runtime/runtime.ts)
- [BotValia-CodeUI/components/runtime/RuntimeShell.tsx](/C:/Users/jhcamachov/Documents/GitHub/PERSONAL/botvalia-code/BotValia-CodeUI/components/runtime/RuntimeShell.tsx)
- [BotValia-CodeUI/hooks/useRuntimeInspector.ts](/C:/Users/jhcamachov/Documents/GitHub/PERSONAL/botvalia-code/BotValia-CodeUI/hooks/useRuntimeInspector.ts)

## Fase 1

Objetivo: paridad funcional de lifecycle de sesión desde la UI.

Pendientes backend:
- `create_session`
- `rename_session`
- `archive_session`
- `unarchive_session`
- `pin_session`
- persistencia de metadata visual por sesión
  - `title`
  - `archived`
  - `pinned`

Impacto UI actual:
- `Nueva sesión` queda visible, pero pendiente
- `Rename` queda visible, pero pendiente
- `Archive` queda visible, pero pendiente
- la sidebar agrupa sesiones activas reales, pero no hay biblioteca persistente

Archivos a tocar cuando se implemente:
- [src/runtime/protocol.ts](/C:/Users/jhcamachov/Documents/GitHub/PERSONAL/botvalia-code/src/runtime/protocol.ts)
- [src/runtime/runtimeBridge.ts](/C:/Users/jhcamachov/Documents/GitHub/PERSONAL/botvalia-code/src/runtime/runtimeBridge.ts)
- [src/runtime/runtimeService.ts](/C:/Users/jhcamachov/Documents/GitHub/PERSONAL/botvalia-code/src/runtime/runtimeService.ts)
- [src/runtime/runtimeRegistry.ts](/C:/Users/jhcamachov/Documents/GitHub/PERSONAL/botvalia-code/src/runtime/runtimeRegistry.ts)
- la capa que persista metadata de sesión

## Fase 2

Objetivo: settings y control de modelo reales desde la UI.

Pendientes backend:
- `set_session_model`
- opcional `set_default_model`
- endpoint/listado de modelos válidos para la UI
- evento consistente de cambio de modelo accionado desde protocolo

Impacto UI actual:
- el selector de modelo en settings queda en modo lectura
- la UI sí muestra el modelo real de la sesión
- `model_switched` existe como shape/evento, pero no hay acción expuesta para dispararlo desde la web

Archivos a tocar:
- [src/runtime/protocol.ts](/C:/Users/jhcamachov/Documents/GitHub/PERSONAL/botvalia-code/src/runtime/protocol.ts)
- [src/runtime/runtimeBridge.ts](/C:/Users/jhcamachov/Documents/GitHub/PERSONAL/botvalia-code/src/runtime/runtimeBridge.ts)
- [src/runtime/runtimeService.ts](/C:/Users/jhcamachov/Documents/GitHub/PERSONAL/botvalia-code/src/runtime/runtimeService.ts)

## Fase 3

Objetivo: paridad real del `SwarmOfficeView`.

Ya existe hoy:
- `teamName`
- `isLeader`
- `teammateNames`
- `tasks`
- `swarmThreads`
- `swarmWaitingEdges`

Pendientes backend:
- `swarm.teammates[]` ricos con:
  - `id`
  - `name`
  - `role`
  - `status`
  - `currentTask`
- `swarm.tasks[]` con `assigneeId` real
- `send_swarm_instruction`
- un feed más fiel para `internalChat`

Impacto UI actual:
- la vista swarm ya usa datos reales donde existen
- teammates, roles y asignaciones siguen siendo heurísticos cuando el backend no los provee
- `Direct instruction to <agent>` queda visible, pero pendiente

Archivos a tocar:
- [src/runtime/types.ts](/C:/Users/jhcamachov/Documents/GitHub/PERSONAL/botvalia-code/src/runtime/types.ts)
- [src/runtime/runtimeService.ts](/C:/Users/jhcamachov/Documents/GitHub/PERSONAL/botvalia-code/src/runtime/runtimeService.ts)
- [src/runtime/protocol.ts](/C:/Users/jhcamachov/Documents/GitHub/PERSONAL/botvalia-code/src/runtime/protocol.ts)
- la capa real de coordinator/swarm

## Fase 4

Objetivo: fidelidad completa del transcript y adjuntos.

Ya existe hoy:
- mensajes reales por sesión
- timestamps reales
- sanitización en frontend para esconder thinking, redacted thinking, caveats y XML interno

Pendientes backend:
- payload de mensaje más fiel que `RuntimeMessageSummary.text`
- bloques estructurados para markdown/code/table con mejor preservación
- soporte real de attachments desde la UI

Impacto UI actual:
- la conversación principal ya funciona con mensajes reales
- aún depende de un adapter/sanitizador porque el runtime colapsa varios contenidos a texto plano
- el botón attach queda visible, pero pendiente

Archivos a tocar:
- [src/runtime/types.ts](/C:/Users/jhcamachov/Documents/GitHub/PERSONAL/botvalia-code/src/runtime/types.ts)
- [src/runtime/protocol.ts](/C:/Users/jhcamachov/Documents/GitHub/PERSONAL/botvalia-code/src/runtime/protocol.ts)

## Fase 5

Objetivo: timeline de eventos y observabilidad por sesión.

Ya existe hoy:
- `runtime_registry_event`
- `runtime_session_event`
- timestamps en eventos runtime

Pendientes backend:
- historial consultable de eventos por sesión
- severidad normalizada
- scope/source consistente
- opcional `get_session_events`

Impacto UI actual:
- la pestaña `Eventos` ya muestra feed live acumulado localmente
- todavía no existe histórico confiable al abrir una sesión antigua o recién cargada

Archivos a tocar:
- [src/runtime/protocol.ts](/C:/Users/jhcamachov/Documents/GitHub/PERSONAL/botvalia-code/src/runtime/protocol.ts)
- [src/runtime/runtimeBridge.ts](/C:/Users/jhcamachov/Documents/GitHub/PERSONAL/botvalia-code/src/runtime/runtimeBridge.ts)
- [src/runtime/runtimeService.ts](/C:/Users/jhcamachov/Documents/GitHub/PERSONAL/botvalia-code/src/runtime/runtimeService.ts)

## Notas

- La UI nueva ya está trayendo el diseño real de `BotValia-CodeUI`; lo pendiente ahora es mostly backend parity.
- Las funciones que hoy no existen en protocolo quedan visibles como UX premium, pero deben reportarse como pendientes y no mentir soporte.
- El orden recomendado para cerrar gaps es:
  1. lifecycle de sesión
  2. modelo/settings
  3. swarm rico
  4. transcript estructurado
  5. historial de eventos
