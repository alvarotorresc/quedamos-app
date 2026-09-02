***Español** · [English](README.en.md)*

<img src="apps/mobile/public/logo.png" width="96" alt="Logo de Quedamos">

# ¿Quedamos?

**Tu grupo quiere verse. Nadie sabe cuándo.**

Quedamos hace la pregunta y os avisa cuando podéis todos. Un calendario compartido para tu cuadrilla, sin más pantallas de las necesarias.

[![Abrir Quedamos](https://img.shields.io/badge/Abrir%20Quedamos-quedamos.alvarotc.com-F2EFE7?style=for-the-badge&labelColor=14120E)](https://quedamos.alvarotc.com)

[![CI](https://github.com/alvarotorresc/quedamos-app/actions/workflows/ci.yml/badge.svg)](https://github.com/alvarotorresc/quedamos-app/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/alvarotorresc/quedamos-app?labelColor=14120E&color=F2EFE7)](https://github.com/alvarotorresc/quedamos-app/releases/latest)
[![Licencia MIT](https://img.shields.io/github/license/alvarotorresc/quedamos-app?labelColor=14120E&color=F2EFE7)](./LICENSE)
![Web y Android 6.0+](https://img.shields.io/badge/Web-Android%206.0%2B-7FA98B?style=flat-square&labelColor=14120E)
![Español / English](https://img.shields.io/badge/Espa%C3%B1ol-English-60A5FA?style=flat-square&labelColor=14120E)

Versión 1.0.0 · Web y Android · Gratis, sin anuncios, código bajo MIT

## Abrir o instalar

- **Web**: [quedamos.alvarotc.com](https://quedamos.alvarotc.com). Funciona en cualquier navegador del móvil o del ordenador.
- **Android**: [descarga el APK de la última release](https://github.com/alvarotorresc/quedamos-app/releases/latest). Android avisará de que viene de fuera de Google Play; es lo normal, no algo particular de Quedamos. Abre el archivo, permite la instalación si te lo pide y pulsa **Instalar**. La versión Android añade notificaciones push y widgets en la pantalla de inicio.

Solo hace falta un email para crear la cuenta. Un grupo se crea en un toque y se comparte con un enlace.

## Qué hace

Quedar con seis personas es una cadena de mensajes que nadie quiere leer. Quedamos la sustituye por tres pasos.

1. **Sondear.** Alguien pregunta un día desde el calendario: «¿Podéis el sábado por la noche?». Cada uno contesta con un toque: puedo, no puedo, aún no sé.
2. **El aro se cierra.** Cada persona es un arco de un color en un círculo. El hueco es quien no ha respondido. Cuando el aro se cierra, podéis todos y os llega el aviso. Cero toques, cero calendario que leer.
3. **Quedamos.** Alguien propone plan, hora y sitio. Quien confirma cierra su arco. La quedada queda sellada y va al calendario de cada uno.

Y para cuando hace falta más:

- **Disponibilidad como te salga** — día completo, franjas de mañana, tarde y noche con las horas que tú definas, o un rango exacto. Vistas de semana, mes y lista, con el mejor día calculado.
- **Propuestas** — «¿Escapada a la Alpujarra?» se vota a favor o en contra y, si sale, se convierte en quedada con un toque.
- **Quedadas de verdad** — con sitio que abre el mapa, enlace de reunión si es online, descarga para tu calendario y una tarjeta para compartir por donde quieras.
- **Avisos que valen la pena** — nueva quedada, el aro que se cierra, un recordatorio 24 horas antes, quién no viene. Cada tipo se apaga por separado.
- **Widgets en Android** — la semana y el mejor día en la pantalla de inicio, sin abrir la app.
- **Seis colores. El tuyo es el tuyo.** Cada miembro tiene un color en el grupo y lo lleva a todas partes: al aro, a las quedadas, a su perfil.

## Cómo se ve

El calendario de la semana, con el aro de cada día y las acciones del día elegido:

<img src=".github/readme/calendario.png" width="260" alt="Calendario semanal con un aro por día y las acciones del sábado seleccionado">

| Preguntar al grupo | Quedadas | Grupo |
|---|---|---|
| <img src=".github/readme/preguntar.png" width="220" alt="Hoja para preguntar al grupo por un día y una franja"> | <img src=".github/readme/quedadas.png" width="220" alt="Lista de quedadas con el aro de confirmaciones de cada una"> | <img src=".github/readme/grupo.png" width="220" alt="Pantalla de grupo con los miembros y sus colores"> |

<details>
<summary>Más pantallas</summary>
<br>

| Perfil | Tema claro |
|---|---|
| <img src=".github/readme/perfil.png" width="220" alt="Perfil con la identidad del usuario y los ajustes en mosaico"> | <img src=".github/readme/calendario-claro.png" width="220" alt="El calendario semanal en tema claro"> |

</details>

_Las capturas muestran la versión en español con datos de ejemplo. La app está entera en español e inglés y tiene tema oscuro y claro._

## Lo que Quedamos no va a hacer nunca

Una lista de funciones cambia cuando conviene. Esto no: es la forma de la app.

- **Nunca** interrogarte. Una pregunta al día, como mucho. Si no hay nada, no suena.
- **Nunca** confeti. La celebración es el aro cerrándose.
- **Nunca** rachas ni puntos. Ni niveles, ni culpa por no salir.
- **Nunca** castigar la ausencia. Quien no responde es un hueco, no una falta.
- **Nunca** emojis a gritos. La voz es seca y tutea. Afirma solo cuando es verdad.
- **Nunca** una IA en vuestro plan. Vuestro plan es vuestro.

<details>
<summary><strong>Detalles técnicos</strong></summary>

### Por dentro

| | |
|---|---|
| **1.400** | tests que corren en cada cambio: 608 en la API y 792 en la app |
| **2** | idiomas, español e inglés, interfaz entera |
| **2** | temas, oscuro y claro |
| **100 %** | del código bajo MIT |

### Cómo está hecho

Un monorepo con dos aplicaciones. La app es una web que Capacitor empaqueta para Android; la API es un servicio NestJS. Supabase pone la base de datos, la autenticación y la sincronización en tiempo real; Firebase Cloud Messaging, las notificaciones push.

| | |
|---|---|
| App | React 18 · Ionic 8 · Capacitor 7 · Tailwind 3 · Vite 6 · Vitest |
| Widgets Android | Kotlin · RemoteViews · WorkManager |
| API | NestJS 10 · Prisma 6 · PostgreSQL · Jest |
| Plataforma | Supabase (Postgres, Auth, Realtime) · Firebase Cloud Messaging |
| Datos externos | Open-Meteo para el tiempo · Nominatim para buscar sitios |
| Despliegue | Web en Vercel · API en Docker tras Caddy · CI en GitHub Actions |
| Android | mínimo Android 6.0 (API 23) · objetivo Android 15 (API 35) |

### Montarlo en local

Requisitos: Node 20 o superior y pnpm 9.

```bash
git clone https://github.com/alvarotorresc/quedamos-app.git
cd quedamos-app
pnpm install
```

Copia `apps/api/.env.example` y `apps/mobile/.env.example` a `.env` y rellena las claves de tu proyecto de Supabase y de Firebase.

```bash
pnpm --filter @quedamos/api dev       # API en http://localhost:3000
pnpm --filter @quedamos/mobile dev    # app en http://localhost:5173
```

Tests, lint y tipos, por aplicación:

```bash
pnpm --filter @quedamos/api exec jest
pnpm --filter @quedamos/mobile exec vitest run
pnpm lint && pnpm typecheck
```

Ojo con `pnpm build` en `apps/api`: además de compilar, aplica las migraciones de Prisma a la base de datos de `DATABASE_URL`. Para trabajar con migraciones usa una base de datos desechable.

### Android

Hace falta Android Studio con el SDK 35 y el `google-services.json` de tu proyecto de Firebase en `apps/mobile/android/app/` (está ignorado por git y el build se niega a continuar sin él).

```bash
cd apps/mobile
pnpm build && pnpm cap:sync     # compila la web y la copia al proyecto Android
pnpm cap:android                # abre Android Studio
```

### Estructura

```
apps/api       NestJS: auth, grupos, disponibilidad, quedadas, propuestas, preguntas, notificaciones, widget
apps/mobile    React + Ionic: páginas, componentes, design system en src/ui, i18n en src/i18n
packages/shared  tipos compartidos entre las dos
```

</details>

## Licencia

[MIT](./LICENSE), todo el código. Haz con él lo que quieras; si lo publicas con otro nombre, mejor para todos.

---

¿Quedamos? · software libre bajo MIT · [Web](https://quedamos.alvarotc.com) · [Código](https://github.com/alvarotorresc/quedamos-app) · [Licencia](./LICENSE) · [Reportar un error](https://tally.so/r/ODMzOa)
