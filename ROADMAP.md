<!-- IA-SYSTEM-PROTECTION:BEGIN -->
> **REGLA OBLIGATORIA PARA CUALQUIER IA**
>
> Ningun agente de IA, incluyendo Codex, ChatGPT, Gemini o similares, puede modificar, mover, borrar, instalar, desinstalar o intervenir archivos del sistema Windows, navegadores, perfiles de navegador, extensiones, complementos, configuraciones del equipo ni otros recursos fuera de este proyecto sin permiso explicito y especifico del usuario.
>
> Si el usuario no lo pide de forma explicita y puntual, se asume prohibido.
<!-- IA-SYSTEM-PROTECTION:END -->
# Runtime UI and Model Routing Roadmap

Este roadmap refleja la integración real entre `BotValia-CodeUI`, el runtime actual del CLI y los pendientes reales del router de modelos.

## Estado actual

El runtime y `BotValia-CodeUI` ya comparten un backend real para lifecycle, ownership y lectura rica de sesiones.

Capacidades backend disponibles hoy:

- `list_sessions`
- `get_session`
- `get_session_detail`
- `create_session`
- `claim_session`
- `send_message`
- `interrupt`
- `rename_session`
- `archive_session`
- `unarchive_session`
- `pin_session`
- `update_session_notes`
- `set_session_model`
- `list_models`
- `get_session_events`
- `set_permission_mode`
- `subscribe_runtime`
- `subscribe_session`
- `unsubscribe`

Datos ya expuestos por snapshot/detail:

- `title`, `isArchived`, `isPinned`, `notes`
- `createdAt`, `updatedAt`
- `hasLiveRuntime`
- `activeChannel`, `channelOwner`, `leaseExpiresAt`
- `mainLoopModel`, `mainLoopModelForSession`
- `tasks`, `swarmThreads`, `swarmWaitingEdges`
- transcript por bloques estructurados
- historial de eventos por sesión

Además, hoy ya existe en producto:

- shell web nueva corriendo sobre el runtime real
- takeover explícito de sesión desde Web UI con lease corto y visible
- mutaciones `web-ui` protegidas por `leaseId` por sesión, no sólo por handshake del socket
- metadata de sesión persistida del lado backend/runtime en vez de persistencia local del browser
- `/runtime sessions`, `/runtime create`, `/runtime archive`, `/runtime restore`, `/runtime pin`, `/runtime model ...`
- `/runtime security` y `/security audit` usando el mismo gate local de `security:preflight`
- thinking, tools, tasks y eventos live visibles desde la UI actual

Limitaciones vigentes:

- `create_session` crea un record persistido local de inmediato, pero no levanta por sí solo un worker vivo
- una sesión persistida sin worker puede leerse, renombrarse, archivarse, fijarse y cambiar de modelo, pero no aceptar `send_message`
- el selector visual de modelo en la web todavía no está promovido como edición completa aunque el backend/protocolo ya lo soportan
- attachments remotos siguen fuera de alcance; la postura actual se limita a referencias locales/artefactos existentes

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

Objetivo: backend real para lifecycle de sesión.

Estado:
- completado para rename/create/archive/restore/pin/notes

Lo que ya quedó resuelto:

- `create_session`, `archive_session`, `unarchive_session`, `pin_session` y `update_session_notes`
- metadata persistida del lado runtime
- snapshots consistentes entre CLI y Web UI
- records recuperables después de reiniciar el runtime

Límite actual:

- un record persistido no equivale todavía a un worker vivo ni a sync remota

## Fase 2

Objetivo: ownership y auth real por sesión.

Estado:
- completado para el backend local single-user

Lo que ya quedó resuelto:

- `claim_session` devuelve `leaseId` corto/renovable
- toda mutación `web-ui` sensible exige lease vigente
- takeover desde otro cliente invalida el lease anterior
- snapshots exponen `channelOwner`, `activeChannel` y vencimiento de lease
- errores tipados: `unauthorized`, `lease_expired`, `channel_conflict`, `session_not_found`

Límite actual:

- la seguridad sigue orientada a desktop local single-user, no a multiusuario ni a acceso remoto confiable
- el token del WebSocket sigue existiendo en el launch flow aunque ya no es la única barrera

## Fase 3

Objetivo: control real de modelo por sesión.

Estado:
- backend completado, UX web aún parcial

Lo que ya quedó resuelto:

- `set_session_model`
- `list_models`
- persistencia local del override por sesión
- restauración del override al reconstruir el runtime vivo cuando aplica
- comandos CLI `/runtime model list|get|set`

Pendiente real:

- selector visual completo en la web para editar modelo sin caer en placeholder

## Fase 4

Objetivo: transcript rico e historial de eventos.

Estado:
- mayormente completado, con límites explícitos en adjuntos

Lo que ya quedó resuelto:

- `RuntimeMessageSummary.blocks` para texto/markdown/tool_use/tool_result/thinking
- historial consultable con `get_session_events`
- eventos persistidos para sesiones viejas y sesiones vivas
- detalle de sesión más fiel que el antiguo resumen de texto plano

Límites actuales:

- los adjuntos siguen siendo referencias locales/artefactos existentes
- no hay uploads remotos ni share flows nuevos en esta fase
- algunos contenidos todavía se resumen desde shapes restaurados en lugar de conservar fidelidad perfecta a todos los block types del proveedor

## Fase 5

Objetivo: timeline de eventos y observabilidad por sesión.

Estado:
- backend completado

Lo que ya quedó resuelto:

- `runtime_registry_event`
- `runtime_session_event`
- timestamps consistentes
- severidad y source normalizados en records persistidos
- `get_session_events` para sesiones vivas y persistidas

Trabajo restante de producto:

- pulir UX visual del timeline en web/CLI sin cambiar el contrato base del runtime

## Notas

- El backend de runtime ya cubre lifecycle, leases, overrides de modelo e historial de eventos.
- Lo que sigue abierto es menos de contrato y más de UX/polish en Web UI, swarm rico y attachments.
- El CLI ya soporta mensajería directa con `@nombre` para teammates activos y agentes nombrados en ejecución, incluyendo varias líneas `@agente tarea` en un solo envío.

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

