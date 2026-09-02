# Iconos pendientes de rasterizar (logo C·Cuadrilla)

El logo vectorial (`apps/mobile/src/ui/Logo.tsx`, `apps/mobile/src/assets/logo.svg`,
`apps/mobile/public/favicon.svg`) ya usa la geometría nueva (5 arcos + punto).
Los siguientes PNG **mostraban el logo antiguo** (el marco de calendario
con dos puntos de encuentro) y se regeneraron a partir del SVG nuevo:

- [x] `apps/mobile/public/logo.png` — usado como icono de notificación push
      (`src/lib/push-notifications.ts`, `icon: '/logo.png'`)
- [x] `apps/mobile/public/icon-256.png` — `apple-touch-icon` en `index.html`
- [x] `apps/mobile/public/icon-512.png` — icono PWA / manifest
- [x] Iconos Android (`apps/mobile/android/app/src/main/res/mipmap-*/ic_launcher*.png`
      y adaptive icons, si existen) — generar desde `logo.svg` (variante color)
      o `favicon.svg` (variante mono), según el tamaño

## Cómo se regeneró

**2026-09-02** — Rasterizado con Inkscape (`inkscape logo.svg -w N -h N -o out.png`)
+ composición de fondos/centrado con ImageMagick (`magick -size NxN xc:'#F5F1E8' ...
-gravity center -composite`). Sin dependencias nuevas en el repo.

- `logo.png` (256×256): rasterizado directo del SVG a bordes, fondo transparente.
- `icon-256.png` / `icon-512.png`: fondo sólido papel `#F5F1E8` (no hay manifest
  con `purpose: maskable` en el repo — no se encontró `manifest.json` ni
  `VitePWA` ni `<link rel="manifest">` en `index.html`), logo centrado al 70%
  del lienzo.
- Android legacy launcher (`ic_launcher.png` / `ic_launcher_round.png` por
  densidad): fondo papel `#F5F1E8`, logo centrado al 70%; `_round` usa el
  mismo PNG que el launcher normal (el sistema aplica la máscara circular).
- Android adaptive icon foreground (`ic_launcher_foreground.png` por
  densidad, 108dp): fondo transparente, logo en la safe zone central
  (66/108 ≈ 61.1% del lienzo).
- `values/ic_launcher_background.xml`: color actualizado de `#080E1A` a
  `#F5F1E8` (papel) para que el adaptive icon combine con el logo nuevo.

Verificado con `magick identify` (dimensiones/tipo correctos) e inspección
visual de cada PNG generado, y compilación Android (`./gradlew assembleDebug`
→ BUILD SUCCESSFUL) tras `pnpm exec cap sync android`.

Fuera de alcance: `android/app/src/main/res/drawable*/splash.png` sigue
mostrando el placeholder genérico de Capacitor (no el logo antiguo ni el
nuevo); no estaba en este checklist y se deja para una tarea aparte.
