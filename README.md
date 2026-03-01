# ¿Quedamos?

App para coordinar quedadas con tu grupo de amigos. Marca tu disponibilidad en un calendario compartido, propón planes y vota, y crea eventos cuando haya coincidencia.

**Plataformas:** Web + Android | **Versión actual:** v0.2

## Tech Stack

| Capa | Tecnología |
|------|------------|
| Frontend | React + Ionic + Capacitor + Tailwind + Vite |
| Backend | NestJS (API REST) |
| Base de datos | PostgreSQL (Supabase) |
| Auth | Supabase Auth (email + password) |
| Push Notifications | Firebase Cloud Messaging |
| Clima | Open-Meteo API (gratuita, sin API key) |
| Monorepo | pnpm workspaces + Turborepo |
| Pre-commit | Lefthook (lint + format) |

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
pnpm test             # Tests (289 backend + frontend)
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
│   │   │   ├── groups/         # Grupos, invitaciones, roles, ciudades
│   │   │   ├── availability/   # Disponibilidad calendario
│   │   │   ├── events/         # Quedadas (CRUD + asistencia)
│   │   │   ├── proposals/      # Votaciones de planes
│   │   │   ├── weather/        # Clima (Open-Meteo)
│   │   │   ├── notifications/  # Push notifications + preferencias
│   │   │   └── common/         # Decorators, filters, pipes, Prisma helpers
│   │   └── prisma/             # Schema y migrations
│   │
│   └── mobile/                 # Ionic + React + Capacitor
│       ├── public/             # Favicon, icons
│       └── src/
│           ├── components/     # EventCard, ProposalCard, WeatherWidget...
│           ├── hooks/          # React Query hooks
│           ├── i18n/           # Internacionalización (es/en)
│           ├── lib/            # Utils (calendar, maps, weather, sync)
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
├── lefthook.yml                # Pre-commit hooks (lint + format)
└── quedamos-prototype.jsx      # Prototipo UI de referencia
```

## Features

### Auth
- [x] Registro con email + password + confirmación por email
- [x] Login / logout
- [x] Recuperar contraseña (email con enlace de reset)
- [x] Indicador de fuerza de contraseña
- [x] hCaptcha invisible en formularios
- [x] Errores de auth traducidos

### Grupos
- [x] Crear grupo (nombre + emoji)
- [x] Código/URL de invitación (regenerable por admins)
- [x] Unirse por código o URL
- [x] Ver miembros con roles (Admin / Miembro / Fundador)
- [x] Salir del grupo (creador no puede abandonar)
- [x] Sistema de roles: fundador → admin → miembro
- [x] Promover/degradar admins (multi-admin)
- [x] Expulsar miembros (limpia asistencia a eventos futuros)
- [x] Eliminar grupo (solo fundador, con confirmación)

### Calendario compartido
- [x] Vista semanal, mensual y lista
- [x] Marcar disponibilidad: día completo, franjas horarias, rango
- [x] Ver disponibilidad de todos los miembros
- [x] "Mejor día" y "Otro día" recomendados
- [x] Iconos de clima en cada día del calendario
- [x] Estadísticas mensuales (días activos, mejor coincidencia, miembros activos)

### Quedadas (eventos)
- [x] Crear quedada (título, descripción, lugar, fecha, hora inicio/fin)
- [x] Editar quedada (solo creador)
- [x] Eliminar quedada (solo creador, con confirmación)
- [x] Cancelar quedada (marcar como cancelada)
- [x] Confirmar/rechazar asistencia (toggle interactivo)
- [x] Lista de próximas y pasadas (colapsable)
- [x] Ubicación clickable → abre Google Maps
- [x] Badge de clima en cada evento

### Propuestas (votaciones)
- [x] Crear propuesta (título, descripción, lugar, fecha propuesta opcional)
- [x] Editar propuesta (solo creador)
- [x] Votar a favor / en contra (puede cambiar voto)
- [x] Barra visual de votos (verde/rojo con porcentaje)
- [x] Convertir propuesta en quedada
- [x] Cerrar propuesta
- [x] Propuestas cerradas con toggle colapsable
- [x] Tabs separadas: Quedadas | Propuestas

### Clima
- [x] Ciudades por grupo (admin añade/elimina)
- [x] Widget de clima en la página de grupo
- [x] Badge de clima en eventos (clickable, detalle por ciudad)
- [x] Iconos de clima en calendario (semana, mes, lista)
- [x] Descripciones traducidas (ES/EN)
- [x] Cache de 30min para evitar llamadas excesivas

### Notificaciones
- [x] Push: nueva quedada, confirmación, recordatorio 24h, rechazo
- [x] Push: nuevo/salida de miembro, cambio de rol, expulsión
- [x] Push: nueva propuesta, voto, conversión
- [x] Preferencias por tipo (página dedicada)

### UI/UX
- [x] Dark theme con paleta custom
- [x] Internacionalización completa (ES/EN, ~200 keys)
- [x] Landing page
- [x] Diseño responsive centrado para móvil
- [x] Desktop frame decorativo
- [x] Componentes UI: Button, Card, Avatar, AvatarStack, Badge

### Infraestructura
- [x] Monorepo con pnpm + Turborepo
- [x] TypeScript estricto en todo el código
- [x] Lefthook pre-commit (lint + format)
- [x] 289 tests backend (25 suites)
- [x] Tiempo real con Supabase Broadcast
- [x] Build Android con Capacitor
- [x] CI/CD con GitHub Actions

### Seguridad
- [x] No se exponen emails en responses (PUBLIC_USER_SELECT)
- [x] No se expone inviteCode en responses generales
- [x] Validación de input en boundaries (DTOs con class-validator)
- [x] Rate limiting en endpoints sensibles (@Throttle)
- [x] Protección contra mass assignment (whitelists explícitas)
- [x] IDOR checks en operaciones de ciudades
- [x] URLs construidas con URLSearchParams (sin interpolación)

## Historial de versiones

### v0.2 (actual)
- Hora fin en eventos (rango horario)
- Editar, eliminar y cancelar quedadas
- Sistema de roles (fundador/admin/miembro) con multi-admin
- Expulsar miembros y eliminar grupo
- Segundo mejor día en calendario
- Ubicación clickable con Google Maps
- Sistema de propuestas/votaciones completo
- Integración de clima (Open-Meteo) en grupo, calendario y eventos
- Notificaciones en página separada
- 14 fixes de seguridad aplicados
- De 159 a 289 tests

### v0.1
- Auth completo (registro, login, reset password, hCaptcha)
- Grupos (crear, unirse por código/link, compartir)
- Calendario compartido (vistas semanal/mensual/lista, disponibilidad, mejor día)
- Eventos (crear, confirmar/rechazar asistencia)
- Push notifications (FCM, preferencias, recordatorio 24h)
- Tiempo real (Supabase Broadcast)
- i18n (ES/EN), dark mode, landing page
- Bot de Telegram para beta privada
- 159 tests (64 backend + 95 frontend)

## Roadmap v0.3

- [ ] Widgets Android (Kotlin + Jetpack Glance)
- [ ] iOS app
- [ ] Social login (Google/Apple)
- [ ] Chat IA / sugerencias inteligentes
- [ ] Badge in-app de notificaciones pendientes

## Problemas conocidos

- `@ionic/react-router` requiere react-router v5 como peer dependency
- Supabase necesita Session Pooler (puerto 5432) para conexiones IPv4
