# SocialDrop Chrome Extension

Analyze Instagram and TikTok competitor profiles and sync data to SocialDrop.

## Instalación

1. Abre Chrome → `chrome://extensions`
2. Activa "Modo desarrollador"
3. Click "Cargar descomprimida"
4. Selecciona esta carpeta: `apps/extension/`

## Uso

1. Navega a un perfil de Instagram (`https://www.instagram.com/<usuario>/`) o TikTok (`https://www.tiktok.com/@<usuario>`).
2. Aparece un panel flotante en la esquina superior derecha de la página.
3. Acciones disponibles:
   - **⬇ Auto-scroll** — carga toda la grilla del perfil (hasta 300 posts).
   - **📈 Cargar métricas** _(solo Instagram)_ — pide likes/comments/captions al endpoint `web_profile_info` (requiere estar logueado en IG).
   - **📊 Exportar CSV** — descarga `socialdrop_<plataforma>_<usuario>_<fecha>.csv`.
   - **✨ Sincronizar con SocialDrop** — envía perfil + posts al backend.
4. Para sincronizar, primero abre el popup de la extensión y configura la URL del API (ej. `https://app.socialdrop.online`).

## Permisos

- `activeTab` — leer la pestaña activa
- `storage` — guardar la URL del API
- `scripting` — fallback de inyección si el content script no cargó
- Hosts: `instagram.com`, `tiktok.com`

## Arquitectura

| Archivo | Rol |
|---|---|
| `manifest.json` | MV3 — declara content scripts por dominio |
| `panel.js` | UI flotante compartida (CSS, botones, auto-scroll, CSV, sync) |
| `instagram.js` | Adapter Instagram (scrapers + `web_profile_info`) |
| `tiktok.js` | Adapter TikTok (scrapers DOM, sin endpoint de métricas) |
| `popup.html/js` | Popup de configuración (URL del API + botón directo) |

Para añadir una plataforma nueva: crea `<plataforma>.js` que llame `window.SDPanel.init({ platform, isProfilePage, scrapeProfile, scrapePosts, fetchMetrics? })` y declara el content script en el manifest.

## Disclaimer

El uso del endpoint privado `web_profile_info` viola los Términos de Servicio de Meta. Úsalo bajo tu propio riesgo y con cuentas que aceptes que puedan recibir limitaciones.
