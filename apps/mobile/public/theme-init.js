// Tema guardado, aplicado antes del primer pintado para que no haya destello.
// Vive en un fichero aparte (y no en un <script> inline en index.html) para que la
// CSP pueda prescindir de 'unsafe-inline' en script-src. Se carga sincrónicamente
// desde el <head>: sin defer ni async, o vuelve el destello.
// Lo mismo que hace useThemeStore.initialize() más tarde, en stores/theme.ts.
try {
  if (localStorage.getItem('theme') === 'light') {
    document.documentElement.classList.add('light');
  }
} catch (e) {
  // almacenamiento bloqueado: se queda la noche por defecto
}
