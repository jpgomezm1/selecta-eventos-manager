---
description: Lanza el qa-ux-validator runtime E2E sobre el alcance dado
argument-hint: <alcance — qué features o pantallas validar>
---

Invoca al subagente `qa-ux-validator` con el alcance: **$ARGUMENTS**

Pasale el contexto de lo que hay que validar:
- Si querés que valide un feature específico, citar commit/branch o pantallas afectadas.
- Si es una pasada general post-merge, usar "alcance: pasada general post-merge".

El agente ya tiene en su system prompt:
- Credenciales de los 4 roles de prueba.
- Dev URL `http://localhost:4001`.
- Project ref Supabase + acceso MCP para fixtures.
- Matriz de acceso UI esperada.
- Patrones técnicos críticos (Enter para commit input override, login programático, etc.).
- Protocolo anti-stuck (8 acciones por test, 60min wall time, reporte estructurado obligatorio).

Tu único trabajo es:
1. Confirmar que el dev server está arriba (`curl -sf http://localhost:4001/auth -o /dev/null`).
2. Si NO está arriba, levantarlo con `npm run dev` desde `selecta-eventos-manager/` en background.
3. Invocar al agente con la herramienta Agent (`subagent_type: "qa-ux-validator"`) pasando el alcance.
4. Cuando el agente devuelva el reporte estructurado, presentarlo al usuario.
5. Si el reporte tiene fallas con fix obvio, ofrecer aplicar las correcciones.

NO escribas un prompt largo al agente — el agente ya tiene todo el contexto que necesita en su system prompt. Solo le pasás el alcance + cualquier override específico que el usuario haya mencionado.
