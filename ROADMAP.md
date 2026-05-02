# Runtime Inspector Roadmap

Este roadmap mapea las funciones premium de la UI del inspector que todavía no tienen soporte real en el backend/runtime del CLI.

## Estado actual del protocolo runtime

Hoy el protocolo solo expone estas operaciones en [src/runtime/protocol.ts](/C:/Users/jhcamachov/Documents/GitHub/PERSONAL/botvalia-code/src/runtime/protocol.ts):

- `list_sessions`
- `get_session`
- `get_session_detail`
- `send_message`
- `interrupt`
- `subscribe_runtime`
- `subscribe_session`
- `unsubscribe`

Eso significa que cualquier función premium fuera de ese contrato debe verse como UI roadmap, no como acción funcional todavía.

## Funciones premium faltantes

### 1. Crear sesión desde el inspector

UI objetivo:
- botón `Nueva sesión`
- posibilidad de abrir una sesión nueva sin pasar por el CLI principal

Backend faltante:
- método de protocolo `create_session`
- capacidad en runtime/registry para instanciar una sesión vacía o una sesión con `cwd` inicial

Archivos a tocar:
- [src/runtime/protocol.ts](/C:/Users/jhcamachov/Documents/GitHub/PERSONAL/botvalia-code/src/runtime/protocol.ts)
- [src/runtime/runtimeBridge.ts](/C:/Users/jhcamachov/Documents/GitHub/PERSONAL/botvalia-code/src/runtime/runtimeBridge.ts)
- [src/runtime/runtimeService.ts](/C:/Users/jhcamachov/Documents/GitHub/PERSONAL/botvalia-code/src/runtime/runtimeService.ts)
- [src/runtime/runtimeRegistry.ts](/C:/Users/jhcamachov/Documents/GitHub/PERSONAL/botvalia-code/src/runtime/runtimeRegistry.ts)

Contrato sugerido:
- request: `create_session { cwd?: string, model?: string, title?: string }`
- response: `session: RuntimeSessionSnapshot`

### 2. Renombrar sesión

UI objetivo:
- editar título visible de una sesión desde la sidebar

Backend faltante:
- metadata persistente por sesión
- método `rename_session`

Archivos a tocar:
- [src/runtime/types.ts](/C:/Users/jhcamachov/Documents/GitHub/PERSONAL/botvalia-code/src/runtime/types.ts)
- [src/runtime/protocol.ts](/C:/Users/jhcamachov/Documents/GitHub/PERSONAL/botvalia-code/src/runtime/protocol.ts)
- [src/runtime/runtimeBridge.ts](/C:/Users/jhcamachov/Documents/GitHub/PERSONAL/botvalia-code/src/runtime/runtimeBridge.ts)
- [src/runtime/runtimeService.ts](/C:/Users/jhcamachov/Documents/GitHub/PERSONAL/botvalia-code/src/runtime/runtimeService.ts)
- [src/runtime/sessionRuntime.ts](/C:/Users/jhcamachov/Documents/GitHub/PERSONAL/botvalia-code/src/runtime/sessionRuntime.ts) o la capa que persista metadata

Contrato sugerido:
- request: `rename_session { sessionId, title }`
- response: `session: RuntimeSessionSnapshot`

### 3. Pinear y archivar sesiones

UI objetivo:
- secciones `Pinned` y `Recent`
- archivar sin perder historial

Backend faltante:
- metadata `pinned`, `archived`
- endpoints `pin_session`, `archive_session`, `unarchive_session`
- persistencia de ese estado entre reinicios

Archivos a tocar:
- [src/runtime/types.ts](/C:/Users/jhcamachov/Documents/GitHub/PERSONAL/botvalia-code/src/runtime/types.ts)
- [src/runtime/protocol.ts](/C:/Users/jhcamachov/Documents/GitHub/PERSONAL/botvalia-code/src/runtime/protocol.ts)
- [src/runtime/runtimeBridge.ts](/C:/Users/jhcamachov/Documents/GitHub/PERSONAL/botvalia-code/src/runtime/runtimeBridge.ts)
- [src/runtime/runtimeService.ts](/C:/Users/jhcamachov/Documents/GitHub/PERSONAL/botvalia-code/src/runtime/runtimeService.ts)
- almacenamiento persistente de metadata de sesiones

### 4. Cambiar modelo global o por sesión desde el inspector

UI objetivo:
- selector de modelo en settings
- cambio de modelo sin salir del inspector

Backend faltante:
- método `set_session_model`
- opcional `set_default_model`
- evento runtime/session que notifique el cambio

Archivos a tocar:
- [src/runtime/protocol.ts](/C:/Users/jhcamachov/Documents/GitHub/PERSONAL/botvalia-code/src/runtime/protocol.ts)
- [src/runtime/runtimeBridge.ts](/C:/Users/jhcamachov/Documents/GitHub/PERSONAL/botvalia-code/src/runtime/runtimeBridge.ts)
- [src/runtime/runtimeService.ts](/C:/Users/jhcamachov/Documents/GitHub/PERSONAL/botvalia-code/src/runtime/runtimeService.ts)
- la capa real que administra `mainLoopModel` y `mainLoopModelForSession`

### 5. Swarm premium con teammates ricos

UI objetivo:
- tarjetas de agentes con nombre, rol, estado, focus actual
- instrucciones directas por teammate
- cola de tareas por agente

Backend faltante:
- no basta con `teamName`, `isLeader` y `teammateNames`
- hace falta una estructura más rica para teammates y tasks asignadas

Shape sugerido:
- `swarm.teammates[]` con `id`, `name`, `role`, `status`, `currentTask`
- `swarm.tasks[]` con `id`, `title`, `status`, `assigneeId`

Archivos a tocar:
- [src/runtime/types.ts](/C:/Users/jhcamachov/Documents/GitHub/PERSONAL/botvalia-code/src/runtime/types.ts)
- [src/runtime/runtimeService.ts](/C:/Users/jhcamachov/Documents/GitHub/PERSONAL/botvalia-code/src/runtime/runtimeService.ts)
- [src/runtime/protocol.ts](/C:/Users/jhcamachov/Documents/GitHub/PERSONAL/botvalia-code/src/runtime/protocol.ts)
- cualquier origen real del estado swarm dentro del coordinator/team context

### 6. Instrucción directa a un agente del swarm

UI objetivo:
- input `Direct instruction to <agent>`

Backend faltante:
- método explícito para enrutar una orden a un teammate concreto

Contrato sugerido:
- request: `send_swarm_instruction { sessionId, teammateName | teammateId, text }`

Archivos a tocar:
- [src/runtime/protocol.ts](/C:/Users/jhcamachov/Documents/GitHub/PERSONAL/botvalia-code/src/runtime/protocol.ts)
- [src/runtime/runtimeBridge.ts](/C:/Users/jhcamachov/Documents/GitHub/PERSONAL/botvalia-code/src/runtime/runtimeBridge.ts)
- [src/runtime/runtimeService.ts](/C:/Users/jhcamachov/Documents/GitHub/PERSONAL/botvalia-code/src/runtime/runtimeService.ts)
- integración con la capa real de swarm/coordinator

### 7. Feed de conversación más rico

UI objetivo:
- markdown real
- bloques de código
- tablas
- mejor tipado de mensajes del runtime

Backend faltante:
- el backend ya entrega mensajes, pero hoy `RuntimeMessageSummary.text` colapsa todo a texto plano
- para llegar a una vista rica conviene exponer bloques estructurados o un formato más fiel al mensaje original

Archivos a tocar:
- [src/runtime/types.ts](/C:/Users/jhcamachov/Documents/GitHub/PERSONAL/botvalia-code/src/runtime/types.ts)
- [src/runtime/types.ts](/C:/Users/jhcamachov/Documents/GitHub/PERSONAL/botvalia-code/src/runtime/types.ts) en `toRuntimeMessageSummary`
- [src/runtime/runtimeInspectorServer.ts](/C:/Users/jhcamachov/Documents/GitHub/PERSONAL/botvalia-code/src/runtime/runtimeInspectorServer.ts)

### 8. Timeline de eventos por sesión

UI objetivo:
- tab `Eventos` con timeline real
- timestamps consistentes
- severidad `info | warn | error`
- filtro por sesión seleccionada

Backend faltante:
- hoy el inspector mezcla eventos de runtime y sesión en un solo feed local
- faltan timestamps y severity normalizadas desde origen
- conviene un stream por sesión o payload enriquecido en `runtime_session_event`

Contrato sugerido:
- `runtime_session_event` con `timestamp`, `severity`, `sessionId`, `scope`
- opcional `get_session_events { sessionId, limit? }`

Archivos a tocar:
- [src/runtime/protocol.ts](/C:/Users/jhcamachov/Documents/GitHub/PERSONAL/botvalia-code/src/runtime/protocol.ts)
- [src/runtime/runtimeBridge.ts](/C:/Users/jhcamachov/Documents/GitHub/PERSONAL/botvalia-code/src/runtime/runtimeBridge.ts)
- [src/runtime/runtimeService.ts](/C:/Users/jhcamachov/Documents/GitHub/PERSONAL/botvalia-code/src/runtime/runtimeService.ts)
- [src/runtime/runtimeInspectorServer.ts](/C:/Users/jhcamachov/Documents/GitHub/PERSONAL/botvalia-code/src/runtime/runtimeInspectorServer.ts)

## Prioridad recomendada

### P1

- `rename_session`
- `pin_session`
- `archive_session`
- `set_session_model`

### P2

- `create_session`
- `send_swarm_instruction`
- payload rico de teammates/tasks

### P3

- renderer de mensajes estructurados
- más acciones de workspace desde el inspector
- eventos enriquecidos por sesión

## Notas

- La UI puede mostrar placeholders premium desde ya, pero cualquier acción sin endpoint real debe verse como disabled o roadmap.
- El lugar correcto para añadir nuevos métodos es el trío:
  - [src/runtime/protocol.ts](/C:/Users/jhcamachov/Documents/GitHub/PERSONAL/botvalia-code/src/runtime/protocol.ts)
  - [src/runtime/runtimeBridge.ts](/C:/Users/jhcamachov/Documents/GitHub/PERSONAL/botvalia-code/src/runtime/runtimeBridge.ts)
  - [src/runtime/runtimeService.ts](/C:/Users/jhcamachov/Documents/GitHub/PERSONAL/botvalia-code/src/runtime/runtimeService.ts)
