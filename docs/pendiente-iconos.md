# Iconos pendientes de rasterizar (logo C·Cuadrilla)

El logo vectorial (`apps/mobile/src/ui/Logo.tsx`, `apps/mobile/src/assets/logo.svg`,
`apps/mobile/public/favicon.svg`) ya usa la geometría nueva (5 arcos + punto).
Los siguientes PNG **siguen mostrando el logo antiguo** (el marco de calendario
con dos puntos de encuentro) y necesitan regenerarse a partir del SVG nuevo:

- [ ] `apps/mobile/public/logo.png` — usado como icono de notificación push
      (`src/lib/push-notifications.ts`, `icon: '/logo.png'`)
- [ ] `apps/mobile/public/icon-256.png` — `apple-touch-icon` en `index.html`
- [ ] `apps/mobile/public/icon-512.png` — icono PWA / manifest
- [ ] Iconos Android (`apps/mobile/android/app/src/main/res/mipmap-*/ic_launcher*.png`
      y adaptive icons, si existen) — generar desde `logo.svg` (variante color)
      o `favicon.svg` (variante mono), según el tamaño

## Cómo regenerar

Fuente: `apps/mobile/src/assets/logo.svg` (variante color, fondo transparente).

Opciones evaluadas (decisión pendiente de Álvaro):

1. **`@resvg/resvg-js`** como devDependency de `apps/mobile` — rasteriza el SVG
   a los tamaños necesarios (256, 512, mipmaps Android) en un script de build
   o un comando puntual (`pnpm exec resvg logo.svg --width 512 -o icon-512.png`).
2. **Export manual** — abrir el SVG en una herramienta de diseño (Figma,
   Inkscape) y exportar cada tamaño a mano.

Ninguna de las dos opciones bloquea el resto de Fase 2; este documento sirve
de checklist para cuando se aborde el rasterizado.
