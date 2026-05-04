<!-- IA-SYSTEM-PROTECTION:BEGIN -->
> **REGLA OBLIGATORIA PARA CUALQUIER IA**
>
> Ningun agente de IA, incluyendo Codex, Claude, ChatGPT, Gemini o similares, puede modificar, mover, borrar, instalar, desinstalar o intervenir archivos del sistema Windows, navegadores, perfiles de navegador, extensiones, complementos, configuraciones del equipo ni otros recursos fuera de este proyecto sin permiso explicito y especifico del usuario.
>
> Si el usuario no lo pide de forma explicita y puntual, se asume prohibido.
<!-- IA-SYSTEM-PROTECTION:END -->
# Runtime UI and Model Routing Roadmap

Este roadmap refleja la integración real entre `BotValia-CodeUI`, el runtime actual del CLI y los pendientes reales del router de modelos.

## Estado actual

La UI web nueva ya quedó conectada al runtime real para estas capacidades existentes hoy en el backend:

- `list_sessions`
- `get_session_detail`
- `send_message`
- `claim_session`
- `interrupt`
- `rename_session`
- `set_permission_mode`
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

Además, hoy ya existe en producto:

- topbar y shell nuevos de `BotValia-CodeUI` corriendo sobre el runtime real
- placeholder de `thinking` en vivo en web
- thinking incremental cuando el runtime emite `thinking_delta`
- reemplazo limpio de `thinking` por respuesta final cuando llega el assistant message
- `Shift+Tab` en la UI web para ciclar modo de ejecución
- mensaje de sistema `Auto cancelado por el usuario.` al interrumpir desde la UI
- transcript más compacto en altura para mostrar más conversación en pantalla
- task rail lateral en CLI cuando el flujo expone tareas enumeradas o trabajo en curso
- rail operativo en CLI con secciones `Tasks`, `Thinking`, `Tools`, `Agents` y `Context`
- canal activo visible por sesión (`CLI` / `Web UI`) y takeover explícito desde la web
- `/model audit` y `/model update` como comandos reales de producto

Y hoy el routing de modelos funciona así:

- la cola base `fast / complex / code` se construye en `scripts/dev-auto.ps1`
- el catálogo live de modelos free de OpenRouter ya se consulta hoy
- el CLI también puede aplicar rutas en caliente vía `src/utils/model/providerRouting.ts`
- `/model audit` ya inspecciona la cola efectiva y propone reordenamiento conservador
- `/model update` ya persiste el nuevo orden en settings sin mover el turno en vuelo

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
- [src/runtime/runtimeInspectorServer.ts](./src/runtime/runtimeInspectorServer.ts)
- [src/commands/runtime/runtime.ts](./src/commands/runtime/runtime.ts)
- [BotValia-CodeUI/components/runtime/RuntimeShell.tsx](./BotValia-CodeUI/components/runtime/RuntimeShell.tsx)
- [BotValia-CodeUI/hooks/useRuntimeInspector.ts](./BotValia-CodeUI/hooks/useRuntimeInspector.ts)

## Fase 1

Objetivo: paridad funcional de lifecycle de sesión desde la UI.

Ya existe hoy:
- `rename_session`
- drafts locales de sesión en browser
- metadata visual local por sesión
  - `title`
  - `archived`
  - `pinned`
  - `notes`

Pendientes backend reales:
- `create_session`
- `archive_session`
- `unarchive_session`
- `pin_session`

Impacto UI actual:
- `Nueva sesión` crea borradores locales funcionales mientras falta `create_session`
- `Rename` ya persiste en runtime cuando hay backend conectado
- `Archive`, `Restore`, `Pin` y `Notes` viven hoy en persistencia local del browser
- la biblioteca cross-device o compartida con CLI sigue pendiente hasta que exista backend de lifecycle

Archivos a tocar cuando se implemente:
- [src/runtime/protocol.ts](./src/runtime/protocol.ts)
- [src/runtime/runtimeBridge.ts](./src/runtime/runtimeBridge.ts)
- [src/runtime/runtimeService.ts](./src/runtime/runtimeService.ts)
- [src/runtime/runtimeRegistry.ts](./src/runtime/runtimeRegistry.ts)
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
- [src/runtime/protocol.ts](./src/runtime/protocol.ts)
- [src/runtime/runtimeBridge.ts](./src/runtime/runtimeBridge.ts)
- [src/runtime/runtimeService.ts](./src/runtime/runtimeService.ts)

## Fase 3

Objetivo: paridad real del `SwarmOfficeView`.

Ya existe hoy:
- `teamName`
- `isLeader`
- `teammateNames`
- `teammates[]` básicos con metadata real cuando el runtime la conoce
- `tasks`
- `swarmThreads`
- `swarmWaitingEdges`
- `Direct instruction` desde web enviando `@agente ...` por el runtime actual

Pendientes backend:
- enriquecer consistentemente `swarm.teammates[]` en todos los caminos del runtime con:
  - `role`
  - `status`
  - `currentTask`
  - `currentInstruction`
- `swarm.tasks[]` con `assigneeId`/`owner` real en todos los providers
- `send_swarm_instruction` nativo como método de protocolo en vez de piggyback sobre `@agente`
- un feed más fiel para `internalChat`

Impacto UI actual:
- la vista swarm ya usa datos reales donde existen
- teammates, roles y asignaciones siguen siendo heurísticos solo cuando el backend no los provee
- `Direct instruction to <agent>` ya funciona vía mensaje dirigido; falta volverlo endpoint oficial

Archivos a tocar:
- [src/runtime/types.ts](./src/runtime/types.ts)
- [src/runtime/runtimeService.ts](./src/runtime/runtimeService.ts)
- [src/runtime/protocol.ts](./src/runtime/protocol.ts)
- la capa real de coordinator/swarm

## Fase 4

Objetivo: fidelidad completa del transcript y adjuntos.

Ya existe hoy:
- mensajes reales por sesión
- timestamps reales
- sanitización en frontend para esconder thinking, redacted thinking, caveats y XML interno
- placeholder y lifecycle real de `thinking` en web
- contexto explícito de origen `web-ui` al enviar desde la UI
- takeover explícito de canal activo con `claim_session`
- eventos estructurados:
  - `thinking_started`
  - `thinking_delta`
  - `thinking_completed`
  - `task_started`
  - `task_progress`
  - `task_completed`
  - `tool_started`
  - `tool_progress`
  - `tool_completed`
  - `agent_event`
  - `swarm_event`

Pendientes backend:
- payload de mensaje más fiel que `RuntimeMessageSummary.text`
- bloques estructurados para markdown/code/table con mejor preservación
- soporte real de attachments desde la UI
- texto de pensamiento realmente incremental y visible en tiempo real cuando el modelo/provider lo emite
- diferenciación más fuerte entre:
  - `thinking`
  - `tool progress`
  - `final answer`
- policy más estricta de ownership por turno cuando CLI y web pelean por la misma sesión

Impacto UI actual:
- la conversación principal ya funciona con mensajes reales
- aún depende de un adapter/sanitizador porque el runtime colapsa varios contenidos a texto plano
- el botón attach queda visible, pero pendiente
- la UI ya muestra streaming textual, thinking y eventos estructurados, pero todavía no existe una representación rica por bloques ni un ownership lock duro por turno
- si el modelo no emite deltas reales de pensamiento, la UI cae al placeholder y luego muestra la respuesta final

Archivos a tocar:
- [src/runtime/types.ts](./src/runtime/types.ts)
- [src/runtime/protocol.ts](./src/runtime/protocol.ts)

## Fase 5

Objetivo: timeline de eventos y observabilidad por sesión.

Ya existe hoy:
- `runtime_registry_event`
- `runtime_session_event`
- timestamps en eventos runtime
- feed live local con tasks, tools, swarm, agents, modelo y permission mode

Pendientes backend:
- historial consultable de eventos por sesión
- severidad normalizada
- scope/source consistente
- opcional `get_session_events`

Impacto UI actual:
- la pestaña `Eventos` ya muestra feed live acumulado localmente
- todavía no existe histórico confiable al abrir una sesión antigua o recién cargada

Archivos a tocar:
- [src/runtime/protocol.ts](./src/runtime/protocol.ts)
- [src/runtime/runtimeBridge.ts](./src/runtime/runtimeBridge.ts)
- [src/runtime/runtimeService.ts](./src/runtime/runtimeService.ts)

## Notas

- La UI nueva ya está trayendo el diseño real de `BotValia-CodeUI`; lo pendiente ahora es mostly backend parity.
- Las funciones que hoy no existen en protocolo quedan visibles como UX premium, pero deben reportarse como pendientes y no mentir soporte.
- El CLI ya soporta mensajería directa con `@nombre` para teammates activos y agentes nombrados en ejecución, incluyendo varias líneas `@agente tarea` en un solo envío.
- El orden recomendado para cerrar gaps es:
  1. lifecycle de sesión
  2. modelo/settings
  3. swarm rico
  4. transcript estructurado
  5. historial de eventos

## Fase 6

Objetivo: experiencia completa de `@agentes` personalizados desde el prompt del usuario.

Ya existe hoy:
- `@nombre mensaje` para teammates activos
- `@nombre mensaje` para agentes nombrados que sigan corriendo
- varias líneas `@agente tarea` en un solo prompt, despachadas en paralelo
- consolidación posterior por el agente principal usando `AgentTool` + `SendMessage`

Pendientes backend / orchestration:
- auto-spawn de agentes personalizados al escribir `@nombre` si todavía no están activos
- reanudar agentes nombrados detenidos desde el shortcut `@nombre mensaje`
- sintaxis oficial para fan-out estructurado en una sola instrucción del usuario
  - ejemplo: `@researcher ...`
  - ejemplo: `@reviewer ...`
  - ejemplo: `@commits ...`
- consolidación asistida por producto para que el líder sintetice resultados de varios agentes a petición del usuario
- feedback más rico de estado por agente durante ese fan-out

Impacto UX actual:
- si el agente ya está vivo y nombrado, el shortcut directo funciona
- si no existe o ya terminó, el usuario todavía necesita crear/lanzar ese agente primero
- el fan-out multiagente ya funciona mejor en CLI, pero no es todavía una UX “mágica” de spawn automático

Archivos a tocar:
- [src/components/PromptInput/PromptInput.tsx](./src/components/PromptInput/PromptInput.tsx)
- [src/utils/directMemberMessage.ts](./src/utils/directMemberMessage.ts)
- [src/tools/AgentTool/AgentTool.tsx](./src/tools/AgentTool/AgentTool.tsx)
- [src/tools/SendMessageTool/SendMessageTool.ts](./src/tools/SendMessageTool/SendMessageTool.ts)

## Fase 7

Objetivo: ranking dinámico de modelos free para programación con reordenamiento controlado de colas.

Estado:
- activo como primera version de producto; pendiente de enriquecimiento

Qué ya existe hoy:
- comando `/model`
- `/model audit`
- `/model update`
- rutas separadas por lane:
  - `fast`
  - `complex`
  - `code`
- catálogo live de modelos free de OpenRouter
- inventario local de Ollama
- aplicación de rutas en caliente desde `providerRouting.ts`
- persistencia en `userSettings.env`

Qué falta:
- enriquecer `/model audit` con ranking público además de disponibilidad real
- snapshot/export de auditorías previas
- persistencia dedicada de overrides de router
  - por ejemplo `~/.botvalia/model-router-overrides.json`
- scoring híbrido con múltiples señales:
  - disponibilidad free real
  - popularidad/uso para programación
  - benchmark coding
  - latencia/throughput
- hysteresis para evitar reorder agresivo por ruido diario
- policy clara:
  - el modelo que ya está respondiendo no se mueve en medio de la ejecución
  - el reorder aplica a próximos turnos
  - si no hay modelos nuevos, reordenar solo si el score externo supera un umbral

Fuentes públicas sugeridas:
- OpenRouter rankings
- OpenRouter programming collection
- OpenRouter free models collection
- Aider leaderboard
- Artificial Analysis

Archivos probables a tocar:
- [src/commands/model/model.tsx](./src/commands/model/model.tsx)
- [src/utils/model/providerRouting.ts](./src/utils/model/providerRouting.ts)
- [scripts/dev-auto.ps1](./scripts/dev-auto.ps1)
- nuevo helper para fetch/score/persist de ranking

