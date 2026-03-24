# SocialDrop

Scheduler de redes sociales autoalojado inspirado en Postiz. Corre en un VPS sin Temporal — usa **BullMQ + Redis** para colas y **NestJS + Prisma + PostgreSQL** para el backend.

---

## Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                          SocialDrop                              │
│                                                                  │
│  ┌──────────────┐     ┌──────────────────────────────────────┐  │
│  │  Next.js 14  │────▶│              NestJS API               │  │
│  │  :4200       │     │              :3000                    │  │
│  │  (web/)      │     │                                      │  │
│  │              │     │  ┌──────────┐  ┌──────────────────┐  │  │
│  │  Dashboard   │     │  │  Drive   │  │  PostScheduler   │  │  │
│  │  Calendar    │     │  │  Module  │  │  Processor       │  │  │
│  │  New Post    │     │  └──────────┘  └──────────────────┘  │  │
│  │  Drive       │     │                                      │  │
│  │  Integrations│     │  ┌──────────────────────────────┐   │  │
│  └──────────────┘     │  │     IntegrationManager        │   │  │
│                        │  │  Instagram │ Twitter │ FB     │   │  │
│                        │  │  TikTok   │ YouTube │ LI     │   │  │
│                        │  └──────────────────────────────┘   │  │
│                        └──────────────────────────────────────┘  │
│                                    │                             │
│            ┌───────────────────────┼────────────────────┐        │
│            ▼                       ▼                    ▼        │
│     ┌─────────────┐       ┌──────────────┐    ┌──────────────┐  │
│     │  PostgreSQL  │       │    Redis      │    │  BullMQ      │  │
│     │   :5432      │       │    :6379      │    │  Queues      │  │
│     └─────────────┘       └──────────────┘    │  drive-sync  │  │
│                                                │  post-sched  │  │
│                                                │  media-proc  │  │
│                                                └──────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Estructura del monorepo (NX)

```
socialdrop/
├── apps/
│   ├── api/src/              # NestJS backend
│   │   ├── modules/
│   │   │   ├── auth/         # JWT auth
│   │   │   ├── posts/        # CRUD + BullMQ scheduler
│   │   │   ├── drive/        # Google Drive OAuth2 + CSV sync
│   │   │   ├── media/        # Upload de archivos
│   │   │   ├── integrations/ # OAuth por plataforma
│   │   │   └── stats/        # Métricas del dashboard
│   │   └── main.ts
│   └── web/src/app/          # Next.js 14 frontend
│       ├── page.tsx          # Dashboard
│       ├── calendar/         # Vista de calendario
│       ├── posts/new/        # Crear post
│       ├── drive/            # Conectar Google Drive
│       └── integrations/     # Conectar redes sociales
├── libs/
│   ├── prisma/               # PrismaClient, schema, módulo
│   ├── shared/               # Types, DTOs, enums
│   └── integrations/         # SocialAbstract + 6 providers
├── docker/
│   ├── api.Dockerfile
│   └── web.Dockerfile
├── docker-compose.yml
└── .env.example
```

---

## Requisitos previos

- **Node.js** >= 20
- **Docker** + **Docker Compose** v2
- **npm** >= 10

---

## Instalación paso a paso

### 1. Clonar y entrar al directorio

```bash
git clone <repo-url> socialdrop
cd socialdrop
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

```bash
cp .env.example .env
# Editar .env con tus credenciales reales
```

### 4. Levantar infraestructura (PostgreSQL + Redis)

```bash
docker compose up -d postgres redis
```

### 5. Ejecutar migraciones

```bash
npx prisma migrate deploy --schema=libs/prisma/prisma/schema.prisma
```

### 6. Iniciar en desarrollo

```bash
npx nx run-many -t serve -p api web --parallel
# API: http://localhost:3000/api
# Docs: http://localhost:3000/api/docs
# Web: http://localhost:4200
```

### Alternativa: script de setup automático

```bash
bash scripts/setup.sh
```

---

## Cómo obtener cada credencial

### Google Drive / YouTube
1. Ir a [Google Cloud Console](https://console.cloud.google.com/)
2. Crear proyecto → APIs & Services → Credentials
3. Crear **OAuth 2.0 Client ID** (tipo: Web application)
4. Agregar Redirect URIs:
   - `http://localhost:3000/api/drive/callback`
   - `http://localhost:3000/api/integrations/youtube/callback`
5. Copiar `Client ID` → `GOOGLE_CLIENT_ID` y `YOUTUBE_CLIENT_ID`
6. Copiar `Client Secret` → `GOOGLE_CLIENT_SECRET` y `YOUTUBE_CLIENT_SECRET`
7. Habilitar APIs: **Google Drive API**, **YouTube Data API v3**

### Facebook & Instagram
1. Ir a [Meta for Developers](https://developers.facebook.com/)
2. Crear App → Business → agregar productos: **Facebook Login**, **Instagram Graph API**
3. Configurar Redirect URI: `http://localhost:3000/api/integrations/facebook/callback`
4. En Settings → Basic: copiar `App ID` → `FACEBOOK_APP_ID` y `App Secret` → `FACEBOOK_APP_SECRET`
5. Para Instagram: agregar tu cuenta de Instagram Business y copiar el `Instagram Account ID` → `INSTAGRAM_ACCOUNT_ID`
6. Para Facebook Pages: en Graph API Explorer, generar token de página → `FACEBOOK_ACCESS_TOKEN`, copiar Page ID → `FACEBOOK_PAGE_ID`

### TikTok
1. Ir a [TikTok for Developers](https://developers.tiktok.com/)
2. Crear App → agregar producto **Content Posting API**
3. Configurar Redirect URI: `http://localhost:3000/api/integrations/tiktok/callback`
4. En App Detail: copiar `Client Key` → `TIKTOK_CLIENT_KEY` y `Client Secret` → `TIKTOK_CLIENT_SECRET`

### Twitter / X
1. Ir a [Twitter Developer Portal](https://developer.twitter.com/)
2. Crear Project + App
3. En App Settings → Keys and Tokens:
   - `API Key` → `X_API_KEY`
   - `API Secret` → `X_API_SECRET`
   - `Access Token` → `X_ACCESS_TOKEN`
   - `Access Token Secret` → `X_ACCESS_SECRET`
4. En Authentication Settings: habilitar OAuth 2.0, agregar Redirect URI: `http://localhost:3000/api/integrations/twitter/callback`

---

## Formato del CSV de Google Drive

El archivo CSV debe estar en la carpeta de Drive configurada y seguir este formato:

```csv
caption,scheduled_date,platforms,media_files
"¡Nuevo producto disponible! 🚀",2026-04-01T10:00:00Z,"instagram,twitter","foto_producto.jpg"
"Hilo sobre productividad",2026-04-02T14:30:00Z,"twitter",""
"Video tutorial completo",2026-04-03T09:00:00Z,"youtube,instagram","tutorial.mp4"
"Post de carrusel",2026-04-05T18:00:00Z,"instagram,facebook","img1.jpg,img2.jpg,img3.jpg"
```

### Reglas del CSV

| Campo | Requerido | Descripción |
|-------|-----------|-------------|
| `caption` | Sí | Texto del post (máx. 2200 chars para Instagram) |
| `scheduled_date` | Sí | Fecha ISO 8601 en UTC (`YYYY-MM-DDTHH:mm:ssZ`) |
| `platforms` | Sí | Plataformas separadas por coma: `instagram`, `twitter`, `facebook`, `tiktok`, `youtube` |
| `media_files` | No | Nombres de archivos en la misma carpeta, separados por coma |

### Flujo de sincronización

```
Google Drive carpeta
        │
        ▼
  BullMQ drive-sync (cada 5 min)
        │
        ▼
  CSV detectado → parsear filas
        │
        ▼
  Crear Posts en BD (status: SCHEDULED)
        │
        ▼
  BullMQ post-scheduler (cada 60s)
        │
        ▼
  scheduledAt <= now() → publicar
```

---

## Comandos útiles

### Desarrollo

```bash
# Levantar solo la API
npx nx serve api

# Levantar solo el frontend
npx nx serve web

# Ambos en paralelo
npx nx run-many -t serve -p api web --parallel

# Ver logs de la API
npx nx serve api --verbose
```

### Base de datos (Prisma)

```bash
# Crear nueva migración
npx prisma migrate dev --name nombre_migracion --schema=libs/prisma/prisma/schema.prisma

# Aplicar migraciones en producción
npx prisma migrate deploy --schema=libs/prisma/prisma/schema.prisma

# Abrir Prisma Studio (GUI)
npx prisma studio --schema=libs/prisma/prisma/schema.prisma

# Regenerar cliente
npx prisma generate --schema=libs/prisma/prisma/schema.prisma
```

### Docker

```bash
# Solo infraestructura (dev)
docker compose up -d postgres redis

# Stack completo (producción)
docker compose up -d

# Ver logs
docker compose logs -f api

# Reconstruir imagen
docker compose build api
docker compose up -d api
```

### Build y verificación

```bash
# Compilar API
npx nx build api

# Compilar frontend
npx nx build web

# Verificar conexiones
npx ts-node --esm scripts/test-connections.ts

# Lint
npx nx lint api
npx nx lint web
```

---

## Troubleshooting

### `nx: command not found`
```bash
npm install -g nx
# o usar directamente:
npx nx serve api
```

### `Cannot find module '@socialdrop/prisma'`
```bash
npx nx sync
npx prisma generate --schema=libs/prisma/prisma/schema.prisma
```

### Error de conexión a PostgreSQL al arrancar
```bash
# Verificar que Docker esté corriendo
docker info

# Verificar que postgres esté healthy
docker compose ps

# Ver logs de postgres
docker compose logs postgres
```

### `ECONNREFUSED` en Redis
```bash
# Verificar que redis esté corriendo
docker compose up -d redis
docker compose logs redis
```

### Google Drive no obtiene refresh_token
El `refresh_token` solo se retorna en el primer consentimiento. Si ya autorizaste la app sin `prompt: consent`, revoca el acceso en [myaccount.google.com/permissions](https://myaccount.google.com/permissions) y vuelve a autorizar.

### Posts no se publican
1. Verificar que el BullMQ worker esté corriendo (en dev, arranca con `nx serve api`)
2. Verificar credenciales con `scripts/test-connections.ts`
3. Revisar logs del API: `docker compose logs -f api`
4. Verificar que `scheduledAt` sea en UTC y que ya haya pasado

### Error de CORS
Asegúrate de que `FRONTEND_URL` en `.env` coincida exactamente con la URL del frontend (incluyendo el puerto).

---

## Variables de entorno

Ver `.env.example` para la lista completa documentada. Variables mínimas para arrancar:

```env
DATABASE_URL=postgresql://socialdrop:socialdrop_secret@localhost:5432/socialdrop
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=<string aleatorio de 64 chars>
GOOGLE_CLIENT_ID=<de Google Cloud Console>
GOOGLE_CLIENT_SECRET=<de Google Cloud Console>
```

---

## Licencia

MIT
