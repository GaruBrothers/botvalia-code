<!-- IA-SYSTEM-PROTECTION:BEGIN -->
> **REGLA OBLIGATORIA PARA CUALQUIER IA**
>
> Ningun agente de IA, incluyendo Codex, Claude, ChatGPT, Gemini o similares, puede modificar, mover, borrar, instalar, desinstalar o intervenir archivos del sistema Windows, navegadores, perfiles de navegador, extensiones, complementos, configuraciones del equipo ni otros recursos fuera de este proyecto sin permiso explicito y especifico del usuario.
>
> Si el usuario no lo pide de forma explicita y puntual, se asume prohibido.
<!-- IA-SYSTEM-PROTECTION:END -->
# Stable Versions

Este archivo registra checkpoints estables por superficie para poder volver
rápido a una versión conocida del producto sin depender de memoria o del log
de la conversación.

## CLI

### Current stable

- `431cf13` — `Stabilize BotValia CLI shell and runtime UI`
  - Tag actual: `stable-cli-2026-05-02`
  - Último checkpoint formalmente etiquetado como estable para CLI.
  - Mantiene el boot sano con `bun run version` y el flujo `botvalia` alineado con `dev:auto`.

### Current working head

- `24a6d12` — `Add task rail and runtime thinking stream`
  - Estado real de `main` al día de hoy.
  - Incluye task rail lateral en CLI para procesos complejos y mejoras del shell/runtime compartido.
  - Aún no tiene tag de estable separado; el estable formal sigue siendo `431cf13`.

### Previous stable checkpoints

- `f72b61d` — `Align botvalia launcher startup with auto mode`
  - Punto base donde `botvalia` y `bun run dev:auto` quedaron alineados.

- `3930775` — `Mostrar BotValia Code grande en el arranque`
  - Punto útil para volver al arranque visual grande del CLI.

## UI

### Current stable

- `431cf13` — `Stabilize BotValia CLI shell and runtime UI`
  - Tag actual: `stable-ui-2026-05-02`
  - Último checkpoint formalmente etiquetado como estable para UI.
  - Runtime inspector con `BotValia-CodeUI` compilando bien, bridge validado y carga preparada para el shell real.

### Current working head

- `24a6d12` — `Add task rail and runtime thinking stream`
  - Estado real de `main` al día de hoy.
  - Incluye thinking stream conectado al runtime, contexto de canal web, modos en UI y task rail compartido con el shell.
  - Aún no tiene tag de estable separado; el estable formal sigue siendo `431cf13`.

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
4. si el `HEAD` de trabajo aún no fue etiquetado, dejarlo reflejado en `Current working head`

