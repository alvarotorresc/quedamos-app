# Historial de versiones

## Sin publicar

- Hojas inferiores a medida de su contenido (`ui/Sheet`), en lugar de paneles a pantalla completa.
- Pantalla de Perfil rehecha como mosaico de ajustes, con interruptores legibles (`ui/Toggle`) y fichas (`ui/Tile`).
- El formulario para reportar errores pasa a Tally.
- La web se sirve desde `quedamos.alvarotc.com`; el host antiguo de Vercel redirige.
- Licencia MIT y README de producto.

## 1.0.0 — 2026-09-02

El rediseño completo. En producción para la beta.

- Identidad nueva: paleta cálida, tipografías Bricolage Grotesque y Geist Mono, logo C·Cuadrilla.
- «La pregunta»: sondear un día al grupo desde el calendario, respuesta con un toque y aviso cuando el aro se cierra.
- El aro: cada miembro es un arco de su color; el hueco es quien no ha respondido.
- Landing nueva y tarjeta compartible de la quedada.
- Widgets de Android: la semana y el mejor día, con refresco autónomo.
- Recordatorio semanal de disponibilidad.
- Notificaciones web sin duplicados y reintento del registro push.
- Arreglos de seguridad y estabilidad de la beta: CSP, CORS, rate limiting, RLS en todas las tablas.

## 0.2

- Hora de fin en las quedadas.
- Editar, eliminar y cancelar quedadas.
- Roles de fundador, administrador y miembro, con varios administradores.
- Expulsar miembros y eliminar grupo.
- Segundo mejor día en el calendario.
- Sitio de la quedada que abre el mapa.
- Propuestas con votación y conversión en quedada.
- El tiempo (Open-Meteo) en grupo, calendario y quedadas.
- Preferencias de notificación por tipo.

## 0.1

- Registro, inicio de sesión y recuperación de contraseña, con hCaptcha.
- Grupos con invitación por código o enlace.
- Calendario compartido con vistas de semana, mes y lista, disponibilidad y mejor día.
- Quedadas con confirmación de asistencia.
- Notificaciones push con recordatorio 24 horas antes.
- Sincronización en tiempo real.
- Español e inglés, tema oscuro, landing.
