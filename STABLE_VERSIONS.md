# Stable Versions

Este archivo registra checkpoints estables por superficie para poder volver
rápido a una versión conocida del producto sin depender de memoria o del log
de la conversación.

## CLI

### Current stable

- `431cf13` — `Stabilize BotValia CLI shell and runtime UI`
  - Tag: `stable-cli-2026-05-02`
  - Shell del CLI con arranque más pulido, chat más amplio y composer con marco mejorado.
  - Mantiene el boot sano con `bun run version` y el flujo `botvalia` alineado con `dev:auto`.

### Previous stable checkpoints

- `f72b61d` — `Align botvalia launcher startup with auto mode`
  - Punto base donde `botvalia` y `bun run dev:auto` quedaron alineados.

- `3930775` — `Mostrar BotValia Code grande en el arranque`
  - Punto útil para volver al arranque visual grande del CLI.

## UI

### Current stable

- `431cf13` — `Stabilize BotValia CLI shell and runtime UI`
  - Tag: `stable-ui-2026-05-02`
  - Runtime inspector con `BotValia-CodeUI` compilando bien, bridge validado y carga preparada para el shell real.
  - Validado con `npm run build`, `npm run lint` y subida/bajada del runtime inspector.

### Previous stable checkpoints

- `521cf00` — `Integrate CodeUI runtime shell and unify botvalia launcher`
  - Primer punto donde la UI `BotValia-CodeUI` quedó integrada al runtime shell.

- `e831793` — `Rediseñar el inspector runtime como workspace de chat`
  - Rediseño base del inspector orientado a chat.

- `5ec830f` — `Agregar auto refresh y monitor de swarm al inspector`
  - Estado útil si se necesita volver al inspector con monitor de swarm y auto refresh.

- `b81f881` — `Mejorar transcript y controles de swarm en el inspector`
  - Punto intermedio del inspector con mejoras funcionales previas al rediseño mayor.

## Update rule

Cuando se confirme un nuevo punto estable:

1. agregar el commit nuevo al bloque correspondiente (`CLI` o `UI`)
2. mover el anterior a `Previous stable checkpoints`
3. anotar en una línea qué quedó estable en ese commit
