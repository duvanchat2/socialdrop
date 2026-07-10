# Meta App Review — checklist para scopes de mensajería/comentarios

Este documento acompaña PR #30 (`docs/prs/PR-30.md`). El código ya soporta pedir estos
scopes vía el flag `ENABLE_MESSAGING_SCOPES=true`, pero **Meta debe aprobar la app en modo
Live para esos permisos antes de activar el flag en producción**. Este es un proceso manual
que solo puede iniciar alguien con acceso al Meta Developer Console de la app — no se puede
automatizar desde este entorno.

## Permisos a solicitar

- [ ] `instagram_manage_messages` — enviar/recibir DMs de Instagram
- [ ] `pages_messaging` — enviar/recibir DMs de Messenger/página
- [ ] `instagram_manage_comments` — responder comentarios de Instagram
- [ ] `pages_manage_engagement` — responder comentarios de página Facebook
- [ ] `pages_read_engagement` — leer comentarios/reacciones de página Facebook

## Pasos (Meta Developer Console → App Review)

- [ ] Completar **Business Verification** de la app (si Meta la exige para estos scopes)
- [ ] Grabar screencast del flujo de automatización de DMs: conectar cuenta → configurar
      Flow Builder (`SEND_DM`/`SEND_COMMENT`) → disparar evento → ver respuesta automática
- [ ] Redactar el caso de uso para cada permiso (por qué la app lo necesita, qué hace con los
      datos, cómo beneficia al usuario final)
- [ ] Confirmar que las URLs de política de privacidad y borrado de datos están accesibles y
      actualizadas: `/privacy` y `/privacy/deletion` (ya existen en el repo)
- [ ] **Excluir la extensión de Chrome de scraping de competidores del material de review** —
      riesgo de rechazo de toda la solicitud si Meta la asocia con la app (nota explícita del
      PR #30)
- [ ] Enviar la solicitud de App Review
- [ ] Mientras esté pendiente: mantener `ENABLE_MESSAGING_SCOPES=false` en producción (default)
- [ ] Al ser aprobada: activar `ENABLE_MESSAGING_SCOPES=true`, verificar con
      `GET /api/integrations/:id/permissions` que las cuentas reconectadas muestran los nuevos
      scopes en `granted`

## Coordinación con otros PRs

- PR #17 (tokens por integración) y PR #19 (firma de webhooks) — Meta también revisa que el
  webhook esté correctamente asegurado; completarlos antes de enviar la solicitud si es posible.
- El código de manejo de "permiso denegado" (endpoints de mensajería mostrando aviso accionable
  en vez de fallar en silencio) está en PR #30; `flow.engine.ts` (`sendDM`/`replyComment`) ya
  registra el código y cuerpo de error HTTP cuando Meta rechaza la llamada por falta de permisos.
