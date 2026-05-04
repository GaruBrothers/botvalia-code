<!-- IA-SYSTEM-PROTECTION:BEGIN -->
> **REGLA OBLIGATORIA PARA CUALQUIER IA**
>
> Ningun agente de IA, incluyendo Codex, Claude, ChatGPT, Gemini o similares, puede modificar, mover, borrar, instalar, desinstalar o intervenir archivos del sistema Windows, navegadores, perfiles de navegador, extensiones, complementos, configuraciones del equipo ni otros recursos fuera de este proyecto sin permiso explicito y especifico del usuario.
>
> Si el usuario no lo pide de forma explicita y puntual, se asume prohibido.
<!-- IA-SYSTEM-PROTECTION:END -->
Quiero que resuelvas esta prueba de código siguiendo estas reglas:

1. Trabaja únicamente dentro de `resultTest/`.
2. Haz pasar todos los tests con `cd resultTest && bun test`.
3. No simplifiques los tests ni elimines cobertura.
4. Mantén la solución limpia, determinista y explicable.
5. Cuando termines, crea `resultTest/RESULT.md` con:
   - qué arreglaste
   - qué decisiones tomaste
   - qué comando usaste para validar

Contexto:

- El reto está en `resultTest/src/`.
- Los tests están en `resultTest/tests/scheduler.test.ts`.
- Hay bugs intencionales y partes incompletas.

Objetivo funcional:

- validar entrada
- detectar ciclos y dependencias faltantes
- construir un plan de ejecución determinista
- asignar el mejor worker posible por tarea
- calcular duración total y ruta crítica
- renderizar un reporte markdown coherente

