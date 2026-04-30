# Local RAG y Perfiles en BotValia

## Estado real hoy

### `/init`

Sí existe `/init`.

- Es un slash command real del CLI.
- Sirve para crear o actualizar la guía del proyecto.
- En este árbol restaurado puede trabajar con `CLAUDE.md`, `CLAUDE.local.md` y flujos relacionados de skills/hooks según la ruta elegida.

## Memoria local

BotValia ya tiene una memoria local útil para gastar menos tokens:

- memoria corta de conversación
- memoria persistente por proyecto
- recuperación semántica ligera

Hoy esa “memoria semántica” no usa una vector DB pesada ni embeddings remotos.

Usa:

- archivos JSON locales en `.botvalia/memory/`
- embeddings hash locales
- búsqueda cosine simple

Eso significa:

- sí reduce tokens y reinyecta contexto útil
- sí funciona offline/local
- no es todavía una “memoria infinita” fuerte a escala global

## Qué sería el siguiente salto serio de RAG local

Para llevar esto a un nivel más fuerte sin disparar costo, el roadmap recomendado es:

1. Mantener la memoria actual como capa barata por defecto.
2. Agregar una capa opcional de embeddings locales reales.
3. Mover la búsqueda pesada a SQLite/FTS o una vector store local liviana.
4. Separar recuperación por:
   - conversación
   - proyecto
   - equipo
   - skills/agentes
5. Añadir deduplicación y TTL por tipo de recuerdo.

## Perfiles activables/desactivables

Hoy no existe una abstracción de primer nivel llamada `profile`.

Lo más cercano y más limpio ya disponible es:

### 1. Agentes

Úsalos cuando quieres una “persona” activa:

- UX/UI Pro
- QA Pro
- Security Reviewer
- Research Analyst

Ruta recomendada:

- `.claude/agents/`

Ventajas:

- prompt propio
- tools permitidas/prohibidas
- skills asociadas
- modelo y esfuerzo dedicados

### 2. Plugins

Úsalos cuando quieres un bundle enable/disable:

- skills
- hooks
- MCP servers
- configuración agrupada

Esto es lo mejor si quieres “activar QA”, “desactivar UX”, “activar Security”, etc.

### 3. Skills

Úsalas cuando quieres capacidad puntual en vez de una persona completa:

- revisión UX
- checklist QA
- accesibilidad
- performance frontend

## Recomendación práctica

Si quieres avanzar sin romper el runtime:

1. Crear agentes para `ux-ui-pro`, `qa-pro`, `security-pro`.
2. Agruparlos luego en plugins toggleables.
3. Dejar `/profile` como fase posterior cuando ya tengamos claro el shape final.

## `/profile` futuro

Si construimos una abstracción nueva de perfiles, debería:

- persistir el perfil activo por sesión
- poder combinar agente + skills + hooks + modelo
- mostrarse en footer/header
- ser activable por slash command y por flag CLI
- convivir con `/model` y `/plan`

## Conclusión

La mejor forma de trabajar esto hoy es:

- **memoria local barata por defecto**
- **RAG local fuerte como capa opcional**
- **agentes para personas**
- **plugins para activación/desactivación**
- **`/profile` como mejora futura de producto**
