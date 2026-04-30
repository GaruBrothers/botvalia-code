# Result Test

## Objetivo

Este folder contiene una prueba difícil pero autocontenida para evaluar si BotValia
puede resolver un reto real de código sin tocar el resto del repositorio.

La prueba consiste en reparar e implementar un pequeño motor de planificación de
tareas con dependencias, asignación de recursos y renderizado de reporte.

## Reglas

1. Trabajar sólo dentro de `resultTest/`.
2. Hacer pasar todos los tests.
3. Mantener TypeScript simple, legible y sin dependencias externas.
4. Cuando termine, el agente debería dejar un `RESULT.md` con un resumen breve.

## Comandos

```bash
cd resultTest
bun test
```

## Lo que se evalúa

- lectura y comprensión multiarchivo
- detección de ciclos y validaciones
- scheduling con dependencias
- desempates deterministas
- generación de reporte legible

## Resultado esperado

Los tests deben pasar en `resultTest/tests/scheduler.test.ts`.
