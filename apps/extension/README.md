# SocialDrop Competitor Analyzer — Chrome Extension

## Instalar

1. Abre Chrome → `chrome://extensions`
2. Activa **"Modo desarrollador"** (toggle arriba a la derecha)
3. Haz clic en **"Cargar descomprimida"**
4. Selecciona la carpeta `apps/extension/`

## Usar

1. Navega a un perfil de Instagram (ej. `instagram.com/cocacola`)
2. Haz clic en el ícono 🎯 de SocialDrop en la barra de extensiones
3. Ingresa la URL de tu SocialDrop (ej. `https://app.socialdrop.online`)
4. Presiona **"Analizar este perfil"**
5. Se abrirá automáticamente la página de Competidores en SocialDrop

## Qué captura

- Nombre de usuario, nombre completo, bio, avatar
- Seguidores, seguidos, número de posts
- Miniaturas y URLs de los posts visibles en el grid
- Tipo de media (imagen/video/carrusel)
- Hashtags extraídos del texto alternativo

## Limitaciones

- Solo captura los posts visibles en la pantalla (no hace scroll automático)
- Los likes/comments no están disponibles sin la API de Instagram
- Para capturar más posts, haz scroll hacia abajo antes de analizar
