# ¿Quedamos?

App para coordinar quedadas con tu grupo de amigos. Marca tu disponibilidad en un calendario compartido y crea eventos cuando haya coincidencia.

**Plataformas:** Web + Android (v0.1)

## Tech Stack

| Capa | Tecnología |
|------|------------|
| Frontend | React + Ionic + Capacitor + Tailwind + Vite |
| Backend | NestJS (API REST) |
| Base de datos | PostgreSQL (Supabase) |
| Auth | Supabase Auth (email + password) |
| Push Notifications | Firebase Cloud Messaging (pendiente) |
| Monorepo | pnpm workspaces + Turborepo |

## Requisitos

- Node.js >= 20
- pnpm >= 9

## Instalación

```bash
git clone https://github.com/alvarotorresc/quedamos-app.git
cd quedamos-app
pnpm install
```

### Variables de entorno

Copia los archivos `.env.example` y configura:

**`apps/api/.env`**
```
DATABASE_URL=postgresql://...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=xxx
SUPABASE_JWT_SECRET=xxx
```

**`apps/mobile/.env`**
```
VITE_API_URL=http://localhost:3000
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxx
```

## Comandos

### Desarrollo

```bash
# Todo a la vez (API + Mobile)
pnpm dev

# Solo API (NestJS) - http://localhost:3000
pnpm --filter @quedamos/api dev

# Solo Mobile (Vite) - http://localhost:5173
pnpm --filter @quedamos/mobile dev
```

### Build y verificación

```bash
pnpm build            # Build de todos los packages
pnpm typecheck        # TypeScript check
pnpm lint             # ESLint
pnpm lint:fix         # ESLint con autofix
pnpm test             # Tests
```

### Base de datos (Prisma)

```bash
cd apps/api

npx prisma generate                      # Generar cliente Prisma
npx prisma migrate dev --name mi_cambio  # Nueva migración
npx prisma studio                        # UI para explorar la BD
npx prisma db seed                       # Seed de datos
```

### Android (Capacitor)

```bash
cd apps/mobile

pnpm cap:sync          # Sincronizar web assets con native
pnpm cap:android       # Abrir en Android Studio
pnpm cap:run:android   # Ejecutar en emulador/dispositivo
```

## Estructura del proyecto

```
quedamos-app/
├── apps/
│   ├── api/                    # NestJS backend
│   │   ├── src/
│   │   │   ├── auth/           # JWT validation, guards
│   │   │   ├── users/          # User profile
│   │   │   ├── groups/         # CRUD grupos, invitaciones
│   │   │   ├── availability/   # Disponibilidad calendario
│   │   │   ├── events/         # Quedadas
│   │   │   ├── notifications/  # Push notifications
│   │   │   └── common/         # Decorators, filters, pipes
│   │   └── prisma/             # Schema y migrations
│   │
│   └── mobile/                 # Ionic + React + Capacitor
│       ├── public/             # Favicon, icons
│       └── src/
│           ├── assets/         # Logo SVG
│           ├── components/     # Componentes feature
│           ├── hooks/          # Custom hooks (React Query)
│           ├── i18n/           # Internacionalización (es/en)
│           ├── lib/            # Supabase client, utils
│           ├── pages/          # Páginas/rutas
│           ├── services/       # API calls
│           ├── stores/         # Estado global (Zustand)
│           ├── types/          # TypeScript types
│           └── ui/             # Design system (Button, Card...)
│
├── packages/
│   └── shared/                 # Tipos compartidos API <-> Mobile
│
├── CLAUDE.md                   # Instrucciones para AI agents
├── progress.md                 # Estado detallado del proyecto
└── quedamos-prototype.jsx      # Prototipo UI de referencia
```

## Features implementadas

### Auth
- [x] Registro con email + password
- [x] Confirmación de email obligatoria
- [x] Login con credenciales
- [x] Logout
- [x] Recuperar contraseña (email con enlace de reset)
- [x] Indicador de fuerza de contraseña (8+ chars, mayúscula, número, especial)
- [x] hCaptcha invisible en todos los formularios
- [x] Protección contra contraseñas filtradas (Supabase)
- [x] Rutas protegidas (ProtectedRoute / GuestRoute)
- [x] Errores de auth traducidos al idioma activo

### UI/UX
- [x] Dark theme con paleta custom
- [x] Splash page con logo y branding
- [x] Tabs: Calendario, Quedadas, Grupo
- [x] Componentes UI: Button, Card, Avatar, AvatarStack, Badge
- [x] Diseño responsive centrado para móvil

### Internacionalización (i18n)
- [x] Español (por defecto) e Inglés
- [x] Detección automática del idioma del navegador
- [x] Selector de idioma en la pantalla de Grupo
- [x] Persistencia del idioma seleccionado (localStorage)
- [x] Todas las strings extraídas (~70 keys por idioma)

### Backend
- [x] API REST con NestJS
- [x] Prisma ORM con PostgreSQL
- [x] Guards de autenticación JWT (Supabase)
- [x] DTOs con validación (class-validator)
- [x] Endpoints para: auth, users, groups, availability, events, notifications

### Infraestructura
- [x] Monorepo con pnpm + Turborepo
- [x] Supabase (Auth + PostgreSQL)
- [x] Linear conectado a GitHub (gestión de issues)
- [x] TypeScript estricto en todo el código

## Roadmap v0.1

### Grupos
- [ ] Crear grupo (nombre + emoji)
- [ ] Generar código/URL de invitación
- [ ] Unirse a grupo por código o URL
- [ ] Ver miembros del grupo
- [ ] Salir del grupo

### Calendario compartido
- [ ] Vista semanal y mensual
- [ ] Marcar disponibilidad: día completo, franjas, rango horario
- [ ] Ver disponibilidad de todos los miembros
- [ ] Indicador de "mejor día" para quedar

### Quedadas (eventos)
- [ ] Crear quedada (título, lugar, fecha, hora)
- [ ] Lista de próximas y pasadas
- [ ] Confirmar/rechazar asistencia
- [ ] Ver asistentes

### Notificaciones
- [ ] Push: nueva quedada, confirmación, recordatorio 24h
- [ ] In-app: badge de pendientes

### Sincronización
- [ ] Tiempo real con Supabase Realtime
- [ ] Build Android con Capacitor

## Fuera de scope v0.1

- iOS
- Social login (Google/Apple)
- Chat IA / sugerencias inteligentes
- Integración con clima
- Votaciones
- Múltiples admins
- Dark/Light theme toggle

## Problemas conocidos

- `@ionic/react-router` requiere react-router v5 como peer dependency
- Supabase necesita Session Pooler (puerto 5432) para conexiones IPv4
- `pnpm` puede no estar en PATH directo en algunos sistemas, usar `npx pnpm` como alternativa
