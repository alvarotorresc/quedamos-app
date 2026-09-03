// Contraste WCAG 2.x (relative luminance) para los pares principales de la paleta
// definida en apps/mobile/src/index.css (variables --app-*). Uso: node contrast.js
function hex(h) {
  h = h.replace('#', '');
  if (h.length === 3)
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}
function lum([r, g, b]) {
  const f = (c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function blend(fg, a, bg) {
  return fg.map((c, i) => Math.round(c * a + bg[i] * (1 - a)));
}
function ratio(f, b) {
  const L1 = lum(f),
    L2 = lum(b);
  return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
}
const dark = {
  bg: '#14120E',
  bgLight: '#191712',
  surface: '#1F1C16',
  text: '#F2EFE7',
  muted: '#8F887A',
  mutedPanel: '#6E6858',
  textDark: '#6B6558',
  apagado: '#5E584C',
  success: '#7FA98B',
  warning: '#C98D6B',
  error: '#D06A5C',
  primary: '#F2EFE7',
  onPrimary: '#14120E',
};
const light = {
  bg: '#F5F1E8',
  bgLight: '#FCFAF4',
  surface: '#EDE8DD',
  text: '#33302A',
  muted: '#6E6858',
  mutedPanel: '#ABA491',
  textDark: '#A39B87',
  apagado: '#C9C0AE',
  success: '#3E7350',
  warning: '#8F6226',
  error: '#B04436',
  primary: '#33302A',
  onPrimary: '#F5F1E8',
};
const pairs = [
  ['text', 'bg'],
  ['text', 'bgLight'],
  ['text', 'surface'],
  ['muted', 'bg'],
  ['muted', 'bgLight'],
  ['muted', 'surface'],
  ['mutedPanel', 'bg'],
  ['mutedPanel', 'bgLight'],
  ['textDark', 'bg'],
  ['textDark', 'bgLight'],
  ['apagado', 'bg'],
  ['success', 'bg'],
  ['warning', 'bg'],
  ['error', 'bg'],
  ['onPrimary', 'primary'],
];
for (const [name, p] of [
  ['DARK (default)', dark],
  ['LIGHT', light],
]) {
  console.log('== ' + name);
  for (const [f, b] of pairs) {
    const r = ratio(hex(p[f]), hex(p[b]));
    const tag = r >= 4.5 ? 'AA' : r >= 3 ? 'AA-large/UI only' : 'FAIL';
    console.log(`${(f + ' on ' + b).padEnd(24)} ${p[f]} / ${p[b]}  ${r.toFixed(2)}:1  ${tag}`);
  }
  // borde 12% sobre bg (componente, 3:1)
  const border = blend(hex(p.text), 0.12, hex(p.bg));
  console.log(
    `border(12% text) on bg     ${ratio(border, hex(p.bg)).toFixed(2)}:1  (UI 3:1 -> ${ratio(border, hex(p.bg)) >= 3 ? 'ok' : 'FAIL'})`,
  );
  const borderS = blend(hex(p.text), 0.32, hex(p.bg));
  console.log(
    `border-strong(32%) on bg   ${ratio(borderS, hex(p.bg)).toFixed(2)}:1  (UI 3:1 -> ${ratio(borderS, hex(p.bg)) >= 3 ? 'ok' : 'FAIL'})`,
  );
}
